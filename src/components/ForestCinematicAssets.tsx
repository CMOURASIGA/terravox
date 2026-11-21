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
    <AnimatedExplorer position={position} moving={moving}/>
    <Companion position={position}/>
  </>;
}
