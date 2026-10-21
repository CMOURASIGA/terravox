import { spawnSync } from 'node:child_process';

const previewUrl = process.env.GAME_PREVIEW_URL;

if (!previewUrl) {
  throw new Error('GAME_PREVIEW_URL is required.');
}

function vercelCurl(path, args = []) {
  const result = spawnSync(
    'npx',
    ['--yes', 'vercel@latest', 'curl', `${previewUrl}${path}`, '--fail-with-body', ...args],
    { encoding: 'utf8', env: process.env },
  );

  if (result.status !== 0) {
    throw new Error(`Preview request failed for ${path}: ${result.stderr.trim() || `exit ${result.status}`}`);
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`Preview returned invalid JSON for ${path}.`);
  }
}

const territories = [
  { id: 'brasil', categories: 'Geografia,Ciências' },
  { id: 'mexico', categories: 'Geografia,História' },
];

const evidence = [];

for (const territory of territories) {
  const params = new URLSearchParams({
    category: territory.categories,
    amount: '10',
    difficulty: 'medium',
  });
  const payload = vercelCurl(`/api/game/questions?${params.toString()}`);
  const questions = Array.isArray(payload.questions) ? payload.questions : [];

  if (questions.length < 4) {
    throw new Error(`${territory.id} returned ${questions.length} question(s); at least 4 are required.`);
  }

  const first = questions[0];
  if (!first?.id || !Array.isArray(first.options) || first.options.length < 2) {
    throw new Error(`${territory.id} returned an invalid question contract.`);
  }
  if ('correct_answer' in first || 'explanation' in first) {
    throw new Error(`${territory.id} exposed protected answer data.`);
  }

  const answer = vercelCurl(
    `/api/game/questions/${encodeURIComponent(first.id)}/answer`,
    [
      '-X', 'POST',
      '-H', 'Content-Type: application/json',
      '--data', JSON.stringify({ answer: first.options[0] }),
    ],
  );

  if (typeof answer.correct !== 'boolean') {
    throw new Error(`${territory.id} returned an invalid answer contract.`);
  }

  evidence.push({
    territory: territory.id,
    questionCount: questions.length,
    answerContract: 'valid',
    protectedAnswerDataExposed: false,
  });
}

console.log(JSON.stringify({ ok: true, evidence }, null, 2));
