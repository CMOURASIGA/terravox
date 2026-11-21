import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, MathUtils, Vector3 } from 'three';
import type { Group } from 'three';

export type ForestPosition = { x: number; z: number };
type Props = { position: ForestPosition; moving: boolean; onNavigate: (position: ForestPosition) => void; onPortal: () => void; portalReached: boolean };

const treeLocations: [number, number, number][] = Array.from({ length: 85 }, (_, i) => {
  const angle = i * 2.399963229728653;
  const radius = 5.5 + Math.sqrt(i / 85) * 27;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius - 8;
  return [x, 0, z];
}).filter(([x, , z]) => Math.abs(x) > 2.7 || z < -23 || z > 8);

function Tree({ position, index }: { position: [number, number, number]; index: number }) {
  const scale = 0.8 + (index % 7) * 0.12;
  const palm = index % 3 !== 0;
  const greens = ['#126348', '#16794d', '#268456', '#0d5947', '#328d61'];
  return <group position={position} scale={scale}>
    <mesh castShadow position={[0, 2.7, 0]} rotation={[0, 0, Math.sin(index * 3) * 0.08]}><cylinderGeometry args={[0.19, 0.43, 5.4, 9]}/><meshStandardMaterial color={palm ? '#745139' : '#55412d'} roughness={1}/></mesh>
    {palm ? <>
      {Array.from({ length: 9 }, (_, n) => {
        const angle = n * Math.PI * 2 / 9;
        return <group key={n} position={[0, 5.3, 0]} rotation={[0, angle, 0]}>
          <mesh castShadow position={[0, -0.32, 1.65]} rotation={[-0.34, 0, 0]}><sphereGeometry args={[0.58, 7, 5]}/><meshStandardMaterial color={greens[(index + n) % greens.length]} roughness={0.95}/></mesh>
          <mesh castShadow position={[0, -0.53, 2.35]} rotation={[-0.47, 0, 0]} scale={[0.55, 0.18, 2.2]}><sphereGeometry args={[1, 8, 6]}/><meshStandardMaterial color={greens[(index + n + 1) % greens.length]} side={2}/></mesh>
        </group>;
      })}
      <mesh castShadow position={[0, 5.4, 0]}><sphereGeometry args={[0.8, 8, 6]}/><meshStandardMaterial color="#1c704b"/></mesh>
    </> : [0,1,2,3].map(n => <mesh key={n} castShadow position={[0, 3.6 + n * 0.75, 0]} scale={[1.3 - n * 0.16, 0.6, 1.3 - n * 0.16]}><icosahedronGeometry args={[1.65, 1]}/><meshStandardMaterial color={greens[(index+n)%greens.length]} roughness={1}/></mesh>)}
    {index % 4 === 0 && <mesh position={[0.4, 0.5, 0.4]}><sphereGeometry args={[0.65, 7, 5]}/><meshStandardMaterial color="#39764a"/></mesh>}
  </group>;
}

function ForestAtmosphere() {
  const fireflies = useRef<Group>(null);
  const particles = useMemo(() => Array.from({ length: 38 }, (_, i) => ({
    x: Math.sin(i * 8.31) * (3.5 + (i % 7) * 1.8),
    y: 0.9 + (i % 6) * 0.38,
    z: -26 + (i * 6.19) % 36,
    phase: i * 1.73,
  })), []);
  useFrame(({ clock }) => {
    if (!fireflies.current) return;
    const t = clock.elapsedTime;
    fireflies.current.children.forEach((child, i) => {
      const p = particles[i];
      child.position.set(p.x + Math.sin(t * 0.55 + p.phase) * 0.35, p.y + Math.sin(t * 1.2 + p.phase) * 0.22, p.z);
      child.scale.setScalar(0.7 + Math.sin(t * 2.3 + p.phase) * 0.25);
    });
  });
  return <group ref={fireflies}>
    {particles.map((p, i) => <mesh key={i} position={[p.x,p.y,p.z]}>
      <sphereGeometry args={[0.055, 6, 6]}/>
      <meshBasicMaterial color={i % 4 === 0 ? '#f5d58b' : '#a5ffe2'} transparent opacity={0.78} depthWrite={false}/>
    </mesh>)}
  </group>;
}

