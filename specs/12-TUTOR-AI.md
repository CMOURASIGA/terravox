# SPEC 12 — Tutor & Explanations

## Objetivo
Transformar erros em aprendizagem sem interromper o ritmo do jogo.

## Implementar
- ExplanationService separado do gerador de perguntas.
- Explicação curta pós-resposta, com opção de “entender melhor”.
- Explicações adaptadas à dificuldade e ao contexto da missão.
- Nunca alterar retroativamente a resposta correta definida para a questão.
- Fallback para `question.explanation` existente.
- Controle de tamanho/latência/custo.
- Linguagem clara, pedagógica e adequada ao público.

## Critérios de aceite
- Toda questão pode oferecer explicação mesmo sem chamada adicional de IA.
- IA premium é opcional para aprofundamento.
- Falha do tutor não bloqueia próximo turno.

## Checkpoint
Entregar `TUTOR AI READY` e aguardar validação.
