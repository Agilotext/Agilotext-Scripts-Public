# Intégration titres + dossiers (API prod Nicolas) — périmètre branche 1.05

Document de travail pour aligner le front (Webflow + scripts GitHub) et le mobile sur le **contrat réellement livré** en production (v2.0.59+, avril 2026), sans rouvrir le plan long terme V6.

## 1. Ce que Nicolas a mis en ligne (source de vérité)

| Sujet | Comportement attendu |
|--------|----------------------|
| **Titre affiché** | Champ distinct du nom de fichier technique : `jobTitle` côté données. |
| **Renommage “utilisateur”** | `renameTranscriptTitle` : change uniquement le titre affiché. |
| **Nom de fichier / export** | `renameTranscriptFile` : change le nom technique (fichier), à réserver aux besoins réels (téléchargement, cohérence fichier). |
| **Dossiers** | Arborescence **plate** ; racine logique `folderId = 0`. Navigation : `getTranscriptFolders` ; liste filtrée : `getJobsInfo` avec `folderId` ; déplacement : `moveTranscriptToFolder` ; CRUD dossiers (création, renommage, suppression selon doc API). |

Documentation et playgrounds hébergés côté API (accès souvent **401** sans session / token) :

- `https://api.agilotext.com/html/README.html`
- `https://api.agilotext.com/html/menu.html`
- `https://api.agilotext.com/html/rename_transcript_title.html`

## 2. Écart avec les anciens briefs internes (normal)

Les documents du type *displayTitle* + `PATCH /jobs/{jobId}` décrivaient une **autre forme de contrat**. Nicolas a livré une variante **plus simple et exploitable** : `jobTitle` + endpoint dédié `renameTranscriptTitle`. Ce n’est pas une rupture de vision produit, c’est un **écart de spec** : le front doit suivre **la doc Nicolas**, pas les anciens PDF seuls.

## 3. État du dépôt `Agilotext-Scripts-Public` (constat)

À la date de rédaction, une recherche sur `renameTranscriptTitle`, `getTranscriptFolders`, `jobTitle` dans les `*.js` du dépôt ne remonte **aucune** intégration encore : le chantier reste à faire.

Le loader éditeur pointe encore vers la branche **`@main`** sur jsDelivr (`scripts/pages/editor/editor-main.js`) : pour tester une branche GitHub sans ambiguïté, il faudra soit un paramètre de branche, soit une URL de test Webflow pointant vers `@1.05` (ou branche de feature).

## 4. Fichiers et zones à modifier (webapp)

### 4.1 Page Business « Mes transcriptions » (priorité haute)

La logique est en grande partie **inline dans Webflow** (script dans la page), pas seulement dans `scripts/pages/dashboard/*.js`.

- **Référence dans ce dépôt** : `webflow-exports/05_Business_Mes_transcripts_Agilotext.html` (copie depuis Téléchargements).
- **À faire** : afficher `jobTitle || filename` ; renommage utilisateur via `renameTranscriptTitle` ; conserver `filename` en info secondaire ou pour actions fichier ; charger `getTranscriptFolders` et filtrer avec `getJobsInfo(folderId=…)` ; actions déplacer / CRUD dossiers selon doc.

### 4.2 Scripts éditeur GitHub (`scripts/pages/editor/`)

| Fichier (indicatif) | Sujet |
|---------------------|--------|
| `Code-changement-audio.js` | Rail / titre : aujourd’hui dérivé de `filename` → basculer vers `jobTitle \|\| filename`. |
| `Code-chat.js` | PDF / exports : remplacer les titres génériques du type `Transcript <jobId>` par le titre affiché. |
| `orchestrator.js` / `Code-main-editor.js` | Propager `jobTitle`, `folderId`, `folderName` si exposés par `getJobsInfo` / contexte job. |
| `editor-main.js` | Stratégie de chargement CDN (branche de test vs prod). |

### 4.3 Dashboards upload ENT / Pro / Free (`scripts/pages/dashboard/ent.js`, `pro.js`, `free.js`)

- **MVP recommandé** : ne pas bloquer le chantier sur le choix du dossier à l’upload (flows fichier vs YouTube déjà différents). Ajouter le sélecteur de dossier en **phase 2** une fois la liste Business + éditeur stables.

