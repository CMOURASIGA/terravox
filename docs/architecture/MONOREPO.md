# TerraVox - arquitetura do monorepositório

## Limites de execução

O repositório contém dois projetos independentes:

| Projeto | Diretório | Execução | Dependências |
|---|---|---|---|
| Jogo TerraVox | raiz | Vercel, aplicação React/Vite e API Express | `package-lock.json` da raiz |
| Blender MCP | `blender-mcp/` | Vercel para MCP/API e Linux persistente para o worker | `blender-mcp/package-lock.json` |

Não existe importação de código entre o frontend e `blender-mcp/`. Cada
projeto deve executar `npm ci`, validações e build a partir do próprio
diretório.

## Vercel

Devem existir dois projetos Vercel ligados ao mesmo repositório:

1. Jogo, com Root Directory na raiz do repositório.
2. MCP, com Root Directory em `blender-mcp`.

Os arquivos `vercel.json` são locais a cada Root Directory. Variáveis de
ambiente também devem permanecer separadas entre os dois projetos.

## Worker Blender

O worker não executa na Vercel. Ele é um serviço Linux persistente iniciado a
partir de `/opt/terravox/blender-mcp`, conforme o unit file em
`blender-mcp/deploy/systemd/`. O worker acessa a mesma fila Supabase do
control plane por credenciais server-side.

## Persistência

As migrações permanecem separadas:

- `supabase/migrations/`: banco de perguntas do jogo.
- `blender-mcp/supabase/migrations/`: fila e contratos do Blender MCP.

Aplicar cada conjunto somente ao projeto Supabase correspondente. A
consolidação do código não implica compartilhamento obrigatório de banco ou de
credenciais.

## Histórico

A `main` representa o produto atual. A `develop` contém a consolidação. O
conteúdo de B0 a B2 foi importado do SHA
`df777becfc68e0fb157ebc75f689d7ea3d47a2b6` do repositório histórico
`CMOURASIGA/terravox-blender-mcp`. O código importado é idêntico ao original,
exceto pelo arquivo local de rastreabilidade `MIGRATION_SOURCE.md`.

O repositório histórico e branches antigas não devem ser removidos até a
homologação E2E do B2 e autorização explícita.


## Status de validação

- SPEC 00 tecnicamente aprovada; validação humana do jogo permanece pendente.
- B0 e B1 preservados no monorepositório.
- B2 funcionalmente aprovado em Ubuntu temporário com Blender real.
- O POST autenticado de inicialização do MCP foi validado no Preview.
- B2 ainda não está operacionalmente pronto porque o Worker Linux persistente
  não foi provisionado e homologado.
- A proposta B3 está documentada em
  `docs/roadmap/3d/B3_BLENDER_ASSET_PIPELINE.md`; sua implementação não foi
  iniciada.

O jogo e o MCP mantêm deployments independentes. O Worker permanece fora da
Vercel e não deve ser confundido com a função HTTP do MCP.
