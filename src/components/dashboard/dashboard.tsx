"use client";
import { useEffect, useMemo } from "react";
import {
  Layers3,
  ArrowUpRight,
  Mountain,
  Droplets,
  CircleDot,
  Activity,
  ShieldCheck,
} from "lucide-react";
import { Header } from "./header";
import { Parameters } from "@/components/inputs/parameters";
import { Workspace, Warnings } from "./workspace";
import { CellDetails } from "@/components/cell-details/cell-details";
import { Timeline } from "@/components/timeline/timeline";
import { Analytics } from "@/components/charts/analytics";
import { useProject } from "@/store/use-project";
import { useSimulation } from "@/store/use-simulation";
import { snapshotAt } from "@/engine/simulation";
import { compact, number } from "@/utils/format";
export function Dashboard() {
  const inputs = useProject((s) => s.inputs),
    day = useProject((s) => s.day),
    set = useProject((s) => s.set);
  const { result, busy, error } = useSimulation(inputs);
  const snapshot = useMemo(
    () => (result ? snapshotAt(result, day) : null),
    [result, day],
  );
  useEffect(() => {
    if (result && day >= result.frames.length)
      set({ day: result.frames.length - 1, playing: false });
  }, [result, day, set]);
  return (
    <div className="application">
      <Header result={result} />
      <div className="app-body">
        <Parameters />
        <main className="main-workspace">
          <div className="workspace-heading">
            <div>
              <span className="eyebrow">OPERATIONS / HEAP LEACH PLANNING</span>
              <h1>
                From ore to operation<span>.</span>
              </h1>
              <p>A physical model. Every cell, every lift, every tonne.</p>
            </div>
            <span className="planning-badge">
              <CircleDot size={12} /> PLANNING MODEL
            </span>
          </div>
          {error ? (
            <div className="error-panel" role="alert">
              <h2>Model could not be calculated</h2>
              <p>{error}</p>
              <p>Review the grid dimensions and parameter limits.</p>
            </div>
          ) : busy || !result || !snapshot ? (
            <div className="model-loading">
              <Layers3 size={34} />
              <h2>Calculating the operating plan</h2>
              <p>
                Clipping the slope envelope and scheduling daily material flow…
              </p>
            </div>
          ) : (
            <>
              <div className="kpi-grid">
                <div className="kpi">
                  <span>
                    ORE STACKED <Mountain size={15} />
                  </span>
                  <strong>
                    {compact(snapshot.metrics.stacked)} <small>t</small>
                  </strong>
                  <div>
                    <span className="positive">
                      {number(
                        (snapshot.metrics.stacked / inputs.oreTonnes) * 100,
                        1,
                      )}
                      % of plan
                    </span>
                    <span>{compact(inputs.oreTonnes)} t target</span>
                  </div>
                  <div className="kpi-progress">
                    <i
                      style={{
                        width: `${(snapshot.metrics.stacked / inputs.oreTonnes) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="kpi">
                  <span>
                    ACTIVE LEACH INVENTORY <Droplets size={15} />
                  </span>
                  <strong>
                    {compact(snapshot.metrics.active)} <small>t</small>
                  </strong>
                  <div>
                    <span className="positive">
                      {snapshot.metrics.activeCells} irrigated zones
                    </span>
                    <span>{number(snapshot.metrics.flow, 1)} m³/h</span>
                  </div>
                  <div
                    className="kpi-spark"
                    title="Daily irrigation demand, last seven days"
                  >
                    {Array.from(
                      { length: 7 },
                      (_, i) =>
                        result.frames[Math.max(0, snapshot.day - 6 + i)].metrics
                          .flow,
                    ).map((flow, i) => (
                      <i
                        key={i}
                        style={{
                          height: `${Math.min(100, (flow / Math.max(1, inputs.irrigationCapacity)) * 100)}%`,
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="kpi">
                  <span>
                    CONSTRUCTED HEIGHT <Layers3 size={15} />
                  </span>
                  <strong>
                    {number(snapshot.metrics.height, 1)} <small>m</small>
                  </strong>
                  <div>
                    <span>
                      {Math.ceil(snapshot.metrics.height / inputs.liftHeight)}{" "}
                      constructed lifts
                    </span>
                    <span>{inputs.maxHeight} m limit</span>
                  </div>
                  <div className="lift-bars">
                    {Array.from({ length: inputs.maxLifts }, (_, i) => (
                      <i
                        key={i}
                        className={
                          snapshot.metrics.height > i * inputs.liftHeight
                            ? "filled"
                            : ""
                        }
                      />
                    ))}
                  </div>
                </div>
                <div className="kpi">
                  <span>
                    MATERIAL ACCOUNTED <ShieldCheck size={15} />
                  </span>
                  <strong>
                    {compact(snapshot.metrics.accounted)} <small>t</small>
                  </strong>
                  <div>
                    <span className="positive">
                      Δ {number(snapshot.metrics.massError, 5)} t
                    </span>
                    <span>Mass conserved</span>
                  </div>
                  <div className="kpi-note">Pad + disposal + unstacked ore</div>
                </div>
              </div>
              <Workspace result={result} snapshot={snapshot} />
              <Timeline result={result} snapshot={snapshot} />
              <Warnings result={result} />
              <Analytics result={result} day={snapshot.day} />
              <footer className="workspace-footer">
                <span>
                  HEAPSIM 3D <b>/</b> Deterministic engineering model
                </span>
                <span>
                  {result.status === "complete"
                    ? `Operations complete at day ${result.completionDay}`
                    : `Constrained schedule · ${result.frames.length - 1} simulated days`}
                </span>
              </footer>
            </>
          )}
        </main>
        {result && snapshot && (
          <CellDetails result={result} snapshot={snapshot} />
        )}
      </div>
    </div>
  );
}
