import { useEffect, useState } from 'react';
import { ArrowLeft, Check, CircleHelp, Footprints, Heart, Lock, MapPin, Shield, Sparkles, Swords, X } from 'lucide-react';
import { PlayerProfile } from '../types';

interface BattleScreenProps { territoryId: string; profile: PlayerProfile; onWin: (territory: string, xp: number, coins: number) => void; onLeave: () => void; }

const pathChallenges = [
  { name: 'Marco do Rio', topic: 'Águas da Floresta', prompt: 'Por que os rios da Amazônia são importantes?', options: ['Somente para barcos', 'Ajudam a manter a vida, o clima e comunidades', 'Não têm relação com a floresta', 'Servem apenas como fronteira'], answer: 'Ajudam a manter a vida, o clima e comunidades' },
  { name: 'Ponte da Vida', topic: 'Biodiversidade', prompt: 'O que significa biodiversidade?', options: ['Ter apenas uma espécie', 'A variedade de seres vivos de um lugar', 'Construir mais cidades', 'Cortar árvores antigas'], answer: 'A variedade de seres vivos de um lugar' },
  { name: 'Ruína Verde', topic: 'Preservação', prompt: 'Qual escolha protege melhor uma floresta?', options: ['Descartar lixo nos rios', 'Queimar áreas para abrir espaço', 'Respeitar áreas protegidas e usar recursos com cuidado', 'Retirar animais do habitat'], answer: 'Respeitar áreas protegidas e usar recursos com cuidado' },
];

