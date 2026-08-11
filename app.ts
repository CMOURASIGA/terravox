import crypto from 'node:crypto';
import express from 'express';
import { generateOpenAIText, parseJsonResponse } from './openai.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
// Named import ({ decode } from 'he') fails at runtime under Vercel's Node
// ESM function runtime with "SyntaxError: The requested module 'he' does
// not provide an export named 'decode'" — he's CJS build assigns its whole
// exports object in one shot (module.exports = { encode, decode, ... }),
// which Node's static named-export detection for CJS-from-ESM interop
// can't see through. The default import always works (Node's interop
// unconditionally exposes the whole module.exports as the default),
// so destructure at runtime instead of at the import binding.
import he from 'he';
const { decode } = he;

const OPENTDB_API = 'https://opentdb.com/api.php';
const OPENTDB_TOKEN_API = 'https://opentdb.com/api_token.php';
const OPENTDB_LICENSE = 'CC BY-SA 4.0';
const OPENTDB_SOURCE_URL = 'https://opentdb.com/api_config.php';
const CATEGORY_MAP: Record<string, string> = {
  'General Knowledge': 'Conhecimentos Gerais',
  'Science & Nature': 'Ciências',
  'Science: Computers': 'Tecnologia',
  Geography: 'Geografia',
  History: 'História',
  Sports: 'Esportes',
  Art: 'Artes',
  'Entertainment: Film': 'Cinema',
  'Entertainment: Music': 'Música',
  'Entertainment: Books': 'Literatura',
  'Entertainment: Video Games': 'Jogos',
  'Animals': 'Animais',
};

// Sentido inverso do CATEGORY_MAP acima: nome em português (como gravado na
// coluna `category`) → id numérico da categoria na OpenTDB. Necessário pro
// reabastecimento autônomo (ensureQuestionStock) saber o que pedir pra
// OpenTDB a partir de uma categoria que já existe (ou não) no banco.
const OPENTDB_CATEGORY_IDS: Record<string, number> = {
  'Conhecimentos Gerais': 9,
  Geografia: 22,
  História: 23,
  Ciências: 17,
  Tecnologia: 18,
  Animais: 27,
  Esportes: 21,
  Artes: 25,
  Cinema: 11,
  Música: 12,
  Literatura: 10,
  Jogos: 15,
};

// Quantas perguntas prontas pro jogo (approved+translated+active) uma
// categoria precisa ter antes de ser considerada "saudável" o bastante pra
// não precisar de reabastecimento.
const MIN_CATEGORY_STOCK = 12;
const TOP_UP_AMOUNT = 15;

type OpenTdbQuestion = {
  category: string;
  type: 'multiple' | 'boolean';
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
};

type StoredQuestion = {
  id: string;
  category: string;
  question_pt_br: string;
  correct_answer_pt_br: string;
  incorrect_answers_pt_br: string[];
  explanation_pt_br: string | null;
};

let openTdbToken: string | null = null;
let lastOpenTdbCallAt = 0;

function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false } }) : null;
}

function fisherYates<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = crypto.randomInt(index + 1);
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function decodeText(value: string): string {
  return decode(value).replace(/\s+/g, ' ').trim();
}

function contentHash(question: OpenTdbQuestion): string {
  return crypto
    .createHash('sha256')
    .update(`${decodeText(question.category)}|${decodeText(question.question)}|${decodeText(question.correct_answer)}`)
    .digest('hex');
}

function isAdminRequest(req: express.Request): boolean {
  const secret = process.env.ADMIN_API_SECRET;
  return Boolean(secret && req.header('x-admin-secret') === secret);
}

