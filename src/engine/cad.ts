import { DxfWriter, Units, point3d } from "@tarikjabiri/dxf";
import type {
  HeapCell,
  LiftSegment,
  ProjectInputs,
  SimulationResults,
  SimulationSnapshot,
} from "@/types/model";
import { heapDesign } from "./design";
import { segmentMesh, type SolidMesh } from "./geometry";
import { disposalGeometry } from "./analysis";

export type CadPoint = [number, number, number];
export interface CadFace {
  layer: string;
  vertices: [CadPoint, CadPoint, CadPoint];
}
export interface CadDrawing {
  faces: CadFace[];
  length: number;
  width: number;
  height: number;
  note: string;
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
export function designDrawing(inputs: ProjectInputs): CadDrawing {
  const d = heapDesign(inputs);
  return {
    faces: facesFromMesh(d.mesh, "HEAP_DESIGN"),
    length: d.inputs.length,
    width: d.inputs.width,
    height: d.height,
    note: "Full design envelope - planning geometry - metres",
  };
}
export function snapshotDrawing(
  result: SimulationResults,
  snapshot: SimulationSnapshot,
): CadDrawing {
  const p = result.inputs,
    cells = new Map(result.cells.map((c) => [c.id, c]));
  const faces = result.segments.flatMap((s) => {
    const cell = cells.get(s.cellId)!;
    return facesFromMesh(
      segmentMesh(p, cell, s, snapshot.segments[s.index].tonnes),
      `HEAP_L${s.lift}`,
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
    faces,
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
    ...new Set(d.faces.map((f) => f.layer)),
  ];
  for (const layer of layers)
    writer.addLayer(layer, layer === "MEASUREMENTS" ? 2 : 3);
  for (const face of d.faces) {
    const [a, b, c] = face.vertices.map((p) => point3d(...p));
    writer.add3dFace(a, b, c, c, { layerName: face.layer });
  }
  const corners: CadPoint[] = [
    [0, 0, 0],
    [d.length, 0, 0],
    [d.length, -d.width, 0],
    [0, -d.width, 0],
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
