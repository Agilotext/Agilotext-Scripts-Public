# Bug — `doSummary=false` et fausse erreur

## Résumé

Quand l'utilisateur uploade **sans compte rendu**, le backend ne doit **pas** remonter `READY_SUMMARY_ON_ERROR` + `error_summary_transcript_file_not_exists`.

## Spec complète

→ [`docs/spec-backend-doSummary-false-codex.md`](../../spec-backend-doSummary-false-codex.md) (avril 2026)

## Discriminateur front

- `promptid = -1` dans `getJobsInfo` = pas de CR demandé
- UI : label « Non demandé », icône neutre (pas ❌ rouge)

## Collision avec rétention

Même `javaException` quand fichiers purgés → ambiguïté. Fix durable = delete SQL à la purge + fix doSummary backend.
