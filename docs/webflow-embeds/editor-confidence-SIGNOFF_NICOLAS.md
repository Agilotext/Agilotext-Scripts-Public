# Sign-off Nicolas — Confidence transcript V2.3/V3-ready

## Embed staging (jsDelivr @1.09)

```html
<script>window.AGILOTEXT_ENABLE_CONFIDENCE = true;</script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/pages/editor/confidence-v1/editor-main-confidence.js"></script>
```

Debug : `?agilo_cdn_branch=1.09&debug=1`

## Job de test requis

Fournir un `jobId` avec `available:true` sur `POST /receiveConfidenceTextJson` pour valider end-to-end.

## Checklist validation (15 scénarios)

- [ ] Badges « À vérifier » / « À vérifier en priorité » dans `.ag-seg__head`
- [ ] Mise en évidence sobre du texte du segment à vérifier, sans trait orange abrupt
- [ ] Panneau global « Qualité transcription » + `summary.globalScore`
- [ ] Panneau global accessible après scroll et retour normal quand on remonte
- [ ] Helper one-shot visible au premier transcript avec zones à vérifier
- [ ] Bouton « Compris » masque le helper après reload
- [ ] Toggle « Zones à vérifier » OFF masque les repères et persiste au reload
- [ ] Toggle « Zones à vérifier » ON réaffiche badges, highlights, navigation
- [ ] `Alt+ArrowRight` / `Alt+ArrowLeft` naviguent hors édition
- [ ] Les raccourcis ne changent pas de zone quand le curseur est dans le transcript ou quand le toggle est OFF
- [ ] Édition locale : score conservé + « Modifié depuis transcription »
- [ ] Boutons locaux « Vérifié » / « Ignorer » + navigation mise à jour
- [ ] Sauvegarde + reload : `textModified:true` du backend
- [ ] Changement rapide de job : pas de mélange
- [ ] Flag `false` : aucun appel confidence

## Point à confirmer

Navigation « Zone suivante » : **priorité UI** `low → verify → textModified`, en excluant les zones vérifiées/ignorées. Raccourcis retenus : `Alt+ArrowRight` / `Alt+ArrowLeft`.

## Contrat V3 à valider

Pour le vrai mot-à-mot, ajouter `segmentsConfidence[].issues[]` avec `text`, `score`, `level`, `startChar`, `endChar`, `startTime`, `endTime`, `wordIndex` et idéalement `originalTextHash`. Le frontend ignore les issues incompatibles avec le texte courant et retombe sur l’affichage segment-level.

## Brouillon email

```
Objet : Confidence V2.3 client — prêt pour test staging

Bonjour Nicolas,

Le stack client confidence V2.3 est sur la branche 1.09 (repo public, nommage neutre).

Staging Webflow :
- AGILOTEXT_ENABLE_CONFIDENCE = true
- editor-main-confidence.js @1.09

Tests auto : 49/49 unitaires confidence + endpoint POST reachable.

Peux-tu :
1. Me donner un jobId avec available:true pour test live complet ?
2. Valider les scénarios manuels (checklist ci-jointe) ?
3. Confirmer que la navigation priorité UI (low > verify > modified, hors vérifiés/ignorés) te convient ?
4. Valider le contrat V3 issues[] pour le vrai surlignage mot-à-mot ?

Merci,
Florian
```

## Test API live (Florian)

```bash
AGILOTEXT_USERNAME=... AGILOTEXT_TOKEN=... AGILOTEXT_JOB_ID=... \
  node scripts/pages/editor/confidence-v1/test-confidence-api-live.mjs
```

Token : `localStorage.getItem('agilo:token:ent')` dans la console éditeur.
