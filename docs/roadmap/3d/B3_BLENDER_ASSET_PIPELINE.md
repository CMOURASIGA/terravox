# SPEC B3 - Pipeline de assets Blender para o TerraVox

Status: **PROPOSTA PARA REVISÃO - IMPLEMENTAÇÃO NÃO INICIADA**

Dependências: B0, B1 e B2 funcionalmente aprovados

Estimativa: 12 a 18 dias úteis de engenharia, sem incluir produção artística em
escala nem contratação de infraestrutura persistente.

## 1. Objetivo

Entregar um pipeline controlado que receba arquivos Blender autorizados,
verifique se podem ser usados pelo TerraVox, normalize e otimize os modelos,
exporte GLB e disponibilize o resultado para preview e consumo pelo jogo.

B3 deve produzir assets utilizáveis no gameplay. Não faz parte do escopo criar
um editor 3D genérico, uma biblioteca pública de modelos ou automações sem
consumidor definido no TerraVox.

## 2. Casos de uso prioritários

| Prioridade | Asset | Uso no jogo |
|---|---|---|
| P0 | marco de território | identificação visual e entrada de território |
| P0 | objeto de cenário | composição do mapa e das áreas jogáveis |
| P0 | Guardian estático | preview, encontro e preparação do combate |
| P1 | personagem base | exploração e representação do jogador |
| P1 | prop interativo | desafios e feedback de ações |
| P1 | variação visual | diferenciação regional sem duplicar a lógica do jogo |

Assets animados completos somente entram quando o contrato de animação do jogo
estiver definido. Rigging automático, geração por IA e edição colaborativa
ficam fora desta SPEC.

## 3. Fluxo proposto

1. O MCP recebe uma solicitação autenticada com referência de entrada e perfil
   de exportação.
2. A API valida identidade, metadados, tamanho, formato, origem e idempotência.
3. B1 cria o job na fila.
4. B2 realiza claim e mantém lease e heartbeat.
5. O worker baixa o arquivo para um workspace isolado.
6. Blender executa inspeção estrutural sem scripts externos do arquivo.
7. Regras do perfil TerraVox decidem aprovação, rejeição ou necessidade de
   correção.
8. Quando permitido, Blender normaliza, otimiza e exporta GLB.
9. O worker valida o GLB exportado.
10. Entrada, relatório e resultado são armazenados com hashes e metadados.
11. O MCP disponibiliza status, relatório e referência temporária do artifact.
12. O jogo ou a tela de homologação carrega o GLB em preview antes de qualquer
    incorporação ao gameplay.

## 4. Contratos MCP

### 4.1 Evolução de `blender.export_glb`

Entrada mínima:

```json
{
  "assetId": "territory-br-rj-landmark-v001",
  "source": {
    "storageKey": "incoming/territory-br-rj-landmark-v001.blend",
    "sha256": "<hash>"
  },
  "assetType": "territory_landmark",
  "exportProfile": "terravox-web-default",
  "idempotencyKey": "<uuid>"
}
```

A API não deve aceitar caminho arbitrário no host, URL irrestrita ou código
Python fornecido pelo cliente.

### 4.2 `blender.get_job_status`

Deve preservar o contrato B1 e acrescentar, quando disponíveis:

- estágio atual;
- progresso discreto;
- códigos de erro estáveis;
- relatório de validação;
- hashes de entrada e saída;
- metadados do artifact;
- referência temporária de download;
- timestamps de retenção.

### 4.3 Nova tool `blender.validate_asset`

Cria um job de validação sem exportação definitiva. Deve usar os mesmos perfis
e produzir relatório compatível com `blender.export_glb`.

Não adicionar outras tools antes de existir um caso de gameplay aprovado.

## 5. Entrada e armazenamento

### Entrada

- formato inicial: `.blend`;
- limite de tamanho configurável;
- extensão, MIME, assinatura e SHA-256 obrigatórios;
- upload direto para storage por URL assinada de curta duração;
- allowlist de prefixos e buckets;
- nome lógico independente do nome físico;
- nenhuma credencial de storage no cliente.

