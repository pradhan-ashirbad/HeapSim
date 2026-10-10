"use client";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { type SimulationResults } from "@/types/model";
import { compact } from "@/utils/format";
import { sensitivity } from "@/engine/analysis";
import { SensitivityPanel } from "./sensitivity-panel";
const chartStyle = {
  background: "#1b2421",
  border: "1px solid #3b4840",
  borderRadius: 8,
  fontSize: 11,
  color: "#e1e5d9",
};
const tabs = [
  "Material balance",
  "Operations",
  "Land & height",
  "Height vs land",
  "Sensitivity",
];
export function Analytics({
  result,
  day,
}: {
  result: SimulationResults;
  day: number;
}) {
  const [tab, setTab] = useState(tabs[0]);
  const data = useMemo(() => {
    const stride = Math.max(1, Math.floor(result.frames.length / 250));
    return result.frames
      .filter((_, i) => i % stride === 0 || i === result.frames.length - 1)
      .map((f) => ({
        day: f.day,
        ...f.metrics,
        landHa: f.metrics.landUsed / 10000,
        occupiedHa:
          (f.metrics.padOccupiedArea + f.metrics.disposalOccupiedArea) / 10000,
      }));
  }, [result]);
  return (
    <section className="analytics">
      <div className="analytics-heading">
        <span className="eyebrow">PROJECT ANALYTICS</span>
        <div>
          {tabs.map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      {tab === "Sensitivity" ? (
        <SensitivityPanel inputs={result.inputs} />
      ) : (
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height={180}>
            {tab === "Height vs land" ? (
              <LineChart
                data={sensitivity(result.inputs)}
                margin={{ left: 0, right: 25, bottom: 4 }}
              >
                <CartesianGrid stroke="#2c3932" vertical={false} />
                <XAxis
                  dataKey="height"
                  tickFormatter={(v) => `${v} m`}
                  stroke="#718076"
                  fontSize={10}
                />
                <YAxis
                  tickFormatter={(v) => `${v} ha`}
                  stroke="#718076"
                  fontSize={10}
                />
                <Tooltip contentStyle={chartStyle} />
                <Line
                  type="monotone"
                  dataKey="hectares"
                  name="Required pad (ha)"
                  stroke="#bdd780"
                  strokeWidth={2}
                />
              </LineChart>
            ) : (
              <AreaChart data={data} margin={{ left: 0, right: 25, bottom: 0 }}>
                <defs>
                  <linearGradient id="oreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#b9d785" stopOpacity={0.2} />
                    <stop offset="1" stopColor="#b9d785" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#2c3932" vertical={false} />
                <XAxis
                  dataKey="day"
                  tickFormatter={(v) => `D${v}`}
                  stroke="#718076"
                  fontSize={10}
                  minTickGap={45}
                />
                <YAxis
                  tickFormatter={compact}
                  stroke="#718076"
                  fontSize={10}
                  width={55}
                />
                <Tooltip
                  contentStyle={chartStyle}
                  formatter={(v, name) => [
                    Number(v).toLocaleString("en-US", {
                      maximumFractionDigits: 1,
                    }),
                    name,
                  ]}
                  labelFormatter={(v) => `Day ${v}`}
                />
                <Legend
                  iconType="circle"
                  iconSize={6}
                  wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                />
                <ReferenceLine x={day} stroke="#e5deb0" strokeDasharray="3 4" />
                {tab === "Material balance" ? (
                  <>
                    <Area
                      isAnimationActive={false}
                      type="monotone"
                      dataKey="stacked"
                      name="Stacked (t)"
                      stroke="#bed78c"
                      fill="url(#oreGradient)"
                      strokeWidth={2}
                    />
                    <Area
                      isAnimationActive={false}
                      dataKey="active"
                      name="Active leach (t)"
                      stroke="#58b48a"
                      fill="transparent"
                    />
                    <Area
                      isAnimationActive={false}
                      dataKey="spent"
                      name="Spent on pad (t)"
                      stroke="#b59468"
                      fill="transparent"
                    />
                    <Area
                      isAnimationActive={false}
                      dataKey="remaining"
                      name="Remaining (t)"
                      stroke="#73867d"
                      fill="transparent"
                      strokeDasharray="4 4"
                    />
                    <Area
                      isAnimationActive={false}
                      dataKey="disposal"
                      name="Disposal (t)"
                      stroke="#d89765"
                      fill="transparent"
                    />
                  </>
                ) : tab === "Operations" ? (
                  <>
                    <Area
                      isAnimationActive={false}
                      dataKey="flow"
                      name="Flow (m³/h)"
                      stroke="#77bac4"
                      fill="transparent"
                    />
                    <Area
                      isAnimationActive={false}
                      dataKey="activeCells"
                      name="Irrigated zones (count)"
                      stroke="#bed78c"
                      fill="transparent"
                    />
                    <Area
                      isAnimationActive={false}
                      dataKey="stackingUtilization"
                      name="Stacking utilization (%)"
                      stroke="#c7a967"
                      fill="transparent"
                    />
                  </>
                ) : (
                  <>
                    <Area
                      isAnimationActive={false}
                      dataKey="height"
                      name="Heap height (m)"
                      stroke="#bed78c"
                      fill="url(#oreGradient)"
                    />
                    <Area
                      isAnimationActive={false}
                      dataKey="occupiedHa"
                      name="Ore footprint (ha)"
                      stroke="#74b7a3"
                      fill="transparent"
                    />
                    <Area
                      isAnimationActive={false}
                      dataKey="landUtilization"
                      name="Ore share of new site (%)"
                      stroke="#b99365"
                      fill="transparent"
                    />
                  </>
                )}
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
