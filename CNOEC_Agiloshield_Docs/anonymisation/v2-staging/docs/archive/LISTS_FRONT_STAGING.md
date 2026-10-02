# Inclusion / exclusion — front V2 staging préparé, non activé

La fenêtre Agilotext des listes est **désactivée par défaut**. Le bouton ne
s'active que si `FILE_LISTS_READY: true` est publié **et** si la réponse Java
`/preferences` annonce `capabilities.listDirectives: true` avec
`capabilities.workerCodeSha` égal à `FILE_WORKER_CODE_SHA`. Le drapeau Webflow
seul n'est donc pas une preuve d'intégration. Le worker par fichiers livré à
Nico n'est pas encore raccordé à cette façade ; l'ancien service HTTP reste
une empreinte distincte.

Quand l'intégration Java est prête et testée, la configuration de staging pourra
définir `FILE_LISTS_READY: true` et `FILE_WORKER_CODE_SHA` à l'empreinte
effectivement installée. Le navigateur enverra les tableaux JSON multipart
`anon2InclusionList` et `anon2ExclusionList` avec **chaque** fichier. Java
devra copier leur snapshot dans le `.options` privé du worker et relayer son
`listDigest` dans les réponses de création, statut et revue ainsi que dans
`X-Agiloshield-List-Digest` au téléchargement. Le front calcule le SHA-256
canonique des deux listes et refuse les réponses dont l'empreinte diverge.
Le `policyDigest` des 13 catégories demeure distinct. Aucun terme n'est
enregistré dans `sessionStorage` ; seuls les IDs de jobs et les digests y
figurent pour la reprise.

Le dépôt fige le mode, la politique et les listes **avant** l'envoi automatique.
La modification d'une fenêtre de réglages ne change pas les fichiers déjà
déposés. Les préférences du compte sont enregistrées uniquement dans la
fenêtre des 13 catégories, jamais pendant l'envoi de la file. Après acceptation
du job, les termes des listes sont supprimés de l'entrée de file en mémoire.
Une réponse de création perdue laisse « Envoi à vérifier » et ne provoque
aucun renvoi automatique. Java pourra annoncer
`capabilities.uploadIdempotency: true` après avoir associé le header
`X-Agiloshield-Upload-Id` à un unique job ; son CORS devra alors autoriser ce
header uniquement sur l'origine staging.

La fenêtre n'interprète aucune décision privacy. Une inclusion force un MASK
dans Python ; une exclusion en conflit devient `REVIEW_REQUIRED` sur
l'occurrence correspondante. Les corrections Office restent non interactives.
Le passage à `true` exige au minimum un vrai dépôt et un téléchargement via
Java, avec liste vide, inclusion, exclusion, deux occurrences identiques,
revue/révision et contrôle des artefacts. Un résultat Office en conflit reste
non interactif : il faut corriger les listes et déposer un nouveau job.
Consulter [AUTO_FLOW_STAGING_2026-09-29.md](AUTO_FLOW_STAGING_2026-09-29.md)
pour le contrat front et les gates de publication.