### Saída

- GLB como formato de distribuição;
- relatório JSON versionado;
- thumbnail opcional gerado pelo Blender;
- manifesto contendo asset ID, versão, perfil, hashes, tamanho e data;
- URLs assinadas com expiração;
- política explícita de retenção para entradas, workspaces e resultados.

A escolha do provedor de storage deve reutilizar a infraestrutura já
disponível quando atender aos requisitos. Nenhuma contratação faz parte da
aprovação desta SPEC.

## 6. Validação estrutural

Cada perfil deve definir limites mensuráveis:

- arquivo abre sem prompt ou interação;
- ausência de scripts, drivers ou referências externas não autorizadas;
- quantidade de scenes, collections e objetos;
- tipos de objeto permitidos;
- nomes únicos e convenção de nomes;
- transforms, escala, eixos e origem;
- bounding box e dimensões máximas;
- contagem de triângulos por mesh e total;
- quantidade de materiais;
- quantidade e resolução de texturas;
- texturas empacotadas ou resolvidas;
- UV obrigatório quando houver textura;
- ausência de meshes vazios, geometria inválida e referências ausentes;
- armature e animações somente em perfis que as autorizem;
- licença, autoria e atribuição presentes nos metadados do asset.

Erros bloqueantes impedem exportação. Alertas não bloqueantes aparecem no
relatório e exigem aceite explícito na homologação do asset.

## 7. Normalização, otimização e exportação

Operações permitidas por perfil:

- aplicar transforms;
- converter sistema de eixos e unidade;
- remover dados órfãos;
- consolidar materiais compatíveis;
- remover objetos e collections fora da allowlist;
- comprimir texturas dentro de limites definidos;
- gerar LOD somente quando a técnica e o consumidor estiverem definidos;
- exportar GLB com configurações determinísticas.

O pipeline não deve alterar silenciosamente a aparência. Toda transformação
deve ser registrada no relatório. Entrada original deve permanecer imutável.

O GLB final deve ser validado quanto a:

- leitura pelo loader usado no jogo;
- estrutura glTF 2.0;
- tamanho máximo do perfil;
- ausência de referências externas;
- materiais e texturas resolvidos;
- bounds e orientação;
- desempenho mínimo no preview.

## 8. Preview 3D

Criar uma rota de homologação interna, sem publicação em Production, que:

- carregue somente artifacts autorizados por URL temporária;
- permita orbitar, aproximar e redefinir câmera;
- mostre grid, eixos, bounds e escala;
- apresente triângulos, meshes, materiais, texturas e tamanho;
- alterne entre fundo claro e escuro;
- mostre erros e alertas do relatório;
- valide o mesmo loader e a mesma configuração de renderização prevista para o jogo.

O preview não substitui a integração real com gameplay. Pelo menos um asset P0
deve ser carregado em um cenário controlado do TerraVox antes da aprovação da
B3.

## 9. Tratamento de erros

Códigos mínimos:

| Código | Condição | Política |
|---|---|---|
| `SOURCE_NOT_FOUND` | entrada inexistente ou expirada | falha sem retry |
| `SOURCE_HASH_MISMATCH` | conteúdo diferente do declarado | falha de segurança |
| `SOURCE_TOO_LARGE` | limite excedido | falha sem download completo quando possível |
| `BLEND_OPEN_FAILED` | Blender não abriu o arquivo | falha, retry somente se transitório |
| `ASSET_VALIDATION_FAILED` | regra estrutural bloqueante | falha funcional com relatório |
| `EXTERNAL_REFERENCE_BLOCKED` | referência não autorizada | falha de segurança |
| `EXPORT_FAILED` | exportador Blender falhou | retry limitado |
| `OUTPUT_VALIDATION_FAILED` | GLB inválido | falha e retenção de diagnóstico |
| `STORAGE_WRITE_FAILED` | persistência indisponível | retry com backoff |
| `LEASE_LOST` | worker perdeu posse do job | interromper processamento |
| `TIMEOUT` | duração máxima excedida | terminar processo e limpar workspace |

