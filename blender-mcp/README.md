# TerraVox Blender MCP

Este pacote vive em `blender-mcp/` no monorepositório
`CMOURASIGA/terravox`. Ele possui instalação, build e execução independentes
da aplicação principal.

Control plane MCP do pipeline Blender do TerraVox. O endpoint público mantém o
contrato B1 de criação de jobs, enquanto o worker Linux B2, já presente neste
pacote, processa operações autorizadas fora da Vercel.

## Componentes disponíveis

- MCP Streamable HTTP stateless;
- endpoint `POST /api/mcp`;
- health HTTP em `GET /api/health`;
- tools `blender.health`, `blender.export_glb` e `blender.get_job_status`;
- validação Zod para ambiente e payloads;
- logging JSON estruturado;
- repository persistente de jobs;
- transições de estado validadas no domínio e no banco;
- claim/lease atômico consumido pelo Worker B2.

B1 cobre o control plane. Blender, subprocessos e Python pertencem ao Worker B2. O armazenamento definitivo de artifacts é escopo proposto para B3.

## Desenvolvimento

Requer Node.js 22 ou superior e um projeto Supabase/Postgres com a migration aplicada.

Copie `.env.example` para `.env.local` e configure, somente no servidor:

```text
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SEGREDO_SERVER_SIDE
```

Nunca use prefixo `NEXT_PUBLIC_` para a service role nem grave seu valor no repositório.

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Para testar o endpoint localmente:

```bash
npx vercel dev
npx @modelcontextprotocol/inspector http://localhost:3000/api/mcp
```

No Inspector, execute na ordem:

1. `initialize` ao conectar;
2. `tools/list`;
3. `blender.health`;
4. `blender.export_glb` com `{"assetId":"chr-explorer-v001","exportProfile":"terravox-default"}`;
5. `blender.get_job_status` com o `jobId` retornado.

## Arquitetura

```text
MCP/API -> Job Service -> Queue/Persistence -> Blender Worker -> Blender CLI
```

MCP/API, Job Service, Queue/Persistence e Worker B2 estão implementados. A homologação funcional do B2 foi concluída em Ubuntu temporário com Blender real. A operação contínua ainda depende de um Worker Linux persistente.

Consulte [docs/DEPLOYMENT_VERCEL.md](docs/DEPLOYMENT_VERCEL.md) para publicação e Human Validation.

## B2 - Blender Worker

Worker Linux persistente (fora da Vercel) que consome jobs `inspect_asset` do Supabase e executa Blender headless. Veja `docs/runbooks/B2_WORKER_RUNBOOK.md`.

```bash
npm run asset:cube                    # gera o fixture local assets/blender/cube.blend
npm run build && npm run worker:start # worker
node --env-file=.env dist/scripts/e2e-cube.js   # E2E real (cube-test)
```


## Status de homologação

- B0: aprovado.
- B1: aprovado.
- B2: funcionalmente aprovado.
- B2 operacional: pendente de Worker Linux persistente.
- B3: proposta documentada, implementação não iniciada.

Evidência B2:
https://github.com/CMOURASIGA/terravox/actions/runs/39594868311

Proposta B3:
[docs/roadmap/3d/B3_BLENDER_ASSET_PIPELINE.md](../docs/roadmap/3d/B3_BLENDER_ASSET_PIPELINE.md)
