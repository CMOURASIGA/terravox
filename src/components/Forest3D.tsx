import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, MathUtils, Vector3 } from 'three';
import type { Group } from 'three';

export type ForestPosition = { x: number; z: number };
type Props = { position: ForestPosition; moving: boolean; onNavigate: (position: ForestPosition) => void; onPortal: () => void; portalReached: boolean };

const treeLocations: [number, number, number][] = Array.from({ length: 85 }, (_, i) => {
  const angle = i * 2.399963229728653;
  const radius = 4.2 + Math.sqrt(i / 85) * 25;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius - 8;
  return [x, 0, z];
}).filter(([x, , z]) => Math.abs(x) > 2.7 || z < -23 || z > 8);

function Tree({ position, index }: { position: [number, number, number]; index: number }) {
  const scale = 0.78 + (index % 7) * 0.11;
  return <group position={position} scale={scale}>
    <mesh castShadow position={[0, 2.15, 0]}><cylinderGeometry args={[0.22, 0.4, 4.3, 7]} /><meshStandardMaterial color="#60402a" roughness={1}/></mesh>
    {[0, 1, 2].map((n) => <mesh key={n} castShadow position={[0, 3.7 + n * 0.95, 0]}><coneGeometry args={[2.1 - n * 0.35, 2.9, 8]}/><meshStandardMaterial color={index % 3 === 0 ? '#247451' : '#1b5c41'} roughness={1}/></mesh>)}
  </group>;
}

function Explorer({ position, moving }: { position: ForestPosition; moving: boolean }) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const last = useRef(new Vector3(position.x, 0, position.z));
  useFrame((state, delta) => {
    if (!root.current) return;
    const next = new Vector3(position.x, 0, position.z);
    const direction = next.clone().sub(last.current);
    if (direction.lengthSq() > 0.0001) root.current.rotation.y = MathUtils.lerp(root.current.rotation.y, Math.atan2(direction.x, direction.z), Math.min(1, delta * 9));
    root.current.position.lerp(next, Math.min(1, delta * 12));
    last.current.copy(next);
    if (body.current) body.current.position.y = moving ? Math.sin(state.clock.elapsedTime * 13) * 0.085 : 0;
  });
  return <group ref={root} position={[position.x, 0, position.z]}>
    <group ref={body}>
      <mesh castShadow position={[0, 1.55, 0]}><capsuleGeometry args={[0.38, 0.65, 6, 12]}/><meshStandardMaterial color="#168e91" roughness={0.85}/></mesh>
      <mesh castShadow position={[0, 2.55, 0]}><sphereGeometry args={[0.43, 16, 12]}/><meshStandardMaterial color="#e9b68f"/></mesh>
      <mesh castShadow position={[0, 2.86, -0.1]}><sphereGeometry args={[0.44, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6]}/><meshStandardMaterial color="#30241d"/></mesh>
      <mesh castShadow position={[0, 1.55, -0.38]}><boxGeometry args={[0.68, 0.94, 0.35]}/><meshStandardMaterial color="#ae7144"/></mesh>
      {[-0.22, 0.22].map((x) => <group key={x} position={[x, 0, 0]}><mesh castShadow position={[0, 0.65, 0]}><capsuleGeometry args={[0.15, 0.72, 4, 8]}/><meshStandardMaterial color="#293747"/></mesh><mesh castShadow position={[0, 0.18, 0.12]}><boxGeometry args={[0.3, 0.35, 0.55]}/><meshStandardMaterial color="#453124"/></mesh></group>)}
      {[-0.52, 0.52].map((x) => <mesh key={x} castShadow position={[x, 1.63, 0]} rotation={[0, 0, x > 0 ? -0.3 : 0.3]}><capsuleGeometry args={[0.14, 0.65, 4, 8]}/><meshStandardMaterial color="#2aa9a4"/></mesh>)}
    </group>
  </group>;
}

