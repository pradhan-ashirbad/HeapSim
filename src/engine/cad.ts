import { DxfWriter, Units, point3d } from "@tarikjabiri/dxf";
import type {
  HeapCell,
  LiftSegment,
  ProjectInputs,
  SimulationResults,
  SimulationSnapshot,
} from "@/types/model";
import { heapDesign } from "./design";
import { drainageProfile } from "./drainage";
import {
  boundsAt,
  filledHeight,
  generateCells,
  generateSegments,
  groundElevation,
  segmentMesh,
  type SolidMesh,
} from "./geometry";
import { disposalGeometry } from "./analysis";

export type CadPoint = [number, number, number];
export interface CadFace {
  layer: string;
  vertices: [CadPoint, CadPoint, CadPoint];
}
export interface CadLine {
  layer: string;
  start: CadPoint;
  end: CadPoint;
}
export interface CadLabel {
  layer: string;
  point: CadPoint;
  value: string;
  height: number;
}
export interface CadDrawing {
  inputs: ProjectInputs;
  faces: CadFace[];
  lines: CadLine[];
  labels: CadLabel[];
  length: number;
  width: number;
  height: number;
  note: string;
}
const cadPoint = (p: ProjectInputs, x: number, y: number, z = 0): CadPoint => [
  x,
  -y,
  z + groundElevation(p, x, y),
];
function outline(
  p: ProjectInputs,
  cell: HeapCell,
  z: number,
  layer: string,
): CadLine[] {
  const b = boundsAt(p, cell, z);
  if (b.x1 <= b.x0 || b.y1 <= b.y0) return [];
  const points = [
    cadPoint(p, b.x0, b.y0, z),
    cadPoint(p, b.x1, b.y0, z),
    cadPoint(p, b.x1, b.y1, z),
    cadPoint(p, b.x0, b.y1, z),
  ];
  return points.map((point, i) => ({
    layer,
    start: point,
    end: points[(i + 1) % 4],
  }));
}
function gridDrawing(p: ProjectInputs, cells: HeapCell[]) {
  const lines = cells.flatMap((cell) => outline(p, cell, 0, "CELL_GRID"));
  const labels = cells.map((cell): CadLabel => ({
    layer: "CELL_LABELS",
    point: cadPoint(p, cell.x + cell.length / 2, cell.y + cell.width / 2, 0.2),
    value: cell.id,
    height: Math.max(1, Math.min(cell.length, cell.width) / 8),
  }));
  return { lines, labels };
}

