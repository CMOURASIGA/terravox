# TerraVox - Vertical slice 3D (Floresta do Brasil)

## Meta visual
Experiência autoral de aventura em terceira pessoa, com acabamento de jogo de fantasia contemporâneo. Referência de qualidade: Kena: Bridge of Spirits; não copiar personagens, cenários, marcas ou assets proprietários.

## Critério de aceite visual
O protótipo geométrico atual **não** é a referência aprovada. A próxima validação visual só deve ser oferecida quando existir um cenário 3D autoral com malhas, materiais e animações integrados, não apenas novas primitivas Three.js.

## Conteúdo mínimo da primeira vertical slice
1. Personagem original modelado e rigado, com animações idle, caminhada, corrida, virada e interação, transições suaves.
2. Terreno orgânico com relevo, caminho irregular, pedras, raízes, folhagem e variação de vegetação da floresta brasileira.
3. Portal integrado à arquitetura e ao terreno, com efeitos de ativação e resposta à proximidade.
4. Companheiro espiritual original com movimento e comportamento próprios.
5. Câmera terceira pessoa com acompanhamento amortecido, enquadramento e controle de oclusão.
6. Luz direcional, sombras, atmosfera e tratamento de cor consistentes.
7. Interação do Guardião sem perder navegação e sem conceder XP/moedas no laboratório.

## Contrato técnico de assets
- Formato: glTF 2.0 / GLB, materiais PBR, coordenadas em metros, origem na base do personagem/prop.
- Personagem: /public/assets/forest-v2/explorer.glb; clips idle, walk, run, interact.
- Ambiente: /public/assets/forest-v2/environment.glb.
- Portal: /public/assets/forest-v2/portal.glb.
- Espírito: /public/assets/forest-v2/spirit.glb.
- Texturas: compactadas e com níveis de detalhe conforme orçamento medido no navegador.
- Os caminhos são **contratos de entrega**, não arquivos existentes. Não publicar um novo laboratório com fallback low-poly como se fosse a nova direção artística.

## Gates
- Validar licença/proveniência dos assets, integridade dos GLB, rig/clips e orçamento de renderização.
- Testar controles, câmera, colisões, interação, mobile/desktop e persistência.
- Executar lint, build e smoke antes de publicar na homologação.
- Trabalhar em develop/preview; main somente com autorização explícita.

## Definição de pronto
Somente declarar 'nova experiência 3D disponível' quando os quatro assets estiverem presentes, carregarem corretamente no navegador e uma sessão jogável de ponta a ponta tiver sido verificada.
