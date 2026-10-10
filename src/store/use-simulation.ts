"use client";
import { useEffect, useState } from "react";
import type { ProjectInputs, SimulationResults } from "@/types/model";
export function useSimulation(inputs: ProjectInputs) {
  const [result, setResult] = useState<SimulationResults | null>(null);
  const [busy, setBusy] = useState(true),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setBusy(true);
    setError(null);
    setResult(null);
    let live = true;
    const worker = new Worker(
      new URL("../engine/simulation.worker.ts", import.meta.url),
    );
    worker.onmessage = (e) => {
      if (!live) return;
      if (e.data.error) {
        setError(e.data.error);
        setResult(null);
      } else {
        setError(null);
        setResult(e.data.result);
      }
      setBusy(false);
    };
    worker.onerror = (e) => {
      if (!live) return;
      setResult(null);
      setError(e.message || "Simulation worker unavailable");
      setBusy(false);
    };
    const timeout = setTimeout(
      () => worker.postMessage({ id: 1, inputs }),
      180,
    );
    return () => {
      live = false;
      clearTimeout(timeout);
      worker.terminate();
    };
  }, [inputs]);
  return { result, busy, error };
}
