"use client";
import { useEffect, useState } from "react";
import type { ProjectInputs } from "@/types/model";
import type {
  runSensitivity,
  SensitivityDimension,
} from "@/engine/sensitivity";
import {
  ResponsiveContainer,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Line,
  Legend,
} from "recharts";
import { number } from "@/utils/format";
const dimensions: [SensitivityDimension, string][] = [
  ["maxHeight", "Maximum height (m)"],
  ["liftHeight", "Lift height (m)"],
  ["leachDays", "Leach cycle (days)"],
  ["density", "Stacked density (t/m³)"],
];
export function SensitivityPanel({ inputs }: { inputs: ProjectInputs }) {
  const [dimension, setDimension] = useState<SensitivityDimension>("maxHeight"),
    [data, setData] = useState<ReturnType<typeof runSensitivity> | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    setData(null);
    setError("");
    const worker = new Worker(
      new URL("../../engine/simulation.worker.ts", import.meta.url),
    );
    worker.onmessage = (e) => {
      if (e.data.error) setError(e.data.error);
      else setData(e.data.result);
    };
    worker.onerror = (e) => setError(e.message);
    worker.postMessage({ id: 1, kind: "sensitivity", inputs, dimension });
    return () => worker.terminate();
  }, [inputs, dimension]);
  return (
    <div className="sensitivity-panel">
      <div className="sensitivity-controls">
        <label htmlFor="sensitivity-dimension">Vary one assumption</label>
        <select
          id="sensitivity-dimension"
          value={dimension}
          onChange={(e) => setDimension(e.target.value as SensitivityDimension)}
        >
          {dimensions.map(([key, name]) => (
            <option key={key} value={key}>
              {name}
            </option>
          ))}
        </select>
        <span>
          60–140% of the current input · all other constraints retained
        </span>
      </div>
      {!data ? (
        <p className="comparison-note">
          {error || "Running five independent daily schedules…"}
        </p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data}>
              <CartesianGrid stroke="#30432b" vertical={false} />
              <XAxis dataKey="value" stroke="#809574" fontSize={10} />
              <YAxis stroke="#809574" fontSize={10} />
              <Tooltip
                contentStyle={{
                  background: "#1b281e",
                  borderColor: "#536b44",
                  fontSize: 11,
                }}
              />
              <Legend iconSize={6} wrapperStyle={{ fontSize: 10 }} />
              <Line
                dataKey="capacityMt"
                name="Pad capacity (Mt)"
                stroke="#b8d487"
                strokeWidth={2}
              />
              <Line
                dataKey="stackedMt"
                name="Ore stacked (Mt)"
                stroke="#77b7a0"
                strokeDasharray="4 4"
              />
            </LineChart>
          </ResponsiveContainer>
          <table className="analysis-table">
            <thead>
              <tr>
                <th>Input</th>
                <th>New land (ha)</th>
                <th>Completion day</th>
                <th>Schedule</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i}>
                  <td>{number(row.value, 2)}</td>
                  <td>{number(row.landHa, 2)}</td>
                  <td>{row.completionDay ?? "Not reached"}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
