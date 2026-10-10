import { z } from "zod";

const positive = z.number().finite().positive();
const nonnegative = z.number().finite().nonnegative();
const optionalNumber = nonnegative.nullable();
export const inputsSchema = z
  .object({
    projectName: z.string().min(1).max(100),
    scenario: z.enum(["permanent", "dry", "new-tsf", "existing-tsf"]),
    stackingMode: z.enum(["lifts", "continuous"]).default("lifts"),
    oreTonnes: positive.max(100_000_000),
    density: positive.max(5),
    oreType: z.string().min(1).max(80),
    goldGrade: optionalNumber,
    recovery: z.number().min(0).max(100).nullable(),
    stackingRate: positive,
    operatingDays: z.number().int().min(1).max(365),
    removalRate: positive,
    removalOperatingDays: z.number().int().min(1).max(365),
    shutdownStart: z.number().int().min(0),
    shutdownEnd: z.number().int().min(0),
    irrigationShutdownStart: z.number().int().min(0),
    irrigationShutdownEnd: z.number().int().min(0),
    length: positive.max(5000),
    width: positive.max(5000),
    cellLength: positive,
    cellWidth: positive,
    liftHeight: positive.max(200),
    maxHeight: positive.max(200),
    maxLifts: z.number().int().min(1).max(20),
    slope: nonnegative.max(10),
    reposeAngle: z.number().finite().min(1).max(90).default(37),
    drainageGrade: z.number().finite().min(0).max(10).default(2),
    drainageDirection: z
      .enum(["south", "north", "east", "west"])
      .default("south"),
    sizingMode: z.enum(["fixed-land", "fixed-ore"]),
    aspectRatio: positive.max(10),
    sequence: z.enum(["row", "column", "left", "right"]),
    equipment: z.enum(["truck", "conveyor"]),
    leachDays: z.number().int().min(1).max(1000),
    setupDays: z.number().int().min(0).max(100),
    rinseDays: z.number().int().min(0).max(100),
    drainDays: z.number().int().min(0).max(100),
    prepDays: z.number().int().min(0).max(100),
    irrigationRate: positive.max(100),
    irrigationHours: positive.max(24),
    irrigationCapacity: nonnegative,
    hydraulicMode: z.enum(["base", "interlift"]),
    blockedCells: z.array(z.string()).max(2500),
    disposalDensity: positive.max(5),
    disposalHeight: positive.max(200),
    disposalSlope: nonnegative.max(10),
    disposalType: z.enum(["dry", "co-disposal", "wet"]),
    disposalDesignValidated: z.boolean(),
    disposalVolume: optionalNumber,
    approvedDisposalTonnes: optionalNumber,
    compatibility: z.boolean(),
    disposalGeotech: z.boolean(),
    disposalEnvironmental: z.boolean(),
    handlingRequirements: z.string().max(1000),
    requiredModifications: z.string().max(1000),
    transportDistance: nonnegative,
    workingArea: nonnegative,
    bermArea: nonnegative,
    pondArea: nonnegative,
    plantArea: nonnegative,
    roadArea: nonnegative,
    stormwaterArea: nonnegative,
    otherArea: nonnegative,
    disposalAllowance: nonnegative.max(200),
    permittedLand: optionalNumber,
    approvedLiftHeight: positive.nullable(),
    approvedHeight: positive.nullable(),
    geotech: z.boolean(),
    permeability: z.boolean(),
    foundation: z.boolean(),
    metallurgical: z.boolean(),
    environmental: z.boolean(),
    linerCapacity: optionalNumber,
    pumpCapacity: optionalNumber,
    padCost: optionalNumber,
    disposalCost: optionalNumber,
    rehandleCost: optionalNumber,
    haulCost: optionalNumber,
    rinseCost: optionalNumber,
    disposalOperatingCost: optionalNumber,
    environmentalCost: optionalNumber,
    closureCost: optionalNumber,
  })
  .superRefine((p, ctx) => {
    const count =
      Math.ceil(p.length / p.cellLength) *
      Math.ceil(p.width / p.cellWidth) *
      (p.scenario === "permanent" && p.stackingMode === "continuous"
        ? 1
        : p.maxLifts);
    if (count > 5000)
      ctx.addIssue({
        code: "custom",
        path: ["cellLength"],
        message: "Use larger cells: maximum 5,000 cell/lift segments.",
      });
    if (p.shutdownEnd && p.shutdownEnd < p.shutdownStart)
      ctx.addIssue({
        code: "custom",
        path: ["shutdownEnd"],
        message: "End must follow the start day.",
      });
    if (
      p.irrigationShutdownEnd &&
      p.irrigationShutdownEnd < p.irrigationShutdownStart
    )
      ctx.addIssue({
        code: "custom",
        path: ["irrigationShutdownEnd"],
        message: "End must follow the start day.",
      });
  });
