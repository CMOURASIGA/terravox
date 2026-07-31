import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Footprints, Heart, Lock, MapPin, Shield, Sparkles, Swords } from 'lucide-react';
import { PlayerProfile } from '../types';

interface BattleScreenProps { territoryId: string; profile: PlayerProfile; onWin: (xp: number, coins: number) => void; onLeave: () => void; }

const pathChallenges = [
  { name: 'Marco do Rio', topic: 'Águas da Floresta', prompt: 'Por que os rios da Amazônia são importantes?', options: ['Somente para barcos', 'Ajudam a manter a vida, o clima e comunidades', 'Não têm relação com a floresta', 'Servem apenas como fronteira'], answer: 'Ajudam a manter a vida, o clima e comunidades' },
  { name: 'Ponte da Vida', topic: 'Biodiversidade', prompt: 'O que significa biodiversidade?', options: ['Ter apenas uma espécie', 'A variedade de seres vivos de um lugar', 'Construir mais cidades', 'Cortar árvores antigas'], answer: 'A variedade de seres vivos de um lugar' },
  { name: 'Ruína Verde', topic: 'Preservação', prompt: 'Qual escolha protege melhor uma floresta?', options: ['Descartar lixo nos rios', 'Queimar áreas para abrir espaço', 'Respeitar áreas protegidas e usar recursos com cuidado', 'Retirar animais do habitat'], answer: 'Respeitar áreas protegidas e usar recursos com cuidado' },
];

const mathChallenges = [
  { prompt: '12 + 8 = ?', options: ['18', '20', '22', '24'], answer: '20' },
  { prompt: '35 − 9 = ?', options: ['24', '25', '26', '27'], answer: '26' },
  { prompt: '6 × 7 = ?', options: ['36', '40', '42', '48'], answer: '42' },
  { prompt: '48 ÷ 6 = ?', options: ['6', '7', '8', '9'], answer: '8' },
];

const routeStops = [
  { left: '27%', bottom: '18%', label: 'Acampamento' },
  { left: '43%', bottom: '31%', label: 'Marco do Rio' },
  { left: '56%', bottom: '46%', label: 'Ponte da Vida' },
  { left: '67%', bottom: '59%', label: 'Portal das Águas' },
];

