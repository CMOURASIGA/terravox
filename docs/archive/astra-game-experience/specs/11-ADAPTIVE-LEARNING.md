# SPEC 11 — Adaptive Learning Engine

## Objetivo
Fazer dificuldade e conteúdo responderem ao desempenho do jogador.

## Implementar
- KnowledgeProfile local por domínio/tema.
- Registrar tentativas, acerto/erro, dificuldade, tempo de resposta e tópico, evitando dados desnecessários.
- Algoritmo determinístico baseline de dificuldade antes de depender de IA.
- IA pode recomendar dificuldade/tópico, mas engine valida limites.
- Evitar repetição excessiva de perguntas.
- Revisão espaçada simples para pontos fracos.
- Separar progressão de game de avaliação de aprendizagem.

## Critérios de aceite
- Jogador com alto desempenho recebe progressão gradual de dificuldade.
- Erros recorrentes geram reforço sem punição infinita.
- Decisão de dificuldade é auditável/debugável.
- Funciona offline com algoritmo baseline.

## Checkpoint
Entregar `ADAPTIVE LEARNING READY` e aguardar validação.