export type ProjectInputs = z.infer<typeof inputsSchema>;
export type Scenario = ProjectInputs["scenario"];
export const comparisonScenarios = ["permanent", "new-tsf"] as const;
export const scenarioNumbers: Record<Scenario, number> = {
  permanent: 1,
  dry: 2,
  "new-tsf": 3,
  "existing-tsf": 4,
};
export const scenarioNames: Record<Scenario, string> = {
  permanent: "Permanent heap",
  dry: "On-off + dry storage",
  "new-tsf": "On-off + new disposal",
  "existing-tsf": "On-off + existing TSF",
};
export const STATES = [
  "EMPTY",
  "AVAILABLE",
  "STACKING",
  "IRRIGATION_SETUP",
  "LEACHING",
  "RINSING",
  "DRAINING",
  "SPENT",
  "READY_FOR_OVERSTACKING",
  "REMOVING",
  "PAD_PREPARATION",
  "BLOCKED",
] as const;
export type OperatingState = (typeof STATES)[number];
export const stateColors: Record<OperatingState, string> = {
  EMPTY: "#39423f",
  AVAILABLE: "#7b8980",
  STACKING: "#efb54a",
  IRRIGATION_SETUP: "#d6d48d",
  LEACHING: "#54bd86",
  RINSING: "#549fe1",
  DRAINING: "#66cbd5",
  SPENT: "#997455",
  READY_FOR_OVERSTACKING: "#a391d1",
  REMOVING: "#ee8850",
  PAD_PREPARATION: "#b4b6a3",
  BLOCKED: "#e97777",
};
export const stateLabel = (s: OperatingState) =>
  s.toLowerCase().replaceAll("_", " ");
export interface HeapCell {
  id: string;
  row: number;
  column: number;
  x: number;
  y: number;
  length: number;
  width: number;
  area: number;
}
export interface LiftSegment {
  index: number;
  cellId: string;
  lift: number;
  z0: number;
  z1: number;
  volume: number;
  capacity: number;
  topArea: number;
}
export interface SegmentState {
  index: number;
  state: OperatingState;
  tonnes: number;
  fed: number;
  removed: number;
  leachDays: number;
  solution: number;
  since: number;
  cycle: number;
  stackStart: number | null;
  stackEnd: number | null;
  leachStart: number | null;
  drainEnd: number | null;
}
export interface CellEvent {
  day: number;
  cellId: string;
  lift: number;
  cycle: number;
  state: OperatingState;
  message: string;
}
export interface Metrics {
  stacked: number;
  stored: number;
  active: number;
  spent: number;
  removed: number;
  remaining: number;
  disposal: number;
  accounted: number;
  massError: number;
  height: number;
  activeArea: number;
  flow: number;
  solution: number;
  activeCells: number;
  stackingUtilization: number;
  stackingOperatingDays: number;
  landUsed: number;
  padOccupiedArea: number;
  disposalOccupiedArea: number;
  landUtilization: number;
}
export interface DayFrame {
  day: number;
  changes: SegmentState[];
  metrics: Metrics;
}
export interface EngineeringWarning {
  code: string;
  severity: "error" | "warning" | "info";
  title: string;
  detail: string;
}
export interface SimulationResults {
  inputs: ProjectInputs;
  cells: HeapCell[];
  segments: LiftSegment[];
  initial: SegmentState[];
  frames: DayFrame[];
  events: CellEvent[];
  capacity: number;
  status: "complete" | "stalled" | "horizon";
  reason: string;
  stackingCompleteDay: number | null;
  completionDay: number | null;
  warnings: EngineeringWarning[];
}
export interface SimulationSnapshot {
  day: number;
  segments: SegmentState[];
  metrics: Metrics;
}
export const defaults: ProjectInputs = {
  projectName: "Aurora · 3 Mt development plan",
  scenario: "permanent",
  stackingMode: "lifts",
  oreTonnes: 3_000_000,
  density: 1.6,
  oreType: "Primary oxide ore",
  goldGrade: null,
  recovery: null,
  stackingRate: 2500,
  operatingDays: 330,
  removalRate: 2500,
  removalOperatingDays: 330,
  shutdownStart: 0,
  shutdownEnd: 0,
  irrigationShutdownStart: 0,
  irrigationShutdownEnd: 0,
  length: 400,
  width: 300,
  cellLength: 50,
  cellWidth: 50,
  liftHeight: 10,
  maxHeight: 40,
  maxLifts: 4,
  slope: 3,
  reposeAngle: 37,
  drainageGrade: 2,
  drainageDirection: "south",
  sizingMode: "fixed-land",
  aspectRatio: 4 / 3,
  sequence: "row",
  equipment: "truck",
  leachDays: 90,
  setupDays: 2,
  rinseDays: 7,
  drainDays: 7,
  prepDays: 2,
  irrigationRate: 10,
  irrigationHours: 24,
  irrigationCapacity: 250,
  hydraulicMode: "base",
  blockedCells: [],
  disposalDensity: 1.6,
  disposalHeight: 30,
  disposalSlope: 3,
  disposalType: "dry",
  disposalDesignValidated: false,
  disposalVolume: null,
  approvedDisposalTonnes: null,
  compatibility: false,
  disposalGeotech: false,
  disposalEnvironmental: false,
  handlingRequirements: "",
  requiredModifications: "",
  transportDistance: 2,
  workingArea: 10000,
  bermArea: 6000,
  pondArea: 5000,
  plantArea: 3000,
  roadArea: 5000,
  stormwaterArea: 4000,
  otherArea: 2000,
  disposalAllowance: 15,
  permittedLand: null,
  approvedLiftHeight: null,
  approvedHeight: null,
  geotech: false,
  permeability: false,
  foundation: false,
  metallurgical: false,
  environmental: false,
  linerCapacity: null,
  pumpCapacity: null,
  padCost: null,
  disposalCost: null,
  rehandleCost: null,
  haulCost: null,
  rinseCost: null,
  disposalOperatingCost: null,
  environmentalCost: null,
  closureCost: null,
};
