"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { indicativeCosts } from "@/engine/analysis";
import { scenarioNames, type SimulationResults } from "@/types/model";
import { compact, number } from "@/utils/format";
export function CostComparison({ results }: { results: SimulationResults[] }) {
  const data = results.map((result) => {
    const costs = indicativeCosts(result.inputs);
    return {
      name: scenarioNames[result.inputs.scenario],
      knownSubtotal: costs.knownSubtotal,
      complete: costs.total !== null,
      unknown: costs.rows.filter((r) => r.value === null).length,
    };
  });
  return (
    <section className="analytics">
      <div className="analytics-heading">
        <span className="eyebrow">INDICATIVE COST COMPARISON</span>
        <span className="muted">Entered assumptions only · USD</span>
      </div>
      {data.every((d) => d.knownSubtotal === 0 && !d.complete) ? (
        <p className="comparison-note" style={{ padding: "10px 20px 20px" }}>
          Enter cost assumptions under Economics to compare costs. No prices
          have been assumed; incomplete scenarios have no total cost.
        </p>
      ) : (
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ left: 20, right: 20, bottom: 20 }}>
              <CartesianGrid stroke="#354b2e" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="#8ba777"
                fontSize={10}
                interval={0}
              />
              <YAxis
                tickFormatter={(v) => `$${compact(v)}`}
                stroke="#8ba777"
                fontSize={10}
              />
              <Tooltip
                contentStyle={{ background: "#24301f", borderColor: "#5a7347" }}
                formatter={(value, _name, item) => [
                  `$${number(Number(value))} ${item.payload.complete ? "(complete)" : `(${item.payload.unknown} cost inputs missing)`}`,
                  "Known costs",
                ]}
              />
              <Bar
                dataKey="knownSubtotal"
                name="Known cost subtotal"
                radius={[4, 4, 0, 0]}
              >
                {data.map((d) => (
                  <Cell
                    key={d.name}
                    fill={d.complete ? "#b8d68a" : "#758a65"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="comparison-note" style={{ padding: "0 20px" }}>
            Incomplete bars show only known subtotals. They are not full project
            cost estimates.
          </p>
        </div>
      )}
    </section>
  );
}
