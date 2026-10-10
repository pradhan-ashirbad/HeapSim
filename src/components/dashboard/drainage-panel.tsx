"use client";
import { useEffect, useState } from "react";
import { inputsSchema, type ProjectInputs } from "@/types/model";
import { useProject } from "@/store/use-project";
import { degreesToGrade, gradeToDegrees } from "@/engine/geometry";
import { drainageProfile } from "@/engine/drainage";
import { number } from "@/utils/format";

function GeometryNumber({
  label,
  value,
  field,
  angle = false,
}: {
  label: string;
  value: number;
  field: "drainageGrade" | "reposeAngle";
  angle?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState("");
  useEffect(() => {
    setDraft(String(value));
    setError("");
  }, [value]);
  useEffect(() => {
    if (draft === String(value)) {
      setError("");
      return;
    }
    const timer = setTimeout(() => {
      const n = draft.trim() === "" ? NaN : Number(draft);
      // The model allows 0–10% grade. Reject angles outside that range before tan().
      if (angle && (!Number.isFinite(n) || n < 0 || n > gradeToDegrees(10))) {
        setError("Enter a tilt from 0° to 5.710593° (0–10% grade).");
        return;
      }
      const parsed = inputsSchema.safeParse({
        ...useProject.getState().inputs,
        [field]: angle ? degreesToGrade(n) : n,
      });
      if (!parsed.success) {
        setError(parsed.error.issues.map((i) => i.message).join(" "));
        return;
      }
      setError("");
      useProject.getState().setInputs(parsed.data);
    }, 350);
    return () => clearTimeout(timer);
  }, [draft, value, field, angle]);
  return (
    <label className="drainage-input">
      {label}
      <input
        type="number"
        aria-label={label}
        step="any"
        value={draft}
        aria-invalid={!!error}
        onChange={(e) => setDraft(e.target.value)}
      />
      {error && <small role="alert">{error}</small>}
    </label>
  );
}

export function DrainagePanel({ inputs }: { inputs: ProjectInputs }) {
  const raw = useProject((s) => s.inputs);
  const p = drainageProfile(inputs);
  const sx = 500 / p.run,
    sy = Math.min(100 / Math.max(p.highCrest, p.rise, 1), sx * 4);
  const point = ([x, z]: number[]) => `${70 + x * sx},${145 - z * sy}`;
  const exaggeration = sy / sx;
  return (
    <details className="drainage-panel" open>
      <summary>
        Drainage tilt & heap elevations{" "}
        <span>Full design · low ground datum 0.00 m</span>
      </summary>
      <div className="drainage-controls">
        <GeometryNumber
          label="Drainage tilt (degrees)"
          value={Number(gradeToDegrees(raw.drainageGrade).toFixed(6))}
          field="drainageGrade"
          angle
        />
        <label className="drainage-input">
          Drainage direction
          <select
            aria-label="Drainage direction"
            value={raw.drainageDirection}
            onChange={(e) =>
              useProject.getState().setInputs({
                ...raw,
                drainageDirection: e.target
                  .value as ProjectInputs["drainageDirection"],
              })
            }
          >
            {["south", "north", "east", "west"].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <GeometryNumber
          label="Repose limit (degrees)"
          value={raw.reposeAngle}
          field="reposeAngle"
        />
        <span>
          {number(p.angle, 3)}° = {number(raw.drainageGrade, 3)}% grade
        </span>
      </div>
      <div
        className="drainage-profile"
        data-testid="drainage-profile"
        data-rise={p.rise}
        data-low-crest={p.lowCrest}
        data-high-crest={p.highCrest}
      >
        <svg
          viewBox="0 0 640 190"
          role="img"
          aria-label={`Drainage elevation profile: ${number(p.run, 2)} metres, ground rises ${number(p.rise, 2)} metres toward ${p.highDirection}`}
        >
          <line
            x1="70"
            y1="145"
            x2="570"
            y2="145"
            stroke="#6d806a"
            strokeDasharray="5 4"
          />
          <polygon
            points={p.outline.map(point).join(" ")}
            fill="#a49c68"
            fillOpacity="0.5"
            stroke="#d1dca9"
          />
          <line
            x1="70"
            y1="145"
            x2="570"
            y2={145 - p.rise * sy}
            stroke="#77cfdd"
            strokeWidth="3"
          />
          <line
            x1="570"
            y1="145"
            x2="570"
            y2={145 - p.rise * sy}
            stroke="#f1c873"
            strokeWidth="2"
          />
          <text x="70" y="166">
            LOW · {p.lowDirection.toUpperCase()}
          </text>
          <text x="570" y="166" textAnchor="end">
            HIGH · {p.highDirection.toUpperCase()}
          </text>
          <text x="320" y="185" textAnchor="middle">
            ← Drainage · {number(p.run, 2)} m run
          </text>
          <text x="320" y="20" textAnchor="middle">
            Planned heap profile · vertical scale ×{number(exaggeration, 1)}
          </text>
          <text x="70" y="40">
            Low crest {number(p.lowCrest, 2)} m
          </text>
          <text x="570" y="40" textAnchor="end">
            High crest {number(p.highCrest, 2)} m
          </text>
        </svg>
        <dl>
          <div>
            <dt>Ground: low → high</dt>
            <dd>0.00 → {number(p.rise, 2)} m</dd>
          </div>
          <div>
            <dt>Other side raised by</dt>
            <dd>{number(p.rise, 2)} m</dd>
          </div>
          <div>
            <dt>Crest: low → high</dt>
            <dd>
              {number(p.lowCrest, 2)} → {number(p.highCrest, 2)} m
            </dd>
          </div>
          <div>
            <dt>Ore thickness at crest</dt>
            <dd>{number(p.height, 2)} m</dd>
          </div>
          <div>
            <dt>Outer face: low / high side</dt>
            <dd>
              {number(p.faceAngles.low, 2)}° / {number(p.faceAngles.high, 2)}°
            </dd>
          </div>
        </dl>
      </div>
      <p>
        Rise = run × tan(tilt). Crest elevations include side-slope setbacks;
        ore thickness is measured vertically above local ground. Outer faces
        stay within the repose limit. CAD includes this profile at true scale
        and the graded 3D cells.
      </p>
    </details>
  );
}
