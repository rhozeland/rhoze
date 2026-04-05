import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const SHARD_COUNT = 120;
const ASSEMBLE_SPEED = 0.02;
const SCATTER_RADIUS = 8;

// Generate the "R" shape target positions using parametric sampling
function generateRPositions(count: number): Float32Array {
  const positions = new Float32Array(count * 3);
  
  // Define "R" shape as line segments (normalized -1 to 1)
  const segments: [number, number, number, number][] = [
    // Vertical stroke
    [-0.4, -0.8, -0.4, 0.8],
    // Top horizontal
    [-0.4, 0.8, 0.2, 0.8],
    // Right curve top
    [0.2, 0.8, 0.4, 0.6],
    [0.4, 0.6, 0.4, 0.3],
    [0.4, 0.3, 0.2, 0.1],
    // Middle horizontal
    [-0.4, 0.1, 0.2, 0.1],
    // Leg
    [0.0, 0.1, 0.4, -0.8],
  ];

  const totalLength = segments.reduce((sum, [x1, y1, x2, y2]) => 
    sum + Math.sqrt((x2-x1)**2 + (y2-y1)**2), 0);

  let idx = 0;
  for (const [x1, y1, x2, y2] of segments) {
    const segLen = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
    const segCount = Math.max(1, Math.round((segLen / totalLength) * count));
    for (let i = 0; i < segCount && idx < count; i++) {
      const t = i / Math.max(1, segCount - 1);
      positions[idx * 3] = (x1 + (x2 - x1) * t) * 2.5;
      positions[idx * 3 + 1] = (y1 + (y2 - y1) * t) * 2.5;
      positions[idx * 3 + 2] = (Math.random() - 0.5) * 0.3;
      idx++;
    }
  }
  // Fill remaining
  while (idx < count) {
    const seg = segments[Math.floor(Math.random() * segments.length)];
    const t = Math.random();
    positions[idx * 3] = (seg[0] + (seg[2] - seg[0]) * t) * 2.5;
    positions[idx * 3 + 1] = (seg[1] + (seg[3] - seg[1]) * t) * 2.5;
    positions[idx * 3 + 2] = (Math.random() - 0.5) * 0.3;
    idx++;
  }
  return positions;
}

interface LogoShardsProps {
  onAssembled?: () => void;
}

const LogoShards = ({ onAssembled }: LogoShardsProps) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [assembled, setAssembled] = useState(false);
  const progressRef = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const calledRef = useRef(false);

  const { targets, initials, rotations, scales, colors } = useMemo(() => {
    const targets = generateRPositions(SHARD_COUNT);
    const initials = new Float32Array(SHARD_COUNT * 3);
    const rotations = new Float32Array(SHARD_COUNT * 3);
    const scales = new Float32Array(SHARD_COUNT);
    const colors = new Float32Array(SHARD_COUNT * 3);

    // Rhoze palette in RGB
    const palette = [
      [0.4, 0.85, 0.75],  // mint
      [0.9, 0.7, 0.9],    // pink
      [0.75, 0.7, 0.9],   // lavender
      [1.0, 0.85, 0.75],  // peach
      [0.5, 0.9, 0.8],    // light mint
    ];

    for (let i = 0; i < SHARD_COUNT; i++) {
      // Random scattered start positions
      const angle = Math.random() * Math.PI * 2;
      const radius = SCATTER_RADIUS * (0.5 + Math.random() * 0.5);
      initials[i * 3] = Math.cos(angle) * radius;
      initials[i * 3 + 1] = Math.sin(angle) * radius;
      initials[i * 3 + 2] = (Math.random() - 0.5) * 6;

      rotations[i * 3] = Math.random() * Math.PI * 2;
      rotations[i * 3 + 1] = Math.random() * Math.PI * 2;
      rotations[i * 3 + 2] = Math.random() * Math.PI * 2;

      scales[i] = 0.06 + Math.random() * 0.1;

      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = c[0];
      colors[i * 3 + 1] = c[1];
      colors[i * 3 + 2] = c[2];
    }

    return { targets, initials, rotations, scales, colors };
  }, []);

  useEffect(() => {
    if (!meshRef.current) return;
    const color = new THREE.Color();
    for (let i = 0; i < SHARD_COUNT; i++) {
      color.setRGB(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
      meshRef.current.setColorAt(i, color);
    }
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [colors]);

  useFrame((state) => {
    if (!meshRef.current) return;

    const time = state.clock.elapsedTime;
    progressRef.current = Math.min(1, progressRef.current + ASSEMBLE_SPEED * 0.016 * 60);
    const p = progressRef.current;
    // Smooth ease
    const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

    if (p >= 0.98 && !calledRef.current) {
      calledRef.current = true;
      setAssembled(true);
      onAssembled?.();
    }

    for (let i = 0; i < SHARD_COUNT; i++) {
      const ix = initials[i * 3];
      const iy = initials[i * 3 + 1];
      const iz = initials[i * 3 + 2];
      const tx = targets[i * 3];
      const ty = targets[i * 3 + 1];
      const tz = targets[i * 3 + 2];

      // Interpolate position
      const x = ix + (tx - ix) * ease;
      const y = iy + (ty - iy) * ease;
      const z = iz + (tz - iz) * ease;

      dummy.position.set(x, y, z);

      // Rotation fades out as assembled
      const rotFade = 1 - ease;
      dummy.rotation.set(
        rotations[i * 3] * rotFade + (assembled ? Math.sin(time + i * 0.1) * 0.02 : 0),
        rotations[i * 3 + 1] * rotFade,
        rotations[i * 3 + 2] * rotFade
      );

      // Subtle breathing when assembled
      const s = scales[i] * (assembled ? 1 + Math.sin(time * 2 + i * 0.3) * 0.1 : 1);
      dummy.scale.setScalar(s);

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, SHARD_COUNT]}>
      <boxGeometry args={[1, 1, 0.3]} />
      <meshStandardMaterial
        roughness={0.3}
        metalness={0.1}
        transparent
        opacity={0.9}
      />
    </instancedMesh>
  );
};

export default LogoShards;
