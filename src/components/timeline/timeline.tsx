"use client";
import { useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  ChevronDown,
} from "lucide-react";
import { useProject } from "@/store/use-project";
import {
  stateColors,
  type SimulationResults,
  type SimulationSnapshot,
} from "@/types/model";
import { Button } from "@/components/ui/button";
import { number } from "@/utils/format";
export function Timeline({
  result,
  snapshot,
}: {
  result: SimulationResults;
  snapshot: SimulationSnapshot;
}) {
  const ui = useProject(),
    end = result.frames.length - 1;
  useEffect(() => {
    if (!ui.playing) return;
    const timer = setInterval(() => {
      const s = useProject.getState();
      const day = Math.min(end, s.day + s.speed);
      s.set({ day, playing: day < end });
    }, 500);
    return () => clearInterval(timer);
  }, [ui.playing, ui.speed, end]);
  const jump = (value: string) => {
    if (value === "stack")
      ui.set({ day: result.stackingCompleteDay ?? end, playing: false });
    if (value === "end") ui.set({ day: end, playing: false });
    if (value === "lift") {
      const event = result.events.find(
        (e) => e.state === "STACKING" && e.lift > 1 && e.day > snapshot.day,
      );
      ui.set({ day: event?.day ?? end, playing: false });
    }
  };
  const recent = result.events
    .filter((e) => e.day <= snapshot.day)
    .slice(-3)
    .reverse();
  return (
    <section className="timeline">
      <div className="timeline-heading">
        <span className="eyebrow">SIMULATION TIMELINE</span>
        <span>
          <i className="status-dot" /> {ui.playing ? "Playing" : "Paused"}{" "}
          <b>DAY {number(snapshot.day)}</b> / {number(end)}
        </span>
      </div>
      <div className="playback-row">
        <Button
          size="icon"
          title="Restart simulation"
          aria-label="Restart simulation"
          onClick={() => ui.set({ day: 0, playing: false })}
        >
          <RotateCcw size={15} />
        </Button>
        <Button
          size="icon"
          aria-label="Previous day"
          onClick={() =>
            ui.set({ day: Math.max(0, snapshot.day - 1), playing: false })
          }
        >
          <SkipBack size={14} />
        </Button>
        <Button
          variant="default"
          size="icon"
          aria-label={ui.playing ? "Pause" : "Play"}
          onClick={() =>
            ui.set({
              playing: !ui.playing,
              day: snapshot.day >= end ? 0 : snapshot.day,
            })
          }
        >
          {ui.playing ? (
            <Pause size={16} />
          ) : (
            <Play size={16} fill="currentColor" />
          )}
        </Button>
        <Button
          size="icon"
          aria-label="Next day"
          onClick={() =>
            ui.set({ day: Math.min(end, snapshot.day + 1), playing: false })
          }
        >
          <SkipForward size={14} />
        </Button>
        <select
          aria-label="Playback speed"
          value={ui.speed}
          onChange={(e) => ui.set({ speed: Number(e.target.value) })}
        >
          {[1, 5, 20, 100].map((n) => (
            <option key={n} value={n}>
              {n}×
            </option>
          ))}
        </select>
        <div className="timeline-track">
          <input
            aria-label="Simulation day"
            type="range"
            min={0}
            max={end}
            value={snapshot.day}
            onChange={(e) =>
              ui.set({ day: Number(e.target.value), playing: false })
            }
          />
          <div className="timeline-ticks">
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <span key={f}>{number(Math.round(end * f))}d</span>
            ))}
          </div>
        </div>
        <select
          className="milestone"
          aria-label="Jump to milestone"
          value=""
          onChange={(e) => jump(e.target.value)}
        >
          <option value="" disabled>
            Jump to milestone
          </option>
          <option value="stack">
            Stacking complete
            {result.stackingCompleteDay === null ? " (not reached)" : ""}
          </option>
          <option value="lift">Next upper lift</option>
          <option value="end">
            {result.status === "complete"
              ? "Final completion"
              : "Schedule endpoint"}
          </option>
        </select>
      </div>
      <div className="event-strip">
        <span>EVENT LOG</span>
        {recent.length ? (
          recent.map((e, i) => (
            <button
              key={i}
              className={e.cellId === ui.selectedCell ? "related-event" : ""}
              onClick={() => {
                ui.select(e.cellId, e.lift);
                ui.set({ day: e.day });
              }}
            >
              <i style={{ background: stateColors[e.state] }} />
              <b>D{e.day}</b> {e.cellId} · {e.message}
            </button>
          ))
        ) : (
          <small>Day 0 · pad available, no ore stacked</small>
        )}
      </div>
    </section>
  );
}
