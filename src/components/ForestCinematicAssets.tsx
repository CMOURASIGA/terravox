import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Box3, Group, MathUtils, Vector3 } from 'three';
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

/** Normalize source GLBs into world units. Poly Haven exports have different axes,
 * scales and origin offsets; copying raw scene scale made vegetation enormous.
 * This component is shared by both the playable and cinematic forests.
 */
export function ForestNature() {
  const fern = useGLTF(NATURE.fern);
  const boulder = useGLTF(NATURE.boulder);
  const moss = useGLTF(NATURE.moss);
  const roots = useGLTF(NATURE.roots);
  const items = useMemo(() => {
    const source = [fern.scene, boulder.scene, moss.scene, roots.scene];
    const targetHeights = [0.85, 0.9, 0.18, 1.2];
    const prepared = source.map((scene, type) => {
      const model = scene.clone(true);
      model.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(model);
      const size = bounds.getSize(new Vector3());
      const center = bounds.getCenter(new Vector3());
      const maxDimension = Math.max(size.x, size.y, size.z);
      if (!Number.isFinite(maxDimension) || maxDimension < 0.0001) return null;
      // Some roots and moss assets are broad rather than tall; size by maximum
      // dimension to avoid absurdly wide props along the walking corridor.
      const normalization = targetHeights[type] / maxDimension;
      const anchor = new Group();
      model.position.set(-center.x, -bounds.min.y, -center.z);
      model.scale.setScalar(normalization);
      // Apply the normalization to the offset as well.
      model.position.multiplyScalar(normalization);
      model.traverse(child => {
        if ('isMesh' in child && child.isMesh) {
          const mesh = child as import('three').Mesh;
          mesh.castShadow = type === 1 || type === 3;
          mesh.receiveShadow = true;
        }
      });
      anchor.add(model);
      return anchor;
    });
    return Array.from({ length: 64 }, (_, i) => {
      const type = i % 4;
      const z = -30 + ((i * 7.31) % 43);
      const side = i % 2 ? 1 : -1;
      const distance = 6.4 + ((i * 1.93) % 15);
      const x = side * distance;
      const sourceModel = prepared[type];
      if (!sourceModel) return null;
      const object = sourceModel.clone(true);
      const variation = 0.85 + (i % 5) * 0.075;
      return {
        id: i,
        object,
        position: [x, 0.02, z] as [number, number, number],
        rotation: (i * 2.399963) % (Math.PI * 2),
        scale: variation,
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null);
  }, [fern.scene, boulder.scene, moss.scene, roots.scene]);
  return <group>{items.map(item =>
    <primitive key={item.id} object={item.object} position={item.position} rotation={[0, item.rotation, 0]} scale={item.scale}/>
  )}</group>;
}

/** Licensed stylized tree models replace procedural trees once the staging workflow
 * has committed all four GLBs. Geometry is centered and scaled to world units.
 */
export function StylizedForestTrees() {
  const trees = [
    useGLTF('/assets/forest-v2/stylized/tree1.glb'),
    useGLTF('/assets/forest-v2/stylized/tree2.glb'),
    useGLTF('/assets/forest-v2/stylized/tree3.glb'),
    useGLTF('/assets/forest-v2/stylized/bush.glb'),
  ];
  const instances = useMemo(() => {
    const prepared = trees.map((asset, index) => {
      const object = asset.scene.clone(true);
      object.updateMatrixWorld(true);
      const box = new Box3().setFromObject(object);
      const dimensions = box.getSize(new Vector3());
      const height = Math.max(dimensions.y, 0.001);
      const scale = (index === 3 ? 1.5 : 9.5) / height;
      const center = box.getCenter(new Vector3());
      object.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
      object.scale.setScalar(scale);
      object.traverse(child => {
        if ('isMesh' in child && child.isMesh) {
          const mesh = child as import('three').Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });
      return object;
    });
    return Array.from({ length: 74 }, (_, i) => {
      const isBush = i % 5 === 0;
      const index = isBush ? 3 : i % 3;
      const side = i % 2 === 0 ? -1 : 1;
      const z = -32 + (i * 7.113) % 47;
      const x = side * (isBush ? 6.6 + (i * 2.3) % 12 : 9.2 + (i * 1.71) % 18);
      return {
        object: prepared[index].clone(true),
        position: [x, 0, z] as [number, number, number],
        rotation: (i * 2.399963) % (Math.PI * 2),
        scale: 0.78 + (i % 6) * 0.09,
      };
    });
  }, [trees[0].scene, trees[1].scene, trees[2].scene, trees[3].scene]);
  return <group>{instances.map((item, i) =>
    <primitive key={i} object={item.object} position={item.position} rotation={[0, item.rotation, 0]} scale={item.scale}/>
  )}</group>;
}

function AnimatedExplorer({ position, moving }: { position: ForestPosition; moving: boolean }) {
  const root = useRef<Group>(null);
  const last = useRef(new Vector3(position.x, 0, position.z));
  const { scene, animations } = useGLTF(FOREST_V2_ASSETS.explorer);
  const model = useMemo(() => scene.clone(true), [scene]);
  const { actions } = useAnimations(animations, model);
  useEffect(() => {
    const selected = moving ? actions.walk : actions.idle;
    if (!selected) return;
    selected.enabled = true;
    selected.reset().fadeIn(0.25).play();
    return () => { selected.fadeOut(0.25); };
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
  const { actions } = useAnimations(animations, model);
  useEffect(() => {
    const idle = actions.idle;
    if (!idle) return;
    idle.reset().play();
    return () => { idle.stop(); };
  }, [actions]);
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