async function waitForOpenTdbRateLimit(): Promise<void> {
  const remaining = 5000 - (Date.now() - lastOpenTdbCallAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  lastOpenTdbCallAt = Date.now();
}

async function requestOpenTdbToken(): Promise<string> {
  await waitForOpenTdbRateLimit();
  const response = await fetch(`${OPENTDB_TOKEN_API}?command=request`);
  const body = await response.json() as { response_code: number; token?: string };
  if (!response.ok || body.response_code !== 0 || !body.token) throw new Error('Não foi possível solicitar um token da OpenTDB.');
  openTdbToken = body.token;
  return body.token;
}

async function resetOpenTdbToken(token: string): Promise<void> {
  await waitForOpenTdbRateLimit();
  const response = await fetch(`${OPENTDB_TOKEN_API}?command=reset&token=${encodeURIComponent(token)}`);
  const body = await response.json() as { response_code: number };
  if (!response.ok || body.response_code !== 0) throw new Error('Não foi possível reiniciar o token da OpenTDB.');
}

async function fetchOpenTdbQuestions(params: { amount: number; categoryId?: number; difficulty?: string }): Promise<OpenTdbQuestion[]> {
  const token = openTdbToken ?? await requestOpenTdbToken();
  const query = new URLSearchParams({ amount: String(Math.min(Math.max(params.amount, 1), 50)), type: 'multiple', token });
  if (params.categoryId) query.set('category', String(params.categoryId));
  if (params.difficulty) query.set('difficulty', params.difficulty);
  await waitForOpenTdbRateLimit();
  let response = await fetch(`${OPENTDB_API}?${query.toString()}`);
  let body = await response.json() as { response_code: number; results?: OpenTdbQuestion[] };
  if (body.response_code === 4) {
    await resetOpenTdbToken(token);
    await waitForOpenTdbRateLimit();
    response = await fetch(`${OPENTDB_API}?${query.toString()}`);
    body = await response.json() as { response_code: number; results?: OpenTdbQuestion[] };
  }
  if (!response.ok || body.response_code !== 0 || !body.results) throw new Error(`A OpenTDB retornou o código ${body.response_code}.`);
  return body.results;
}

async function translateQuestion(question: OpenTdbQuestion) {
  const originalQuestion = decodeText(question.question);
  const originalCorrect = decodeText(question.correct_answer);
  const originalIncorrect = question.incorrect_answers.map(decodeText);
  if (!process.env.OPENAI_API_KEY) {
    return {
      question_pt_br: originalQuestion,
      correct_answer_pt_br: originalCorrect,
      incorrect_answers_pt_br: originalIncorrect,
      explanation_pt_br: null,
      translation_status: 'pending',
    };
  }
  const instructions = 'Você traduz perguntas de trivia para pt-BR, para revisão humana em um jogo educativo. Preserve fatos, nomes próprios, datas e a alternativa correta. Gere uma explicação factual curta em 2 a 4 frases. Responda somente com JSON válido, sem comentários nem markdown.';
  const input = `Categoria: ${decodeText(question.category)}\nPergunta: ${originalQuestion}\nCorreta: ${originalCorrect}\nIncorretas: ${JSON.stringify(originalIncorrect)}\n\nFormato exato da resposta: {"question_pt_br":"","correct_answer_pt_br":"","incorrect_answers_pt_br":[""],"explanation_pt_br":""}`;
  const text = await generateOpenAIText(instructions, input);
  try {
    const translated = parseJsonResponse(text) as any;
    if (!translated.question_pt_br || !translated.correct_answer_pt_br || !Array.isArray(translated.incorrect_answers_pt_br)) throw new Error('Resposta incompleta');
    return { ...translated, translation_status: 'translated' };
  } catch {
    return { question_pt_br: originalQuestion, correct_answer_pt_br: originalCorrect, incorrect_answers_pt_br: originalIncorrect, explanation_pt_br: null, translation_status: 'pending' };
  }
}

/**
 * Roda uma importação da OpenTDB (busca + tradução + gravação), a mesma
 * lógica usada tanto pelo endpoint manual do admin quanto pelo
 * reabastecimento automático. Cada chamada é registrada em
 * `question_import_runs`/`question_import_errors` pra auditoria, não
 * importa quem disparou.
 *
 * `autoApprove` decide se as perguntas entram já publicadas (review_status
 * "approved", is_active true) ou como rascunho pendente de revisão humana
 * (comportamento de sempre do botão manual do admin). Só aprova de
 * verdade quando a tradução realmente aconteceu — senão o jogador veria a
 * pergunta em inglês como se já tivesse passado por revisão.
 */
async function runOpenTdbImport(supabase: SupabaseClient, params: { amount: number; categoryId?: number; difficulty?: string; category?: string | null; autoApprove: boolean }) {
  const { data: run, error: runError } = await supabase.from('question_import_runs').insert({ source: 'opentdb', requested_amount: Math.min(Math.max(params.amount, 1), 50), category: params.category ?? null, difficulty: params.difficulty ?? null }).select().single();
  if (runError || !run) throw new Error('Não foi possível registrar a importação.');

  let imported = 0; let duplicates = 0; let failures = 0;
  try {
    const fetched = await fetchOpenTdbQuestions({ amount: params.amount, categoryId: params.categoryId, difficulty: params.difficulty });
    for (const item of fetched) {
      try {
        const translated = await translateQuestion(item);
        const hash = contentHash(item);
        const autoApproved = params.autoApprove && translated.translation_status === 'translated';
        const payload = { external_source: 'opentdb', external_id: hash, category: CATEGORY_MAP[decodeText(item.category)] ?? decodeText(item.category), subcategory: decodeText(item.category), question_original: decodeText(item.question), question_pt_br: translated.question_pt_br, correct_answer_original: decodeText(item.correct_answer), correct_answer_pt_br: translated.correct_answer_pt_br, incorrect_answers_original: item.incorrect_answers.map(decodeText), incorrect_answers_pt_br: translated.incorrect_answers_pt_br, difficulty: item.difficulty, question_type: item.type, explanation_pt_br: translated.explanation_pt_br, tags: [decodeText(item.category)], source_url: OPENTDB_SOURCE_URL, source_license: OPENTDB_LICENSE, translation_status: translated.translation_status, review_status: autoApproved ? 'approved' : 'pending', is_active: autoApproved, reviewed_at: autoApproved ? new Date().toISOString() : null, content_hash: hash };
        const { error } = await supabase.from('questions').insert(payload);
        if (error?.code === '23505') {
          duplicates += 1;
          continue;
        }
        if (error) throw error;
        imported += 1;
      } catch (error) {
        failures += 1;
        await supabase.from('question_import_errors').insert({ import_run_id: run.id, external_payload: item, error_message: error instanceof Error ? error.message : 'Erro desconhecido' });
      }
    }
    await supabase.from('question_import_runs').update({ imported_count: imported, duplicate_count: duplicates, failed_count: failures, status: failures ? 'completed_with_errors' : 'completed', finished_at: new Date().toISOString() }).eq('id', run.id);
    return { runId: run.id as string, imported, duplicates, failures };
  } catch (error) {
    await supabase.from('question_import_runs').update({ status: 'failed', error_message: error instanceof Error ? error.message : 'Erro desconhecido', finished_at: new Date().toISOString() }).eq('id', run.id);
    throw error;
  }
}

async function countGameReadyQuestions(supabase: SupabaseClient, category: string): Promise<number> {
  const { count, error } = await supabase.from('questions').select('id', { count: 'exact', head: true }).eq('category', category).eq('is_active', true).eq('review_status', 'approved').eq('translation_status', 'translated');
  if (error) {
    console.error(`[ensureQuestionStock] Falha ao contar estoque de "${category}":`, error.message);
    // Erro de leitura não pode virar loop de importação repetida: assume
    // que já tem estoque suficiente e desiste dessa categoria nesta rodada.
    return MIN_CATEGORY_STOCK;
  }
  return count ?? 0;
}

/**
 * Reabastecimento autônomo do banco de perguntas: para cada categoria
 * abaixo do mínimo saudável, importa mais da OpenTDB (traduzidas e já
 * aprovadas automaticamente). É isso que torna o catálogo dinâmico — nem
 * o cron diário (ver /api/cron/refill-questions) nem o jogo em si (ver
 * /api/game/questions) precisam de um humano clicando em "Importar" pra
 * territórios novos terem conteúdo.
 */
async function ensureQuestionStock(supabase: SupabaseClient, categories: string[]): Promise<void> {
  for (const category of categories) {
    const categoryId = OPENTDB_CATEGORY_IDS[category];
    if (!categoryId) continue; // categoria sem equivalente conhecido na OpenTDB — nada a importar
    const current = await countGameReadyQuestions(supabase, category);
    if (current >= MIN_CATEGORY_STOCK) continue;
    try {
      const result = await runOpenTdbImport(supabase, { amount: TOP_UP_AMOUNT, categoryId, category, autoApprove: true });
      console.log(`[ensureQuestionStock] "${category}" reabastecida: +${result.imported} (${result.duplicates} duplicada(s), ${result.failures} falha(s)).`);
    } catch (error) {
      console.error(`[ensureQuestionStock] Falha ao reabastecer "${category}":`, error instanceof Error ? error.message : error);
    }
  }
}

/**
 * Builds the Express app with every /api/* route registered, but does not
 * bind it to a port. Shared by two entry points:
 * - server.ts: local dev / `node dist/server.cjs`, which also wires the
 *   Vite dev middleware (or the built static files) and calls app.listen.
 * - api/index.ts: the single Vercel Serverless Function all /api/* requests
 *   are rewritten to (see vercel.json). An Express app instance is itself a
 *   valid (req, res) handler, so it can be exported and invoked directly by
 *   Vercel's Node runtime without ever calling .listen() — this is the same
 *   pattern used by Vercel's own official Express example.
 */
export async function buildApp(): Promise<express.Express> {
  const app = express();
  app.use(express.json());

  app.get('/api/content-attribution', (_req, res) => {
    res.json({ text: 'Parte das perguntas deste sistema utiliza conteúdo da Open Trivia Database, disponibilizado sob a licença Creative Commons Attribution-ShareAlike 4.0.', sourceUrl: OPENTDB_SOURCE_URL });
  });

  app.get('/api/game/questions', async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Banco de perguntas ainda não configurado.' });
    // `category` aceita uma ou mais categorias separadas por vírgula (ex.:
    // "Geografia,História") — os territórios do jogo mapeiam para mais de
    // uma categoria da OpenTDB, e as telas de Batalha/Expedição precisam de
    // um único round trip para cobrir todas elas.
    const categoryParam = typeof req.query.category === 'string' ? req.query.category : undefined;
    const categories = categoryParam ? categoryParam.split(',').map((value) => value.trim()).filter(Boolean) : undefined;
    const difficulty = typeof req.query.difficulty === 'string' ? req.query.difficulty : undefined;
    const amount = Math.min(Math.max(Number(req.query.amount) || 20, 1), 50);
    let query = supabase.from('questions').select('id, category, question_pt_br, correct_answer_pt_br, incorrect_answers_pt_br, explanation_pt_br').eq('is_active', true).eq('review_status', 'approved').eq('translation_status', 'translated').limit(amount);
    if (categories?.length) query = query.in('category', categories);
    if (difficulty) query = query.eq('difficulty', difficulty);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'Não foi possível obter as perguntas.' });

    // Estoque raso pra alguma das categorias pedidas: dispara o
    // reabastecimento em segundo plano (sem `await`, sem atrasar esta
    // resposta — o cliente já tem fallback de IA pra agora mesmo) para que
    // a PRÓXIMA visita a este território já encontre mais perguntas
    // prontas no banco. O cron diário (/api/cron/refill-questions) é o
    // mecanismo principal; isto aqui é só reforço oportunista.
    if (categories?.length && (data ?? []).length < amount) {
      ensureQuestionStock(supabase, categories).catch((error) => {
        console.error('[game/questions] Reabastecimento em segundo plano falhou:', error instanceof Error ? error.message : error);
      });
    }

    const questions = fisherYates((data ?? []) as StoredQuestion[]).map((question) => ({ id: question.id, category: question.category, prompt: question.question_pt_br, options: fisherYates([question.correct_answer_pt_br, ...question.incorrect_answers_pt_br]) }));
    res.json({ questions });
  });

  app.post('/api/game/questions/:id/answer', async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Banco de perguntas ainda não configurado.' });
    const { data, error } = await supabase.from('questions').select('correct_answer_pt_br, explanation_pt_br').eq('id', req.params.id).eq('is_active', true).single();
    if (error || !data) return res.status(404).json({ error: 'Pergunta indisponível.' });
    res.json({ correct: req.body.answer === data.correct_answer_pt_br, explanation: data.explanation_pt_br });
  });

  app.post('/api/admin/questions/import/opentdb', async (req, res) => {
    if (!isAdminRequest(req)) return res.status(401).json({ error: 'Acesso administrativo necessário.' });
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.' });
    try {
      // Disparo manual continua exigindo revisão humana (autoApprove:
      // false), igual sempre funcionou — o caminho automático é só o
      // reabastecimento (ensureQuestionStock), não este endpoint.
      const result = await runOpenTdbImport(supabase, { amount: Number(req.body.amount ?? 50), categoryId: req.body.categoryId, difficulty: req.body.difficulty, category: req.body.category, autoApprove: false });
      res.json({ ...result, published: 0 });
    } catch (error) {
      console.error('Manual OpenTDB import error:', error instanceof Error ? error.message : error);
      res.status(502).json({ error: 'A importação da OpenTDB falhou.' });
    }
  });

  app.get('/api/cron/refill-questions', async (req, res) => {
    // Vercel assina automaticamente as chamadas de cron com
    // `Authorization: Bearer <CRON_SECRET>` quando essa env var está
    // configurada — mesmo padrão do cron do EduQuest (cron-content-import).
    const secret = process.env.CRON_SECRET;
    if (!secret || req.header('authorization') !== `Bearer ${secret}`) return res.status(401).json({ error: 'Acesso restrito ao cron da Vercel.' });
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Banco de perguntas ainda não configurado.' });
    await ensureQuestionStock(supabase, Object.keys(OPENTDB_CATEGORY_IDS));
    res.status(200).json({ checked: Object.keys(OPENTDB_CATEGORY_IDS) });
  });

  app.get('/api/admin/questions', async (req, res) => {
    if (!isAdminRequest(req)) return res.status(401).json({ error: 'Acesso administrativo necessário.' });
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Banco de perguntas ainda não configurado.' });
    let query = supabase.from('questions').select('*').order('imported_at', { ascending: false }).limit(100);
    for (const field of ['category', 'difficulty', 'translation_status', 'review_status', 'external_source'] as const) if (typeof req.query[field] === 'string') query = query.eq(field, req.query[field]);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'Não foi possível listar as perguntas.' });
    res.json({ questions: data });
  });

  app.patch('/api/admin/questions/:id', async (req, res) => {
    if (!isAdminRequest(req)) return res.status(401).json({ error: 'Acesso administrativo necessário.' });
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Banco de perguntas ainda não configurado.' });
    const allowed = ['category', 'question_pt_br', 'correct_answer_pt_br', 'incorrect_answers_pt_br', 'explanation_pt_br', 'difficulty', 'translation_status', 'review_status', 'is_active'];
    const update = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    if (update.is_active === true && (update.review_status !== 'approved' || update.translation_status !== 'translated')) return res.status(422).json({ error: 'Uma pergunta só pode ser publicada após tradução e aprovação.' });
    if (update.review_status === 'approved') update.reviewed_at = new Date().toISOString();
    const { data, error } = await supabase.from('questions').update(update).eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: 'Não foi possível atualizar a pergunta.' });
    res.json({ question: data });
  });

  app.post('/api/generate-questions', async (req, res) => {
    try {
      if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
      const { territory, theme, difficulty, count = 3 } = req.body;
      const instructions = 'Você gera perguntas de múltipla escolha para um jogo estilo RPG educativo. Responda somente com um array JSON válido, sem comentários nem markdown.';
      const input = `Gere ${count} perguntas de múltipla escolha focadas no território "${territory}" e tema "${theme}". A dificuldade deve ser ${difficulty}. Formato de cada item: {"id":"q1","prompt":"","options":[""],"correct_answer":"","explanation":""}. Responda com um array JSON contendo esses objetos, e nada além disso.`;
      const text = await generateOpenAIText(instructions, input);
      res.json({ questions: parseJsonResponse(text) });
    } catch (error) {
      console.error('Error generating questions:', error);
      res.status(500).json({ error: 'Failed to generate questions' });
    }
  });

  return app;
}
