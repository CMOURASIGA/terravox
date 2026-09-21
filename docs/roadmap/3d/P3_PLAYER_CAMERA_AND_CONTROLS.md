# P3 - PLAYER, CAMERA & CONTROLS

Modelo: GPT-6 Astra
Esforço: HIGH

## Objetivo
Transformar o personagem atual feito com primitivas em um controller reutilizável.

## Escopo
- PlayerController;
- movement vector;
- acceleration/deceleration;
- facing direction;
- animation state machine;
- idle/walk/run/hit/attack/victory;
- collision contract;
- camera follow;
- camera bounds;
- pointer/touch input;
- joystick virtual;
- keyboard;
- interaction radius.

## Requisitos
- input desacoplado do personagem;
- câmera sem jitter;
- movimento independente do frame rate;
- controles desktop e touch com mesma regra de gameplay;
- animações substituíveis sem alterar regras.

## Human Validation
O jogador deve conseguir circular por uma arena de teste por 3 minutos em desktop e mobile sem perder controle da câmera ou personagem.