function ForestFloor() {
  const details = useMemo(() => Array.from({length: 160}, (_, i) => {
    const z = -30 + (i * 7.73) % 44;
    const side = i % 2 ? 1 : -1;
    const x = side * (3.5 + (i * 5.11) % 22);
    return {x,z,rotation:i * 1.71,scale:0.32 + (i%5)*0.12};
  }), []);
  return <group>
    {details.map((p,i) => <group key={i} position={[p.x,0.05,p.z]} rotation={[0,p.rotation,0]} scale={p.scale}>
      <mesh castShadow position={[0,0.24,0]}><icosahedronGeometry args={[0.5,1]}/><meshStandardMaterial color={i%3===0 ? '#375d39' : '#487b45'} roughness={1}/></mesh>
      {i%4===0 && <mesh position={[0.4,0.35,0.1]} rotation={[0,0.6,0.7]}><coneGeometry args={[0.22,1.1,5]}/><meshStandardMaterial color="#66a65e" side={2}/></mesh>}
    </group>)}
    {Array.from({length:35},(_,i)=><mesh key={i} receiveShadow position={[Math.sin(i*7.1)*1.5,0.062,-27+i*1.05]} rotation={[-Math.PI/2,0,i*2.4]} scale={[0.32+(i%4)*0.16,0.23+(i%3)*0.12,1]}>
      <circleGeometry args={[1,7]}/><meshStandardMaterial color={i%3===0?'#8c795f':'#b29b78'} roughness={1}/>
    </mesh>)}
  </group>;
}

