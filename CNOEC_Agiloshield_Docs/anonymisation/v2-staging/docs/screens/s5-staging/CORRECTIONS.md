# CORRECTIONS — smoke Premium 2 octobre 2026

Compte : Harriet `anon@test.com` (Pro, Memberstack Test). Page : `https://agilotext-test.webflow.io/tools/agiloshield/premium/dashboard`. Pin live au moment du smoke : `c8abbb0f`.

## Front OK

- Accueil V2 affiché, un seul moteur `#agiloshield-v2-staging`.
- TXT `recette-masquage.txt` (job `1000040872`) : READY, aperçu `PER_A habite ADR_A…`.
- KEEP API sur « Marie Dupont » puis execute : **200**, action revue = KEEP.
- Formats pseudo : le front local n’interdit plus le PDF (à pinner).

## Front corrigé (pas encore sur le pin live)

- Labels types : plus de codes `ADR Adresse` (live `c8abbb0f` les montre encore).
- 422 / `COMMAND_INVALID` : phrase française, plus un générique.
- `If-Match` sur commands/execute. Console `[AgiloShield V2]` avec statut et code.
- SVG icônes : `height` numérique. Panneau revue : overflow sur le contenu focusable.

## Console : à ignorer (pas V2)

- Hotjar / Posthog / UX-Key : `ERR_BLOCKED_BY_CLIENT` (bloqueur).
- MetaMask `ObjectMultiplex` : extension.
- `anonymiser:775` SVG `height: auto`, `New-button_error`, `readyCount` : scripts **V1** de `/dashboard/anonymiser` (édition business). Pas le moteur V2 Premium.
- 404 `…/nvhc9u4gxsag…/lBttA6D59y4NPdHf_aLjcaWthr8` : script Webflow site, initiator `script`. Pas un asset V2.

## Backend (pack Nico, pas envoyé)

- Job Bauer `1000040871` : `POST …/review/execute` **422**. Harriet n’y a pas accès (`JOB_FORBIDDEN`).
- Contre-preuve TXT Harriet : execute **200**.
- Pack : `DEMANDES_NICO/2026-10-02_agiloshield-v2-execute-422/` — gate `OK envoi Nico execute 422`.

## Accueil : note critique 11/20 (pin `98491032`)

| Critère | Note | Constat |
|---|---|---|
| Hiérarchie | 2/5 | Cinq contrôles de même poids avant le dépôt : Fichiers/Texte, Anonymiser/Pseudonymiser, Données à masquer, Listes, aide. La seule vraie décision est le mode. |
| Mots | 3/5 | « Listes » ne dit rien. « 13/13 » se lit comme un compteur. Fichiers/Texte ressemble à un choix obligatoire alors que Fichiers couvre presque tout. |
| Restauration | 1/3 | Onglet caché derrière `RESTORE_WORKFLOW_QUALIFIED=false`, sans lien avec le fichier pseudonymisé qui en a besoin. |
| Visuel | 2/4 | Deux contrôles segmentés empilés. Icône « ? » ronde dans un bouton rond : double cercle. Pseudonymiser grisé pendant le chargement. |
| Acquis | 3/3 | Titre clair, zone de dépôt nette, liste de session lisible. |

Cible : 17/20. Une décision (le mode), une action (déposer). Texte, réglages et restauration deviennent secondaires. Maquette : `docs/screens/s6-accueil/`.

## Accueil simplifié : 17/20 (pin `0260723a`, staging webflow.io)

| Critère | Note | Constat |
|---|---|---|
| Hiérarchie | 4/5 | Un seul contrôle avant le dépôt : le mode. Texte et réglages passent sous la zone, en liens. |
| Mots | 4/5 | Phrase sous le mode (définitif / réversible, PDF sans retour). « Listes » devient « Termes ». Ligne « 13 catégories masquées · aucun terme · Modifier ». |
| Restauration | 2/3 | Panneau seul supprimé de l’accueil. Lien « J’ai un fichier pseudonymisé et sa clé » et entrée « Restaurer avec la clé » dans le menu du document, tous deux derrière le flag (backend non qualifié). |
| Visuel | 4/4 | Aide en lien texte « ? Comment ça marche », plus de double cercle. Pendant le chargement, le mode respire au lieu d’être grisé. Accueil aligné à gauche dans Webflow (le parent centrait le texte). |
| Acquis | 3/3 | Inchangés. |

