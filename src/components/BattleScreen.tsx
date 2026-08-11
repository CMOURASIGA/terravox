import { useEffect, useState } from 'react';
import { ArrowLeft, Check, CircleHelp, Footprints, Heart, Loader2, Lock, MapPin, Shield, Sparkles, Swords, X } from 'lucide-react';
import { PlayerProfile } from '../types';
import { checkAnswer, fetchTerritoryQuestions, SourcedQuestion } from '../lib/questionSource';

interface BattleScreenProps { territoryId: string; profile: PlayerProfile; onWin: (territory: string, xp: number, coins: number) => void; onLeave: () => void; }

type MarcoLabel = { name: string; topic: string };
type Marco = MarcoLabel & { question: SourcedQuestion };

// Nomes e temas narrativos de cada marco da trilha. O conteúdo da pergunta
// em si (prompt/alternativas) não fica mais fixo aqui — vem do banco de
// perguntas aprovadas do território (ex.: México → Geografia/História),
// com geração por IA como fallback quando o banco não tem o suficiente.
// Ver src/lib/questionSource.ts.
const territoryLabels: Record<string, { title: string; portal: string; marcos: MarcoLabel[] }> = {
  brasil: { title: 'Ruínas do Brasil', portal: 'Portal das Águas', marcos: [
    { name: 'Marco do Rio', topic: 'Águas da Floresta' },
    { name: 'Ponte da Vida', topic: 'Biodiversidade' },
    { name: 'Ruína Verde', topic: 'Preservação' },
  ] },
  mexico: { title: 'Vale do México', portal: 'Portal do Sol', marcos: [
    { name: 'Marco do Milho', topic: 'Civilizações' },
    { name: 'Ponte dos Povos', topic: 'História' },
    { name: 'Templo Vivo', topic: 'Patrimônio' },
  ] },
  egito: { title: 'Areias do Egito', portal: 'Portal do Nilo', marcos: [
    { name: 'Marco do Nilo', topic: 'Geografia' },
    { name: 'Ponte das Estrelas', topic: 'Ciência' },
    { name: 'Câmara do Saber', topic: 'História' },
  ] },
  japao: { title: 'Ilhas do Japão', portal: 'Portal dos Ventos', marcos: [
    { name: 'Marco das Ilhas', topic: 'Geografia' },
    { name: 'Ponte da Harmonia', topic: 'Cultura' },
    { name: 'Jardim dos Ventos', topic: 'Natureza' },
  ] },
  andes: { title: 'Cordilheira dos Andes', portal: 'Portal das Montanhas', marcos: [
    { name: 'Marco da Altitude', topic: 'Geografia' },
    { name: 'Ponte das Nuvens', topic: 'Natureza' },
    { name: 'Eco do Vale', topic: 'Preservação' },
  ] },
  oceano: { title: 'Recifes do Pacífico', portal: 'Portal das Marés', marcos: [
    { name: 'Marco do Coral', topic: 'Ciências' },
    { name: 'Ponte Azul', topic: 'Sustentabilidade' },
    { name: 'Farol do Mar', topic: 'Biodiversidade' },
  ] },
  savana: { title: 'Savanas da África', portal: 'Portal dos Baobás', marcos: [
    { name: 'Marco do Baobá', topic: 'Biomas' },
    { name: 'Ponte da Migração', topic: 'Animais' },
    { name: 'Rota do Leão', topic: 'Conservação' },
  ] },
  espaco: { title: 'Estação Estelar', portal: 'Portal das Constelações', marcos: [
    { name: 'Marco da Órbita', topic: 'Astronomia' },
    { name: 'Ponte Lunar', topic: 'Ciências' },
    { name: 'Código Estelar', topic: 'Exploração' },
  ] },
  india: { title: 'Templos Sagrados da Índia', portal: 'Portal do Lótus', marcos: [
    { name: 'Marco do Lótus', topic: 'Espiritualidade' },
    { name: 'Ponte das Especiarias', topic: 'Comércio Antigo' },
    { name: 'Templo de Mármore', topic: 'Arquitetura' },
  ] },
  china: { title: 'Grande Muralha da China', portal: 'Portal do Dragão', marcos: [
    { name: 'Marco da Muralha', topic: 'Engenharia Antiga' },
    { name: 'Ponte da Seda', topic: 'Rotas Comerciais' },
    { name: 'Pagode do Dragão', topic: 'Tradição' },
  ] },
  grecia: { title: 'Colunas da Grécia Antiga', portal: 'Portal dos Deuses', marcos: [
    { name: 'Marco das Colunas', topic: 'Arquitetura Clássica' },
    { name: 'Ponte dos Filósofos', topic: 'Pensamento' },
    { name: 'Ágora Antiga', topic: 'Democracia' },
  ] },
  australia: { title: 'Outback da Austrália', portal: 'Portal do Deserto Vermelho', marcos: [
    { name: 'Marco do Deserto Vermelho', topic: 'Geologia' },
    { name: 'Ponte dos Marsupiais', topic: 'Fauna Única' },
    { name: 'Recife Distante', topic: 'Vida Marinha' },
  ] },
  canada: { title: 'Bosques Gelados do Canadá', portal: 'Portal da Aurora', marcos: [
    { name: 'Marco da Aurora', topic: 'Fenômenos Naturais' },
    { name: 'Ponte dos Ursos', topic: 'Fauna do Norte' },
    { name: 'Floresta Boreal', topic: 'Biomas Frios' },
  ] },
  russia: { title: 'Planícies da Rússia', portal: 'Portal de Inverno', marcos: [
    { name: 'Marco da Estepe', topic: 'Paisagens Abertas' },
    { name: 'Ponte de Inverno', topic: 'Clima Extremo' },
    { name: 'Torre do Kremlin', topic: 'História' },
  ] },
  italia: { title: 'Ateliês da Itália', portal: 'Portal da Renascença', marcos: [
    { name: 'Marco do Afresco', topic: 'Pintura Clássica' },
    { name: 'Ponte da Escultura', topic: 'Arte Renascentista' },
    { name: 'Ateliê Antigo', topic: 'Técnicas Artísticas' },
  ] },
  marrocos: { title: 'Dunas de Marrocos', portal: 'Portal das Especiarias', marcos: [
    { name: 'Marco das Dunas', topic: 'Deserto' },
    { name: 'Ponte das Especiarias', topic: 'Mercados' },
    { name: 'Pátio Azul', topic: 'Arquitetura' },
  ] },
  peru: { title: 'Caminhos Incas', portal: 'Portal do Sol Dourado', marcos: [
    { name: 'Marco da Trilha Inca', topic: 'Civilização Andina' },
    { name: 'Ponte de Pedra', topic: 'Engenharia Antiga' },
    { name: 'Terraço Sagrado', topic: 'Agricultura' },
  ] },
  quenia: { title: 'Manada do Quênia', portal: 'Portal da Grande Migração', marcos: [
    { name: 'Marco da Savana', topic: 'Ecossistema' },
    { name: 'Ponte da Migração', topic: 'Comportamento Animal' },
    { name: 'Vigia da Manada', topic: 'Conservação' },
  ] },
  noruega: { title: 'Fiordes Gelados', portal: 'Portal das Luzes do Norte', marcos: [
    { name: 'Marco do Fiorde', topic: 'Geografia Costeira' },
    { name: 'Ponte das Luzes', topic: 'Fenômenos do Céu' },
    { name: 'Farol do Norte', topic: 'Navegação' },
  ] },
  tailandia: { title: 'Templos Dourados', portal: 'Portal do Lótus Branco', marcos: [
    { name: 'Marco do Templo Dourado', topic: 'Arquitetura Sagrada' },
    { name: 'Ponte do Rio', topic: 'Cultura Fluvial' },
    { name: 'Mercado Flutuante', topic: 'Tradições' },
  ] },
  eua: { title: 'Laboratórios da Inovação', portal: 'Portal do Futuro', marcos: [
    { name: 'Marco da Inovação', topic: 'Tecnologia' },
    { name: 'Ponte dos Foguetes', topic: 'Exploração Espacial' },
    { name: 'Laboratório Aberto', topic: 'Ciência Aplicada' },
  ] },
  franca: { title: 'Galerias da França', portal: 'Portal das Artes', marcos: [
    { name: 'Marco da Galeria', topic: 'Pintura' },
    { name: 'Ponte das Estátuas', topic: 'Escultura' },
    { name: 'Ateliê de Paris', topic: 'Movimentos Artísticos' },
  ] },
  novazelandia: { title: 'Vulcões da Nova Zelândia', portal: 'Portal Maori', marcos: [
    { name: 'Marco Vulcânico', topic: 'Geologia Ativa' },
    { name: 'Ponte Maori', topic: 'Cultura Indígena' },
    { name: 'Baía dos Golfinhos', topic: 'Vida Marinha' },
  ] },
  indonesia: { title: 'Ilhas de Fogo', portal: 'Portal dos Vulcões', marcos: [
    { name: 'Marco do Vulcão', topic: 'Ilhas Vulcânicas' },
    { name: 'Ponte do Arquipélago', topic: 'Geografia Insular' },
    { name: 'Recife Tropical', topic: 'Biodiversidade' },
  ] },
  galapagos: { title: 'Laboratório Vivo de Galápagos', portal: 'Portal de Darwin', marcos: [
    { name: 'Marco de Darwin', topic: 'Evolução' },
    { name: 'Ponte das Tartarugas', topic: 'Espécies Únicas' },
    { name: 'Costa Selvagem', topic: 'Conservação' },
  ] },
  antartida: { title: 'Base Polar da Antártida', portal: 'Portal do Gelo Eterno', marcos: [
    { name: 'Marco do Gelo Eterno', topic: 'Clima Polar' },
    { name: 'Ponte dos Pinguins', topic: 'Vida Extrema' },
    { name: 'Base de Pesquisa', topic: 'Ciência Polar' },
  ] },
  islandia: { title: 'Terra do Gelo e Fogo', portal: 'Portal Geotérmico', marcos: [
    { name: 'Marco Geotérmico', topic: 'Vulcanismo' },
    { name: 'Ponte das Geleiras', topic: 'Gelo e Fogo' },
    { name: 'Fonte Termal', topic: 'Fenômenos Naturais' },
  ] },
  turquia: { title: 'Bazares de Istambul', portal: 'Portal dos Dois Continentes', marcos: [
    { name: 'Marco dos Dois Continentes', topic: 'Geografia' },
    { name: 'Ponte do Bazar', topic: 'Comércio Histórico' },
    { name: 'Cúpula Otomana', topic: 'Arquitetura' },
  ] },
  coreia: { title: 'Distrito Digital da Coreia', portal: 'Portal Neon', marcos: [
    { name: 'Marco Digital', topic: 'Tecnologia' },
    { name: 'Ponte Neon', topic: 'Inovação Urbana' },
    { name: 'Estúdio Criativo', topic: 'Cultura Pop' },
  ] },
  vietna: { title: 'Deltas do Vietnã', portal: 'Portal das Águas Verdes', marcos: [
    { name: 'Marco do Delta', topic: 'Rios e Agricultura' },
    { name: 'Ponte das Águas Verdes', topic: 'Paisagem Fluvial' },
    { name: 'Vila Flutuante', topic: 'Modo de Vida' },
  ] },
  escocia: { title: 'Highlands da Escócia', portal: 'Portal das Lendas', marcos: [
    { name: 'Marco do Castelo', topic: 'História Medieval' },
    { name: 'Ponte das Terras Altas', topic: 'Geografia' },
    { name: 'Lago das Lendas', topic: 'Folclore' },
  ] },
  chile: { title: 'Observatório do Atacama', portal: 'Portal das Estrelas do Sul', marcos: [
    { name: 'Marco do Deserto Seco', topic: 'Clima Extremo' },
    { name: 'Ponte das Estrelas', topic: 'Astronomia' },
    { name: 'Observatório do Atacama', topic: 'Ciência do Céu' },
  ] },
  suica: { title: 'Picos Suíços', portal: 'Portal Alpino', marcos: [
    { name: 'Marco Alpino', topic: 'Montanhismo' },
    { name: 'Ponte das Neves', topic: 'Esportes de Inverno' },
    { name: 'Trilha dos Picos', topic: 'Resistência' },
  ] },
  holanda: { title: 'Moinhos da Holanda', portal: 'Portal das Tulipas', marcos: [
    { name: 'Marco dos Moinhos', topic: 'Engenharia Hidráulica' },
    { name: 'Ponte das Tulipas', topic: 'Agricultura' },
    { name: 'Canal Histórico', topic: 'Urbanismo' },
  ] },
  portugal: { title: 'Porto das Navegações', portal: 'Portal do Atlântico', marcos: [
    { name: 'Marco das Caravelas', topic: 'Navegações' },
    { name: 'Ponte do Atlântico', topic: 'Exploração Marítima' },
    { name: 'Farol Antigo', topic: 'História Naval' },
  ] },
  argentina: { title: 'Campos da Argentina', portal: 'Portal do Tango', marcos: [
    { name: 'Marco dos Pampas', topic: 'Paisagem Aberta' },
    { name: 'Ponte do Tango', topic: 'Cultura' },
    { name: 'Campo de Treino', topic: 'Esporte' },
  ] },
  alasca: { title: 'Fronteira Selvagem do Alasca', portal: 'Portal Ártico', marcos: [
    { name: 'Marco Ártico', topic: 'Fauna Polar' },
    { name: 'Ponte das Geleiras', topic: 'Paisagem Gelada' },
    { name: 'Trilha dos Ursos', topic: 'Vida Selvagem' },
  ] },
  havai: { title: 'Ilhas de Fogo do Pacífico', portal: 'Portal do Vulcão Sagrado', marcos: [
    { name: 'Marco Vulcânico', topic: 'Formação de Ilhas' },
    { name: 'Ponte das Ondas', topic: 'Oceano Pacífico' },
    { name: 'Cratera Sagrada', topic: 'Geologia' },
  ] },
  estacaolunar: { title: 'Estação Lunar', portal: 'Portal das Crateras', marcos: [
    { name: 'Marco da Cratera', topic: 'Exploração Lunar' },
    { name: 'Ponte Gravitacional', topic: 'Física Espacial' },
    { name: 'Laboratório Orbital', topic: 'Tecnologia Espacial' },
  ] },
  templodosaber: { title: 'Templo Final do Conhecimento', portal: 'Portal da Sabedoria', marcos: [
    { name: 'Marco da Sabedoria', topic: 'Conhecimento Geral' },
    { name: 'Ponte dos Desafios', topic: 'Raciocínio' },
    { name: 'Salão Final', topic: 'Grande Prova' },
  ] },
};

