"use client";
import { useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Edges, OrbitControls, Line } from "@react-three/drei";
import * as THREE from "three";
import type { HeapDesign } from "@/engine/design";

function Pile({ design }: { design: HeapDesign }) {
  const { inputs: p, height, mesh } = design;
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
