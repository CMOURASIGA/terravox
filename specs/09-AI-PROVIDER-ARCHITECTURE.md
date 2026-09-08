# SPEC 09 — AI Provider Architecture

## Objetivo
Eliminar acoplamento do jogo a um único provedor/modelo de IA.

## Interface alvo
`AIProvider` deve suportar, conforme capacidade: `generateQuestions`, `generateMission`, `evaluatePlayer`, `explainAnswer`, `generateNarrative`.

## Implementar
- Contratos tipados de request/response.
- GeminiProvider preservando o comportamento atual.
- OpenAIProvider preparado para modelos OpenAI disponíveis via configuração.
- FakeProvider determinístico para desenvolvimento/testes.
- Router por capacidade/custo/feature flag.
- Validação de schema das respostas antes de entregar ao jogo.
- Timeouts, retries limitados e fallback seguro.
- Segredos somente no servidor.
- Nunca expor chave de provedor ao browser.

## Critérios de aceite
- Troca de provedor não exige alteração em Expedition/Battle UI.
- Gemini atual continua funcional.
- Fake provider permite testes offline.
- Resposta inválida de IA não quebra gameplay.

## Checkpoint
Entregar `AI PROVIDER LAYER READY` e aguardar validação.
