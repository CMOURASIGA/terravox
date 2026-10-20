# SPEC 01 — Game Foundation

## Objetivo
Criar a fundação técnica do TerraVox como RPG 2D sem reescrever o MVP.

## Implementar
- Separar domínio de jogo da renderização React.
- Criar tipos centrais: GameSession, Scene, CharacterState, EnemyState, CombatState, Reward, GameEvent.
- Criar game state/reducer ou store previsível para MAP, EXPEDITION, BATTLE e PASSPORT.
- Criar event bus/dispatcher para eventos como PLAYER_MOVE, PLAYER_ATTACK, PLAYER_HIT, ENEMY_ATTACK, ENEMY_HIT, VICTORY, DEFEAT, REWARD_GRANTED.
- Eliminar regras de progressão duplicadas em componentes.
- Preservar fluxo atual de login por nome e telas existentes.
- Preparar feature flags para ativar a nova experiência gradualmente.

## Critérios de aceite
- Fluxo atual continua utilizável.
- Componentes deixam de ser responsáveis por regras centrais do jogo.
- Eventos de jogo podem ser reproduzidos deterministicamente.
- npm run lint e npm run build aprovados.

## Checkpoint
Entregar `GAME FOUNDATION READY` e não iniciar SPEC 02 sem validação.
