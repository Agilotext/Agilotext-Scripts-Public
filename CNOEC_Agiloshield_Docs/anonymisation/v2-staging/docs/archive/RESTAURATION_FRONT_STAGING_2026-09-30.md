# Restauration V2 — interface de préparation

L'onglet « Restauration » accepte localement un fichier TXT, CSV, DOCX, XLSX ou PPTX pseudonymisé et une clé `.properties`. Il affiche leurs noms et tailles, permet de les retirer et n'en lit pas le contenu. Les sélections restent en mémoire de la page, disparaissent au rechargement ou au changement de compte, et ne sont jamais envoyées à Java dans cette version.

**Capacité non raccordée :** la façade Java de recette n'expose pas encore la restauration V2. « Restaurer le fichier » reste désactivé sans exception de configuration ou d'URL. Aucun statut de restitution ni fichier restauré n'est simulé. Le PDF ne figure pas dans le sélecteur : sa clé ne reconstruit pas le document masqué ; la récupération de l'original conservé serait un parcours distinct à faire exposer par Java.

Pour raccorder ensuite la fonction, Nicolas devra confirmer une capacité et un contrat Java authentifié qui transmettent le fichier et la clé à la restauration Python, contrôlent le propriétaire et renvoient les erreurs et le fichier sensible. Le front ne doit activer l'action qu'après un test réel de cette route. Une restauration de fichier édité n'est pas certifiée identique à l'original.

Contrôles locaux : rendu des onglets et des listes à 1440, 768 et 390 px ; sélection et retrait de fichiers synthétiques ; changement d'onglet ; action désactivée ; aucun appel API supplémentaire lors des sélections ; dépôt synthétique READY après retour à « Traitement de fichier » ; navigation clavier entre onglets ; tests client/auth/listes et console navigateur sans erreur. Le rendu sur la page Webflow authentifiée n'est pas validé tant que cette session redirige vers « Accès limité ».
