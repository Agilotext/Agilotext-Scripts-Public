# Guide Nicolas — Dupliquer un job vers un autre compte (P1 JCQ)

**Date :** 10 septembre 2026  
**Client déclencheur :** EHPAD Jonquières, 3 sièges Business isolés (pas de team Memberstack).  
**Appel :** Karine, 10/09/2026 : mettre le CR dans **l’historique** de la collègue, pas seulement un export Word.  
**Backlog :** [`../../CERVEAU_AGILOTEXT/02_BACKEND/BACKLOG_PARTAGE_JOB_JCQ_2026-09-10.md`](../../CERVEAU_AGILOTEXT/02_BACKEND/BACKLOG_PARTAGE_JOB_JCQ_2026-09-10.md)

**Ce n’est pas** `getSharedUrl` (lien public). **Ce n’est pas** l’orga P3.

---

## Endpoint

### `POST /api/v1/duplicateJobToUser`

`application/x-www-form-urlencoded`

| Name | Type | Valeur |
|------|------|--------|
| username | text | Email du propriétaire (celui qui envoie) |
| token | text | Token auth |
| edition | text | `free`, `pro`, `ent` |
| jobId | text | Job source |
| targetEmail | text | Email d’un compte Agilotext **existant** |

**Réponse OK**

```json
{
  "status": "OK",
  "sourceJobId": 1000040001,
  "newJobId": 1000040099,
  "targetEmail": "collegue@example.com",
  "audioCopied": false
}
```

**Comportement**

- Nouveau job sur `username` = `targetEmail` (transcript + CR sauvegardé).
- L’owner d’origine **conserve** le sien.
- Audio copié **seulement si** le fichier est encore sur disque. Sinon `audioCopied: false`, texte/CR quand même. Ne pas inventer un mp3.
- Audit log obligatoire : qui a copié quoi vers qui, quand, `sourceJobId`, `newJobId`.

**Erreurs**

| Code | Quand |
|------|--------|
| `error_invalid_jobid` | job source absent ou pas au demandeur |
| `error_target_user_not_found` | aucun compte pour `targetEmail` |
| `error_target_same_user` | cible = owner |
| `error_transcript_not_ready` | job pas prêt |
| `error_duplicate_job_forbidden` | (option) hors même domaine / allowlist, si tu ajoutes un garde-fou |

**V1 :** cible = n’importe quel compte existant. Option plus tard : même domaine email, ou membership org.

**Santé / RGPD :** log d’audit. Pas de copie vers un email inconnu (créer un compte à la volée : hors V1).

---

## Recette

1. Deux comptes Business de test. Job READY_SUMMARY_READY sur A.
2. `duplicateJobToUser` A → B → job visible dans Mes fichiers de B.
3. Job A inchangé.
4. Audio expiré : copie texte/CR, `audioCopied: false`.
5. Email inconnu → `error_target_user_not_found`.
6. Email de A → `error_target_same_user`.

---

## Front déjà branché (Flo)

- Éditeur : bouton « Envoyer une copie vers… » dans `Code-ed-header.js` (modale email + toast).
- Mes transcripts : `agilo-job-share-actions.js`.

Si l’API n’est pas en prod : le front affiche « Fonction en cours de déploiement » sur 404.
