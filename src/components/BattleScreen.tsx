import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Crosshair, Heart, Move, Sparkles, Swords } from 'lucide-react';
import { Arena3D } from './Arena3D';
import { PlayerProfile } from '../types';

interface BattleScreenProps { territoryId: string; profile: PlayerProfile; onWin: (xp: number, coins: number) => void; onLeave: () => void; }

const challenges = [
  { title: 'Portal da Floresta', prompt: 'Qual atitude ajuda diretamente a preservar a Floresta Amazônica?', options: ['Desmatamento sem controle', 'Proteção das áreas e uso sustentável', 'Queimar resíduos', 'Poluir os rios'], answer: 'Proteção das áreas e uso sustentável', unlock: 'O portal se abriu. O Guardião surgiu na arena!' },
  { title: 'Selo do Guardião', prompt: 'O Brasil está localizado em qual continente?', options: ['Europa', 'África', 'América do Sul', 'Ásia'], answer: 'América do Sul', unlock: 'Conhecimento confirmado. A energia do Guardião foi quebrada!' },
];

export function BattleScreen({ territoryId, profile, onWin, onLeave }: BattleScreenProps) {
  const [position, setPosition] = useState({ x: -5.2, z: 3.6 });
  const [playerHp, setPlayerHp] = useState(100);
  const [bossHp, setBossHp] = useState(100);
  const [gateOpen, setGateOpen] = useState(false);
  const [challengeIndex, setChallengeIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [won, setWon] = useState(false);

  useEffect(() => {
    const move = (event: KeyboardEvent) => {
      if (challengeIndex !== null || won) return;
      const key = event.key.toLowerCase();
      const delta = 0.65;
      if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) return;
      event.preventDefault();
      setPosition(current => ({ x: Math.max(-8.5, Math.min(8.5, current.x + (key === 'd' || key === 'arrowright' ? delta : key === 'a' || key === 'arrowleft' ? -delta : 0))), z: Math.max(-8.2, Math.min(8.2, current.z + (key === 's' || key === 'arrowdown' ? delta : key === 'w' || key === 'arrowup' ? -delta : 0))) }));
    };
    window.addEventListener('keydown', move);
    return () => window.removeEventListener('keydown', move);
  }, [challengeIndex, won]);

  const canOpenGate = useMemo(() => Math.hypot(position.x - 2.3, position.z + 3.8) < 2.15, [position]);
  const nearBoss = useMemo(() => Math.hypot(position.x - 5.5, position.z + 4.8) < 3.1, [position]);

  useEffect(() => { if (canOpenGate && !gateOpen && challengeIndex === null) setChallengeIndex(0); }, [canOpenGate, gateOpen, challengeIndex]);

  const attack = () => {
    if (!gateOpen || won || challengeIndex !== null) return;
    if (!nearBoss) { setFeedback('Aproxime-se do Guardião para atacá-lo.'); return; }
    setBossHp(hp => Math.max(0, hp - 25));
    setPlayerHp(hp => Math.max(0, hp - 7));
    setFeedback('Ataque de energia aplicado!');
  };

  useEffect(() => { if (bossHp === 0 && !won) setChallengeIndex(1); }, [bossHp, won]);

  const answer = (option: string) => {
    const challenge = challenges[challengeIndex!];
    if (option !== challenge.answer) { setFeedback('Ainda não. Leia com atenção e tente novamente.'); return; }
    if (challengeIndex === 0) { setGateOpen(true); setChallengeIndex(null); setFeedback(challenge.unlock); }
    else { setWon(true); setChallengeIndex(null); setFeedback(challenge.unlock); }
  };

  return (
    <main className="relative h-screen overflow-hidden bg-[#07152d] text-white select-none">
      <Arena3D playerPosition={position} gateOpen={gateOpen} bossDefeated={bossHp === 0} onAttack={attack} />
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-[#07152d]/95 to-transparent p-4 md:p-6">
        <button onClick={onLeave} className="rounded-xl border border-white/20 bg-slate-950/60 px-3 py-2 text-sm font-black backdrop-blur hover:bg-slate-800"><ArrowLeft className="mr-1 inline h-4 w-4" /> Sair</button>
        <div className="text-center"><p className="text-[10px] font-black tracking-[.25em] text-cyan-300">TERRAVOX 3D</p><h1 className="text-lg font-black md:text-2xl">Arena do {territoryId.toUpperCase()}</h1></div>
        <div className="hidden rounded-xl bg-slate-950/60 px-3 py-2 text-right text-xs font-bold backdrop-blur sm:block">{profile.name}<br/><span className="text-yellow-300">Nível {profile.level}</span></div>
      </header>
      <aside className="absolute left-4 top-24 z-10 w-44 rounded-2xl border border-white/15 bg-slate-950/70 p-3 backdrop-blur md:left-6">
        <p className="mb-1 flex items-center gap-1 text-xs font-black"><Heart className="h-4 w-4 text-rose-400" /> EXPLORADOR</p><div className="h-3 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-gradient-to-r from-cyan-400 to-emerald-300" style={{ width: `${playerHp}%` }} /></div><p className="mt-1 text-right text-xs font-bold">{playerHp}/100</p>
        <div className="mt-3 border-t border-white/10 pt-3"><p className="mb-1 flex items-center gap-1 text-xs font-black text-rose-200"><Swords className="h-4 w-4" /> GUARDIÃO</p><div className="h-3 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-gradient-to-r from-rose-600 to-orange-400" style={{ width: `${bossHp}%` }} /></div><p className="mt-1 text-right text-xs font-bold">{bossHp}/100</p></div>
      </aside>
      <div className="absolute bottom-5 left-1/2 z-10 w-[min(94%,540px)] -translate-x-1/2 rounded-2xl border border-white/15 bg-slate-950/75 p-3 text-center text-sm font-bold backdrop-blur"><p>{feedback || (gateOpen ? 'Encontre o Guardião e use o ataque.' : 'Explore a arena e encontre o portal brilhante.')}</p><div className="mt-2 flex justify-center gap-4 text-xs text-slate-300"><span><Move className="mr-1 inline h-4 w-4 text-cyan-300" />WASD ou setas</span><span><Crosshair className="mr-1 inline h-4 w-4 text-yellow-300" />Ataque perto do Guardião</span></div></div>
      <button onClick={attack} className="absolute bottom-24 right-5 z-10 grid h-20 w-20 place-items-center rounded-full border-4 border-yellow-200 bg-gradient-to-b from-yellow-400 to-orange-500 text-center text-xs font-black text-slate-950 shadow-[0_0_30px_#fbbf24] active:scale-95 md:right-8"><Sparkles className="h-6 w-6" />ATACAR</button>
      {challengeIndex !== null && <div className="absolute inset-0 z-30 grid place-items-center bg-[#07152d]/80 p-4 backdrop-blur-sm"><section className="w-full max-w-xl rounded-[2rem] border-2 border-yellow-300/60 bg-gradient-to-br from-[#1b3159] to-[#24164b] p-6 text-center shadow-2xl md:p-9"><p className="mb-2 text-xs font-black tracking-[.2em] text-yellow-300">DESAFIO DE CONHECIMENTO</p><h2 className="text-2xl font-black">{challenges[challengeIndex].title}</h2><p className="my-6 text-lg font-bold leading-relaxed">{challenges[challengeIndex].prompt}</p><div className="grid gap-3 sm:grid-cols-2">{challenges[challengeIndex].options.map(option => <button key={option} onClick={() => answer(option)} className="rounded-xl border border-white/15 bg-white/10 p-4 text-left text-sm font-bold transition hover:scale-[1.02] hover:border-yellow-300 hover:bg-yellow-300 hover:text-slate-950">{option}</button>)}</div>{feedback && <p className="mt-5 text-sm font-bold text-cyan-200">{feedback}</p>}</section></div>}
      {won && <div className="absolute inset-0 z-40 grid place-items-center bg-[#07152d]/80 p-5 backdrop-blur-sm"><section className="max-w-md rounded-[2rem] border-2 border-emerald-300 bg-gradient-to-br from-emerald-600 to-cyan-700 p-8 text-center shadow-2xl"><Sparkles className="mx-auto h-12 w-12 text-yellow-200" /><h2 className="mt-3 text-3xl font-black">Fase concluída!</h2><p className="my-4 font-medium">Você combinou exploração, combate e conhecimento para restaurar o território.</p><div className="mb-6 flex justify-center gap-3 text-sm font-black"><span className="rounded-full bg-black/20 px-3 py-2">+100 XP</span><span className="rounded-full bg-black/20 px-3 py-2">+30 moedas</span></div><button onClick={() => onWin(100, 30)} className="w-full rounded-xl bg-yellow-300 py-4 font-black text-slate-950 hover:bg-yellow-200">COLETAR RECOMPENSAS</button></section></div>}
    </main>
  );
}