function Explorer({ position, moving }: { position: ForestPosition; moving: boolean }) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const last = useRef(new Vector3(position.x, 0, position.z));
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const head = useRef<Group>(null);
  const stridePhase = useRef(0);
  useFrame((state, delta) => {
    if (!root.current) return;
    const next = new Vector3(position.x, 0, position.z);
    const direction = next.clone().sub(last.current);
    if (direction.lengthSq() > 0.0001) root.current.rotation.y = MathUtils.lerp(root.current.rotation.y, Math.atan2(direction.x, direction.z), Math.min(1, delta * 9));
    root.current.position.lerp(next, Math.min(1, delta * 12));
    last.current.copy(next);
    if (moving) stridePhase.current += delta * 8.5;
    const stride = moving ? Math.sin(stridePhase.current) * 0.48 : 0;
    if (body.current) body.current.position.y = moving ? Math.abs(Math.sin(state.clock.elapsedTime * 9)) * 0.055 : 0;
    if (leftLeg.current) leftLeg.current.rotation.x = MathUtils.damp(leftLeg.current.rotation.x, stride, 12, delta);
    if (rightLeg.current) rightLeg.current.rotation.x = MathUtils.damp(rightLeg.current.rotation.x, -stride, 12, delta);
    if (leftArm.current) leftArm.current.rotation.x = MathUtils.damp(leftArm.current.rotation.x, -stride * 0.7, 12, delta);
    if (rightArm.current) rightArm.current.rotation.x = MathUtils.damp(rightArm.current.rotation.x, stride * 0.7, 12, delta);
    if (head.current) head.current.rotation.z = MathUtils.damp(head.current.rotation.z, moving ? Math.sin(stridePhase.current * 0.5) * 0.035 : 0, 6, delta);
  });
  return <group ref={root} position={[position.x, 0, position.z]}>
    <group ref={body}>
      <mesh castShadow position={[0, 1.55, 0]}><capsuleGeometry args={[0.38, 0.65, 6, 12]}/><meshStandardMaterial color="#168e91" roughness={0.85}/></mesh>
      <group ref={head} position={[0,2.55,0]}>
        <mesh castShadow><sphereGeometry args={[0.43, 20, 16]}/><meshStandardMaterial color="#e9b68f" roughness={0.86}/></mesh>
        <mesh castShadow position={[0,0.28,-0.09]}><sphereGeometry args={[0.445, 16, 12, 0, Math.PI*2, 0, Math.PI*0.58]}/><meshStandardMaterial color="#30241d" roughness={1}/></mesh>
        {[-0.17,0.17].map(x=><group key={x} position={[x,0.045,0.385]}>
          <mesh scale={[1,0.75,0.45]}><sphereGeometry args={[0.105,12,10]}/><meshStandardMaterial color="#f9f4e8"/></mesh>
          <mesh position={[0,0,0.044]}><sphereGeometry args={[0.047,10,10]}/><meshStandardMaterial color="#254b49"/></mesh>
          <mesh position={[0,0,0.082]}><sphereGeometry args={[0.022,8,8]}/><meshBasicMaterial color="#101b20"/></mesh>
        </group>)}
        <mesh position={[0,-0.11,0.425]}><sphereGeometry args={[0.075,9,8]}/><meshStandardMaterial color="#d79575"/></mesh>
        <mesh position={[0,-0.245,0.335]} scale={[1,0.35,0.35]}><sphereGeometry args={[0.13,12,8]}/><meshStandardMaterial color="#864b45"/></mesh>
        <mesh castShadow position={[0,0.42,0]} rotation={[0.08,0,0]}><sphereGeometry args={[0.48,16,8,0,Math.PI*2,0,Math.PI*0.42]}/><meshStandardMaterial color="#345b55"/></mesh>
        <mesh castShadow position={[0,0.29,0.24]} rotation={[0.2,0,0]}><cylinderGeometry args={[0.36,0.37,0.09,16]}/><meshStandardMaterial color="#27433d"/></mesh>
      </group>
      <mesh castShadow position={[0, 1.55, -0.38]}><boxGeometry args={[0.68, 0.94, 0.35]}/><meshStandardMaterial color="#ae7144"/></mesh>

      <mesh castShadow position={[0, 1.6, 0.37]}><boxGeometry args={[0.55, 0.1, 0.12]}/><meshStandardMaterial color="#d9b26a"/></mesh>
      <mesh castShadow position={[0,1.5,0.43]}><boxGeometry args={[0.36,0.48,0.14]}/><meshStandardMaterial color="#315d55"/></mesh>
      {[-0.28,0.28].map(x=><mesh key={x} castShadow position={[x,1.65,-0.18]} rotation={[0,0,x*0.32]}><boxGeometry args={[0.1,1.05,0.14]}/><meshStandardMaterial color="#c48d4f"/></mesh>)}
      <mesh position={[0,1.16,0.03]}><cylinderGeometry args={[0.39,0.39,0.13,12]}/><meshStandardMaterial color="#694f35"/></mesh>
      <mesh position={[0,1.16,0.38]}><boxGeometry args={[0.16,0.14,0.07]}/><meshStandardMaterial color="#e8c17a" metalness={0.55} roughness={0.4}/></mesh>
      {[-0.22, 0.22].map((x) => <group key={x} ref={x < 0 ? leftLeg : rightLeg} position={[x, 1.08, 0]}><group position={[0, -1.08, 0]}><mesh castShadow position={[0, 0.65, 0]}><capsuleGeometry args={[0.15, 0.72, 4, 8]}/><meshStandardMaterial color="#293747"/></mesh><mesh castShadow position={[0, 0.18, 0.12]}><boxGeometry args={[0.3, 0.35, 0.55]}/><meshStandardMaterial color="#453124"/></mesh></group></group>)}
      {[-0.52, 0.52].map((x) => <group key={x} ref={x < 0 ? leftArm : rightArm} position={[x, 1.98, 0]}><mesh castShadow position={[0, -0.35, 0]} rotation={[0, 0, x > 0 ? -0.3 : 0.3]}><capsuleGeometry args={[0.14, 0.65, 4, 8]}/><meshStandardMaterial color="#2aa9a4"/></mesh><mesh castShadow position={[0, -0.76, 0]}><sphereGeometry args={[0.14, 10, 8]}/><meshStandardMaterial color="#e9b68f"/></mesh></group>)}
    </group>
  </group>;
}

