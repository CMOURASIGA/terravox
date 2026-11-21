import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Group, MathUtils, Vector3 } from 'three';
import type { ForestPosition } from './Forest3D';

/** Asset-driven scene. Requires licensed GLB files at the paths below. */
export const FOREST_V2_ASSETS = {
  explorer: '/assets/forest-v2/explorer.glb',
  environment: '/assets/forest-v2/environment.glb',
  portal: '/assets/forest-v2/portal.glb',
  spirit: '/assets/forest-v2/spirit.glb',
} as const;

/** Reviewed CC0 nature assets from Poly Haven. Reuse loaded geometry through cloned scene graphs. */
const NATURE = {
  fern: '/assets/forest-v2/nature/fern_02.glb',
  boulder: '/assets/forest-v2/nature/boulder_01.glb',
  moss: '/assets/forest-v2/nature/moss_01.glb',
  roots: '/assets/forest-v2/nature/pine_roots.glb',
} as const;

function ForestNature() {
  const fern = useGLTF(NATURE.fern);
  const boulder = useGLTF(NATURE.boulder);
  const moss = useGLTF(NATURE.moss);
  const roots = useGLTF(NATURE.roots);
  const items = useMemo(() => {
    const source = [fern.scene, boulder.scene, moss.scene, roots.scene];
    return Array.from({ length: 68 }, (_, i) => {
      const type = i % 4;
      const z = -29 + (i * 7.31) % 41;
      const side = i % 2 ? 1 : -1;
      const x = side * (4.5 + (i * 1.93) % 16);
      const scale = type === 0 ? 1.1 : type === 1 ? 0.75 : type === 2 ? 0.95 : 1.2;
      const object = source[type].clone(true);
      object.traverse(child => {
        if ('isMesh' in child && child.isMesh) {
          const mesh = child as import('three').Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });
      return { id: i, object, position: [x, 0, z] as [number, number, number], rotation: (i * 2.399963) % (Math.PI * 2), scale };
    });
  }, [fern.scene, boulder.scene, moss.scene, roots.scene]);
  return <group>{items.map(item =>
    <primitive key={item.id} object={item.object} position={item.position} rotation={[0, item.rotation, 0]} scale={item.scale}/>
  )}</group>;
}

function AnimatedExplorer({ position, moving }: { position: ForestPosition; moving: boolean }) {
  const root = useRef<Group>(null);
  const last = useRef(new Vector3(position.x, 0, position.z));
  const { scene, animations } = useGLTF(FOREST_V2_ASSETS.explorer);
  const model = useMemo(() => scene.clone(true), [scene]);
  const { actions } = useAnimations(animations, root);
  useEffect(() => {
    const selected = moving ? actions.walk : actions.idle;
    if (!selected) return;
    selected.reset().fadeIn(0.2).play();
    return () => { selected.fadeOut(0.2); };
  }, [actions, moving]);
  useFrame((_, delta) => {
    if (!root.current) return;
    const next = new Vector3(position.x, 0, position.z);
    const direction = next.clone().sub(last.current);
    if (direction.lengthSq() > 0.00001) {
      const heading = Math.atan2(direction.x, direction.z);
      const diff = Math.atan2(Math.sin(heading - root.current.rotation.y), Math.cos(heading - root.current.rotation.y));
      root.current.rotation.y += diff * Math.min(1, delta * 9);
    }
    root.current.position.lerp(next, Math.min(1, delta * 12));
    last.current.copy(next);
  });
  return <group ref={root} position={[position.x, 0, position.z]}><primitive object={model}/></group>;
}

function Companion({ position }: { position: ForestPosition }) {
  const { scene, animations } = useGLTF(FOREST_V2_ASSETS.spirit);
  const root = useRef<Group>(null);
  const model = useMemo(() => scene.clone(true), [scene]);
  const { actions } = useAnimations(animations, root);
  useEffect(() => { actions.idle?.play(); return () => { actions.idle?.stop(); }; }, [actions]);
  useFrame(({ clock }, delta) => {
    if (!root.current) return;
    const t = clock.elapsedTime;
    root.current.position.lerp(new Vector3(position.x + 1.5, 1.7 + Math.sin(t * 2) * 0.2, position.z + 1), Math.min(1, delta * 3));
    root.current.rotation.y = MathUtils.damp(root.current.rotation.y, Math.sin(t * 0.8) * 0.35, 3, delta);
  });
  return <group ref={root}><primitive object={model}/></group>;
}

function World({ portalReached }: { portalReached: boolean }) {
  const environment = useGLTF(FOREST_V2_ASSETS.environment);
  const portal = useGLTF(FOREST_V2_ASSETS.portal);
  const portalRoot = useRef<Group>(null);
  useFrame(({ clock }, delta) => {
    if (portalRoot.current) portalRoot.current.scale.setScalar(MathUtils.damp(portalRoot.current.scale.x, portalReached ? 1.06 : 1, 2, delta));
  });
  return <>
    <primitive object={environment.scene} />
    <group ref={portalRoot} position={[0, 0, -24]}><primitive object={portal.scene}/></group>
  </>;
}

export function ForestCinematicAssets({ position, moving, portalReached }: { position: ForestPosition; moving: boolean; portalReached: boolean }) {
  return <>
    <World portalReached={portalReached}/>
    <ForestNature/>
    <AnimatedExplorer position={position} moving={moving}/>
    <Companion position={position}/>
  </>;
}
