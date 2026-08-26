# Codes erreur backend — jobs audio

Source historique : API v4.0.41.  
Codes sauvegardes (v7.0.15/16) : [api-ref/API_V7_0_16_2026-08-25.md](api-ref/API_V7_0_16_2026-08-25.md).

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
| `error_invalid_saved_transcript_index` | Index backup transcript hors 0-9 | KO `displaySavedTranscript` |
| `error_saved_transcript_not_found` | Slot transcript demandé absent | KO `displaySavedTranscript` |
| `error_invalid_saved_summary_index` | Index backup CR hors 0-9 | KO `displaySavedSummary` |
| `error_saved_summary_not_found` | Couple transcript + CR public absent | KO `displaySavedSummary` |
| `error_text_format_not_supported` | Format de sortie non supporté | KO displaySaved* |

## Règles front

1. **Ne jamais** afficher « Fichier archivé » pour `error_duration_is_too_long`.
2. **`promptid = -1`** → préférer « Compte rendu non demandé », pas une erreur.
3. **`error_summary_transcript_file_not_exists` + `promptid ≠ -1`** → traiter comme archive/purge (bandaid en attendant delete SQL backend).
4. **`READY_SUMMARY_READY` + `receiveSummary` KO le même code** (souvent `gpt.summary-state=STALE`, têtes de liste 26/08) : le statut ment. Filet dashboard `2.2.3-summary-guard`. Brief : [2026-08-26-ready-summary-stale.md](../03_BUGS_ET_FIXES/2026-08-26-ready-summary-stale.md).
5. Formatter central : [`scripts/shared/agilo-api-error-format.js`](../../../scripts/shared/agilo-api-error-format.js) v1.08+
