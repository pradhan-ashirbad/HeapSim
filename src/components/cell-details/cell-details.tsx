"use client";
import {
  Crosshair,
  Layers3,
  MapPin,
  Ban,
  CircleCheck,
  ChevronRight,
} from "lucide-react";
import { useProject } from "@/store/use-project";
import {
  type SimulationResults,
  type SimulationSnapshot,
  stateColors,
  stateLabel,
} from "@/types/model";
import { areaAt, filledHeight, irrigatedArea } from "@/engine/geometry";
import { number } from "@/utils/format";
import { Button } from "@/components/ui/button";
export function CellDetails({
  result,
  snapshot,
}: {
  result: SimulationResults;
  snapshot: SimulationSnapshot;
}) {
  const ui = useProject(),
    cell = result.cells.find((c) => c.id === ui.selectedCell);
  if (!cell)
    return (
      <aside className="cell-details">
        <div className="panel-heading">
          <span>
            <Crosshair size={15} /> Cell inspector
          </span>
        </div>
        <div className="empty-inspector">
          <Layers3 size={32} />
          <h3>Explore the heap</h3>
          <p>
            Select a physical cell in either view to inspect its lift inventory
            and operating history.
          </p>
        </div>
      </aside>
    );
  const defs = result.segments.filter((s) => s.cellId === cell.id),
    allStates = defs.map((d) => snapshot.segments[d.index]);
  const def =
    ui.selectedLift !== null
      ? defs.find((d) => d.lift === ui.selectedLift)
      : ([...defs]
          .reverse()
          .find((d) => snapshot.segments[d.index].tonnes > 0) ?? defs[0]);
  const state = def ? snapshot.segments[def.index] : null,
    p = result.inputs;
  const height = def && state ? filledHeight(p, cell, def, state.tonnes) : 0;
  const actualArea = def ? areaAt(p, cell, height) : 0;
  const zoneArea = def && state ? irrigatedArea(p, cell, def, state.tonnes) : 0;
  const events = result.events.filter(
    (e) =>
      e.cellId === cell.id &&
      e.day <= snapshot.day &&
      (!ui.selectedLift || e.lift === ui.selectedLift),
  );
  const block = () =>
    ui.setInputs({
      ...ui.inputs,
      blockedCells: ui.inputs.blockedCells.includes(cell.id)
        ? ui.inputs.blockedCells.filter((id) => id !== cell.id)
        : [...ui.inputs.blockedCells, cell.id],
    });
  const rows = (data: [string, string][]) => (
    <dl className="data-rows">
      {data.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
  return (
    <aside className="cell-details">
      <div className="panel-heading">
        <span>
          <Crosshair size={15} /> Cell inspector
        </span>
        <span className="tiny-badge">LIVE</span>
      </div>
      <div className="inspector-scroll">
        <div className="cell-identity">
          <div className="cell-avatar">{cell.id}</div>
          <div>
            <span className="eyebrow">SELECTED CELL</span>
            <h2>
              Cell {cell.id}{" "}
              <span>/ L{ui.selectedLift ?? def?.lift ?? "—"}</span>
            </h2>
            <small>
              <MapPin size={11} /> {number(cell.x)}, {number(cell.y)} m · Base 0
              m
            </small>
          </div>
        </div>
        {!def && (
          <p className="comparison-note">
            This lift has no usable volume at this cell within the slope
            envelope.
          </p>
        )}
        <div
          className="state-pill"
          style={{ color: stateColors[state?.state ?? "EMPTY"] }}
        >
          <span style={{ background: "currentColor" }} />
          {stateLabel(state?.state ?? "EMPTY")}
          <small>Cycle {state?.cycle ?? 1}</small>
        </div>
        <div className="inspector-section">
          <div className="section-label">
            ORE INVENTORY <span>{p.oreType}</span>
          </div>
          <div className="inventory-number" data-testid="selected-tonnes">
            {number(state?.tonnes ?? 0)} <small>t</small>
          </div>
          <div className="meter">
            <i
              style={{
                width: `${def && state ? (state.tonnes / def.capacity) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="meter-label">
            <span>
              {def && state
                ? number((state.tonnes / def.capacity) * 100, 1)
                : 0}
              % capacity used
            </span>
            <span>{number(def?.capacity ?? 0)} t</span>
          </div>
        </div>
        <div className="inspector-section">
          <div className="section-label">PHYSICAL GEOMETRY</div>
          {rows([
            ["Grid position", `Row ${cell.row + 1} · Col ${cell.column + 1}`],
            [
              "Cell dimensions",
              `${number(cell.length, 1)} × ${number(cell.width, 1)} m`,
            ],
            ["Surface usable area", `${number(actualArea, 1)} m²`],
            [
              "Constructed elevation",
              `${number(def?.z0 ?? 0, 1)} – ${number(height, 2)} m`,
            ],
            [
              "Lift thickness placed",
              `${number(Math.max(0, height - (def?.z0 ?? 0)), 2)} m`,
            ],
            [
              "Geometric ore volume",
              `${number((state?.tonnes ?? 0) / p.density, 1)} m³`,
            ],
            ["Bulk density", `${p.density} t/m³`],
            [
              "Remaining capacity",
              `${number((def?.capacity ?? 0) - (state?.tonnes ?? 0))} t`,
            ],
          ])}
        </div>
        <div className="inspector-section">
          <div className="section-label">
            VERTICAL LIFT STACK <Layers3 size={13} />
          </div>
          <div className="mini-stack">
            {[...defs].reverse().map((d) => {
              const s = snapshot.segments[d.index];
              return (
                <button
                  key={d.index}
                  className={def?.index === d.index ? "chosen" : ""}
                  onClick={() => ui.select(cell.id, d.lift)}
                  style={{ borderLeftColor: stateColors[s.state] }}
                >
                  <span>
                    L{d.lift}{" "}
                    <small>
                      {d.z0}–{d.z1} m
                    </small>
                  </span>
                  <span>
                    {stateLabel(s.state)}
                    <ChevronRight size={11} />
                  </span>
                </button>
              );
            })}
          </div>
          <small className="muted">
            {number(allStates.reduce((a, s) => a + s.tonnes, 0))} t retained in
            this column
          </small>
        </div>
        <div className="inspector-section">
          <div className="section-label">OPERATIONS & SOLUTION</div>
          {rows([
            [
              "Stacking start / end",
              `${state?.stackStart ?? "—"} / ${state?.stackEnd ?? "—"}`,
            ],
            [
              "Leach start",
              state?.leachStart ? `Day ${state.leachStart}` : "Not started",
            ],
            [
              "Leach progress",
              `${state?.leachDays ?? 0} / ${p.leachDays} days`,
            ],
            [
              "Remaining leach",
              `${Math.max(0, p.leachDays - (state?.leachDays ?? 0))} days`,
            ],
            [
              "Drain completion",
              state?.drainEnd ? `Day ${state.drainEnd}` : "Pending",
            ],
            [
              "Overstacking",
              state?.state === "READY_FOR_OVERSTACKING"
                ? "Eligible"
                : "Not released",
            ],
            ["Application rate", `${p.irrigationRate} L/m²/h`],
            ["Zone projected area", `${number(zoneArea, 1)} m²`],
            [
              "Zone flow demand",
              state?.state === "LEACHING"
                ? `${number((zoneArea * p.irrigationRate) / 1000, 1)} m³/h`
                : "0 m³/h",
            ],
            ["Applied solution", `${number(state?.solution ?? 0)} m³`],
          ])}
        </div>
        <div className="inspector-section">
          <div className="section-label">
            CELL EVENT HISTORY <span>{events.length} events</span>
          </div>
          <div className="cell-events">
            {events.length ? (
              [...events].reverse().map((e, i) => (
                <div key={i}>
                  <i style={{ background: stateColors[e.state] }} />
                  <span>
                    <b>
                      Day {e.day} · L{e.lift} · Batch {e.cycle}
                    </b>
                    {e.message}
                  </span>
                </div>
              ))
            ) : (
              <p>No operations recorded at this date.</p>
            )}
          </div>
        </div>
        <Button className="full-width" onClick={() => ui.focus("focus")}>
          <Crosshair size={14} /> Focus selected cell
        </Button>
        <Button className="full-width block-button" onClick={block}>
          {p.blockedCells.includes(cell.id) ? (
            <CircleCheck size={14} />
          ) : (
            <Ban size={14} />
          )}
          {p.blockedCells.includes(cell.id)
            ? "Release cell"
            : "Block cell & recalculate"}
        </Button>
      </div>
    </aside>
  );
}
