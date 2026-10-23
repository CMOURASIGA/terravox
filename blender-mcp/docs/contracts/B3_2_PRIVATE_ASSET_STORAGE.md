# B3.2 - Armazenamento privado e controle de acesso

Status: **IMPLEMENTADO - VALIDAÇÃO REAL DE URL ASSINADA PENDENTE**

## Limites desta etapa

Esta etapa cria e registra a infraestrutura privada de storage. Ela não
adiciona tool MCP, não inicia Worker, não executa Blender, não exporta GLB e
não integra o jogo. Essas atividades dependem de B3.3 a B3.5.

## Recursos privados

| Bucket | Conteúdo | Limite | Acesso público |
|---|---|---:|---|
| `blender-assets-incoming` | `.blend` | 100 MiB | proibido |
| `blender-assets-derived` | GLB, relatório, manifesto e thumbnail | 8 MiB | proibido |

Os objetos são registrados em `public.blender_asset_objects`, com RLS,
owner, solicitante, ambiente, chave, hash declarado, MIME, tamanho, estado,
retenção e metadados de auditoria. O uso de `user_metadata` é proibido.

## Autorização server-side

`AssetStorageService` recebe um `ServerActor` que deve ser construído somente
por um adaptador de autenticação confiável. Antes de assinar qualquer URL, ele
verifica o ambiente permitido e o owner/solicitante do registro. A service role
permanece no servidor e nunca é retornada, registrada em log ou aceita como
entrada.

O upload de `.blend` exige a chave canônica abaixo. O cliente não escolhe
bucket nem caminho.

```text
incoming/{environment}/{assetId}/{assetVersion}/{sha256}.blend
```

Downloads só são emitidos para derivados em estado `processed` ou `approved`.
O download expira em cinco minutos. O Supabase fixa URLs de upload assinadas em
duas horas, portanto esse é o prazo declarado e testado como contrato do
provedor, não cinco minutos assumidos incorretamente.

## Retenção

- upload pendente: prazo de 24 horas;
- `.blend` processado ou com falha: sete dias;
- GLB temporário: 30 dias;
- GLB aprovado e referenciado: sem expiração;
- workspace: responsabilidade do Worker B2, mantida fora desta etapa.

A rotina atual só produz plano individual `dry-run`. Não exclui objeto,
prefixo, bucket ou registro automaticamente.

## Reversão

1. Interromper a emissão de novas autorizações no adaptador server-side.
2. Manter os buckets privados e os registros para auditoria.
3. Se for necessário reverter a ampliação de MIME do bucket derivado, criar
   uma migration nova que restrinja tipos apenas depois de confirmar que não há
   artifact correspondente armazenado.
4. Não apagar buckets, tabelas ou dados educacionais como procedimento de
   reversão.
