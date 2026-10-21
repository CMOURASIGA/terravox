# SPEC 00 - relatório final de consolidação e homologação B2

Data de encerramento técnico: 2026-10-21

Branch: `chore/spec-00-monorepo-validation`

SHA homologado B2: `1d411535128da41625cb35e645fa19297fa8eb20`

PR: https://github.com/CMOURASIGA/terravox/pull/1

## Decisão

Status da SPEC 00: **TECHNICALLY APPROVED - GAME HUMAN VALIDATION PENDING**

Status do B2: **FUNCTIONALLY APPROVED**

Status operacional do B2: **PENDING PERSISTENT LINUX WORKER**

A consolidação preserva o jogo TerraVox e incorpora B0, B1 e B2 do Blender
MCP no mesmo repositório, com projetos, dependências e ambientes de execução
independentes.

## Evidências consolidadas

| Área | Verificação | Resultado | Evidência |
|---|---|---|---|
| Git | `main` preservada | PASS | nenhuma alteração ou merge realizado em `main` |
| Git | destino do PR | PASS | PR #1 aberto para `develop` |
| Git | capacidade de merge no SHA homologado | PASS | GitHub: `mergeable=true`, `mergeable_state=clean` |
| Histórico | documentação experimental arquivada | PASS | `docs/archive/` preservado |
| Jogo | instalação, TypeScript e build | PASS | validação técnica da SPEC 00 |
| Jogo | regressão de código | PASS | consolidação sem remoção funcional identificada |
| Jogo | Preview Vercel | PASS | deployment do SHA homologado em estado READY |
| Jogo | fluxo humano completo | NOT TESTED | acesso, perfil, mapa, território, desafio, progressão e persistência aguardam validação humana |
| MCP | instalação, typecheck, lint, testes e build | PASS | gates técnicos aprovados |
| MCP | contratos B0 e B1 | PASS | health, MCP HTTP, domínio de jobs e persistência validados |
| MCP | implementação B2 | PASS | worker, claim, lease, heartbeat, execução e cleanup validados |
| B2 Linux | Blender real | PASS | Ubuntu 24.04.5 e Blender 4.0.2 |
| B2 E2E | `cube.blend` e `inspect.py` | PASS | job concluído, cubo validado e relatório produzido |
| B2 fila | isolamento e limpeza | PASS | fila vazia antes e depois; exclusão limitada ao job e correlation ID do teste |
| B2 controle | heartbeat, lease, falha e shutdown | PASS | asserts do workflow aprovados |
| MCP Preview | POST autenticado `initialize` | PASS | JSON-RPC 2.0, protocolo 2025-03-26, servidor `terravox-blender-mcp` 0.1.0 |
| Segurança | credenciais | PASS | secrets mascarados, sem valores em código, logs ou artifacts |
| Supabase | migration da fila | PASS | tabela, função de claim, constraints, triggers e RLS verificados |
| Vercel | projetos independentes | PASS | jogo na raiz e MCP em `blender-mcp/` |
| Worker | serviço Linux persistente | NOT TESTED | unit file e runbook existem, mas não há host persistente homologado |

Workflow homologado:
https://github.com/CMOURASIGA/terravox/actions/runs/39594868311

Jobs aprovados:

- Blender build and local validation
- Worker E2E against homologation Supabase
- Authenticated MCP Preview initialize

## Evidência B2

Job de homologação:

- ID: `288dd29b-a564-4241-9ffa-dce61c1205a8`
- Correlation ID: `769b5f4e-a38e-432b-8c9b-290b6d3c4fdd`
- Estado final: `completed`
- Tentativas: 1

Relatório real:

- Blender: 4.0.2
- objetos: 1
- meshes: 1
- nome: `Cube`
- dimensões: `[2, 2, 2]`

A limpeza removeu somente o job criado pelo teste e confirmou zero jobs
remanescentes.

Resposta MCP validada:

```json
{
  "result": {
    "protocolVersion": "2025-03-26",
    "capabilities": {
      "tools": {
        "listChanged": true
      }
    },
    "serverInfo": {
      "name": "terravox-blender-mcp",
      "version": "0.1.0"
    }
  },
  "jsonrpc": "2.0",
  "id": 1
}
```

## Pendências funcionais do jogo

1. Executar validação humana no Preview.
2. Confirmar acesso e criação de perfil.
3. Confirmar navegação no mapa e seleção de território.
4. Executar um desafio.
5. Confirmar progressão e persistência após recarregar a aplicação.

Essas pendências não invalidam o B2, mas impedem o encerramento integral da
homologação funcional do jogo dentro da SPEC 00.

## Pendências de infraestrutura Blender

1. Selecionar um host Linux persistente.
2. Instalar e fixar uma versão homologada do Blender.
3. Instalar o serviço systemd usando o runbook versionado.
4. Configurar secrets server-side e diretórios com permissões mínimas.
5. Homologar restart automático, logs, retenção, disco, alertas e recuperação.
6. Validar operação contínua da fila e política de atualização do worker.
7. Definir custo, responsável operacional e procedimento de rollback.

A execução temporária no GitHub Actions comprova o comportamento funcional do
B2, mas não comprova disponibilidade operacional contínua.

## Situação do PR #1

No SHA homologado, o PR estava aberto, sem conflitos e apto tecnicamente para
merge em `develop`. A atualização documental posterior deve receber seus
checks normais antes da autorização final.

Nenhum merge deve ser executado antes da conferência humana do jogo e da
autorização explícita.

## Próximo passo

1. Conferência humana do jogo no Preview.
2. Revisão e aprovação da proposta B3.
3. Autorização separada para merge do PR #1.
4. Autorização separada para iniciar a implementação B3.
