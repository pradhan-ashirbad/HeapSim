"use client";
import { useProject } from "@/store/use-project";
import {
  stateColors,
  stateLabel,
  type SimulationResults,
  type SimulationSnapshot,
} from "@/types/model";
import { boundsAt, filledHeight } from "@/engine/geometry";
import { number } from "@/utils/format";
export function Grid2D({
  result,
  snapshot,
}: {
  result: SimulationResults;
  snapshot: SimulationSnapshot;
}) {
  const selected = useProject((s) => s.selectedCell),
    lift = useProject((s) => s.selectedLift),
    select = useProject((s) => s.select);
  const { inputs: p } = result;
  return (
    <div className="grid-2d">
      <div className="view-caption">
        PLAN VIEW <span>Shared coordinates · metres</span>
      </div>
      <svg
        aria-label="Interactive 2D operating grid"
        role="group"
        viewBox={`-40 -35 ${p.length + 75} ${p.width + 70}`}
      >
        {result.cells
          .filter((c) => c.row === 0)
          .map((c) => (
            <text
              key={c.id}
              x={c.x + c.length / 2}
              y={-12}
              textAnchor="middle"
              className="grid-axis"
            >
              {c.column + 1}
            </text>
          ))}
        {result.cells
          .filter((c) => c.column === 0)
          .map((c) => (
            <text
              key={c.id}
              x={-20}
              y={c.y + c.width / 2}
              textAnchor="middle"
              className="grid-axis"
            >
              {c.id.replace(/\d/g, "")}
            </text>
          ))}
        {result.cells.map((cell) => {
          const defs = result.segments.filter((s) => s.cellId === cell.id);
          const def = lift
            ? defs.find((s) => s.lift === lift)
            : ([...defs]
                .reverse()
                .find((s) => snapshot.segments[s.index].tonnes > 0) ?? defs[0]);
          const state = def ? snapshot.segments[def.index] : null;
          const status = state?.state ?? "EMPTY";
          const z =
            def && state && state.tonnes > 0
              ? filledHeight(p, cell, def, state.tonnes)
              : (def?.z0 ?? ((lift ?? 1) - 1) * p.liftHeight);
          const b = boundsAt(p, cell, z);
          return (
            <g
              key={cell.id}
              role="button"
              tabIndex={0}
              aria-label={`Cell ${cell.id}, lift ${lift ?? def?.lift ?? 1}, ${stateLabel(status)}`}
              data-testid={`cell-${cell.id}`}
              data-selected={selected === cell.id}
              data-tonnes={state?.tonnes ?? 0}
              onClick={() => select(cell.id, lift)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  select(cell.id, lift);
                }
              }}
            >
              <rect
                x={cell.x}
                y={cell.y}
                width={cell.length}
                height={cell.width}
                fill="#1b2925"
                stroke="#3c4d44"
                strokeWidth={0.7}
              />
              <rect
                x={b.x0}
                y={b.y0}
                width={Math.max(0, b.x1 - b.x0)}
                height={Math.max(0, b.y1 - b.y0)}
                fill={stateColors[status]}
                fillOpacity={state?.tonnes ? 0.72 : 0.11}
                stroke={selected === cell.id ? "#e6edb3" : "#68796b"}
                strokeWidth={selected === cell.id ? 2 : 0.6}
              />
              {cell.length > 15 && (
                <>
                  <text
                    x={cell.x + cell.length / 2}
                    y={cell.y + cell.width / 2 - 3}
                    textAnchor="middle"
                    className="cell-id"
                  >
                    {cell.id}
                  </text>
                  <text
                    x={cell.x + cell.length / 2}
                    y={cell.y + cell.width / 2 + 9}
                    textAnchor="middle"
                    className="cell-state"
                  >
                    {status === "READY_FOR_OVERSTACKING"
                      ? "READY"
                      : status.replace("IRRIGATION_", "").slice(0, 8)}
                  </text>
                </>
              )}
              <title>
                {cell.id} · Lift {def?.lift ?? "—"} ·{" "}
                {number(state?.tonnes ?? 0)} t · {stateLabel(status)}
              </title>
            </g>
          );
        })}
        <text
          x={p.length / 2}
          y={p.width + 25}
          textAnchor="middle"
          className="grid-axis"
        >
          {number(p.length, 1)} m EAST →
        </text>
        <text
          transform={`translate(-30 ${p.width / 2}) rotate(-90)`}
          textAnchor="middle"
          className="grid-axis"
        >
          {number(p.width, 1)} m SOUTH ↓
        </text>
      </svg>
    </div>
  );
}
