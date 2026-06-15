# Incident — Rétention / faux bugs interface (juin 2026)

**Client :** Arminé Harutyunian (AXA Partners, Business)  
**Date :** 15/06/2026  
**Statut :** ouvert — fix backend prioritaire

## Symptômes

- Anciens jobs visibles dans « Mes transcriptions » avec ❌ rouge
- Clic sur État → message d'**erreur**, pas conservation/délai
- Compte rendu colonne « Indisponible » ou « Non demandé » (incorrect)
- Client perçoit un bug, pas une politique de rétention

## Cause racine

1. **Purge** : fichiers supprimés, **SQL conservé** → job encore dans `getJobsInfo`
2. **Design API** : `transcriptStatus` fusionné transcript + CR
3. **Collision** : `javaException = error_summary_transcript_file_not_exists` pour :
   - CR non demandé (`doSummary=false`, `promptid=-1`)
   - Fichiers purgés (rétention)

## Fix prioritaire (backend — Nicolas)

- `cleanupOldJobs` : delete SQL à la purge (pas de statut EXPIRED)
- Garder texte, purger audio seul
- Corriger `doSummary=false` ([spec avril 2026](../../spec-backend-doSummary-false-codex.md))

## Bandaid front (juin 2026)

| Fichier | Changement |
|---------|------------|
| `scripts/pages/dashboard/Code-mes-transcripts-logic.js` | `isExpiredJob`, `promptid=-1`, icônes neutres, messages |
| `scripts/pages/editor/Code-ed-header.js` | `isExpiredJob`, 30 j, garde `error_duration_is_too_long` |
| `scripts/shared/agilo-api-error-format.js` | v1.08 intercepte `error_summary_transcript_file_not_exists` |
| `scripts/pages/editor/Code-job-id.js` | Affichage Job # + copie |

## Mails

- Envoyé : `Clients/Arminé_Harutyunian/MAIL_NICOLAS_RETENTION_URGENCE_2026-06-15.md` (Message ID `19ecadf6d44b4b3e`)
- Réponse : `Clients/Arminé_Harutyunian/MAIL_REPONSE_NICOLAS_RETENTION_2026-06-15.md`

## Déploiement

Hash GitHub : `0de4923` (branche `1.09`) — voir [WEBFLOW_DEPLOIEMENT.md](../04_PROCESS/WEBFLOW_DEPLOIEMENT.md)
