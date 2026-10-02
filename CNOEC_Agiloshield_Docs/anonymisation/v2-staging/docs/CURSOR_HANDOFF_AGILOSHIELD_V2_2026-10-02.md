# AgiloShield V2 — Handoff complet pour Cursor

Date : 2026-10-02  
Objectif : reprendre le front AgiloShield V2 proprement après plusieurs jours de changements croisés front / Java / Python, établir une vérité technique, reproduire les bugs, puis proposer un plan détaillé avant toute nouvelle refonte.

---

## 0. Règle de travail

Ne pas considérer les noms de branches, les anciens verdicts ni les screenshots comme une preuve suffisante.

Avant toute modification :

1. vérifier les SHA réels ;
2. vérifier les fichiers réellement servis à Webflow ;
3. vérifier les réponses HTTP réelles de la façade Java staging ;
4. vérifier le runtime Python/Java réellement déployé sur la recette ;
5. reproduire les problèmes utilisateur dans un navigateur authentifié ;
6. seulement ensuite proposer le plan.

Ne pas modifier la production.

Le staging Webflow est la cible de validation.

---

# 1. Architecture produit attendue

Le parcours cible reste :

```text
Navigateur Webflow
    ↓ HTTPS + session utilisateur Agilotext
Façade Java AgiloShield V2
    ↓ filesystem / orchestration privée
Worker Python V2
    ↓
artifact + review + QA + revisions
    ↑
Façade Java
    ↑
Webflow
```

Invariants :

- le navigateur ne contacte jamais directement Python ;
- aucun secret HMAC / worker dans le JS ;
- Java reste la façade authentifiée / tenant-aware ;
- Python reste autoritaire pour les décisions privacy et QA ;
- le front ne doit jamais fabriquer READY ;
- un REVIEW ne devient jamais MASK silencieusement ;
- les décisions KEEP / MASK restent liées à une occurrence précise ;
- FAILED n'est jamais présenté comme un résultat certifié.

---

# 2. Repositories à examiner

## A. Front public / assets Webflow

Repository :

```text
Agilotext/Agilotext-Scripts-Public
```

Répertoire principal :

```text
CNOEC_Agiloshield_Docs/anonymisation/v2-staging/
```

Fichiers à auditer en priorité :

```text
agiloshield-v2-embed.js
agiloshield-v2.css
agiloshield-v2-client.js
agiloshield-v2-auth.js
agiloshield-v2-lists.js
agiloshield-v2-location.js
docx-preview-frame.html
WEBFLOW_STAGING_COPY_PASTE.html
tests/*
docs/*
```

IMPORTANT : si un véritable source TypeScript existe ailleurs dans le workspace Cursor, le retrouver et établir clairement :

```text
source TS
→ build/transpile
→ JS public réellement servi
```

Ne pas éditer à la fois un source TypeScript et un JS généré sans comprendre qui est canonique.

Dans le repository public que nous avons inspecté, le dossier v2-staging actuel expose surtout des modules JavaScript ES + CSS. Cursor doit chercher la source canonique éventuelle dans le reste du workspace.

---

## B. Backend Java + worker Python source

Repository :

```text
kawansoft/AgiloTextApi
```

Branche à examiner en premier :

```text
12.0.6
```

HEAD observé au 02/10/2026 :

```text
0e0439932e84910c28da057c984e6b1a6b31bd83
message: file_worker.py & branch_version.py
```

Fichiers Java importants :

```text
src/main/java/com/sqlephant/ws/servlet/api/anon/full_python2/FullPython2Bridge.java
src/main/java/com/sqlephant/ws/servlet/api/anon/full_python2/FullPython2Config.java

src/main/java/com/sqlephant/ws/servlet/api/anon/full_python2/editor/AnonEditorApiRouter.java
src/main/java/com/sqlephant/ws/servlet/api/anon/full_python2/editor/AnonEditorService.java
src/main/java/com/sqlephant/ws/servlet/api/anon/full_python2/editor/AnonEditorWorkerBridge.java
src/main/java/com/sqlephant/ws/servlet/api/anon/full_python2/editor/AnonEditorPdfRegions.java
src/main/java/com/sqlephant/ws/servlet/api/anon/full_python2/editor/AnonEditorPolicy.java
```

