# TerraVox Specs — Instruções para Astra/Codex

Leia primeiro `00-ROADMAP.md`.

## Contexto
O repositório já possui um MVP funcional em React/Vite/Express, geração de perguntas por IA, mapa com Brasil/México/Egito, expedição, batalha e passaporte. A missão desta trilha é evoluir o MVP para um RPG 2D educacional com aparência e comportamento de game, sem destruir o que já funciona.

## Regras de execução
1. Antes de implementar uma SPEC, inspecione o código real e identifique os pontos de integração.
2. Execute exclusivamente a SPEC indicada pelo responsável do projeto.
3. Não avance para a próxima SPEC por iniciativa própria.
4. Preserve comportamentos existentes salvo bug/regressão real; documente qualquer correção.
5. Evite big-bang rewrite.
6. Não introduza Supabase ou outro serviço pago/obrigatório nesta trilha sem autorização.
7. Segredos de IA permanecem server-side.
8. Prefira arquitetura extensível por dados/configuração a condicionais específicas por território.
9. Toda saída de IA usada pelo jogo deve ser estruturada, validada e possuir fallback.
10. Ao final de cada SPEC, rode validações disponíveis e produza checkpoint com: resumo, arquivos alterados, testes, decisões, limitações e itens para validação humana.

## Estado esperado ao final
TerraVox deve parecer e se comportar como um RPG 2D web: personagem animado, mundos/cenas, expedições, batalhas, HUD, efeitos, áudio opcional, progresso local, IA desacoplada, Game Director e aprendizagem adaptativa, mantendo execução viável sem backend pago.
