# Revue V2 staging — état vérifié le 30 septembre 2026

La page Webflow publiée charge encore les assets au commit `825eadc5b545db41ab7264f35af98ee17fc860e1`. Les nouveaux assets sont figés à `b7f1d5b768583d7b0426adc8368648c30f2b3237`. Le bloc complet est `WEBFLOW_STAGING_COPY_PASTE.html` ; le bloc précédent exact est sauvegardé dans `WEBFLOW_STAGING_ROLLBACK_825eadc5.html`. L'Embed réel est l'élément `cd349748-8e32-1395-ad94-d72dc9849d56` du composant Webflow `Anon_NEW_2026_GATED`, utilisé quatre fois. Le modifier dans Webflow changerait donc quatre pages de staging, pas seulement le dashboard Business. Ce document n'est pas une preuve de publication Webflow ni de qualification Java/Python. Le codeSha Python actif n'a pas pu être relu aujourd'hui : VPN/SSH de `kawansoft02` indisponible. La dernière valeur documentée pour l'API HTTP est `ea56a527ed2d0253`, **à revérifier avant publication**.

La façade Java examinée expose les dépôts, statuts, revue, commandes, révisions, régions, aperçus, résultat, téléchargement et clé de pseudonymisation. Elle ne route pas encore `/review/human-verification` ni `/human-verified`. Le moteur Python examiné possède ces routes et les champs `canApproveHumanVerification`, `humanVerificationBlockers` et `humanVerifiedDeliverable`. La candidate front n'affiche aucun bouton d'attestation tant que cette frontière n'est pas qualifiée. Une attestation éventuelle ne transforme jamais le statut technique en `READY`.

| Format | Aperçu original/résultat | Localisation exacte en revue | Décision interactive | Comparaison | Assurance téléchargeable |
| --- | --- | --- | --- | --- | --- |
| PDF | Oui, pages | Fragments fournis par Python, page/révision/géométrie vérifiées | KEEP/MASK et région liée | Oui | `READY` technique ; non vérifié explicitement marqué sinon |
| TXT | Oui, texte échappé | Original uniquement si `surfaceId`, révision, offsets et texte coïncident | KEEP/MASK par ID | Oui | Idem |
| CSV | Oui, 300 premières lignes ; source brute pour occurrence exacte | Source brute seulement si mêmes garanties que TXT ; pas de cellule visuelle certifiée | KEEP/MASK par ID | Oui, aperçu limité | Idem |
| DOCX | Oui, lecteur isolé, rendu indicatif | Pas d'ancrage visuel fiable | Non interactive | Oui, deux lecteurs isolés, rendu indicatif | Idem |
| XLSX | Pas d'aperçu visuel | Non | Non interactive | Non | Idem |
| PPTX | Pas d'aperçu visuel | Non | Non interactive | Non | Idem |

La clé `.properties` est proposée dans l'en-tête uniquement si le job est `READY`, en mode `PSEUDONYMIZE`, avec la capacité de téléchargement annoncée ; l'API revérifie statut, révision, digest et assurance avant livraison. Pour `REVIEW_REQUIRED`, le résultat éventuel reste marqué non vérifié et la clé n'est pas proposée.

Preuves locales : tests Node client/auth, fixtures synthétiques READY/REVIEW_REQUIRED, deux occurrences identiques, 370 occurrences groupées, tableau de 12 lignes, comparaison TXT/CSV/DOCX, et footer Webflow simulé avec `.main-wrapper` et `.footer-anon`. Ces fixtures ne prouvent ni l'identité des fichiers traités par Python ni le parcours Webflow publié. Les captures et tests manuels sur la page authentifiée devront être refaits avec le nouveau pin à 1440, 768 et 390 px avant le verdict visuel final. L'aperçu Word doit être comparé avec le fichier final ouvert dans Word pour tout doute de pagination.

Le prochain raccordement d'attestation par Nicolas doit vérifier le propriétaire issu de la session, les six contrôles humains exigés par Python, la révision, la politique, l'artefact et l'absence de cache ; il doit exposer un téléchargement distinct `HUMAN_VERIFIED`. Il ne doit pas recycler `/download` ni réécrire le statut `REVIEW_REQUIRED` en `READY`.
