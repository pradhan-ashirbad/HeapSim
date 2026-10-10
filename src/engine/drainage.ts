import type { ProjectInputs } from "@/types/model";
import { heapDesign } from "./design";
import { gradeToDegrees, groundElevation } from "./geometry";

/** Full-design central section along the drainage axis, low toe datum = 0 m. */
export function drainageProfile(raw: ProjectInputs) {
  const design = heapDesign(raw),
    p = design.inputs;
  const alongX =
    p.drainageDirection === "east" || p.drainageDirection === "west";
  const run = alongX ? p.length : p.width;
  const grade = p.drainageGrade / 100;
  const rise = run * grade;
  const inset = p.slope * design.height;
  const lowCrest = design.height + inset * grade;
  const highCrest = design.height + (run - inset) * grade;
  const highDirection = (
    { south: "north", north: "south", east: "west", west: "east" } as const
  )[p.drainageDirection];
  // Distance is measured from the low/collection edge toward the high edge.
  const pointAt = (
    distance: number,
    thickness = 0,
  ): [number, number, number] => {
    const x = alongX
      ? p.drainageDirection === "east"
        ? p.length - distance
        : distance
      : p.length / 2;
    const y = alongX
      ? p.width / 2
      : p.drainageDirection === "south"
        ? p.width - distance
        : distance;
    return [x, groundElevation(p, x, y) + thickness, y];
  };
  const gradient = p.slope === 0 ? Infinity : 1 / p.slope;
  const faceAngles = {
    low: (Math.atan(gradient + grade) * 180) / Math.PI,
    high: (Math.atan(Math.abs(gradient - grade)) * 180) / Math.PI,
    cross: (Math.atan(Math.hypot(gradient, grade)) * 180) / Math.PI,
  };
  return {
    inputs: p,
    height: design.height,
    run,
    rise,
    inset,
    lowCrest,
    highCrest,
    angle: gradeToDegrees(p.drainageGrade),
    highDirection,
    lowDirection: p.drainageDirection,
    faceAngles,
    pointAt,
    // True-scale coordinates: horizontal distance from low edge, absolute Z.
    outline: [
      [0, 0],
      [inset, lowCrest],
      [run - inset, highCrest],
      [run, rise],
    ] as [number, number][],
  };
}
