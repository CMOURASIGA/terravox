import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const host = 'http://127.0.0.1:3000';
const runtimeEnv = { ...process.env };
delete runtimeEnv.NODE_ENV; // Match Windows `npm start` without a configured NODE_ENV.
const server = spawn(process.execPath, ['dist/server.cjs'], {
  env: runtimeEnv,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
server.stdout.on('data', chunk => { output += chunk.toString(); });
server.stderr.on('data', chunk => { output += chunk.toString(); });
const checks = [];
try {
  let ready = false;
  for (let attempt = 0; attempt < 35; attempt++) {
    if (server.exitCode !== null) throw new Error('Server exited: ' + output);
    try {
      const response = await fetch(host + '/');
      if (response.ok) { ready = true; break; }
    } catch {}
    await delay(300);
  }
  if (!ready) throw new Error('Local server did not start: ' + output);
  const index = await fetch(host + '/');
  const html = await index.text();
  if (!index.ok || !html.includes('type="module"')) throw new Error('Built index.html not served');
  checks.push('built SPA served');
  const assetPaths = [
    'fern_02.glb', 'boulder_01.glb', 'moss_01.glb', 'pine_roots.glb',
  ];
  for (const name of assetPaths) {
    const response = await fetch(host + '/assets/forest-v2/nature/' + name);
    const data = new Uint8Array(await response.arrayBuffer());
    if (!response.ok || data.length < 1000 || String.fromCharCode(...data.slice(0, 4)) !== 'glTF') {
      throw new Error('Invalid or missing served GLB: ' + name + ', status=' + response.status);
    }
    checks.push(name + ' served (' + data.length + ' bytes)');
  }
  const response = await fetch(host + '/api/game/questions?category=Geografia%2CCi%C3%AAncias&amount=10&difficulty=medium');
  if (response.status === 503) {
    // External questions provider is unavailable in this runner.
    // Preserve an explicit unverified result, not a false PASS.
    checks.push('questions and answer APIs: UNVERIFIED (HTTP 503)');
    console.warn('::warning::Questions API returned 503. Gameplay quiz contract NOT VERIFIED in offline build.');
  } else {
    if (!response.ok) throw new Error('Questions API returned ' + response.status);
    const payload = await response.json();
    if (!Array.isArray(payload.questions) || payload.questions.length < 4) throw new Error('Insufficient game questions');
    const first = payload.questions[0];
    if (!first?.id || !Array.isArray(first.options) || first.options.length < 2 || 'correct_answer' in first || 'explanation' in first) {
      throw new Error('Invalid questions contract');
    }
    checks.push('questions API contract');
    const answer = await fetch(host + '/api/game/questions/' + encodeURIComponent(first.id) + '/answer', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answer: first.options[0] }),
    });
    const result = await answer.json();
    if (!answer.ok || typeof result.correct !== 'boolean') throw new Error('Invalid answer contract');
    checks.push('answer API contract');
  }
  console.log(JSON.stringify({ ok: true, host, checks }, null, 2));
} finally {
  server.kill('SIGTERM');
}
