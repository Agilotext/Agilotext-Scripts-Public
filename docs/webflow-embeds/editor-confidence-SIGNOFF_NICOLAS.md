# Sign-off Nicolas — Confidence transcript V2.1/V3-ready

## Embed staging (jsDelivr @1.09)

```html
<script>window.AGILOTEXT_ENABLE_CONFIDENCE = true;</script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/pages/editor/confidence-v1/editor-main-confidence.js"></script>
```

Debug : `?agilo_cdn_branch=1.09&debug=1`

## Job de test requis

Fournir un `jobId` avec `available:true` sur `POST /receiveConfidenceTextJson` pour valider end-to-end.

## Checklist validation (8 scénarios)

- [ ] Badges « À vérifier » / « À vérifier en priorité » dans `.ag-seg__head`
- [ ] Mise en évidence sobre du texte du segment à vérifier
- [ ] Panneau global « Qualité transcription » + `summary.globalScore`
- [ ] Édition locale : score conservé + « Modifié depuis transcription »
- [ ] Boutons locaux « Vérifié » / « Ignorer » + navigation mise à jour
- [ ] Sauvegarde + reload : `textModified:true` du backend
- [ ] Changement rapide de job : pas de mélange
- [ ] Flag `false` : aucun appel confidence

## Point à confirmer

Navigation « Zone suivante » : **priorité UI** `low → verify → textModified`, en excluant les zones vérifiées/ignorées. OK pour toi ?

## Contrat V3 à valider

Pour le vrai mot-à-mot, ajouter `segmentsConfidence[].issues[]` avec `text`, `score`, `level`, `startChar`, `endChar`, `startTime`, `endTime`, `wordIndex` et idéalement `originalTextHash`. Le frontend ignore les issues incompatibles avec le texte courant et retombe sur l’affichage segment-level.

## Brouillon email

```
Objet : Confidence V2.1 client — prêt pour test staging

Bonjour Nicolas,

Le stack client confidence V2.1 est sur la branche 1.09 (repo public, nommage neutre).

Staging Webflow :
- AGILOTEXT_ENABLE_CONFIDENCE = true
- editor-main-confidence.js @1.09

Tests auto : 32/32 unitaires + endpoint POST reachable.

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
