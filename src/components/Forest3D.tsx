import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedExplorer, ForestCinematicAssets, ForestNature, StylizedForestTrees, FOREST_V2_ASSETS } from './ForestCinematicAssets';
import { Color, MathUtils, Vector3 } from 'three';
import type { Group } from 'three';

export type ForestPosition = { x: number; z: number };
type Props = { position: ForestPosition; moving: boolean; onNavigate: (position: ForestPosition) => void; onPortal: () => void; portalReached: boolean };

const treeLocations: [number, number, number][] = Array.from({ length: 85 }, (_, i) => {
  const angle = i * 2.399963229728653;
  const radius = 9.5 + Math.sqrt(i / 85) * 27;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius - 8;
  return [x, 0, z] as [number, number, number];
}).filter(([x, , z]) => {
  // Maintain a wide sightline from the explorer to the portal, including the camera's
  // trailing corridor. Dense vegetation belongs outside the playable sightline.
  const clearWidth = z >= -28 && z <= 13 ? 6.8 : 3.8;
  return Math.abs(x) > clearWidth;
});

function Tree({ position, index }: { position: [number, number, number]; index: number }) {
  // Layered Atlantic-forest canopy, buttress roots and asymmetric branching.
  // Meshes use smooth organic silhouettes instead of the original cone/sphere trees.
  const scale = 0.76 + (index % 7) * 0.065;
  const tall = index % 4 !== 0;
  const height = tall ? 10.2 + (index % 4) * 0.95 : 6.4 + (index % 3) * 0.7;
  const palette = ['#1a6041', '#256c46', '#327b4b', '#1e5940', '#477d4d', '#4c8552'];
  const trunk = index % 3 === 0 ? '#665039' : '#554333';
  const branches = Array.from({ length: tall ? 5 : 4 }, (_, n) => {
    const angle = n * 2.399963 + index * 0.83;
    const y = height * (0.57 + (n % 4) * 0.09);
    const reach = 1.25 + (n % 3) * 0.35;
    return { angle, y, reach, radius: 1.02 + (n % 3) * 0.16 };
  });
  return <group position={position} scale={scale} rotation={[0, index * 1.71, 0]}>
    <mesh castShadow receiveShadow position={[0, height * 0.5, 0]} rotation={[0, 0, Math.sin(index * 2.7) * 0.045]}>
      <cylinderGeometry args={[0.24, 0.62, height, 12, 6]}/>
      <meshStandardMaterial color={trunk} roughness={1}/>
    </mesh>
    {[0,1,2,3,4].map(n => <mesh key={'root'+n} castShadow position={[Math.sin(n*1.256)*0.6,0.36,Math.cos(n*1.256)*0.6]} rotation={[Math.cos(n*1.256)*0.55,0,Math.sin(n*1.256)*0.55]}>
      <coneGeometry args={[0.28,1.65,5]}/><meshStandardMaterial color={trunk} roughness={1}/>
    </mesh>)}
    {branches.map((branch,n)=><group key={n} position={[0,branch.y,0]} rotation={[0,branch.angle,0]}>
      <mesh castShadow position={[0,0.2,branch.reach*0.46]} rotation={[-0.58,0,0]}>
        <cylinderGeometry args={[0.07,0.17,branch.reach*1.5,7]}/><meshStandardMaterial color={trunk} roughness={1}/>
      </mesh>
      <mesh castShadow receiveShadow position={[0,0.38,branch.reach]} scale={[branch.radius*1.18,0.83+(n%3)*0.12,branch.radius*0.94]}>
        <icosahedronGeometry args={[1,2]}/><meshStandardMaterial color={palette[(index+n)%palette.length]} roughness={0.96} flatShading={false}/>
      </mesh>
      <mesh castShadow position={[0.45,0.78,branch.reach+0.15]} scale={[0.84,0.59,0.8]}>
        <icosahedronGeometry args={[1,2]}/><meshStandardMaterial color={palette[(index+n+2)%palette.length]} roughness={1}/>
      </mesh>
    </group>)}
    <mesh castShadow receiveShadow position={[0,height+0.15,0]} scale={[1.75,1.23,1.7]}>
      <icosahedronGeometry args={[1,2]}/><meshStandardMaterial color={palette[(index+2)%palette.length]} roughness={1}/>
    </mesh>
    {index % 3 === 0 && <group position={[0.55,0.5,0.55]}>
      {[0,1,2].map(n=><mesh key={n} castShadow rotation={[0,n*2.1,-0.45]} position={[Math.sin(n*2.1)*0.4,0.2,Math.cos(n*2.1)*0.4]} scale={[0.28,0.75,0.16]}>
        <sphereGeometry args={[1,8,8]}/><meshStandardMaterial color="#438b4c" roughness={1}/>
      </mesh>)}
    </group>}
  </group>;
}

