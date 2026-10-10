# HeapSim 3D

A browser-based gold heap-leach planning application with a deterministic daily scheduler and a single physical model shared by its 2D plan, 3D solids, material accounting, timeline, charts and reports.

## Run locally

Node.js 24.x and npm are required. Dependencies are locked in `package-lock.json`.

```sh
npm ci
npm run dev
```

Open the app on port 3000. For a production build:

```sh
npm run build
npm run start
```

Do not run a production build while the development server is serving browser tests: both use `.next` assets. Stop the development server first. No database, API keys or remote fonts are required. CAD export uses the included server endpoint; DWG encoding runs a bundled Linux x64 command-line converter. The current inputs, timeline day, view and display controls auto-save in the browser's localStorage, alongside up to 20 named saves. Opening the same browser profile later restores the working session and recalculates its schedule. Clearing browser storage or using a private session removes local saves; export JSON for a portable backup.

In the cloud workspace, use the existing `/workspace/HeapSim` checkout. Each task is already isolated; do not create a Git worktree unless explicitly requested. If the default npm cache is unwritable, run `npm ci --cache /workspace/.npm-cache`.

## Deploy on Vercel

Import this repository with the repository root as the project's Root Directory. The committed `vercel.json` selects the Next.js framework, runs `npm run build`, and sets `.next` as the output directory, overriding a stale `public` output setting. Node.js is pinned to 24.x in `package.json`, matching CI.

For matching dashboard settings, select **Next.js** as the Framework Preset and remove any **Output Directory** override set to `public`. Deploy the latest `main` commit after changing settings; retrying an older deployment uses its original source configuration. No environment variables are required.

## Operating the application

- The initial project starts in **Single pile · no lifts** mode with 3,000,000 t at 1.8 t/m³, a 37.5° angle of repose and 1° drainage tilt toward the south. Its footprint is calculated from the ore volume and 40 m height cap; 50 × 50 m cells divide the work area. The input slope is 1H:1V, so repose governs the outer face. Lift height is stored as 10 m for anyone who switches to **Stack in lifts**. The timeline opens at simulated day 220; **Restart** returns to day 0.
- Edit parameters in the left sidebar; valid numeric edits commit automatically after a 350 ms pause, or immediately on blur/Enter. Invalid fields display errors and do not replace valid model inputs. The live design panel immediately regenerates the slope envelope, metre-scale measurements and volume; the operating schedule recalculates in a Web Worker. The full design preview is independent of the operating timeline and does not claim that all ore has already been stacked.
- In scenario 1, **Heap geometry → Permanent heap construction → Single pile · no lifts** is selected by default. Footprint is calculated automatically from ore tonnes, density, maximum height, side slope, measured angle of repose and footprint aspect ratio; length and width display the calculated values. The height cap is reduced to the natural apex for small piles. The resulting volume equals tonnes/density. Grid cells remain scheduling zones, without vertical lift subdivisions. Returning to **Stack in lifts** restores the entered lift parameters.
- In the operating viewer, **Download view DWG** converts and downloads the current operating day; choose **Full pile design** for the complete planned envelope. Both exports include all cells and lifts, ground slope indicators, elevation annotations and a separate true-scale planned drainage section. Camera, lift filters and exploded-view offsets do not alter the export.
- **Drainage tilt & heap elevations** beside the viewer accepts degrees and shows the equivalent percent grade, direction, high-ground rise, both planned crest elevations, and actual outer-face angles. For 300 m at 2°, grade is 3.492% and high ground is 10.476 m above the low edge datum. Crest elevations include the inward slope setbacks; the heap retains its vertical thickness above local graded ground. The browser profile labels its vertical exaggeration; the CAD profile is 1:1. Angles at or above repose are rejected.
- Set **Ore angle of repose** (degrees), **Drainage grade** (percent) and **Drain toward** under Heap geometry. The model uses the gentler of the entered overall side slope and the repose limit: `effective setback H:V = max(entered H:V, 1/(tan(repose angle) - grade/100))`. A smaller repose angle therefore widens the heap or reduces capacity. The pad and solids have a planar graded base with the collection edge as the low side. For a 300 m north-south pad at 2% southward grade, the north edge is 6 m higher. At a fixed setback, grade changes elevations while preserving ore thickness and mass. When repose governs, a steeper grade also increases the required setback so the steepest outer face remains within repose; fixed-land capacity or the automatically sized footprint changes accordingly. It does not predict actual seepage or collection performance.
- Default engineering approvals are **not** assumed. The first lift operates; upper lifts wait for geotechnical, permeability and foundation validation and approved lift/overall heights. Set these fields only to represent your supplied design assumptions. To exercise the illustrative multi-lift schedule in a development test, the tests explicitly provide those assumptions.
- Use 3D Grid, 2D Plan, Split View, Elevation, Section, Lift Inspection or Land Use. Selection is shared. The lift selector chooses an individual segment; All Lifts selects the top constructed segment. The inspector keeps all underlying permanent lift records and shows batch events for reusable cells.
- In 3D, drag to orbit, right-drag to pan and scroll to zoom. Camera presets, focus, cell labels, grid/lift boundaries, transparent upper lifts, exploded inspection, rulers and height markers are available. Exploded spacing is a display offset, never a change to physical geometry. Section mode removes whole grid rows at the central cell boundary and shows a conceptual collection path.
- The timeline supports exact day scrubbing in both directions, playback at 1/5/20/100 days per tick, day steps and milestones. Playback never performs engineering calculations; it displays immutable simulation history. A constrained endpoint is clearly distinguished from completion.
- The four scenario options are permanent multi-lift, reusable pad with dry spent storage, reusable pad with a new disposal concept, and reusable pad with existing TSF integration. On-off scenarios operate a single physical lift and preserve each bay's batch event history. All removed ore enters disposal inventory.
- The comparison page runs **scenario 1 (permanent heap)** and **scenario 3 (on-off + new disposal)** with common inputs and aligns its two scenes to a common day. Scenarios 2 and 4 are excluded from comparison cards, charts and exports; older saved scenarios remain usable in the workspace. Scenario 1 has a construction selector for lifts or automatic continuous-pile sizing. A scene holds its final state after its recorded schedule ends. Reports include validation status, balances, land, costs, JSON, daily CSV and a print/PDF layout. Analytics include current ore footprints and five-run sensitivities to lift height, maximum height, leach duration and density, without relaxing any other constraints.
- Save exports a schema-validated JSON scenario and keeps a named local copy. Load accepts scenario or report JSON with compatible inputs. Report export records the completed simulation run, not just the timeline's selected day.

