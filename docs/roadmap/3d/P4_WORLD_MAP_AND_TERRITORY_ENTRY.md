# P4 - WORLD MAP & TERRITORY ENTRY

Modelo: GPT-6 Astra
Esforço: MEDIUM

## Objetivo
Substituir a seleção atual baseada em cards por uma experiência de mapa/Hub com presença de jogo, preservando os 10 níveis e 40 territórios.

## Escopo
- mapa interativo;
- níveis visíveis;
- estados locked/unlocked/completed;
- foco visual no nível atual;
- seleção de território;
- transição para território;
- retorno ao mapa;
- integração com progressão existente.

## Regra
Não carregar 40 cenas 3D simultaneamente. O mapa deve usar representação leve e carregar o território selecionado sob demanda.

## Critérios
- todos os 40 territórios representáveis;
- locked continua visível;
- progressão atual permanece correta;
- mapa funciona em touch.
