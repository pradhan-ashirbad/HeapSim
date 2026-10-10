import { beforeAll, describe, expect, it } from "vitest";
import { LibreDwg, Dwg_File_Type } from "@mlightcad/libredwg-web";
import { POST } from "@/app/api/cad/route";
import { defaults } from "@/types/model";
import { designDrawing } from "@/engine/cad";

describe.skipIf(process.platform !== "linux" || process.arch !== "x64")(
  "CAD endpoint and independent DWG decoding",
  () => {
    let reader: Awaited<ReturnType<typeof LibreDwg.create>>;
    beforeAll(async () => {
      reader = await LibreDwg.create(
        `${process.cwd()}/node_modules/@mlightcad/libredwg-web/wasm/`,
      );
    });
    it("round-trips every design face, layer and model-space ownership", async () => {
      const inputs = {
        ...defaults,
        stackingMode: "continuous" as const,
        oreTonnes: 1000000,
        maxHeight: 20,
        slope: 1,
        reposeAngle: 20,
        drainageGrade: Math.tan((2 * Math.PI) / 180) * 100,
      };
      const response = await POST(
        new Request("http://localhost/api/cad", {
          method: "POST",
          body: JSON.stringify({
            inputs,
            scope: "design",
            format: "dwg",
            day: 0,
          }),
        }),
      );
      expect(response.status).toBe(200);
      const buffer = await response.arrayBuffer();
      expect(new TextDecoder().decode(buffer.slice(0, 6))).toBe("AC1015");
      const ptr = reader.dwg_read_data(buffer, Dwg_File_Type.DWG)!;
      expect(ptr).toBeTruthy();
      try {
        const db = reader.convert(ptr);
        const faces = db.entities.filter((e) => e.type === "3DFACE");
        const expected = designDrawing(inputs).faces;
        expect(faces).toHaveLength(expected.length);
        expect(faces.every((f) => /^HEAP_[A-Z]+\d+_L\d+$/.test(f.layer))).toBe(
          true,
        );
        expect(new Set(faces.map((f) => f.layer)).size).toBeGreaterThan(1);
        expect(
          db.entities
            .filter((e) => e.type === "TEXT")
            .some((e) => e.layer === "CELL_LABELS"),
        ).toBe(true);
        for (const layer of [
          "DRAINAGE_GRADE",
          "DRAINAGE_DIMENSIONS",
          "DESIGN_SECTION",
        ])
          expect(
            db.entities.some((e) => e.type === "LINE" && e.layer === layer),
          ).toBe(true);
        const notes = db.entities.filter(
          (e) => e.type === "TEXT" && e.layer === "DRAINAGE_NOTES",
        );
        expect(notes.length).toBe(
          designDrawing(inputs).labels.filter(
            (l) => l.layer === "DRAINAGE_NOTES",
          ).length,
        );
        expect(JSON.stringify(notes)).toContain("2.000 deg");
        expect(JSON.stringify(notes)).toContain("Repose limit 20.000 deg");
        const model = db.tables.BLOCK_RECORD.entries.filter(
          (b) => b.name === "*Model_Space",
        );
        expect(model).toHaveLength(1);
        expect(
          faces.every((f) => f.ownerBlockRecordSoftId === model[0].handle),
        ).toBe(true);
        expect(new Set(db.entities.map((e) => e.handle)).size).toBe(
          db.entities.length,
        );
        expect(db.header.INSUNITS).toBe(6);
        const signature = (points: number[][]) =>
          points
            .map((p) => p.map((v) => v.toFixed(6)).join(","))
            .sort()
            .join(";");
        const actual = faces
          .map((f) => {
            const face = f as typeof f & {
              corner1: { x: number; y: number; z: number };
              corner2: { x: number; y: number; z: number };
              corner3: { x: number; y: number; z: number };
            };
            return signature(
              [face.corner1, face.corner2, face.corner3].map((p) => [
                p.x,
                p.y,
                p.z,
              ]),
            );
          })
          .sort();
        expect(actual).toEqual(
          expected.map((f) => signature(f.vertices)).sort(),
        );
      } finally {
        reader.dwg_free(ptr);
      }
    });
    it("rejects invalid geometry instead of running the converter", async () => {
      const response = await POST(
        new Request("http://localhost/api/cad", {
          method: "POST",
          body: JSON.stringify({
            inputs: { ...defaults, density: 0 },
            scope: "design",
            format: "dwg",
            day: 0,
          }),
        }),
      );
      expect(response.status).toBe(400);
    });
  },
);
