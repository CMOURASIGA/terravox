# SPEC 06 — Battle Engine 2.0

## Objetivo
Transformar a batalha atual de perguntas em combate RPG 2D baseado em conhecimento.

## Implementar
- CombatSession e turn state machine.
- Player/enemy HP configuráveis.
- Sequência correta: pergunta -> resposta -> resolução -> animação -> dano -> explicação -> próximo turno.
- Correta: player attack -> enemy hit -> dano.
- Errada: enemy attack -> player hit -> dano.
- Inimigo/guardião configurável por território.
- Barras de HP animadas, números de dano e estados victory/defeat.
- Recompensas centralizadas e idempotentes, evitando duplicidade por re-render.
- Manter inicialmente o balanceamento atual como baseline configurável.

## Critérios de aceite
- Cinco perguntas atuais podem compor uma batalha completa.
- Vitória e derrota são determinísticas.
- Recompensa é concedida uma única vez.
- Refresh/re-render não dispara ataques ou recompensas duplicados.

## Checkpoint
Entregar `BATTLE ENGINE 2 READY` e aguardar validação.
