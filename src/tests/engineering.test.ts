import { describe, expect, it } from "vitest";
import {
  defaults,
  inputsSchema,
  type ProjectInputs,
  type Scenario,
} from "@/types/model";
import {
  areaAt,
  envelopeVolume,
  generateCells,
  generateSegments,
  irrigatedArea,
  meshVolume,
  nominalCellCapacity,
  oreVolume,
  requiredFootprint,
  segmentMesh,
  VOLUME_TOLERANCE,
} from "@/engine/geometry";
import {
  disposalGeometry,
  engineeringWarnings,
  indicativeCosts,
} from "@/engine/analysis";
import {
  isOperatingDay,
  minimumStackingDays,
  simulate,
  snapshotAt,
} from "@/engine/simulation";
import { runSensitivity } from "@/engine/sensitivity";

const approved = {
  ...defaults,
  geotech: true,
  permeability: true,
  foundation: true,
  approvedHeight: 40,
  approvedLiftHeight: 10,
};
const small: ProjectInputs = {
  ...approved,
  length: 100,
  width: 100,
  cellLength: 50,
  cellWidth: 50,
  slope: 0,
  oreTonnes: 220000,
  stackingRate: 10000,
  removalRate: 10000,
  operatingDays: 365,
  removalOperatingDays: 365,
  leachDays: 5,
  setupDays: 2,
  rinseDays: 2,
  drainDays: 2,
  irrigationCapacity: 1000,
};
describe("engineering geometry", () => {
  it("converts 3 Mt to 1,875,000 m³", () =>
    expect(oreVolume(3_000_000, 1.6)).toBe(1_875_000));
  it("gives an unclipped interior cell 40,000 t", () =>
    expect(nominalCellCapacity(50, 50, 10, 1.6)).toBe(40000));
  it("requires at least 1,200 operating days", () =>
    expect(minimumStackingDays(defaults)).toBe(1200));
  it("uses the physical 300 × 200 m grid", () => {
    const cells = generateCells({ ...defaults, length: 300, width: 200 });
    expect(cells).toHaveLength(24);
    expect(cells[9]).toMatchObject({
      id: "B4",
      x: 150,
      y: 50,
      length: 50,
      width: 50,
    });
  });
  it("sums clipped cell capacities to the analytical envelope", () => {
    const cells = generateCells(defaults),
      segments = generateSegments(defaults, cells);
    expect(segments.reduce((sum, s) => sum + s.volume, 0)).toBeCloseTo(
      envelopeVolume(400, 300, 40, 3),
      6,
    );
    expect(segments[0].capacity).toBeLessThan(40000);
  });
  it("matches actual triangulated mesh volume for full, partial and clipped segments", () => {
    for (const p of [
      defaults,
      { ...defaults, length: 273, width: 231 },
      { ...defaults, slope: 0 },
    ]) {
      const cells = generateCells(p),
        defs = generateSegments(p, cells);
      for (const def of defs)
        for (const fraction of [0.13, 0.5, 1]) {
          const cell = cells.find((c) => c.id === def.cellId)!;
          const mass = def.capacity * fraction;
          expect(meshVolume(segmentMesh(p, cell, def, mass))).toBeCloseTo(
            mass / p.density,
            3,
          );
          const gpuMesh = segmentMesh(p, cell, def, mass);
          gpuMesh.positions = Array.from(new Float32Array(gpuMesh.positions));
          expect(
            Math.abs(meshVolume(gpuMesh) - mass / p.density) /
              (mass / p.density),
          ).toBeLessThan(VOLUME_TOLERANCE);
        }
    }
  });
  it("never creates segments above the permitted geometry", () => {
    const p = { ...defaults, maxHeight: 23 };
    expect(
      Math.max(...generateSegments(p, generateCells(p)).map((s) => s.z1)),
    ).toBe(23);
  });
  it("solves ore quantity to footprint without violating the slope", () => {
    const f = requiredFootprint(1875000, 40, 3);
    expect(envelopeVolume(f.length, f.width, 40, 3)).toBeCloseTo(1875000, 5);
    expect(f.width).toBeGreaterThan(240);
  });
  it("clips area at the perimeter", () =>
    expect(areaAt(defaults, generateCells(defaults)[0], 10)).toBe(400));
  it("assigns a positive irrigation footprint to perimeter wedges with no flat top", () => {
    const cells = generateCells(defaults);
    const def = generateSegments(defaults, cells).find(
      (s) => s.cellId === "A1" && s.lift === 2,
    )!;
    expect(def.topArea).toBe(0);
    expect(irrigatedArea(defaults, cells[0], def, def.capacity)).toBe(400);
  });
  it("grows spent storage footprint and height while preserving slope and mass", () => {
    const first = disposalGeometry(defaults, 100000),
      final = disposalGeometry(defaults, 3000000);
    expect(first.area).toBeLessThan(final.area);
    expect(first.height).toBeLessThan(final.height);
    for (const shape of [first, final])
      expect(
        envelopeVolume(
          shape.length,
          shape.width,
          shape.height,
          defaults.disposalSlope,
        ),
      ).toBeCloseTo(shape.volume, 5);
  });
});
describe("deterministic daily scheduling", () => {
  it("completes the approved 3-million-tonne permanent plan after at least 1,200 production days", () => {
    const r = simulate(approved);
    expect(r.status).toBe("complete");
    expect(
      r.frames.at(-1)!.metrics.stackingOperatingDays,
    ).toBeGreaterThanOrEqual(1200);
    expect(r.frames.at(-1)!.metrics.stacked).toBeCloseTo(3000000);
    expect(r.completionDay!).toBeGreaterThan(r.stackingCompleteDay!);
    expect(r.events.some((e) => e.lift === 3 && e.state === "STACKING")).toBe(
      true,
    );
  });
  it("supports more than a thousand physical lift segments with conserved history", () => {
    const r = simulate({ ...approved, cellLength: 15, cellWidth: 15 });
    expect(r.segments.length).toBeGreaterThan(1000);
    expect(r.status).toBe("complete");
    expect(Math.abs(r.frames.at(-1)!.metrics.massError)).toBeLessThan(1e-5);
    const last = snapshotAt(r, r.frames.length - 1);
    snapshotAt(r, 10);
    expect(snapshotAt(r, r.frames.length - 1).metrics).toEqual(last.metrics);
  });
  it("does not add days for zero-duration rinse and drain holds", () => {
    const r = simulate({
      ...small,
      oreTonnes: 40000,
      rinseDays: 0,
      drainDays: 0,
    });
    const rinse = r.events.find((e) => e.state === "RINSING")!,
      drain = r.events.find((e) => e.state === "DRAINING")!;
    expect(drain.day).toBe(rinse.day);
    expect(r.completionDay).toBe(rinse.day);
  });
  it("counts exactly 330 operating days in a calendar year", () =>
    expect(
      Array.from({ length: 365 }, (_, i) => isOperatingDay(i + 1, 330)).filter(
        Boolean,
      ),
    ).toHaveLength(330));
  it("starts leaching before final stacking and retains lower lifts", () => {
    const r = simulate(small);
    expect(r.status).toBe("complete");
    expect(r.events.find((e) => e.state === "LEACHING")!.day).toBeLessThan(
      r.stackingCompleteDay!,
    );
    const upper = r.events.find((e) => e.lift === 2 && e.state === "STACKING")!;
    expect(upper).toBeDefined();
    const lower = r.segments.find(
      (s) => s.cellId === upper.cellId && s.lift === 1,
    )!;
    expect(snapshotAt(r, upper.day).segments[lower.index].tonnes).toBeCloseTo(
      lower.capacity,
    );
    expect(r.completionDay!).toBeGreaterThan(r.stackingCompleteDay!);
  });
  it("blocks overstacking without engineering clearance", () => {
    const r = simulate({ ...small, geotech: false });
    expect(r.status).toBe("stalled");
    expect(r.events.some((e) => e.lift > 1 && e.state === "STACKING")).toBe(
      false,
    );
  });
  it("never advances leaching at zero pumping capacity, including apex wedges", () => {
    const p = {
      ...small,
      length: 50,
      width: 50,
      slope: 3,
      maxLifts: 1,
      irrigationCapacity: 0,
    };
    const r = simulate({
      ...p,
      oreTonnes: envelopeVolume(50, 50, 10, 3) * p.density,
    });
    expect(r.status).toBe("stalled");
    expect(
      snapshotAt(r, r.frames.length - 1).segments.every(
        (s) => s.leachDays === 0,
      ),
    ).toBe(true);
  });
  it("does not exceed approved heights", () => {
    const r = simulate({ ...small, approvedHeight: 10 });
    expect(r.frames.every((f) => f.metrics.height <= 10)).toBe(true);
  });
  it("reports insufficient capacity and terminates a blocked schedule", () => {
    const r = simulate({ ...small, maxLifts: 1 });
    expect(r.status).toBe("stalled");
    expect(r.warnings.some((w) => w.code === "capacity")).toBe(true);
    expect(r.frames.length).toBeLessThan(1000);
  });
  for (const scenario of [
    "permanent",
    "dry",
    "new-tsf",
    "existing-tsf",
  ] as Scenario[])
    it(`conserves every tonne in ${scenario}`, () => {
      const r = simulate({ ...small, scenario });
      expect(r.status).toBe("complete");
      for (const frame of r.frames)
        expect(Math.abs(frame.metrics.massError)).toBeLessThan(1e-5);
      if (scenario !== "permanent") {
        expect(r.frames.at(-1)!.metrics.disposal).toBeCloseTo(small.oreTonnes);
        expect(r.frames.at(-1)!.metrics.stored).toBeCloseTo(0);
      }
    });
  it("reuses on-off bays only after removal and preparation", () => {
    const r = simulate({
      ...small,
      scenario: "dry",
      oreTonnes: 400000,
      prepDays: 4,
    });
    const second = r.events.find(
      (e) => e.cycle === 2 && e.state === "STACKING",
    )!;
    expect(second).toBeDefined();
    const emptied = r.events.find(
      (e) =>
        e.cellId === second.cellId &&
        e.cycle === 1 &&
        e.state === "PAD_PREPARATION",
    )!;
    expect(second.day - emptied.day).toBeGreaterThanOrEqual(4);
  });
  it("stops at disposal capacity and accounts for retained ore", () => {
    const r = simulate({
      ...small,
      scenario: "existing-tsf",
      disposalVolume: 10000,
      approvedDisposalTonnes: 10000,
    });
    expect(r.status).toBe("stalled");
    expect(r.frames.at(-1)!.metrics.removed).toBeCloseTo(10000);
    expect(r.frames.at(-1)!.metrics.massError).toBeCloseTo(0);
  });
  it("does not stack on shutdown days or blocked cells", () => {
    const r = simulate({
      ...small,
      shutdownStart: 1,
      shutdownEnd: 4,
      blockedCells: ["A1"],
    });
    expect(r.frames[4].metrics.stacked).toBe(0);
    expect(r.events.some((e) => e.cellId === "A1")).toBe(false);
  });
  it("enforces irrigation limits without counting waiting as leach days", () => {
    const r = simulate({ ...small, irrigationCapacity: 25 });
    expect(
      Math.max(...r.frames.map((f) => f.metrics.flow)),
    ).toBeLessThanOrEqual(25);
    const blocked = simulate({ ...small, irrigationCapacity: 10 });
    expect(blocked.status).toBe("stalled");
    expect(blocked.frames.at(-1)!.metrics.solution).toBe(0);
  });
  it("replays exactly after reverse scrubbing and differing playback jumps", () => {
    const r = simulate(small);
    const expected = snapshotAt(r, 25);
    snapshotAt(r, r.frames.length - 1);
    snapshotAt(r, 0);
    expect(snapshotAt(r, 25)).toEqual(expected);
    for (const speed of [1, 5, 20, 100])
      for (let d = 0; d < r.frames.length; d += speed) snapshotAt(r, d);
    expect(snapshotAt(r, r.frames.length - 1).metrics).toEqual(
      simulate(small).frames.at(-1)!.metrics,
    );
  });
  it("regenerates results when inputs change", () => {
    const a = simulate(small),
      b = simulate({ ...small, oreTonnes: 100000 });
    expect(a.frames.at(-1)!.metrics.stacked).toBe(220000);
    expect(b.frames.at(-1)!.metrics.stacked).toBe(100000);
  });
});
describe("validation and assumptions", () => {
  it("uses consistent common assumptions across comparison scenarios", () => {
    for (const scenario of [
      "permanent",
      "dry",
      "new-tsf",
      "existing-tsf",
    ] as Scenario[]) {
      const r = simulate({ ...small, scenario });
      for (const key of [
        "oreTonnes",
        "density",
        "stackingRate",
        "operatingDays",
        "leachDays",
      ] as const)
        expect(r.inputs[key]).toBe(small[key]);
    }
  });
  it("runs real independent leach-duration sensitivities", () => {
    const rows = runSensitivity(
      { ...small, oreTonnes: 40000, leachDays: 30 },
      "leachDays",
    );
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.status === "complete")).toBe(true);
    expect(rows[4].completionDay!).toBeGreaterThan(rows[0].completionDay!);
    expect(rows[4].stackedMt).toBe(rows[0].stackedMt);
  });
  it("flags missing TSF requirements", () =>
    expect(
      engineeringWarnings(
        { ...defaults, scenario: "existing-tsf" },
        100000,
      ).some((w) => w.title === "TSF INTEGRATION NOT VALIDATED"),
    ).toBe(true));
  it("rejects invalid physical inputs", () =>
    expect(inputsSchema.safeParse({ ...defaults, density: 0 }).success).toBe(
      false,
    ));
  it("does not invent cost or recovery data", () => {
    expect(indicativeCosts(defaults).total).toBeNull();
    expect(defaults.goldGrade).toBeNull();
    expect(defaults.recovery).toBeNull();
  });
});