Worker Python actuellement présent dans cette branche :

```text
WEB-INF/python_2/agiloshield/
WEB-INF/python_2/agiloshield_main.py
```

Points importants à auditer :

```text
file_worker.py
worker_supervisor.py
worker_config.py
jobs.py
semantic_review.py
review_actions.py
review_mask_plan.py
qa_output.py
paint_pdf.py
pdf_localization.py
pseudo_v2.py
```

---

# 3. Branches front : chronologie et statut

## 3.1 Base Java 12.0.6 / front avant refonte

Branche :

```text
codex/agiloshield-v2-java-1206-staging-20261001
```

HEAD :

```text
6b5685dc0d644a00e0d3b8ed30b91feb9fd813b8
```

Cette branche constitue la base historique à partir de laquelle les passes UI du 02/10 ont démarré.

Son embed Webflow avait été épinglé sur un asset antérieur :

```text
1ee2a3d463b78be177b949666016e788bc5fca62
```

Ne pas supposer pour autant que ce SHA représente le backend actuel.

---

## 3.2 Grande refonte Product UI — branche à ne PAS utiliser comme base

Branche :

```text
codex/agiloshield-v2-product-ui-20261002
```

HEAD :

```text
f7a6f65adbffd1215ee38774237fe12251e00bdc
```

Cette passe a essayé de modifier simultanément :

- design system ;
- hiérarchie ;
- review ;
- navigation occurrence ;
- viewer PDF ;
- masquage manuel ;
- responsive ;
- microcopy.

Elle contient des idées intéressantes mais a introduit trop de changements à la fois.

La branche ciblée actuelle et cette branche sont DIVERGÉES.

Comparaison observée :

```text
targeted fixes vs product UI:
ahead: 19
behind: 15
status: diverged
```

Donc :

**NE PAS MERGER CETTE BRANCHE EN BLOC.**

Elle peut uniquement servir de référence visuelle / source d'idées à cherry-pick après audit.

---

## 3.3 Safe UI baseline — base comportementale de secours

Branche :

```text
codex/agiloshield-v2-safe-ui-baseline-20261002
```

HEAD :

```text
7dc3967242618e5ed36c4f52464f4340ec797a7f
```

Asset runtime qualifié par cette passe :

```text
71e134cac2c3d57fe064db91176da25fa12ae404
```

But de cette branche :

- reprendre le JS fonctionnel de la base Java 12.0.6 ;
- ne changer que du CSS conservateur ;
- garder les interactions métier intactes.

Cette branche est la meilleure référence pour comparer un comportement suspect introduit ensuite.

---

## 3.4 Targeted fixes — branche courante à auditer

Branche :

```text
codex/agiloshield-v2-targeted-fixes-20261002
```

HEAD au moment de ce handoff :

```text
26f4bf0c7472eb53b49efee55dfec6a79975b5ec
```

La branche est :

```text
19 commits devant la base Java 12.0.6 front
15 commits devant la safe UI baseline
```

Elle modifie par rapport à la base :

```text
agiloshield-v2-embed.js : +210 / -370 environ
agiloshield-v2.css      : +631
WEBFLOW_STAGING_COPY_PASTE.html
CI workflows
docs
```

Le fichier Webflow actuel de cette branche ne charge pas son HEAD, mais épingle volontairement les assets à :

```text
4a198e4ad6b78724089ea86e7a544ff81c4a6780
```

Les commits postérieurs servent principalement à l'embed/rollback/docs.

---

# 4. URL staging et API

Page Webflow staging :

```text
https://agilotext-test.webflow.io/app/business/dashboard/anonymiser
```

Base URL V2 utilisée par l'embed :

