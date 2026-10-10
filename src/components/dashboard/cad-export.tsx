"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { useProject } from "@/store/use-project";
import { Button } from "@/components/ui/button";

export function CadExport({ viewport = false }: { viewport?: boolean }) {
  const inputs = useProject((s) => s.inputs),
    day = useProject((s) => s.day);
  const [scope, setScope] = useState(viewport ? "day" : "design"),
    [format, setFormat] = useState("dwg"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/cad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs, day, scope, format }),
      });
      if (!response.ok)
        throw new Error((await response.json()).error || "CAD export failed.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `heapsim-${scope === "design" ? "design" : `day-${day}`}.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "CAD export failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="cad-export">
      <div>
        <select
          aria-label={viewport ? "View CAD geometry" : "CAD geometry"}
          value={scope}
          onChange={(e) => setScope(e.target.value)}
        >
          <option value="design">Full pile design</option>
          <option value="day">Current operating day</option>
        </select>
        <select
          aria-label={viewport ? "View CAD format" : "CAD format"}
          value={format}
          onChange={(e) => setFormat(e.target.value)}
        >
          <option value="dwg">DWG</option>
          <option value="dxf">DXF</option>
        </select>
        <Button onClick={save} disabled={busy}>
          <Download size={14} />
          {busy
            ? "Exporting…"
            : viewport
              ? `Download view ${format.toUpperCase()}`
              : "Download CAD"}
        </Button>
      </div>
      <small>All cells & lifts · 3D faces + drainage profile · metres</small>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
