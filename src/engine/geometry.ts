import type { HeapCell, LiftSegment, ProjectInputs } from "@/types/model";

// Relative agreement tolerance after converting geometry to GPU float32 coordinates.
export const VOLUME_TOLERANCE = 1e-5;
export const oreVolume = (tonnes: number, density: number) => tonnes / density;
export const nominalCellCapacity = (
  length: number,
  width: number,
  height: number,
  density: number,
) => length * width * height * density;
export const setback = (height: number, slope: number) => height * slope;
export const gradeToDegrees = (grade: number) =>
  (Math.atan(grade / 100) * 180) / Math.PI;
export const degreesToGrade = (angle: number) =>
  Math.tan((angle * Math.PI) / 180) * 100;
export function reposeSlope(p: ProjectInputs) {
  if (p.reposeAngle === 90) return 0;
  // Adding the pad plane steepens the downhill face by the pad gradient.
  // One conservative setback is used for all four sides, measured per metre
  // of vertical ore thickness. The steepest true face stays at/below repose.
  const availableGradient =
    Math.tan((p.reposeAngle * Math.PI) / 180) - p.drainageGrade / 100;
  if (availableGradient <= 0)
    throw new Error(
      "Drainage angle must be less than the ore angle of repose.",
    );
  return 1 / availableGradient;
}
// Repose mode redraws the actual face angle; the conservative design mode
// retains any flatter engineered slope. Always derive this from raw inputs.
export const effectiveSlope = (p: ProjectInputs) =>
  p.slopeMode === "repose"
    ? reposeSlope(p)
    : Math.max(p.slope, reposeSlope(p));
export function groundElevation(p: ProjectInputs, x: number, y: number) {
  const rate = p.drainageGrade / 100;
  switch (p.drainageDirection) {
    case "north":
      return rate * y;
    case "east":
      return rate * (p.length - x);
    case "west":
      return rate * x;
    default:
      return rate * (p.width - y);
  }
}
export const designHeight = (p: ProjectInputs) =>
  p.scenario === "permanent" && p.stackingMode === "continuous"
    ? p.maxHeight
    : Math.min(p.maxHeight, p.maxLifts * p.liftHeight);
export function envelopeVolume(
  length: number,
  width: number,
  height: number,
  slope: number,
): number {
  if (
    [length, width, height].some((v) => !Number.isFinite(v) || v <= 0) ||
    slope < 0 ||
    !Number.isFinite(slope)
  )
    return 0;
  const h = slope
    ? Math.min(height, length / (2 * slope), width / (2 * slope))
    : height;
  return (
    length * width * h -
    slope * (length + width) * h * h +
    (4 / 3) * slope * slope * h * h * h
  );
}
export function requiredFootprint(
  volume: number,
  height: number,
  slope: number,
  aspectRatio = 4 / 3,
) {
  let low = 2 * slope * height * Math.max(1, 1 / aspectRatio),
    high = Math.max(low + 1, Math.sqrt(volume / height / aspectRatio) * 4);
  while (envelopeVolume(high * aspectRatio, high, height, slope) < volume)
    high *= 2;
  // The minimum footprint also preserves a nonnegative top at the requested height.
  for (let i = 0; i < 64; i++) {
    const mid = (low + high) / 2;
    if (envelopeVolume(mid * aspectRatio, mid, height, slope) < volume)
      low = mid;
    else high = mid;
  }
  return {
    length: high * aspectRatio,
    width: high,
    area: high * high * aspectRatio,
  };
}
// The maximum height is a cap. Small piles reach their natural apex below it;
// forcing the cap would reserve a footprint larger than the supplied ore volume.
export function continuousPile(p: ProjectInputs) {
  const volume = oreVolume(p.oreTonnes, p.density);
  const slope = effectiveSlope(p);
  const unitWidth = 2 * slope * Math.max(1, 1 / p.aspectRatio);
  const apexCoefficient = envelopeVolume(
    unitWidth * p.aspectRatio,
    unitWidth,
    1,
    slope,
  );
  const height =
    slope > 0
      ? Math.min(p.maxHeight, Math.cbrt(volume / apexCoefficient))
      : p.maxHeight;
  return {
    ...requiredFootprint(volume, height, slope, p.aspectRatio),
    height,
    volume,
  };
}
export function resolveInputs(p: ProjectInputs): ProjectInputs {
  const slope = effectiveSlope(p);
  if (p.scenario === "permanent" && p.stackingMode === "continuous") {
    const pile = continuousPile(p);
    return {
      ...p,
      slope,
      length: pile.length,
      width: pile.width,
      maxHeight: pile.height,
      liftHeight: pile.height,
      maxLifts: 1,
      sizingMode: "fixed-ore",
    };
  }
  if (p.sizingMode !== "fixed-ore") return { ...p, slope };
  const height =
    p.scenario === "permanent"
      ? designHeight(p)
      : Math.min(p.liftHeight, p.maxHeight);
  const f = requiredFootprint(
    p.oreTonnes / p.density,
    height,
    slope,
    p.aspectRatio,
  );
  return { ...p, slope, length: f.length, width: f.width };
}
const rowName = (index: number): string =>
  index < 26
    ? String.fromCharCode(65 + index)
    : rowName(Math.floor(index / 26) - 1) +
      String.fromCharCode(65 + (index % 26));
