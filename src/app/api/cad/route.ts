import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { inputsSchema } from "@/types/model";
import { designDrawing, snapshotDrawing, drawingDxf } from "@/engine/cad";
import { simulate, snapshotAt } from "@/engine/simulation";
export const runtime = "nodejs";
export const maxDuration = 60;
const run = promisify(execFile);
const requestSchema = z.object({
  inputs: inputsSchema,
  scope: z.enum(["design", "day"]),
  format: z.enum(["dwg", "dxf"]),
  day: z.number().int().min(0).max(20000),
});

export async function POST(request: Request) {
  let directory: string | undefined;
  try {
    const body = await request.text();
    if (body.length > 100_000)
      return Response.json(
        { error: "CAD request exceeds 100 KB." },
        { status: 413 },
      );
    const parsed = requestSchema.safeParse(JSON.parse(body));
    if (!parsed.success)
      return Response.json(
        { error: "Invalid geometry inputs. Review the model parameters." },
        { status: 400 },
      );
    const { inputs, scope, format, day } = parsed.data;
    let drawing;
    if (scope === "design") drawing = designDrawing(inputs);
    else {
      const result = simulate(inputs);
      drawing = snapshotDrawing(result, snapshotAt(result, day));
    }
    const dxf = drawingDxf(drawing);
    const headers = {
      "Content-Disposition": `attachment; filename="heapsim-${scope === "design" ? "design" : `day-${day}`}.${format}"`,
      "Cache-Control": "no-store",
    };
    if (format === "dxf")
      return new Response(dxf, {
        headers: { ...headers, "Content-Type": "application/dxf" },
      });
    if (process.platform !== "linux" || process.arch !== "x64")
      return Response.json(
        {
          error:
            "DWG export requires the Linux x64 deployment. Download DXF here or use the deployed app.",
        },
        { status: 503 },
      );
    directory = await mkdtemp(path.join(tmpdir(), "heapsim-cad-"));
    const inputFile = path.join(directory, "heap.dxf"),
      outputFile = path.join(directory, "heap.dwg");
    await writeFile(inputFile, dxf);
    await run(
      path.join(process.cwd(), "vendor/libredwg/dxf2dwg"),
      ["-y", "--as", "r2000", "-o", outputFile, inputFile],
      { timeout: 20_000, maxBuffer: 1_000_000 },
    );
    const data = await readFile(outputFile);
    if (data.subarray(0, 6).toString() !== "AC1015")
      throw new Error("Invalid DWG output");
    return new Response(data, {
      headers: { ...headers, "Content-Type": "image/vnd.dwg" },
    });
  } catch (e) {
    if (e instanceof SyntaxError)
      return Response.json({ error: "Invalid JSON request." }, { status: 400 });
    return Response.json(
      {
        error:
          "CAD export could not finish. Check grid limits or download the full design as DXF.",
      },
      { status: 500 },
    );
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}
