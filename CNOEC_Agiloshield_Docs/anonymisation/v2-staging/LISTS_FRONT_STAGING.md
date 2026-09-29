# Inclusion / exclusion — front V2 staging préparé, non activé

Cette branche ajoute la fenêtre Agilotext des listes à l'embed V2. Elle est
**désactivée par défaut** (`FILE_LISTS_READY` absent ou `false`) : la façade
Java de recette ne relaie pas encore le worker Python par fichiers avec ces
options. Rien ne change pour un dépôt V2 staging existant tant que Nicolas
n'a pas terminé et testé ce raccordement. Ne pas mettre le flag à `true` sur
Webflow avant le test d'intégration.

Quand l'intégration Java est prête, la configuration de staging pourra définir
`FILE_LISTS_READY: true`. Le navigateur enverra les tableaux JSON multipart
`anon2InclusionList` et `anon2ExclusionList` avec **chaque** fichier. Java
devra copier leur snapshot dans le `.options` privé du worker et relayer son
`listDigest` dans les réponses de création, statut et revue ainsi que dans
`X-Agiloshield-List-Digest` au téléchargement. Le front calcule le SHA-256
canonique des deux listes et refuse les réponses dont l'empreinte diverge.
Le `policyDigest` des 13 catégories demeure distinct. Aucun terme n'est
enregistré dans `sessionStorage` ; seuls les IDs de jobs et les digests y
figurent pour la reprise.

La fenêtre n'interprète aucune décision privacy. Une inclusion force un MASK
dans Python ; une exclusion en conflit devient `REVIEW_REQUIRED` sur
l'occurrence correspondante. Les corrections Office restent non interactives.
Le passage à `true` exige au minimum un vrai dépôt et un téléchargement via
Java, avec liste vide, inclusion, exclusion et deux occurrences identiques.
Cette branche ne modifie ni l'Embed Webflow publié ni son pin jsDelivr.
