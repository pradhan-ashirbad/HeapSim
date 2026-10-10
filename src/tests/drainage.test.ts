import { describe, expect, it } from "vitest";
import { defaults, inputsSchema } from "@/types/model";
import { degreesToGrade, gradeToDegrees, meshVolume } from "@/engine/geometry";
import { drainageProfile } from "@/engine/drainage";
import { heapDesign } from "@/engine/design";
import { designDrawing } from "@/engine/cad";

describe("graded heap elevations and physical repose", () => {
  it.each(["south", "north", "east", "west"] as const)(
    "dimensioned 2 degree drainage toward %s matches CAD",
    (drainageDirection) => {
      const p = {
        ...defaults,
        drainageDirection,
        drainageGrade: degreesToGrade(2),
        slope: 0.5,
        reposeAngle: 20,
      };
      const d = drainageProfile(p),
        drawing = designDrawing(p);
      const expectedRun = ["east", "west"].includes(drainageDirection)
        ? 400
        : 300;
      expect(d.run).toBe(expectedRun);
      expect(d.rise).toBeCloseTo(expectedRun * Math.tan(Math.PI / 90), 10);
      expect(gradeToDegrees(p.drainageGrade)).toBeCloseTo(2, 12);
      expect(d.pointAt(0)[1]).toBeCloseTo(0, 12);
      expect(d.pointAt(d.run)[1]).toBeCloseTo(d.rise, 12);
      expect(d.lowCrest).toBeCloseTo(
        d.height + (d.inset * p.drainageGrade) / 100,
        10,
      );
      expect(d.highCrest).toBeCloseTo(
        d.height + ((d.run - d.inset) * p.drainageGrade) / 100,
        10,
      );
      expect(d.faceAngles.low).toBeCloseTo(20, 10);
      const points = drawing.faces.flatMap((f) => f.vertices);
      expect(Math.max(...points.map((p) => p[2]))).toBeCloseTo(d.highCrest, 8);
      expect(
        drawing.labels.some((l) =>
          l.value.includes(`RISE ${d.rise.toFixed(3)}m`),
        ),
      ).toBe(true);
      expect(drawing.lines.some((l) => l.layer === "DESIGN_SECTION")).toBe(
        true,
      );
      // Independently measure face inclinations from the actual mesh normals.
      const design = heapDesign(p),
        mesh = design.mesh;
      let steepest = 0;
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const [a, b, c] = mesh.indices
          .slice(i, i + 3)
          .map((index) => mesh.positions.slice(index * 3, index * 3 + 3));
        const u = b.map((v, j) => v - a[j]),
          v = c.map((v, j) => v - a[j]);
        const n = [
          u[1] * v[2] - u[2] * v[1],
          u[2] * v[0] - u[0] * v[2],
          u[0] * v[1] - u[1] * v[0],
        ];
        if (Math.hypot(...n) > 1e-9)
          steepest = Math.max(
            steepest,
            (Math.atan2(Math.hypot(n[0], n[2]), Math.abs(n[1])) * 180) /
              Math.PI,
          );
      }
      expect(steepest).toBeCloseTo(20, 8);
      expect(meshVolume(mesh)).toBeCloseTo(design.volume, 5);
    },
  );
  it("handles level ground and rejects a drainage plane steeper than repose", () => {
    const d = drainageProfile({ ...defaults, drainageGrade: 0 });
    expect(d.rise).toBe(0);
    expect(d.lowCrest).toBe(d.highCrest);
    expect(
      inputsSchema.safeParse({ ...defaults, drainageGrade: 10, reposeAngle: 2 })
        .success,
    ).toBe(false);
  });
});
