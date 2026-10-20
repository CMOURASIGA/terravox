# SPEC 02 — Visual Identity & Asset System

## Objetivo
Dar identidade visual consistente de game ao TerraVox e criar um sistema escalável de assets.

## Implementar
- Estruturar `assets/game/characters`, `enemies`, `worlds`, `effects`, `ui`, `audio`.
- Definir manifesto/configuração de assets para evitar caminhos hardcoded nos componentes.
- Definir direção visual: RPG 2D de aventura educacional, legível, contemporâneo, amigável a adolescentes e adultos.
- Padronizar HUD: HP, energia quando aplicável, XP, moedas, nível, objetivo da missão.
- Criar componentes de cenário, painel de diálogo, cards de resposta e feedback.
- Substituir progressivamente emojis usados como elementos principais por assets próprios, mantendo fallback.
- Documentar dimensões, formatos, transparência, compressão e nomenclatura.

## Critérios de aceite
- Identidade consistente entre mapa, expedição e batalha.
- Assets carregados por configuração.
- Layout não quebra na ausência de asset opcional.
- Assets otimizados para web.

## Checkpoint
Entregar `VISUAL ASSET SYSTEM READY` e aguardar validação.
