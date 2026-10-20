# SPEC 14 — QA, Telemetry & Release Candidate

## Objetivo
Consolidar a nova experiência em uma versão validável e segura para publicação.

## Implementar
- Testes unitários das regras de progressão, combate, desbloqueio e adaptive learning.
- Testes de integração dos fluxos Map -> Expedition -> Unlock -> Battle -> Reward.
- Smoke tests com FakeProvider.
- Cenários de API indisponível/resposta inválida/timeout.
- Logging de desenvolvimento sem expor segredos ou conteúdo sensível.
- Telemetria local/abstrata preparada para futuro backend, sem serviço pago obrigatório.
- Checklist visual mobile/tablet/desktop.
- Documentar arquitetura final, variáveis de ambiente e como adicionar território/personagem/inimigo.
- Registrar débitos técnicos e próximos passos, incluindo opção de persistência cloud gratuita.

## Critérios de aceite
- `npm run lint` e `npm run build` verdes.
- Fluxo principal validado sem IA externa via FakeProvider.
- Fluxo principal validado com provider real quando chave estiver configurada.
- Nenhuma chave no frontend/repositório.
- Documentação suficiente para outro dev continuar o projeto.

## Checkpoint final
Entregar `TERRAVOX GAME EXPERIENCE RC READY` com relatório completo. Não iniciar multiplayer/backend cloud automaticamente.
