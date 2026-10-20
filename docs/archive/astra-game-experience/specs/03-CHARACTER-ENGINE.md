# SPEC 03 — Player Character Engine

## Objetivo
Transformar o avatar estático/arrastado em personagem controlado por estados e eventos do jogo.

## Estados mínimos
`idle`, `walk`, `run`, `attack`, `hit`, `victory`, `defeat`.

## Implementar
- Componente/engine PlayerCharacter desacoplado da pergunta.
- State machine explícita com transições válidas.
- Movimento entre pontos/âncoras de cena com Motion/CSS.
- Suporte a sprite, sprite sheet ou sequência de frames, com fallback para imagem estática atual.
- Eventos de chegada, ataque, impacto e término de animação.
- Evitar animações concorrentes inválidas.
- Respeitar `prefers-reduced-motion`.

## Critérios de aceite
- Personagem anda até posições configuradas.
- Resposta correta pode disparar ataque completo.
- Dano recebido dispara hit e retorna a idle.
- Vitória/derrota têm estados próprios.
- Nenhuma regra pedagógica fica dentro do componente visual.

## Checkpoint
Entregar `CHARACTER ENGINE READY` e aguardar validação.
