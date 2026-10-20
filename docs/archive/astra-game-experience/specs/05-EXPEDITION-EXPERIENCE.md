# SPEC 05 — Expedition Experience

## Objetivo
Transformar o quiz de desbloqueio em uma missão de exploração.

## Implementar
- ExpeditionSession com introdução, objetivo, sequência de desafios, progresso e conclusão.
- Diálogos/narrativa antes e entre perguntas.
- Perguntas integradas ao cenário, não apresentadas como página isolada.
- Personagem se movimenta entre checkpoints/desafios.
- Manter regra atual de sucesso como configuração inicial: 2 acertos em 3.
- Feedback visual imediato sem revelar incorretamente resposta antes da resolução.
- Tela de conclusão com recompensa e desbloqueio territorial.
- Estados loading/error/retry para geração de perguntas.
- Fallback local deve continuar disponível, claramente identificado em desenvolvimento.

## Critérios de aceite
- México/Egito bloqueados podem ser desbloqueados pelo fluxo de expedição.
- Jornada possui começo, progresso e conclusão visual.
- Falha da API não quebra a sessão.

## Checkpoint
Entregar `EXPEDITION EXPERIENCE READY` e aguardar validação.
