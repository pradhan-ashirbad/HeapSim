"use client";
import { Download, Printer, FileText } from "lucide-react";
import { Header } from "./header";
import { useProject } from "@/store/use-project";
import { useSimulation } from "@/store/use-simulation";
import {
  engineeringWarnings,
  indicativeCosts,
  landComponents,
  reportData,
  totalLand,
} from "@/engine/analysis";
import { compact, download, number } from "@/utils/format";
import { scenarioNames } from "@/types/model";
import { Button } from "@/components/ui/button";
export function Report() {
  const inputs = useProject((s) => s.inputs),
    { result, busy, error } = useSimulation(inputs);
  const p = result?.inputs ?? inputs;
  const costs = indicativeCosts(p),
    land = landComponents(p),
    final = result?.frames.at(-1)!.metrics;
  const rows = (values: [string, string][]) => (
    <dl className="data-rows">
      {values.map(([key, value]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
  const csv = () => {
    if (!result) return;
    const keys = Object.keys(
      result.frames[0].metrics,
    ) as (keyof (typeof result.frames)[0]["metrics"])[];
    download(
      "heapsim-daily-results.csv",
      [
        "day," + keys.join(","),
        ...result.frames.map((f) =>
          [f.day, ...keys.map((key) => f.metrics[key])].join(","),
        ),
      ].join("\n"),
    );
  };
  return (
    <>
      <Header result={result} />
      <main className="document-page">
        <div className="document-heading">
          <div>
            <span className="eyebrow">PROJECT / ENGINEERING RECORD</span>
            <h1>{p.projectName}</h1>
            <p>
              {scenarioNames[p.scenario]} · Illustrative planning assessment
            </p>
          </div>
          <div className="report-actions">
            <Button onClick={() => window.print()}>
              <Printer size={14} /> Print / PDF
            </Button>
            <Button disabled={!result} onClick={csv}>
              <Download size={14} /> Daily CSV
            </Button>
            <Button
              disabled={!result}
              variant="default"
              onClick={() =>
                result && download("heapsim-report.json", reportData(result))
              }
            >
              <Download size={14} /> JSON report
            </Button>
          </div>
        </div>
        {!result || !final ? (
          <div className="model-loading">
            <FileText size={30} />
            <p>{error ?? "Calculating engineering report…"}</p>
          </div>
        ) : (
          <>
            <div className="report-banner">
              <b>Schedule: {result.status.toUpperCase()}</b>
              <p>{result.reason}</p>
              <div className="validation-matrix">
                {[
                  [
                    "Geometrically possible",
                    result.warnings.some((w) =>
                      ["capacity", "slope", "height"].includes(w.code),
                    )
                      ? "Constraint failed"
                      : "Envelope fits",
                  ],
                  [
                    "Operationally schedulable",
                    result.status === "complete"
                      ? "Completed in model"
                      : "Not established",
                  ],
                  [
                    "Metallurgically validated",
                    p.metallurgical &&
                    p.goldGrade !== null &&
                    p.recovery !== null
                      ? "User attested"
                      : "Not validated",
                  ],
                  [
                    "Geotechnically validated",
                    p.geotech && p.foundation && p.permeability
                      ? "User attested"
                      : "Not validated",
                  ],
                  [
                    "Hydraulically validated",
                    p.linerCapacity !== null && p.pumpCapacity !== null
                      ? "Capacity inputs entered; model uncalibrated"
                      : "Not validated",
                  ],
                  [
                    "Environmentally approved",
                    p.environmental ? "User attested" : "Not recorded",
                  ],
                ].map(([label, status]) => (
                  <div key={label}>
                    {label}
                    <b>{status}</b>
                  </div>
                ))}
              </div>
            </div>
            <div className="report-grid">
              <section className="report-panel">
                <h2>Ore, geometry & scheduling</h2>
                {rows([
                  ["Planned ore", `${number(p.oreTonnes)} t`],
                  ["Dry bulk volume", `${number(p.oreTonnes / p.density)} m³`],
                  ["Stacked density", `${p.density} t/m³`],
                  [
                    "Pad dimensions",
                    `${number(p.length, 2)} × ${number(p.width, 2)} m`,
                  ],
                  [
                    "Geometric capacity (available cells)",
                    `${number(result.capacity)} t`,
                  ],
                  [
                    "Capacity deficit (permanent)",
                    p.scenario === "permanent"
                      ? `${number(Math.max(0, p.oreTonnes - result.capacity))} t`
                      : "Reusable batches",
                  ],
                  [
                    "Grid / segment count",
                    `${result.cells.length} / ${result.segments.length}`,
                  ],
                  [
                    "Lift / maximum height",
                    `${p.liftHeight} / ${p.maxHeight} m`,
                  ],
                  ["Overall slope", `${p.slope}H : 1V`],
                  ["Ore angle of repose", `${p.reposeAngle}°`],
                  [
                    "Drainage grade",
                    `${p.drainageGrade}% toward ${p.drainageDirection}`,
                  ],
                  [
                    "Minimum stacking operating days",
                    number(Math.ceil(p.oreTonnes / p.stackingRate)),
                  ],
                  [
                    "Actual production days",
                    number(final.stackingOperatingDays),
                  ],
                  [
                    "Final stacking day",
                    result.stackingCompleteDay === null
                      ? "Not reached"
                      : number(result.stackingCompleteDay),
                  ],
                  [
                    "Operations complete day",
                    result.completionDay === null
                      ? "Not reached"
                      : number(result.completionDay),
                  ],
                ])}
              </section>
              <section className="report-panel">
                <h2>Material & solution balance</h2>
                {rows([
                  ["Cumulative stacked", `${number(final.stacked)} t`],
                  ["Retained on leach pad", `${number(final.stored)} t`],
                  ["Active leach inventory", `${number(final.active)} t`],
                  ["Spent on pad", `${number(final.spent)} t`],
                  ["Cumulative removed", `${number(final.removed)} t`],
                  [
                    "External disposal inventory",
                    `${number(final.disposal)} t`,
                  ],
                  ["Remaining fresh ore", `${number(final.remaining)} t`],
                  ["Total accounted", `${number(final.accounted)} t`],
                  ["Mass error", `${number(final.massError, 6)} t`],
                  ["Applied leach solution", `${number(final.solution)} m³`],
                  [
                    "Peak solution demand",
                    `${number(Math.max(...result.frames.map((f) => f.metrics.flow)), 1)} m³/h`,
                  ],
                  [
                    "Gold grade",
                    p.goldGrade === null
                      ? "Not supplied"
                      : `${p.goldGrade} g/t`,
                  ],
                  [
                    "Recovery",
                    p.recovery === null
                      ? "Not supplied"
                      : `${p.recovery}% (user input)`,
                  ],
                ])}
                <p className="comparison-note">
                  Stored + disposal + unstacked ore = planned ore. Removed ore
                  and disposal inventory are the same material and are never
                  added twice. Applied solution is a leach application total;
                  rinse water, recirculation and water balance require separate
                  inputs/models.
                </p>
              </section>
              <section className="report-panel">
                <h2>Land requirement</h2>
                {rows(land.map((r) => [r.name, `${number(r.area)} m²`]))}
                <div className="cost-total">
                  <span>Total new land</span>
                  <span>{number(totalLand(p) / 10000, 2)} ha</span>
                </div>
                <p className="comparison-note">
                  {number(totalLand(p))} m² ·{" "}
                  {number(totalLand(p) / 4046.8564224, 2)} acres. Allowance
                  inputs are treated as mutually exclusive additions.
                </p>
              </section>
              <section className="report-panel">
                <h2>Indicative costs</h2>
                {rows(
                  costs.rows.map((r) => [
                    r.name,
                    r.value === null ? "Not supplied" : `$${number(r.value)}`,
                  ]),
                )}
                <div className="cost-total">
                  <span>Total indicative cost</span>
                  <span>
                    {costs.total === null
                      ? "Incomplete"
                      : `$${number(costs.total)}`}
                  </span>
                </div>
                <p className="comparison-note">
                  Known subtotal: ${number(costs.knownSubtotal)}. Values are
                  user-entered planning assumptions. Missing costs remain
                  unknown, not zero. Existing TSF modifications use a lump-sum
                  disposal cost; new facilities use $/m².
                </p>
              </section>
              <section className="report-panel wide">
                <h2>Engineering findings & model limits</h2>
                <div className="warning-list">
                  {result.warnings.map((w) => (
                    <div key={w.code} className={`warning ${w.severity}`}>
                      <b>{w.title}</b>
                      <p>{w.detail}</p>
                    </div>
                  ))}
                </div>
                <p className="comparison-note">
                  Calendar year = 365 days; production days are evenly
                  distributed. Leach cycles count irrigated calendar days;
                  setup/rinse/drain/preparation are calendar holds. Rectangular
                  slope-envelope solids are integrated exactly between grid
                  intersections; mesh volume tolerance is 1 × 10⁻⁵ relative
                  after GPU float32 conversion. Daily updates use a 10⁻⁵ t
                  material threshold. Hydraulics are conceptual, and recorded
                  approvals are user attestations. No gold revenue or calibrated
                  seepage/stability results are inferred.
                </p>
              </section>
            </div>
          </>
        )}
      </main>
    </>
  );
}