```text
https://apitest.agilotext.com/api/agiloshield-v2
```

Le navigateur doit parler uniquement à cette façade Java.

---

# 5. État actuel du bloc Webflow

Le fichier de référence est :

```text
CNOEC_Agiloshield_Docs/anonymisation/v2-staging/WEBFLOW_STAGING_COPY_PASTE.html
```

Sur la branche targeted-fixes, il pointe sur l'asset :

```text
4a198e4ad6b78724089ea86e7a544ff81c4a6780
```

À vérifier avant toute modification :

1. que Webflow publié contient réellement ce SHA ;
2. que jsDelivr renvoie le même fichier que GitHub ;
3. que les Content-Type sont corrects ;
4. qu'il n'existe pas un autre embed legacy chargé sur la même page ;
5. qu'aucun cache navigateur / CDN ne sert une ancienne version.

---

# 6. Incident critique récent : écran blanc

Un asset précédent était :

```text
870e88988c217e01d7a450fcedc0e02117204c1d
```

Le navigateur a remonté :

```text
agiloshield-v2-embed.js:1508
Uncaught SyntaxError: Unexpected token ':'
```

L'interface étant construite entièrement depuis le module, aucune UI ne s'affichait.

La correction a été committée dans :

```text
4a198e4ad6b78724089ea86e7a544ff81c4a6780
fix(v2): repair review status ternary syntax
```

IMPORTANT : une GitHub Action sur le commit 870e... avait pourtant annoncé `node --check` PASS.

Cursor doit impérativement investiguer cette incohérence plutôt que de faire confiance aveuglément à la CI.

À faire :

```text
git show 870e...:.../agiloshield-v2-embed.js > /tmp/embed-870.js
node --check /tmp/embed-870.js

git show 4a198...:.../agiloshield-v2-embed.js > /tmp/embed-4a.js
node --check /tmp/embed-4a.js
```

Puis comparer aussi l'asset CDN :

```text
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@<SHA>/...
```

Calculer SHA-256 / diff GitHub vs CDN.

Si GitHub 870 parse réellement alors que le navigateur reçoit une syntax error :
- identifier précisément l'asset réellement chargé ;
- vérifier cache/CDN ;
- vérifier source maps / duplicate module / ancien embed.

Si GitHub 870 ne parse pas :
- expliquer pourquoi la CI a renvoyé success ;
- corriger le workflow pour qu'une telle situation ne puisse plus arriver.

---

# 7. Retours utilisateur réels à préserver dans le prochain plan

Les retours ci-dessous viennent de l'usage réel du staging, pas d'une maquette.

## 7.1 Dashboard

Problèmes observés :

- gros boutons globaux « Réessayer le chargement » et « Reprendre après connexion » incompréhensibles ;
- un job peut rester affiché avec « Protection en cours » + message d'erreur ;
- l'utilisateur veut pouvoir RETIRER proprement un job de l'écran ;
- la carte « Dernier document » est redondante avec la file + historique ;
- mauvais alignements / centrages ;
- trop de texte ;
- « Télécharger non vérifié » est trop technique et trop long ;
- badges Job ID techniques non souhaités dans le parcours normal.

Targeted-fixes a tenté :

- suppression de la carte Dernier document ;
- suppression des recovery buttons globaux ;
- bouton/icône Retirer par ligne ;
- suppression du badge job dans la file ;
- wording « Télécharger » seulement.

Cursor doit vérifier le résultat visuel réel et décider ce qui doit être gardé / ajusté.

---

## 7.2 Header de review

Retours :

- trop de gros boutons bordés en haut à droite ;
- textes trop longs ;
- radius / styles pas alignés avec la charte Webflow ;
- Retirer / Télécharger / Clé doivent plutôt être des icon-buttons avec tooltip ;
- fermeture simple ;
- peu de bruit.

Targeted-fixes a tenté des icon-buttons et l'utilisation de :

```text
--agilo-primary
--agilo-primary-hover
--agilo-radius
--agilo-text
```

