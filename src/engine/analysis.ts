import type {
  EngineeringWarning,
  ProjectInputs,
  SimulationResults,
} from "@/types/model";
import {
  designHeight,
  envelopeVolume,
  requiredFootprint,
  reposeSlope,
} from "./geometry";

export function disposalCapacity(p: ProjectInputs) {
  if (p.scenario === "existing-tsf")
    return Math.min(
      p.disposalVolume === null
        ? Infinity
        : p.disposalVolume * p.disposalDensity,
      p.approvedDisposalTonnes ?? Infinity,
    );
  return p.disposalVolume === null
    ? p.oreTonnes
    : p.disposalVolume * p.disposalDensity;
}
export function disposalFootprint(p: ProjectInputs) {
  const volume = p.disposalVolume ?? p.oreTonnes / p.disposalDensity;
  return requiredFootprint(
    volume,
    p.disposalHeight,
    p.disposalSlope,
    p.aspectRatio,
  );
}
export function disposalGeometry(p: ProjectInputs, tonnes: number) {
  const design = disposalFootprint(p);
  const capacityVolume = envelopeVolume(
    design.length,
    design.width,
    p.disposalHeight,
    p.disposalSlope,
  );
  const volume = Math.max(0, tonnes) / p.disposalDensity;
  // Self-similar growth keeps the specified outer slope and exactly preserves volume.
  // The designed facility footprint remains the reserved land requirement.
  const scale =
    capacityVolume > 0 ? Math.cbrt(Math.min(volume / capacityVolume, 1)) : 0;
  return {
    design,
    length: design.length * scale,
    width: design.width * scale,
    height: p.disposalHeight * scale,
    area: design.area * scale * scale,
    volume,
  };
}
export function landComponents(p: ProjectInputs) {
  const disposal =
    p.scenario === "permanent" || p.scenario === "existing-tsf"
      ? 0
      : disposalFootprint(p).area * (1 + p.disposalAllowance / 100);
  return [
    { name: "Leach pad", area: p.length * p.width },
    { name: "Working / stacking", area: p.workingArea },
    { name: "Berms & access", area: p.bermArea },
    { name: "Solution ponds", area: p.pondArea },
    { name: "Process plant", area: p.plantArea },
    { name: "Roads", area: p.roadArea },
    { name: "Stormwater", area: p.stormwaterArea },
    { name: "New disposal + allowance", area: disposal },
    { name: "Other", area: p.otherArea },
  ];
}
export const totalLand = (p: ProjectInputs) =>
  landComponents(p).reduce((sum, c) => sum + c.area, 0);
