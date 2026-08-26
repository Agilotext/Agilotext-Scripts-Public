# READY_SUMMARY_READY sans fichier CR (STALE / têtes de liste)

Date : 26 août 2026.  
Compte probe : `bauerwebpro@gmail.com`, édition `ent`.  
Filet front : `Code-mes-transcripts-logic-v2.js` `2.2.3-summary-guard` (branche `1.09`).  
Le filet masque le JSON. **Le contrat statut reste backend.**

## Brief Nicolas

Job pilote : **`1000038900`** (Discussion Webflow, 25/08).

1. Pourquoi `getTranscriptStatus` / `getJobsInfo` restent `READY_SUMMARY_READY` alors que `receiveSummary` KO `error_summary_transcript_file_not_exists` et `1000038900.gpt.summary-state.txt` = `STALE` ?
2. Après `updateTranscriptFile` (transcript édité 16:15 UTC, slot `txt.FLAT.SAVE.0`) : le statut doit-il redescendre ?
3. Donner `promptid` et `doSummary` de `1000038900`.
4. READY doit impliquer un fichier CR lisible, ou le statut doit refléter `STALE`.

`javaException` unitaire est **vide**. Message : « Le transcript est prêt. »

## Têtes de liste (pas un cas isolé)

| jobId | Titre | Statut API | Fichier CR dans meta ZIP | summary-state |
|-------|--------|------------|--------------------------|---------------|
| 1000038900 | Discussion Webflow | READY_SUMMARY_READY | aucun | `STALE` (5 octets) |
| 1000038772 | Ouverture de compte pro | READY_SUMMARY_READY | aucun | absent |
| 1000038674 | Préparation réunion banque | READY_SUMMARY_READY | aucun | absent |

Les trois : `javaException` vide, audio + transcript + confidence présents, **pas** de HTML/DOCX CR.  
8772 / 8674 : webhook 404 « please unsubscribe me! » (hors sujet CR).

Donc « les premiers » = jobs récents READY sans CR matérialisé, pas seulement « Non demandé » (`promptid=-1`).

## Front (déjà)

Clic `receiveSummary` KO → chip Indisponible. Embed Webflow : `script-mes_transcripts_ent`. Voir [`docs/webflow-embeds/mes-transcripts-summary-guard-2.2.3.md`](../../webflow-embeds/mes-transcripts-summary-guard-2.2.3.md).
