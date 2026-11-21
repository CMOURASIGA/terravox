import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve('public/assets/forest-v2');
const required = {
  'explorer.glb': ['idle', 'walk', 'run', 'interact'],
  'environment.glb': [],
  'portal.glb': [],
  'spirit.glb': ['idle'],
};
let failures = 0;
for (const [filename, clips] of Object.entries(required)) {
  const path = resolve(root, filename);
  if (!existsSync(path)) {
    console.error('MISSING', filename);
    failures++;
    continue;
  }
  const data = readFileSync(path);
  if (data.length < 20 || data.toString('utf8', 0, 4) !== 'glTF' || data.readUInt32LE(4) !== 2 || data.readUInt32LE(8) !== data.length || data.readUInt32LE(16) !== 0x4e4f534a) {
    console.error('INVALID_GLTF_2_GLB', filename);
    failures++;
    continue;
  }
  const jsonLength = data.readUInt32LE(12);
  if (jsonLength < 2 || jsonLength + 20 > data.length) {
    console.error('INVALID_JSON_CHUNK', filename);
    failures++;
    continue;
  }
  let json;
  try { json = JSON.parse(data.toString('utf8', 20, 20 + jsonLength)); }
  catch { console.error('INVALID_GLTF_JSON', filename); failures++; continue; }
  if (json.asset?.version !== '2.0') { console.error('INVALID_GLTF_VERSION', filename); failures++; continue; }
  const names = new Set((json.animations ?? []).map(a => a.name));
  for (const clip of clips) {
    if (!names.has(clip)) { console.error('MISSING_ANIMATION', filename, clip); failures++; }
  }
  console.log('CHECKED', filename, data.length, 'bytes', 'animations:', [...names].join(', ') || '(none)');
}
if (failures) { console.error('FOREST_V2_GATE_FAILED', failures); process.exitCode = 1; }
else console.log('FOREST_V2_ASSETS_PASS');
