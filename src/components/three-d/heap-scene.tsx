"use client";
import {
  Suspense,
  memo,
  useEffect,
  useMemo,
  useRef,
  createContext,
  useContext,
  type RefObject,
  type ComponentProps,
} from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import {
  Edges,
  Html as DreiHtml,
  Line,
  OrbitControls,
} from "@react-three/drei";
import * as THREE from "three";
import { useProject } from "@/store/use-project";
import {
  segmentMesh,
  filledHeight,
  boundsAt,
  envelopeVolume,
  groundElevation,
} from "@/engine/geometry";
import { disposalFootprint, disposalGeometry } from "@/engine/analysis";
import {
  stateColors,
  type HeapCell,
  type LiftSegment,
  type ProjectInputs,
  type SegmentState,
  type SimulationResults,
  type SimulationSnapshot,
} from "@/types/model";
import { compact, number } from "@/utils/format";
import type { OrbitControls as ControlsImpl } from "three-stdlib";

const LabelPortal = createContext<RefObject<HTMLDivElement> | undefined>(
  undefined,
);
function Html(props: ComponentProps<typeof DreiHtml>) {
  const portal = useContext(LabelPortal);
  return <DreiHtml {...props} portal={portal} />;
}

function CompassDirection({
  arrow,
}: {
  arrow: RefObject<SVGSVGElement | null>;
}) {
  const north = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    // Site plan Y increases south; geographic north is negative Three.js Z.
    north.set(0, 0, -1).transformDirection(camera.matrixWorldInverse);
    if (arrow.current)
      arrow.current.style.transform = `rotate(${(Math.atan2(north.x, north.y) * 180) / Math.PI}deg)`;
  });
  return null;
}

