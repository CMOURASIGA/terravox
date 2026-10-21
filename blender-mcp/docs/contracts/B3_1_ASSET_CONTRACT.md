# B3.1 — Contrato e perfil de asset

Status: **IMPLEMENTADO PARA HOMOLOGAÇÃO**

Este documento define o contrato versionado da B3.1. Ele não conecta o
contrato ao MCP, à fila, ao storage ou ao Blender Worker; essas integrações
dependem da aprovação dos incrementos seguintes.

## Primeiro asset

| Campo | Valor |
|---|---|
| `assetId` | `territory-br-forest-landmark-v001` |
| `assetType` | `territory_landmark` |
| `assetVersion` | `v001` |
| perfil | `terravox-web-default` |
| contrato | `1.0.0` |
| manifesto | `1.0.0` |

Autoria (`authorName` e `attribution`) e licença (`identifier` e `name`) são
obrigatórias. O identificador de licença aceita um identificador SPDX ou um
`LicenseRef-*` controlado pelo projeto. A aprovação jurídica e visual do
conteúdo continua sendo um gate humano.

## Entrada

`assetProcessingInputSchema` aceita somente:

- metadados tipados do asset;
- chave relativa `incoming/**/*.blend`, nunca caminho do host ou URL;
- SHA-256 com 64 caracteres hexadecimais minúsculos;
- MIME `application/x-blender` e tamanho positivo;
- perfil `terravox-web-default`;
- chave UUID de idempotência.

Os objetos são estritos. Campos desconhecidos — inclusive credenciais — são
rejeitados. A entrada não aceita comandos, código Python, URLs de download ou
caminhos arbitrários.

## Perfil `terravox-web-default` 1.0.0

| Regra | Limite |
|---|---:|
| triângulos | 25.000 |
| materiais | 4 |
| texturas | 4 |
| textura | 2.048 × 2.048 |
| GLB | 8 MiB |
| unidade | metros |
| origem | base central (`base_center`) |
| animação | proibida |
| armature | proibido |
| referências externas | proibidas |

O perfil é um objeto validado por `assetProfileSchema`; portanto, os limites
podem ser substituídos por configuração explícita e testada, sem alterar o
algoritmo de validação. Os limites são tetos, não metas de consumo.

## Saída e manifesto

`assetProcessingOutputSchema` representa aceitação ou rejeição contratual.
`assetManifestSchema` registra identidade e versão do asset, perfil, hashes e
tamanhos da entrada e saída, chaves de storage, idempotência e instante de
criação. A saída é exclusivamente `model/gltf-binary`, sob
`derived/**/*.glb`.

O manifesto não contém URL assinada nem credencial. Persistência, retenção e
geração efetiva do manifesto ficam fora da B3.1.

## Idempotência

A identidade lógica é o SHA-256 determinístico da versão do contrato, asset,
versão, tipo, chave e hash de entrada, perfil e `idempotencyKey`.

- uma repetição byte a byte equivalente produz o mesmo fingerprint;
- reutilizar a chave para uma entrada diferente produz
  `IDEMPOTENCY_CONFLICT`;
- o armazenamento com unicidade e a devolução do job já criado serão
  integrados apenas no incremento que ligar o contrato à fila.

## Códigos de erro

Os códigos estáveis estão em `assetContractErrorCodeSchema` e cobrem contrato,
origem, hash, idempotência, perfil, limites, estrutura, Blender, exportação,
storage, lease e timeout. Violações mensuráveis do perfil retornam códigos
específicos, como `TRIANGLE_LIMIT_EXCEEDED` e
`EXTERNAL_REFERENCE_BLOCKED`.

## Compatibilidade

O contrato B3.1 é aditivo. A tool B1 `blender.export_glb`, o perfil legado
`terravox-default`, a fila e o Worker B2 não foram modificados. O novo perfil
não é anunciado pela tool atual antes da integração autorizada, evitando uma
promessa de execução ainda inexistente.
