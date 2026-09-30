# AgiloShield V2 — raccordement du front à Java 12.0.3

## Références vérifiées

- Front de départ : arbre `9ecdbfc6a6fef63023831964c23998f3036a05f9`. L'Embed dans cet arbre pointe encore les scripts au commit `de34063f85e029e3aea486ef4d29b9618a6a25a6` ; ce fichier Git n'est pas une preuve de publication Webflow actuelle.
- Java examiné : branche [`12.0.3`](https://github.com/kawansoft/AgiloTextApi/tree/12.0.3), commit [`b278c7ce3f2d0b7669dd5cf5a3a8f2bf2fc4ed39`](https://github.com/kawansoft/AgiloTextApi/commit/b278c7ce3f2d0b7669dd5cf5a3a8f2bf2fc4ed39). `FullPython2Bridge` dépose bien des fichiers `.options`, vérifie `current.json`, l'artefact et la clé. `ApiAll` conserve les routes Anon2.
- Le code `12.0.3` consulté ne contient pas la façade HTTP V2 complète demandée par `agiloshield-v2-client.js`. La réponse actuelle de `/api/agiloshield-v2` en recette peut venir d'un bridge de recette antérieur ; elle ne prouve pas un trajet Java → worker par fichiers. Identifier sa classe et son déploiement avant de basculer le front.

## Écart bloquant démontré

`FullPython2Bridge.selectedTypes()` passe la sélection par `Anon2UserDefaultsUtil.normalizeAnon2OptionsJson()`. Cette méthode rejette `[]` et une seule catégorie (minimum deux). Elle reconstruit aussi les choix depuis `holder.getAnon2OptionsJson()` et le mode depuis `holder.isDoPseudoAnon()`. La façade V2 doit accepter le `protectionPolicy` et le `processingMode` **explicites du dépôt courant**, sans cette normalisation legacy ; les anciens clients gardent leur chemin inchangé.

Le front candidat exige maintenant à la création `jobId`, `protectionPolicy.digest`, `processingMode`, un statut reconnu et `listDigest` si des listes ont été envoyées. Pour télécharger, statut, assurance, révision et digests doivent concorder entre statut, revue et en-têtes de l'artefact. Une réponse incomplète échoue sans dépôt automatique supplémentaire. La pseudonymisation et les listes restent désactivées si `/preferences` n'annonce pas le `workerCodeSha` attendu et les capacités nécessaires ; le paramètre d'URL `pseudo` et le flag `PSEUDONYMIZE_READY` ne contournent plus cette preuve **dans cette candidate non publiée**.

## Contrat que Java doit vérifier sur son vrai runtime

Base navigateur : `https://apitest.agilotext.com/api/agiloshield-v2`. Authentification Agilotext par en-têtes utilisateur ; Java déduit le propriétaire/tenant. Aucun appel navigateur à `:8091` ou au dossier du worker.

| Action front | Méthode et route | Source ou opération worker attendue |
| --- | --- | --- |
| Préférences/capacités | `GET/POST /preferences` | Préférences du compte et capacités réellement installées, dont `workerCodeSha` |
| Dépôt | `POST /jobs` multipart | `.options` puis document par renommage atomique ; 13 choix dont `[]`, mode et listes du dépôt |
| Statut | `GET /jobs/{id}` | `current.json` du job possédé, révision, digests, assurance |
| Revue et problèmes | `GET /jobs/{id}/review` | `review.json` vérifié de la même révision |
| Rapport QA | `GET /jobs/{id}/report` | QA vérifiée de la même révision |
| Régions | `GET /jobs/{id}/regions` | Régions et fragments réellement liés aux occurrences |
| Aperçu | `GET /jobs/{id}/preview?kind=origin\|anon` | Original ou artefact courant autorisé, type MIME et absence de cache |
| Décision | `POST /jobs/{id}/review/commands` | Fichier de commande `KEEP`/`MASK` avec `commandId` et révision attendue |
| Région PDF liée | `POST /jobs/{id}/review/commands` | `ADD_MANUAL_REGION` lié à l'obligation et à la révision |
| Nouvelle révision | `POST /jobs/{id}/review/execute` | Application puis attente du nouveau `current.json`/QA |
| Résultat non vérifié | `GET /jobs/{id}/result` | Jamais présenté comme certifié |
| Téléchargement certifié | `GET /jobs/{id}/download` | Seulement `READY` + `technical-ready`, SHA-256 et révision courante |
| Clé de pseudonymisation | `GET /jobs/{id}/pseudonym-key` | Seulement mode `PSEUDONYMIZE`, `READY`, révision courante |
| Historique / ZIP | Routes configurées `/history/v2`, `/history/anon2`, `/history/v2/zip` | Ne les annoncer que si Java les expose réellement |

Les réponses binaires doivent porter `X-Agiloshield-Policy-Digest`, `X-Agiloshield-List-Digest` lorsqu'applicable, `X-Agiloshield-Revision`, `X-Agiloshield-Status` et `X-Agiloshield-Assurance`. La clé porte aussi `X-Agiloshield-Processing-Mode`. Le front compare ces valeurs à l'état courant avant d'accepter le téléchargement.

## Gate avant publication Webflow

Nicolas indique le commit Java déployé et la classe servant effectivement cette base URL. Tester avec deux comptes, puis `[]`, une catégorie, listes vides et non vides, anonymisation, pseudonymisation + clé, `READY`/`REVIEW_REQUIRED`/`FAILED`, aperçu, `KEEP`/`MASK`, région PDF liée, nouvelle révision et refus d'ancienne révision. Vérifier les six formats, les anciennes routes Anon2 et le CORS de l'origine Webflow staging. Les tests locaux du client ne remplacent pas ces preuves.

Cette branche front est une **candidate de préparation**. L'Embed publié, Python `:8091`, Java, le worker et le live ne sont pas modifiés ici. Après la gate Java, mettre à jour le `FILE_WORKER_CODE_SHA` avec l'empreinte observée, épingler tous les assets à un nouveau commit CDN, tester dans Webflow authentifié, puis conserver un rollback explicite.
