import { BufferAttribute, Mesh, MeshLambertMaterial, MeshStandardMaterial, SRGBColorSpace, type Object3D, type Texture } from 'three';

// Static canopy shade and path detail are baked. One material per mesh on the GPU.
export function paintForest(root: Object3D, soil: Texture) {
  soil.colorSpace = SRGBColorSpace;
  root.traverse(node => {
    if (!(node instanceof Mesh) || !(node.material instanceof MeshStandardMaterial)) return;
    const original = node.material;
    const ground = node.name === 'Terra_e_trilha';
    if (ground && !node.geometry.getAttribute('uv')) {
      const positions = node.geometry.getAttribute('position');
      const uv = new Float32Array(positions.count * 2);
      for (let i = 0; i < positions.count; i++) {
        uv[i * 2] = (positions.getX(i) + 37) / 74;
        uv[i * 2 + 1] = 1 - (positions.getZ(i) + 51) / 78;
      }
      node.geometry.setAttribute('uv', new BufferAttribute(uv, 2));
    }
    node.material = new MeshLambertMaterial({
      color: original.color, map: ground ? soil : original.map,
      vertexColors: !ground && original.vertexColors, alphaTest: original.alphaTest,
      side: original.side
    });
  });
  return root;
}