function Portal({ active }: { active: boolean }) {
  const ring = useRef<Group>(null);
  useFrame((state) => { if (ring.current) ring.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.7) * 0.012; });
  return <group position={[0, 0, -24]}>
    {[0,1,2].map(i=><mesh key={i} receiveShadow position={[0, 0.2+i*0.19, 0.6+i*0.25]}><cylinderGeometry args={[4.6-i*0.45, 4.9-i*0.45, 0.32, 10]}/><meshStandardMaterial color={i%2 ? '#555e55' : '#788075'} roughness={1}/></mesh>)}
    <group ref={ring} position={[0, 4.7, -0.3]}>
      <mesh castShadow><torusGeometry args={[3.15, 0.68, 9, 12]}/><meshStandardMaterial color="#586c61" roughness={0.95}/></mesh>
      <mesh><torusGeometry args={[2.95, 0.12, 8, 32]}/><meshStandardMaterial color="#62f3dd" emissive="#1ab6b0" emissiveIntensity={1.6}/></mesh>
      <mesh><circleGeometry args={[2.55, 40]}/><meshBasicMaterial color={active ? '#f7d97e' : '#11bcb8'} transparent opacity={0.68} depthWrite={false}/></mesh>
      <pointLight color="#1df5e2" intensity={22} distance={19}/>
    </group>
    {[-3.4, 3.4].map(x=><group key={x} position={[x,0,-0.3]}>
      <mesh castShadow position={[0,2.2,0]}><boxGeometry args={[1.5,4.4,1.4]}/><meshStandardMaterial color="#59665d" roughness={1}/></mesh>
      {[0.65,1.55,2.45,3.35].map(y=><mesh key={y} position={[0, y, 0.73]}><boxGeometry args={[1.35,0.09,0.08]}/><meshStandardMaterial color="#91a392"/></mesh>)}
      <mesh castShadow position={[0,4.6,0]}><boxGeometry args={[1.9,0.6,1.8]}/><meshStandardMaterial color="#6e7d6c"/></mesh>
      <mesh position={[x>0 ? -0.45 : 0.45,4.8,0.75]}><sphereGeometry args={[0.2,8,8]}/><meshStandardMaterial color="#65f5d6" emissive="#10c5bd" emissiveIntensity={2}/></mesh>
    </group>)}
    {Array.from({length:14},(_,i)=><mesh key={i} position={[(i%7-3)*1.1, 0.2+(i%3)*0.12, 1.2+Math.floor(i/7)*0.9]} rotation={[i*0.2,i*0.8,i*0.12]} castShadow><dodecahedronGeometry args={[0.2+(i%3)*0.09,0]}/><meshStandardMaterial color={i%2 ? '#6c796b':'#536b61'} roughness={1}/></mesh>)}
  </group>;
}

function FollowCamera({ position }: { position: ForestPosition }) {
  const { camera } = useThree();
  const target = useRef(new Vector3());
  useFrame((_, delta) => {
    const t = Math.min(1, delta * 3.5);
    camera.position.lerp(new Vector3(position.x, position.z < -19 ? 6.3 : 5.3, position.z + (position.z < -19 ? 6.6 : 9.8)), t);
    target.current.lerp(new Vector3(position.x, position.z < -19 ? 3.2 : 2.1, position.z < -19 ? -24 : position.z - 5), t);
    camera.lookAt(target.current);
  });
  return null;
}