const territoryStories: Record<string, { title: string; portal: string; challenges: typeof pathChallenges }> = {
  brasil: { title: 'Ruínas do Brasil', portal: 'Portal das Águas', challenges: pathChallenges },
  mexico: { title: 'Vale do México', portal: 'Portal do Sol', challenges: [
    { name: 'Marco do Milho', topic: 'Civilizações', prompt: 'Por que o milho foi importante para muitos povos antigos do México?', options: ['Era usado apenas como enfeite', 'Foi uma base de alimentação e cultura', 'Não era cultivado na região', 'Servia somente para construir casas'], answer: 'Foi uma base de alimentação e cultura' },
    { name: 'Ponte dos Povos', topic: 'História', prompt: 'O que podemos aprender ao preservar sítios arqueológicos?', options: ['Nada sobre o passado', 'Como viviam povos de diferentes épocas', 'Somente nomes de cidades modernas', 'Apenas regras de esportes'], answer: 'Como viviam povos de diferentes épocas' },
    { name: 'Templo Vivo', topic: 'Patrimônio', prompt: 'Qual atitude respeita um patrimônio histórico?', options: ['Pichar paredes antigas', 'Retirar objetos para levar para casa', 'Cuidar do local e aprender com sua história', 'Ignorar orientações de visita'], answer: 'Cuidar do local e aprender com sua história' },
  ] },
  egito: { title: 'Areias do Egito', portal: 'Portal do Nilo', challenges: [
    { name: 'Marco do Nilo', topic: 'Geografia', prompt: 'Por que o rio Nilo foi tão importante para o Egito Antigo?', options: ['Levava neve o ano todo', 'Ajudava no cultivo e na vida das comunidades', 'Separava países da Europa', 'Era um rio sem água'], answer: 'Ajudava no cultivo e na vida das comunidades' },
    { name: 'Ponte das Estrelas', topic: 'Ciência', prompt: 'Como os povos antigos observavam o céu?', options: ['Para criar videogames', 'Para marcar tempo e orientar viagens', 'Apenas para escolher roupas', 'Para esconder monumentos'], answer: 'Para marcar tempo e orientar viagens' },
    { name: 'Câmara do Saber', topic: 'História', prompt: 'O que as pirâmides revelam sobre seus construtores?', options: ['Que não conheciam medidas', 'Organização, conhecimento e trabalho coletivo', 'Que viviam somente no mar', 'Que não construíam cidades'], answer: 'Organização, conhecimento e trabalho coletivo' },
  ] },
  japao: { title: 'Ilhas do Japão', portal: 'Portal dos Ventos', challenges: [
    { name: 'Marco das Ilhas', topic: 'Geografia', prompt: 'O Japão é formado principalmente por quê?', options: ['Uma grande planície única', 'Um conjunto de ilhas', 'Um deserto sem montanhas', 'Uma ilha no oceano Atlântico'], answer: 'Um conjunto de ilhas' },
    { name: 'Ponte da Harmonia', topic: 'Cultura', prompt: 'Por que conhecer outras culturas é importante?', options: ['Para repetir estereótipos', 'Para respeitar diferenças e ampliar conhecimentos', 'Para deixar de aprender história', 'Para escolher apenas um país'], answer: 'Para respeitar diferenças e ampliar conhecimentos' },
    { name: 'Jardim dos Ventos', topic: 'Natureza', prompt: 'Qual atitude ajuda a cuidar de espaços naturais?', options: ['Deixar lixo no chão', 'Observar e preservar plantas e animais', 'Quebrar galhos por diversão', 'Alimentar qualquer animal sem orientação'], answer: 'Observar e preservar plantas e animais' },
  ] },
  andes: { title: 'Cordilheira dos Andes', portal: 'Portal das Montanhas', challenges: [
    { name: 'Marco da Altitude', topic: 'Geografia', prompt: 'O que é uma cordilheira?', options: ['Uma grande cadeia de montanhas', 'Um rio que corre no deserto', 'Uma floresta submersa', 'Uma cidade sem estradas'], answer: 'Uma grande cadeia de montanhas' },
    { name: 'Ponte das Nuvens', topic: 'Natureza', prompt: 'Por que as montanhas são importantes para a água?', options: ['Ajudam a formar nascentes e rios', 'Impedem toda chuva', 'Só guardam areia', 'Não têm relação com o clima'], answer: 'Ajudam a formar nascentes e rios' },
    { name: 'Eco do Vale', topic: 'Preservação', prompt: 'Como visitar uma área natural com responsabilidade?', options: ['Deixar marcas nas rochas', 'Seguir trilhas e recolher o lixo', 'Alimentar animais silvestres', 'Retirar plantas como lembrança'], answer: 'Seguir trilhas e recolher o lixo' },
  ] },
  oceano: { title: 'Recifes do Pacífico', portal: 'Portal das Marés', challenges: [
    { name: 'Marco do Coral', topic: 'Ciências', prompt: 'Por que os recifes de coral são importantes?', options: ['Servem de abrigo para muitos seres vivos', 'São feitos de plástico', 'Existem apenas em rios', 'Não fazem parte do oceano'], answer: 'Servem de abrigo para muitos seres vivos' },
    { name: 'Ponte Azul', topic: 'Sustentabilidade', prompt: 'Qual ação ajuda a reduzir a poluição dos oceanos?', options: ['Jogar lixo na praia', 'Reduzir plásticos descartáveis', 'Derramar óleo na água', 'Usar mais embalagens'], answer: 'Reduzir plásticos descartáveis' },
    { name: 'Farol do Mar', topic: 'Biodiversidade', prompt: 'O que devemos fazer ao observar animais marinhos?', options: ['Respeitar distância e habitat', 'Tentar capturá-los', 'Alimentá-los sem orientação', 'Retirar conchas vivas'], answer: 'Respeitar distância e habitat' },
  ] },
  savana: { title: 'Savanas da África', portal: 'Portal dos Baobás', challenges: [
    { name: 'Marco do Baobá', topic: 'Biomas', prompt: 'O que é uma savana?', options: ['Um bioma com gramíneas e árvores espaçadas', 'Um oceano congelado', 'Uma floresta apenas de pinheiros', 'Uma cidade subterrânea'], answer: 'Um bioma com gramíneas e árvores espaçadas' },
    { name: 'Ponte da Migração', topic: 'Animais', prompt: 'Por que alguns animais migram?', options: ['Para buscar alimento e condições melhores', 'Porque não precisam de água', 'Para construir prédios', 'Apenas para brincar'], answer: 'Para buscar alimento e condições melhores' },
    { name: 'Rota do Leão', topic: 'Conservação', prompt: 'Como proteger espécies ameaçadas?', options: ['Preservar habitats e combater a caça ilegal', 'Destruir áreas naturais', 'Comprar animais silvestres', 'Poluir rios próximos'], answer: 'Preservar habitats e combater a caça ilegal' },
  ] },
  espaco: { title: 'Estação Estelar', portal: 'Portal das Constelações', challenges: [
    { name: 'Marco da Órbita', topic: 'Astronomia', prompt: 'O que é uma órbita?', options: ['O caminho de um corpo ao redor de outro', 'Uma estrela que apaga', 'Uma montanha no planeta', 'Um tipo de oceano'], answer: 'O caminho de um corpo ao redor de outro' },
    { name: 'Ponte Lunar', topic: 'Ciências', prompt: 'Por que a Lua parece mudar de forma no céu?', options: ['Vemos partes iluminadas diferentes ao longo do mês', 'Ela muda de tamanho de verdade', 'Ela desaparece todos os dias', 'As nuvens criam a Lua'], answer: 'Vemos partes iluminadas diferentes ao longo do mês' },
    { name: 'Código Estelar', topic: 'Exploração', prompt: 'Qual instrumento ajuda cientistas a observar o espaço?', options: ['Telescópio', 'Bússola de papel', 'Termômetro de cozinha', 'Apito'], answer: 'Telescópio' },
  ] },
};

