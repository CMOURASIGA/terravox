import { useCallback, useEffect, useRef, useState } from 'react';
import { Forest3D } from './Forest3D';
import type { ForestPosition } from './Forest3D';

const INITIAL = { x: 0, z: 7 };

export function Arena3DPreview({ onBack }: { onBack: () => void }) {
  const [position, setPosition] = useState<ForestPosition>(INITIAL);
  const [moving, setMoving] = useState(false);
  const [portalReached, setPortalReached] = useState(false);
  const [message, setMessage] = useState('Use WASD ou as setas para caminhar. Também é possível clicar no terreno.');
  const keys = useRef(new Set<string>());
  const positionRef = useRef(INITIAL);
  const destination = useRef<ForestPosition | null>(null);
  const portalRef = useRef(false);
  const move = useCallback((next: ForestPosition) => {
    const x = Math.max(-2.1, Math.min(2.1, next.x));
    const z = Math.max(-27, Math.min(9, next.z));
    positionRef.current = { x, z };
    setPosition({ x, z });
    if (z < -21 && !portalRef.current) {
      portalRef.current = true;
      setPortalReached(true);
      setMessage('Portal descoberto! Continue explorando a floresta livremente.');
    }
  }, []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase())) {
        e.preventDefault(); keys.current.add(e.key.toLowerCase()); destination.current = null;
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => { keys.current.clear(); destination.current = null; setMoving(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const pressed = keys.current;
      const dx = Number(pressed.has('d') || pressed.has('arrowright')) - Number(pressed.has('a') || pressed.has('arrowleft'));
      const dz = Number(pressed.has('s') || pressed.has('arrowdown')) - Number(pressed.has('w') || pressed.has('arrowup'));
      let nextX = dx, nextZ = dz;
      if (!dx && !dz && destination.current) {
        nextX = destination.current.x - positionRef.current.x;
        nextZ = destination.current.z - positionRef.current.z;
        if (Math.hypot(nextX, nextZ) < 0.15) { destination.current = null; nextX = 0; nextZ = 0; }
      }
      const distance = Math.hypot(nextX, nextZ);
      setMoving(distance > 0.01);
      if (distance > 0.01) move({ x: positionRef.current.x + (nextX / distance) * dt * 5.2, z: positionRef.current.z + (nextZ / distance) * dt * 5.2 });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); keys.current.clear(); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [move]);
  const navigate = (target: ForestPosition) => { destination.current = target; };
  return <main className="flex h-[100dvh] min-h-[480px] flex-col overflow-hidden bg-[#071528] text-white">
    <header className="z-10 flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-white/15 bg-slate-950/90 px-4 py-3 sm:px-6">
      <div><p className="text-[10px] font-black tracking-[.2em] text-cyan-300">TERRAVOX · EXPERIÊNCIA 3D</p><h1 className="text-base font-black sm:text-xl">Floresta do Brasil · Trilha do Portal</h1></div>
      <button type="button" onClick={onBack} className="shrink-0 rounded-xl border border-white/25 px-3 py-2 text-sm font-bold hover:bg-white/10">Voltar ao mapa</button>
    </header>
    <section className="relative min-h-0 flex-1" aria-label="Floresta 3D explorável">
      <Forest3D position={position} moving={moving} onNavigate={navigate} onPortal={() => {}} portalReached={portalReached}/>
      <div className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-xl border border-white/10 bg-slate-950/65 px-3 py-2 text-[11px] font-semibold leading-relaxed text-white shadow-lg backdrop-blur-sm sm:text-xs">WASD / Setas · Caminhar<br/>Clique no chão · Ir até o ponto<br/>Objetivo · Encontrar o portal</div>
      {portalReached && <div role="status" className="pointer-events-none absolute bottom-4 right-4 z-10 max-w-[min(19rem,calc(100%-2rem))] rounded-xl border border-cyan-200/40 bg-slate-950/75 px-4 py-2 text-right text-xs font-semibold text-cyan-100 shadow-xl sm:text-sm">Portal descoberto · Exploração livre</div>}
      <div className="absolute bottom-3 left-3 grid touch-none select-none grid-cols-3 gap-1 rounded-xl border border-white/20 bg-slate-950/75 p-2 shadow-lg sm:hidden">
        <span/><button type="button" aria-label="Avançar" onPointerDown={() => keys.current.add('w')} onPointerUp={() => keys.current.delete('w')} onPointerCancel={() => keys.current.delete('w')} onPointerLeave={() => keys.current.delete('w')} className="rounded bg-cyan-400 p-3 font-bold text-slate-950">↑</button><span/>
        <button type="button" aria-label="Esquerda" onPointerDown={() => keys.current.add('a')} onPointerUp={() => keys.current.delete('a')} onPointerCancel={() => keys.current.delete('a')} onPointerLeave={() => keys.current.delete('a')} className="rounded bg-cyan-400 p-3 font-bold text-slate-950">←</button>
        <button type="button" aria-label="Recuar" onPointerDown={() => keys.current.add('s')} onPointerUp={() => keys.current.delete('s')} onPointerCancel={() => keys.current.delete('s')} onPointerLeave={() => keys.current.delete('s')} className="rounded bg-cyan-400 p-3 font-bold text-slate-950">↓</button>
        <button type="button" aria-label="Direita" onPointerDown={() => keys.current.add('d')} onPointerUp={() => keys.current.delete('d')} onPointerCancel={() => keys.current.delete('d')} onPointerLeave={() => keys.current.delete('d')} className="rounded bg-cyan-400 p-3 font-bold text-slate-950">→</button>
      </div>
    </section>
    <footer className="z-10 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-white/15 bg-slate-950/90 p-3">
      <p role="status" className="min-w-0 flex-1 text-xs text-cyan-100 sm:text-sm">{message}</p>
      <span className="shrink-0 rounded-full border border-cyan-300/50 px-3 py-1 text-xs text-cyan-200">{portalReached ? 'Portal encontrado' : 'Exploração livre'}</span>
    </footer>
  </main>;
}
