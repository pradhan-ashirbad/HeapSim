"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Layers3,
  Save,
  FolderOpen,
  Download,
  X,
  ChevronDown,
  ChartNoAxesCombined,
  Box,
  FileText,
} from "lucide-react";
import { useProject } from "@/store/use-project";
import {
  scenarioNames,
  inputsSchema,
  type Scenario,
  type SimulationResults,
} from "@/types/model";
import { download } from "@/utils/format";
import { reportData } from "@/engine/analysis";
import { Button } from "@/components/ui/button";
export function Header({ result }: { result?: SimulationResults | null }) {
  const ui = useProject(),
    pathname = usePathname(),
    [modal, setModal] = useState(false),
    [notice, setNotice] = useState("");
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    useProject.persist.rehydrate();
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  const loadFile = async (selected?: File) => {
    if (!selected) return;
    try {
      if (selected.size > 2_000_000)
        throw new Error("Scenario file exceeds 2 MB.");
      const data = JSON.parse(await selected.text());
      const parsed = inputsSchema.safeParse(
        data.inputs ?? data.assumptions ?? data,
      );
      if (!parsed.success)
        throw new Error(
          parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        );
      ui.setInputs(parsed.data);
      ui.set({ day: 0, playing: false });
      setModal(false);
      setNotice("Scenario loaded and recalculated.");
    } catch (error) {
      setNotice(
        `Unable to load: ${error instanceof Error ? error.message : "Invalid JSON"}`,
      );
    }
  };
  return (
    <>
      <header className="app-header">
        <Link href="/" className="brand">
          <div className="brand-icon">
            <Layers3 size={23} strokeWidth={1.6} />
          </div>
          <span>
            HEAPSIM <b>3D</b>
            <small>ENGINEERING WORKSPACE</small>
          </span>
        </Link>
        <div className="header-project">
          <span className="eyebrow">PROJECT / 001</span>
          <input
            aria-label="Project name"
            value={ui.inputs.projectName}
            onChange={(e) => {
              if (e.target.value.trim())
                ui.setInputs({ ...ui.inputs, projectName: e.target.value });
            }}
          />
        </div>
        <div className="header-scenario">
          <span className="eyebrow">ACTIVE SCENARIO</span>
          <select
            aria-label="Scenario"
            value={ui.inputs.scenario}
            onChange={(e) =>
              ui.setInputs({
                ...ui.inputs,
                scenario: e.target.value as Scenario,
              })
            }
          >
            {Object.entries(scenarioNames).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="header-actions">
          <Button
            size="sm"
            onClick={() => {
              ui.save();
              download("heapsim-scenario.json", {
                schemaVersion: 1,
                inputs: ui.inputs,
              });
              setNotice("Scenario saved locally and exported as JSON.");
            }}
          >
            <Save size={14} />
            <span>Save</span>
          </Button>
          <Button size="sm" onClick={() => setModal(true)}>
            <FolderOpen size={14} />
            <span>Load</span>
          </Button>
          {result ? (
            <Button
              variant="default"
              size="sm"
              onClick={() =>
                download("heapsim-report.json", reportData(result))
              }
            >
              <Download size={14} />
              <span>Export report</span>
            </Button>
          ) : (
            <Button asChild size="sm" variant="default">
              <Link href="/reports">
                <FileText size={14} />
                Report
              </Link>
            </Button>
          )}
        </div>
      </header>
      <nav className="app-nav">
        <div>
          <Link
            className={
              pathname === "/" || pathname === "/simulator" ? "active" : ""
            }
            href="/"
          >
            <Box size={14} /> Simulation workspace
          </Link>
          <Link
            className={pathname === "/scenarios" ? "active" : ""}
            href="/scenarios"
          >
            <ChartNoAxesCombined size={14} /> Scenario comparison
          </Link>
          <Link
            className={pathname === "/reports" ? "active" : ""}
            href="/reports"
          >
            <FileText size={14} /> Engineering report
          </Link>
        </div>
        <span>
          <i className="status-dot" /> LOCAL WORKSPACE{" "}
          <span className="nav-separator">/</span> METRIC UNITS
        </span>
      </nav>
      {notice && (
        <div role="status" className="toast">
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="load-heading"
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <h2 id="load-heading">Load a scenario</h2>
              <button
                aria-label="Close load dialog"
                onClick={() => setModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <p>
              Load a saved project or import a HeapSim JSON file. All physical
              inputs are validated before recalculation.
            </p>
            <input
              ref={file}
              type="file"
              accept=".json,application/json"
              aria-label="Import scenario JSON"
              onChange={(e) => loadFile(e.target.files?.[0])}
            />
            <div className="saved-scenarios">
              {ui.saved.length ? (
                ui.saved.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      ui.setInputs(s.inputs);
                      ui.set({ day: 0, playing: false });
                      setModal(false);
                    }}
                  >
                    <FolderOpen size={16} />
                    <span>
                      {s.name}
                      <small>{scenarioNames[s.inputs.scenario]}</small>
                    </span>
                  </button>
                ))
              ) : (
                <p>No local scenario saves yet.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