export function BattleScreen({ territoryId, profile, onWin, onLeave }: BattleScreenProps) {
  const storageKey = `terravox.route.${profile.name.trim().toLowerCase()}.${territoryId}`;
  const [savedRoute] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}') as { pathStep?: number; bossHp?: number; playerHp?: number }; } catch { return {}; }
  });
  const [pathStep, setPathStep] = useState(savedRoute.pathStep ?? 0);
  const [bossHp, setBossHp] = useState(savedRoute.bossHp ?? 100);
  const [playerHp, setPlayerHp] = useState(savedRoute.playerHp ?? 100);
  const [modal, setModal] = useState<'path' | 'math' | null>(null);
  const [feedback, setFeedback] = useState('Siga a trilha. Cada marco libera uma pergunta para avançar.');
  const [won, setWon] = useState(false);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ pathStep, bossHp, playerHp }));
  }, [bossHp, pathStep, playerHp, storageKey]);

  const openNextChallenge = () => {
    if (pathStep < pathChallenges.length) setModal('path');
    else setModal('math');
  };
  const answerPath = (option: string) => {
    const current = pathChallenges[pathStep];
    if (option !== current.answer) {
      const nextHp = Math.max(0, playerHp - 20);
      setPlayerHp(nextHp);
      setFeedback(nextHp ? 'Resposta incorreta. Você perdeu 20 de energia. Tente novamente para seguir pela trilha.' : 'Sua energia acabou. Você voltou ao último marco seguro.');
      if (!nextHp) { setPathStep(Math.max(0, pathStep - 1)); setPlayerHp(100); setModal(null); }
      return;
    }
    const next = pathStep + 1;
    setPathStep(next); setModal(null);
    setFeedback(next === pathChallenges.length ? 'Você chegou ao Guardião. Agora cada conta matemática tira energia dele.' : 'Resposta correta! O explorador avançou até o próximo marco.');
  };
  const answerMath = (option: string) => {
    const current = mathChallenges[(100 - bossHp) / 25];
    if (option !== current.answer) {
      const nextHp = Math.max(0, playerHp - 15);
      setPlayerHp(nextHp);
      setFeedback(nextHp ? 'Conta incorreta. O Guardião contra-atacou e você perdeu 15 de energia.' : 'Sua energia acabou. Você retornou ao início do confronto.');
      if (!nextHp) { setBossHp(100); setPlayerHp(100); setModal(null); }
      return;
    }
    const next = Math.max(0, bossHp - 25);
    setBossHp(next); setModal(null);
    if (!next) { localStorage.removeItem(storageKey); setWon(true); setFeedback('Excelente. O Guardião perdeu toda a energia.'); }
    else setFeedback('Conta correta! O Guardião perdeu 25 pontos de energia.');
  };

  const isBoss = pathStep === pathChallenges.length;
  const progressLabel = isBoss ? `Guardião: ${4 - bossHp / 25}/4 contas` : `Trilha: ${pathStep}/${pathChallenges.length} marcos`;

  return <main className="relative min-h-[100dvh] overflow-hidden bg-[#08172d] text-white">
    <img src="/assets/brazil-adventure-world.webp" alt="Floresta brasileira com ruínas e portal" className="absolute inset-0 h-full w-full object-cover" />
    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,12,29,.76)_0%,rgba(3,12,29,.04)_38%,rgba(3,12,29,.72)_100%)]" />
    <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between p-3 sm:p-5"><button onClick={onLeave} className="rounded-xl border border-white/30 bg-slate-950/65 px-3 py-2 text-sm font-black backdrop-blur"><ArrowLeft className="mr-1 inline h-4 w-4" />Sair</button><div className="text-center"><p className="text-[10px] font-black tracking-[.28em] text-cyan-200">TERRAVOX</p><h1 className="text-lg font-black sm:text-2xl">Ruínas do {territoryId.toUpperCase()}</h1></div><div className="rounded-xl bg-slate-950/65 px-3 py-2 text-right text-xs font-bold backdrop-blur">{profile.name}<br/><span className="text-yellow-300">Nível {profile.level}</span></div></header>

    <aside className="absolute left-3 top-20 z-30 w-40 rounded-2xl border border-white/25 bg-[#071528]/80 p-3 backdrop-blur sm:left-5 sm:top-24 sm:w-48"><p className="flex items-center gap-1 text-xs font-black"><Heart className="h-4 w-4 text-rose-400" /> EXPLORADOR</p><div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-900"><div className={`h-full bg-gradient-to-r transition-all ${playerHp > 35 ? 'from-cyan-400 to-emerald-300' : 'from-orange-400 to-rose-500'}`} style={{ width: `${playerHp}%` }} /></div><p className="mt-1 text-right text-xs font-black">{playerHp}/100</p>{isBoss && <><div className="my-3 border-t border-white/15"/><p className="flex items-center gap-1 text-xs font-black text-rose-100"><Swords className="h-4 w-4" /> GUARDIÃO</p><div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-900"><div className="h-full bg-gradient-to-r from-rose-600 to-orange-400 transition-all" style={{ width: `${bossHp}%` }} /></div><p className="mt-1 text-right text-xs font-black">{bossHp}/100</p></>}</aside>

    <section className="absolute inset-x-0 bottom-0 top-16 z-10 mx-auto max-w-7xl">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"><path d="M27 81 C35 74, 37 70, 43 67 S51 58, 56 52 S63 43, 67 36" fill="none" stroke="rgba(255,222,104,.95)" strokeWidth=".7" strokeDasharray="2.2 1.5" className="drop-shadow-[0_0_7px_rgba(250,204,21,.85)]" /></svg>
      <div className="absolute left-[23%] bottom-[11%] rounded-xl border border-white/25 bg-slate-950/65 px-2 py-1 text-[9px] font-black text-cyan-100 backdrop-blur"><Footprints className="mr-1 inline h-3 w-3 text-yellow-300"/>TRILHA DAS RUÍNAS</div>
      {[0, 1, 2].map((index) => { const stop = routeStops[index + 1]; return <button key={index} onClick={index === pathStep ? openNextChallenge : undefined} disabled={index !== pathStep} className={`absolute z-20 grid h-12 w-12 place-items-center rounded-full border-4 text-xs font-black shadow-lg transition sm:h-16 sm:w-16 ${index < pathStep ? 'border-emerald-200 bg-emerald-500 text-white' : index === pathStep ? 'border-yellow-100 bg-yellow-400 text-slate-950 shadow-yellow-400/70 animate-pulse' : 'border-slate-300/50 bg-slate-950/75 text-slate-300'}`} style={{ left: stop.left, bottom: stop.bottom, transform: 'translate(-50%, 50%)' }}>{index < pathStep ? <Check className="h-6 w-6" /> : index === pathStep ? <Sparkles className="h-6 w-6" /> : <Lock className="h-5 w-5" />}<span className="absolute -bottom-7 whitespace-nowrap text-[9px] font-black text-white drop-shadow">{pathChallenges[index].name}</span></button>; })}
      <div className="absolute z-20 grid h-16 w-16 place-items-center rounded-full border-4 border-cyan-100 bg-cyan-400/30 text-cyan-50 shadow-[0_0_30px_rgba(34,211,238,.65)]" style={{ left: routeStops[3].left, bottom: routeStops[3].bottom, transform: 'translate(-50%, 50%)' }}><MapPin className="h-8 w-8" /></div>
      <img src="/assets/terravox-explorer.webp" alt="Explorador Terravox" className="absolute z-20 w-[18vw] max-w-[175px] min-w-[92px] drop-shadow-[0_16px_14px_rgba(0,0,0,.7)] transition-all duration-700" style={{ left: routeStops[pathStep].left, bottom: routeStops[pathStep].bottom, transform: 'translate(-45%, 35%)' }} />
      <div className="absolute z-20 rounded-full border-2 border-cyan-200/80 bg-slate-950/65 px-2 py-1 text-[9px] font-black text-cyan-50 backdrop-blur transition-all duration-700" style={{ left: routeStops[pathStep].left, bottom: routeStops[pathStep].bottom, transform: 'translate(-42%, -135%)' }}>EXPLORADOR</div>
      {isBoss && bossHp > 0 && <><img src="/assets/forest-guardian.webp" alt="Guardião da floresta" className="absolute right-[5%] top-[19%] z-20 w-[28vw] max-w-[270px] min-w-[130px] drop-shadow-[0_20px_20px_rgba(0,0,0,.65)]" /><button onClick={openNextChallenge} className="absolute right-[10%] top-[45%] z-30 rounded-2xl border-2 border-yellow-100 bg-gradient-to-b from-yellow-300 to-orange-500 px-4 py-3 text-center text-xs font-black text-slate-950 shadow-[0_0_30px_rgba(250,204,21,.8)] active:scale-95"><Swords className="mx-auto mb-1 h-5 w-5"/>RESOLVER CONTA<br/>E ATACAR</button></>}
      {isBoss && <div className="absolute right-[8%] top-[16%] z-20 rounded-full border-2 border-rose-200/70 bg-rose-800/40 px-3 py-1 text-[10px] font-black text-rose-50 backdrop-blur">GUARDIÃO DAS RUÍNAS</div>}
    </section>

    <div className="absolute inset-x-3 bottom-4 z-30 mx-auto max-w-xl rounded-2xl border border-white/25 bg-[#071528]/90 p-3 text-center backdrop-blur sm:bottom-6"><p className="text-sm font-bold sm:text-base">{feedback}</p><div className="mt-2 inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-black text-cyan-100">{progressLabel}</div></div>

    {modal === 'path' && <QuestionModal eyebrow={pathChallenges[pathStep].topic} title={pathChallenges[pathStep].name} prompt={pathChallenges[pathStep].prompt} options={pathChallenges[pathStep].options} onAnswer={answerPath} />}
    {modal === 'math' && <QuestionModal eyebrow="ATAQUE DE LÓGICA" title="Conta contra o Guardião" prompt={mathChallenges[(100 - bossHp) / 25].prompt} options={mathChallenges[(100 - bossHp) / 25].options} onAnswer={answerMath} />}
    {won && <div className="absolute inset-0 z-50 grid place-items-center bg-[#071528]/70 p-5 backdrop-blur-sm"><section className="w-full max-w-sm rounded-[2rem] border-2 border-emerald-200 bg-gradient-to-br from-emerald-500 to-cyan-700 p-8 text-center shadow-2xl"><Sparkles className="mx-auto h-12 w-12 text-yellow-100"/><h2 className="mt-3 text-3xl font-black">Território restaurado!</h2><p className="my-4 font-medium">Você percorreu a trilha, respondeu aos desafios ambientais e venceu o Guardião com matemática.</p><button onClick={() => onWin(150, 40)} className="w-full rounded-xl bg-yellow-200 py-4 font-black text-slate-950">COLETAR +150 XP</button></section></div>}
  </main>;
}

function QuestionModal({ eyebrow, title, prompt, options, onAnswer }: { eyebrow: string; title: string; prompt: string; options: string[]; onAnswer: (option: string) => void }) {
  return <div className="absolute inset-0 z-40 grid place-items-center bg-[#071528]/80 p-4 backdrop-blur-sm"><section className="w-full max-w-xl rounded-[2rem] border-2 border-yellow-200/70 bg-[linear-gradient(135deg,#174054,#3b1b68)] p-6 text-center shadow-2xl sm:p-9"><Shield className="mx-auto h-9 w-9 text-yellow-200"/><p className="mt-2 text-xs font-black tracking-[.2em] text-yellow-200">{eyebrow}</p><h2 className="mt-2 text-2xl font-black">{title}</h2><p className="my-5 text-lg font-bold leading-relaxed">{prompt}</p><div className="grid gap-3 sm:grid-cols-2">{options.map(option => <button key={option} onClick={() => onAnswer(option)} className="rounded-xl border border-white/20 bg-white/10 p-4 text-left text-sm font-bold transition hover:scale-[1.02] hover:border-yellow-200 hover:bg-yellow-200 hover:text-slate-950">{option}</button>)}</div></section></div>;
}
