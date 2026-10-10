import type { ProjectInputs } from "@/types/model";
import { simulate } from "./simulation";
import { totalLand } from "./analysis";
export type SensitivityDimension =
  "liftHeight" | "maxHeight" | "leachDays" | "density";
export function runSensitivity(
  inputs: ProjectInputs,
  dimension: SensitivityDimension,
) {
  return [0.6, 0.8, 1, 1.2, 1.4].map((factor) => {
    let value = Math.round(inputs[dimension] * factor * 100) / 100;
    if (dimension === "leachDays")
      value = Math.min(1000, Math.max(1, Math.round(value)));
    if (dimension === "maxHeight") value = Math.min(200, value);
    if (dimension === "liftHeight") value = Math.min(100, value);
    if (dimension === "density") value = Math.min(5, value);
    const result = simulate({ ...inputs, [dimension]: value });
    return {
      value,
      capacityMt: result.capacity / 1e6,
      landHa: totalLand(result.inputs) / 10000,
      completionDay: result.completionDay,
      status: result.status,
      stackedMt: result.frames.at(-1)!.metrics.stacked / 1e6,
    };
  });
}