function facesFromMesh(
  mesh: SolidMesh,
  layer: string,
  offset: CadPoint = [0, 0, 0],
): CadFace[] {
  const faces: CadFace[] = [];
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const vertices = mesh.indices.slice(i, i + 3).map((index): CadPoint => {
      const j = index * 3;
      // Rendering: X east, Y up, Z south. CAD: X east, Y north, Z up.
      return [
        mesh.positions[j] + offset[0],
        -(mesh.positions[j + 2] + offset[2]),
        mesh.positions[j + 1] + offset[1],
      ];
    }) as CadFace["vertices"];
    const [a, b, c] = vertices;
    const u = b.map((v, j) => v - a[j]),
      v = c.map((n, j) => n - a[j]);
    if (
      Math.hypot(
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
      ) > 1e-10
    )
      faces.push({ layer, vertices });
  }
  return faces;
}
/** Dimensioned ground plane and a separate true-scale planned elevation section. */
function drainageDrawing(p: ProjectInputs) {
  const d = drainageProfile(p),
    lines: CadLine[] = [],
    labels: CadLabel[] = [];
  const h = Math.max(1, Math.min(p.length, p.width) / 100);
  const addLine = (layer: string, start: CadPoint, end: CadPoint) =>
    lines.push({ layer, start, end });
  const addLabel = (layer: string, point: CadPoint, value: string) =>
    labels.push({ layer, point, value, height: h });
  const at = (distance: number, thickness = 0): CadPoint => {
    const [x, z, y] = d.pointAt(distance, thickness);
    return d.lowDirection === "east" || d.lowDirection === "west"
      ? [x, h * 4, z]
      : [p.length + h * 4, -y, z];
  };
  const low = at(0),
    high = at(d.run),
    highDatum: CadPoint = [high[0], high[1], 0];
  addLine("DRAINAGE_GRADE", low, high);
  addLine("DRAINAGE_DATUM", low, highDatum);
  addLine("DRAINAGE_DIMENSIONS", highDatum, high);
  // Arrow points downhill on the graded plane, outside the ore cells.
  const tip = at(d.run * 0.3),
    tail = at(d.run * 0.7),
    wing = at(d.run * 0.36);
  addLine("DRAINAGE_GRADE", tail, tip);
  for (const sign of [-1, 1]) {
    const side: CadPoint = [...wing];
    side[d.lowDirection === "east" || d.lowDirection === "west" ? 1 : 0] +=
      sign * h * 2;
    addLine("DRAINAGE_GRADE", tip, side);
  }
  addLabel(
    "DRAINAGE_NOTES",
    low,
    `LOW ${d.lowDirection.toUpperCase()} - GROUND Z=0.000m (datum)`,
  );
  addLabel(
    "DRAINAGE_NOTES",
    high,
    `HIGH ${d.highDirection.toUpperCase()} - GROUND Z=${d.rise.toFixed(3)}m`,
  );
  addLabel(
    "DRAINAGE_NOTES",
    at(d.run / 2),
    `DRAIN TO ${d.lowDirection.toUpperCase()}: ${d.angle.toFixed(3)} deg / ${p.drainageGrade.toFixed(3)}%; RISE ${d.rise.toFixed(3)}m`,
  );
  // XY layout of a vertical section, offset away from the heap plan; all metres, 1:1.
  const originX = p.length + h * 20,
    originY = h * 30;
  const section = ([distance, elevation]: number[]): CadPoint => [
    originX + distance,
    originY + elevation,
    0,
  ];
  for (let i = 0; i < d.outline.length; i++)
    addLine(
      "DESIGN_SECTION",
      section(d.outline[i]),
      section(d.outline[(i + 1) % d.outline.length]),
    );
  addLine("DRAINAGE_DIMENSIONS", section([0, 0]), section([d.run, 0]));
  addLine("DRAINAGE_DIMENSIONS", section([d.run, 0]), section([d.run, d.rise]));
  for (const distance of [d.inset, d.run - d.inset])
    addLine(
      "DRAINAGE_DIMENSIONS",
      section([distance, (distance * p.drainageGrade) / 100]),
      section([distance, (distance * p.drainageGrade) / 100 + d.height]),
    );
  const notes = [
    "PLANNED FULL HEAP - DRAINAGE SECTION - TRUE SCALE 1:1 - METRES",
    `Left: LOW ${d.lowDirection.toUpperCase()} / Right: HIGH ${d.highDirection.toUpperCase()}; datum = low ground 0.000m`,
    `Run ${d.run.toFixed(3)}m; tilt ${d.angle.toFixed(3)} deg = ${p.drainageGrade.toFixed(3)}%; rise = run x tan(tilt) = ${d.rise.toFixed(3)}m`,
    `Ground low / high: 0.000 / ${d.rise.toFixed(3)}m; crest low / high: ${d.lowCrest.toFixed(3)} / ${d.highCrest.toFixed(3)}m`,
    `Vertical ore thickness ${d.height.toFixed(3)}m; crest setback ${d.inset.toFixed(3)}m each side`,
    `Repose limit ${p.reposeAngle.toFixed(3)} deg; actual outer face low / high / cross: ${d.faceAngles.low.toFixed(3)} / ${d.faceAngles.high.toFixed(3)} / ${d.faceAngles.cross.toFixed(3)} deg`,
    `Setback ${p.slope.toFixed(3)}H per 1V ore thickness (includes drainage correction); temporary internal fronts schematic`,
  ];
  notes.forEach((note, i) =>
    addLabel("DRAINAGE_NOTES", section([0, -h * (4 + i * 2)]), note),
  );
  addLabel(
    "DRAINAGE_NOTES",
    section([d.inset, d.lowCrest + h * 2]),
    `LOW CREST Z=${d.lowCrest.toFixed(3)}m`,
  );
  addLabel(
    "DRAINAGE_NOTES",
    section([d.run - d.inset, d.highCrest + h * 4]),
    `HIGH CREST Z=${d.highCrest.toFixed(3)}m`,
  );
  return { lines, labels };
}
export function designDrawing(inputs: ProjectInputs): CadDrawing {
  const d = heapDesign(inputs);
  const cells = generateCells(d.inputs),
    segments = generateSegments(d.inputs, cells);
  const byCell = new Map(cells.map((c) => [c.id, c]));
  const faces = segments.flatMap((s) =>
    facesFromMesh(
      segmentMesh(d.inputs, byCell.get(s.cellId)!, s, s.capacity),
      `HEAP_${s.cellId}_L${s.lift}`,
      [byCell.get(s.cellId)!.x, s.z0, byCell.get(s.cellId)!.y],
    ),
  );
  const grid = gridDrawing(d.inputs, cells);
  const drainage = drainageDrawing(d.inputs);
  const lines = [
    ...grid.lines,
    ...drainage.lines,
    ...segments.flatMap((s) =>
      outline(d.inputs, byCell.get(s.cellId)!, s.z1, `CELL_TOP_L${s.lift}`),
    ),
  ];
  const labels = [
    ...grid.labels,
    ...drainage.labels,
    ...segments
      .filter((s) => s.topArea > 1)
      .map((s): CadLabel => {
        const b = boundsAt(d.inputs, byCell.get(s.cellId)!, s.z1);
        return {
          layer: "CELL_LABELS",
          point: cadPoint(
            d.inputs,
            (b.x0 + b.x1) / 2,
            (b.y0 + b.y1) / 2,
            s.z1 + 0.15,
          ),
          value: `${s.cellId} L${s.lift}`,
          height: Math.max(
            1,
            Math.min(
              byCell.get(s.cellId)!.length,
              byCell.get(s.cellId)!.width,
            ) / 10,
          ),
        };
      }),
  ];
  return {
    inputs: d.inputs,
    faces,
    lines,
    labels,
    length: d.inputs.length,
    width: d.inputs.width,
    height: d.height,
    note: "Full pile design by cell and lift - planning geometry - metres",
  };
}
export function snapshotDrawing(
  result: SimulationResults,
  snapshot: SimulationSnapshot,
): CadDrawing {
  const p = result.inputs,
    cells = new Map(result.cells.map((c) => [c.id, c]));
  const grid = gridDrawing(p, result.cells);
  const drainage = drainageDrawing(p);
  const lines = [...grid.lines, ...drainage.lines];
  const labels = [...grid.labels, ...drainage.labels];
  const faces = result.segments.flatMap((s) => {
    const cell = cells.get(s.cellId)!;
    const mass = snapshot.segments[s.index].tonnes;
    if (mass > 0) {
      const top = filledHeight(p, cell, s, mass);
      lines.push(...outline(p, cell, top, `CELL_TOP_L${s.lift}`));
      const b = boundsAt(p, cell, top);
      if (b.x1 > b.x0 && b.y1 > b.y0)
        labels.push({
          layer: "CELL_LABELS",
          point: cadPoint(p, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, top + 0.15),
          value: `${s.cellId} L${s.lift} ${Math.round(mass)}t`,
          height: Math.max(1, Math.min(cell.length, cell.width) / 10),
        });
    }
    return facesFromMesh(
      segmentMesh(p, cell, s, mass),
      `HEAP_${s.cellId}_L${s.lift}`,
      [cell.x, s.z0, cell.y],
    );
  });
  if (p.scenario !== "permanent" && snapshot.metrics.disposal > 0) {
    const d = disposalGeometry(p, snapshot.metrics.disposal);
    const dp = {
      ...p,
      length: d.length,
      width: d.width,
      density: p.disposalDensity,
      slope: p.disposalSlope,
    };
    const cell: HeapCell = {
      id: "DISPOSAL",
      x: 0,
      y: 0,
      row: 0,
      column: 0,
      length: d.length,
      width: d.width,
      area: d.area,
    };
    const s: LiftSegment = {
      index: 0,
      cellId: cell.id,
      lift: 1,
      z0: 0,
      z1: d.height,
      volume: d.volume,
      capacity: snapshot.metrics.disposal,
      topArea: 0,
    };
    faces.push(
      ...facesFromMesh(segmentMesh(dp, cell, s, s.capacity), "DISPOSAL", [
        p.length + 65 + (d.design.length - d.length) / 2,
        0,
        (d.design.width - d.width) / 2,
      ]),
    );
  }
  return {
    inputs: p,
    faces,
    lines,
    labels,
    length: p.length,
    width: p.width,
    height: snapshot.metrics.height,
    note: `Operating day ${snapshot.day} - actual ore geometry - metres`,
  };
}