Logs devem usar IDs e hashes, nunca secrets, URLs assinadas completas ou
conteúdo de arquivos.

## 10. Segurança e isolamento

- worker executado por usuário sem privilégios;
- workspace exclusivo por job;
- nenhum caminho fornecido pelo cliente;
- allowlist de operações Blender;
- scripts automáticos do arquivo desativados;
- timeout, limites de CPU, memória, disco e tamanho;
- download e upload apenas para destinos autorizados;
- validação de ownership antes de devolver artifacts;
- service role somente no servidor;
- limpeza idempotente do workspace;
- auditoria de criação, claim, exportação, download e exclusão.

## 11. Dependências

### Técnicas

- B0 MCP e endpoints de saúde;
- B1 fila, persistência, estados, claim e lease;
- B2 worker, heartbeat, execução Blender, shutdown e cleanup;
- storage com URLs assinadas e política de retenção;
- loader GLB selecionado para o frontend;
- perfis técnicos alinhados com P2 Art Direction & Asset Pipeline;
- ambiente Linux persistente para operação contínua.

### Decisões necessárias antes do desenvolvimento

1. Quais assets P0 serão homologados primeiro.
2. Limites de triângulos, texturas e tamanho por tipo de asset.
3. Provedor e buckets de storage para Preview e Production.
4. Prazo de retenção de entradas, relatórios e GLBs.
5. Biblioteca de renderização usada pelo TerraVox.
6. Responsável por aprovar licença e qualidade visual.
7. Estratégia e orçamento do Worker persistente.

## 12. Critérios de aceite

B3 será aprovada somente quando:

1. Upload autorizado de `.blend` funcionar sem expor credenciais.
2. Hash e metadados da entrada forem verificados.
3. Arquivo inseguro ou fora do perfil for rejeitado com código estável.
4. Asset válido for processado pelo Worker B2 com claim, lease e heartbeat.
5. Relatório estrutural versionado for persistido.
6. Transformações e otimizações forem rastreáveis e determinísticas.
7. GLB válido for exportado e armazenado com SHA-256.
8. Status e artifacts forem recuperáveis pelo MCP com autorização.
9. Preview carregar o GLB e apresentar métricas e alertas.
10. Pelo menos um asset P0 for carregado em cenário controlado do jogo.
11. Falhas controladas não deixarem job preso nem workspace residual.
12. Retry não criar artifacts duplicados.
13. Testes não alterarem dados educacionais nem Production.
14. Documentação operacional e política de retenção estiverem atualizadas.
15. Todos os gates obrigatórios possuírem evidência, sem classificar testes não executados como PASS.

## 13. Estratégia de testes

### Unitários

- schemas e contratos MCP;
- perfis e regras de validação;
- estados, retries e códigos de erro;
- nomes, paths, hashes e manifests;
- sanitização de logs.

### Integração

- storage com URLs assinadas;
- criação, claim e finalização de jobs;
- idempotência;
- lease perdido e heartbeat;
- persistência de relatório e artifacts;
- autorização de leitura e isolamento entre solicitantes.

### E2E Linux com Blender real

Fixtures mínimas:

- cubo válido;
- arquivo corrompido;
- asset acima do orçamento;
- textura ausente;
- referência externa bloqueada;
- exportação válida para GLB;
- falha controlada durante exportação;
- repetição com a mesma idempotency key.

### Frontend e gameplay

- carregamento do preview;
- erro de download e GLB inválido;
- desktop e mobile;
- medição de tempo de carga e memória;
- uso de um asset P0 em cenário controlado;
- regressão no fluxo atual de perguntas e progressão.

## 14. Estimativa de esforço

