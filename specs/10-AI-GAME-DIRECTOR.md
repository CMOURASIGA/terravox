# SPEC 10 — AI Game Director

## Objetivo
Usar IA como diretor de conteúdo/narrativa, enquanto o frontend continua responsável por encenar estados permitidos.

## Implementar
- GameDirectorService com saída estruturada e validada.
- Pode selecionar somente IDs de cenas, inimigos, efeitos e mecânicas previamente registrados.
- Gerar introdução de missão, contexto narrativo, desafio e recompensa dentro de limites definidos pelo game engine.
- Nunca retornar código executável, HTML arbitrário ou instruções de DOM.
- Guardrails de tamanho, idade, tom, tema educacional e dificuldade.
- Cache quando apropriado.
- Feature flag para desativar diretor e usar conteúdo estático.

## Contrato conceitual
Saída pode conter: `sceneId`, `enemyId`, `dialogue`, `challengeSpec`, `rewardSpec`, `nextAction`.

## Critérios de aceite
- Conteúdo da IA só referencia recursos permitidos.
- Falha da IA cai para roteiro estático.
- Mesmo conteúdo pode ser renderizado sem conhecer o provedor usado.

## Checkpoint
Entregar `AI GAME DIRECTOR READY` e aguardar validação.