const extraMarcos: MarcoLabel[] = [
  { name: 'Olhar Atento', topic: 'Investigação' },
  { name: 'Escolha Consciente', topic: 'Sustentabilidade' },
  { name: 'Memória do Lugar', topic: 'Patrimônio' },
  { name: 'Água em Movimento', topic: 'Ciências' },
  { name: 'Vida em Equilíbrio', topic: 'Biodiversidade' },
  { name: 'Rota do Conhecimento', topic: 'Geografia' },
  { name: 'Guardião da Missão', topic: 'Cidadania' },
];

// Só os 8 territórios originais têm arte ilustrada própria. Os demais (a
// partir do Nível 3) usam um gradiente temático em vez de uma imagem nova
// — evita depender de assets que ainda não existem, mantendo a tela
// funcional e visualmente coerente pra qualquer território futuro.
const territoryBackgrounds: Record<string, string> = {
  brasil: '/assets/brazil-adventure-world.webp',
  mexico: '/assets/worlds/mexico-world.webp',
  egito: '/assets/worlds/egito-world.webp',
  japao: '/assets/worlds/japao-world.webp',
  andes: '/assets/worlds/andes-world.webp',
  oceano: '/assets/worlds/oceano-world.webp',
  savana: '/assets/worlds/savana-world.webp',
  espaco: '/assets/worlds/espaco-world.webp',
};