const mathChallenges = [
  { prompt: '12 + 8 = ?', options: ['18', '20', '22', '24'], answer: '20' },
  { prompt: '35 − 9 = ?', options: ['24', '25', '26', '27'], answer: '26' },
  { prompt: '6 × 7 = ?', options: ['36', '40', '42', '48'], answer: '42' },
  { prompt: '48 ÷ 6 = ?', options: ['6', '7', '8', '9'], answer: '8' },
];
const extraChallenges = [
  { name: 'Olhar Atento', topic: 'Investigação', prompt: 'Qual é uma boa atitude antes de tirar uma conclusão sobre a natureza?', options: ['Observar e buscar informações confiáveis', 'Acreditar no primeiro boato', 'Ignorar todas as evidências', 'Escolher sem pensar'], answer: 'Observar e buscar informações confiáveis' },
  { name: 'Escolha Consciente', topic: 'Sustentabilidade', prompt: 'O que significa usar um recurso com responsabilidade?', options: ['Usar sem limites', 'Evitar desperdícios e pensar no futuro', 'Descartar quando quiser', 'Impedir que todos usem'], answer: 'Evitar desperdícios e pensar no futuro' },
  { name: 'Memória do Lugar', topic: 'Patrimônio', prompt: 'Por que preservar a história de um lugar é importante?', options: ['Ajuda a compreender pessoas e culturas', 'Só serve para decorar livros', 'Não tem relação com o presente', 'Impede novos aprendizados'], answer: 'Ajuda a compreender pessoas e culturas' },
  { name: 'Água em Movimento', topic: 'Ciências', prompt: 'Qual atitude ajuda a proteger a água?', options: ['Evitar poluir rios e nascentes', 'Jogar resíduos na rua', 'Desperdiçar água potável', 'Ignorar vazamentos'], answer: 'Evitar poluir rios e nascentes' },
  { name: 'Vida em Equilíbrio', topic: 'Biodiversidade', prompt: 'O que pode acontecer quando uma espécie desaparece?', options: ['O equilíbrio do ambiente pode ser afetado', 'Nada muda no ambiente', 'Todas as plantas crescem mais', 'Os rios deixam de existir'], answer: 'O equilíbrio do ambiente pode ser afetado' },
  { name: 'Rota do Conhecimento', topic: 'Geografia', prompt: 'Mapas são úteis porque ajudam a quê?', options: ['Localizar lugares e compreender espaços', 'Substituir todas as viagens', 'Criar animais novos', 'Mudar o clima'], answer: 'Localizar lugares e compreender espaços' },
  { name: 'Guardião da Missão', topic: 'Cidadania', prompt: 'Qual escolha demonstra cuidado com um espaço coletivo?', options: ['Respeitar regras e colaborar com outras pessoas', 'Danificar o que é de todos', 'Deixar lixo pelo caminho', 'Ignorar quem precisa de ajuda'], answer: 'Respeitar regras e colaborar com outras pessoas' },
];