Cursor doit inspecter les VRAIS tokens Webflow disponibles sur la page avant de figer le CSS.

---

## 7.3 Original / anonymisé / comparaison

Besoin produit :

- Version anonymisée reste utile.
- Original doit pouvoir servir de visualisation pédagogique.
- L'utilisateur veut un effet type « Marvin » :
  voir le texte original, mais surligner les zones que le résultat masque.

C'est possible seulement lorsque la géométrie est exacte.

Targeted-fixes a ajouté une overlay `.asv2-mask-marker` sur l'original pour les occurrences ayant :

```text
action/privacyAction == MASK
AND originalPdfLocation(...) == exact
```

Règle absolue :

- ne jamais surligner approximativement une position inconnue ;
- page-only != rectangle exact ;
- ne jamais rechercher un texte par similarité pour fabriquer une bbox.

Cursor doit tester cette feature sur plusieurs PDF et rotations.

---

## 7.4 Masquer une zone / Ajouter un masquage

Avant :

```text
Masquer une zone
Ajouter un masquage
Masquer un passage oublié
```

Le produit devenait incompréhensible.

Décision produit actuelle :

**un seul outil visible principal : « Masquer une zone ».**

Targeted-fixes supprime les deux autres entrées UI.

Le backend peut garder `ADD_OCCURRENCE` si nécessaire pour d'autres surfaces ; ne pas supprimer un contrat serveur uniquement parce que le front ne l'expose plus.

---

## 7.5 Revue d'une occurrence

Retour utilisateur :

- trop de texte ;
- trop de boutons ;
- « Voir le passage » prend beaucoup de place ;
- le panneau ressemble à un fourre-tout.

Cible :

- catégorie ;
- valeur ;
- contexte court si utile ;
- petite icône de localisation ;
- deux décisions claires :
  `Conserver` / `Masquer`.

Pas de codes support.

Pas d'UUID.

Pas de jargon QA.

---

## 7.6 Rechargement du document à chaque occurrence

Problème perçu :

ouvrir plusieurs occurrences donne l'impression que le PDF est rechargé à chaque fois.

Targeted-fixes a ajouté un fast-path `previewFocus` :

- si le PDF original est déjà chargé ;
- si on reste dans la même vue ;
- si seule l'occurrence change ;

alors redessiner / recentrer sans refaire tout `previewBytes()`.

Cursor doit profiler réellement :

- requêtes Network ;
- appels /preview ;
- PDF.js getDocument ;
- redraw canvas ;
- page change vs same page.

Le but n'est pas de cacher un loader si le fetch existe encore ; le but est réellement d'éviter les appels inutiles.

---

## 7.7 Détails techniques / QA

L'utilisateur ne veut PAS voir dans l'interface normale :

```text
codes pour le support
reason codes
rapport QA brut
UUID de revision
job id technique
codeSha
artifact digests
```

Ces éléments doivent rester :

- dans la console dev ;
- dans un diagnostic support interne ;
- dans les logs ;
- éventuellement dans un panneau support protégé, mais pas dans le parcours normal.

Targeted-fixes masque/supprime ces blocs.

Cursor doit vérifier qu'aucune info utile à l'action utilisateur n'a été supprimée avec eux.

---

# 8. « Valider » : point fonctionnel majeur

L'utilisateur veut :

```text
je vérifie
→ je clique Valider
→ le produit fait ce qu'il faut
→ état clair
```

Mais le backend a volontairement des garde-fous.

Dans :

```text
WEB-INF/python_2/agiloshield/semantic_review.py
```

`human_verification_blockers()` refuse notamment l'attestation lorsqu'il reste :

```text
not_reviewable
artifact_inconsistent
not_result
status_not_approvable
already_technically_ready
known_leak_or_missing_transform
unresolved_mask
remaining_review
no_artifact
failed_artifact
```

Le Java :

```text
AnonEditorService.approveHumanVerification()
```

relit `canApproveHumanVerification` et refuse si le moteur dit non.

