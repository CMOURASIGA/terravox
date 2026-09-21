# TERRAVOX 3D - EXECUTION MATRIX

## Estratégia de modelos

| SPEC | Entrega | Modelo | Esforço |
|---|---|---|---|
| P0 | Vision & Architecture | GPT-6 Astra | HIGH |
| P1 | 3D Foundation & Game Shell | GPT-6 Astra | HIGH |
| P2 | Art Direction & Asset Pipeline | GPT-5.6 Sol | MEDIUM |
| P3 | Player, Camera & Controls | GPT-6 Astra | HIGH |
| P4 | World Map & Territory Entry | GPT-6 Astra | MEDIUM |
| P5 | Brazil Vertical Slice World | GPT-6 Astra | HIGH |
| P6 | Combat, Guardian & Knowledge | GPT-6 Astra | HIGH |
| P7 | HUD, Menus, Progression & Passport | GPT-5.6 Sol | MEDIUM |
| P8 | VFX, Audio & Game Feel | GPT-5.6 Sol | HIGH |
| P9 | Performance & Device Quality | GPT-6 Astra | MEDIUM |
| P10 | QA, Release & Human Validation | GPT-5.6 Sol | MEDIUM |
| P11 | Gamification Preservation & Expansion Review | GPT-5.6 Sol | MEDIUM |

## Uso racional da franquia Plus

Astra deve ficar concentrado em:
- decisões transversais;
- game architecture;
- câmera;
- input;
- state machines;
- 3D runtime;
- combate;
- WebGL performance.

Sol deve absorver:
- documentação;
- UI;
- HUD;
- telas;
- QA;
- gamification preservation review;
- testes;
- polish delimitado;
- acessibilidade.

## Níveis de esforço

LOW
- alteração localizada;
- pouco contexto;
- sem decisão arquitetural.

MEDIUM
- múltiplos arquivos;
- integração conhecida;
- requer validação e testes.

HIGH
- arquitetura;
- refatoração transversal;
- sistemas 3D;
- comportamento emergente;
- investigação de bugs complexos.

## Política

Não usar Astra HIGH para correções cosméticas, copy, espaçamento, labels ou componentes triviais.

Se uma execução Sol identificar blocker arquitetural, parar e escalar o problema específico para Astra em vez de reconstruir a feature inteira.
