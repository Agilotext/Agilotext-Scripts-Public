# Matrice de tests — titres + dossiers (branche 1.05)

Exécuter dans l’ordre après déploiement des scripts (jsDelivr) et mise à jour Webflow.

## Pré-requis

- Éditeur : URL avec `?agilo_cdn_branch=1.05` (ou branche équivalente) pour charger les scripts GitHub de test.
- Compte avec token API valide.
- Vérifier systématiquement : **HTTP 200 ne suffit pas** — le corps JSON doit avoir `status === "OK"`.

| ID | Scénario | Critère de succès |
|----|----------|-------------------|
| T1 | `getJobsInfo` | `status === "OK"` et présence des champs attendus (`jobTitle`, `folderId`, `folderName` si exposés par l’API). |
| T2 | Renommage titre (liste Business ou éditeur) | Le libellé affiché change ; le fichier téléchargé reste cohérent avec le comportement produit (titre ≠ nom de fichier technique). |
| T3 | `getTranscriptFolders` | Barre dossiers : racine + liste + compteurs plausibles. |
| T4 | Filtre `folderId` | « Tous » vs « Racine » (`folderId=0`) vs dossier `> 0` : uniquement les jobs attendus. |
| T5 | `moveTranscriptToFolder` | Job change de dossier ; retour racine avec cible `folderId=0`. |
| T6 | `createTranscriptFolder` | Création OK ; doublon / caractères interdits rejetés avec message clair (cf. MODE_EMPLOI). |
| T7 | `deleteTranscriptFolder` | Si implémenté en UI : dossier non vide refusé. |
| T8 | PDF (chat) | Titre PDF = titre affiché du job actif (rail), pas `Transcript <id>` seul. |
| T9 | Régression | Anciens jobs sans dossier visibles dans « Racine » ou « Tous ». |

## Notes

- Si un endpoint retourne `status: "KO"` avec HTTP 200, traiter comme **échec** (pas comme succès silencieux).
- En cas d’écart avec les noms de paramètres (`jobTitle` vs `title`, etc.), aligner sur la doc `https://api.agilotext.com/html/README.html` et ajuster le code.
