import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("live no-lift sizing reshapes geometry and exports real CAD", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByLabel("Permanent heap construction")
    .selectOption("continuous");
  const design = page.getByTestId("design-preview");
  await expect(
    page.getByRole("heading", { name: "Single pile · no lifts" }),
  ).toBeVisible();
  await expect(page.getByLabel("Pad length", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Lift height", { exact: true })).toHaveCount(0);
  const initialWidth = Number(await design.getAttribute("data-width"));
  await page.getByLabel("Total ore", { exact: true }).fill("1000000");
  // No blur or Enter: valid edits must update the geometry themselves.
  await expect
    .poll(async () => Number(await design.getAttribute("data-volume")))
    .toBeCloseTo(625000, 2);
  expect(Number(await design.getAttribute("data-width"))).toBeLessThan(
    initialWidth,
  );
  await page.getByLabel("Overall side slope", { exact: true }).fill("2");
  await expect(design).toHaveAttribute("data-slope", "2");
  await page.getByLabel("Maximum height", { exact: true }).fill("20");
  await expect(design).toHaveAttribute("data-height", "20");
  const beforeRepose = Number(await design.getAttribute("data-width"));
  await page.getByLabel("Ore angle of repose", { exact: true }).fill("12");
  await expect
    .poll(async () => Number(await design.getAttribute("data-slope")))
    .toBeGreaterThan(4.7);
  expect(Number(await design.getAttribute("data-width"))).toBeGreaterThan(
    beforeRepose,
  );
  await page.getByLabel("Drainage grade", { exact: true }).fill("3");
  await page.getByLabel("Drain toward", { exact: true }).selectOption("west");
  await expect(design).toHaveAttribute("data-grade", "3");
  await expect(design).toHaveAttribute("data-drain", "west");
  await expect(page.locator(".design-preview canvas")).toBeVisible();
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CAD" }).click();
  const dwg = await event;
  expect(dwg.suggestedFilename()).toBe("heapsim-design.dwg");
  await dwg.saveAs("test-results/heapsim-design.dwg");
  expect(
    (await readFile("test-results/heapsim-design.dwg"))
      .subarray(0, 6)
      .toString(),
  ).toBe("AC1015");
  await page.getByLabel("CAD format").selectOption("dxf");
  await page.getByLabel("CAD geometry").selectOption("day");
  const dxfEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CAD" }).click();
  const dxf = await dxfEvent;
  expect(dxf.suggestedFilename()).toMatch(/^heapsim-day-\d+\.dxf$/);
  await dxf.saveAs("test-results/heapsim-day.dxf");
  expect(await readFile("test-results/heapsim-day.dxf", "utf8")).toContain(
    "3DFACE",
  );
  expect(await readFile("test-results/heapsim-day.dxf", "utf8")).toContain(
    "CELL_GRID",
  );
  await page.screenshot({
    path: "test-results/heapsim-continuous.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByLabel("Permanent heap construction")).toHaveValue(
    "continuous",
  );
  expect(errors).toEqual([]);
});

test("real 3D geometry, synchronized selection, playback and reverse scrubbing", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByLabel("Simulation day")).toBeVisible();
  await expect(page.locator(".visualization canvas")).toBeVisible();
  await page.getByRole("button", { name: "Split view", exact: true }).click();
  const cell = page.getByTestId("cell-B4");
  await cell.click();
  await expect(cell).toHaveAttribute("data-selected", "true");
  await expect(page.locator(".cell-identity h2")).toContainText("B4");
  await expect(page.locator(".scene-cell-label")).toContainText("B4");
  const tonnes = Number(await cell.getAttribute("data-tonnes"));
  expect(tonnes).toBeGreaterThan(0);
  await expect(page.getByTestId("selected-tonnes")).toContainText(
    Math.round(tonnes).toLocaleString("en-US"),
  );
  // Ray-pick a real ore mesh from the top camera, then verify the shared 2D selection.
  await page.getByRole("button", { name: "Top", exact: true }).click();
  await page.waitForTimeout(300);
  const box = (await page.locator(".visualization canvas").boundingBox())!;
  const zoom = Math.min(box.width / (400 * 1.55), box.height / (400 * 0.98));
  await page.mouse.click(
    box.x + box.width / 2 - 75 * zoom,
    box.y + box.height / 2 - 75 * zoom,
  );
  await expect(page.getByTestId("cell-B3")).toHaveAttribute(
    "data-selected",
    "true",
  );
  await expect(page.locator(".cell-identity h2")).toContainText("B3");
  await expect(page.locator(".scene-cell-label")).toContainText("B3");
  await cell.click();
  await page.getByLabel("Simulation day", { exact: true }).fill("0");
  await expect(page.getByTestId("selected-tonnes")).toHaveText("0 t");
  await page.getByLabel("Simulation day", { exact: true }).fill("220");
  await expect(page.getByTestId("selected-tonnes")).toContainText(
    Math.round(tonnes).toLocaleString("en-US"),
  );
  await page.getByLabel("Playback speed").selectOption("20");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect
    .poll(async () =>
      Number(
        await page.getByLabel("Simulation day", { exact: true }).inputValue(),
      ),
    )
    .toBeGreaterThan(220);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const paused = await page
    .getByLabel("Simulation day", { exact: true })
    .inputValue();
  await page.waitForTimeout(700);
  await expect(page.getByLabel("Simulation day", { exact: true })).toHaveValue(
    paused,
  );
  await page.getByRole("button", { name: "3D Grid", exact: true }).click();
  await page.getByRole("button", { name: "Isometric", exact: true }).click();
  await page.getByLabel("Simulation day", { exact: true }).fill("220");
  await page.screenshot({
    path: "test-results/heapsim-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("approved inputs enable retained upper lifts and engineering sensitivity runs", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByLabel("Simulation day")).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: "Engineering validation" })
    .click();
  for (const label of [
    "Geotechnical validation",
    "Permeability tests validated",
    "Foundation validation",
  ])
    await page.getByLabel(label, { exact: true }).check();
  await page.getByLabel("Approved lift height", { exact: true }).fill("10");
  await page.getByLabel("Approved lift height", { exact: true }).press("Tab");
  await page.getByLabel("Approved overall height", { exact: true }).fill("40");
  await page
    .getByLabel("Approved overall height", { exact: true })
    .press("Tab");
  await expect(page.locator(".workspace-footer")).toContainText(
    "Operations complete",
  );
  await page.getByLabel("Jump to milestone").selectOption("end");
  await page.getByRole("button", { name: "Split view", exact: true }).click();
  await page.getByLabel("Inspect lift", { exact: true }).selectOption("2");
  await page.getByTestId("cell-B4").click();
  await expect(page.locator(".scene-cell-label")).toContainText("L2");
  await expect(page.locator(".mini-stack")).toContainText("L1");
  await expect(page.locator(".mini-stack")).toContainText("spent");
  expect(
    Number(await page.getByTestId("cell-B4").getAttribute("data-tonnes")),
  ).toBeGreaterThan(0);
  await page.getByLabel("Transparent", { exact: true }).check();
  await page.getByLabel("Exploded lifts", { exact: true }).check();
  await page.screenshot({
    path: "test-results/heapsim-upper-lifts.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sensitivity", exact: true }).click();
  await expect(page.locator(".sensitivity-panel tbody tr")).toHaveCount(5);
  await page.getByLabel("Vary one assumption").selectOption("leachDays");
  await expect(page.locator(".sensitivity-panel tbody tr")).toHaveCount(5);
  await expect(page.locator(".sensitivity-panel tbody")).toContainText(
    "complete",
  );
  expect(errors).toEqual([]);
});

test("invalid inputs are rejected; valid inputs regenerate and survive reload", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("Simulation day")).toBeVisible();
  await page.getByLabel("Stacked bulk density", { exact: true }).fill("0");
  await page.getByLabel("Stacked bulk density", { exact: true }).press("Tab");
  await expect(
    page.getByLabel("Stacked bulk density", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Stacked bulk density", { exact: true }).fill("1.6");
  await page.getByLabel("Stacked bulk density", { exact: true }).press("Tab");
  await page.getByLabel("Total ore", { exact: true }).fill("100000");
  await page.getByLabel("Total ore", { exact: true }).press("Tab");
  await expect(page.locator(".workspace-footer")).toContainText(
    "Operations complete",
  );
  await page.getByLabel("Simulation day", { exact: true }).fill("120");
  await page.getByRole("button", { name: "2D Plan", exact: true }).click();
  await page.getByLabel("Playback speed").selectOption("20");
  await page.reload();
  await expect(page.getByLabel("Total ore", { exact: true })).toHaveValue(
    "100000",
  );
  await expect(page.locator(".workspace-footer")).toContainText(
    "Operations complete",
  );
  await expect(page.getByLabel("Simulation day", { exact: true })).toHaveValue(
    "120",
  );
  await expect(
    page.getByRole("button", { name: "2D Plan", exact: true }),
  ).toHaveClass(/active/);
  await expect(page.getByLabel("Playback speed")).toHaveValue("20");
  const restored = await page.context().newPage();
  await page.close();
  await restored.goto("/");
  await expect(
    restored.getByLabel("Simulation day", { exact: true }),
  ).toHaveValue("120");
  await expect(restored.getByLabel("Total ore", { exact: true })).toHaveValue(
    "100000",
  );
});

test("scenario JSON export, import and TSF validation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Simulation day")).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const file = await downloadEvent;
  expect(file.suggestedFilename()).toBe("heapsim-scenario.json");
  await file.saveAs("test-results/saved-scenario.json");
  await page
    .getByLabel("Scenario", { exact: true })
    .selectOption("existing-tsf");
  await expect(page.getByLabel("Simulation day")).toBeVisible();
  await page.locator(".validation-panel summary").click();
  await expect(
    page.getByText("TSF INTEGRATION NOT VALIDATED", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await page
    .getByLabel("Import scenario JSON")
    .setInputFiles("test-results/saved-scenario.json");
  await expect(page.getByLabel("Scenario", { exact: true })).toHaveValue(
    "permanent",
  );
  await expect(page.getByLabel("Simulation day")).toHaveValue("0");
});

test("comparison and report are calculated from the shared assumptions", async ({
  page,
}) => {
  await page.goto("/scenarios");
  await expect(page.locator(".comparison-card")).toHaveCount(2);
  await expect(page.locator(".comparison-card .data-rows")).toHaveCount(2);
  await expect(page.locator(".comparison-card").first()).toContainText(
    "SCENARIO 01",
  );
  await expect(page.locator(".comparison-card").last()).toContainText(
    "SCENARIO 03",
  );
  await page.getByLabel("Scenario 1 construction").selectOption("continuous");
  await expect(page.locator(".comparison-card").first()).toContainText(
    "Single continuous pile",
  );
  const comparisonDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export comparison", exact: true })
    .click();
  await (await comparisonDownload).saveAs("test-results/comparison.json");
  const exported = JSON.parse(
    await readFile("test-results/comparison.json", "utf8"),
  );
  expect(Object.keys(exported).sort()).toEqual(["new-tsf", "permanent"]);
  await page.getByLabel("Scenario 1 construction").selectOption("lifts");
  await expect(page.locator(".comparison-card").first()).toContainText(
    "Lift stacking",
  );
  await page.getByLabel("Comparison simulation day").fill("300");
  await expect(page.locator(".comparison-scene canvas")).toHaveCount(2);
  await page
    .getByRole("link", { name: "Engineering report", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Material & solution balance" }),
  ).toBeVisible();
  await expect(page.locator(".report-banner")).toContainText("STALLED");
  const reportEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Daily CSV" }).click();
  expect((await reportEvent).suggestedFilename()).toBe(
    "heapsim-daily-results.csv",
  );
});

test("WebGL fallback remains interactive on a narrow screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type === "webgl2" || type === "webgl") return null;
      return original.apply(this, [type, ...args] as Parameters<
        typeof original
      >);
    } as typeof original;
  });
  await page.goto("/");
  await expect(
    page.getByText("WebGL is unavailable.", { exact: false }),
  ).toBeVisible();
  await page.getByTestId("cell-B4").click();
  await expect(page.locator(".cell-identity h2")).toContainText("B4");
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: "test-results/heapsim-mobile.png",
    fullPage: true,
  });
});
