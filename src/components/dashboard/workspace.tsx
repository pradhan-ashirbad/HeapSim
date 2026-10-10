"use client";
import dynamic from "next/dynamic";
import { Component, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Box,
  Grid2X2,
  Columns2,
  Layers3,
  Map,
  ScanLine,
  ArrowUpRight,
  RotateCcw,
  Focus,
  Ruler,
  Eye,
  Tags,
  Maximize,
  AlertTriangle,
  ChevronDown,
  Mountain,
  Navigation,
} from "lucide-react";
import { useProject, type ViewMode } from "@/store/use-project";
import { Grid2D } from "@/components/simulation-grid/grid-2d";
import {
  stateColors,
  type OperatingState,
  type SimulationResults,
  type SimulationSnapshot,
} from "@/types/model";
import { landComponents, totalLand } from "@/engine/analysis";
import { number } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { CadExport } from "./cad-export";
import { DrainagePanel } from "./drainage-panel";
export const LazyHeapScene = dynamic(
  () => import("@/components/three-d/heap-scene"),
  {
    ssr: false,
    loading: () => (
      <div className="loading-scene">
        <Layers3 size={28} />
        <span>Preparing physical geometry…</span>
      </div>
    ),
  },
);
class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export function SceneOrFallback(props: {
  result: SimulationResults;
  snapshot: SimulationSnapshot;
  comparison?: boolean;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl2");
      setSupported(!!gl);
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      setSupported(false);
    }
  }, []);
  const fallback = (
    <div className="fallback-view">
      <div className="webgl-notice">
        WebGL is unavailable. The same simulation is available in 2D.
      </div>
      <Grid2D {...props} />
    </div>
  );
  if (supported === null)
    return <div className="loading-scene">Checking 3D rendering…</div>;
  return supported ? (
    <SceneBoundary fallback={fallback}>
      <LazyHeapScene {...props} />
    </SceneBoundary>
  ) : (
    fallback
  );
}
const legendStates: OperatingState[] = [
  "AVAILABLE",
  "STACKING",
  "IRRIGATION_SETUP",
  "LEACHING",
  "RINSING",
  "DRAINING",
  "SPENT",
  "READY_FOR_OVERSTACKING",
  "REMOVING",
  "BLOCKED",
];
const shortLabels = [
  "Available",
  "Stacking",
  "Setup",
  "Leaching",
  "Rinsing",
  "Draining",
  "Spent",
  "Ready",
  "Removal",
  "Blocked",
];
const modes: { id: ViewMode; name: string; icon: typeof Box }[] = [
  { id: "3d", name: "3D Grid", icon: Box },
  { id: "2d", name: "2D Plan", icon: Grid2X2 },
  { id: "split", name: "Split view", icon: Columns2 },
  { id: "elevation", name: "Elevation", icon: Mountain },
  { id: "section", name: "Section", icon: ScanLine },
  { id: "lift", name: "Lift inspection", icon: Layers3 },
  { id: "land", name: "Land use", icon: Map },
];
function LandView({
  result,
  snapshot,
}: {
  result: SimulationResults;
  snapshot: SimulationSnapshot;
}) {
  const rows = landComponents(result.inputs),
    total = totalLand(result.inputs);
  return (
    <div className="land-view">
      <div>
        <span className="eyebrow">ULTIMATE NEW LAND REQUIREMENT</span>
        <h2>
          {number(total / 10000, 2)} <small>hectares</small>
        </h2>
        <p>
          {number(total)} m² · {number(total / 4046.8564224, 2)} acres
        </p>
        <div className="land-bar">
          {rows.map((r, i) => (
            <span
              title={`${r.name}: ${number(r.area)} m²`}
              key={r.name}
              style={{
                width: `${(r.area / total) * 100}%`,
                background: `hsl(${80 + i * 12} 22% ${65 - i * 4}%)`,
              }}
            />
          ))}
        </div>
        <p className="muted">
          Allowances are additional, non-overlapping areas. Active irrigation (
          {number(snapshot.metrics.activeArea)} m²) is part of the pad and is
          not added again.
        </p>
      </div>
      <dl>
        {rows.map((r, i) => (
          <div key={r.name}>
            <dt>
              <i
                style={{ background: `hsl(${80 + i * 12} 22% ${65 - i * 4}%)` }}
              />
              {r.name}
            </dt>
            <dd>
              {number(r.area)} <span>m²</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
export function Workspace({
  result,
  snapshot,
}: {
  result: SimulationResults;
  snapshot: SimulationSnapshot;
}) {
  const ui = useProject(),
    [expanded, setExpanded] = useState(false);
  return (
    <section className={`visualization ${expanded ? "expanded-viewport" : ""}`}>
      <div className="workspace-tabs">
        {modes.slice(0, 3).map((m) => (
          <button
            key={m.id}
            className={ui.view === m.id ? "active" : ""}
            onClick={() => ui.set({ view: m.id })}
          >
            <m.icon size={14} />
            {m.name}
          </button>
        ))}
        <select
          aria-label="Additional display modes"
          value={modes.slice(3).some((m) => m.id === ui.view) ? ui.view : ""}
          onChange={(e) => {
            const view = e.target.value as ViewMode;
            ui.set({ view });
            if (view === "elevation" || view === "section") ui.focus("south");
          }}
        >
          <option value="" disabled>
            More views
          </option>
          {modes.slice(3).map((m) => (
            <option value={m.id} key={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <div className="view-spacer" />
        <span className="cell-size-badge">
          {result.inputs.cellLength} × {result.inputs.cellWidth} m GRID
        </span>
        <button
          title="Expand viewport"
          aria-label="Expand viewport"
          onClick={() => setExpanded(!expanded)}
        >
          <Maximize size={14} />
        </button>
      </div>
      <div className="workspace-cad">
        <CadExport viewport />
      </div>
      <DrainagePanel inputs={result.inputs} />
      <div className="scene-toolbar">
        <div>
          <button
            title="Isometric camera"
            className={ui.camera === "iso" ? "active" : ""}
            onClick={() => ui.focus("iso")}
          >
            Isometric
          </button>
          <button onClick={() => ui.focus("top")}>Top</button>
          <select
            aria-label="Elevation camera"
            value={
              !["north", "south", "east", "west"].includes(ui.camera)
                ? ""
                : ui.camera
            }
            onChange={(e) => ui.focus(e.target.value)}
          >
            <option value="" disabled>
              Elevation
            </option>
            {["north", "south", "east", "west"].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </div>
        <div>
          <select
            aria-label="Inspect lift"
            value={ui.selectedLift ?? "all"}
            onChange={(e) =>
              ui.set({
                selectedLift:
                  e.target.value === "all" ? null : Number(e.target.value),
              })
            }
          >
            <option value="all">All lifts</option>
            {Array.from({ length: result.inputs.maxLifts }, (_, i) => (
              <option key={i} value={i + 1}>
                Lift {i + 1}
              </option>
            ))}
          </select>
          <button
            aria-label="Focus cell"
            title="Focus selected cell"
            onClick={() => ui.focus("focus")}
          >
            <Focus size={15} />
          </button>
          <button
            aria-label="Reset camera"
            title="Reset camera"
            onClick={() => ui.focus("iso")}
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>
      <div
        className={`scene-stage ${ui.view === "split" ? "split-stage" : ""}`}
      >
        {ui.view === "land" ? (
          <LandView result={result} snapshot={snapshot} />
        ) : ui.view === "2d" ? (
          <Grid2D result={result} snapshot={snapshot} />
        ) : ui.view === "split" ? (
          <>
            <SceneOrFallback result={result} snapshot={snapshot} />
            <Grid2D result={result} snapshot={snapshot} />
          </>
        ) : (
          <SceneOrFallback result={result} snapshot={snapshot} />
        )}
        {ui.view !== "land" && (
          <>
            <div className="scene-stamp">
              <span>
                <i className="status-dot" />{" "}
                {result.inputs.scenario === "permanent"
                  ? "PERMANENT HEAP"
                  : "REUSABLE LEACH PAD"}
              </span>
              <small>
                {number(result.inputs.length, 1)} ×{" "}
                {number(result.inputs.width, 1)} m · {result.cells.length} cells
                · {result.segments.length} lift segments
              </small>
            </div>
            <div className="scene-help">
              {ui.view === "2d"
                ? "Select a cell to inspect its lift history"
                : "Drag to orbit · Right-drag to pan · Scroll to zoom"}
            </div>
          </>
        )}
      </div>
      <div className="viewport-options">
        {(
          [
            { key: "grid", label: "Grid lines" },
            { key: "labels", label: "Cell labels" },
            { key: "vertical", label: "Lift boundaries" },
            { key: "transparent", label: "Transparent" },
            { key: "exploded", label: "Exploded lifts" },
            { key: "rulers", label: "Rulers" },
          ] as const
        ).map(({ key, label }) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={ui[key]}
              onChange={(e) => ui.set({ [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
      </div>
      <div className="state-legend">
        {legendStates.map((state, i) => (
          <span key={state}>
            <i style={{ background: stateColors[state] }} />
            {shortLabels[i]}
          </span>
        ))}
      </div>
    </section>
  );
}
export function Warnings({ result }: { result: SimulationResults }) {
  const count = result.warnings.filter((w) => w.severity !== "info").length;
  return (
    <details className="validation-panel">
      <summary>
        <AlertTriangle size={15} />
        <b>{count} engineering checks require attention</b>
        <span>
          {result.status === "complete"
            ? "Schedule completed · design approvals separate"
            : "Schedule constrained"}
        </span>
        <ChevronDown size={14} />
      </summary>
      <div className="warning-list">
        <div
          className={`warning ${result.status === "complete" ? "info" : "error"}`}
        >
          <b>Schedule: {result.status}</b>
          <p>{result.reason}</p>
        </div>
        {result.warnings.map((w) => (
          <div key={w.code} className={`warning ${w.severity}`}>
            <b>{w.title}</b>
            <p>{w.detail}</p>
          </div>
        ))}
      </div>
    </details>
  );
}
