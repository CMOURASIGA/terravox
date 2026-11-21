import { Mesh, MeshStandardMaterial, type Object3D } from 'three';

// Procedural pigments keep the entire region self-contained, including offline builds.
export function paintForest(root: Object3D) {
  const noise = `
    varying vec3 vForest;
    float hash2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float soil(vec2 p){
      vec2 i=floor(p), f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(hash2(i),hash2(i+vec2(1,0)),f.x),
        mix(hash2(i+vec2(0,1)),hash2(i+vec2(1,1)),f.x),f.y);
    }
  `;
  root.traverse(node => {
    if (!(node instanceof Mesh) || !(node.material instanceof MeshStandardMaterial)) return;
    const mat = node.material.clone();
    const ground = node.name === 'Terra_e_trilha';
    const bark = node.name === 'Troncos_e_sapopemas';
    const crown = node.name === 'Copas';
    const pigment = ground ? `
      float center=1.4*sin(-vForest.z*.18);
      float edge=abs(vForest.x-center)+.85*(soil(p*1.8)-.5)+.32*(soil(p*5.)-.5);
      float path=1.-smoothstep(1.7,2.7,edge);
      vec3 earth=mix(vec3(.075,.040,.025),vec3(.38,.22,.105),.3+.63*soil(p*1.1));
      vec3 moss=mix(vec3(.026,.072,.041),vec3(.13,.19,.067),soil(p*.7));
      diffuseColor.rgb=mix(moss,earth,path)*( .72+.35*soil(p*16.)+.12*soil(p*70.));
    ` : bark ? `
      float grain=soil(vec2((vForest.x+vForest.z)*5.,vForest.y*.55));
      diffuseColor.rgb*=.55+.72*grain;
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.07,.14,.063), .36*smoothstep(.55,.84,soil(p*1.8+vForest.y*.3)));
    ` : crown ? `
      float leaves=soil(p*3.+vForest.y*.7);
      diffuseColor.rgb*=.70+.60*leaves;
      diffuseColor.rgb+=vec3(.06,.09,.014)*smoothstep(.55,.84,leaves);
    ` : '';
    mat.onBeforeCompile = shader => {
      shader.vertexShader = 'varying vec3 vForest;\n' + shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvForest=(modelMatrix*vec4(transformed,1.)).xyz;');
      shader.fragmentShader = noise + shader.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        vec2 p=vForest.xz;
        ${pigment}
        float sun=soil(p*.56+vec2(vForest.y*.35,0.))*.72+soil(p*1.7)*.28;
        diffuseColor.rgb*=mix(vec3(.68,.79,.86),vec3(1.19,1.12,.93),smoothstep(.34,.65,sun));
      `);
    };
    mat.customProgramCacheKey = () => node.name;
    node.material = mat;
  });
  return root;
}
