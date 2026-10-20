# SPEC 08 — Progression & Local Persistence

## Objetivo
Impedir perda de progresso no refresh sem exigir backend pago.

## Implementar
- Repository interface para PlayerProfile/Progress.
- `LocalStorageProgressRepository` como implementação inicial.
- Versionamento/migração do save local.
- Persistir nome, XP, moedas, nível, territórios, missões, configurações e histórico mínimo de aprendizagem.
- Reset de progresso com confirmação.
- Tratar dados inválidos/corrompidos com recuperação segura.
- Preparar seam para futuro Supabase/IndexedDB/cloud sem acoplar UI.

## Critérios de aceite
- Refresh mantém progresso.
- Evolução de schema não invalida save anterior sem migração.
- UI não acessa localStorage diretamente.
- Sem Supabase obrigatório.

## Checkpoint
Entregar `LOCAL PROGRESSION READY` e aguardar validação.