function ForestSpirit({ position, moving }: { position: ForestPosition; moving: boolean }) {
  const spirit = useRef<Group>(null);
  const wings = useRef<Group>(null);
  useFrame(({ clock }, delta) => {
    if (!spirit.current) return;
    const t = clock.elapsedTime;
    const destination = new Vector3(position.x + 1.3 + Math.sin(t * 0.7) * 0.35, 1.9 + Math.sin(t * 2.1) * 0.2, position.z + 1.15 + (moving ? 0.45 : 0));
    spirit.current.position.lerp(destination, Math.min(1, delta * 3.8));
    spirit.current.rotation.y = Math.sin(t * 0.8) * 0.3;
    if (wings.current) wings.current.rotation.z = Math.sin(t * 12) * 0.28;
  });
  return <group ref={spirit} position={[position.x + 1.3, 1.9, position.z + 1.15]}>
    <pointLight color="#a0ffe5" intensity={1.7} distance={5}/>
    {/* The companion is a small forest guardian, not just a floating light. */}
    <mesh position={[0,-0.37,-0.025]} rotation={[0,0,Math.PI]} castShadow>
      <coneGeometry args={[0.20,0.64,10]}/>
      <meshStandardMaterial color="#78c6ac" emissive="#1b857c" emissiveIntensity={0.35} roughness={0.85}/>
    </mesh>
    <mesh position={[0,0.06,0]} castShadow>
      <sphereGeometry args={[0.30,24,20]}/>
      <meshStandardMaterial color="#d4f7e6" emissive="#5bd2b7" emissiveIntensity={0.85} roughness={0.64}/>
    </mesh>
    {[-1,1].map(side=><group key={'ear'+side} position={[side*0.27,0.19,0]} rotation={[0,0,side*-0.45]}>
      <mesh castShadow position={[0,0.15,0]} scale={[0.75,1.25,0.42]}>
        <coneGeometry args={[0.17,0.47,9]}/>
        <meshStandardMaterial color="#a4ead3" emissive="#43a992" emissiveIntensity={0.35}/>
      </mesh>
    </group>)}
    <mesh position={[0,0.34,-0.07]} rotation={[0,0,-0.22]}>
      <coneGeometry args={[0.10,0.32,8]}/>
      <meshStandardMaterial color="#a9d7a4" roughness={1}/>
    </mesh>
    <mesh position={[0.11,0.35,-0.07]} rotation={[0,0,0.34]}>
      <coneGeometry args={[0.08,0.25,8]}/>
      <meshStandardMaterial color="#8cc99a" roughness={1}/>
    </mesh>
    <mesh position={[0, -0.24, 0]} scale={[0.8, 1.2, 0.75]}><sphereGeometry args={[0.22, 14, 10]}/><meshStandardMaterial color="#b4f6e1" emissive="#39c8ad" emissiveIntensity={0.9}/></mesh>
    <group ref={wings}>
      {[-1,1].map(side => <mesh key={side} position={[side * 0.36, 0.05, -0.08]} rotation={[0, side * 0.32, side * -0.25]} scale={[0.36, 0.56, 0.08]}>
        <sphereGeometry args={[1, 12, 10]}/><meshStandardMaterial color="#b9fff1" emissive="#44d9c5" emissiveIntensity={0.7} transparent opacity={0.72} depthWrite={false}/>
      </mesh>)}
    </group>
    {[-0.1,0.1].map(x => <mesh key={x} position={[x,0.045,0.253]}><sphereGeometry args={[0.035,8,8]}/><meshBasicMaterial color="#174f4a"/></mesh>)}
    <mesh position={[0,-0.075,0.26]} scale={[1,0.35,0.5]}><sphereGeometry args={[0.065,10,8]}/><meshBasicMaterial color="#317b6b"/></mesh>
  </group>;
}

