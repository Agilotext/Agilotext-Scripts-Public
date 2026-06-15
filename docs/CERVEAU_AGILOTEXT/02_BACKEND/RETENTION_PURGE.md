# Rétention et purge

## Process backend

1. **`JobFilesDeletor`** — batch cron : supprime fichiers disque selon `lastModified` + rétention édition
2. **`cleanupOldJobs`** — appelé à la connexion (`once per session after login`) : purge jobs anciens
3. **`deleteJob`** — suppression manuelle : SQL + tous fichiers audio/texte

## Durées (à confirmer avec Nicolas — juin 2026)

| Plan | Audio (lecture code / produit) | Texte (souhait produit) |
|------|-------------------------------|-------------------------|
| FREE | 24 h | 7 j (proposé) |
| PRO | 14 j code / 30 j annoncé | 1 an (proposé) |
| Business/ENT | 30 j annoncé / 90 j code | illimité (proposé) |

**Statut :** durées prod **non confirmées** — question posée à Nicolas (mail 15/06/2026).

## Bug actuel (juin 2026)

- Purge supprime fichiers mais **la ligne SQL reste** → job visible dans `getJobsInfo` avec `READY_SUMMARY_ON_ERROR` + `error_summary_transcript_file_not_exists`
- Interface affiche ❌ rouge = « faux bug »

## Fix attendu (Nicolas — sans nouveau statut)

1. À la purge audio : **supprimer aussi l'enregistrement SQL** → job absent de la liste
2. **Conserver le texte** transcript (ne purger que l'audio)
3. Corriger `doSummary=false` → ne pas poser fausse erreur (cf. [doSummary-false.md](../03_BUGS_ET_FIXES/doSummary-false.md))
