import { useCallback, useEffect, useRef, useState } from 'react';
import { Forest3D } from './Forest3D';
import type { ForestPosition } from './Forest3D';

const INITIAL = { x: 0, z: 7 };
const PORTAL_QUESTION = {
  question: 'Qual atitude ajuda a preservar a biodiversidade da floresta?',
  choices: ['Retirar plantas para levar para casa', 'Observar os animais sem interferir no habitat', 'Deixar resíduos ao longo da trilha'],
  correct: 1,
};

export function Arena3DPreview({ onBack }: { onBack: () => void }) {
  const [position, setPosition] = useState<ForestPosition>(INITIAL);
  const [moving, setMoving] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [challengeComplete, setChallengeComplete] = useState(false);
  const [challengeFeedback, setChallengeFeedback] = useState('');
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
      setMessage('Portal encontrado. Interaja com o Guardião para concluir o desafio ambiental.');
    }
  }, []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase())) {
        e.preventDefault(); keys.current.add(e.key.toLowerCase()); destination.current = null;
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => keys.current.clear();
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
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [move]);
  const navigate = (target: ForestPosition) => { destination.current = target; };
  const answer = (index: number) => {
    if (index === PORTAL_QUESTION.correct) {
      setChallengeComplete(true);
      setChallengeFeedback('Resposta correta. Você protegeu o equilíbrio da floresta!');
      setMessage('Desafio do Guardião concluído. Seu progresso principal permanece intacto.');
    } else {
      setChallengeFeedback('Ainda não. Pense em como visitar a floresta sem prejudicar os seres vivos.');
    }
  };
  return <main className="flex h-[100dvh] min-h-[480px] flex-col overflow-hidden bg-[#071528] text-white">
    <header className="z-10 flex items-center justify-between gap-3 border-b border-white/15 bg-slate-950/90 px-4 py-3 sm:px-6">
      <div><p className="text-[10px] font-black tracking-[.2em] text-cyan-300">TERRAVOX · EXPERIÊNCIA 3D</p><h1 className="text-base font-black sm:text-xl">Floresta do Brasil · Trilha do Portal</h1></div>
      <button type="button" onClick={onBack} className="rounded-xl border border-white/25 px-3 py-2 text-sm font-bold hover:bg-white/10">Voltar ao mapa</button>
    </header>
    <section className="relative min-h-0 flex-1" aria-label="Floresta 3D explorável">
      <Forest3D position={position} moving={moving} onNavigate={navigate} onPortal={() => {}} portalReached={portalReached}/>
      <div className="pointer-events-none absolute left-3 top-3 rounded-xl bg-slate-950/75 px-3 py-2 text-xs font-semibold text-white sm:text-sm">WASD / Setas · Caminhar<br/>Clique no chão · Ir até o ponto<br/>Objetivo · Encontrar o portal</div>
      {portalReached && !challengeComplete && <button type="button" onClick={() => { setChallengeFeedback(''); setChallengeOpen(true); }} className="absolute bottom-5 right-5 z-10 rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950 shadow-xl hover:bg-cyan-300">Interagir com o Guardião</button>}
      {challengeComplete && <div role="status" className="absolute bottom-5 right-5 rounded-xl border border-emerald-300 bg-emerald-900/90 px-4 py-3 text-sm font-bold">Guardião da Floresta · Desafio concluído</div>}
      <div className="absolute bottom-4 left-4 grid grid-cols-3 gap-1 rounded-xl bg-slate-950/70 p-2 sm:hidden">
        <span/><button type="button" aria-label="Avançar" onPointerDown={() => keys.current.add('w')} onPointerUp={() => keys.current.delete('w')} onPointerLeave={() => keys.current.delete('w')} className="rounded bg-cyan-400 p-3 font-bold text-slate-950">↑</button><span/>
        <button type="button" aria-label="Esquerda" onPointerDown={() => keys.current.add('a')} onPointerUp={() => keys.current.delete('a')} onPointerLeave={() => keys.current.delete('a')} className="rounded bg-cyan-400 p-3 font-bold text-slate-950">←</button>
        <button type="button" aria-label="Recuar" onPointerDown={() => keys.current.add('s')} onPointerUp={() => keys.current.delete('s')} onPointerLeave={() => keys.current.delete('s')} className="rounded bg-cyan-400 p-3 font-bold text-slate-950">↓</button>
        <button type="button" aria-label="Direita" onPointerDown={() => keys.current.add('d')} onPointerUp={() => keys.current.delete('d')} onPointerLeave={() => keys.current.delete('d')} className="rounded bg-cyan-400 p-3 font-bold text-slate-950">→</button>
      </div>
    </section>
    {challengeOpen && <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-label="Desafio do Guardião">
      <div className="w-full max-w-lg rounded-3xl border border-cyan-300/40 bg-slate-900 p-6 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-widest text-cyan-300">Guardião da Floresta · Desafio ambiental</p>
        <h2 className="mt-3 text-2xl font-black">Proteja a biodiversidade</h2>
        <p className="mt-3 text-base text-slate-200">{PORTAL_QUESTION.question}</p>
        {!challengeComplete ? <div className="mt-5 grid gap-3">{PORTAL_QUESTION.choices.map((choice, index) => <button type="button" key={choice} onClick={() => answer(index)} className="rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-left font-semibold hover:border-cyan-300 hover:bg-slate-700">{choice}</button>)}</div> : <p className="mt-5 rounded-xl bg-emerald-900/60 p-4 font-bold text-emerald-100">{challengeFeedback}</p>}
        {!challengeComplete && challengeFeedback && <p role="alert" className="mt-4 text-amber-200">{challengeFeedback}</p>}
        <button type="button" onClick={() => setChallengeOpen(false)} className="mt-5 w-full rounded-xl bg-cyan-400 px-4 py-3 font-black text-slate-950">{challengeComplete ? 'Concluir exploração' : 'Voltar à floresta'}</button>
        <p className="mt-3 text-center text-xs text-slate-400">Atividade experimental, sem conceder XP ou moedas.</p>
      </div>
    </div>}
    <footer className="z-10 flex items-center justify-between gap-3 border-t border-white/15 bg-slate-950/90 p-3">
      <p role="status" className="text-xs text-cyan-100 sm:text-sm">{message}</p>
      <span className="shrink-0 rounded-full border border-cyan-300/50 px-3 py-1 text-xs text-cyan-200">{portalReached ? 'Portal encontrado' : 'Exploração livre'}</span>
    </footer>
  </main>;
}