function makeGeometry(
  p: ProjectInputs,
  cell: HeapCell,
  def: LiftSegment,
  tonnes: number,
) {
  const mesh = segmentMesh(p, cell, def, tonnes),
    geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(mesh.positions, 3),
  );
  geometry.setIndex(mesh.indices);
  geometry.computeVertexNormals();
  return geometry;
}
const OreSegment = memo(function OreSegment({
  p,
  cell,
  def,
  state,
  top,
  selected,
  grid,
  vertical,
  transparent,
  exploded,
  onSelect,
}: {
  p: ProjectInputs;
  cell: HeapCell;
  def: LiftSegment;
  state: SegmentState;
  top: boolean;
  selected: boolean;
  grid: boolean;
  vertical: boolean;
  transparent: boolean;
  exploded: boolean;
  onSelect: (id: string, lift: number) => void;
}) {
  const geometry = useMemo(
    () => makeGeometry(p, cell, def, state.tonnes),
    [p, cell, def, state.tonnes],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  const height = useMemo(
    () => filledHeight(p, cell, def, state.tonnes),
    [p, cell, def, state.tonnes],
  );
  const bounds = boundsAt(p, cell, height),
    offset = exploded ? (def.lift - 1) * 13 : 0;
  if (state.tonnes <= 0) return null;
  const topOutline: [number, number, number][] = [
    [
      bounds.x0,
      height + groundElevation(p, bounds.x0, bounds.y0) + 0.035,
      bounds.y0,
    ],
    [
      bounds.x1,
      height + groundElevation(p, bounds.x1, bounds.y0) + 0.035,
      bounds.y0,
    ],
    [
      bounds.x1,
      height + groundElevation(p, bounds.x1, bounds.y1) + 0.035,
      bounds.y1,
    ],
    [
      bounds.x0,
      height + groundElevation(p, bounds.x0, bounds.y1) + 0.035,
      bounds.y1,
    ],
    [
      bounds.x0,
      height + groundElevation(p, bounds.x0, bounds.y0) + 0.035,
      bounds.y0,
    ],
  ];
  return (
    <group position={[0, offset, 0]}>
      <mesh
        geometry={geometry}
        position={[cell.x, def.z0, cell.y]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(cell.id, def.lift);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <meshStandardMaterial
          color={stateColors[state.state]}
          roughness={0.94}
          metalness={0.04}
          transparent={transparent && def.lift > 1}
          opacity={transparent && def.lift > 1 ? 0.3 : 1}
          emissive={selected ? "#7e8140" : "#000000"}
          emissiveIntensity={selected ? 0.3 : 0}
          side={THREE.DoubleSide}
        />
        {grid && vertical && (
          <Edges
            threshold={16}
            color={selected ? "#f1f5bf" : "#34463d"}
            lineWidth={selected ? 1.6 : 0.6}
          />
        )}
      </mesh>
      {((grid && top) || selected) && (
        <Line
          points={topOutline}
          color={selected ? "#eff6b6" : "#9dac81"}
          lineWidth={selected ? 2 : 0.75}
        />
      )}
      {top &&
        state.state === "LEACHING" &&
        [0.25, 0.5, 0.75].map((r) => (
          <Line
            key={r}
            points={[
              [
                bounds.x0 + (bounds.x1 - bounds.x0) * r,
                height +
                  groundElevation(
                    p,
                    bounds.x0 + (bounds.x1 - bounds.x0) * r,
                    bounds.y0,
                  ) +
                  0.12,
                bounds.y0,
              ],
              [
                bounds.x0 + (bounds.x1 - bounds.x0) * r,
                height +
                  groundElevation(
                    p,
                    bounds.x0 + (bounds.x1 - bounds.x0) * r,
                    bounds.y1,
                  ) +
                  0.12,
                bounds.y1,
              ],
            ]}
            color="#b5e0c4"
            lineWidth={0.7}
          />
        ))}
      {selected && (
        <Html
          position={[
            (bounds.x0 + bounds.x1) / 2,
            height +
              groundElevation(
                p,
                (bounds.x0 + bounds.x1) / 2,
                (bounds.y0 + bounds.y1) / 2,
              ) +
              8,
            (bounds.y0 + bounds.y1) / 2,
          ]}
          center
          style={{ pointerEvents: "none" }}
        >
          <div className="scene-cell-label">
            <b>
              {cell.id} <span>L{def.lift}</span>
            </b>
            <small>
              {height.toFixed(1)} m · {compact(state.tonnes)} t
            </small>
          </div>
        </Html>
      )}
    </group>
  );
});
function CameraRig({
  result,
  snapshot,
  preset,
  request,
  selected,
}: {
  result: SimulationResults;
  snapshot: SimulationSnapshot;
  preset: string;
  request: number;
  selected: string | null;
}) {
  const { camera, size, invalidate } = useThree(),
    controls = useRef<ControlsImpl>(null);
  const p = result.inputs;
  useEffect(() => {
    let target = new THREE.Vector3(0, 10, 0);
    const disposal = p.scenario !== "permanent" ? disposalFootprint(p) : null;
    const span = disposal
      ? Math.max(p.length + 65 + disposal.length, p.width, disposal.width)
      : Math.max(p.length, p.width);
    if (disposal) target.x = (65 + disposal.length) / 2;
    if (preset === "focus" && selected) {
      const c = result.cells.find((c) => c.id === selected);
      if (c)
        target = new THREE.Vector3(
          c.x + c.length / 2 - p.length / 2,
          15,
          c.y + c.width / 2 - p.width / 2,
        );
    }
    const offsets: Record<string, number[]> = {
      top: [0, span * 1.5, 0.01],
      north: [0, 40, -span * 1.5],
      south: [0, 40, span * 1.5],
      east: [span * 1.5, 40, 0],
      west: [-span * 1.5, 40, 0],
      iso: [span, span * 0.86, span],
      focus: [span * 0.65, span * 0.65, span * 0.65],
    };
    const a = offsets[preset] ?? offsets.iso;
    camera.position.set(target.x + a[0], target.y + a[1], target.z + a[2]);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom =
        Math.min(size.width / (span * 1.55), size.height / (span * 0.98)) *
        (preset === "focus" ? 2.3 : 1);
      camera.updateProjectionMatrix();
    }
    controls.current?.target.copy(target);
    controls.current?.update();
    invalidate();
    // Camera changes only on explicit request or viewport/project dimensions, never on playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    camera,
    size.width,
    size.height,
    p.length,
    p.width,
    p.scenario,
    p.disposalVolume,
    p.disposalHeight,
    p.disposalSlope,
    p.disposalDensity,
    preset,
    request,
    invalidate,
  ]);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.12}
      maxPolarAngle={Math.PI / 2.02}
      minZoom={0.15}
      maxZoom={12}
    />
  );
}
function Disposal({
  result,
  tonnes,
}: {
  result: SimulationResults;
  tonnes: number;
}) {
  const p = result.inputs,
    growth = disposalGeometry(p, tonnes),
    f = growth.design;
  const dp = {
    ...p,
    length: growth.length,
    width: growth.width,
    slope: p.disposalSlope,
    density: p.disposalDensity,
  };
  const cell: HeapCell = {
    id: "disposal",
    row: 0,
    column: 0,
    x: 0,
    y: 0,
    length: growth.length,
    width: growth.width,
    area: growth.area,
  };
  const def: LiftSegment = {
    index: 0,
    cellId: cell.id,
    lift: 1,
    z0: 0,
    z1: growth.height,
    volume: growth.volume,
    capacity: tonnes,
    topArea: 0,
  };
  const geometry = useMemo(
    () => makeGeometry(dp, cell, def, tonnes),
    [p, tonnes],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group position={[p.length + 65, 0, 0]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[f.length / 2, 0.05, f.width / 2]}
      >
        <planeGeometry args={[f.length, f.width]} />
        <meshStandardMaterial color="#39392d" />
      </mesh>
      {tonnes > 0 && (
        <mesh
          geometry={geometry}
          position={[
            (f.length - growth.length) / 2,
            0,
            (f.width - growth.width) / 2,
          ]}
        >
          <meshStandardMaterial
            color="#9b7e59"
            roughness={1}
            side={THREE.DoubleSide}
          />
          <Edges color="#5b5942" />
        </mesh>
      )}
      <Html position={[f.length / 2, 3, f.width + 25]} center>
        <span className="scene-zone">
          B /{" "}
          {p.scenario === "existing-tsf"
            ? "EXISTING TSF · CONCEPT"
            : "SPENT-ORE STORAGE"}
          <small>
            {compact(tonnes)} t ·{" "}
            {(tonnes / p.disposalDensity).toLocaleString("en-US", {
              maximumFractionDigits: 0,
            })}{" "}
            m³
          </small>
        </span>
      </Html>
    </group>
  );
}
function SceneContents({
  result,
  snapshot,
  comparison = false,
}: {
  result: SimulationResults;
  snapshot: SimulationSnapshot;
  comparison?: boolean;
}) {
  const ui = useProject();
  const p = result.inputs;
  const cellMap = useMemo(
    () => new Map(result.cells.map((c) => [c.id, c])),
    [result.cells],
  );
  const topByCell = new Map<string, number>();
  for (const def of result.segments)
    if (snapshot.segments[def.index].tonnes > 0)
      topByCell.set(def.cellId, def.lift);
  const selected = comparison ? null : ui.selectedCell;
  const sectionY = Math.ceil(p.width / 2 / p.cellWidth) * p.cellWidth;
  const gradeAngle = Math.atan(p.drainageGrade / 100);
  const tiltX =
    p.drainageDirection === "south"
      ? gradeAngle
      : p.drainageDirection === "north"
        ? -gradeAngle
        : 0;
  const tiltZ =
    p.drainageDirection === "west"
      ? gradeAngle
      : p.drainageDirection === "east"
        ? -gradeAngle
        : 0;
  const drainLine: [number, number, number][] =
    p.drainageDirection === "south"
      ? [
          [0, groundElevation(p, 0, p.width) + 0.4, p.width],
          [p.length, groundElevation(p, p.length, p.width) + 0.4, p.width],
        ]
      : p.drainageDirection === "north"
        ? [
            [0, groundElevation(p, 0, 0) + 0.4, 0],
            [p.length, groundElevation(p, p.length, 0) + 0.4, 0],
          ]
        : p.drainageDirection === "east"
          ? [
              [p.length, groundElevation(p, p.length, 0) + 0.4, 0],
              [p.length, groundElevation(p, p.length, p.width) + 0.4, p.width],
            ]
          : [
              [0, groundElevation(p, 0, 0) + 0.4, 0],
              [0, groundElevation(p, 0, p.width) + 0.4, p.width],
            ];
  return (
    <>
      <color attach="background" args={["#17231f"]} />
      <ambientLight intensity={1.5} />
      <directionalLight
        position={[-200, 400, 100]}
        intensity={2.1}
        color="#fff4d9"
      />
      <directionalLight
        position={[300, 200, -200]}
        intensity={0.65}
        color="#a4cdb8"
      />
      <CameraRig
        result={result}
        snapshot={snapshot}
        preset={comparison ? "iso" : ui.camera}
        request={ui.cameraRequest}
        selected={selected}
      />
      <gridHelper
        args={[2400, 80, "#3b4a3e", "#26372e"]}
        position={[0, -0.6, 0]}
      />
      <group position={[-p.length / 2, 0, -p.width / 2]}>
        <mesh position={[p.length / 2, -1.2, p.width / 2]}>
          <boxGeometry args={[p.length + 12, 2, p.width + 12]} />
          <meshStandardMaterial color="#56614e" />
        </mesh>
        <Line points={drainLine} color="#77cfdd" lineWidth={3} />
        {!comparison && (
          <Html
            position={[drainLine[1][0], drainLine[1][1] + 2, drainLine[1][2]]}
            center
          >
            <span className="scene-small-label">
              COLLECTION EDGE · {p.drainageGrade}%{" "}
              {p.drainageDirection.toUpperCase()}
            </span>
          </Html>
        )}
        {result.cells
          .filter((c) => comparison || ui.view !== "section" || c.y < sectionY)
          .map((cell) => (
            <group key={cell.id}>
              <group
                position={[
                  cell.x + cell.length / 2,
                  groundElevation(
                    p,
                    cell.x + cell.length / 2,
                    cell.y + cell.width / 2,
                  ) + 0.02,
                  cell.y + cell.width / 2,
                ]}
                rotation={[0, 0, tiltZ]}
              >
                <mesh
                  rotation={[-Math.PI / 2 + tiltX, 0, 0]}
                  onClick={(e) => {
                    e.stopPropagation();
                    ui.select(cell.id);
                  }}
                >
                  <planeGeometry args={[cell.length, cell.width]} />
                  <meshStandardMaterial
                    color={
                      p.blockedCells.includes(cell.id)
                        ? "#793d3d"
                        : selected === cell.id
                          ? "#778655"
                          : "#495348"
                    }
                    roughness={1}
                  />
                  {ui.grid && <Edges color="#819077" lineWidth={0.7} />}
                </mesh>
              </group>
              {ui.labels && result.cells.length <= 200 && (
                <Html
                  position={[
                    cell.x + cell.length / 2,
                    (topByCell.get(cell.id) ?? 0) * p.liftHeight +
                      groundElevation(
                        p,
                        cell.x + cell.length / 2,
                        cell.y + cell.width / 2,
                      ) +
                      1,
                    cell.y + cell.width / 2,
                  ]}
                  center
                  style={{ pointerEvents: "none" }}
                >
                  <span className="scene-grid-label">{cell.id}</span>
                </Html>
              )}
            </group>
          ))}
        {result.segments.map((def) => {
          const cell = cellMap.get(def.cellId)!;
          if (
            snapshot.segments[def.index].tonnes <= 0 ||
            (!comparison && ui.view === "section" && cell.y >= sectionY) ||
            (!comparison &&
              ui.view === "lift" &&
              def.lift !== (ui.selectedLift ?? 1))
          )
            return null;
          return (
            <OreSegment
              key={def.index}
              p={p}
              cell={cell}
              def={def}
              state={snapshot.segments[def.index]}
              top={topByCell.get(cell.id) === def.lift}
              selected={
                selected === cell.id &&
                (ui.selectedLift === null
                  ? topByCell.get(cell.id) === def.lift
                  : ui.selectedLift === def.lift)
              }
              grid={ui.grid}
              vertical={ui.vertical}
              transparent={ui.transparent}
              exploded={ui.exploded}
              onSelect={ui.select}
            />
          );
        })}
        <Line
          points={[
            [0, -0.1, p.width + 9],
            [p.length, -0.1, p.width + 9],
            [p.length + 30, -0.1, p.width + 60],
          ]}
          color="#70ac9b"
          lineWidth={2}
        />
        <mesh
          position={[p.length + 20, 0, p.width + 45]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[55, 34]} />
          <meshStandardMaterial color="#4c8887" />
        </mesh>
        <Html position={[p.length + 20, 1, p.width + 68]} center>
          <span className="scene-small-label">PLS POND · CONCEPT</span>
        </Html>
        <mesh position={[p.length - 55, 6, p.width + 65]}>
          <boxGeometry args={[38, 12, 20]} />
          <meshStandardMaterial color="#82908a" />
        </mesh>
        <Html position={[p.length - 55, 1, p.width + 87]} center>
          <span className="scene-small-label">PROCESS PLANT</span>
        </Html>
        {p.scenario !== "permanent" && (
          <Disposal result={result} tonnes={snapshot.metrics.disposal} />
        )}
        {ui.rulers && (
          <>
            <Line
              points={[
                [0, 0, -20],
                [p.length, 0, -20],
              ]}
              color="#adb79a"
              lineWidth={0.6}
            />
            <Html position={[p.length / 2, 0, -27]} center>
              <span className="scene-ruler">{number(p.length, 1)} m</span>
            </Html>
            <Line
              points={[
                [-20, 0, 0],
                [-20, 0, p.width],
              ]}
              color="#adb79a"
              lineWidth={0.6}
            />
            <Html position={[-27, 0, p.width / 2]} center>
              <span className="scene-ruler">{number(p.width, 1)} m</span>
            </Html>
            <Line
              points={[
                [0, 0, 0],
                [0, p.maxHeight, 0],
              ]}
              color="#b7bba3"
              lineWidth={1}
            />
            {Array.from(
              { length: Math.ceil(p.maxHeight / p.liftHeight) + 1 },
              (_, i) => i * p.liftHeight,
            )
              .filter((h) => h <= p.maxHeight)
              .map((h) => (
                <Html key={h} position={[-5, h, -5]} center>
                  <span className="height-marker">{h}m</span>
                </Html>
              ))}
          </>
        )}
        {!comparison && ui.view === "section" && (
          <Line
            points={[
              [p.length / 2, snapshot.metrics.height + 8, sectionY],
              [
                p.length / 2,
                p.hydraulicMode === "interlift"
                  ? Math.max(0, snapshot.metrics.height - p.liftHeight)
                  : 0,
                sectionY,
              ],
            ]}
            color="#7fe1ed"
            lineWidth={3}
            dashed
            dashSize={3}
            gapSize={2}
          />
        )}
      </group>
    </>
  );
}
export default function HeapScene(props: {
  result: SimulationResults;
  snapshot: SimulationSnapshot;
  comparison?: boolean;
}) {
  const portal = useRef<HTMLDivElement>(null!);
  const arrow = useRef<SVGSVGElement>(null);
  return (
    <div
      className="three-scene"
      data-testid="three-scene"
      style={{ position: "relative" }}
    >
      <div ref={portal} className="scene-label-portal" />
      <Canvas
        orthographic
        camera={{ position: [500, 400, 500], near: 0.1, far: 10000 }}
        dpr={[1, 1.5]}
        frameloop="demand"
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <LabelPortal.Provider value={portal}>
          <Suspense fallback={null}>
            <SceneContents {...props} />
            <CompassDirection arrow={arrow} />
          </Suspense>
        </LabelPortal.Provider>
      </Canvas>
      <div
        className="compass"
        style={{ transform: "none" }}
        aria-label="Camera-relative north"
      >
        <span>N</span>
        <svg ref={arrow} width="22" height="22" viewBox="0 0 22 22">
          <path d="M11 2 4 19 11 15 18 19Z" fill="#bed38d" />
        </svg>
      </div>
    </div>
  );
}
