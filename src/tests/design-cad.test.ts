import { describe, it, expect } from "vitest";
import { defaults, inputsSchema } from "@/types/model";
import {
  continuousPile,
  effectiveSlope,
  groundElevation,
  envelopeVolume,
  meshVolume,
  resolveInputs,
} from "@/engine/geometry";
import { heapDesign } from "@/engine/design";
import {
  designDrawing,
  snapshotDrawing,
  drawingDxf,
  type CadDrawing,
} from "@/engine/cad";
import { simulate, snapshotAt } from "@/engine/simulation";

function cadVolume(drawing: CadDrawing) {
  return Math.abs(
    drawing.faces.reduce(
      (sum, { vertices: [a, b, c] }) =>
        sum +
        a[0] * (b[1] * c[2] - b[2] * c[1]) +
        a[1] * (b[2] * c[0] - b[0] * c[2]) +
        a[2] * (b[0] * c[1] - b[1] * c[0]),
      0,
    ) / 6,
  );
}
describe("continuous pile sizing", () => {
  it.each([0, 1.5, 3, 6])(
    "conserves full project volume at slope %s",
    (slope) => {
      const p = { ...defaults, stackingMode: "continuous" as const, slope };
      const d = heapDesign(p);
      expect(d.volume).toBeCloseTo(p.oreTonnes / p.density, 5);
      expect(meshVolume(d.mesh)).toBeCloseTo(d.volume, 5);
      expect(d.height).toBeLessThanOrEqual(p.maxHeight);
      expect(d.inputs.maxLifts).toBe(1);
      expect(d.inputs.length / d.inputs.width).toBeCloseTo(p.aspectRatio, 10);
    },
  );
  it.each([0.5, 1, 2])(
    "fits a small pile below the height cap, aspect %s",
    (aspectRatio) => {
      const p = {
        ...defaults,
        oreTonnes: 1600,
        aspectRatio,
        stackingMode: "continuous" as const,
      };
      const d = continuousPile(p);
      expect(d.height).toBeLessThan(p.maxHeight);
      expect(envelopeVolume(d.length, d.width, d.height, p.slope)).toBeCloseTo(
        1000,
        7,
      );
      expect(cadVolume(designDrawing(p))).toBeCloseTo(1000, 7);
    },
  );
  it("responds to ore, density, slope and height without using lift count", () => {
    const p = { ...defaults, stackingMode: "continuous" as const };
    const base = continuousPile(p);
    expect(
      continuousPile({ ...p, oreTonnes: p.oreTonnes * 2 }).area,
    ).toBeGreaterThan(base.area);
    expect(continuousPile({ ...p, density: p.density * 2 }).area).toBeLessThan(
      base.area,
    );
    expect(continuousPile({ ...p, slope: 4 }).area).toBeGreaterThan(base.area);
    expect(continuousPile({ ...p, maxHeight: 10 }).area).toBeGreaterThan(
      base.area,
    );
    expect(continuousPile({ ...p, liftHeight: 1, maxLifts: 1 })).toEqual(base);
  });
  it("completes a single pile with no upper-lift approvals and preserves mass", () => {
    const p = {
      ...defaults,
      stackingMode: "continuous" as const,
      oreTonnes: 100000,
      approvedLiftHeight: 1,
    };
    const r = simulate(p),
      last = snapshotAt(r, 20000);
    expect(r.status).toBe("complete");
    expect(r.segments.every((s) => s.lift === 1)).toBe(true);
    expect(last.metrics.stored).toBeCloseTo(p.oreTonnes, 4);
    expect(cadVolume(snapshotDrawing(r, last))).toBeCloseTo(
      p.oreTonnes / p.density,
      3,
    );
    expect(r.warnings.some((w) => w.code === "overstack")).toBe(false);
    expect(inputsSchema.safeParse(resolveInputs(p)).success).toBe(true);
  });
  it("loads older saved scenarios as lift stacking", () => {
    const { stackingMode, ...old } = defaults;
    expect(inputsSchema.parse(old).stackingMode).toBe("lifts");
  });
});
describe("CAD geometry", () => {
  it("exports each cell and lift on separate CAD layers", () => {
    const d = designDrawing(defaults);
    const layers = new Set(d.faces.map((f) => f.layer));
    expect(layers.has("HEAP_A1_L1")).toBe(true);
    expect(layers.has("HEAP_B4_L2")).toBe(true);
    expect(d.lines.some((l) => l.layer === "CELL_GRID")).toBe(true);
    expect(d.labels.some((l) => l.value === "B4")).toBe(true);
  });
  it("respects repose and drainage grade without changing ore volume", () => {
    const p = {
      ...defaults,
      stackingMode: "continuous" as const,
      oreTonnes: 1000000,
      slope: 1,
      reposeAngle: 20,
      drainageGrade: 3,
      drainageDirection: "east" as const,
    };
    const d = designDrawing(p);
    expect(effectiveSlope(p)).toBeCloseTo(
      1 / (Math.tan((20 * Math.PI) / 180) - 0.03),
      10,
    );
    expect(d.inputs.slope).toBeCloseTo(effectiveSlope(p), 10);
    expect(groundElevation(d.inputs, 0, 0)).toBeCloseTo(
      d.inputs.length * 0.03,
      8,
    );
    expect(groundElevation(d.inputs, d.inputs.length, 0)).toBe(0);
    expect(cadVolume(d)).toBeCloseTo(p.oreTonnes / p.density, 3);
    const ground = d.lines
      .filter((l) => l.layer === "CELL_GRID")
      .flatMap((l) => [l.start, l.end]);
    expect(Math.max(...ground.map((p) => p[2]))).toBeCloseTo(
      d.inputs.length * 0.03,
      5,
    );
    expect(Math.min(...ground.map((p) => p[2]))).toBe(0);
  });
  it("exports the design mesh at true scale with north/up axes and metric units", () => {
    const drawing = designDrawing(defaults),
      dxf = drawingDxf(drawing);
    const points = drawing.faces.flatMap((f) => f.vertices);
    expect(Math.max(...points.map((p) => p[0]))).toBe(defaults.length);
    expect(Math.min(...points.map((p) => p[1]))).toBe(-defaults.width);
    expect(Math.max(...points.map((p) => p[2]))).toBeCloseTo(
      defaults.maxHeight +
        (defaults.drainageGrade *
          (defaults.width - defaults.slope * defaults.maxHeight)) /
          100,
      6,
    );
    expect(cadVolume(drawing)).toBeCloseTo(heapDesign(defaults).volume, 5);
    expect(dxf).toContain("$INSUNITS\n70\n6\n");
    expect(dxf.match(/\n3DFACE\n/g)).toHaveLength(drawing.faces.length);
  });
  it("exports actual partial-day tonnes, independent of display offsets", () => {
    const r = simulate({ ...defaults, oreTonnes: 100000 });
    const s = snapshotAt(r, 10);
    expect(cadVolume(snapshotDrawing(r, s))).toBeCloseTo(
      s.metrics.stored / defaults.density,
      3,
    );
    expect(snapshotDrawing(r, snapshotAt(r, 0)).faces).toHaveLength(0);
  });
  it("includes actual disposal with its separate density", () => {
    const r = simulate({
      ...defaults,
      scenario: "new-tsf",
      oreTonnes: 100000,
      disposalDensity: 2,
    });
    const s = snapshotAt(r, 20000),
      d = snapshotDrawing(r, s);
    expect(d.faces.some((f) => f.layer === "DISPOSAL")).toBe(true);
    expect(cadVolume(d)).toBeCloseTo(
      s.metrics.stored / defaults.density + s.metrics.disposal / 2,
      3,
    );
  });
});
