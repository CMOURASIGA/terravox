import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Stars } from '@react-three/drei';
import { useRef } from 'react';
import type { Mesh, Group } from 'three';

interface Arena3DProps {
  playerPosition: { x: number; z: number };
  gateOpen: boolean;
  bossDefeated: boolean;
  onAttack: () => void;
  onNavigate: (position: { x: number; z: number }) => void;
}

function Hero({ position }: { position: { x: number; z: number } }) {
  const group = useRef<Group>(null);
  useFrame((state) => {
    if (group.current) group.current.rotation.y = Math.sin(state.clock.elapsedTime * 2) * 0.08;
  });

  return (
    <group ref={group} position={[position.x, 0.8, position.z]}>
      <mesh castShadow><capsuleGeometry args={[0.42, 0.9, 6, 12]} /><meshStandardMaterial color="#21c9d8" roughness={0.35} /></mesh>
      <mesh position={[0, 0.75, 0]} castShadow><sphereGeometry args={[0.49, 24, 24]} /><meshStandardMaterial color="#ffd3ae" /></mesh>
      <mesh position={[0, 1.08, 0.39]}><sphereGeometry args={[0.08, 16, 16]} /><meshStandardMaterial color="#17233c" /></mesh>
      <mesh position={[0.2, 1.08, 0.34]}><sphereGeometry args={[0.06, 16, 16]} /><meshStandardMaterial color="#17233c" /></mesh>
      <mesh position={[0, 1.42, 0]}><boxGeometry args={[0.85, 0.18, 0.75]} /><meshStandardMaterial color="#5635b8" /></mesh>
    </group>
  );
}

function Crystal({ position, color, active = true }: { position: [number, number, number]; color: string; active?: boolean }) {
  const mesh = useRef<Mesh>(null);
  useFrame((state) => {
    if (mesh.current && active) {
      mesh.current.rotation.y += 0.025;
      mesh.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.12;
    }
  });
  if (!active) return null;
  return <mesh ref={mesh} position={position} castShadow><octahedronGeometry args={[0.48, 0]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} /></mesh>;
}

function Guardian({ defeated }: { defeated: boolean }) {
  const group = useRef<Group>(null);
  useFrame((state) => {
    if (group.current && !defeated) {
      group.current.position.y = 0.85 + Math.sin(state.clock.elapsedTime * 2) * 0.12;
      group.current.rotation.y += 0.006;
    }
  });
  if (defeated) return null;
  return (
    <group ref={group} position={[5.5, 0.85, -4.8]}>
      <mesh castShadow><sphereGeometry args={[0.9, 24, 24]} /><meshStandardMaterial color="#ef426f" roughness={0.42} /></mesh>
      <mesh position={[-0.32, 0.15, 0.78]}><sphereGeometry args={[0.16, 16, 16]} /><meshStandardMaterial color="#fff5c9" emissive="#fff5c9" emissiveIntensity={1} /></mesh>
      <mesh position={[0.32, 0.15, 0.78]}><sphereGeometry args={[0.16, 16, 16]} /><meshStandardMaterial color="#fff5c9" emissive="#fff5c9" emissiveIntensity={1} /></mesh>
      <mesh position={[0, 1.05, 0]} rotation={[0, 0, 0.3]}><coneGeometry args={[0.38, 0.95, 5]} /><meshStandardMaterial color="#ffbd34" /></mesh>
    </group>
  );
}

function CameraFollow({ position }: { position: { x: number; z: number } }) {
  const { camera } = useThree();
  useFrame(() => {
    camera.position.lerp({ x: position.x, y: 14, z: position.z + 12 } as never, 0.035);
    camera.lookAt(position.x, 0, position.z - 1.8);
  });
  return null;
}

function World({ playerPosition, gateOpen, bossDefeated, onAttack, onNavigate }: Arena3DProps) {
  const arena = useRef<Group>(null);
  useFrame((state) => {
    if (arena.current) arena.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.08) * 0.015;
  });
  return (
    <>
      <color attach="background" args={["#0b1630"]} />
      <fog attach="fog" args={["#0b1630", 13, 34]} />
      <ambientLight intensity={1.35} />
      <directionalLight position={[5, 10, 5]} intensity={2.5} castShadow />
      <pointLight position={[-4, 4, -4]} color="#34d4e8" intensity={18} distance={9} />
      <pointLight position={[6, 3, -5]} color="#ff527f" intensity={14} distance={8} />
      <Stars radius={34} depth={20} count={900} factor={3} saturation={0.5} fade speed={0.7} />
      <group ref={arena}>
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} onPointerDown={(event) => onNavigate({ x: event.point.x, z: event.point.z })}><circleGeometry args={[11, 64]} /><meshStandardMaterial color="#166a62" roughness={0.9} /></mesh>
        <mesh receiveShadow position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[10.6, 11, 64]} /><meshStandardMaterial color="#ffd763" emissive="#8d5d00" emissiveIntensity={0.6} /></mesh>
        <mesh receiveShadow position={[0, 0.03, -1]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[7.8, 48]} /><meshStandardMaterial color="#1aa492" roughness={0.8} /></mesh>
        {[[ -7, 0.6, -3], [-5, 0.55, 5], [2.5, 0.55, 6], [7, 0.6, 2], [-1, 0.5, -7]].map((p, i) => <mesh key={i} position={p as [number, number, number]} castShadow><dodecahedronGeometry args={[0.7, 0]} /><meshStandardMaterial color="#7957c6" /></mesh>)}
        <Crystal position={[-2.7, 1, 1.4]} color="#51f2e6" />
        <Crystal position={[0, 1, -2.3]} color="#a781ff" />
        <Crystal position={[3.1, 1, -0.8]} color="#ffc94d" />
        {!gateOpen && <group position={[2.3, 1.15, -3.8]}><mesh><boxGeometry args={[3.6, 2.3, 0.32]} /><meshStandardMaterial color="#552d88" emissive="#341153" emissiveIntensity={1} /></mesh><Float speed={2}><mesh position={[0, 0, 0.25]}><octahedronGeometry args={[0.48]} /><meshStandardMaterial color="#f3d45b" emissive="#f3d45b" emissiveIntensity={1.5} /></mesh></Float></group>}
        <Guardian defeated={bossDefeated} />
        <Hero position={playerPosition} />
      </group>
      <mesh position={[playerPosition.x, 0.07, playerPosition.z]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.65, 0.77, 28]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.85} /></mesh>
      <group onClick={onAttack} />
      <CameraFollow position={playerPosition} />
    </>
  );
}

export function Arena3D(props: Arena3DProps) {
  return <Canvas shadows camera={{ position: [0, 14, 12], fov: 48 }} dpr={[1, 1.7]} className="h-full w-full"><World {...props} /></Canvas>;
}
