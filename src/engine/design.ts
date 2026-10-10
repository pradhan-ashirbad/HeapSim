import type { ProjectInputs, HeapCell, LiftSegment } from "@/types/model";
import {
  resolveInputs,
  designHeight,
  envelopeVolume,
  segmentMesh,
} from "./geometry";

/** Full geometric design envelope, independent of operating-day completion. */
export function heapDesign(raw: ProjectInputs) {
  const inputs = resolveInputs(raw);
  const heightLimit =
    inputs.scenario === "permanent"
      ? designHeight(inputs)
      : Math.min(inputs.liftHeight, inputs.maxHeight);
  const height =
    inputs.slope > 0
      ? Math.min(
          heightLimit,
          inputs.length / (2 * inputs.slope),
          inputs.width / (2 * inputs.slope),
        )
      : heightLimit;
  const volume = envelopeVolume(
    inputs.length,
    inputs.width,
    height,
    inputs.slope,
  );
  const cell: HeapCell = {
    id: "HEAP",
    row: 0,
    column: 0,
    x: 0,
    y: 0,
    length: inputs.length,
    width: inputs.width,
    area: inputs.length * inputs.width,
  };
  const segment: LiftSegment = {
    index: 0,
    cellId: cell.id,
    lift: 1,
    z0: 0,
    z1: height,
    volume,
    capacity: volume * inputs.density,
    topArea: 0,
  };
  return {
    inputs,
    height,
    volume,
    area: cell.area,
    capacity: segment.capacity,
    topLength: Math.max(0, inputs.length - 2 * inputs.slope * height),
    topWidth: Math.max(0, inputs.width - 2 * inputs.slope * height),
    mesh: segmentMesh(inputs, cell, segment, segment.capacity),
  };
}
export type HeapDesign = ReturnType<typeof heapDesign>;