## AutoCAD export

Use **Download CAD** in the live design panel. Choose **DWG** or **DXF**, and either the **Full pile design** or the **Current operating day**. DWG is genuine binary AutoCAD 2000 (`AC1015`) format, encoded by GNU LibreDWG. DXF is ASCII AutoCAD 2000 interchange. Both contain triangulated **3DFACE surface meshes**, not ACIS/parametric solids; AutoCAD can open and edit the faces or save them to a newer DWG version.

One drawing unit is **one metre** (`INSUNITS=6`). The northwest pad corner is the local plan origin, X points east, Y north and Z upward. Design export includes the full outer envelope **split into actual grid cells and lifts**; `HEAP_A1_L1` style layers contain each cell's individual 3D faces. `CELL_GRID`, `CELL_TOP_L1` style and `CELL_LABELS` layers make the cell layout visible and editable. The design envelope does not deduct blocked cells. Operating-day export includes only actual ore, named per cell and lift, plus actual disposal geometry where applicable. The graded pad base, cell outlines, label elevations and solid surfaces use the same surveyed-relative elevations in the drawing. The drawing includes the pad boundary, without schematic ponds or buildings. CAD geometry is a planning model, not a surveyed/georeferenced or approved construction drawing.

DWG export works on Linux x64, including the Vercel Node runtime. The executable is explicitly included in the Next.js function trace. Other development platforms can use DXF or the deployed DWG endpoint. Conversion uses temporary files with a 20-second process timeout and removes them afterward; no external conversion service or CAD license key is required. The browser sends model inputs to this app's server only when exporting CAD.

