# SPEC 07 — Game Feel: FX, Áudio e Feedback

## Objetivo
Adicionar sensação de impacto e resposta sem comprometer desempenho ou acessibilidade.

## Implementar
- FX de ataque, impacto, XP, moedas, desbloqueio e vitória.
- Screen shake sutil e opcional.
- Partículas leves, sem canvas pesado quando desnecessário.
- Sistema de SFX e música com mute/volume persistidos localmente.
- Áudio contextual por território.
- Microinterações de botões/respostas/HUD.
- Feedback correto/errado distinguível também sem depender apenas de cor.
- Respeitar reduced-motion e autoplay policies.

## Critérios de aceite
- Ações importantes possuem feedback visual/sonoro coerente.
- Jogo continua utilizável sem áudio e com animações reduzidas.
- Sem regressão relevante de performance mobile.

## Checkpoint
Entregar `GAME FEEL READY` e aguardar validação.