Donc :

**NE PAS FAIRE SEMBLANT QUE « Valider » SUFFIT TOUJOURS.**

Targeted-fixes essaie maintenant :

1. clic Valider ;
2. refresh silencieux du state ;
3. si approvable : confirmation simple puis approve ;
4. sinon : guider vers les décisions/regions restantes ;
5. ne plus afficher « Actualisez la revue ».

Cursor doit améliorer ce flow sans affaiblir les garde-fous.

### Option produit à étudier

Une vraie amélioration pourrait être une commande explicite :

```text
Masquer tous les passages encore à confirmer
```

mais uniquement si :

- l'utilisateur confirme explicitement ;
- le backend crée des décisions MASK par occurrence ;
- nouvelle révision ;
- writer ;
- reopen ;
- QA ;
- ensuite seulement validation humaine.

Jamais de REVIEW → MASK silencieux dans le front.

---

# 9. Pseudonymisation : anomalie à diagnostiquer côté runtime

Le front active `Pseudonymiser` uniquement si les capacités reçues indiquent :

```text
processingModes includes PSEUDONYMIZE
AND pseudonymKeyDownload == true
```

Le source Java `12.0.6`, commit :

```text
0e0439932e84910c28da057c984e6b1a6b31bd83
```

montre dans `AnonEditorService.capabilities()` :

```text
ANONYMIZE
PSEUDONYMIZE
pseudonymKeyDownload = true
pseudonymKeyReviewRequired = true
listDirectives = true
addOccurrence = true
qaReport = true
humanVerification = true
pseudonymRestore = true
```

`createJob()` fait également :

```java
holder.setDoPseudoAnon("PSEUDONYMIZE".equals(mode));
```

et `FullPython2Bridge` sérialise le `processingMode` dans les options worker.

Conclusion actuelle :

si le mode Pseudonymiser apparaît indisponible en staging, ne pas contourner cela dans le JS.

Il faut vérifier le runtime :

1. GET preferences réel ;
2. classe Java réellement déployée ;
3. branche/commit Tomcat réellement compilé ;
4. create job PSEUDONYMIZE ;
5. `.options` côté worker ;
6. résultat ;
7. pseudonym-key.

---

# 10. Backend / multiprocessing : ne pas ignorer le contexte récent

Nicolas a demandé un runtime :

```text
1 superviseur principal
  ├── worker process 1
  ├── worker process 2
  └── max configurable
```

Pas du multithreading partagé.

La branche Java/Python `12.0.6` contient actuellement notamment :

```text
file_worker.py
worker_supervisor.py
worker_config.py
```

Cursor doit comprendre cet état avant d'interpréter :

- job stuck ;
- timeout ;
- PROCESSING ;
- worker restart ;
- retry ;
- duplicate requestId.

Ne pas modifier le moteur privacy pour résoudre un problème d'orchestration.

---

# 11. Serveur de recette : vérification obligatoire

Avant de proposer une correction backend, relever sur la recette :

```text
Tomcat version / service
Java branch/source provenance
classes réellement déployées
web.xml / mapping réellement déployés
Python release path actif
Python codeSha / branch_version
worker supervisor process tree
nombre de workers configuré
memory / swap
current worker READY
```

Ne pas remplacer un service simplement parce que Git contient une version plus récente.

Comparer :

```text
repo source
vs deployed source/classes
vs HTTP behavior
```

---

# 12. Design : source of truth

Le design doit s'aligner sur le dashboard Agilotext existant.

La page Webflow possède déjà des variables de type :

```text
--agilo-primary
--agilo-primary-hover
--agilo-radius
--agilo-text
--color--blue
```

Ne pas inventer une nouvelle mini-charte si les tokens Webflow couvrent le besoin.

Avant de changer le CSS :

1. inspecter `:root` sur la page réelle ;
2. relever couleurs / radius / fonts / button heights ;
3. relever les composants existants du dashboard ;
4. réutiliser ces valeurs.

Objectif :

