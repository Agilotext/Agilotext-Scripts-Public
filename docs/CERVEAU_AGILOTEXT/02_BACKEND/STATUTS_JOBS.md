# Statuts jobs — `transcriptStatus`

Source : API v4.0.41 (`getTranscriptStatus`, `getJobsInfo`).

## 5 statuts officiels

| `transcriptStatus` | Signification |
|--------------------|---------------|
| `PENDING` | Transcription en cours |
| `ON_ERROR` | Échec transcription — détails dans `javaException` |
| `READY_SUMMARY_PENDING` | Transcription OK, compte rendu en cours |
| `READY_SUMMARY_READY` | Transcription + compte rendu OK |
| `READY_SUMMARY_ON_ERROR` | Transcription OK, compte rendu en échec — détails dans `javaException` |

**Pas de statut `EXPIRED`**, `READY` seul, ni `ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS` comme statut officiel.

## Champs `JobsInfoDto` (`getJobsInfo`)

| Champ | Rôle |
|-------|------|
| `transcriptStatus` | État fusionné transcription + compte rendu |
| `javaException` | Message technique (rempli si `ON_ERROR` ou souvent `READY_SUMMARY_ON_ERROR`) |
| `promptid` | Modèle CR utilisé ; **`-1` = pas de CR demandé** (`doSummary=false`) |
| `dtCreation` / `dtUpdate` | Dates job |

## Problème de design : champ fusionné

Un seul champ encode transcription **et** compte rendu. Le backend utilise parfois `javaException = error_summary_transcript_file_not_exists` pour deux cas différents :

| Situation | `transcriptStatus` | `javaException` | `promptid` |
|-----------|-------------------|-----------------|------------|
| CR jamais demandé | `READY_SUMMARY_ON_ERROR` | `error_summary_transcript_file_not_exists` | `-1` |
| Fichier purgé (rétention) | `READY_SUMMARY_ON_ERROR` | `error_summary_transcript_file_not_exists` | variable |
| CR échoué (vraie erreur) | `READY_SUMMARY_ON_ERROR` | autre code | ≥ 0 |
| Audio >40 min (free) | `READY_SUMMARY_ON_ERROR` | `error_duration_is_too_long` | ≥ 0 |
| Échec transcription | `ON_ERROR` | quelconque | variable |

**Fix backend durable :** supprimer le SQL à la purge → les jobs purgés disparaissent de la liste ; corriger `doSummary=false` pour ne plus poser une fausse erreur.
