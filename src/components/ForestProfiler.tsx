import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';

export function ForestProfiler({ report }: { report: (value: string) => void }) {
  const sample = useRef({ elapsed: 0, frames: 0 });
  useFrame(({ gl }, delta) => {
    if (document.hidden) { sample.current = { elapsed: 0, frames: 0 }; return; }
    sample.current.elapsed += delta;
    sample.current.frames++;
    if (sample.current.elapsed < 1) return;
    const fps = Math.round(sample.current.frames / sample.current.elapsed);
    report(`${fps} FPS · ${gl.info.render.calls} chamadas · ${gl.domElement.width} × ${gl.domElement.height} px`);
    sample.current = { elapsed: 0, frames: 0 };
  });
  return null;
}
