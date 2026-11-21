# TerraVox | Revisão de arte da Mata Atlântica

A revisão anterior, cd22ba2, foi rejeitada na avaliação artística. Esta candidata aproxima a câmera, recompõe o caminho e introduz uma cartógrafa original com rosto texturizado, trança, bússola e manto bordado. O beija-luz possui corpo, bico, cauda e penas de voo modelados. O cenário combina troncos e obstáculos em 3D, folhagem recortada distribuída em superfícies curvas e pintura fixa de mata distante. A mesma cena atende navegador e pacote Windows.

## Origem e reprodução

As malhas, o rig, a animação e o posicionamento são produzidos por art/igarape/build.py. As texturas botânicas, de materiais, do rosto, do tecido e a mata distante foram geradas para TerraVox. Os insumos do exportador estão em art/igarape. Os mapas usados diretamente pelo cliente estão em public/assets/forest-v2. Os materiais de referência do usuário serviram à avaliação visual.

Na raiz, executar Blender em modo background com `blender -b -P art/igarape/build.py`. Regerar a sombra do solo com `python art/igarape/soil.py`. A compilação da aplicação usa `npm run build`.

## Evidências e limites

[Entrada](entrada.jpg) · [Portal](portal.jpg) · [Medição local](medicao.json)

A captura de gameplay percorreu o mapa, a pausa, a trilha, a ativação, o reinício, a restauração de contexto WebGL e o retorno ao mapa. Chromium com SwiftShader, 1280 × 720 e gravação ativa. O perfil de referência com GPU física segue pendente. A arte ativa totaliza aproximadamente 10,55 MiB, acima do orçamento inicial proposto de 8 MiB. A avaliação artística segue aberta, em especial para a naturalidade da locomoção e da iluminação na personagem.
