# Codes erreur backend — jobs audio

Source : API v4.0.41 (appendix + tables « Possible errors »).

## Codes liés aux fichiers / rétention

| Code (`javaException` ou KO API) | Signification | UI front actuelle |
|----------------------------------|---------------|-------------------|
| `error_summary_transcript_file_not_exists` | Fichier résumé absent — **ambigu** : CR non demandé OU purge | ❌ rouge / « Non demandé » (incorrect si purge) |
| `error_transcript_file_not_exists` | Transcript supprimé du système | Erreur téléchargement |
| `error_audio_file_not_found` | Audio absent | Erreur téléchargement audio |
| `error_summary_file_not_exists` | Fichier summary absent | KO `receiveSummary` |
| `error_summary_not_ready` | CR pas encore prêt | Patience / verrou |
| `error_job_not_exists` | Job inconnu | KO API |
| `error_job_has_no_transcript_files` | Job sans fichiers transcript | KO API |

## Codes erreur métier (pas rétention)

| Code | Contexte | Message UI |
|------|----------|------------|
| `error_duration_is_too_long` | Free, audio >40 min + `READY_SUMMARY_ON_ERROR` | Vraie erreur — garder ❌ rouge |
| `error_duration_is_too_long_for_summary` | Limite CR | Erreur CR |
| `error_too_many_languages_code` | Multi-langues | Erreur transcription |
| `error_invalid_jobid` | Job ID invalide | KO API |

## Règles front

1. **Ne jamais** afficher « Fichier archivé » pour `error_duration_is_too_long`.
2. **`promptid = -1`** → préférer « Compte rendu non demandé », pas une erreur.
3. **`error_summary_transcript_file_not_exists` + `promptid ≠ -1`** → traiter comme archive/purge (bandaid en attendant delete SQL backend).
4. Formatter central : [`scripts/shared/agilo-api-error-format.js`](../../../scripts/shared/agilo-api-error-format.js) v1.08+