function Forest({ position, moving, onNavigate, portalReached }: Props) {
  const groundColor = useMemo(() => new Color('#284f38'), []);
  return <>
    <color attach="background" args={['#8aaeb2']}/>
    <fog attach="fog" args={['#8aaeb2', 23, 72]}/>
    <ambientLight intensity={0.75}/>
    <hemisphereLight args={['#c7e9f3', '#243e2c', 1.2]}/>
    <directionalLight castShadow position={[-8, 17, 6]} intensity={2.7} shadow-mapSize={[2048, 2048]} shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30}/>
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} onPointerDown={(e) => { e.stopPropagation(); onNavigate({ x: MathUtils.clamp(e.point.x, -20, 20), z: MathUtils.clamp(e.point.z, -28, 9) }); }}>
      <planeGeometry args={[90, 90]}/><meshStandardMaterial color={groundColor} roughness={1}/>
    </mesh>
    <mesh receiveShadow position={[0, 0.035, -9]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={(e) => { e.stopPropagation(); onNavigate({ x: MathUtils.clamp(e.point.x, -2.1, 2.1), z: MathUtils.clamp(e.point.z, -27, 9) }); }}>
      <planeGeometry args={[5, 43]}/><meshStandardMaterial color="#9e8562" roughness={1}/>
    </mesh>
    {treeLocations.map((p, i) => <Tree key={i} position={p} index={i}/>)}
    {Array.from({length: 24},(_,i)=>{
      const z = -28+(i*3.71)%40, side = i%2 ? 1:-1;
      const x = side*(3.7+(i%5)*0.5);
      return <group key={'fern'+i} position={[x,0,z]}>
        {Array.from({length:7},(_,j)=><mesh key={j} position={[Math.sin(j*2.4)*0.4,0.45,Math.cos(j*2.4)*0.4]} rotation={[0,j*Math.PI*2/7,0]} scale={[0.17,0.7,0.4]}><sphereGeometry args={[1,6,5]}/><meshStandardMaterial color={j%2 ? '#2d9b65':'#1d7854'}/></mesh>)}
      </group>;
    })}
    {Array.from({length:18},(_,i)=>{
      const z=-25+i*2.1, x=(i%2 ? 1:-1)*(5.2+(i%3)*0.5);
      return <mesh key={'rock'+i} castShadow position={[x,0.28,z]} rotation={[i*0.15,i*1.7,i*0.11]} scale={[0.8+(i%3)*0.25,0.45,0.6]}><dodecahedronGeometry args={[1,0]}/><meshStandardMaterial color={i%2?'#68776c':'#4f655c'} roughness={1}/></mesh>;
    })}
    {Array.from({length: 48}, (_,i) => {
      const x = Math.sin(i * 6.28) * (4.2 + (i % 8) * 1.5);
      const z = (i * 7.3) % 39 - 28;
      return <mesh key={i} position={[x, 0.3, z]} castShadow><dodecahedronGeometry args={[0.3 + (i%4)*0.12,0]}/><meshStandardMaterial color={i%2 ? '#4a8152' : '#759064'}/></mesh>;
    })}
    {[-19,-12,-5].map(z => <group key={z} position={[0, 0, z]}>
      {[-2.8,2.8].map(x => <mesh key={x} position={[x, 0.8, 0]} castShadow><boxGeometry args={[0.8, 1.6, 0.8]}/><meshStandardMaterial color="#7a8070"/></mesh>)}
    </group>)}
    <ForestFloor/>
    <ForestAtmosphere/>
    <Portal active={portalReached}/>
    <Explorer position={position} moving={moving}/>
    <FollowCamera position={position}/>
  </>;
}

export function Forest3D(props: Props) {
  return <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 5.3, 13], fov: 65, near: 0.1, far: 110 }} style={{ width: '100%', height: '100%', touchAction: 'none' }}><Forest {...props}/></Canvas>;
}