The separately invoked converter is GPL-3.0-or-later. Its license, provenance and rebuild instructions are in [vendor/libredwg/README.md](vendor/libredwg/README.md), with complete upstream source included in [public/third-party/libredwg-0.13.3-source.tar.gz](public/third-party/libredwg-0.13.3-source.tar.gz). Preserve the source, compatibility wrapper, build script and license when redistributing. Rebuild with `bash scripts/build-cad.sh` on Linux x64 with CMake, GCC, make and binutils installed.

## Engineering model

### Geometry

The coordinate system uses `x` east, `y` plan south from the northwest corner, and `z` elevation; Three.js receives `(x, z, y)`. The camera compass projects north (negative plan Y) into the current view. All internal quantities use metres, tonnes, cubic metres, days and m³/h. Ground elevation is 0 m.

At ore thickness `z`, the rectangular outer envelope is `[kz, L-kz] × [kz, W-kz]`, where `k` is the effective horizontal-to-vertical side slope, limited by angle of repose. Every cell's horizontal rectangle is clipped against that envelope. Cell side lengths are piecewise linear in `z`, so the cross-sectional area is piecewise quadratic. The engine inserts every slope/grid intersection and integrates exactly with Simpson's rule. The total envelope volume below height `h` is:

```
V(h) = L W h - k(L + W)h² + (4/3)k²h³
```

Height is clipped at the physical apex. A design that closes before its requested height is flagged; no ore is placed outside its envelope. The mass-to-height solver bisects this same integral. Absolute elevation adds a ground plane to ore thickness: `Z = z + drainageGrade × distanceFromCollectionEdge`. This affine tilt preserves the integrated volume. Three.js meshes and CAD faces use the same intersection levels and clipped rectangles, with cell-local vertices to preserve float32 precision. Unit tests calculate signed tetrahedron volumes from the actual rendering mesh and compare them with mass/density (target relative volume tolerance `1e-5` after GPU float32 conversion). Interior cells do not receive independent pyramidal slopes.

**The angle of repose limits the ultimate outer face, but temporary internal stacking/removal fronts are vertical prism cuts.** They remain a geometric approximation; the model does not solve the evolving angle or stability of each exposed working face. Equipment access, temporary slope design, berm geometry and inter-cell construction restrictions require a detailed layout. The graded pad conveys gravity direction but does not solve solution flow, permeability, pond capacity or stability. Reusable cells are conceptual independent operating bays. Site ponds, plant and drainage graphics are schematic placeholders; entered site areas drive the land calculation.

Permanent lifts retain all lower material. A higher segment requires the lower segment to be full and finished with leaching, rinsing and drainage, plus the explicit engineering clearances. No foundation, permeability or stability is inferred from density. Unused grid cells at the perimeter can have zero upper-lift capacity.

### Daily scheduler

Production and removal calendars distribute their entered operating days evenly over each 365-day year using a deterministic floor-difference calendar. An inclusive shutdown range can suspend both material operations; irrigation has a separate shutdown range. Day 0 is the unstacked pad; each subsequent snapshot is the state after that day's work.

At the beginning of a day, elapsed setup/rinse/drain/preparation holds release the next operation. Eligible cells receive that day's stacking budget; the last partial batch closes when the final fresh tonne is allocated. Whole irrigation zones share the minimum of the entered irrigation, pumping and liner flow capacities. Waiting zones do not gain leach days. Irrigated area is the horizontal projection of each ore segment at its base, including perimeter wedges that have no flat horizontal top. This is a conceptual slope-face application assumption; a field irrigation layout must validate it. The application rate is converted from L/m²/h to m³/h; daily applied volume is flow × effective irrigation hours. A leach day is a calendar day that received that configured application, not 24 equivalent hours. Zone order is deterministic.

Leach application, rinsing and drainage are separate states. Rinse/drain are duration holds; **rinse-water demand, recirculation, rainfall, evaporation and a full water balance are not modelled**. A zone requiring more instantaneous flow than the available capacity waits and can cause a diagnosed stall. Zero-duration holds do not add fictitious hold days; transitions are processed at day boundaries.

