# SPEC 04 — World & Scene Engine

## Objetivo
Converter territórios em mundos/cenas configuráveis e reutilizáveis.

## Implementar
- Modelo World/Territory com id, nome, tema, background, música, inimigos, missões, pontos de entrada e recompensas.
- Scene renderer em camadas: background, ambient layer, actors, foreground, HUD/modal.
- Parallax leve e opcional.
- Brasil, México e Egito migrados para configuração sem remover conteúdo existente.
- Transição mapa -> território -> cena.
- Deslocamento visual do personagem no mapa quando fizer sentido.
- Sistema preparado para adicionar novos territórios sem alterar o engine.

## Critérios de aceite
- Os três territórios atuais funcionam via configuração.
- Novo território de teste pode ser criado majoritariamente por dados/assets.
- Scene renderer não conhece regras específicas de Brasil/México/Egito.
- Mobile e desktop preservados.

## Checkpoint
Entregar `WORLD SCENE ENGINE READY` e aguardar validação.
