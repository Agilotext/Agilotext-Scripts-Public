# Mode d'emploi folders pour Florian

## Principe general

Le but des folders est simple :

- ranger les transcriptions sans changer le fonctionnement historique des jobs ;
- garder une racine simple pour tous les jobs non ranges ;
- permettre au front de naviguer vite entre racine et dossiers.

Le point cle a retenir est le suivant :

- un job sans dossier est a la racine ;
- la racine n'est pas un vrai dossier SQL ;
- il n'y a qu'un seul niveau de profondeur ;
- on ne touche pas a la table `job`.

## Modele mental

Le backend ajoute une couche d'organisation au-dessus des jobs existants :

- `transcript_folder` stocke les dossiers utilisateur ;
- `job_folder_link` stocke le rattachement `job -> folder`.

Donc :

- si un job a une ligne dans `job_folder_link`, il est dans un dossier ;
- s'il n'a pas de ligne, il est a la racine.

Pour le front, la regle pratique est :

- `folderId = 0` represente la racine ;
- `folderName = ""` represente la racine ;
- `folderId > 0` represente un vrai dossier.

## APIs a retenir

Pour implementer vite cote client, il faut surtout penser en 2 blocs :

### 1. Navigation folders

- `getTranscriptFolders`
  sert a recuperer la liste des dossiers et `rootJobsCount`.

Cette API sert a construire la navigation :

- racine ;
- liste des dossiers ;
- compteurs par dossier.

### 2. Listing des jobs

- `getJobsInfo`
  reste l'API principale de listing.

Elle accepte maintenant un `folderId` optionnel :

- absent = tous les jobs ;
- `0` = seulement les jobs a la racine ;
- `> 0` = seulement les jobs du dossier demande.

Chaque job renvoie aussi :

- `folderId`
- `folderName`

Donc le front peut :

- filtrer par dossier ;
- afficher le dossier associe a chaque job ;
- garder le meme modele de rendu qu'avant.

### 3. Actions folders

- `createTranscriptFolder`
- `renameTranscriptFolder`
- `deleteTranscriptFolder`
- `moveTranscriptToFolder`

Et il existe aussi :

- `getTranscriptFolderJobs`

Mais si le front utilise deja bien `getJobsInfo`, cette API n'est pas obligatoire pour la grille principale.

## Regles UI / UX a garder en tete

- La racine doit etre affichee comme un dossier logique special.
- Le front ne doit jamais attendre qu'un job ait forcement un vrai folder.
- Tous les anciens jobs doivent apparaitre naturellement a la racine.
- Un move vers `folderId = 0` signifie "remettre a la racine".
- Il n'y a pas de sous-dossiers, donc l'UI doit rester plate.

Le chemin simple cote client est :

1. charger `getTranscriptFolders` pour la navigation ;
2. charger `getJobsInfo(folderId=...)` pour la liste ;
3. utiliser `moveTranscriptToFolder` pour le rangement ;
4. utiliser create/rename/delete pour administrer les dossiers.

## Regles metier utiles

- Un nom de dossier est unique par utilisateur, en insensible a la casse.
- Un nom vide est interdit.
- Les caracteres `/` et `\\` sont interdits.
- La racine ne peut ni etre renommee ni supprimee.
- Un dossier non vide ne peut pas etre supprime.

Donc cote front :

- gerer proprement les erreurs metier de doublon ;
- gerer le refus de suppression d'un dossier non vide ;
- ne pas proposer de rename/delete sur la racine.

## Compatibilite

Le design a ete fait pour ne pas casser l'existant :

- `job` ne change pas ;
- les anciens jobs restent valides ;
- un client qui n'utilise pas encore les folders continue a fonctionner ;
- `getJobsInfo` sans `folderId` continue a retourner tous les jobs.

Autrement dit :

- les folders ajoutent du rangement ;
- ils ne changent pas la logique historique des transcriptions.

## Resume ultra court

- racine = `folderId=0`
- pas de ligne de lien = job a la racine
- pas de sous-dossiers
- `getTranscriptFolders` pour la navigation
- `getJobsInfo(folderId=...)` pour la grille
- `moveTranscriptToFolder` pour ranger
- compat totale avec les anciens jobs