export function generateCells(p: ProjectInputs): HeapCell[] {
  const cells: HeapCell[] = [];
  const rows = Math.ceil(p.width / p.cellWidth),
    columns = Math.ceil(p.length / p.cellLength);
  if (rows * columns * p.maxLifts > 5000)
    throw new Error("Grid exceeds 5,000 segments. Increase cell dimensions.");
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      const length = Math.min(p.cellLength, p.length - c * p.cellLength),
        width = Math.min(p.cellWidth, p.width - r * p.cellWidth);
      cells.push({
        id: `${rowName(r)}${c + 1}`,
        row: r,
        column: c,
        x: c * p.cellLength,
        y: r * p.cellWidth,
        length,
        width,
        area: length * width,
      });
    }
  return cells;
}
export function boundsAt(p: ProjectInputs, cell: HeapCell, z: number) {
  const inset = p.slope * z;
  return {
    x0: Math.max(cell.x, inset),
    x1: Math.min(cell.x + cell.length, p.length - inset),
    y0: Math.max(cell.y, inset),
    y1: Math.min(cell.y + cell.width, p.width - inset),
  };
}
export function areaAt(p: ProjectInputs, cell: HeapCell, z: number) {
  const b = boundsAt(p, cell, z);
  return Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
}

// Irrigation demand uses the horizontal projection of the segment at its base.
// A perimeter wedge can have a zero-area horizontal top while retaining ore.
// Using its projected footprint avoids zero-flow leaching of these segments;
// slope-face application remains an explicit conceptual hydraulic assumption.
export function irrigatedArea(
  p: ProjectInputs,
  cell: HeapCell,
  segment: LiftSegment,
  tonnes: number,
) {
  return tonnes > 0 ? areaAt(p, cell, segment.z0) : 0;
}
export function breakpoints(
  p: ProjectInputs,
  cell: HeapCell,
  z0: number,
  z1: number,
) {
  const values = [z0, z1];
  if (p.slope > 0)
    for (const edge of [
      cell.x,
      cell.x + cell.length,
      p.length - cell.x,
      p.length - cell.x - cell.length,
      cell.y,
      cell.y + cell.width,
      p.width - cell.y,
      p.width - cell.y - cell.width,
      p.width / 2,
      p.length / 2,
    ]) {
      const z = edge / p.slope;
      if (z > z0 && z < z1) values.push(z);
    }
  return [...new Set(values)].sort((a, b) => a - b);
}
// Each clipped horizontal rectangle has piecewise linear side lengths. Simpson's rule
// exactly integrates their quadratic product between all slope/grid intersections.
export function segmentVolume(
  p: ProjectInputs,
  cell: HeapCell,
  z0: number,
  z1: number,
) {
  if (z1 <= z0) return 0;
  const levels = breakpoints(p, cell, z0, z1);
  let volume = 0;
  for (let i = 1; i < levels.length; i++) {
    const a = levels[i - 1],
      b = levels[i];
    volume +=
      ((b - a) / 6) *
      (areaAt(p, cell, a) +
        4 * areaAt(p, cell, (a + b) / 2) +
        areaAt(p, cell, b));
  }
  return volume;
}
export function generateSegments(
  p: ProjectInputs,
  cells: HeapCell[],
): LiftSegment[] {
  const segments: LiftSegment[] = [];
  const height =
    p.scenario === "permanent"
      ? designHeight(p)
      : Math.min(p.liftHeight, p.maxHeight);
  for (let lift = 1; lift <= p.maxLifts; lift++) {
    const z0 = (lift - 1) * p.liftHeight,
      z1 = Math.min(lift * p.liftHeight, height);
    if (z0 >= z1) break;
    for (const cell of cells) {
      const volume = segmentVolume(p, cell, z0, z1);
      if (volume > 1e-7)
        segments.push({
          index: segments.length,
          cellId: cell.id,
          lift,
          z0,
          z1,
          volume,
          capacity: volume * p.density,
          topArea: areaAt(p, cell, z1),
        });
    }
  }
  return segments;
}
export function filledHeight(
  p: ProjectInputs,
  cell: HeapCell,
  segment: LiftSegment,
  tonnes: number,
) {
  if (tonnes <= 1e-8) return segment.z0;
  if (tonnes >= segment.capacity - 1e-6)
    return p.slope
      ? Math.min(
          segment.z1,
          p.length / (2 * p.slope),
          p.width / (2 * p.slope),
          (cell.x + cell.length) / p.slope,
          (p.length - cell.x) / p.slope,
          (cell.y + cell.width) / p.slope,
          (p.width - cell.y) / p.slope,
        )
      : segment.z1;
  let low = segment.z0,
    high = segment.z1;
  for (let i = 0; i < 35; i++) {
    const mid = (low + high) / 2;
    if (segmentVolume(p, cell, segment.z0, mid) * p.density < tonnes) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}
export interface SolidMesh {
  positions: number[];
  indices: number[];
  levels: number[];
}
// Shared by Three.js rendering and mesh-volume tests. Coordinates are X, elevation, Y,
// relative to (cell.x, segment.z0, cell.y) to retain GPU float32 precision at site scale.
export function segmentMesh(
  p: ProjectInputs,
  cell: HeapCell,
  segment: LiftSegment,
  tonnes: number,
): SolidMesh {
  if (tonnes <= 1e-8) return { positions: [], indices: [], levels: [] };
  const top = filledHeight(p, cell, segment, tonnes);
  const levels = breakpoints(p, cell, segment.z0, top).filter(
    (z) => areaAt(p, cell, z) > 1e-10 || z === top,
  );
  const positions: number[] = [],
    indices: number[] = [];
  for (const z of levels) {
    const b = boundsAt(p, cell, z),
      x1 = Math.max(b.x0, b.x1),
      y1 = Math.max(b.y0, b.y1);
    positions.push(
      b.x0 - cell.x,
      z - segment.z0 + groundElevation(p, b.x0, b.y0),
      b.y0 - cell.y,
      x1 - cell.x,
      z - segment.z0 + groundElevation(p, x1, b.y0),
      b.y0 - cell.y,
      x1 - cell.x,
      z - segment.z0 + groundElevation(p, x1, y1),
      y1 - cell.y,
      b.x0 - cell.x,
      z - segment.z0 + groundElevation(p, b.x0, y1),
      y1 - cell.y,
    );
  }
  indices.push(0, 1, 2, 0, 2, 3);
  for (let level = 1; level < levels.length; level++)
    for (let j = 0; j < 4; j++) {
      const a = (level - 1) * 4 + j,
        b = (level - 1) * 4 + ((j + 1) % 4),
        c = level * 4 + j,
        d = level * 4 + ((j + 1) % 4);
      indices.push(a, c, d, a, d, b);
    }
  const last = (levels.length - 1) * 4;
  indices.push(last, last + 2, last + 1, last, last + 3, last + 2);
  return { positions, indices, levels };
}
export function meshVolume(mesh: SolidMesh) {
  let signed = 0;
  const p = mesh.positions;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = mesh.indices[i] * 3,
      b = mesh.indices[i + 1] * 3,
      c = mesh.indices[i + 2] * 3;
    signed +=
      p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) +
      p[a + 1] * (p[b + 2] * p[c] - p[b] * p[c + 2]) +
      p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
  }
  return Math.abs(signed / 6);
}