export function indicativeCosts(p: ProjectInputs) {
  const reusable = p.scenario !== "permanent",
    newStorage = reusable && p.scenario !== "existing-tsf";
  const cost = (rate: number | null, quantity: number): number | null =>
    quantity === 0 ? 0 : rate === null ? null : rate * quantity;
  const rows = [
    {
      name: "Leach pad construction",
      value: cost(p.padCost, p.length * p.width),
    },
    {
      name: "Disposal construction / modifications",
      value: cost(
        p.disposalCost,
        newStorage
          ? disposalFootprint(p).area
          : p.scenario === "existing-tsf"
            ? 1
            : 0,
      ),
    },
    { name: "Rinsing & drain-down", value: cost(p.rinseCost, p.oreTonnes) },
    {
      name: "Excavation / rehandling",
      value: cost(p.rehandleCost, reusable ? p.oreTonnes : 0),
    },
    {
      name: "Haulage",
      value: cost(p.haulCost, reusable ? p.oreTonnes * p.transportDistance : 0),
    },
    {
      name: "Disposal operations",
      value: cost(p.disposalOperatingCost, reusable ? p.oreTonnes : 0),
    },
    { name: "Environmental controls", value: p.environmentalCost },
    { name: "Closure allowance", value: p.closureCost },
  ];
  return {
    rows,
    knownSubtotal: rows.reduce((a, r) => a + (r.value ?? 0), 0),
    total: rows.some((r) => r.value === null)
      ? null
      : rows.reduce((a, r) => a + r.value!, 0),
  };
}
export function engineeringWarnings(
  p: ProjectInputs,
  capacity: number,
): EngineeringWarning[] {
  const warnings: EngineeringWarning[] = [];
  const add = (
    code: string,
    title: string,
    detail: string,
    severity: EngineeringWarning["severity"] = "warning",
  ) => warnings.push({ code, title, detail, severity });
  const h =
    p.scenario === "permanent"
      ? designHeight(p)
      : Math.min(p.liftHeight, p.maxHeight);
  if (Math.abs(p.slope - reposeSlope(p)) < 1e-6)
    add(
      "repose",
      "Angle of repose limits side slope",
      `The ${p.reposeAngle}° repose limit, corrected for ${p.drainageGrade}% pad grade, gives a minimum ${p.slope.toFixed(2)}H per 1V ore thickness setback. This is a static geometric limit; temporary working faces still require operational design.`,
      "info",
    );
  if (p.drainageGrade === 0)
    add(
      "drainage",
      "No pad drainage grade",
      "The liner and pile base are level; gravity collection to the selected edge is not represented.",
    );
  else
    add(
      "drainage",
      "Graded collection concept",
      `The pad drops ${p.drainageGrade}% toward the ${p.drainageDirection} edge. Surface elevations are included in 3D and CAD; drainage capacity and solution flow paths still require hydraulic design.`,
      "info",
    );
  if (p.scenario === "permanent" && capacity + 0.01 < p.oreTonnes) {
    const f = requiredFootprint(
      p.oreTonnes / p.density,
      h,
      p.slope,
      p.aspectRatio,
    );
    add(
      "capacity",
      "INSUFFICIENT HEAP CAPACITY",
      `${Math.round(p.oreTonnes - capacity).toLocaleString()} t / ${Math.round((p.oreTonnes - capacity) / p.density).toLocaleString()} m³ deficit. Required envelope ≈ ${f.length.toFixed(1)} × ${f.width.toFixed(1)} m; add at least ${Math.max(0, f.area - p.length * p.width).toFixed(0)} m² (before blocked cells and allowances).`,
      "error",
    );
  }
  if (p.slope * h * 2 > Math.min(p.length, p.width) + 1e-7)
    add(
      "slope",
      "Top footprint closes below planned height",
      "The slope envelope is clipped at its apex. Increase the base dimensions or reduce the planned height; no material is placed outside the envelope.",
      "error",
    );
  if (
    p.scenario === "permanent" &&
    p.stackingMode !== "continuous" &&
    p.maxLifts > 1 &&
    (!p.geotech ||
      !p.permeability ||
      !p.foundation ||
      p.approvedLiftHeight === null ||
      p.approvedHeight === null)
  )
    add(
      "overstack",
      "Overstacking clearance required",
      "Upper lifts require geotechnical, foundation and permeability validation, plus approved lift and overall heights. Lower lift history is retained; upper stacking remains blocked.",
    );
  if (p.scenario === "permanent" && p.stackingMode === "continuous")
    add(
      "continuous",
      "Continuous pile sizing concept",
      "The entire ore quantity is sized as one sloped pile without lift divisions. Cells are scheduling zones only. Footprint excludes infrastructure; geotechnical stability, full-depth leaching and construction method require validation.",
      "info",
    );
  if (
    (!(p.scenario === "permanent" && p.stackingMode === "continuous") &&
      p.approvedLiftHeight !== null &&
      p.liftHeight > p.approvedLiftHeight) ||
    (p.approvedHeight !== null && h > p.approvedHeight)
  )
    add(
      "height",
      "Design exceeds approved height",
      "Segments exceeding approved lift or overall heights cannot be stacked.",
      "error",
    );
  if (!p.metallurgical || p.goldGrade === null || p.recovery === null)
    add(
      "metallurgy",
      "Metallurgical inputs unvalidated",
      "No gold recovery, revenue or feasibility result is inferred. Supply grade, recovery and column-test validation.",
    );
  if (p.linerCapacity === null || p.pumpCapacity === null)
    add(
      "hydraulics",
      "Hydraulic design unvalidated",
      "Solution demand uses the entered application rate. No permeability or 3D seepage is inferred; pumping and liner capacities need confirmation.",
    );
  if (!p.environmental)
    add(
      "environment",
      "Environmental approval not recorded",
      "Footprint and material routing are planning results, not an environmental approval.",
    );
  if (p.permittedLand !== null && totalLand(p) > p.permittedLand)
    add(
      "land",
      "Land boundary exceeded",
      `${Math.round(totalLand(p) - p.permittedLand).toLocaleString()} m² beyond the permitted land allowance.`,
      "error",
    );
  if (
    p.scenario === "existing-tsf" &&
    (p.disposalVolume === null ||
      p.approvedDisposalTonnes === null ||
      !p.compatibility ||
      !p.disposalGeotech ||
      !p.disposalEnvironmental ||
      !p.disposalDesignValidated)
  )
    add(
      "tsf",
      "TSF INTEGRATION NOT VALIDATED",
      "Verified volume, approved tonnes, material compatibility, geotechnical/environmental approvals and a defined design are required. Missing capacities use total project mass only for conceptual flow; technical feasibility is not established.",
      "error",
    );
  if (
    p.scenario === "new-tsf" &&
    (!p.disposalDesignValidated ||
      !p.compatibility ||
      !p.disposalGeotech ||
      !p.disposalEnvironmental)
  )
    add(
      "new-disposal",
      "Disposal concept unvalidated",
      "Coarse dry ore, co-disposal and wet tailings have different requirements. Confirm a suitable material-specific design and approvals.",
      "error",
    );
  if (p.scenario !== "permanent" && p.disposalType === "wet")
    add(
      "wet",
      "Wet TSF suitability is not assumed",
      "The volume shown is dry-bulk equivalent. Slurry water, consolidation and wet facility design are not modelled.",
    );
  if (p.scenario !== "permanent" && disposalCapacity(p) < p.oreTonnes)
    add(
      "disposal-capacity",
      "Insufficient disposal capacity",
      "Removal will stop at the entered storage limit. Ore remains on the pad and is accounted for.",
      "error",
    );
  if (p.irrigationCapacity === 0)
    add(
      "irrigation",
      "No irrigation capacity",
      "Leaching cannot progress with zero available solution flow.",
      "error",
    );
  add(
    "approximation",
    "Planning geometry assumptions",
    "Permanent perimeter slopes follow the exact rectangular envelope. Temporary internal fronts are vertical prism cuts. Irrigation demand uses each segment's projected base area, including slope wedges; actual slope-face application, access and stability need separate design. Reusable cells are independently operated bays.",
    "info",
  );
  return warnings;
}
export function sensitivity(p: ProjectInputs) {
  return [10, 20, 30, 40, 50, 60].map((height) => ({
    height,
    hectares:
      requiredFootprint(p.oreTonnes / p.density, height, p.slope, p.aspectRatio)
        .area / 10000,
  }));
}
export function reportData(result: SimulationResults) {
  const final = result.frames.at(-1)!;
  return {
    application: "HeapSim 3D",
    schemaVersion: 1,
    assumptions: result.inputs,
    status: result.status,
    reason: result.reason,
    capacityTonnes: result.capacity,
    completionDay: result.completionDay,
    stackingCompleteDay: result.stackingCompleteDay,
    metrics: final.metrics,
    land: landComponents(result.inputs),
    costs: indicativeCosts(result.inputs),
    warnings: result.warnings,
    model:
      "Deterministic daily scheduling; exact clipped rectangular slope envelope; vertical temporary fronts; conceptual hydraulics; no inferred recovery or technical approval.",
  };
}
