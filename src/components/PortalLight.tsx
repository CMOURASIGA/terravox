import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { DoubleSide, MathUtils } from 'three';

export function PortalLight({ active }: { active: boolean }) {
  const uniforms = useMemo(() => ({ time: { value: 0 }, opening: { value: 0 } }), []);
  useFrame((_, delta) => {
    uniforms.time.value += Math.min(delta, .12);
    uniforms.opening.value = MathUtils.damp(uniforms.opening.value, active ? 1 : 0, 2.8, delta);
  });
  return <mesh position={[0, 2.15, .04]}>
    <circleGeometry args={[2.23, 72]}/>
    <shaderMaterial transparent depthWrite={false} side={DoubleSide} uniforms={uniforms}
      vertexShader={`varying vec2 v; void main(){v=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
      fragmentShader={`varying vec2 v; uniform float time; uniform float opening;
        void main(){
          float r=length(v), a=atan(v.y,v.x), t=time*.65;
          float wave=sin(19.*r-3.*a+t*2.+.65*sin(a*4.+t));
          float filaments=pow(.5+.5*wave,9.);
          float rim=exp(-26.*abs(r-.96));
          float veil=(.13+.42*filaments+.18*sin(8.*r-t))*opening;
          float halo=.55*rim+.42*exp(-12.*abs(r-.92))*pow(.5+.5*cos(12.*a-t),4.);
          vec3 color=mix(vec3(.12,.72,.64),vec3(1.,.88,.49),max(rim,filaments*.65));
          gl_FragColor=vec4(color,clamp(halo+veil,0.,.93));
        }`}/>
  </mesh>;
}
