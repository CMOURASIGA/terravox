# TerraVox | OS-TVX-001 | Floresta do Brasil

Base de auditoria: develop, build de referência #88, commit 21b722a. Escopo de homologação: entrar pelo mapa, percorrer uma região de aproximadamente 31 metros até o portal, descobrir e ativar a passagem. A atividade termina com retorno livre ao mapa, sem alterar XP ou moedas.

## Diagnóstico da base

| Componente | Constatação | Tratamento na candidata |
|---|---|---|
| Forest3D | A seleção dependia de sondagens HTTP. Três contratos GLB estavam sem arquivo. O jogador via o cenário alternativo, com vegetação clonada, personagem geométrico e cenário plano no corredor. | Cena autoral como entrada padrão. A cena clássica continua acessível pelo parâmetro floresta=classica. A cena nova carrega quatro modelos locais e o mapa de cor do terreno. |
| ForestCinematicAssets | O cavaleiro de terceiros tinha rig, mas o fluxo de produção não chegava ao ramo cinematográfico. A corrida selecionava a caminhada. A ausência de espírito ou portal inviabilizava o conjunto. | Cartógrafa Iara, esqueleto, clipes, beija-luz com batimento de asas, portal de cantaria e ambiente com pigmentos. Mistura dos clipes controlada por movimento, corrida e interação. |
| Arena3DPreview | O estado de descoberta era marcado por distância. O callback de interação estava vazio. Os limites do mapa eram retangulares e não representavam obstáculos. | Descoberta por distância, ativação por tecla E ou botão. Colisão com árvores, rochas e pilares, amostragem do relevo e encurtamento da câmera. Perfil de renderização e medidor na pausa. |

Inventário comparativo: [modelos, texturas, materiais, clipes e procedência](inventario.md). Evidência da base: [captura](base-21b722a.jpg) e [medição](base-21b722a.json). No teste local a base registrou 1.132 chamadas por quadro na mediana, 2,81 FPS em SwiftShader e 50,4 MB de heap JavaScript estimado. A amostra da base contém nove quadros com desenho. Heap JavaScript exclui memória de vídeo. Comparações de FPS exigem repetir o mesmo percurso, método e aparelho.

## Produção e integração

A personagem é uma cartógrafa de chapéu com pluma, capa curta em ocre e bolsa de campo. A silhueta do beija-luz se distingue pelas asas longas, corpo turquesa e bico dourado. A arquitetura do portal usa segmentos de pedra e incrustações de ouro. O cenário reúne sapopemas, bromélias, cipós e copas floridas. São candidatos à revisão de arte.

1. Na raiz do repositório, executar `python art/igarape/folhagem.py` com Pillow. Com Blender 4.3, executar `blender -b -P art/igarape/build.py`. O gerador cria os quatro GLBs e exporta as posições de colisão da mesma cena. Executar `python art/igarape/soil.py` com NumPy e Pillow para gravar a textura de solo e a sombra de copa.
2. Trabalhar em metros, com +Z para cima no Blender. O exportador converte para +Y no glTF. Origem dos personagens nos pés, portal na base, terreno em coordenadas de mundo. A origem do espírito no corpo permite a oscilação de voo.
3. Usar os nomes Idle, Walking, Run, Turn e Interact, pesos do esqueleto normalizados e clipes sem deslocamento horizontal da raiz. A velocidade no mundo pertence ao controlador. O giro durante a navegação usa orientação amortecida. O clipe Turn está disponível para a próxima revisão de animação.
4. Manter texturas das folhas dentro do GLB e o atlas do solo em WebP local. A iluminação do terreno combina sombra pré-calculada com luz hemisférica e direcional. Luz do portal é um shader local. O perfil econômico reduz as dimensões internas do canvas a 75%.
5. Rodar `node scripts/validate-forest-v2-assets.mjs`, `npm run lint`, `npm run build`, `node scripts/smoke-local-build.mjs`. No Windows, o fluxo de CI também inicia o servidor do pacote e verifica os GLBs por HTTP.
6. Para medir a distribuição compilada, instalar Playwright para Python e seu Chromium. Executar `python scripts/test-forest-browser.py dist evidencias 1280 720`. Repetir com 1920 1080. TVX_VIDEO=1 habilita gravação. O relatório devolve tamanho real do canvas, renderer, FPS, P95, draw calls, heap e tempo da entrada aos quatro primeiros quadros desenhados. O teste de navegador bloqueia tráfego externo e força perda e restauração do contexto.

## Orçamento e protocolo de aceite propostos

| Indicador | Básico | Recomendado | Como aceitar |
|---|---|---|---|
| Hardware de referência proposto | Windows 11, i5-1135G7, Iris Xe, 8 GB | Windows 11, Ryzen 5 5600, GTX 1660, 16 GB | Registrar CPU, GPU, RAM, driver e navegador efetivos |
| Resolução da janela | 1280 × 720 | 1920 × 1080 | Registrar também resolução interna e escala |
| FPS e estabilidade | ≥30 FPS, P95 ≤40 ms | ≥60 FPS, P95 ≤20 ms | Três travessias de 60 s após aquecimento, sem captura de vídeo na medição de referência |
| Carregamento proposto | ≤8 s a 25 Mbps | ≤4 s a 100 Mbps | Cache frio, clique até quatro quadros, três repetições |
| Geometria e submissão | ≤200 mil triângulos, ≤50 chamadas no corredor | Mesmo teto inicial | Capturar pior enquadramento, entrada, curva e portal |
| Conteúdo ativo | Até 8 MiB para arte da região e textura máxima de 2048 px | Mesmo teto inicial | Conferir tamanhos e recursos efetivamente carregados |
| Memória | Medir heap, texturas, geometrias e crescimento após cinco reinícios | Mesmo protocolo | Registrar VRAM quando o driver disponibilizar |

