"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useProject } from "@/store/use-project";
import { heapDesign } from "@/engine/design";
import { number } from "@/utils/format";
import { CadExport } from "./cad-export";
const DesignScene = dynamic(() => import("@/components/three-d/design-scene"), {
  ssr: false,
});
export function DesignPanel() {
  const inputs = useProject((s) => s.inputs);
  const design = useMemo(() => heapDesign(inputs), [inputs]);
  const [webgl, setWebgl] = useState(false);
  useEffect(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    setWebgl(!!gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  }, []);
  const p = design.inputs;
  return (
    <section className="design-panel" aria-label="Live pile design">
      <header>
        <div>
          <span className="eyebrow">LIVE GEOMETRY / METRES</span>
          <h2>
            {inputs.scenario === "permanent" &&
            inputs.stackingMode === "continuous"
              ? "Single pile · no lifts"
              : "Full design envelope"}
          </h2>
        </div>
        <CadExport />
      </header>
      <div className="design-layout">
        <div
          className="design-preview"
          data-testid="design-preview"
          data-length={p.length}
          data-width={p.width}
          data-height={design.height}
          data-volume={design.volume}
          data-slope={p.slope}
          data-repose={p.reposeAngle}
          data-grade={p.drainageGrade}
          data-drain={p.drainageDirection}
        >
          {webgl ? (
            <DesignScene design={design} />
          ) : (
            <svg
              role="img"
              aria-label="Pile elevation"
              viewBox={`-20 -20 ${p.length + 40} ${Math.max(design.height, 30) + 40}`}
            >
              <polygon
                points={`0,${design.height} ${p.length},${design.height} ${p.length - p.slope * design.height},0 ${p.slope * design.height},0`}
                fill="#b0ad70"
                stroke="#e1ddb0"
              />
            </svg>
          )}
          <span className="design-caption">
            {webgl ? "Drag to orbit · Scroll to zoom" : "Elevation view"} ·
            Full-size design
          </span>
        </div>
        <dl className="data-rows design-measurements">
          {(
            [
              ["Base length", `${number(p.length, 2)} m`],
              ["Base width", `${number(p.width, 2)} m`],
              ["Pile height", `${number(design.height, 2)} m`],
              [
                "Top (L × W)",
                `${number(design.topLength, 2)} × ${number(design.topWidth, 2)} m`,
              ],
              ["Side slope", `${number(p.slope, 2)}H : 1V`],
              [
                "Face angle",
                `${number((Math.atan(1 / p.slope) * 180) / Math.PI, 1)}°`,
              ],
              ["Ore angle of repose", `${number(p.reposeAngle, 1)}°`],
              [
                "Drainage grade",
                `${number(p.drainageGrade, 2)}% to ${p.drainageDirection}`,
              ],
              [
                "Pad elevation drop",
                `${number((p.drainageGrade * (p.drainageDirection === "east" || p.drainageDirection === "west" ? p.length : p.width)) / 100, 2)} m`,
              ],
              ["Footprint", `${number(design.area / 10000, 3)} ha`],
              ["Envelope volume", `${number(design.volume)} m³`],
              ["Envelope capacity", `${number(design.capacity)} t`],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="design-note">
        Valid edits update the shape and measurements automatically. This is the
        full geometric envelope; the operating timeline below shows actual ore
        placement. The angle of repose limits the outer face; the graded pad
        falls toward the collection edge. Footprint excludes infrastructure and
        blocked-cell deductions.
      </p>
    </section>
  );
}
