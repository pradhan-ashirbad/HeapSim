"use client";
import { useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Edges, OrbitControls, Line, Html } from "@react-three/drei";
import * as THREE from "three";
import type { HeapDesign } from "@/engine/design";
import { boundsAt, generateCells, groundElevation } from "@/engine/geometry";

function Pile({ design }: { design: HeapDesign }) {
  const { inputs: p, height, mesh } = design;
  const cellLines = useMemo(() => {
    const cells = generateCells(p);
    if (cells.length > 300) return [];
    return cells.flatMap((cell) => {
      const b = boundsAt(p, cell, height);
      if (b.x1 <= b.x0 || b.y1 <= b.y0) return [];
      return [
        {
          id: cell.id,
          points: [
            [b.x0, b.y0],
            [b.x1, b.y0],
            [b.x1, b.y1],
            [b.x0, b.y1],
            [b.x0, b.y0],
          ].map(([x, y]): [number, number, number] => [
            x,
            height + groundElevation(p, x, y) + 0.08,
            y,
          ]),
        },
      ];
    });
  }, [p, height]);
  // True-scale live angle triangle on the west side, outside the solid mesh.
  // Changes to repose or pad grade re-position all three endpoints.
  const inset = p.slope * height;
  const guideY = p.width / 2;
  const toe = groundElevation(p, 0, guideY);
  const crest = groundElevation(p, inset, guideY) + height;
  const faceAngle = Math.atan2(crest - toe, inset) * 180 / Math.PI;
  const { camera, size, invalidate } = useThree();
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(mesh.positions, 3),
    );
    g.setIndex(mesh.indices);
    g.computeVertexNormals();
    return g;
  }, [mesh]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    const span = Math.max(p.length, p.width, height * 2);
    camera.position.set(span, span * 0.85, span);
    camera.lookAt(0, 0, 0);
    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom = Math.min(
        size.width / (span * 1.7),
        size.height / (span * 1.2),
      );
      camera.updateProjectionMatrix();
    }
    invalidate();
  }, [p.length, p.width, height, camera, size.width, size.height, invalidate]);
  return (
    <>
      <ambientLight intensity={1.6} />
      <directionalLight position={[-100, 300, 150]} intensity={2} />
      <group position={[-p.length / 2, -height / 2, -p.width / 2]}>
        <mesh geometry={geometry}>
          <meshStandardMaterial
            color="#b0ad70"
            roughness={0.95}
            flatShading
            side={THREE.DoubleSide}
          />
          <Edges color="#e1ddb0" />
        </mesh>
        {height > 0 && inset > 0 && (
          <>
            <Line
              points={[[0, toe + 0.4, guideY], [inset, crest + 0.4, guideY]]}
              color="#ffcf72"
              lineWidth={4}
            />
            <Line
              points={[[0, toe + 0.4, guideY], [inset, toe + 0.4, guideY], [inset, crest + 0.4, guideY]]}
              color="#ffd99b"
              lineWidth={2}
              dashed
            />
            <Html position={[inset * 0.58, (toe + crest) / 2 + 4, guideY]} center style={{ pointerEvents: "none" }}>
              <span className="scene-small-label" data-testid="live-repose-face-angle">
                FACE {faceAngle.toFixed(1)}° · REPOSE {p.reposeAngle.toFixed(1)}°
              </span>
            </Html>
          </>
        )}
        {cellLines.map((line) => (
          <Line
            key={line.id}
            points={line.points}
            color="#4e684e"
            lineWidth={1.2}
          />
        ))}
        <Line
          points={[
            [0, 0, -12],
            [p.length, 0, -12],
          ]}
          color="#caddac"
        />
        <Line
          points={[
            [-12, 0, 0],
            [-12, 0, p.width],
          ]}
          color="#caddac"
        />
        <Line
          points={[
            [p.length + 12, 0, 0],
            [p.length + 12, height, 0],
          ]}
          color="#f1c873"
        />
      </group>
      <OrbitControls makeDefault enableDamping={false} />
    </>
  );
}
export default function DesignScene({ design }: { design: HeapDesign }) {
  return (
    <Canvas
      orthographic
      camera={{ near: 0.1, far: 50000 }}
      frameloop="demand"
      dpr={[1, 1.5]}
      aria-label="Live pile design in 3D"
    >
      <Pile design={design} />
    </Canvas>
  );
}
