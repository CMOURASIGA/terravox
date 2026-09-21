# P0 - TERRAVOX 3D GAME VISION & ARCHITECTURE

Status: PROPOSTA DE ARQUITETURA
Branch alvo: develop
Modelo recomendado: GPT-6 Astra
Esforço recomendado: HIGH
Implementação nesta SPEC: NÃO. Esta etapa define produto, arquitetura, limites e critérios.

## 1. Objetivo

Transformar o TerraVox de uma experiência web gamificada com arena 3D experimental em um jogo web 3D estilizado, com leitura visual, ritmo e feedback comparáveis à categoria de jogos mobile action/cartoon, sem copiar personagens, cenários, interface ou identidade de Brawl Stars.

O público principal é de 12 a 16 anos.

A proposta deve preservar o núcleo educacional já existente:
- 10 níveis;
- 40 territórios/missões;
- progressão por XP;
- moedas;
- perfil/passaporte;
- banco de perguntas;
- Supabase;
- geração/fallback por IA;
- execução web/PWA.

## 2. Situação atual

A develop já contém:
- React 19 + Vite + TypeScript;
- Tailwind;
- Three.js;
- React Three Fiber;
- Drei;
- Arena3D;
- persistência local;
- mapa de progressão;
- BattleScreen e ExpeditionScreen;
- OpenAI server-side;
- catálogo de perguntas em Supabase.

A Arena3D atual deve ser tratada como prova de conceito. Hero, Guardian, cristais e arena são construídos majoritariamente com geometrias primitivas e animações simples.

## 3. Visão do produto

O TerraVox deve deixar de parecer um quiz com decoração de jogo.

Loop principal:

Explorar -> descobrir -> enfrentar desafio -> usar conhecimento -> combater -> receber recompensa -> desbloquear -> explorar.

Conhecimento deve ser uma mecânica do jogo, não a tela inteira.

## 4. Vertical Slice

A primeira entrega jogável será Brasil.

Fluxo mínimo:

Login/Perfil -> Hub/Mapa -> Brasil -> exploração curta -> objetivo -> encontro -> arena -> desafio de conhecimento integrado ao combate -> vitória/derrota -> recompensa -> retorno.

Não construir os 40 mundos em 3D antes de homologar o vertical slice.

## 5. Direção visual

Estilo:
- stylized 3D;
- cartoon action;
- silhuetas fortes;
- cores saturadas mas legíveis;
- materiais simples;
- iluminação cinematográfica leve;
- animações expressivas e curtas;
- UI com grandes áreas de toque;
- evitar aparência infantil baseada em emoji.

Referências de linguagem, não de cópia:
- Brawl Stars;
- Pokémon Unite;
- Stumble Guys;
- Fortnite em leitura de cor e silhueta.

## 6. Arquitetura alvo

src/game/
- GameCanvas
- World
- camera/
- player/
- npcs/
- enemies/
- combat/
- interaction/
- effects/
- audio/
- assets/

src/features/
- profile/
- progression/
- missions/
- questions/
- passport/

src/ui/
- hud/
- overlays/
- menus/
- feedback/

src/store/
- game state;
- session state;
- progression state.

src/services/
- question service;
- persistence;
- API clients.

## 7. Fronteiras arquiteturais

React DOM:
- login;
- perfil;
- menus;
- HUD;
- perguntas;
- recompensas;
- acessibilidade.

React Three Fiber:
- mundo;
- personagens;
- câmera;
- movimento;
- VFX 3D;
- arena;
- interação espacial.

Backend:
- perguntas;
- validação de respostas;
- IA;
- Supabase;
- conteúdo administrativo.

Não colocar lógica de progressão dentro de componentes 3D.

## 8. Asset pipeline

Formato principal: GLB/GLTF.

Definir:
- orçamento de polígonos;
- resolução máxima de textura;
- compressão;
- nomenclatura;
- LOD quando necessário;
- animações;
- origem/licença de cada asset.

Nenhum asset externo entra sem licença identificável.

## 9. Performance target

Desktop:
- alvo 60 FPS.

Mobile/tablet:
- alvo 30 FPS mínimo;
- objetivo 60 FPS em hardware intermediário moderno.

Orçamentos iniciais:
- DPR adaptativo;
- sombras controladas;
- poucos lights dinâmicos;
- texturas compactadas;
- lazy loading por território;
- evitar renderização de mundos não ativos.

## 10. Experiência do jogador

Controles:
- teclado/mouse no desktop;
- touch no mobile;
- arquitetura pronta para gamepad depois.

Câmera:
- isométrica/terceira pessoa elevada;
- follow suave;
- limites de rotação definidos por cena;
- sem câmera livre que desoriente o jogador.

## 11. Progressão

Os 10 níveis e 40 territórios permanecem como visão macro.

A progressão atual deve ser desacoplada da apresentação visual para permitir:
- missões;
- estrelas;
- desafios;
- recompensas;
- colecionáveis;
- skins futuras.

Sem monetização nesta fase.

## 12. Gamification Preservation Contract

Durante P1-P10, a reconstrução 3D NÃO autoriza alteração livre da gamificação existente.

### Obrigatório preservar até a P10

- 10 níveis;
- 40 territórios/missões;
- 4 territórios por nível;
- progressão por conclusão do nível;
- XP total;
- XP por aventura;
- moedas;
- replay de territórios já concluídos;
- perfil do jogador;
- passaporte;
- níveis futuros visíveis como bloqueados;
- banco de perguntas como fonte principal;
- OpenAI como fallback quando necessário;
- categorias de conhecimento associadas a cada território;
- validação segura de respostas;
- conhecimento como núcleo da experiência.

### Pode mudar durante P1-P10

Somente a forma de apresentação e interação:
- mapa;
- HUD;
- personagem;
- câmera;
- ambiente;
- combate;
- animações;
- feedback visual;
- áudio;
- forma como as perguntas entram na exploração e na batalha.

### Não alterar sem aprovação explícita

- economia de moedas;
- fórmula de XP;
- número de níveis;
- número de territórios;
- regra de desbloqueio;
- exigência pedagógica das perguntas;
- criação de ranking competitivo;
- streaks persistentes;
- estrelas;
- colecionáveis;
- skins;
- missões secundárias;
- daily rewards;
- monetização;
- qualquer mecânica de retenção baseada em pressão, FOMO ou compra.

Essas evoluções só serão avaliadas depois da homologação do vertical slice.

## 13. Estratégia de migração

1. congelar o estado atual em main;
2. desenvolver a nova experiência em develop;
3. preservar APIs e dados existentes;
4. criar nova camada game sem quebrar question bank;
5. substituir gradualmente Battle/Map antigos;
6. manter feature flags temporárias quando necessário;
7. só remover código legado após homologação.

## 14. Definition of Done P0

P0 está aprovada quando:
- arquitetura estiver documentada;
- vertical slice Brasil estiver definido;
- responsabilidades DOM x 3D x backend estiverem claras;
- roadmap P1-P11 estiver criado;
- cada fase tiver modelo e esforço definidos;
- Gamification Preservation Contract estiver registrado;
- nenhuma implementação 3D nova tiver sido iniciada antes da aprovação.

## 15. Regra de execução

Astra deve ser usado onde houver decisões arquiteturais, game loop, física, câmera, renderização, performance ou refatoração transversal.

Sol deve ser usado em UI, HUD, componentes de produto, testes, documentação e implementações bem delimitadas.

Astra não deve ser usado para ajustes cosméticos simples.