export function BattleScreen({ territoryId, profile, onWin, onLeave }: BattleScreenProps) {
  const story = territoryStories[territoryId] ?? territoryStories.brasil;
  const adventure = { ...story, challenges: [...story.challenges, ...extraChallenges] };
  const routeStops = Array.from({ length: adventure.challenges.length + 2 }, (_, index) => ({ left: `${22 + index * 5.2}%`, bottom: `${16 + index * 5}%` }));
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
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ pathStep, bossHp, playerHp }));
  }, [bossHp, pathStep, playerHp, storageKey]);

  const openNextChallenge = () => {
    if (pathStep < adventure.challenges.length) setModal('path');
    else setModal('math');
  };
  const answerPath = (option: string) => {
    const current = adventure.challenges[pathStep];
    if (option !== current.answer) {
      const nextHp = Math.max(0, playerHp - 20);
      setPlayerHp(nextHp);
      setFeedback(nextHp ? 'Resposta incorreta. Você perdeu 20 de energia. Tente novamente para seguir pela trilha.' : 'Sua energia acabou. Você voltou ao último marco seguro.');
      if (!nextHp) { setPathStep(Math.max(0, pathStep - 1)); setPlayerHp(100); setModal(null); }
      return false;
    }
    const next = pathStep + 1;
    setPathStep(next); setModal(null);
    setFeedback(next === adventure.challenges.length ? 'Você chegou ao Guardião. Agora cada conta matemática tira energia dele.' : 'Resposta correta! O explorador avançou até o próximo marco.');
    return true;
  };
  const answerMath = (option: string) => {
    const current = mathChallenges[(100 - bossHp) / 25];
    if (option !== current.answer) {
      const nextHp = Math.max(0, playerHp - 15);
      setPlayerHp(nextHp);
      setFeedback(nextHp ? 'Conta incorreta. O Guardião contra-atacou e você perdeu 15 de energia.' : 'Sua energia acabou. Você retornou ao início do confronto.');
      if (!nextHp) { setBossHp(100); setPlayerHp(100); setModal(null); }
      return false;
    }
    const next = Math.max(0, bossHp - 25);
    setBossHp(next); setModal(null);
    if (!next) { localStorage.removeItem(storageKey); setWon(true); setFeedback('Excelente. O Guardião perdeu toda a energia.'); }
    else setFeedback('Conta correta! O Guardião perdeu 25 pontos de energia.');
    return true;
  };

  const isBoss = pathStep >= adventure.challenges.length;
  const progressLabel = isBoss ? `Guardião: ${4 - bossHp / 25}/4 contas` : `Trilha: ${pathStep}/${adventure.challenges.length} marcos`;

  return <main className="relative min-h-[100dvh] overflow-hidden bg-[#08172d] text-white">
    <img src="/assets/brazil-adventure-world.webp" alt="Floresta brasileira com ruínas e portal" className="absolute inset-0 h-full w-full object-cover" />
    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,12,29,.76)_0%,rgba(3,12,29,.04)_38%,rgba(3,12,29,.72)_100%)]" />
    <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between p-3 sm:p-5"><button onClick={onLeave} className="rounded-xl border border-white/30 bg-slate-950/65 px-3 py-2 text-sm font-black backdrop-blur"><ArrowLeft className="mr-1 inline h-4 w-4" />Sair</button><div className="text-center"><p className="text-[10px] font-black tracking-[.28em] text-cyan-200">TERRAVOX</p><h1 className="text-lg font-black sm:text-2xl">{adventure.title}</h1></div><div className="rounded-xl bg-slate-950/65 px-3 py-2 text-right text-xs font-bold backdrop-blur">{profile.name}<br/><span className="text-yellow-300">Nível {profile.level}</span></div></header>

    <aside className="absolute left-3 top-20 z-30 w-40 rounded-2xl border border-white/25 bg-[#071528]/80 p-3 backdrop-blur sm:left-5 sm:top-24 sm:w-48"><p className="flex items-center gap-1 text-xs font-black"><Heart className="h-4 w-4 text-rose-400" /> EXPLORADOR</p><div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-900"><div className={`h-full bg-gradient-to-r transition-all ${playerHp > 35 ? 'from-cyan-400 to-emerald-300' : 'from-orange-400 to-rose-500'}`} style={{ width: `${playerHp}%` }} /></div><p className="mt-1 text-right text-xs font-black">{playerHp}/100</p>{isBoss && <><div className="my-3 border-t border-white/15"/><p className="flex items-center gap-1 text-xs font-black text-rose-100"><Swords className="h-4 w-4" /> GUARDIÃO</p><div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-900"><div className="h-full bg-gradient-to-r from-rose-600 to-orange-400 transition-all" style={{ width: `${bossHp}%` }} /></div><p className="mt-1 text-right text-xs font-black">{bossHp}/100</p></>}</aside>

    <section className="absolute inset-x-0 bottom-0 top-16 z-10 mx-auto max-w-7xl">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"><path d="M22 84 C38 70, 56 53, 79 29" fill="none" stroke="rgba(255,222,104,.95)" strokeWidth=".7" strokeDasharray="2.2 1.5" className="drop-shadow-[0_0_7px_rgba(250,204,21,.85)]" /></svg>
      <div className="absolute left-[23%] bottom-[11%] rounded-xl border border-white/25 bg-slate-950/65 px-2 py-1 text-[9px] font-black text-cyan-100 backdrop-blur"><Footprints className="mr-1 inline h-3 w-3 text-yellow-300"/>TRILHA DAS RUÍNAS</div>
      {adventure.challenges.map((challenge, index) => { const stop = routeStops[index + 1]; return <button key={challenge.name} onClick={index === pathStep ? openNextChallenge : undefined} disabled={index !== pathStep} aria-label={index === pathStep ? `Responder desafio ${index + 1}: ${challenge.name}` : `Desafio ${index + 1} bloqueado`} className={`absolute z-30 grid h-9 w-9 place-items-center rounded-full border-2 text-xs font-black shadow-lg transition sm:h-12 sm:w-12 sm:border-4 ${index < pathStep ? 'border-emerald-200 bg-emerald-500 text-white' : index === pathStep ? 'border-yellow-100 bg-yellow-400 text-slate-950 shadow-yellow-400/70 animate-pulse' : 'border-slate-300/50 bg-slate-950/75 text-slate-300'}`} style={{ left: stop.left, bottom: stop.bottom, transform: 'translate(-50%, 50%)' }}>{index < pathStep ? <Check className="h-4 w-4 sm:h-5 sm:w-5" /> : index === pathStep ? <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" /> : <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}{index === pathStep && <span className="absolute -bottom-6 whitespace-nowrap rounded bg-slate-950/75 px-1.5 py-0.5 text-[8px] font-black text-white">{index + 1}/10</span>}</button>; })}
      <button onClick={isBoss ? openNextChallenge : undefined} disabled={!isBoss} aria-label={isBoss ? `Abrir ${adventure.portal}` : `${adventure.portal} bloqueado`} className={`absolute z-30 grid h-14 w-14 place-items-center rounded-full border-4 text-cyan-50 shadow-[0_0_30px_rgba(34,211,238,.65)] sm:h-16 sm:w-16 ${isBoss ? 'border-yellow-100 bg-cyan-400/45 animate-pulse' : 'border-cyan-100 bg-cyan-400/30'}`} style={{ left: routeStops[adventure.challenges.length + 1].left, bottom: routeStops[adventure.challenges.length + 1].bottom, transform: 'translate(-50%, 50%)' }}><MapPin className="h-7 w-7 sm:h-8 sm:w-8" /><span className="absolute -bottom-6 whitespace-nowrap text-[8px] font-black sm:text-[9px]">{adventure.portal}</span></button>
      <img src="/assets/terravox-explorer.webp" alt="Explorador Terravox" className="pointer-events-none absolute z-20 hidden w-[14vw] max-w-[130px] min-w-[76px] drop-shadow-[0_16px_14px_rgba(0,0,0,.7)] transition-all duration-700 sm:block" style={{ left: routeStops[Math.min(pathStep, adventure.challenges.length)].left, bottom: routeStops[Math.min(pathStep, adventure.challenges.length)].bottom, transform: 'translate(-45%, 42%)' }} />
      {isBoss && bossHp > 0 && <><img src="/assets/forest-guardian.webp" alt="Guardião da floresta" className="absolute right-[5%] top-[19%] z-20 w-[28vw] max-w-[270px] min-w-[130px] drop-shadow-[0_20px_20px_rgba(0,0,0,.65)]" /><button onClick={openNextChallenge} className="absolute right-[10%] top-[45%] z-30 rounded-2xl border-2 border-yellow-100 bg-gradient-to-b from-yellow-300 to-orange-500 px-4 py-3 text-center text-xs font-black text-slate-950 shadow-[0_0_30px_rgba(250,204,21,.8)] active:scale-95"><Swords className="mx-auto mb-1 h-5 w-5"/>RESOLVER CONTA<br/>E ATACAR</button></>}
      {isBoss && <div className="absolute right-[8%] top-[16%] z-20 rounded-full border-2 border-rose-200/70 bg-rose-800/40 px-3 py-1 text-[10px] font-black text-rose-50 backdrop-blur">GUARDIÃO DAS RUÍNAS</div>}
    </section>

    <button onClick={() => setShowHelp(true)} aria-label="Como jogar" className="absolute bottom-5 right-5 z-30 grid h-12 w-12 place-items-center rounded-2xl border-2 border-cyan-100/70 bg-[#071528]/90 text-cyan-100 shadow-lg backdrop-blur"><CircleHelp className="h-6 w-6"/></button>
    {showHelp && <div className="absolute inset-0 z-40 grid place-items-end bg-slate-950/35 p-4 backdrop-blur-sm sm:place-items-center"><section className="w-full max-w-sm rounded-3xl border border-cyan-100/40 bg-[#071528]/95 p-5 shadow-2xl"><button onClick={() => setShowHelp(false)} className="float-right rounded-lg p-1"><X className="h-5 w-5"/></button><p className="text-xs font-black tracking-[.18em] text-cyan-200">COMO JOGAR</p><h2 className="mt-2 text-xl font-black">Siga a trilha até {adventure.portal}</h2><p className="mt-3 text-sm leading-relaxed text-slate-200">Toque no marco brilhante para responder a pergunta do território. Acertou, você avança. Errou, perde energia. Ao chegar no Guardião, resolva contas para vencê-lo.</p><div className="mt-4 inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-black text-cyan-100">{progressLabel}</div></section></div>}

    {modal === 'path' && <QuestionModal eyebrow={adventure.challenges[pathStep].topic} title={adventure.challenges[pathStep].name} prompt={adventure.challenges[pathStep].prompt} options={adventure.challenges[pathStep].options} onAnswer={answerPath} />}
    {modal === 'math' && <QuestionModal eyebrow="ATAQUE DE LÓGICA" title="Conta contra o Guardião" prompt={mathChallenges[(100 - bossHp) / 25].prompt} options={mathChallenges[(100 - bossHp) / 25].options} onAnswer={answerMath} />}
    {won && <div className="absolute inset-0 z-50 grid place-items-center bg-[#071528]/70 p-5 backdrop-blur-sm"><section className="w-full max-w-sm rounded-[2rem] border-2 border-emerald-200 bg-gradient-to-br from-emerald-500 to-cyan-700 p-8 text-center shadow-2xl"><Sparkles className="mx-auto h-12 w-12 text-yellow-100"/><h2 className="mt-3 text-3xl font-black">Território restaurado!</h2><p className="my-4 font-medium">Você percorreu a trilha, respondeu aos desafios do território e venceu o Guardião com matemática.</p><button onClick={() => onWin(territoryId, 150, 40)} className="w-full rounded-xl bg-yellow-200 py-4 font-black text-slate-950">COLETAR +150 XP</button></section></div>}
  </main>;
}

function QuestionModal({ eyebrow, title, prompt, options, onAnswer }: { eyebrow: string; title: string; prompt: string; options: string[]; onAnswer: (option: string) => boolean }) {
  const [error, setError] = useState<string | null>(null);
  const choose = (option: string) => { const correct = onAnswer(option); setError(correct ? null : 'Resposta incorreta. Você perdeu energia. Escolha outra alternativa para continuar.'); };
  return <div className="absolute inset-0 z-40 grid place-items-end bg-[#071528]/80 p-3 backdrop-blur-sm sm:place-items-center sm:p-4"><section className="max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-[2rem] border-2 border-yellow-200/70 bg-[linear-gradient(135deg,#174054,#3b1b68)] p-5 text-center shadow-2xl sm:p-9"><Shield className="mx-auto h-8 w-8 text-yellow-200 sm:h-9 sm:w-9"/><p className="mt-2 text-xs font-black tracking-[.2em] text-yellow-200">{eyebrow}</p><h2 className="mt-2 text-xl font-black sm:text-2xl">{title}</h2><p className="my-4 text-base font-bold leading-relaxed sm:my-5 sm:text-lg">{prompt}</p>{error && <div role="alert" className="mb-4 rounded-xl border border-rose-200/70 bg-rose-950/65 px-4 py-3 text-left text-sm font-bold text-rose-50">{error}</div>}<div className="grid gap-3 sm:grid-cols-2">{options.map(option => <button key={option} onClick={() => choose(option)} className="rounded-xl border border-white/20 bg-white/10 p-3 text-left text-sm font-bold transition hover:scale-[1.02] hover:border-yellow-200 hover:bg-yellow-200 hover:text-slate-950 sm:p-4">{option}</button>)}</div></section></div>;
}