/** Standards-compliant DXF with explicit handles, layers and model-space ownership. */
export function drawingDxf(d: CadDrawing) {
  const writer = new DxfWriter();
  // Only R2000 entities are emitted. Match the encoder's string representation.
  writer.setVariable("$ACADVER", { 1: "AC1015" });
  writer.setUnits(Units.Meters);
  writer.setVariable("$MEASUREMENT", { 70: 1 });
  const layers = [
    "PAD_BOUNDARY",
    "MEASUREMENTS",
    ...new Set(d.lines.map((l) => l.layer)),
    ...new Set(d.labels.map((l) => l.layer)),
    ...new Set(d.faces.map((f) => f.layer)),
  ];
  for (const layer of new Set(layers))
    writer.addLayer(layer, layer === "MEASUREMENTS" ? 2 : 3);
  for (const face of d.faces) {
    const [a, b, c] = face.vertices.map((p) => point3d(...p));
    writer.add3dFace(a, b, c, c, { layerName: face.layer });
  }
  for (const line of d.lines)
    writer.addLine(point3d(...line.start), point3d(...line.end), {
      layerName: line.layer,
    });
  for (const label of d.labels)
    writer.addText(point3d(...label.point), label.height, label.value, {
      layerName: label.layer,
    });
  const corners: CadPoint[] = [
    cadPoint(d.inputs, 0, 0),
    cadPoint(d.inputs, d.length, 0),
    cadPoint(d.inputs, d.length, d.width),
    cadPoint(d.inputs, 0, d.width),
  ];
  for (let i = 0; i < 4; i++)
    writer.addLine(point3d(...corners[i]), point3d(...corners[(i + 1) % 4]), {
      layerName: "PAD_BOUNDARY",
    });
  const textHeight = Math.max(1, Math.min(d.length, d.width) / 80);
  for (const [i, label] of [
    d.note,
    `Base ${d.length.toFixed(3)} x ${d.width.toFixed(3)} m; height ${d.height.toFixed(3)} m`,
    "X east / Y north / Z elevation. 3DFACE mesh; not ACIS solids.",
  ].entries())
    writer.addText(point3d(0, (i + 1) * textHeight * 2, 0), textHeight, label, {
      layerName: "MEASUREMENTS",
    });
  // LibreDWG preallocates model space at 0x1F. Swap handle identities globally
  // so its importer reuses that block instead of creating a duplicate handle.
  const modelHandle = writer.modelSpace.blockRecord.handle;
  const records = writer
    .stringify()
    .replace("0\nSECTION\n2\nCLASSES\n0\nENDSEC\n", "")
    .split("\n");
  for (let i = 0; i + 1 < records.length; i += 2) {
    const code = Number(records[i]);
    if (
      code === 5 ||
      code === 105 ||
      code === 1005 ||
      (code >= 320 && code <= 369) ||
      (code >= 390 && code <= 399)
    )
      records[i + 1] =
        records[i + 1] === modelHandle
          ? "1F"
          : records[i + 1] === "1F"
            ? modelHandle
            : records[i + 1];
  }
  return records.join("\n");
}