Reusable ore is removed only after drain completion. The removal budget and declared storage limits are enforced. A bay returns to available only after all ore has been removed and preparation is complete. Disposal has its own density, slope, height, calculated footprint and live material volume. Its ore body grows self-similarly in footprint and height while preserving the slope and mass; the ultimate design footprint is reserved in the land requirement. Existing TSF missing capacity inputs allow project-sized conceptual routing only and always produce **TSF INTEGRATION NOT VALIDATED**. Wet TSF volumes are dry-bulk equivalents, not slurry capacity predictions.

Mass accounting is `pad inventory + disposal inventory + unstacked ore = project ore`. Cumulative removed tonnes and disposal tonnes refer to the same material. Active and spent inventories are subsets of pad inventory. Status changes never transfer mass. Leaching and final drain/preparation continue after final stacking.

### Land, economics and validation

Fixed-land mode measures capacity. Fixed-ore mode solves pad width and length for the specified volume and aspect ratio; for reusable scenarios this is a conservative full-project, single-lift pad, not an optimized cyclic pad size. Infrastructure allowances are mutually exclusive additions to pad/disposal land; active irrigation is already part of the pad. Existing TSF footprint is excluded from _new_ land, not presumed cost-free. New disposal includes its explicit area allowance.

Costs are editable planning assumptions. Unknown costs stay `null`; a known subtotal is separate from a complete total. No market quotations, grade, recovery or revenue are invented. New disposal construction uses $/m²; existing TSF modifications use the same input as a lump sum, as labeled in the report.

Geometry, scheduling, metallurgy, geotechnics, hydraulics and environmental approval are reported separately. User checkboxes record attestations, not independent certification. Missing TSF requirements and incompatible wet/coarse-ore concepts remain visible even when a conceptual mass-flow schedule finishes.

## Architecture

```
src/types/model.ts              Zod schema, physical types, assumptions, states
src/engine/geometry.ts          Clipped capacities, footprint solve, rendering mesh
src/engine/simulation.ts        Daily scheduler, deltas, checkpoint replay
src/engine/analysis.ts          Land, disposal, cost, validation and report calculations
src/engine/simulation.worker.ts Browser worker entry point
src/store/                     Zustand persistence and worker lifecycle
src/components/                Inputs, 2D/3D views, timeline, inspection and charts
src/app/                       Workspace, comparison and printable report routes
src/tests/                     Engineering tests
e2e/                           Browser interaction and fallback tests
```

The engine imports neither React nor Three.js. Simulation stores daily changed segments and metrics, with bounded checkpoints for exact timeline reconstruction. Geometry is memoized and disposed, and the 3D scene renders on demand. A 5,000-segment input ceiling, 20,000-day horizon and two-million segment-day update ceiling keep interactive runs bounded. These ceilings produce explicit incomplete results rather than silent truncation. Large grids disable nonselected 3D labels above 200 cells. WebGL2 failures fall back to the same interactive 2D model.

## Tests

```sh
npm test
npm run typecheck
npm run build
npm run test:e2e
```

Playwright starts the production server when no server is running. It uses `/usr/bin/chromium` if installed, or `PLAYWRIGHT_CHROMIUM_EXECUTABLE` when supplied. Otherwise install its bundled Chromium with `npx playwright install chromium`; that requires access to Playwright's browser-download domains. Browser tests use software WebGL for reproducible rendering in the cloud.

Tests exercise analytical volumes, clipped rendering meshes, operating calendars, progressive leaching, lower-lift retention, clearances, disposal limits, all-scenario mass conservation, blocked schedules, exact replay, validation, persistence, JSON transfer, comparison, reports and the mobile 2D fallback.

## Deliberate boundaries

This release models one homogeneous ore type per project; the ore label is editable. Blended ore types, calibrated column recovery curves, actual 3D unsaturated seepage, slope-stability analysis, a full solution/water balance, irregular pads, arbitrary custom cell sequences, continuous live interpolation between daily solids, equipment routing and optimal on-off pad sizing are future modules. Continuous-pile sizing is geometric: full-depth leaching and construction stability need separate validation. Whole grid-row sections and schematic infrastructure are provided rather than a general CAD cut-plane or detailed site design. The CAD endpoint is stateless; there is no backend collaboration or database.

Planning results must retain these model assumptions when shared or exported.
