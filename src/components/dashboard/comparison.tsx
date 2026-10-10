"use client";
import { useMemo, useState } from "react";
import { Download, ArrowLeftRight } from "lucide-react";
import { Header } from "./header";
import { SceneOrFallback } from "./workspace";
import { useProject } from "@/store/use-project";
import { useSimulation } from "@/store/use-simulation";
import {
  scenarioNames,
  type Scenario,
  type SimulationResults,
  type ProjectInputs,
} from "@/types/model";
import { snapshotAt } from "@/engine/simulation";
import {
  disposalFootprint,
  indicativeCosts,
  reportData,
  totalLand,
} from "@/engine/analysis";
import { compact, download, number } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { CostComparison } from "@/components/charts/cost-comparison";
const scenarios: Scenario[] = ["permanent", "dry", "new-tsf", "existing-tsf"];
function useScenario(inputs: ProjectInputs, scenario: Scenario) {
  return useSimulation(
    useMemo(() => ({ ...inputs, scenario }), [inputs, scenario]),
  );
}
function ComparisonCard({
  result,
  scenario,
  busy,
  error,
}: {
  result: SimulationResults | null;
  scenario: Scenario;
  busy: boolean;
  error: string | null;
}) {
  if (!result)
    return (
      <section className="comparison-card">
        <header>
          <span className="eyebrow">
            SCENARIO {scenarios.indexOf(scenario) + 1}
          </span>
          <h2>{scenarioNames[scenario]}</h2>
        </header>
        <div className="card-status">
          {error ?? (busy ? "Calculating daily schedule…" : "No results")}
        </div>
      </section>
    );
  const p = result.inputs,
    final = result.frames.at(-1)!.metrics,
    costs = indicativeCosts(p);
  const rows: [string, string][] = [
    ["Pad footprint", `${number((p.length * p.width) / 10000, 2)} ha`],
    ["Total new land", `${number(totalLand(p) / 10000, 2)} ha`],
    [
      "Peak ore on pad",
      `${compact(Math.max(...result.frames.map((f) => f.metrics.stored)))} t`,
    ],
    [
      "Peak height",
      `${number(Math.max(...result.frames.map((f) => f.metrics.height)), 1)} m`,
    ],
    [
      "Operating cells",
      `${result.cells.filter((c) => !p.blockedCells.includes(c.id)).length}`,
    ],
    [
      "Stacking duration",
      result.stackingCompleteDay
        ? `${number(result.stackingCompleteDay)} days`
        : "Not reached",
    ],
    [
      "Completion",
      result.completionDay
        ? `Day ${number(result.completionDay)}`
        : result.status,
    ],
    ["Ore rehandled", `${compact(final.removed)} t`],
    [
      "Haul requirement",
      `${compact(final.removed * p.transportDistance)} t·km`,
    ],
    ["Spent storage", `${compact(final.disposal / p.disposalDensity)} m³`],
    [
      "Pad construction",
      costs.rows[0].value === null
        ? "Not supplied"
        : `$${compact(costs.rows[0].value)}`,
    ],
    [
      "Disposal construction",
      costs.rows[1].value === null
        ? "Not supplied"
        : `$${compact(costs.rows[1].value)}`,
    ],
    [
      "Rehandling cost",
      costs.rows[3].value === null
        ? "Not supplied"
        : `$${compact(costs.rows[3].value)}`,
    ],
    [
      "Closure allowance",
      p.closureCost === null ? "Not supplied" : `$${compact(p.closureCost)}`,
    ],
    [
      "Indicative total cost",
      costs.total === null ? "Inputs incomplete" : `$${compact(costs.total)}`,
    ],
  ];
  return (
    <section className="comparison-card">
      <header>
        <span className="eyebrow">
          SCENARIO 0{scenarios.indexOf(scenario) + 1}
        </span>
        <h2>{scenarioNames[scenario]}</h2>
      </header>
      <dl className="data-rows">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="card-status">{result.reason}</div>
      {result.warnings
        .filter((w) =>
          ["capacity", "tsf", "new-disposal", "disposal-capacity"].includes(
            w.code,
          ),
        )
        .map((w) => (
          <div key={w.code} className={`warning ${w.severity}`}>
            <b>{w.title}</b>
          </div>
        ))}
    </section>
  );
}
export function Comparison() {
  const inputs = useProject((s) => s.inputs),
    [day, setDay] = useState(220),
    [right, setRight] = useState<Scenario>("dry");
  const permanent = useScenario(inputs, "permanent"),
    dry = useScenario(inputs, "dry"),
    newTsf = useScenario(inputs, "new-tsf"),
    existing = useScenario(inputs, "existing-tsf");
  const models = {
    permanent,
    dry,
    "new-tsf": newTsf,
    "existing-tsf": existing,
  };
  const maxDay = Math.max(
    0,
    ...Object.values(models).map((m) => (m.result?.frames.length ?? 1) - 1),
  );
  const leftResult = permanent.result,
    rightResult = models[right].result;
  const leftSnapshot = useMemo(
    () => (leftResult ? snapshotAt(leftResult, day) : null),
    [leftResult, day],
  );
  const rightSnapshot = useMemo(
    () => (rightResult ? snapshotAt(rightResult, day) : null),
    [rightResult, day],
  );
  return (
    <>
      <Header />
      <main className="document-page">
        <div className="document-heading">
          <div>
            <span className="eyebrow">ENGINEERING / ALTERNATIVES ANALYSIS</span>
            <h1>One orebody. Four operating plans.</h1>
            <p>
              Common feed, calendars, physical assumptions and engineering
              clearances. Independent, deterministic schedules.
            </p>
          </div>
          <Button
            onClick={() =>
              download(
                "heapsim-comparison.json",
                Object.fromEntries(
                  Object.entries(models)
                    .filter(([, m]) => m.result)
                    .map(([key, m]) => [key, reportData(m.result!)]),
                ),
              )
            }
            disabled={Object.values(models).some((m) => m.busy)}
          >
            <Download size={14} /> Export comparison
          </Button>
        </div>
        <div className="comparison-grid">
          {scenarios.map((s) => (
            <ComparisonCard key={s} scenario={s} {...models[s]} />
          ))}
        </div>
        <CostComparison
          results={Object.values(models).flatMap((m) =>
            m.result ? [m.result] : [],
          )}
        />
        <div className="comparison-controls">
          <ArrowLeftRight size={17} />
          <span>
            Shared date <b>DAY {number(Math.min(day, maxDay))}</b>
          </span>
          <input
            aria-label="Comparison simulation day"
            type="range"
            min={0}
            max={maxDay}
            value={Math.min(day, maxDay)}
            onChange={(e) => setDay(Number(e.target.value))}
          />
          <span>D{number(maxDay)}</span>
        </div>
        <div className="compare-scenes">
          <section className="comparison-scene">
            <header>
              Permanent multi-lift heap <span>Day {Math.min(day, maxDay)}</span>
            </header>
            {leftResult && leftSnapshot ? (
              <SceneOrFallback
                result={leftResult}
                snapshot={leftSnapshot}
                comparison
              />
            ) : (
              <div className="loading-scene">Calculating…</div>
            )}
          </section>
          <section className="comparison-scene">
            <header>
              <select
                aria-label="Right comparison scenario"
                value={right}
                onChange={(e) => setRight(e.target.value as Scenario)}
              >
                {scenarios.slice(1).map((s) => (
                  <option key={s} value={s}>
                    {scenarioNames[s]}
                  </option>
                ))}
              </select>
              <span>Day {Math.min(day, maxDay)}</span>
            </header>
            {rightResult && rightSnapshot ? (
              <SceneOrFallback
                result={rightResult}
                snapshot={rightSnapshot}
                comparison
              />
            ) : (
              <div className="loading-scene">Calculating…</div>
            )}
          </section>
        </div>
        <p className="comparison-note">
          Each scene holds its final recorded state after its schedule ends. A
          stalled schedule is not treated as complete. On-off scenarios use one
          reusable lift; permanent scenarios retain their lower lifts. Existing
          TSF land is excluded from new land, but storage capacity and all
          entered handling costs still apply.
        </p>
      </main>
    </>
  );
}