AgiloShield doit avoir l'air NATIF dans Agilotext.

Pas d'effet « app dans l'app ».

---

# 13. Plan d'audit demandé à Cursor

## Phase A — Snapshot exact, aucune modification

Produire :

```text
FRONT_BRANCH
FRONT_HEAD
WEBFLOW_ASSET_PIN
BACKEND_BRANCH
BACKEND_HEAD
DEPLOYED_JAVA_VERSION
DEPLOYED_PYTHON_VERSION
```

Puis vérifier hashes des fichiers critiques.

---

## Phase B — Reproduction navigateur

Tester sur le staging authentifié :

### Dashboard
- état vide ;
- upload ;
- upload error ;
- processing ;
- remove from UI ;
- READY ;
- REVIEW_REQUIRED ;
- FAILED.

### Review
- original ;
- anonymisé ;
- compare ;
- ouvrir occurrence ;
- occurrences successives même page ;
- occurrences pages différentes ;
- KEEP ;
- MASK ;
- unresolved mask ;
- manual region ;
- Validate ;
- download ;
- pseudonym key.

Capturer :

```text
console
network
screenshots
request count
response bodies utiles
```

---

## Phase C — Matrice des problèmes

Créer un document :

```text
PROBLEM
REPRO
EXPECTED
ACTUAL
FRONT / JAVA / PYTHON / DEPLOY
SEVERITY
ROOT CAUSE
FIX
REGRESSION TEST
```

Classes :

```text
P0 blocker
P1 core UX/function
P2 polish
```

---

## Phase D — Audit contrat

Établir le contrat réel des routes :

```text
/preferences
upload/create
/status
/review
/regions
/preview/origin
/preview/anon
/review/commands
/execute
/result
/download
/pseudonym-key
/human verification
/history if actually available
```

Pour chacune :

- auth ;
- status codes ;
- schema ;
- revision ;
- policyDigest ;
- listDigest ;
- processingMode ;
- workflowState ;
- assurance ;
- stale behavior.

---

## Phase E — Audit validation humaine

Pour un REVIEW_REQUIRED réel, imprimer / inspecter :

```text
occurrences REVIEW
unresolvedMasks
listProblems
humanVerificationBlockers
canApproveHumanVerification
humanVerifiedDeliverable
qa reasons
phase
status
artifact
```

Puis mapper chaque blocker à une action utilisateur compréhensible.

Ne pas exposer le code brut au public.

---

## Phase F — Audit pseudonymisation

Reproduire avec un TXT synthétique minimal.

Vérifier toute la chaîne :

```text
preferences capability
→ radio enabled
→ upload processingMode
→ SQL/job state
→ .options processingMode
→ worker pseudo path
→ result
→ key download
→ restore if in scope
```

Donner la première couche qui diverge.

---

## Phase G — Audit performance preview

Mesurer précisément :

- fetch status/review par occurrence ;
- fetch preview par occurrence ;
- PDF parse ;
- page rendering ;
- memory ;
- cache.

Proposer un cache borné et invalidé par :

```text
jobId
revision
kind
policyDigest
listDigest
```

Jamais réutiliser un aperçu d'une ancienne révision.

---

# 14. Plan d'implémentation attendu

Cursor ne doit pas commencer par un « grand redesign ».

Proposer d'abord un plan dans cet ordre :

## P0 — stabilité
- aucun écran blanc ;
- aucun JS syntax/runtime error ;
- auth stable ;
- upload stable ;
- remove UI stable ;
- review stable ;
- validation explicable ;
- pseudonymization root cause.

## P1 — parcours
- dashboard simple ;
- review actionnable ;
- occurrence navigation ;
- manual mask ;
- validation ;
- download.

## P2 — design
- alignements ;
- spacing ;
- icon buttons ;
- charte Webflow ;
- responsive ;
- microcopy.

## P3 — polish
- animations légères ;
- focus ;
- performance ;
- empty states.

---

# 15. Discipline de commits