const territoryGradients: Record<string, string> = {
  india: 'linear-gradient(160deg,#7c2d12,#f59e0b)',
  china: 'linear-gradient(160deg,#7f1d1d,#b91c1c)',
  grecia: 'linear-gradient(160deg,#1e3a5f,#60a5fa)',
  australia: 'linear-gradient(160deg,#7c2d12,#dc2626)',
  canada: 'linear-gradient(160deg,#0f2027,#2c5364)',
  russia: 'linear-gradient(160deg,#1e293b,#64748b)',
  italia: 'linear-gradient(160deg,#134e4a,#eab308)',
  marrocos: 'linear-gradient(160deg,#78350f,#f59e0b)',
  peru: 'linear-gradient(160deg,#422006,#facc15)',
  quenia: 'linear-gradient(160deg,#78350f,#fbbf24)',
  noruega: 'linear-gradient(160deg,#0c1e3d,#22d3ee)',
  tailandia: 'linear-gradient(160deg,#7c2d12,#fbbf24)',
  eua: 'linear-gradient(160deg,#1e1b4b,#6366f1)',
  franca: 'linear-gradient(160deg,#312e81,#a78bfa)',
  novazelandia: 'linear-gradient(160deg,#052e2b,#10b981)',
  indonesia: 'linear-gradient(160deg,#7c2d12,#f97316)',
  galapagos: 'linear-gradient(160deg,#083344,#06b6d4)',
  antartida: 'linear-gradient(160deg,#1e293b,#e2e8f0)',
  islandia: 'linear-gradient(160deg,#1e293b,#38bdf8)',
  turquia: 'linear-gradient(160deg,#7c2d12,#dc2626)',
  coreia: 'linear-gradient(160deg,#1e1b4b,#ec4899)',
  vietna: 'linear-gradient(160deg,#052e16,#22c55e)',
  escocia: 'linear-gradient(160deg,#134e4a,#4ade80)',
  chile: 'linear-gradient(160deg,#1e1b4b,#f59e0b)',
  suica: 'linear-gradient(160deg,#0c4a6e,#e0f2fe)',
  holanda: 'linear-gradient(160deg,#831843,#f472b6)',
  portugal: 'linear-gradient(160deg,#0c4a6e,#38bdf8)',
  argentina: 'linear-gradient(160deg,#1e3a8a,#93c5fd)',
  alasca: 'linear-gradient(160deg,#0f172a,#38bdf8)',
  havai: 'linear-gradient(160deg,#7c2d12,#fb923c)',
  estacaolunar: 'linear-gradient(160deg,#0f0c29,#302b63)',
  templodosaber: 'linear-gradient(160deg,#451a03,#fbbf24)',
  default: 'linear-gradient(160deg,#0f172a,#1e3a5f)',
};

