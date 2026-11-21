import { useState } from 'react';
import { Arena3D } from './Arena3D';

export function Arena3DPreview({ onBack }: { onBack: () => void }) {
  const [position, setPosition] = useState({ x: 0, z: 3 });
  const [gateOpen, setGateOpen] = useState(false);
  const [bossDefeated, setBossDefeated] = useState(false);
  const [message, setMessage] = useState('Clique no chão da arena para mover o explorador.');
  const move = (next: { x: number; z: number }) => {
    const distance = Math.hypot(next.x, next.z);
    if (distance > 9.5) {
      setMessage('Você chegou ao limite da arena.');
      return;
    }
    setPosition(next);
    if (Math.hypot(next.x - 2.3, next.z + 3.8) < 2.8 && !gateOpen) {
      setGateOpen(true);
      setMessage('Portal aberto! Aproxime-se do Guardião.');
    } else if (Math.hypot(next.x - 5.5, next.z + 4.8) < 2.5 && !bossDefeated) {
      setMessage('Guardião encontrado. Use o botão de interação.');
    } else {
      setMessage('Exploração 3D em andamento. Este ambiente não altera o seu progresso.');
    }
  };
  const interact = () => {
    if (!gateOpen) {
      setMessage('Encontre primeiro o portal brilhante para desbloquear o Guardião.');
      return;
    }
    if (Math.hypot(position.x - 5.5, position.z + 4.8) >= 2.5) {
      setMessage('Aproxime-se do Guardião para interagir.');
      return;
    }
    setBossDefeated(true);
    setMessage('Guardião superado! Protótipo 3D concluído. Nenhuma recompensa foi aplicada.');
  };
  return (
    <main className="relative flex min-h-[100dvh] flex-col bg-[#071528] text-white">
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/15 bg-slate-950/90 p-3 sm:px-6">
        <div><p className="text-xs font-black tracking-[.2em] text-cyan-300">TERRAVOX · LABORATÓRIO 3D</p><h1 className="text-lg font-black">Primeira arena interativa</h1></div>
        <button type="button" onClick={onBack} className="rounded-xl border border-white/25 px-4 py-2 font-bold hover:bg-white/10">Voltar ao mapa</button>
      </header>
      <section className="relative min-h-[420px] flex-1" aria-label="Arena tridimensional de demonstração">
        <Arena3D playerPosition={position} gateOpen={gateOpen} bossDefeated={bossDefeated} onNavigate={move} onAttack={interact} />
      </section>
      <footer className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 bg-slate-950/90 p-4">
        <p role="status" className="max-w-2xl text-sm text-cyan-100">{message}</p>
        <button type="button" onClick={interact} disabled={bossDefeated} className="rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950 disabled:opacity-50">{bossDefeated ? 'Concluído' : 'Interagir com Guardião'}</button>
      </footer>
    </main>
  );
}
