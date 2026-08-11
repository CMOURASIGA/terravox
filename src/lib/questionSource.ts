import { Question } from '../types';

/**
 * Mapa território → categoria(s) do banco interno de perguntas (Supabase
 * `questions`, populado via importação da OpenTDB + tradução — ver
 * app.ts). Os valores precisam bater exatamente com as categorias em
 * português já gravadas na coluna `category` (CATEGORY_MAP em app.ts):
 * 'Conhecimentos Gerais', 'Ciências', 'Tecnologia', 'Geografia', 'História',
 * 'Esportes', 'Artes', 'Cinema', 'Música', 'Literatura', 'Jogos', 'Animais'.
 */
const TERRITORY_CATEGORIES: Record<string, string[]> = {
  // Nível 1
  brasil: ['Geografia', 'Ciências'],
  mexico: ['Geografia', 'História'],
  egito: ['História', 'Geografia'],
  japao: ['Geografia', 'Artes'],
  // Nível 2
  andes: ['Geografia', 'Ciências'],
  oceano: ['Ciências', 'Animais'],
  savana: ['Animais', 'Ciências'],
  espaco: ['Ciências', 'Tecnologia'],
  // Nível 3
  india: ['História', 'Artes'],
  china: ['História', 'Geografia'],
  grecia: ['História', 'Artes'],
  australia: ['Animais', 'Geografia'],
  // Nível 4
  canada: ['Geografia', 'Animais'],
  russia: ['Geografia', 'História'],
  italia: ['Artes', 'História'],
  marrocos: ['Geografia', 'Artes'],
  // Nível 5
  peru: ['História', 'Geografia'],
  quenia: ['Animais', 'Geografia'],
  noruega: ['Geografia', 'Ciências'],
  tailandia: ['Artes', 'Geografia'],
  // Nível 6
  eua: ['Tecnologia', 'Geografia'],
  franca: ['Artes', 'História'],
  novazelandia: ['Animais', 'Geografia'],
  indonesia: ['Animais', 'Geografia'],
  // Nível 7
  galapagos: ['Animais', 'Ciências'],
  antartida: ['Ciências', 'Geografia'],
  islandia: ['Geografia', 'Ciências'],
  turquia: ['História', 'Artes'],
  // Nível 8
  coreia: ['Tecnologia', 'Artes'],
  vietna: ['Geografia', 'História'],
  escocia: ['História', 'Geografia'],
  chile: ['Geografia', 'Ciências'],
  // Nível 9
  suica: ['Geografia', 'Esportes'],
  holanda: ['Artes', 'Geografia'],
  portugal: ['História', 'Geografia'],
  argentina: ['Esportes', 'Geografia'],
  // Nível 10 (final)
  alasca: ['Animais', 'Geografia'],
  havai: ['Geografia', 'Animais'],
  estacaolunar: ['Ciências', 'Tecnologia'],
  templodosaber: ['Conhecimentos Gerais', 'Jogos'],
};
const DEFAULT_CATEGORIES = ['Conhecimentos Gerais'];

export function categoriesForTerritory(territoryId: string): string[] {
  return TERRITORY_CATEGORIES[territoryId] ?? DEFAULT_CATEGORIES;
}

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

// As perguntas do banco nunca trazem a resposta correta para o cliente (ver
// app.ts / supabase/migrations) — só o id, prompt e alternativas. A checagem
// acontece em /api/game/questions/:id/answer. Perguntas geradas por IA já
// chegam com correct_answer/explanation embutidos.
export type SourcedQuestion = Omit<Question, 'correct_answer' | 'explanation'> &
  Partial<Pick<Question, 'correct_answer' | 'explanation'>> & { source: 'bank' | 'ai' };

type BankQuestion = { id: string; category: string; prompt: string; options: string[] };

function difficultyLabel(difficulty: number): 'easy' | 'medium' | 'hard' {
  if (difficulty <= 2) return 'easy';
  if (difficulty >= 4) return 'hard';
  return 'medium';
}

async function fetchBankQuestions(categories: string[], amount: number, difficulty: number): Promise<BankQuestion[]> {
  try {
    const params = new URLSearchParams({ category: categories.join(','), amount: String(amount), difficulty: difficultyLabel(difficulty) });
    const res = await fetch(`/api/game/questions?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.questions) ? data.questions : [];
  } catch (error) {
    console.error('Falha ao buscar perguntas do banco Terravox:', error);
    return [];
  }
}

async function fetchAIQuestions(territoryId: string, theme: string, difficulty: number, count: number): Promise<Question[]> {
  if (count <= 0) return [];
  try {
    const res = await fetch('/api/generate-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ territory: territoryId, theme, difficulty, count }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.questions) ? data.questions : [];
  } catch (error) {
    console.error('Falha ao gerar perguntas por IA:', error);
    return [];
  }
}

/**
 * Fonte principal: banco de perguntas aprovadas do Terravox, filtrado pela
 * categoria do território (ex.: México → Geografia/História). Quando o
 * banco não tem perguntas aprovadas suficientes para completar `count`, o
 * restante é preenchido com geração por IA (fallback) — nunca falha a tela
 * por falta de conteúdo, mas prioriza sempre o conteúdo já revisado.
 */
export async function fetchTerritoryQuestions(params: {
  territoryId: string;
  theme: string;
  difficulty: number;
  count: number;
}): Promise<SourcedQuestion[]> {
  const { territoryId, theme, difficulty, count } = params;
  const categories = categoriesForTerritory(territoryId);
  const bank = await fetchBankQuestions(categories, count, difficulty);
  const bankQuestions: SourcedQuestion[] = shuffle(bank)
    .slice(0, count)
    .map((question) => ({ id: question.id, prompt: question.prompt, options: question.options, source: 'bank' }));

  const missing = count - bankQuestions.length;
  const aiQuestions: SourcedQuestion[] = missing > 0
    ? (await fetchAIQuestions(territoryId, theme, difficulty, missing)).map((question) => ({ ...question, source: 'ai' as const }))
    : [];

  return [...bankQuestions, ...aiQuestions];
}

/**
 * Verifica a resposta escolhida para uma pergunta já carregada. Perguntas
 * do banco são checadas no servidor (a resposta certa nunca chega ao
 * cliente); perguntas de IA já trazem a resposta e são checadas localmente.
 */
export async function checkAnswer(question: SourcedQuestion, selected: string): Promise<{ correct: boolean; explanation: string }> {
  if (question.source === 'bank') {
    try {
      const res = await fetch(`/api/game/questions/${encodeURIComponent(question.id)}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: selected }),
      });
      const data = await res.json();
      if (!res.ok) return { correct: false, explanation: data?.error || '' };
      return { correct: Boolean(data.correct), explanation: data.explanation || '' };
    } catch (error) {
      console.error('Falha ao validar resposta no banco Terravox:', error);
      return { correct: false, explanation: '' };
    }
  }
  return { correct: selected === question.correct_answer, explanation: question.explanation || '' };
}