| Etapa | Esforço |
|---|---:|
| contratos, perfis e threat model | 2 dias |
| upload e storage | 2 a 3 dias |
| inspeção estrutural e relatório | 2 a 3 dias |
| normalização, otimização e exportação | 3 a 4 dias |
| recuperação de artifacts e MCP | 1 a 2 dias |
| preview 3D | 2 a 3 dias |
| E2E, falhas, segurança e documentação | 2 a 3 dias |
| Total estimado | 12 a 18 dias úteis |

Estimativa para um engenheiro com revisão. Produção artística, infraestrutura
persistente e correções extensas em assets recebidos não estão incluídas.

## 15. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| assets sem orçamento técnico | baixo desempenho no jogo | perfis por tipo e asset P0 representativo |
| arquivos Blender não confiáveis | execução ou acesso indevido | scripts desativados, allowlists e isolamento |
| otimização alterar aparência | rejeição visual | original imutável, relatório e preview comparável |
| storage sem retenção definida | custo e exposição | TTL, lifecycle e URLs curtas |
| Worker não persistente | fila sem processamento contínuo | separar aprovação funcional de prontidão operacional |
| GLB válido mas inadequado ao jogo | trabalho sem uso | gate obrigatório em cenário TerraVox |
| retries duplicarem saída | inconsistência e custo | idempotência e hash de saída |
| escopo crescer para ferramenta genérica | atraso | limitar tools e assets aos casos de gameplay aprovados |

## 16. Checkpoint proposto - primeiro asset utilizável

Primeiro asset recomendado: **Marco da Floresta do Brasil**, com o identificador
lógico `territory-br-forest-landmark-v001` e tipo `territory_landmark`.

### Aplicação no gameplay

- identificar visualmente a Floresta do Brasil no mapa;
- ser reutilizado como marco de entrada na cena do território;
- permitir seleção por clique ou toque sem substituir o fluxo atual de desafios;
- servir como primeiro GLB real para validar o pipeline completo.

A escolha prioriza um asset estático e visível, sem rigging ou animação. Isso
reduz dependências e comprova valor no jogo antes de ampliar o pipeline.

### Entregáveis do primeiro incremento

1. Um arquivo `.blend` original e autorizado.
2. Relatório estrutural versionado.
3. GLB determinístico com SHA-256.
4. Thumbnail de homologação.
5. Preview interno com métricas técnicas.
6. Carregamento em cenário controlado do mapa TerraVox.
7. Fallback visual para preservar o mapa quando o GLB não carregar.

### Perfil inicial a aprovar antes do desenvolvimento

| Regra | Proposta inicial |
|---|---|
| Triângulos | máximo de 25.000 |
| Materiais | máximo de 4 |
| Texturas | máximo de 4, até 2048 x 2048 |
| Tamanho do GLB | máximo de 8 MB |
| Animação e armature | não permitidas |
| Referências externas | não permitidas |
| Unidade | metros |
| Origem | base central do asset |
| Orientação | compatível com o loader escolhido para o jogo |

Esses valores são hipóteses de planejamento e precisam de aprovação técnica e
visual antes de se tornarem contrato do perfil.

### Decisões pendentes para autorização da B3

1. Aprovar o Marco da Floresta do Brasil como primeiro asset P0.
2. Confirmar ou ajustar os limites do perfil inicial.
3. Selecionar o loader GLB do frontend.
4. Definir storage de homologação, buckets e retenção.
5. Definir autoria, licença e responsável pela aprovação visual do asset.
6. Confirmar o ambiente temporário Linux para o primeiro E2E.

Nenhum item deste checkpoint autoriza implementação, migration, deploy em
Production ou contratação de infraestrutura.

## 17. Gates de execução

A implementação somente pode começar após:

- aprovação desta SPEC;
- definição do primeiro asset P0;
- aprovação dos limites do perfil;
- decisão de storage;
- confirmação do ambiente de desenvolvimento e homologação;
- autorização explícita para iniciar B3.

A aprovação desta proposta não autoriza merge, Production, migrations ou
contratação de infraestrutura.
