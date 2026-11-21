import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const directory = resolve(process.argv[2] ?? 'offline-preview');
for (const file of ['dist/server.cjs', 'dist/index.html', 'VERSAO.txt', 'INICIAR_TERRAVOX.cmd', 'node_modules/express/package.json']) {
  if (!existsSync(resolve(directory, file))) throw new Error('Missing offline package file: ' + file);
}
const version = readFileSync(resolve(directory, 'VERSAO.txt'), 'utf8');
if (!version.includes('Commit:') || !version.includes('Branch: develop')) {
  throw new Error('Invalid package version manifest');
}
const server = spawn(process.execPath, ['dist/server.cjs'], {
  cwd: directory,
  env: { ...process.env, NODE_ENV: 'production' },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
let logs = '';
server.stdout.on('data', chunk => { logs += chunk; });
server.stderr.on('data', chunk => { logs += chunk; });
try {
  let started = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    if (server.exitCode !== null) throw new Error('Offline server exited: ' + logs);
    try {
      const response = await fetch('http://127.0.0.1:3000/');
      const html = await response.text();
      if (response.ok && html.includes('type="module"')) { started = true; break; }
    } catch {}
    await sleep(250);
  }
  if (!started) throw new Error('Offline server did not serve the SPA: ' + logs);
  for (const path of ['/assets/forest-v2/stylized/tree1.glb', '/assets/forest-v2/stylized/tree2.glb', '/assets/forest-v2/nature/fern_02.glb']) {
    const response = await fetch('http://127.0.0.1:3000' + path);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!response.ok || bytes.length < 1000 || String.fromCharCode(...bytes.slice(0, 4)) !== 'glTF') {
      throw new Error('Bundled offline asset unavailable: ' + path);
    }
  }
  console.log(JSON.stringify({ ok: true, platform: process.platform, version: version.trim(), checks: ['offline server boots', 'built SPA served', 'GLB assets served'] }, null, 2));
} finally {
  server.kill();
}