Il manque 3 points : restauration réelle (Nicolas), et l’accessibilité du radio Pseudonymiser qui lit encore une phrase d’aide longue.

Captures : `docs/screens/s6-accueil/apres-0260723a-staging.png` (staging, compte Harriet) et `docs/screens/s6-accueil/apres-local/` (harnais synthétique, desktop 1312 et mobile 390 : accueil, tutoriel, réglages, termes, texte collé). Axe : 0 serious/critical hors voile du tutoriel.

## Refonte visuelle et validation en un clic (pin `7e902731`, staging webflow.io)

Avant (captures Florian 18:15 à 18:18) : aide « ? Comment ça marche » perdue, texte collé décalé, catégories sans icône, section Termes trop haute avec un bouton centré, « Modifier » trop petit. En revue : barre Original coupée à gauche, icône Original absente, cartes de passages qui débordent, encadrés superposés, bouton Valider grisé tant qu’un passage reste.

Après :

- Base CSS : racine `text-align:left`, 60 sélecteurs en double fusionnés (`tests/css-merge.mjs`), media queries en fin de fichier, garde-fou anti-doublon dans `css-tokens.check.mjs`. Icônes Nucleo en SVG inline (fin des icônes manquantes).
- Accueil : aide en pilule bleu clair, barre unique « Coller du texte » à gauche, puce réglages (icône, résumé, « Modifier » taille normale) à droite, carte « Texte à protéger » pleine largeur.
- Réglages : une icône par catégorie, compteur « N sur 13 », grille compacte, ligne « Autre chose à masquer ? » avec « Ajouter un terme ».
- Revue : colonne et cartes en `minmax(0,1fr)`, titre sur 2 lignes, extrait sur 3 lignes, « Masquer » et « Laisser visible » sur 2 colonnes égales, barre d’outils sans débordement, icône Original visible active ou non. Pied : une ligne d’état, le bouton, les raccourcis en discret.
- Valider en un clic : bouton toujours actif (sauf envoi en cours). Rien à vérifier : validation directe sans fenêtre. Passages restants : fenêtre centrée « Tout masquer et valider », « Tout laisser visible et valider », « Revoir les passages », puis une décision par passage avec « Décision 3 sur 12 » et « Arrêter ». Zones PDF à placer ou conflits de listes : la fenêtre le dit et propose seulement « Revoir ».
- Aperçu PDF : indicateur « Affichage du PDF… » et délai maximal de 25 s avec message clair, au lieu d’un écran vide.

Vérification staging (Harriet, pin `a72e10ba`, puis `7e902731` pour le message serveur) :

- Accueil et réglages conformes aux captures locales.
- PDF `facture-fictive-smoke.pdf` : Original et Anonymisé s’affichent. « Valider ce document » sans passage restant valide directement (« Document validé. »).
- TXT `cr-smoke.txt` (1 passage) : la fenêtre s’ouvre, « Tout masquer et valider » applique la décision (« Décision 1 sur 1 »). Le serveur refuse ensuite la validation avec `artifact_inconsistent` sur la nouvelle révision (job `1000040878`). Côté backend : un message clair s’affiche désormais à la place du conseil « Masquer une zone ».
- L’écran PDF vide de Florian n’a pas été reproduit sur un PDF Harriet. Cause probable : le débordement de mise en page (contenu poussé hors champ), corrigé ici. Le job Bauer reste lié au 422.

Captures : `docs/screens/s7-refonte/` (desktop et mobile 390 : empty, modal-types, modal-lists, tab-text, review-dense, review-pdf, review-validate-confirm).

Brouillon Nico : `DEMANDES_NICO/2026-10-02_agiloshield-v2-decision-groupee/` (commande groupée, une seule révision). Gate : réponse binaire sur le fil 422, puis `OK envoi Nico décision groupée`.

## Non 20/20 produit tant que

- Validation après décision sur TXT refusée par le serveur (`artifact_inconsistent`).

- Le 422 PDF Bauer n’est pas corrigé.
- `PSEUDO_KEY_INVALID`, restore PDF irréversible, `historyV2` session-only, `TRUST_LINE` Nico.
- www : jamais sans `OK publish www AgiloShield V2`.
