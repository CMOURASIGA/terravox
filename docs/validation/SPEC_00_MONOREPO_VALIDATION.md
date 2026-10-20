# SPEC 00 - relatório de validação técnica

Data: 2026-10-20

Branch-base: `develop`

SHA-base: `99143be017a48424b859674c3cd18c81ae7723dd`

## Resultado

Status: **READY FOR HOMOLOGATION WITH EXTERNAL CHECKS**

A consolidação preserva o jogo e importa integralmente os checkpoints B0 a B2
do Blender MCP. Os gates executáveis neste ambiente foram aprovados. A
homologação real do worker B2 continua pendente porque exige Blender instalado,
fixture `cube.blend`, Supabase configurado e host Linux persistente.

## Evidências

| Área | Verificação | Resultado | Evidência |
|---|---|---|---|
| Git | `main` é ancestral de `develop` | PASS | `git merge-base --is-ancestor origin/main origin/develop` retornou 0 |
| Git | `main` preservada | PASS | `origin/main` em `5c1e9cc909fef3e466290af09c8e96e1542a7d5b` |
| Git | `develop` íntegra | PASS | base validada em `99143be017a48424b859674c3cd18c81ae7723dd` |
| Histórico | branch experimental arquivada | PASS | origem `astra/game-experience` em `6ff167934af45c111c29a5df1a9a445064a8939d` documentada em `docs/archive/` |
| Jogo | instalação | PASS | `npm ci` |
| Jogo | TypeScript | PASS | `npm run lint`, que executa `tsc --noEmit` |
| Jogo | build | PASS | Vite e bundle do servidor concluídos |
| Jogo | smoke HTTP | PASS | `/` 200, `/api/content-attribution` 200, endpoint de perguntas 503 controlado sem Supabase |
| Jogo | regressão de código | PASS | nenhum arquivo do jogo foi alterado entre `main` e a consolidação |
| MCP | fidelidade da importação | PASS | diff contra SHA `df777bec...`: somente `MIGRATION_SOURCE.md` adicional |
| MCP | instalação | PASS | `npm ci` em `blender-mcp/` |
| MCP | typecheck | PASS | `npm run typecheck` |
| MCP | lint | PASS | `npm run lint` |
| MCP | testes automatizados | PASS | 81 testes aprovados em 13 arquivos |
| MCP | build | PASS | `npm run build` |
| MCP | integração Blender real | NOT TESTED | Blender não está instalado neste ambiente; 1 teste foi corretamente ignorado |
| MCP | contratos B0/B1 | PASS | health, MCP HTTP, job domain, persistência e migration cobertos por testes |
| MCP | implementação B2 | PASS | worker, claim/lease, heartbeat, timeout, allowlist, cleanup e shutdown presentes e cobertos por testes unitários |
| Supabase | migration MCP | PASS | `20260922151056_create_blender_jobs.sql` presente e teste estrutural aprovado |
| Supabase | migration aplicada em ambiente real | NOT TESTED | requer acesso ao projeto Supabase de destino |
| Vercel | separação por Root Directory | PASS | configuração documentada para raiz e `blender-mcp/` |
| Vercel | deployments/configuração reais | NOT TESTED | nenhuma alteração ou inspeção de produção foi autorizada |
| Worker | serviço Linux | PASS | unit file e runbook presentes, caminho atualizado para o monorepositório |
| Worker | E2E B2 em Linux | NOT TESTED | depende de Blender, asset, Supabase e host persistente |
| Fluxo funcional humano | perguntas, progressão, expedição e batalha | NOT TESTED | requer navegação humana; código do jogo permaneceu idêntico à `main` |

## Riscos e pendências

1. Executar o E2E B2 em Linux com Blender e `cube.blend`.
2. Aplicar e conferir a migration do MCP no Supabase destinado à fila.
3. Confirmar nos dois projetos Vercel os Root Directories e variáveis
   independentes, sem alterar produção.
4. Realizar smoke humano do jogo para fechar o critério funcional.
5. Manter o repositório `terravox-blender-mcp` e a branch
   `astra/game-experience` até autorização posterior.

## Decisão

A estrutura consolidada está tecnicamente pronta para homologação da SPEC 00.
A SPEC não deve receber aprovação final enquanto os itens marcados como
`NOT TESTED` obrigatórios para B2 e para a infraestrutura real não forem
executados. B3 permanece fora de escopo.
