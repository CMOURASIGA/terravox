import { useState } from 'react';
import { ArrowLeft, Heart, Shield, Sparkles, Swords } from 'lucide-react';
import { PlayerProfile } from '../types';

interface BattleScreenProps { territoryId: string; profile: PlayerProfile; onWin: (xp: number, coins: number) => void; onLeave: () => void; }

const challenge = { title: 'Portal das Águas', prompt: 'Qual atitude ajuda diretamente a preservar a Floresta Amazônica?', options: ['Desmatamento sem controle', 'Proteção das áreas e uso sustentável', 'Queimar resíduos', 'Poluir os rios'], answer: 'Proteção das áreas e uso sustentável' };

export function BattleScreen({ territoryId, profile, onWin, onLeave }: BattleScreenProps) {
  const [stage, setStage] = useState<'portal' | 'battle' | 'question' | 'won'>('portal');
  const [bossHp, setBossHp] = useState(100);
  const [feedback, setFeedback] = useState('Encontre o Portal das Águas para iniciar a missão.');

  const attack = () => {
    if (stage !== 'battle') return setFeedback('Primeiro, desperte o Guardião no portal.');
    const next = Math.max(0, bossHp - 25);
    setBossHp(next);
    setFeedback(next ? 'Impacto de energia! Continue o ataque.' : 'O Guardião foi vencido. Falta uma última pergunta.');
    if (!next) setStage('question');
  };
  const answer = (option: string) => {
    if (option !== challenge.answer) return setFeedback('Quase. Observe o que realmente protege a floresta e tente de novo.');
    setStage('won');
  };

  return <main className="relative min-h-[100dvh] overflow-hidden bg-[#08172d] text-white">
    <img src="/assets/brazil-adventure-world.webp" alt="Floresta brasileira com ruínas e portal" className="absolute inset-0 h-full w-full object-cover" />
    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,12,29,.78)_0%,rgba(3,12,29,.08)_35%,rgba(3,12,29,.68)_100%)]" />
    <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-3 sm:p-5"><button onClick={onLeave} className="rounded-xl border border-white/30 bg-slate-950/65 px-3 py-2 text-sm font-black backdrop-blur"><ArrowLeft className="mr-1 inline h-4 w-4" />Sair</button><div className="text-center"><p className="text-[10px] font-black tracking-[.28em] text-cyan-200">TERRAVOX</p><h1 className="text-lg font-black sm:text-2xl">Ruínas do Brasil</h1></div><div className="rounded-xl bg-slate-950/65 px-3 py-2 text-right text-xs font-bold backdrop-blur">{profile.name}<br/><span className="text-yellow-300">Nível {profile.level}</span></div></header>

    <aside className="absolute left-3 top-20 z-20 w-40 rounded-2xl border border-white/25 bg-[#071528]/75 p-3 backdrop-blur sm:left-5 sm:top-24 sm:w-48"><p className="flex items-center gap-1 text-xs font-black"><Heart className="h-4 w-4 text-rose-400" /> EXPLORADOR</p><div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-900"><div className="h-full w-full bg-gradient-to-r from-cyan-400 to-emerald-300" /></div><p className="mt-1 text-right text-xs font-black">100/100</p>{stage !== 'portal' && <><div className="my-3 border-t border-white/15"/><p className="flex items-center gap-1 text-xs font-black text-rose-100"><Swords className="h-4 w-4" /> GUARDIÃO</p><div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-900"><div className="h-full bg-gradient-to-r from-rose-600 to-orange-400 transition-all" style={{ width: `${bossHp}%` }} /></div><p className="mt-1 text-right text-xs font-black">{bossHp}/100</p></>}</aside>

    <section className="absolute inset-x-0 bottom-0 top-16 z-10 mx-auto max-w-7xl">
      <img src="/assets/terravox-explorer.webp" alt="Explorador Terravox" className="absolute bottom-[9%] left-[8%] w-[38vw] max-w-[330px] min-w-[170px] drop-shadow-[0_18px_18px_rgba(0,0,0,.55)]" />
      <div className="absolute bottom-[13%] left-[12%] rounded-full border-2 border-cyan-200/80 bg-cyan-300/20 px-3 py-1 text-[10px] font-black text-cyan-50 backdrop-blur">EXPLORADOR</div>
      {stage === 'portal' && <button onClick={() => { setStage('battle'); setFeedback('O Guardião acordou. Use o botão ATACAR quando estiver pronto.'); }} className="absolute right-[7%] top-[29%] grid w-[min(33vw,210px)] aspect-square place-items-center rounded-full border-4 border-cyan-200/80 bg-cyan-400/15 p-3 text-center shadow-[0_0_55px_rgba(34,211,238,.85)] backdrop-blur-sm transition hover:scale-105 active:scale-95"><Sparkles className="h-9 w-9 text-yellow-200"/><span className="text-sm font-black sm:text-lg">PORTAL DAS ÁGUAS</span><span className="text-[10px] font-bold text-cyan-100">TOQUE PARA DESPERTAR</span></button>}
      {stage !== 'portal' && bossHp > 0 && <><img src="/assets/forest-guardian.webp" alt="Guardião da floresta" className="absolute right-[4%] bottom-[12%] w-[43vw] max-w-[360px] min-w-[190px] drop-shadow-[0_20px_20px_rgba(0,0,0,.6)]" /><div className="absolute bottom-[16%] right-[13%] rounded-full border-2 border-rose-200/70 bg-rose-800/35 px-3 py-1 text-[10px] font-black text-rose-50 backdrop-blur">GUARDIÃO DAS RUÍNAS</div></>}
    </section>

    <div className="absolute inset-x-3 bottom-4 z-30 mx-auto max-w-xl rounded-2xl border border-white/25 bg-[#071528]/85 p-3 text-center backdrop-blur sm:bottom-6"><p className="text-sm font-bold sm:text-base">{feedback}</p><p className="mt-1 text-[11px] font-medium text-slate-300">Explore, enfrente o Guardião e use conhecimento para liberar o próximo território.</p></div>
    <button onClick={attack} className={`absolute bottom-24 right-4 z-30 grid h-20 w-20 place-items-center rounded-full border-4 border-yellow-100 text-center text-xs font-black text-slate-950 shadow-[0_0_32px_rgba(250,204,21,.9)] transition active:scale-95 sm:bottom-28 sm:right-7 ${stage === 'battle' ? 'bg-gradient-to-b from-yellow-300 to-orange-500' : 'bg-slate-400 opacity-80'}`}><Swords className="h-6 w-6"/>ATACAR</button>

    {stage === 'question' && <div className="absolute inset-0 z-40 grid place-items-center bg-[#071528]/80 p-4 backdrop-blur-sm"><section className="w-full max-w-xl rounded-[2rem] border-2 border-yellow-200/70 bg-[linear-gradient(135deg,#174054,#3b1b68)] p-6 text-center shadow-2xl sm:p-9"><Shield className="mx-auto h-9 w-9 text-yellow-200"/><p className="mt-2 text-xs font-black tracking-[.2em] text-yellow-200">SELO DO CONHECIMENTO</p><h2 className="mt-2 text-2xl font-black">{challenge.title}</h2><p className="my-5 font-bold leading-relaxed">{challenge.prompt}</p><div className="grid gap-3 sm:grid-cols-2">{challenge.options.map(option => <button key={option} onClick={() => answer(option)} className="rounded-xl border border-white/20 bg-white/10 p-4 text-left text-sm font-bold hover:border-yellow-200 hover:bg-yellow-200 hover:text-slate-950">{option}</button>)}</div></section></div>}
    {stage === 'won' && <div className="absolute inset-0 z-40 grid place-items-center bg-[#071528]/70 p-5 backdrop-blur-sm"><section className="w-full max-w-sm rounded-[2rem] border-2 border-emerald-200 bg-gradient-to-br from-emerald-500 to-cyan-700 p-8 text-center shadow-2xl"><Sparkles className="mx-auto h-12 w-12 text-yellow-100"/><h2 className="mt-3 text-3xl font-black">Território restaurado!</h2><p className="my-4 font-medium">Você abriu o portal, enfrentou o Guardião e respondeu ao desafio final.</p><button onClick={() => onWin(100, 30)} className="w-full rounded-xl bg-yellow-200 py-4 font-black text-slate-950">COLETAR +100 XP</button></section></div>}
  </main>;
}
