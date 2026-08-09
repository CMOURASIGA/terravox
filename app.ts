import crypto from 'node:crypto';
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { decode } from 'he';

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

async function translateQuestion(ai: GoogleGenAI | null, question: OpenTdbQuestion) {
  const originalQuestion = decodeText(question.question);
  const originalCorrect = decodeText(question.correct_answer);
  const originalIncorrect = question.incorrect_answers.map(decodeText);
  if (!ai) {
    return {
      question_pt_br: originalQuestion,
      correct_answer_pt_br: originalCorrect,
      incorrect_answers_pt_br: originalIncorrect,
      explanation_pt_br: null,
      translation_status: 'pending',
    };
  }
  const prompt = `Traduza para pt-BR esta questão de múltipla escolha para revisão humana em um jogo educativo. Preserve fatos, nomes próprios, datas e a alternativa correta. Gere uma explicação factual curta em 2 a 4 frases. Responda somente JSON: {"question_pt_br":"","correct_answer_pt_br":"","incorrect_answers_pt_br":[""],"explanation_pt_br":""}.\nCategoria: ${decodeText(question.category)}\nPergunta: ${originalQuestion}\nCorreta: ${originalCorrect}\nIncorretas: ${JSON.stringify(originalIncorrect)}`;
  const result = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json' } });
  try {
    const translated = JSON.parse(result.text || '{}');
    if (!translated.question_pt_br || !translated.correct_answer_pt_br || !Array.isArray(translated.incorrect_answers_pt_br)) throw new Error('Resposta incompleta');
    return { ...translated, translation_status: 'translated' };
  } catch {
    return { question_pt_br: originalQuestion, correct_answer_pt_br: originalCorrect, incorrect_answers_pt_br: originalIncorrect, explanation_pt_br: null, translation_status: 'pending' };
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

  let ai: GoogleGenAI | null = null;
  if (process.env.GEMINI_API_KEY) ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  app.get('/api/content-attribution', (_req, res) => {
    res.json({ text: 'Parte das perguntas deste sistema utiliza conteúdo da Open Trivia Database, disponibilizado sob a licença Creative Commons Attribution-ShareAlike 4.0.', sourceUrl: OPENTDB_SOURCE_URL });
  });

  app.get('/api/game/questions', async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Banco de perguntas ainda não configurado.' });
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const difficulty = typeof req.query.difficulty === 'string' ? req.query.difficulty : undefined;
    let query = supabase.from('questions').select('id, category, question_pt_br, correct_answer_pt_br, incorrect_answers_pt_br, explanation_pt_br').eq('is_active', true).eq('review_status', 'approved').eq('translation_status', 'translated').limit(20);
    if (category) query = query.eq('category', category);
    if (difficulty) query = query.eq('difficulty', difficulty);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'Não foi possível obter as perguntas.' });
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
    const amount = Number(req.body.amount ?? 50);
    const { data: run, error: runError } = await supabase.from('question_import_runs').insert({ source: 'opentdb', requested_amount: Math.min(Math.max(amount, 1), 50), category: req.body.category ?? null, difficulty: req.body.difficulty ?? null }).select().single();
    if (runError || !run) return res.status(500).json({ error: 'Não foi possível registrar a importação.' });
    try {
      const fetched = await fetchOpenTdbQuestions({ amount, categoryId: req.body.categoryId, difficulty: req.body.difficulty });
      let imported = 0; let duplicates = 0; let failures = 0;
      for (const item of fetched) {
        try {
          const translated = await translateQuestion(ai, item);
          const hash = contentHash(item);
          const payload = { external_source: 'opentdb', external_id: hash, category: CATEGORY_MAP[decodeText(item.category)] ?? decodeText(item.category), subcategory: decodeText(item.category), question_original: decodeText(item.question), question_pt_br: translated.question_pt_br, correct_answer_original: decodeText(item.correct_answer), correct_answer_pt_br: translated.correct_answer_pt_br, incorrect_answers_original: item.incorrect_answers.map(decodeText), incorrect_answers_pt_br: translated.incorrect_answers_pt_br, difficulty: item.difficulty, question_type: item.type, explanation_pt_br: translated.explanation_pt_br, tags: [decodeText(item.category)], source_url: OPENTDB_SOURCE_URL, source_license: OPENTDB_LICENSE, translation_status: translated.translation_status, review_status: 'pending', is_active: false, content_hash: hash };
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
      res.json({ runId: run.id, imported, duplicates, failures, published: 0 });
    } catch (error) {
      await supabase.from('question_import_runs').update({ status: 'failed', error_message: error instanceof Error ? error.message : 'Erro desconhecido', finished_at: new Date().toISOString() }).eq('id', run.id);
      res.status(502).json({ error: 'A importação da OpenTDB falhou.' });
    }
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
      if (!ai) return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
      const { territory, theme, difficulty, count = 3 } = req.body;
      const prompt = `Gere ${count} perguntas de múltipla escolha para um jogo estilo RPG educativo, focadas no território "${territory}" e tema "${theme}". A dificuldade deve ser ${difficulty}. Retorne somente JSON no formato [{"id":"q1","prompt":"","options":[""],"correct_answer":"","explanation":""}].`;
      const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json' } });
      res.json({ questions: JSON.parse(response.text || '[]') });
    } catch (error) {
      console.error('Error generating questions:', error);
      res.status(500).json({ error: 'Failed to generate questions' });
    }
  });

  return app;
}