O equipamento de execução automatizada usa SwiftShader, um renderizador por software. A decisão sobre desempenho nos dois perfis físicos depende de medição nesses computadores. Vídeo e capturas servem à avaliação de escala, pose, silhueta, repetição, legibilidade do caminho e resposta da passagem.

## Sequência de homologação

| Lote | Dependência | Evidência e decisão |
|---|---|---|
| D0, base | Build #88 | Inventário, captura, medição e lacunas identificadas |
| D1, identidade | D0 | Revisar proporções de Iara, silhueta do beija-luz e paleta ao sol e na sombra |
| D2, floresta | D1 | Caminhar pela trilha e pelas laterais, revisar repetição de copas, integração das raízes e variação de relevo |
| D3, personagem | D1 e D2 | Vídeo frontal, lateral e de costas, caminhada e corrida, confirmar contato dos pés, giro e obstrução de câmera |
| D4, magia | D2 e D3 | Descoberta, ativação, mudança da passagem e reação do acompanhante |
| D5, vertical slice | D1 a D4 | Aprovação visual de Christian, testes de navegador e Windows, metas em hardware de referência |
| D6, experiência completa | D5 aprovado | Objetivos, progressão, salvamento, áudio e acessibilidade homologados |
| D7, candidata a release | D6 | Matriz de compatibilidade, correções e validação final do pacote |

Estimativa para a próxima rodada: artista/animador 3 a 5 dias para revisar personagem e copas após feedback; gameplay/renderização 2 a 4 dias para contato dos pés e oclusão; QA 1 a 2 dias com os dois equipamentos. São estimativas de esforço, condicionadas aos apontamentos de arte e acesso ao hardware. Sem a aprovação de D5, manter a produção nesta única região.

## Backlog refinado

| Épico | Histórias e dependências principais | Evidência para fechar |
|---|---|---|
| E01, P0 | 001 concept, 002 guia após 001, 003 convenções, 004 validação e origem após 003 | Referências visuais aprovadas e todos os ativos rastreados |
| E02, P0 | 005 modelo após 001, 006 rig após 005, 007 clipes após 006, 008 transições após 007 | Anatomia, contatos e silhueta aprovados durante o movimento |
| E03 | 009 relevo, 010 biblioteca após 002, 011 materiais após 010, 012 pontos de interesse P1 após 009 e 011 | Travessia e revisão lateral da composição |
| E04, P0 | 013 locomoção após 009, 014 colisão após 010, 015 câmera após 013 e 014, 016 controles por clique e teclado após 013 | Percurso completo e teste contra obstáculos em ambos os sentidos |
| E05, P0 | 017 luz e atmosfera após 002, 018 sombras após 009, 019 partículas após 017, 020 efeitos e custo após 018 e 019 | Comparação de imagem e captura de desempenho |
| E06, P0 | 021 espírito após 001, 022 animação após 021, 023 seguir e reagir após 022 e 013 | Vídeo com personagem parado, andando e na passagem |
| E07, P0 | 024 portal após 002, 025 aproximação e estados após 024, 026 ativação e resposta após 025 e 023 | Descobrir, ativar, sair e reiniciar |
| E08, P1 | 027 objetivos após D5, 028 progressão após 027, 029 salvamento após 028 | Sair, retomar e concluir sem duplicidade de recompensa |
| E09, P1 | 030 HUD, 031 pausa e controles, 032 acessibilidade após 030 e 031 | Teclado, foco, contraste, redimensionamento e controle tátil |
| E10, P1 | 033 paisagem sonora após D2, 034 sons de ação e volume após D4 | Áudio espacial, mudo e persistência de volume |
| E11, P0 | 035 orçamento após D0, 036 perfis após 035, 037 compatibilidade após 036 | FPS, memória, carregamento e estabilidade por aparelho |
| E12, P0 | 038 CI, 039 pacote Windows após 038, 040 regressão e evidência por SHA após 039 | Build identificada, vídeo real, ZIP e inicialização offline |

Riscos em aberto: repetição das copas e simplicidade do figurino frente à direção cinematográfica, precisão de colisores circulares em rochas largas, oclusão por copas baixas, medição sem GPU física e documentação de procedência das imagens 2D herdadas. A aprovação do estilo, da anatomia e da naturalidade da animação cabe à direção artística. O histórico de homologação deve registrar o SHA, a resposta e os apontamentos de cada revisão.

## Resultados da candidata em Chromium local

| Janela | Canvas 3D | FPS médio | P95 em ms | Chamadas medianas | Heap JS em MB | Entrada em s | Quadros do percurso |
|---|---|---:|---:|---:|---:|---:|---:|
| 1280 × 720 | 1280 × 601 | 4.68 | 316.7 | 17 | 21.7 | 2.49 | 23 |
| 1920 × 1080 | 1920 × 961 | 2.38 | 566.7 | 17 | 27.6 | 1.66 | 17 |

Renderer SwiftShader. Uma execução por resolução, sem gravação de vídeo, pelo mapa e com tráfego externo do navegador bloqueado. A média é exploratória e ficou abaixo das duas metas. Os valores em MB referem-se exclusivamente ao heap JS estimado. A entrada é medida até os primeiros quatro quadros com desenho. A carga de UI reduz a altura disponível do canvas.

[Entrada da trilha](entrada.jpg) · [Portal após ativação](portal.jpg) · [Medição 720](perfil-720.json) · [Medição 1080](perfil-1080.json)
