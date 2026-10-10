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
      partialize: (s) => ({ inputs: s.inputs, saved: s.saved }),
      merge: (persisted, current) => {
        const data = persisted as Partial<ProjectStore> | undefined;
        const parsed = inputsSchema.safeParse(data?.inputs);
        return {
          ...current,
          inputs: parsed.success ? parsed.data : current.inputs,
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
