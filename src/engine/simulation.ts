import {
  inputsSchema,
  type ProjectInputs,
  type SegmentState,
  type SimulationResults,
  type Metrics,
  type OperatingState,
  type SimulationSnapshot,
} from "@/types/model";
import {
  areaAt,
  irrigatedArea,
  filledHeight,
  generateCells,
  generateSegments,
  resolveInputs,
} from "./geometry";
import {
  disposalCapacity,
  disposalGeometry,
  engineeringWarnings,
  totalLand,
} from "./analysis";

const EPS = 1e-5;
const terminal = (s: OperatingState) =>
  s === "SPENT" || s === "READY_FOR_OVERSTACKING";
export const isOperatingDay = (day: number, daysPerYear: number) =>
  Math.floor((day * daysPerYear) / 365) >
  Math.floor(((day - 1) * daysPerYear) / 365);
export const inShutdown = (day: number, start: number, end: number) =>
  start > 0 && day >= start && day <= end;
export const minimumStackingDays = (p: ProjectInputs) =>
  Math.ceil(p.oreTonnes / p.stackingRate);
export function simulate(raw: ProjectInputs): SimulationResults {
  const p = resolveInputs(inputsSchema.parse(raw)),
    cells = generateCells(p),
    segments = generateSegments(p, cells);
  const byCell = new Map(cells.map((c) => [c.id, c]));
  const cellSegments = new Map<string, number[]>();
  for (const s of segments)
    cellSegments.set(s.cellId, [
      ...(cellSegments.get(s.cellId) ?? []),
      s.index,
    ]);
  let states: SegmentState[] = segments.map((s) => ({
    index: s.index,
    state: p.blockedCells.includes(s.cellId)
      ? "BLOCKED"
      : s.lift === 1
        ? "AVAILABLE"
        : "EMPTY",
    tonnes: 0,
    fed: 0,
    removed: 0,
    leachDays: 0,
    solution: 0,
    since: 0,
    cycle: 1,
    stackStart: null,
    stackEnd: null,
    leachStart: null,
    drainEnd: null,
  }));
  const initial = states.map((s) => ({ ...s }));
  const capacity = segments
    .filter((s) => !p.blockedCells.includes(s.cellId))
    .reduce((a, s) => a + s.capacity, 0);
  const zero: Metrics = {
    stacked: 0,
    stored: 0,
    active: 0,
    spent: 0,
    removed: 0,
    remaining: p.oreTonnes,
    disposal: 0,
    accounted: p.oreTonnes,
    massError: 0,
    height: 0,
    activeArea: 0,
    flow: 0,
    solution: 0,
    activeCells: 0,
    stackingUtilization: 0,
    stackingOperatingDays: 0,
    landUsed: totalLand(p),
    padOccupiedArea: 0,
    disposalOccupiedArea: 0,
    landUtilization: 0,
  };
  const result: SimulationResults = {
    inputs: p,
    cells,
    segments,
    initial,
    frames: [{ day: 0, changes: [], metrics: zero }],
    events: [],
    capacity,
    status: "horizon",
    reason: "Simulation horizon reached; completion is not established.",
    stackingCompleteDay: null,
    completionDay: null,
    warnings: engineeringWarnings(p, capacity),
  };
  const sequence = [...segments].sort((a, b) => {
    if (a.lift !== b.lift) return a.lift - b.lift;
    const ca = byCell.get(a.cellId)!,
      cb = byCell.get(b.cellId)!;
    if (p.sequence === "column")
      return ca.column - cb.column || ca.row - cb.row;
    if (p.sequence === "right") return cb.column - ca.column || ca.row - cb.row;
    if (p.sequence === "left") return ca.column - cb.column || ca.row - cb.row;
    return ca.row - cb.row || ca.column - cb.column;
  });
  const reusable = p.scenario !== "permanent";
  const clear =
    p.geotech &&
    p.permeability &&
    p.foundation &&
    p.approvedLiftHeight !== null &&
    p.approvedHeight !== null;
  const hydraulicLimit = Math.min(
    p.irrigationCapacity,
    p.pumpCapacity ?? Infinity,
    p.linerCapacity ?? Infinity,
  );
  const storageLimit = Math.min(disposalCapacity(p), p.oreTonnes);
  const maxDays = 20000;
  const maxIdle = Math.max(
    366,
    p.leachDays + p.setupDays + p.rinseDays + p.drainDays + p.prepDays + 366,
    p.shutdownEnd + 2,
    p.irrigationShutdownEnd + 2,
  );
  let stacked = 0,
    removed = 0,
    solution = 0,
    operatingCount = 0,
    idle = 0;
  const cachedMass = segments.map(() => -1),
    cachedHeights = segments.map((s) => s.z0);
  const currentHeight = (index: number) => {
    if (cachedMass[index] !== states[index].tonnes) {
      cachedMass[index] = states[index].tonnes;
      cachedHeights[index] = filledHeight(
        p,
        byCell.get(segments[index].cellId)!,
        segments[index],
        states[index].tonnes,
      );
    }
    return cachedHeights[index];
  };
  let changedCount = 0;
  for (let day = 1; day <= maxDays; day++) {
    const updates = new Map<number, SegmentState>();
    const touch = (index: number) => {
      if (!updates.has(index)) {
        const clone = { ...states[index] };
        updates.set(index, clone);
        states[index] = clone;
      }
      return states[index];
    };
    const transition = (
      index: number,
      state: OperatingState,
      note?: string,
    ) => {
      const s = touch(index);
      if (s.state === state) return;
      s.state = state;
      s.since = day;
      const def = segments[index];
      result.events.push({
        day,
        cellId: def.cellId,
        lift: def.lift,
        cycle: s.cycle,
        state,
        message: note ?? state.toLowerCase().replaceAll("_", " "),
      });
    };
    const previousStacked = stacked,
      previousRemoved = removed;
    // At the start of a calendar day, finished stages release the next operation.
    for (const def of segments)
      for (let stage = 0; stage < 6; stage++) {
        const s = states[def.index];
        if (s.state === "IRRIGATION_SETUP" && day - s.since >= p.setupDays)
          transition(s.index, "LEACHING");
        else if (s.state === "LEACHING" && s.leachDays >= p.leachDays)
          transition(s.index, "RINSING");
        else if (s.state === "RINSING" && day - s.since >= p.rinseDays)
          transition(s.index, "DRAINING");
        else if (s.state === "DRAINING" && day - s.since >= p.drainDays) {
          touch(s.index).drainEnd = day;
          const upper = cellSegments
            .get(def.cellId)!
            .some((i) => segments[i].lift === def.lift + 1);
          transition(
            s.index,
            !reusable && upper && clear ? "READY_FOR_OVERSTACKING" : "SPENT",
          );
        } else if (
          s.state === "PAD_PREPARATION" &&
          day - s.since >= p.prepDays
        ) {
          const reset = touch(s.index);
          reset.fed = 0;
          reset.removed = 0;
          reset.leachDays = 0;
          reset.solution = 0;
          reset.cycle++;
          reset.stackStart = null;
          reset.stackEnd = null;
          reset.leachStart = null;
          reset.drainEnd = null;
          transition(
            s.index,
            "AVAILABLE",
            "Pad inspected; bay released for reuse",
          );
        } else break;
      }
    const productionDay =
      isOperatingDay(day, p.operatingDays) &&
      !inShutdown(day, p.shutdownStart, p.shutdownEnd);
    let feed = productionDay
      ? Math.min(p.stackingRate, p.oreTonnes - stacked)
      : 0;
    for (const def of sequence) {
      if (feed <= EPS) break;
      const s = states[def.index];
      if (
        !["AVAILABLE", "EMPTY", "STACKING"].includes(s.state) ||
        p.blockedCells.includes(def.cellId)
      )
        continue;
      if (
        !(p.scenario === "permanent" && p.stackingMode === "continuous") &&
        p.approvedLiftHeight !== null &&
        def.z1 - def.z0 > p.approvedLiftHeight + EPS
      )
        continue;
      if (p.approvedHeight !== null && def.z1 > p.approvedHeight + EPS)
        continue;
      if (def.lift > 1) {
        const lowerIndex = cellSegments
          .get(def.cellId)!
          .find((i) => segments[i].lift === def.lift - 1);
        if (
          !clear ||
          lowerIndex === undefined ||
          !terminal(states[lowerIndex].state) ||
          states[lowerIndex].tonnes < segments[lowerIndex].capacity - EPS
        )
          continue;
        if (
          s.state !== "STACKING" &&
          states[lowerIndex].state === "READY_FOR_OVERSTACKING"
        )
          transition(
            lowerIndex,
            "SPENT",
            "Overstacked; underlying ore retained in place",
          );
      }
      if (s.state !== "STACKING") {
        touch(s.index).stackStart = day;
        transition(s.index, "STACKING");
      }
      const allocation = Math.min(feed, def.capacity - s.tonnes);
      const current = touch(s.index);
      current.tonnes += allocation;
      current.fed += allocation;
      stacked += allocation;
      feed -= allocation;
      if (
        current.tonnes >= def.capacity - EPS ||
        stacked >= p.oreTonnes - EPS
      ) {
        current.stackEnd = day;
        transition(
          s.index,
          "IRRIGATION_SETUP",
          "Stacking complete; irrigation setup",
        );
      }
    }
    if (stacked > previousStacked + EPS) operatingCount++;
    if (stacked >= p.oreTonnes - EPS && result.stackingCompleteDay === null)
      result.stackingCompleteDay = day;
    // Whole irrigation zones share instantaneous m³/h capacity. Waiting zones retain history.
    let flow = 0,
      activeArea = 0,
      activeCells = 0,
      irrigationProgress = 0;
    if (!inShutdown(day, p.irrigationShutdownStart, p.irrigationShutdownEnd))
      for (const def of segments) {
        const s = states[def.index];
        if (s.state !== "LEACHING") continue;
        const cell = byCell.get(def.cellId)!;
        const area = irrigatedArea(p, cell, def, s.tonnes);
        const demand = (area * p.irrigationRate) / 1000;
        if (flow + demand > hydraulicLimit + EPS) continue;
        const current = touch(s.index);
        current.leachDays = Math.min(p.leachDays, current.leachDays + 1);
        if (current.leachStart === null) current.leachStart = day;
        const applied = demand * p.irrigationHours;
        current.solution += applied;
        solution += applied;
        flow += demand;
        activeArea += area;
        activeCells++;
        irrigationProgress++;
      }
    let removalBudget =
      reusable &&
      isOperatingDay(day, p.removalOperatingDays) &&
      !inShutdown(day, p.shutdownStart, p.shutdownEnd)
        ? p.removalRate
        : 0;
    for (const def of sequence) {
      if (removalBudget <= EPS) break;
      const s = states[def.index];
      if (
        !reusable ||
        !(terminal(s.state) || s.state === "REMOVING") ||
        s.tonnes <= EPS
      )
        continue;
      const amount = Math.min(
        removalBudget,
        s.tonnes,
        Math.max(0, storageLimit - removed),
      );
      if (amount <= EPS) continue;
      transition(s.index, "REMOVING");
      const current = touch(s.index);
      current.tonnes -= amount;
      current.removed += amount;
      removed += amount;
      removalBudget -= amount;
      if (current.tonnes <= EPS) {
        current.tonnes = 0;
        transition(
          s.index,
          "PAD_PREPARATION",
          "Removal complete; pad inspection / preparation",
        );
      }
    }
    let stored = 0,
      active = 0,
      spent = 0,
      height = 0,
      padOccupiedArea = 0;
    const occupied = new Set<string>();
    for (const def of segments) {
      const s = states[def.index];
      stored += s.tonnes;
      if (s.state === "LEACHING") active += s.tonnes;
      if (terminal(s.state) || s.state === "REMOVING") spent += s.tonnes;
      if (s.tonnes > EPS) height = Math.max(height, currentHeight(def.index));
      if (s.tonnes > EPS && !occupied.has(def.cellId)) {
        occupied.add(def.cellId);
        padOccupiedArea += areaAt(p, byCell.get(def.cellId)!, def.z0);
      }
    }
    const remaining = Math.max(0, p.oreTonnes - stacked),
      accounted = stored + removed + remaining;
    const changes = [...updates.values()];
    changedCount += changes.length;
    const disposalOccupiedArea = reusable
      ? disposalGeometry(p, removed).area
      : 0;
    const landUsed = totalLand(p);
    result.frames.push({
      day,
      changes,
      metrics: {
        stacked,
        stored,
        active,
        spent,
        removed,
        remaining,
        disposal: removed,
        accounted,
        massError: accounted - p.oreTonnes,
        height,
        activeArea,
        flow,
        solution,
        activeCells,
        stackingUtilization: productionDay
          ? ((stacked - previousStacked) / p.stackingRate) * 100
          : 0,
        stackingOperatingDays: operatingCount,
        landUsed,
        padOccupiedArea,
        disposalOccupiedArea,
        landUtilization:
          ((padOccupiedArea +
            (p.scenario === "existing-tsf" ? 0 : disposalOccupiedArea)) /
            landUsed) *
          100,
      },
    });
    const done =
      remaining <= EPS &&
      (reusable
        ? stored <= EPS &&
          states.every(
            (s) =>
              s.state === "AVAILABLE" ||
              s.state === "EMPTY" ||
              s.state === "BLOCKED",
          )
        : states.every((s) => s.tonnes <= EPS || terminal(s.state)));
    if (done) {
      result.status = "complete";
      result.completionDay = day;
      result.reason = reusable
        ? "All ore processed, transferred to disposal and pad preparation completed."
        : "All ore stacked, leached, rinsed and drained. Closure readiness still requires engineering approval.";
      break;
    }
    const progressed =
      stacked > previousStacked + EPS ||
      removed > previousRemoved + EPS ||
      irrigationProgress > 0 ||
      changes.length > 0;
    idle = progressed ? 0 : idle + 1;
    if (idle >= maxIdle) {
      result.status = "stalled";
      result.reason =
        remaining > EPS && !reusable && !clear
          ? "Upper stacking awaits engineering clearance; no eligible lower-lift space remains."
          : removed >= storageLimit - EPS && reusable
            ? "Disposal storage capacity exhausted; removal and pad reuse are blocked."
            : "No schedulable progress: review geometric capacity, blocked cells, approved heights and irrigation flow per zone.";
      break;
    }
    if (changedCount > 2_000_000) {
      result.reason =
        "Interactive history limit reached (2 million segment-day changes). Increase cell size or reduce the project horizon.";
      break;
    }
  }
  return result;
}

const caches = new WeakMap<SimulationResults, Map<number, SegmentState[]>>();
export function snapshotAt(
  result: SimulationResults,
  requestedDay: number,
): SimulationSnapshot {
  const day = Math.max(
    0,
    Math.min(Math.round(requestedDay), result.frames.length - 1),
  );
  let cache = caches.get(result);
  if (!cache) {
    cache = new Map([[0, result.initial]]);
    caches.set(result, cache);
  }
  let base = 0;
  for (const key of cache.keys()) if (key <= day && key > base) base = key;
  let segments = [...cache.get(base)!];
  for (let d = base + 1; d <= day; d++) {
    for (const update of result.frames[d].changes)
      segments[update.index] = update;
    if (d % 30 === 0) cache.set(d, [...segments]);
  }
  // Bound checkpoint memory while retaining exact event replay for every day.
  if (cache.size > 64)
    for (const key of cache.keys()) {
      if (key !== 0 && key !== base) cache.delete(key);
      if (cache.size <= 48) break;
    }
  return { day, segments, metrics: result.frames[day].metrics };
}
