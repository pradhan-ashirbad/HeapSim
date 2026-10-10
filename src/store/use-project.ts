"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { defaults, inputsSchema, type ProjectInputs } from "@/types/model";
export type ViewMode =
  "3d" | "2d" | "split" | "elevation" | "section" | "lift" | "land";
interface ProjectStore {
  inputs: ProjectInputs;
  day: number;
  playing: boolean;
  speed: number;
  selectedCell: string | null;
  selectedLift: number | null;
  view: ViewMode;
  grid: boolean;
  labels: boolean;
  transparent: boolean;
  exploded: boolean;
  vertical: boolean;
  rulers: boolean;
  camera: string;
  cameraRequest: number;
  saved: { name: string; inputs: ProjectInputs }[];
  setInputs: (inputs: ProjectInputs) => void;
  set: (patch: Partial<ProjectStore>) => void;
  select: (cell: string, lift?: number | null) => void;
  focus: (preset: string) => void;
  save: () => void;
}
export const useProject = create<ProjectStore>()(
  persist(
    (set, get) => ({
      inputs: { ...defaults },
      day: 220,
      playing: false,
      speed: 5,
      selectedCell: "B4",
      selectedLift: null,
      view: "3d",
      grid: true,
      labels: false,
      transparent: false,
      exploded: false,
      vertical: true,
      rulers: true,
      camera: "iso",
      cameraRequest: 0,
      saved: [],
      setInputs: (inputs) => {
        const parsed = inputsSchema.parse(inputs);
        if (JSON.stringify(parsed) !== JSON.stringify(get().inputs))
          set({ inputs: parsed, playing: false, selectedLift: null });
      },
      set,
      select: (selectedCell, selectedLift = null) =>
        set({ selectedCell, selectedLift }),
      focus: (camera) =>
        set({ camera, cameraRequest: get().cameraRequest + 1 }),
      save: () => {
        const { inputs, saved } = get();
        set({
          saved: [
            ...saved.filter((s) => s.name !== inputs.projectName),
            { name: inputs.projectName, inputs: { ...inputs } },
          ].slice(-20),
        });
      },
    }),
    {
      name: "heapsim-project-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        inputs: s.inputs,
        saved: s.saved,
        day: s.day,
        selectedCell: s.selectedCell,
        selectedLift: s.selectedLift,
        view: s.view,
        grid: s.grid,
        labels: s.labels,
        transparent: s.transparent,
        exploded: s.exploded,
        vertical: s.vertical,
        rulers: s.rulers,
        camera: s.camera,
        speed: s.speed,
      }),
      merge: (persisted, current) => {
        const data = persisted as Partial<ProjectStore> | undefined;
        const parsed = inputsSchema.safeParse(data?.inputs);
        return {
          ...current,
          inputs: parsed.success ? parsed.data : current.inputs,
          day:
            Number.isInteger(data?.day) &&
            data!.day! >= 0 &&
            data!.day! <= 20000
              ? data!.day!
              : current.day,
          selectedCell:
            typeof data?.selectedCell === "string"
              ? data.selectedCell
              : current.selectedCell,
          selectedLift:
            Number.isInteger(data?.selectedLift) &&
            data!.selectedLift! >= 1 &&
            data!.selectedLift! <= 20
              ? data!.selectedLift!
              : null,
          view: (
            [
              "3d",
              "2d",
              "split",
              "elevation",
              "section",
              "lift",
              "land",
            ] as const
          ).includes(data?.view as ViewMode)
            ? data!.view!
            : current.view,
          grid: typeof data?.grid === "boolean" ? data.grid : current.grid,
          labels:
            typeof data?.labels === "boolean" ? data.labels : current.labels,
          transparent:
            typeof data?.transparent === "boolean"
              ? data.transparent
              : current.transparent,
          exploded:
            typeof data?.exploded === "boolean"
              ? data.exploded
              : current.exploded,
          vertical:
            typeof data?.vertical === "boolean"
              ? data.vertical
              : current.vertical,
          rulers:
            typeof data?.rulers === "boolean" ? data.rulers : current.rulers,
          camera: [
            "iso",
            "top",
            "north",
            "south",
            "east",
            "west",
            "focus",
          ].includes(data?.camera ?? "")
            ? data!.camera!
            : current.camera,
          speed: [1, 5, 20, 100].includes(data?.speed ?? -1)
            ? data!.speed!
            : current.speed,
          saved: Array.isArray(data?.saved)
            ? data!
                .saved!.filter((s) => inputsSchema.safeParse(s.inputs).success)
                .slice(-20)
            : [],
        };
      },
    },
  ),
);
