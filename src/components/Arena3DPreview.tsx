import { useCallback, useEffect, useRef, useState } from 'react';
import { Forest3D } from './Forest3D';
import type { ForestPosition } from './Forest3D';

const INITIAL = { x: 0, z: 7 };

export function Arena3DPreview({ onBack }: { onBack: () => void }) {
  const [position, setPosition] = useState<ForestPosition>(INITIAL);
  const [moving, setMoving] = useState(false);
  const [sprinting, setSprinting] = useState(false);
  const [portalReached, setPortalReached] = useState(false);
  const [message, setMessage] = useState('Use WASD ou as setas para caminhar. Também é possível clicar no terreno.');
  const keys = useRef(new Set<string>());
  const positionRef = useRef(INITIAL);
  const destination = useRef<ForestPosition | null>(null);
  const portalRef = useRef(false);
  const move = useCallback((next: ForestPosition) => {
    const x = Math.max(-20, Math.min(20, next.x));
    const z = Math.max(-28, Math.min(18, next.z));
    positionRef.current = { x, z };
    setPosition({ x, z });
    if (Math.hypot(x, z + 24) < 3.4 && !portalRef.current) {
      portalRef.current = true;
      setPortalReached(true);
      setMessage('Portal descoberto! Continue explorando a floresta livremente.');
    }
  }, []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        const key = e.key.toLowerCase();
        keys.current.add(key);
        // Sprint must not cancel an active click-to-move destination.
        if (key !== 'shift') destination.current = null;
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => { keys.current.clear(); destination.current = null; setMoving(false); setSprinting(false); };
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
      setMoving(previous => previous === (distance > 0.01) ? previous : distance > 0.01);
      const running = pressed.has('shift') && distance > 0.01;
      setSprinting(previous => previous === running ? previous : running);
      const speed = running ? 8.2 : 5.2;
      if (distance > 0.01) {
        // Avoid oscillation around the destination at low frame rates.
        const step = destination.current && !dx && !dz ? Math.min(distance, dt * speed) : dt * speed;
        const previous = positionRef.current;
        const next = { x: previous.x + (nextX / distance) * step, z: previous.z + (nextZ / distance) * step };
        if (next.x !== previous.x || next.z !== previous.z) move(next);
        if (destination.current && !dx && !dz && step >= distance) destination.current = null;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); keys.current.clear(); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [move]);
  const resetExplorer = () => {
    keys.current.clear();
    destination.current = null;
    positionRef.current = INITIAL;
    setPosition(INITIAL);
    setMoving(false);
    setSprinting(false);
    portalRef.current = false;
    setPortalReached(false);
    setMessage('Exploração reiniciada. Siga pela floresta até encontrar o portal.');
  };
  const portalDistance = Math.hypot(position.x, position.z + 24);
  const progress = Math.max(0, Math.min(100, Math.round((1 - portalDistance / 32) * 100)));
  const lateralOffset = -position.x;
  const directionLabel = position.z < -24
    ? 'Atrás de você'
    : Math.abs(lateralOffset) < 2.5 ? 'À frente' : lateralOffset < 0 ? 'À esquerda' : 'À direita';
  const navigate = (target: ForestPosition) => { destination.current = { x: Math.max(-20, Math.min(20, target.x)), z: Math.max(-28, Math.min(18, target.z)) }; };
  return <main className="flex h-[100dvh] min-h-[480px] flex-col overflow-hidden bg-[#071528] text-white">
    <header className="z-10 flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-white/15 bg-slate-950/90 px-4 py-3 sm:px-6">
      <div><p className="text-[10px] font-black tracking-[.2em] text-cyan-300">TERRAVOX · EXPERIÊNCIA 3D</p><h1 className="text-base font-black sm:text-xl">Floresta do Brasil · Trilha do Portal</h1></div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button type="button" onClick={resetExplorer} className="rounded-xl border border-white/25 px-3 py-2 text-sm font-bold hover:bg-white/10">Reiniciar</button>
        <button type="button" onClick={onBack} className="rounded-xl border border-white/25 px-3 py-2 text-sm font-bold hover:bg-white/10">Voltar ao mapa</button>
      </div>
    </header>
    <section className="relative min-h-0 flex-1" aria-label="Floresta 3D explorável">
      <Forest3D position={position} moving={moving} onNavigate={navigate} onPortal={() => {}} portalReached={portalReached}/>
      <div className="pointer-events-none absolute left-3 top-3 w-[min(18rem,calc(100%-1.5rem))] rounded-xl border border-white/15 bg-slate-950/75 px-3 py-3 text-xs leading-relaxed text-white shadow-lg backdrop-blur-md">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[.15em] text-cyan-200">Exploração da floresta</p>
        <p className="text-[11px] text-white/85">WASD / Setas para caminhar · Shift para correr · Clique no chão para ir até um ponto</p>
        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] font-semibold">
          <span>{portalReached ? 'Portal descoberto' : 'Rumo ao portal'}</span>
          <span className="tabular-nums text-cyan-200">{portalReached ? 'Concluído' : Math.round(portalDistance) + ' m'}</span>
        </div>
        <div role="progressbar" aria-label="Proximidade do portal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={portalReached ? 100 : progress} className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-cyan-300 transition-[width] duration-150" style={{ width: (portalReached ? 100 : progress) + '%' }}/>
        </div>
        {!portalReached && <p className="mt-1.5 text-[10px] text-white/65">Direção aproximada: {directionLabel}</p>}
      </div>
      {portalReached && <div role="status" className="pointer-events-none absolute bottom-24 right-3 z-10 max-w-[min(19rem,calc(100%-2rem))] sm:bottom-4 sm:right-4 rounded-xl border border-cyan-200/40 bg-slate-950/75 px-4 py-2 text-right text-xs font-semibold text-cyan-100 shadow-xl sm:text-sm">Portal descoberto · Exploração livre</div>}
      <div className="absolute bottom-3 left-3 grid touch-none select-none grid-cols-3 gap-1 rounded-xl border border-white/20 bg-slate-950/75 p-2 shadow-lg sm:hidden">
        <span/><button type="button" aria-label="Avançar" onPointerDown={() => keys.current.add('w')} onPointerUp={() => keys.current.delete('w')} onPointerCancel={() => keys.current.delete('w')} onPointerLeave={() => keys.current.delete('w')} className="rounded bg-cyan-400 p-3 font-bold text-slate-950">↑</button><span/>
        <button type="button" aria-label="Esquerda" onPointerDown={() => keys.current.add('a')} onPointerUp={() => keys.current.delete('a')} onPointerCancel={() => keys.current.delete('a')} onPointerLeave={() => keys.current.delete('a')} className="rounded bg-cyan-400 p-3 font-bold text-slate-950">←</button>
        <button type="button" aria-label="Recuar" onPointerDown={() => keys.current.add('s')} onPointerUp={() => keys.current.delete('s')} onPointerCancel={() => keys.current.delete('s')} onPointerLeave={() => keys.current.delete('s')} className="rounded bg-cyan-400 p-3 font-bold text-slate-950">↓</button>
        <button type="button" aria-label="Direita" onPointerDown={() => keys.current.add('d')} onPointerUp={() => keys.current.delete('d')} onPointerCancel={() => keys.current.delete('d')} onPointerLeave={() => keys.current.delete('d')} className="rounded bg-cyan-400 p-3 font-bold text-slate-950">→</button>
      </div>
    </section>
    <footer className="z-10 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-white/15 bg-slate-950/90 p-3">
      <p role="status" className="min-w-0 flex-1 text-xs text-cyan-100 sm:text-sm">{message}</p>
      <span className="shrink-0 rounded-full border border-cyan-300/50 px-3 py-1 text-xs text-cyan-200">{portalReached ? 'Portal encontrado' : sprinting ? 'Correndo' : moving ? 'Caminhando' : 'Exploração livre'}</span>
    </footer>
  </main>;
}