// Precisa de pelo menos 4 marcos com pergunta carregada: 4 é o número de
// ataques de conhecimento do confronto com o Guardião (ver answerBoss).
const MIN_MARCOS = 4;

export function BattleScreen({ territoryId, profile, onWin, onLeave }: BattleScreenProps) {
  const labels = territoryLabels[territoryId] ?? territoryLabels.brasil;
  const background = territoryBackgrounds[territoryId];
  const backgroundGradient = territoryGradients[territoryId] ?? territoryGradients.default;
  const marcoLabels = [...labels.marcos, ...extraMarcos];
  const routeStops = [
    { left: '17%', bottom: '15%' },
    { left: '30%', bottom: '23%' },
    { left: '55%', bottom: '19%' },
    { left: '69%', bottom: '31%' },
    { left: '47%', bottom: '38%' },
    { left: '22%', bottom: '35%' },
    { left: '31%', bottom: '50%' },
    { left: '56%', bottom: '47%' },
    { left: '76%', bottom: '55%' },
    { left: '62%', bottom: '64%' },
    { left: '39%', bottom: '62%' },
    { left: '79%', bottom: '72%' },
  ];
  const storageKey = `terravox.route.${profile.name.trim().toLowerCase()}.${territoryId}`;
  const [savedRoute] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}') as { pathStep?: number; bossHp?: number; playerHp?: number }; } catch { return {}; }
  });
  const [pathStep, setPathStep] = useState(savedRoute.pathStep ?? 0);
  const [bossHp, setBossHp] = useState(savedRoute.bossHp ?? 100);
  const [playerHp, setPlayerHp] = useState(savedRoute.playerHp ?? 100);
  const [modal, setModal] = useState<'path' | 'boss' | null>(null);
  const [feedback, setFeedback] = useState('Siga a trilha. Cada marco traz uma descoberta, uma ação ou um desafio de conhecimento.');
  const [won, setWon] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [questions, setQuestions] = useState<SourcedQuestion[]>([]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ pathStep, bossHp, playerHp }));
  }, [bossHp, pathStep, playerHp, storageKey]);

  useEffect(() => {
    let cancelled = false;
    async function loadQuestions() {
      setLoadingQuestions(true);
      try {
        // Fonte principal: banco aprovado, filtrado pela categoria do
        // território. IA entra só como fallback quando faltam perguntas.
        const loaded = await fetchTerritoryQuestions({
          territoryId,
          theme: 'Batalha, Conhecimento Rápido, Matemática e Lógica',
          difficulty: 3,
          count: marcoLabels.length,
        });
        if (!cancelled) setQuestions(loaded);
      } finally {
        if (!cancelled) setLoadingQuestions(false);
      }
    }
    loadQuestions();
    return () => { cancelled = true; };
    // marcoLabels tem o mesmo tamanho para todo territoryId, então não
    // precisa entrar nas deps além do próprio território.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [territoryId]);

  const adventure = {
    title: labels.title,
    portal: labels.portal,
    challenges: marcoLabels.slice(0, questions.length).map((label, index): Marco => ({ ...label, question: questions[index] })),
  };

  if (loadingQuestions) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-12 h-12 animate-spin text-rose-500 mb-4" />
        <h2 className="text-xl font-bold">Iniciando Batalha...</h2>
      </div>
    );
  }

  if (adventure.challenges.length < MIN_MARCOS) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4 p-6 text-center">
        <p className="text-lg font-bold text-rose-300">Não foi possível carregar os desafios deste território agora.</p>
        <button onClick={onLeave} className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold">Voltar ao Mapa</button>
      </div>
    );
  }

  const openNextChallenge = () => {
    if (pathStep < adventure.challenges.length) setModal('path');
    else setModal('boss');
  };
  const answerPath = async (option: string, completedInteraction = false): Promise<boolean> => {
    const current = adventure.challenges[pathStep];
    const correct = completedInteraction || (await checkAnswer(current.question, option)).correct;
    if (!correct) {
      const nextHp = Math.max(0, playerHp - 20);
      setPlayerHp(nextHp);
      setFeedback(nextHp ? 'Resposta incorreta. Você perdeu 20 de energia. Tente novamente para seguir pela trilha.' : 'Sua energia acabou. Você voltou ao último marco seguro.');
      if (!nextHp) { setPathStep(Math.max(0, pathStep - 1)); setPlayerHp(100); setModal(null); }
      return false;
    }
    const next = pathStep + 1;
    setPathStep(next); setModal(null);
    setFeedback(next === adventure.challenges.length ? 'Você chegou ao Guardião. Use o que descobriu no território para enfraquecê-lo.' : 'Desafio concluído! O explorador avançou até o próximo marco.');
    return true;
  };
  const answerBoss = async (option: string): Promise<boolean> => {
    const current = adventure.challenges[(100 - bossHp) / 25];
    const { correct } = await checkAnswer(current.question, option);
    if (!correct) {
      const nextHp = Math.max(0, playerHp - 15);
      setPlayerHp(nextHp);
      setFeedback(nextHp ? 'O Guardião contra-atacou. Reveja as pistas da missão e tente novamente.' : 'Sua energia acabou. Você retornou ao início do confronto.');
      if (!nextHp) { setBossHp(100); setPlayerHp(100); setModal(null); }
      return false;
    }
    const next = Math.max(0, bossHp - 25);
    setBossHp(next); setModal(null);
    if (!next) { localStorage.removeItem(storageKey); setWon(true); setFeedback('Excelente. O Guardião perdeu toda a energia.'); }
    else setFeedback('Ataque de conhecimento certeiro! O Guardião perdeu 25 pontos de energia.');
    return true;
  };

  const isBoss = pathStep >= adventure.challenges.length;
  const progressLabel = isBoss ? `Guardião: ${4 - bossHp / 25}/4 ataques de conhecimento` : `Trilha: ${pathStep}/${adventure.challenges.length} marcos`;

  return <main className="relative min-h-[100dvh] overflow-hidden bg-[#08172d] text-white">
    {background ? <img src={background} alt={`Cenário da aventura ${adventure.title}`} className="absolute inset-0 h-full w-full object-cover" /> : <div aria-hidden style={{ background: backgroundGradient }} className="absolute inset-0 h-full w-full" />}
    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,12,29,.76)_0%,rgba(3,12,29,.04)_38%,rgba(3,12,29,.72)_100%)]" />
    <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between p-3 sm:p-5"><button onClick={onLeave} className="rounded-xl border border-white/30 bg-slate-950/65 px-3 py-2 text-sm font-black backdrop-blur"><ArrowLeft className="mr-1 inline h-4 w-4" />Sair</button><div className="text-center"><p className="text-[10px] font-black tracking-[.28em] text-cyan-200">TERRAVOX</p><h1 className="text-lg font-black sm:text-2xl">{adventure.title}</h1></div><div className="rounded-xl bg-slate-950/65 px-3 py-2 text-right text-xs font-bold backdrop-blur">{profile.name}<br/><span className="text-yellow-300">Nível {profile.level}</span></div></header>

    <aside className="absolute left-3 top-20 z-30 w-40 rounded-2xl border border-white/25 bg-[#071528]/80 p-3 backdrop-blur sm:left-5 sm:top-24 sm:w-48"><p className="flex items-center gap-1 text-xs font-black"><Heart className="h-4 w-4 text-rose-400" /> EXPLORADOR</p><div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-900"><div className={`h-full bg-gradient-to-r transition-all ${playerHp > 35 ? 'from-cyan-400 to-emerald-300' : 'from-orange-400 to-rose-500'}`} style={{ width: `${playerHp}%` }} /></div><p className="mt-1 text-right text-xs font-black">{playerHp}/100</p>{isBoss && <><div className="my-3 border-t border-white/15"/><p className="flex items-center gap-1 text-xs font-black text-rose-100"><Swords className="h-4 w-4" /> GUARDIÃO</p><div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-900"><div className="h-full bg-gradient-to-r from-rose-600 to-orange-400 transition-all" style={{ width: `${bossHp}%` }} /></div><p className="mt-1 text-right text-xs font-black">{bossHp}/100</p></>}</aside>

    <section className="absolute inset-x-0 bottom-0 top-16 z-10 mx-auto max-w-7xl">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"><polyline points="17,85 30,77 55,81 69,69 47,62 22,65 31,50 56,53 76,45 62,36 39,38 79,28" fill="none" stroke="rgba(255,222,104,.95)" strokeWidth=".7" strokeLinejoin="round" strokeDasharray="2.2 1.5" className="drop-shadow-[0_0_7px_rgba(250,204,21,.85)]" /></svg>
      <div className="absolute left-[23%] bottom-[11%] rounded-xl border border-white/25 bg-slate-950/65 px-2 py-1 text-[9px] font-black text-cyan-100 backdrop-blur"><Footprints className="mr-1 inline h-3 w-3 text-yellow-300"/>TRILHA DAS RUÍNAS</div>
      {adventure.challenges.map((challenge, index) => { const stop = routeStops[index + 1]; return <button key={challenge.name} onClick={index === pathStep ? openNextChallenge : undefined} disabled={index !== pathStep} aria-label={index === pathStep ? `Responder desafio ${index + 1}: ${challenge.name}` : `Desafio ${index + 1} bloqueado`} className={`absolute z-30 grid h-9 w-9 place-items-center rounded-full border-2 text-xs font-black shadow-lg transition sm:h-12 sm:w-12 sm:border-4 ${index < pathStep ? 'border-emerald-200 bg-emerald-500 text-white' : index === pathStep ? 'border-yellow-100 bg-yellow-400 text-slate-950 shadow-yellow-400/70 animate-pulse' : 'border-slate-300/50 bg-slate-950/75 text-slate-300'}`} style={{ left: stop.left, bottom: stop.bottom, transform: 'translate(-50%, 50%)' }}>{index < pathStep ? <Check className="h-4 w-4 sm:h-5 sm:w-5" /> : index === pathStep ? <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" /> : <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}{index === pathStep && <span className="absolute -bottom-6 whitespace-nowrap rounded bg-slate-950/75 px-1.5 py-0.5 text-[8px] font-black text-white">{index + 1}/{adventure.challenges.length}</span>}</button>; })}
      <button onClick={isBoss ? openNextChallenge : undefined} disabled={!isBoss} aria-label={isBoss ? `Abrir ${adventure.portal}` : `${adventure.portal} bloqueado`} className={`absolute z-30 grid h-14 w-14 place-items-center rounded-full border-4 text-cyan-50 shadow-[0_0_30px_rgba(34,211,238,.65)] sm:h-16 sm:w-16 ${isBoss ? 'border-yellow-100 bg-cyan-400/45 animate-pulse' : 'border-cyan-100 bg-cyan-400/30'}`} style={{ left: routeStops[adventure.challenges.length + 1].left, bottom: routeStops[adventure.challenges.length + 1].bottom, transform: 'translate(-50%, 50%)' }}><MapPin className="h-7 w-7 sm:h-8 sm:w-8" /><span className="absolute -bottom-6 whitespace-nowrap text-[8px] font-black sm:text-[9px]">{adventure.portal}</span></button>
      <img src="/assets/terravox-explorer.webp" alt="Explorador Terravox" className="pointer-events-none absolute z-20 w-20 drop-shadow-[0_16px_14px_rgba(0,0,0,.7)] transition-all duration-700 sm:w-[14vw] sm:max-w-[130px] sm:min-w-[76px]" style={{ left: routeStops[Math.min(pathStep, adventure.challenges.length)].left, bottom: routeStops[Math.min(pathStep, adventure.challenges.length)].bottom, transform: 'translate(-96%, 16%)' }} />
      {isBoss && bossHp > 0 && <><img src="/assets/forest-guardian.webp" alt="Guardião da floresta" className="absolute right-[5%] top-[19%] z-20 w-[28vw] max-w-[270px] min-w-[130px] drop-shadow-[0_20px_20px_rgba(0,0,0,.65)]" /><button onClick={openNextChallenge} className="absolute right-[10%] top-[45%] z-30 rounded-2xl border-2 border-yellow-100 bg-gradient-to-b from-yellow-300 to-orange-500 px-4 py-3 text-center text-xs font-black text-slate-950 shadow-[0_0_30px_rgba(250,204,21,.8)] active:scale-95"><Swords className="mx-auto mb-1 h-5 w-5"/>USAR CONHECIMENTO<br/>E ATACAR</button></>}
      {isBoss && <div className="absolute right-[8%] top-[16%] z-20 rounded-full border-2 border-rose-200/70 bg-rose-800/40 px-3 py-1 text-[10px] font-black text-rose-50 backdrop-blur">GUARDIÃO DAS RUÍNAS</div>}
    </section>

    <button onClick={() => setShowHelp(true)} aria-label="Como jogar" className="absolute bottom-5 right-5 z-30 grid h-12 w-12 place-items-center rounded-2xl border-2 border-cyan-100/70 bg-[#071528]/90 text-cyan-100 shadow-lg backdrop-blur"><CircleHelp className="h-6 w-6"/></button>
    {showHelp && <div className="absolute inset-0 z-40 grid place-items-end bg-slate-950/35 p-4 backdrop-blur-sm sm:place-items-center"><section className="w-full max-w-sm rounded-3xl border border-cyan-100/40 bg-[#071528]/95 p-5 shadow-2xl"><button onClick={() => setShowHelp(false)} className="float-right rounded-lg p-1"><X className="h-5 w-5"/></button><p className="text-xs font-black tracking-[.18em] text-cyan-200">COMO JOGAR</p><h2 className="mt-2 text-xl font-black">Explore a trilha até {adventure.portal}</h2><p className="mt-3 text-sm leading-relaxed text-slate-200">Cada marco alterna entre investigar uma pista, organizar uma estratégia, escolher um recurso ou responder uma pergunta. Ao chegar ao Guardião, use o conhecimento conquistado para atacar.</p><div className="mt-4 inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-black text-cyan-100">{progressLabel}</div></section></div>}

    {modal === 'path' && <MissionChallengeModal mode={pathStep % 4} eyebrow={adventure.challenges[pathStep].topic} title={adventure.challenges[pathStep].name} prompt={adventure.challenges[pathStep].question.prompt} options={adventure.challenges[pathStep].question.options} onAnswer={answerPath} />}
    {modal === 'boss' && <MissionChallengeModal mode={0} eyebrow="ATAQUE DE CONHECIMENTO" title="Enfrente o Guardião" prompt={adventure.challenges[(100 - bossHp) / 25].question.prompt} options={adventure.challenges[(100 - bossHp) / 25].question.options} onAnswer={answerBoss} />}
    {won && <div className="absolute inset-0 z-50 grid place-items-center bg-[#071528]/70 p-5 backdrop-blur-sm"><section className="w-full max-w-sm rounded-[2rem] border-2 border-emerald-200 bg-gradient-to-br from-emerald-500 to-cyan-700 p-8 text-center shadow-2xl"><Sparkles className="mx-auto h-12 w-12 text-yellow-100"/><h2 className="mt-3 text-3xl font-black">Território restaurado!</h2><p className="my-4 font-medium">Você explorou a trilha, conquistou pistas e usou o conhecimento do território para vencer o Guardião.</p><button onClick={() => onWin(territoryId, 150, 40)} className="w-full rounded-xl bg-yellow-200 py-4 font-black text-slate-950">COLETAR +150 XP</button></section></div>}
  </main>;
}

function MissionChallengeModal({ mode, eyebrow, title, prompt, options, onAnswer }: { mode: number; eyebrow: string; title: string; prompt: string; options: string[]; onAnswer: (option: string, completedInteraction?: boolean) => Promise<boolean> }) {
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [sequence, setSequence] = useState<string[]>([]);
  const choose = async (option: string) => {
    setChecking(true);
    const correct = await onAnswer(option);
    setChecking(false);
    setError(correct ? null : 'Resposta incorreta. Você perdeu energia. Escolha outra alternativa para continuar.');
  };
  const sequenceWords = ['OBSERVAR', 'PENSAR', 'PROTEGER'];
  const addWord = async (word: string) => {
    const next = [...sequence, word];
    setSequence(next);
    if (next.length === sequenceWords.length) {
      const correctOrder = next.every((item, index) => item === sequenceWords[index]);
      let complete = false;
      if (correctOrder) { setChecking(true); complete = await onAnswer('', true); setChecking(false); }
      setError(complete ? null : 'A estratégia não está na ordem certa. Tente novamente.');
      if (!complete) setSequence([]);
    }
  };
  const labels = ['PERGUNTA RÁPIDA', 'INVESTIGUE A PISTA', 'MONTE A ESTRATÉGIA', 'ESCOLHA O RECURSO'];
  const instructions = [prompt, `Observe a pista do território e identifique a descoberta que abre ${title}.`, 'Organize a estratégia do explorador: primeiro observe, depois pense e então proteja.', `Escolha o recurso mais adequado para o explorador resolver este obstáculo.`];
  return <div className="absolute inset-0 z-40 grid place-items-end bg-[#071528]/80 p-3 backdrop-blur-sm sm:place-items-center sm:p-4"><section className="max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-[2rem] border-2 border-yellow-200/70 bg-[linear-gradient(135deg,#174054,#3b1b68)] p-5 text-center shadow-2xl sm:p-9"><Shield className="mx-auto h-8 w-8 text-yellow-200 sm:h-9 sm:w-9"/><p className="mt-2 text-xs font-black tracking-[.2em] text-yellow-200">{eyebrow} · {labels[mode]}</p><h2 className="mt-2 text-xl font-black sm:text-2xl">{title}</h2><p className="my-4 text-base font-bold leading-relaxed sm:my-5 sm:text-lg">{instructions[mode]}</p>{mode === 1 && <div className="mb-4 rounded-2xl border border-cyan-100/40 bg-cyan-300/10 p-4 text-left"><p className="text-xs font-black tracking-[.16em] text-cyan-100">PISTA ENCONTRADA</p><p className="mt-2 text-sm text-slate-100">O cenário guarda uma resposta. Leia as alternativas como um explorador e encontre a descoberta que faz sentido para este lugar.</p></div>}{mode === 2 && <><div className="mb-4 min-h-14 rounded-2xl border border-cyan-100/40 bg-slate-950/35 p-3 text-sm font-black text-cyan-100">{sequence.length ? sequence.map((word, index) => <span key={`${word}-${index}`} className="mr-2 inline-block rounded-lg bg-cyan-400/20 px-2 py-1">{index + 1}. {word}</span>) : 'Toque nas ações na ordem correta'}</div><div className="grid grid-cols-3 gap-2">{['PROTEGER', 'OBSERVAR', 'PENSAR'].map(word => <button key={word} disabled={sequence.includes(word) || checking} onClick={() => addWord(word)} className="rounded-xl border border-white/20 bg-white/10 p-3 text-xs font-black transition hover:border-yellow-200 hover:bg-yellow-200 hover:text-slate-950 disabled:opacity-35">{word}</button>)}</div></>}{checking && <div className="my-4 flex items-center justify-center gap-2 text-sm font-bold text-cyan-100"><Loader2 className="h-4 w-4 animate-spin" /> Verificando resposta...</div>}{error && <div role="alert" className="my-4 rounded-xl border border-rose-200/70 bg-rose-950/65 px-4 py-3 text-left text-sm font-bold text-rose-50">{error}</div>}{mode !== 2 && <div className="grid gap-3 sm:grid-cols-2">{options.map(option => <button key={option} disabled={checking} onClick={() => choose(option)} className="rounded-xl border border-white/20 bg-white/10 p-3 text-left text-sm font-bold transition hover:scale-[1.02] hover:border-yellow-200 hover:bg-yellow-200 hover:text-slate-950 disabled:opacity-50 sm:p-4">{option}</button>)}</div>}</section></div>;
}