Chaque famille de changements doit avoir son commit.

Exemple :

```text
fix(front): restore review runtime stability
fix(front): simplify queue recovery
fix(review): map blockers to actionable UX
perf(preview): cache current PDF revision
fix(java): expose correct pseudonym capabilities
fix(worker): ...
ui(review): align with Webflow design tokens
```

Pas de commit « redesign everything ».

---

# 16. Tests minimaux obligatoires avant publication

## Static

```text
node --check
ES module import smoke
CSS brace / selector checks
no duplicate critical IDs
no direct :8091 references
no secrets
```

## Contract

Tests existants + nouveaux tests pour :

```text
remove in-flight UI entry
removed entry ignored by poll result
review blocker UX
manual mask from anonymized view
masked-region original overlay
preview cache invalidation
pseudonymization capability handling
```

## Browser

Desktop :

```text
1440
1280
1024
```

Mobile :

```text
768
390
```

## Live staging

Au moins :

```text
READY
REVIEW_REQUIRED
FAILED
PSEUDONYMIZE
manual mask
KEEP
MASK
human validation allowed
human validation blocked
```

---

# 17. CDN / release gate

Avant de donner un SHA à Florian :

1. commit final ;
2. CI green ;
3. récupérer raw GitHub ;
4. récupérer jsDelivr pinned ;
5. comparer SHA-256 ;
6. node --check asset réellement téléchargé ;
7. ouvrir staging en navigation privée/hard refresh ;
8. vérifier console zéro erreur AgiloShield ;
9. tester un vrai upload ;
10. seulement ensuite mettre à jour `WEBFLOW_STAGING_COPY_PASTE.html`.

La branche HEAD peut avancer après le pin. Le HTML Webflow doit toujours utiliser un SHA immuable testé.

---

# 18. Ce que Cursor doit rendre AVANT d'implémenter

Rendre un rapport :

```text
AGILOSHIELD_V2_CURRENT_STATE
```

avec :

1. source of truth front ;
2. source of truth backend ;
3. runtime staging observé ;
4. branche à utiliser comme base ;
5. branches à ne pas merger ;
6. liste P0/P1/P2 ;
7. root cause de chaque P0 ;
8. plan fichier par fichier ;
9. tests associés ;
10. rollback.

Ensuite seulement commencer les changements.

---

# 19. Verdicts finaux attendus

Ne déclarer aucun « ready » générique.

Rendre séparément :

```text
FRONT_STATIC_GREEN
FRONT_BROWSER_SMOKE_GREEN
JAVA_CONTRACT_GREEN
PYTHON_WORKER_GREEN
PSEUDONYMIZE_GREEN
REVIEW_WORKFLOW_GREEN
CDN_PIN_VERIFIED
WEBFLOW_STAGING_READY
```

`PRODUCTION_READY` est un gate séparé et nécessite explicitement une validation pré-production.

---

# 20. Priorité produit

La philosophie UI à conserver :

```text
moins de texte
moins de boutons
une action principale
des détails techniques cachés
un document central
une revue compréhensible
des états honnêtes
aucune fausse certitude
```

L'objectif n'est pas de rendre l'outil spectaculaire par des effets.

Le niveau « professionnel » vient de :

- cohérence ;
- stabilité ;
- vitesse ;
- alignements ;
- contrats nets ;
- feedback immédiat ;
- absence de jargon ;
- aucun comportement surprenant.

---

# 21. Première action Cursor

Commencer par :

```text
git fetch --all --prune
```

Puis ouvrir et comparer :

```text
codex/agiloshield-v2-java-1206-staging-20261001
codex/agiloshield-v2-safe-ui-baseline-20261002
codex/agiloshield-v2-targeted-fixes-20261002
codex/agiloshield-v2-product-ui-20261002
```

et côté backend :

```text
kawansoft/AgiloTextApi:12.0.6
```

Ne modifier aucun fichier avant d'avoir remis le rapport `AGILOSHIELD_V2_CURRENT_STATE`.
