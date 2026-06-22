# Sign-off Nicolas — Confidence transcript V2

## Embed staging (jsDelivr @1.09)

```html
<script>window.AGILOTEXT_ENABLE_CONFIDENCE = true;</script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/pages/editor/confidence-v1/editor-main-confidence.js"></script>
```

Debug : `?agilo_cdn_branch=1.09&debug=1`

## Job de test requis

Fournir un `jobId` avec `available:true` sur `POST /receiveConfidenceTextJson` pour valider end-to-end.

## Checklist validation (6 scénarios)

- [ ] Badges `low` / `verify` dans `.ag-seg__head`
- [ ] Panneau global + `summary.globalScore`
- [ ] Édition locale : score conservé + « Texte modifié »
- [ ] Sauvegarde + reload : `textModified:true` du backend
- [ ] Changement rapide de job : pas de mélange
- [ ] Flag `false` : aucun appel confidence

## Point à confirmer

Navigation « Zone suivante » : **priorité UI** `low → verify → textModified` (pas l’ordre backend strict). OK pour toi ?

## Brouillon email

```
Objet : Confidence V2 client — prêt pour test staging

Bonjour Nicolas,

Le stack client confidence V2 segment-level est sur la branche 1.09 (repo public, nommage neutre).

Staging Webflow :
- AGILOTEXT_ENABLE_CONFIDENCE = true
- editor-main-confidence.js @1.09

Tests auto : 21/21 unitaires + endpoint POST reachable.

Peux-tu :
1. Me donner un jobId avec available:true pour test live complet ?
2. Valider les 6 scénarios manuels (checklist ci-jointe) ?
3. Confirmer que la navigation priorité UI (low > verify > modified) te convient ?

Merci,
Florian
```

## Test API live (Florian)

```bash
AGILOTEXT_USERNAME=... AGILOTEXT_TOKEN=... AGILOTEXT_JOB_ID=... \
  node scripts/pages/editor/confidence-v1/test-confidence-api-live.mjs
```

Token : `localStorage.getItem('agilo:token:ent')` dans la console éditeur.
