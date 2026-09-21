# P9 - PERFORMANCE & DEVICE QUALITY

Modelo: GPT-6 Astra
Esforço: MEDIUM

## Objetivo
Garantir qualidade aceitável em desktop, tablet e smartphones intermediários.

## Escopo
- profiling;
- draw calls;
- texture memory;
- DPR adaptativo;
- shadows;
- lazy loading;
- asset compression;
- disposal;
- scene transitions;
- FPS metrics;
- fallback quality;
- WebGL capability handling.

## Targets
- 60 FPS desktop alvo;
- 30 FPS mínimo mobile;
- sem crescimento contínuo de memória após entrar/sair de cenas;
- loading com feedback;
- qualidade adaptável.

## Critério
Se o dispositivo não suportar a qualidade principal, reduzir efeitos antes de quebrar gameplay.
