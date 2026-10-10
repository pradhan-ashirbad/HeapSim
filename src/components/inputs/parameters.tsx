"use client";
import { useEffect, useState } from "react";
import { ChevronDown, SlidersHorizontal, RotateCcw, Info } from "lucide-react";
import { defaults, inputsSchema, type ProjectInputs } from "@/types/model";
import { useProject } from "@/store/use-project";
import { Button } from "@/components/ui/button";
import { resolveInputs } from "@/engine/geometry";
type Field = {
  key: keyof ProjectInputs;
  label: string;
  unit?: string;
  options?: [string, string][];
  hint?: string;
};
type Group = { title: string; number: string; fields: Field[] };
const groups: Group[] = [
  {
    title: "Ore & production",
    number: "01",
    fields: [
      { key: "oreTonnes", label: "Total ore", unit: "t" },
      { key: "density", label: "Stacked bulk density", unit: "t/m³" },
      { key: "stackingRate", label: "Stacking capacity", unit: "t/day" },
      { key: "operatingDays", label: "Operating days", unit: "/ year" },
      { key: "oreType", label: "Ore type" },
      { key: "goldGrade", label: "Gold grade", unit: "g/t" },
      { key: "recovery", label: "Recovery", unit: "%" },
    ],
  },
  {
    title: "Heap geometry",
    number: "02",
    fields: [
      {
        key: "stackingMode",
        label: "Permanent heap construction",
        options: [
          ["lifts", "Stack in lifts"],
          ["continuous", "Single pile · no lifts"],
        ],
      },
      {
        key: "sizingMode",
        label: "Design basis",
        options: [
          ["fixed-land", "Fixed land area"],
          ["fixed-ore", "Size for ore quantity"],
        ],
      },
      { key: "length", label: "Pad length", unit: "m" },
      { key: "width", label: "Pad width", unit: "m" },
      { key: "liftHeight", label: "Lift height", unit: "m" },
      { key: "maxHeight", label: "Maximum height", unit: "m" },
      { key: "maxLifts", label: "Planned lifts" },
      { key: "slope", label: "Overall side slope", unit: "H : 1V" },
      {
        key: "reposeAngle",
        label: "Ore angle of repose",
        unit: "°",
        hint: "The outer face cannot be steeper than this measured ore angle. Supply a site-specific value.",
      },
      {
        key: "drainageGrade",
        label: "Drainage grade",
        unit: "%",
        hint: "Tilts the pad liner and ore geometry toward the collection side. This is not a hydraulic flow simulation.",
      },
      {
        key: "drainageDirection",
        label: "Drain toward",
        options: [
          ["south", "South edge"],
          ["north", "North edge"],
          ["east", "East edge"],
          ["west", "West edge"],
        ],
      },
      { key: "aspectRatio", label: "Footprint aspect ratio", unit: "L/W" },
    ],
  },
  {
    title: "Grid & stacking",
    number: "03",
    fields: [
      { key: "cellLength", label: "Cell length", unit: "m" },
      { key: "cellWidth", label: "Cell width", unit: "m" },
      {
        key: "sequence",
        label: "Stacking sequence",
        options: [
          ["row", "Row by row"],
          ["column", "Column by column"],
          ["left", "Left to right"],
          ["right", "Right to left"],
        ],
      },
      {
        key: "equipment",
        label: "Equipment",
        options: [
          ["truck", "Truck stacking"],
          ["conveyor", "Conveyor / radial stacker"],
        ],
        hint: "Equipment does not silently change the entered production rate.",
      },
      {
        key: "shutdownStart",
        label: "Shutdown first day",
        hint: "0 disables the shutdown.",
      },
      { key: "shutdownEnd", label: "Shutdown last day" },
    ],
  },
  {
    title: "Irrigation & leaching",
    number: "04",
    fields: [
      { key: "leachDays", label: "Leach cycle", unit: "days" },
      { key: "setupDays", label: "Irrigation setup", unit: "days" },
      { key: "rinseDays", label: "Rinsing period", unit: "days" },
      { key: "drainDays", label: "Drain-down", unit: "days" },
      { key: "irrigationRate", label: "Application rate", unit: "L/m²/h" },
      { key: "irrigationHours", label: "Irrigation hours", unit: "h/day" },
      {
        key: "irrigationCapacity",
        label: "Concurrent flow limit",
        unit: "m³/h",
      },
      {
        key: "hydraulicMode",
        label: "Collection concept",
        options: [
          ["base", "Through lower lifts to base"],
          ["interlift", "Engineered interlift collection"],
        ],
      },
      { key: "irrigationShutdownStart", label: "Irrigation shutdown start" },
      { key: "irrigationShutdownEnd", label: "Irrigation shutdown end" },
    ],
  },
  {
    title: "Disposal strategy",
    number: "05",
    fields: [
      { key: "removalRate", label: "Removal capacity", unit: "t/day" },
      { key: "removalOperatingDays", label: "Removal days", unit: "/ year" },
      { key: "prepDays", label: "Pad preparation", unit: "days" },
      { key: "disposalDensity", label: "Disposal bulk density", unit: "t/m³" },
      { key: "disposalHeight", label: "Disposal height", unit: "m" },
      { key: "disposalSlope", label: "Disposal slope", unit: "H : 1V" },
      {
        key: "disposalType",
        label: "Facility type",
        options: [
          ["dry", "Dry coarse spent ore"],
          ["co-disposal", "Engineered co-disposal"],
          ["wet", "Conventional wet TSF"],
        ],
      },
      {
        key: "disposalVolume",
        label: "Verified storage volume",
        unit: "m³",
        hint: "Blank = sized to the project for conceptual flow only.",
      },
      {
        key: "approvedDisposalTonnes",
        label: "Approved remaining storage",
        unit: "t",
      },
      { key: "transportDistance", label: "Haul distance", unit: "km" },
      { key: "handlingRequirements", label: "Handling requirements" },
      { key: "requiredModifications", label: "Required modifications" },
      { key: "disposalDesignValidated", label: "Disposal design defined" },
      { key: "compatibility", label: "Material compatibility verified" },
      { key: "disposalGeotech", label: "Disposal geotechnical approval" },
      {
        key: "disposalEnvironmental",
        label: "Disposal environmental approval",
      },
    ],
  },
  {
    title: "Site & infrastructure",
    number: "06",
    fields: [
      { key: "workingArea", label: "Working / stacking area", unit: "m²" },
      { key: "bermArea", label: "Berms & access", unit: "m²" },
      { key: "pondArea", label: "Solution ponds", unit: "m²" },
      { key: "plantArea", label: "Process plant", unit: "m²" },
      { key: "roadArea", label: "Roads", unit: "m²" },
      { key: "stormwaterArea", label: "Stormwater", unit: "m²" },
      { key: "otherArea", label: "Other allowances", unit: "m²" },
      { key: "disposalAllowance", label: "Disposal area allowance", unit: "%" },
      { key: "permittedLand", label: "Permitted land area", unit: "m²" },
    ],
  },
  {
    title: "Economics",
    number: "07",
    fields: [
      { key: "padCost", label: "Pad construction", unit: "$/m²" },
      {
        key: "disposalCost",
        label: "Disposal build / TSF mods",
        unit: "$/m² or $",
      },
      { key: "rehandleCost", label: "Excavation / rehandling", unit: "$/t" },
      { key: "haulCost", label: "Haulage", unit: "$/t/km" },
      { key: "rinseCost", label: "Rinse / drain-down", unit: "$/t" },
      {
        key: "disposalOperatingCost",
        label: "Disposal operations",
        unit: "$/t",
      },
      { key: "environmentalCost", label: "Environmental controls", unit: "$" },
      { key: "closureCost", label: "Closure allowance", unit: "$" },
    ],
  },
  {
    title: "Engineering validation",
    number: "08",
    fields: [
      { key: "approvedLiftHeight", label: "Approved lift height", unit: "m" },
      { key: "approvedHeight", label: "Approved overall height", unit: "m" },
      { key: "geotech", label: "Geotechnical validation" },
      { key: "permeability", label: "Permeability tests validated" },
      { key: "foundation", label: "Foundation validation" },
      { key: "metallurgical", label: "Column recovery tests validated" },
      { key: "environmental", label: "Environmental approval" },
      {
        key: "linerCapacity",
        label: "Liner / drainage capacity",
        unit: "m³/h",
      },
      { key: "pumpCapacity", label: "Pumping capacity", unit: "m³/h" },
    ],
  },
];
function ParameterField({ field }: { field: Field }) {
  const inputs = useProject((s) => s.inputs),
    setInputs = useProject((s) => s.setInputs);
  const value = inputs[field.key];
  const [draft, setDraft] = useState(String(value ?? "")),
    [error, setError] = useState("");
  useEffect(() => {
    setDraft(String(value ?? ""));
    setError("");
  }, [value]);
  const commit = (next: unknown) => {
    const parsed = inputsSchema.safeParse({
      ...useProject.getState().inputs,
      [field.key]: next,
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(" "));
      return;
    }
    setError("");
    setInputs(parsed.data);
  };
  const id = `input-${field.key}`;
  const continuous =
    inputs.scenario === "permanent" && inputs.stackingMode === "continuous";
  const calculated =
    (inputs.sizingMode === "fixed-ore" || continuous) &&
    (field.key === "length" || field.key === "width");
  const resolved = calculated ? resolveInputs(inputs) : inputs;
  // Update valid numeric edits after a short pause without requiring blur/Enter.
  useEffect(() => {
    if (
      calculated ||
      field.options ||
      typeof value === "boolean" ||
      draft === String(value ?? "")
    )
      return;
    const timer = setTimeout(
      () =>
        commit(
          typeof value === "string"
            ? draft
            : draft.trim() === ""
              ? null
              : Number(draft),
        ),
      350,
    );
    return () => clearTimeout(timer);
  }, [draft, value, calculated]);
  if (
    (field.key === "stackingMode" && inputs.scenario !== "permanent") ||
    (continuous && ["liftHeight", "maxLifts", "sizingMode"].includes(field.key))
  )
    return null;
  if (typeof value === "boolean")
    return (
      <label className="check-field" htmlFor={id}>
        <span>{field.label}</span>
        <input
          id={id}
          type="checkbox"
          checked={value}
          onChange={(e) => commit(e.target.checked)}
        />
      </label>
    );
  const isText = typeof value === "string";
  return (
    <div
      className="field"
      title={
        field.hint ??
        "Illustrative planning assumption; edit to reflect your site-specific design."
      }
    >
      <label htmlFor={id}>{field.label}</label>
      {field.options ? (
        <select
          id={id}
          value={String(value)}
          onChange={(e) => commit(e.target.value)}
        >
          {field.options.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      ) : (
        <div className={`input-wrap ${error ? "invalid" : ""}`}>
          <input
            id={id}
            type={isText ? "text" : "number"}
            step="any"
            value={
              calculated
                ? Number(Number(resolved[field.key]).toFixed(2))
                : draft
            }
            placeholder={value === null ? "Not supplied" : ""}
            disabled={calculated}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() =>
              commit(
                isText ? draft : draft.trim() === "" ? null : Number(draft),
              )
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
          {field.unit && <span>{field.unit}</span>}
        </div>
      )}
      {error && (
        <small id={`${id}-error`} className="field-error">
          {error}
        </small>
      )}
    </div>
  );
}
export function Parameters() {
  const setInputs = useProject((s) => s.setInputs);
  return (
    <aside className="parameters">
      <div className="panel-heading">
        <span>
          <SlidersHorizontal size={15} /> Model parameters
        </span>
        <button
          title="Restore illustrative defaults"
          aria-label="Restore default inputs"
          onClick={() => setInputs({ ...defaults })}
        >
          <RotateCcw size={14} />
        </button>
      </div>
      <div className="parameter-scroll">
        {groups.map((g, i) => (
          <details key={g.title} open={i < 2} className="parameter-group">
            <summary>
              <span className="section-number">{g.number}</span>
              {g.title}
              <ChevronDown size={13} />
            </summary>
            <div className="parameter-fields">
              {g.fields.map((field) => (
                <ParameterField key={field.key} field={field} />
              ))}
            </div>
          </details>
        ))}
        <div className="assumption-note">
          <Info size={15} />
          <p>
            Illustrative planning assumptions. Engineering approvals are entered
            explicitly; fit alone does not establish feasibility.
          </p>
        </div>
      </div>
      <div className="sidebar-foot">
        <span className="status-dot" /> Auto-saved in this browser{" "}
        <span>v1.1</span>
      </div>
    </aside>
  );
}