## 5. Webflow — quoi faire dans le Designer

1. **Business — Mes transcriptions** : c’est la page où l’UX dossiers + titres doit être la plus aboutie (liste dense, sidebar existante, filtres).
2. **Exports “designer”** (`01_` à `04_` dans `webflow-exports/`) : utiles pour le **placement** des blocs et les IDs ; la **vérité comportementale** reste les scripts GitHub + le JS inline de la page publiée.
3. Prévoir une zone sidebar (ou section repliable) pour **Dossiers** : racine, liste, compteurs, couleurs discrètes, action « Nouveau dossier » ; dans la grille, préférer une **chip** sous le titre plutôt qu’une colonne « Dossier » pleine largeur.

## 6. Application mobile (`AgilotextMobile`)

Deux implémentations parallèles : `src/` et `mobile-v2/`. **Arbitrage obligatoire** avant développement : une seule cible canonique pour la v1 de ce chantier.

| Zone | Action |
|------|--------|
| `src/services/api.ts` et `mobile-v2/src/services/api.ts` | Mapper `jobTitle`, `folderId`, `folderName` dans le modèle renvoyé par `getJobsInfo` ; ajouter appels `getTranscriptFolders`, `renameTranscriptTitle`, `moveTranscriptToFolder`, CRUD dossiers. Remplacer le titre dérivé de `filename` (lignes ~943–944 dans `src`, mapping équivalent dans `mobile-v2`) par un helper `getJobDisplayTitle(job)`. |
| `renameTranscriptFile` | Réserver au renommage **fichier** ; UI « titre affiché » → `renameTranscriptTitle`. |
| `src/screens/JobsListScreen.tsx` (+ variante v2) | Filtres dossiers (chips ou bottom sheet), pas de sidebar type desktop. |
| Hors ligne | Lecture cache possible en MVP ; création / déplacement / renommage dossiers **online-only** au début. |

## 7. Git — branche `1.05`

- Base recommandée : **`origin/1.04`** (état figé, sans modifications locales non commitées).
- Création typique : `git fetch origin && git checkout -b 1.05 origin/1.04`
- Vérifier avant commit qu’aucun fichier parasite (exports massifs `_files` depuis le navigateur) n’est ajouté par erreur.

## 8. Faut-il encore solliciter Nicolas ?

Oui, **peu et précisément** (cela accélère le front et évite les allers-retours) :

1. Exemple JSON réel de `getTranscriptFolders`.
2. Exemple JSON réel de `getJobsInfo` avec `jobTitle`, `folderId`, `folderName`.
3. Liste des **erreurs métier** (codes ou messages) pour création / renommage / suppression de dossier et `moveTranscriptToFolder`.
4. Confirmation produit : pour l’utilisateur standard, le « renommage » dans l’UI ne doit-il **pas** appeler `renameTranscriptFile` mais uniquement `renameTranscriptTitle` ?
5. Un **token ou compte de test** valide pour CI / dev (les appels locaux peuvent renvoyer `error_invalid_token`).

Sans ces éléments, on peut quand même avancer sur la base de la doc HTML, au prix de corrections mineures après coup.

## 9. Contenu du dossier `webflow-exports/`

| Fichier | Origine |
|---------|---------|
| `01_Webflow_Dashboard_Agilotext.html` | Export Designer « Webflow - Agilotext » |
| `02_Transcript_Webflow_Agilotext.html` | Export « Transcript_Webflow » |
| `03_Pro_Webflow_Agilotext.html` | Export Pro |
| `04_FREE_Webflow_Agilotext.html` | Export FREE |
| `05_Business_Mes_transcripts_Agilotext.html` | Page publiée « Mes transcripts » (référence liste + JS inline) |

Les répertoires `*_files/` (assets lourds depuis le navigateur) **n’ont pas été copiés** depuis Téléchargements pour limiter la taille du dépôt. Si une analyse offline des assets est nécessaire, les garder localement à côté du HTML ou les régénérer depuis une sauvegarde « Page complète ».

## 10. Design (rappel)

- Sidebar avec **toggle** dossiers : oui, aligné usage web.
- S’inspirer des concurrents pour l’**organisation** (liste, filtres, compteurs), pas pour la complexité visuelle : arborescence plate, peu de couleurs, lisibilité avant tout.