function Portal({ active }: { active: boolean }) {
  const ring = useRef<Group>(null);
  useFrame((state) => { if (ring.current) ring.current.rotation.z = Math.sin(state.clock.elapsedTime) * 0.025; });
  return <group position={[0, 0, -24]}>
    <mesh receiveShadow position={[0, 0.2, 0]}><cylinderGeometry args={[3.4, 3.9, 0.4, 10]}/><meshStandardMaterial color="#5a6d64"/></mesh>
    <group ref={ring} position={[0, 4, 0]}>
      <mesh castShadow><torusGeometry args={[2.8, 0.55, 12, 16]}/><meshStandardMaterial color="#667b71" roughness={0.9}/></mesh>
      <mesh><circleGeometry args={[2.45, 48]}/><meshBasicMaterial color={active ? '#f7d97e' : '#0ccac4'} transparent opacity={0.55} depthWrite={false}/></mesh>
      <pointLight color="#1df5e2" intensity={12} distance={15}/>
    </group>
    {[-3.2, 3.2].map(x=><mesh key={x} castShadow position={[x, 1.8, 0]}><cylinderGeometry args={[0.65, 0.85, 3.6, 8]}/><meshStandardMaterial color="#667b71"/></mesh>)}
  </group>;
}

function FollowCamera({ position }: { position: ForestPosition }) {
  const { camera } = useThree();
  const target = useRef(new Vector3());
  useFrame((_, delta) => {
    const t = Math.min(1, delta * 3.5);
    camera.position.lerp(new Vector3(position.x, 5.3, position.z + 9.8), t);
    target.current.lerp(new Vector3(position.x, 2.1, position.z - 5), t);
    camera.lookAt(target.current);
  });
  return null;
}

function Forest({ position, moving, onNavigate, portalReached }: Props) {
  const groundColor = useMemo(() => new Color('#355d41'), []);
  return <>
    <color attach="background" args={['#9dc4b9']}/>
    <fog attach="fog" args={['#9dc4b9', 18, 58]}/>
    <ambientLight intensity={1.5}/>
    <hemisphereLight args={['#c7e9f3', '#344a2c', 2.1]}/>
    <directionalLight castShadow position={[-8, 17, 6]} intensity={2.4} shadow-mapSize={[1024, 1024]} shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30}/>
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} onPointerDown={(e) => { e.stopPropagation(); onNavigate({ x: MathUtils.clamp(e.point.x, -20, 20), z: MathUtils.clamp(e.point.z, -28, 9) }); }}>
      <planeGeometry args={[90, 90]}/><meshStandardMaterial color={groundColor} roughness={1}/>
    </mesh>
    <mesh receiveShadow position={[0, 0.035, -9]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={(e) => { e.stopPropagation(); onNavigate({ x: MathUtils.clamp(e.point.x, -2.1, 2.1), z: MathUtils.clamp(e.point.z, -27, 9) }); }}>
      <planeGeometry args={[5, 43]}/><meshStandardMaterial color="#9c8765" roughness={1}/>
    </mesh>
    {treeLocations.map((p, i) => <Tree key={i} position={p} index={i}/>)}
    {Array.from({length: 48}, (_,i) => {
      const x = Math.sin(i * 6.28) * (4.2 + (i % 8) * 1.5);
      const z = (i * 7.3) % 39 - 28;
      return <mesh key={i} position={[x, 0.3, z]} castShadow><dodecahedronGeometry args={[0.3 + (i%4)*0.12,0]}/><meshStandardMaterial color={i%2 ? '#4a8152' : '#759064'}/></mesh>;
    })}
    {[-19,-12,-5].map(z => <group key={z} position={[0, 0, z]}>
      {[-2.8,2.8].map(x => <mesh key={x} position={[x, 0.8, 0]} castShadow><boxGeometry args={[0.8, 1.6, 0.8]}/><meshStandardMaterial color="#7a8070"/></mesh>)}
    </group>)}
    <Portal active={portalReached}/>
    <Explorer position={position} moving={moving}/>
    <FollowCamera position={position}/>
  </>;
}

export function Forest3D(props: Props) {
  return <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 5.3, 13], fov: 65, near: 0.1, far: 110 }} style={{ width: '100%', height: '100%', touchAction: 'none' }}><Forest {...props}/></Canvas>;
}
