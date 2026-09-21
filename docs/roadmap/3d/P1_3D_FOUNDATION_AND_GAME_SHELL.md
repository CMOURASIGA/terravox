# P1 - 3D FOUNDATION & GAME SHELL

Modelo: GPT-6 Astra
Esforço: HIGH

## Objetivo
Criar a fundação definitiva do runtime 3D sem ainda construir o mundo Brasil completo.

## Escopo
- reorganizar Arena3D em arquitetura de game;
- criar GameCanvas e GameWorld;
- separar render, estado e regras;
- game state central;
- loading boundary;
- error boundary;
- asset loader;
- camera rig base;
- input abstraction desktop/touch;
- scene lifecycle;
- feature flag para experiência 3D;
- manter fluxo atual funcional durante a migração.

## Não fazer
- mundo Brasil final;
- personagem final;
- combate final;
- 40 territórios.

## Critérios
- build e typecheck verdes;
- canvas monta/desmonta sem leaks;
- resize correto;
- mobile não quebra;
- rotas/telas existentes continuam disponíveis;
- nenhum segredo client-side.

## Human Validation
Abrir desktop e celular, entrar no jogo, navegar para a cena 3D, voltar e repetir o fluxo sem tela preta, travamento ou perda de estado.
