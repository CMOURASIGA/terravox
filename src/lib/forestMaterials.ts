import { BufferAttribute, Mesh, MeshLambertMaterial, MeshStandardMaterial, SRGBColorSpace, type Object3D, type Texture } from 'three';

// Static canopy shade and path detail are baked. One material per mesh on the GPU.
export function paintForest(root: Object3D, soil: Texture, atlas: Texture) {
  atlas.colorSpace = SRGBColorSpace;
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
    const material = new MeshLambertMaterial({
      color: original.color, map: ground ? soil : original.map,
      vertexColors: !ground && original.vertexColors, alphaTest: original.alphaTest,
      side: original.side
    });
    node.material = material;
    const wood = node.name === 'Troncos_e_sapopemas' || node.name === 'Cipos';
    const stone = node.name === 'Seixos';
    if (!ground && !wood && !stone) return;
    material.onBeforeCompile = shader => {
      shader.uniforms.pigments = { value: atlas };
      shader.vertexShader = 'varying vec3 terrainPosition;\n' + shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nterrainPosition=(modelMatrix*vec4(transformed,1.)).xyz;');
      shader.fragmentShader = 'uniform sampler2D pigments; varying vec3 terrainPosition;\n' + shader.fragmentShader;
      const surface = ground ? `
        vec2 tile=.004+.492*fract(terrainPosition.xz*.73);
        vec3 trail=texture2D(pigments,tile+vec2(0.,.5)).rgb;
        vec3 moss=texture2D(pigments,tile+vec2(.5,.5)).rgb;
        float earth=smoothstep(.94,1.48,diffuseColor.r/max(.015,diffuseColor.g));
        diffuseColor.rgb=mix(moss,trail,earth)*mix(.48,1.18,smoothstep(.036,.25,diffuseColor.g));
      ` : `
        vec2 uv=vec2((terrainPosition.x+terrainPosition.z)*.57, terrainPosition.y*.54${stone ? '+terrainPosition.z*.42' : ''});
        vec2 tile=.004+.492*fract(uv);
        diffuseColor.rgb=texture2D(pigments,tile+vec2(${stone ? '.5' : '0.'},0.)).rgb*.83;
      `;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n'+surface);
    };
    material.customProgramCacheKey = () => node.name;
  });
  return root;
}
