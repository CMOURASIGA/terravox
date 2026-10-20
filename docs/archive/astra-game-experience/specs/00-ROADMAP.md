# TerraVox — Roadmap Game Experience

## Objetivo
Transformar o MVP atual do TerraVox em uma experiência de RPG 2D educacional com identidade própria, preservando React/Vite/Express e as mecânicas educacionais já funcionais.

## Princípios obrigatórios
- Preservar o comportamento funcional atual durante a evolução.
- Web-first e mobile-first, sem exigir Unity/Unreal.
- Não depender de Supabase nesta fase. Persistência remota fica desacoplada e futura.
- Manter custo de IA controlável e não usar modelo premium para tarefas triviais.
- Frontend encena o jogo; IA nunca manipula DOM/UI diretamente.
- Assets, regras, animações e conteúdo devem ser configuráveis e extensíveis.
- Cada SPEC deve terminar em checkpoint e validação antes da próxima.

## Ordem oficial
1. SPEC 01 — Game Foundation
2. SPEC 02 — Visual Identity & Asset System
3. SPEC 03 — Player Character Engine
4. SPEC 04 — World & Scene Engine
5. SPEC 05 — Expedition Experience
6. SPEC 06 — Battle Engine 2.0
7. SPEC 07 — Game Feel: FX, áudio e feedback
8. SPEC 08 — Progression & Local Persistence
9. SPEC 09 — AI Provider Architecture
10. SPEC 10 — AI Game Director
11. SPEC 11 — Adaptive Learning Engine
12. SPEC 12 — Tutor & Explanations
13. SPEC 13 — Accessibility, Responsive & Performance
14. SPEC 14 — QA, Telemetry & Release Candidate

## Gate de execução
Astra/Codex deve executar uma SPEC por vez. Ao concluir: rodar lint/build/testes aplicáveis, registrar arquivos alterados, decisões, limitações e evidências de validação. Não avançar automaticamente.

## Fora de escopo desta trilha
- Supabase obrigatório
- multiplayer em tempo real
- pagamentos
- marketplace
- engine 3D
- migração para Unity/Unreal
- geração de imagem/vídeo em tempo real durante gameplay
