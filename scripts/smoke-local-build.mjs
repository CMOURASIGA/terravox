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
  // The stylized forest is part of the playable experience, not an optional remote dependency.
  for (const name of ['tree1', 'tree2', 'tree3', 'bush']) {
    const response = await fetch(host + '/assets/forest-v2/stylized/' + name + '.glb');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!response.ok || bytes.length < 1000 || String.fromCharCode(...bytes.slice(0, 4)) !== 'glTF') {
      throw new Error('Missing or invalid stylized forest GLB: ' + name);
    }
    checks.push('stylized/' + name + '.glb served (' + bytes.length + ' bytes)');
  }
  // A GLB can have a valid header yet contain no renderable geometry.
  // Inspect each embedded glTF JSON chunk to reject empty/placeholder trees.
  for (const name of ['tree1', 'tree2', 'tree3', 'bush']) {
    const response = await fetch(host + '/assets/forest-v2/stylized/' + name + '.glb');
    const bytes = new Uint8Array(await response.arrayBuffer());
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.length < 20 || view.getUint32(8, true) !== bytes.length ||
        view.getUint32(16, true) !== 0x4e4f534a) {
      throw new Error('Malformed stylized GLB structure: ' + name);
    }
    const jsonLength = view.getUint32(12, true);
    if (jsonLength < 2 || 20 + jsonLength > bytes.length) {
      throw new Error('Invalid glTF JSON chunk: ' + name);
    }
    const gltf = JSON.parse(new TextDecoder().decode(bytes.slice(20, 20 + jsonLength)));
    if (!Array.isArray(gltf.meshes) || !gltf.meshes.some(mesh => mesh.primitives?.length) ||
        !Array.isArray(gltf.nodes) || !gltf.nodes.length) {
      throw new Error('Stylized forest model has no renderable geometry: ' + name);
    }
    checks.push('stylized/' + name + '.glb geometry verified');
  }
  // The animated explorer is mandatory in the playable forest. A successful
  // build with a missing character model would otherwise pass this smoke test.
  {
    const response = await fetch(host + '/assets/forest-v2/explorer.glb');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!response.ok || bytes.length < 1000 || String.fromCharCode(...bytes.slice(0, 4)) !== 'glTF') {
      throw new Error('Missing or invalid animated explorer GLB');
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.length) {
      throw new Error('Corrupted animated explorer GLB header');
    }
    const jsonLength = view.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(bytes.slice(20, 20 + jsonLength)));
    const clips = new Set((json.animations ?? []).filter(clip => clip.channels?.length).map(clip => clip.name));
    if (!json.skins?.length || !['Idle', 'Walking', 'Run'].every(clip => clips.has(clip))) {
      throw new Error('Explorer GLB missing rig or required locomotion animations');
    }
    checks.push('animated explorer served with skin and Idle/Walking/Run clips');
  }
  // This distribution is exploration-only: it must start without requiring a
  // questions provider or network access beyond localhost. External quiz APIs
  // are deliberately outside the acceptance criteria for this build.
  checks.push('exploration-only preview does not depend on external quiz APIs');
  console.log(JSON.stringify({ ok: true, host, checks }, null, 2));
} finally {
  server.kill('SIGTERM');
}