function ForestCanopyLight() {
  const beams = useMemo(() => Array.from({ length: 11 }, (_, i) => ({
    x: Math.sin(i * 4.9) * 17, z: -28 + (i * 5.7) % 37, angle: -0.12 + i * 0.028,
  })), []);
  return <group>
    {beams.map((p, i) => <mesh key={i} position={[p.x, 8, p.z]} rotation={[0,0,p.angle]}>
      <coneGeometry args={[1.1 + (i % 3) * 0.3, 16, 12, 1, true]}/>
      <meshBasicMaterial color="#fff2bf" transparent opacity={0.035} depthWrite={false} side={2}/>
    </mesh>)}
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
  const energy = useRef<Group>(null);
  const motes = useRef<Group>(null);
  const portalSurface = useRef<import('three').ShaderMaterial>(null);
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    if (portalSurface.current) {
      portalSurface.current.uniforms.uTime.value = t;
      portalSurface.current.uniforms.uActive.value = MathUtils.damp(portalSurface.current.uniforms.uActive.value, active ? 1 : 0, 2.5, delta);
    }
    if (energy.current) {
      energy.current.rotation.z = t * 0.07;
      const pulse = 1 + Math.sin(t * 1.8) * 0.035;
      energy.current.scale.set(pulse, pulse, 1);
    }
    if (motes.current) motes.current.rotation.z += delta * 0.025;
  });
  return <group position={[0,0,-24]}>
    {[0,1,2,3].map(i=><mesh key={'step'+i} receiveShadow position={[0,0.12+i*0.18,0.8+i*0.33]}>
      <cylinderGeometry args={[4.4-i*0.28,4.55-i*0.28,0.25,16]}/>
      <meshStandardMaterial color={i%2?'#536457':'#7d8973'} roughness={1}/>
    </mesh>)}
    <group position={[0,4.55,-0.3]}>
      <mesh castShadow receiveShadow>
        <torusGeometry args={[3.15,0.57,16,48]}/>
        <meshStandardMaterial color="#626f61" roughness={0.95} metalness={0.04}/>
      </mesh>
      {Array.from({length:24},(_,i)=>{
        const angle = i*Math.PI*2/24;
        return <mesh key={'rune'+i} position={[Math.sin(angle)*3.15,Math.cos(angle)*3.15,0.54]} rotation={[0,0,-angle]} scale={[0.12,0.27,0.065]}>
          <octahedronGeometry args={[1,0]}/>
          <meshStandardMaterial color={i%3===0?'#c3f8dc':'#8ec5b2'} emissive="#2bbfa8" emissiveIntensity={active?2.5:0.7}/>
        </mesh>;
      })}
      <group ref={energy}>
        <mesh>
          <circleGeometry args={[2.58,96]}/>
          <shaderMaterial
            ref={portalSurface}
            transparent
            depthWrite={false}
            side={2}
            uniforms={{
              uTime: { value: 0 },
              uActive: { value: active ? 1 : 0 },
            }}
            vertexShader={`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
            fragmentShader={`uniform float uTime; uniform float uActive; varying vec2 vUv;
              void main() {
                vec2 p = (vUv - 0.5) * 2.0;
                float r = length(p);
                float angle = atan(p.y, p.x);
                float swirl = sin(angle * 5.0 - r * 11.0 + uTime * 0.8);
                float veins = sin(p.y * 22.0 + sin(p.x * 10.0 + uTime) * 3.0 - uTime * 1.4);
                float halo = pow(1.0 - smoothstep(0.62, 1.0, r), 1.3);
                vec3 teal = vec3(0.09, 0.56, 0.53);
                vec3 gold = vec3(0.99, 0.70, 0.38);
                vec3 color = mix(teal, gold, uActive);
                color += vec3(0.20, 0.44, 0.36) * max(0.0, swirl) * 0.42;
                color += vec3(0.32, 0.50, 0.42) * max(0.0, veins) * 0.16;
                float alpha = halo * (0.57 + 0.14 * swirl) * (0.88 + 0.12 * sin(uTime * 1.6));
                gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.86));
              }`}
          />
        </mesh>
        <mesh position={[0,0,0.04]}>
          <torusGeometry args={[2.38,0.045,8,72]}/>
          <meshBasicMaterial color="#9ffff0" transparent opacity={0.85}/>
        </mesh>
        <mesh position={[0,0,0.03]} rotation={[0,0,Math.PI*0.31]}>
          <torusGeometry args={[1.98,0.035,8,72]}/>
          <meshBasicMaterial color="#8fe7d2" transparent opacity={0.65}/>
        </mesh>
      </group>
      <group ref={motes}>
        {Array.from({length:28},(_,i)=>{
          const angle = i*2.399963;
          const radius = 1.05+(i%7)*0.19;
          return <mesh key={'mote'+i} position={[Math.sin(angle)*radius,Math.cos(angle)*radius,0.12+(i%3)*0.06]}>
            <sphereGeometry args={[0.028+(i%3)*0.018,6,6]}/>
            <meshBasicMaterial color={i%4===0?'#ffe8b1':'#adfff1'}/>
          </mesh>;
        })}
      </group>
      <pointLight color={active?'#ffd49c':'#51ebdb'} intensity={active?29:17} distance={17}/>
    </group>
    {[-3.4,3.4].map((x,i)=><group key={x} position={[x,0,-0.3]}>
      <mesh castShadow receiveShadow position={[0,2.15,0]}>
        <cylinderGeometry args={[0.79,1.06,4.3,8]}/>
        <meshStandardMaterial color="#58695b" roughness={1}/>
      </mesh>
      {[0.65,1.5,2.35,3.2].map(y=><mesh key={y} position={[0,y,0.75]} rotation={[0,0,i===0?-0.04:0.04]}>
        <boxGeometry args={[1.25,0.085,0.1]}/>
        <meshStandardMaterial color="#8da18d"/>
      </mesh>)}
      <mesh castShadow position={[0,4.43,0]}>
        <cylinderGeometry args={[0.98,0.81,0.55,8]}/>
        <meshStandardMaterial color="#697b69"/>
      </mesh>
      <mesh position={[0,4.87,0]}><octahedronGeometry args={[0.27,1]}/>
        <meshStandardMaterial color="#a2ffde" emissive="#3ff5c4" emissiveIntensity={2.5}/>
      </mesh>
    </group>)}
    {Array.from({length:20},(_,i)=><mesh key={'debris'+i} castShadow receiveShadow
      position={[(i%10-4.5)*0.84,0.2+(i%3)*0.08,1.5+Math.floor(i/10)*0.88]}
      rotation={[i*0.28,i*0.81,i*0.17]}>
      <dodecahedronGeometry args={[0.19+(i%4)*0.065,1]}/>
      <meshStandardMaterial color={i%2?'#677b6a':'#7f8b78'} roughness={1}/>
    </mesh>)}
  </group>;
}

function FollowCamera({ position }: { position: ForestPosition; moving: boolean }) {
  const { camera } = useThree();
  const lookAt = useRef(new Vector3(0, 1.6, -4));
  const initialized = useRef(false);
  useFrame((_, delta) => {
    // Fixed forward-facing chase camera: the portal is at negative Z.
    // Do not spin the camera when the player strafes or reverses.
    // That previously placed foreground trees between the player and the lens.
    const cameraGoal = new Vector3(position.x, 3.65, position.z + 6.4);
    const targetGoal = new Vector3(position.x, 1.7, position.z - 4.2);
    if (!initialized.current) {
      camera.position.copy(cameraGoal);
      lookAt.current.copy(targetGoal);
      initialized.current = true;
    } else {
      const follow = 1 - Math.exp(-delta * 3.5);
      camera.position.lerp(cameraGoal, follow);
      lookAt.current.lerp(targetGoal, follow);
    }
    camera.lookAt(lookAt.current);
  });
  return null;
}

function ScenicBackdrop() {
  const clouds = useRef<Group>(null);
  useFrame(({clock}) => {
    if (clouds.current) clouds.current.position.x = Math.sin(clock.elapsedTime * 0.045) * 2.2;
  });
  return <group>
    <mesh position={[0, 28, -75]}>
      <planeGeometry args={[260, 115]}/>
      <shaderMaterial depthWrite={false} vertexShader={`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`} fragmentShader={`varying vec2 vUv; void main(){vec3 horizon=vec3(.68,.79,.75);vec3 mid=vec3(.40,.64,.69);vec3 zenith=vec3(.12,.31,.43);float h=clamp(vUv.y,0.,1.);vec3 c=mix(horizon,mid,smoothstep(.05,.58,h));c=mix(c,zenith,smoothstep(.55,1.,h));float sun=exp(-length((vUv-vec2(.27,.50))*vec2(1.5,1.0))*17.);c+=vec3(.40,.29,.13)*sun;gl_FragColor=vec4(c,1.);}`}/>
    </mesh>
    {Array.from({length:23},(_,i)=>{
      const x=(i-11)*9.5;
      const height=9+(Math.sin(i*2.47)+1)*5;
      return <group key={i} position={[x,-0.2,-57+(i%4)*4]}>
        <mesh rotation={[0,i*0.29,0]} position={[0,height*0.38,0]} scale={[1.6,height/10,1]}>
          <coneGeometry args={[7,10,5]}/><meshStandardMaterial color={i%3===0?'#526d70':i%3===1?'#607e7b':'#73918b'} roughness={1}/>
        </mesh>
        <mesh rotation={[0,i*0.29,0]} position={[0,height*0.80,0]} scale={[1.65,height/10,1.03]}>
          <coneGeometry args={[2.1,3.2,5]}/><meshStandardMaterial color="#c2d5c9" roughness={1}/>
        </mesh>
      </group>;
    })}
    <group ref={clouds}>
      {Array.from({length:13},(_,i)=><group key={i} position={[(i-6)*12,19+(i%4)*3,-48-(i%3)*5]}>
        {[0,1,2,3].map(j=><mesh key={j} position={[(j-1.5)*2,Math.sin(j*2+i)*0.5,0]} scale={[2.7+(j%2),0.65+(j%3)*0.15,0.7]}>
          <sphereGeometry args={[1,12,8]}/><meshBasicMaterial color="#f2e8d5" transparent opacity={0.26} depthWrite={false}/>
        </mesh>)}
      </group>)}
    </group>
  </group>;
}

function TrailDetails() {
  const grass = useMemo(()=>Array.from({length:340},(_,i)=>{
    const z=-29+(i*6.17)%43;
    const side=i%2===0?-1:1;
    const x=side*(2.6+(i*3.79)%20);
    return {x,z,scale:0.4+(i%5)*0.16,phase:i*1.71};
  }),[]);
  const flowers = useMemo(()=>Array.from({length:90},(_,i)=>{
    const z=-29+(i*4.83)%42;
    const x=(i%2?-1:1)*(3.2+(i*2.37)%16);
    return {x,z,color:['#f5b94e','#eeb3cb','#c7e8f0','#e6d795'][i%4]};
  }),[]);
  return <group>
    {grass.map((p,i)=><group key={i} position={[p.x,0.1,p.z]} rotation={[0,p.phase,0]} scale={p.scale}>
      {[-0.28,0,0.28].map((a,j)=><mesh key={j} position={[a,0.42,0]} rotation={[0,0,a*1.8]}>
        <coneGeometry args={[0.13,0.95+(j%2)*0.28,3]}/><meshStandardMaterial color={j===0?'#2d7750':j===1?'#4d9d5b':'#75a964'} side={2}/>
      </mesh>)}
    </group>)}
    {flowers.map((p,i)=><group key={i} position={[p.x,0.3,p.z]}>
      <mesh position={[0,0.19,0]}><cylinderGeometry args={[0.016,0.02,0.4,5]}/><meshStandardMaterial color="#477f4b"/></mesh>
      {[0,1,2,3,4].map(j=><mesh key={j} position={[Math.sin(j*1.256)*0.11,0.41,Math.cos(j*1.256)*0.11]}>
        <sphereGeometry args={[0.07,6,5]}/><meshStandardMaterial color={p.color} emissive={p.color} emissiveIntensity={0.12}/>
      </mesh>)}
      <mesh position={[0,0.42,0]}><sphereGeometry args={[0.05,8,6]}/><meshStandardMaterial color="#e8a834"/></mesh>
    </group>)}
    {[-2.65,2.65].map(side=><group key={side}>
      {Array.from({length:30},(_,i)=><mesh key={i} castShadow position={[side,0.12,-29+i*1.42]} rotation={[0,i*2.19,0]} scale={[0.5+(i%3)*0.14,0.22,0.3+(i%4)*0.1]}>
        <dodecahedronGeometry args={[1,0]}/><meshStandardMaterial color={i%3===0?'#78867a':i%3===1?'#667b6c':'#9a9a82'} roughness={1}/>
      </mesh>)}
    </group>)}
    {[-19,-12,-5].map(z=>[-3.2,3.2].map(x=><group key={z+'-'+x} position={[x,0,z]}>
      <mesh castShadow position={[0,0.55,0]}><cylinderGeometry args={[0.36,0.5,1.1,8]}/><meshStandardMaterial color="#5d675f"/></mesh>
      <mesh position={[0,1.16,0]}><cylinderGeometry args={[0.31,0.38,0.13,8]}/><meshStandardMaterial color="#8a8c78"/></mesh>
      <mesh position={[0,1.46,0]}><octahedronGeometry args={[0.32,0]}/><meshStandardMaterial color="#a7fff0" emissive="#2be4c3" emissiveIntensity={1.8}/></mesh>
      <pointLight position={[0,1.5,0]} intensity={2.2} distance={5} color="#6affd4"/>
    </group>))}
  </group>;
}

function Forest({ position, moving, onNavigate, portalReached, stylizedReady, explorerReady }: Props & { stylizedReady: boolean; explorerReady: boolean }) {
  const groundColor = useMemo(() => new Color('#284f38'), []);
  return <>
    <color attach="background" args={['#739da4']}/>
    <ScenicBackdrop/>
    <fog attach="fog" args={['#739da4', 40, 110]}/>
    <ambientLight intensity={0.24}/>
    <hemisphereLight args={['#d7f5ed', '#1a3429', 0.95]}/>
    <directionalLight castShadow position={[-18, 25, 12]} intensity={2.3} shadow-mapSize={[2048, 2048]} shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30}/>
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} onPointerDown={(e) => { e.stopPropagation(); onNavigate({ x: MathUtils.clamp(e.point.x, -20, 20), z: MathUtils.clamp(e.point.z, -28, 9) }); }}>
      <planeGeometry args={[90, 90]}/><meshStandardMaterial color={groundColor} roughness={1}/>
    </mesh>
    <mesh receiveShadow position={[0, 0.035, -9]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={(e) => { e.stopPropagation(); onNavigate({ x: MathUtils.clamp(e.point.x, -2.1, 2.1), z: MathUtils.clamp(e.point.z, -27, 9) }); }}>
      <planeGeometry args={[5, 43]}/><meshStandardMaterial color="#9e8562" roughness={1}/>
    </mesh>
    {stylizedReady ? <Suspense fallback={null}><StylizedForestTrees/></Suspense> : treeLocations.map((p, i) => <Tree key={i} position={p} index={i}/>)}
    {/* Real licensed nature replaces placeholder ferns and rocks in the playable scene. */}
    <Suspense fallback={null}><ForestNature/></Suspense>
    <ForestFloor/>
    <TrailDetails/>
    <ForestAtmosphere/>
    <ForestCanopyLight/>
    <ForestSpirit position={position} moving={moving}/>
    <Portal active={portalReached}/>
    {explorerReady ? <Suspense fallback={null}><AnimatedExplorer position={position} moving={moving}/></Suspense> : <Explorer position={position} moving={moving}/>}
    <FollowCamera position={position} moving={moving}/>
  </>;
}

/** The cinematic scene is opt-in and is only mounted after all licensed GLB assets exist. */
function CinematicForest({ position, moving, onNavigate, portalReached }: Props) {
  return <>
    <color attach="background" args={['#8faea4']}/>
    <fog attach="fog" args={['#8faea4', 35, 125]}/>
    <ambientLight intensity={0.28}/>
    <hemisphereLight args={['#d9f2df', '#253d32', 1.05]}/>
    <directionalLight castShadow position={[-14, 25, 11]} intensity={2.6} shadow-mapSize={[2048,2048]} shadow-camera-left={-32} shadow-camera-right={32} shadow-camera-top={32} shadow-camera-bottom={-32}/>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.035,0]} onPointerDown={(e) => { e.stopPropagation(); onNavigate({ x: MathUtils.clamp(e.point.x,-20,20), z: MathUtils.clamp(e.point.z,-28,9) }); }}>
      <planeGeometry args={[90,90]}/><meshStandardMaterial color="#385b43" roughness={1}/>
    </mesh>
    <Suspense fallback={null}><StylizedForestTrees/></Suspense>
    <ForestCinematicAssets position={position} moving={moving} portalReached={portalReached}/>
    <FollowCamera position={position} moving={moving}/>
  </>;
}

export function Forest3D(props: Props) {
  const [cinematicReady, setCinematicReady] = useState(false);
  const [stylizedReady, setStylizedReady] = useState(false);
  const [explorerReady, setExplorerReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const verify = async () => {
      try {
        // Do not render an incomplete scene or present the old scene as the new version.
        const results = await Promise.all(Object.values(FOREST_V2_ASSETS).map(async (url) => {
          const response = await fetch(url, { headers: { Range: 'bytes=0-19' }, signal: controller.signal });
          if (!response.ok) return false;
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (bytes.length < 20) return false;
          const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          return String.fromCharCode(...bytes.slice(0, 4)) === 'glTF'
            && view.getUint32(4, true) === 2
            && view.getUint32(8, true) >= 20
            && view.getUint32(16, true) === 0x4e4f534a;
        }));
        if (mounted) setCinematicReady(results.every(Boolean));
      } catch { if (mounted) setCinematicReady(false); }
    };
    const verifyStylized = async () => {
      try {
        const names = ['tree1', 'tree2', 'tree3', 'bush'];
        const checks = await Promise.all(names.map(async name => {
          const response = await fetch('/assets/forest-v2/stylized/' + name + '.glb', { headers: { Range: 'bytes=0-19' }, signal: controller.signal });
          if (!response.ok) return false;
          const header = new Uint8Array(await response.arrayBuffer());
          return header.length >= 20 && String.fromCharCode(...header.slice(0, 4)) === 'glTF' && new DataView(header.buffer, header.byteOffset, header.byteLength).getUint32(4, true) === 2;
        }));
        if (mounted) setStylizedReady(checks.every(Boolean));
      } catch { if (mounted) setStylizedReady(false); }
    };
    const verifyExplorer = async () => {
      try {
        const response = await fetch(FOREST_V2_ASSETS.explorer, { headers: { Range: 'bytes=0-19' }, signal: controller.signal });
        if (!response.ok) return;
        const header = new Uint8Array(await response.arrayBuffer());
        if (mounted && header.length >= 20 && String.fromCharCode(...header.slice(0, 4)) === 'glTF') setExplorerReady(true);
      } catch { if (mounted) setExplorerReady(false); }
    };
    void verify();
    void verifyStylized();
    void verifyExplorer();
    return () => { mounted = false; controller.abort(); };
  }, []);
  return <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 5.3, 13], fov: 65, near: 0.1, far: 110 }} style={{ width: '100%', height: '100%', touchAction: 'none' }}>
    {cinematicReady ? <Suspense fallback={null}><CinematicForest {...props}/></Suspense> : <Forest {...props} stylizedReady={stylizedReady} explorerReady={explorerReady}/>}
  </Canvas>;
}
