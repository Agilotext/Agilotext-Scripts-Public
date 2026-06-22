# confidence-v1 — branche test Confidence transcript V2

Stack éditeur **isolé** pour tester la confidence segment-level sans modifier les scripts prod Webflow.

## Prod (ne pas toucher)

| Fichier | Chemin |
|---------|--------|
| Éditeur principal | `../Code-main-editor-IFRAME_V04.js` |
| Loader prod | `../editor-main.js` |

## Test confidence (staging Webflow)

```html
<script>window.AGILOTEXT_ENABLE_CONFIDENCE = true;</script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/pages/editor/confidence-v1/editor-main-confidence.js"></script>
```

Branche CDN : `?agilo_cdn_branch=1.09&debug=1`

## Rollback staging

Retirer les 2 lignes `<script>` ci-dessus de la page Webflow staging → retour immédiat à l’éditeur prod.

## Fichiers locaux (confidence-v1 uniquement)

| Fichier | Rôle |
|---------|------|
| `agilo-confidence.js` | Fetch POST, réconciliation segment, badges, panneau, navigation |
| `agilo-confidence.css.js` | Styles badges + panneau |
| `Code-main-editor-IFRAME_V04-confidence.js` | Fork V04 + hooks confidence (~40 lignes de diff) |
| `editor-main-confidence.js` | Loader staging (scripts prod via PARENT_ONLY) |
| `agilo-confidence.test.mjs` | Tests unitaires |
| `test-confidence-api-live.mjs` | Test API live (credentials requis) |

Les autres scripts éditeur sont chargés depuis `../` (prod) pour éviter la duplication.

## Comportement V2

- Confidence **segment-level** (badges dans `.ag-seg__head`)
- Scores conservés après édition + badge « Texte modifié »
- Panneau global : score, compteurs, « Zone suivante », « Masquer »
- `summary.globalScore` utilisé tel quel
- Mode `plain` (transcript non structuré) : confidence désactivée
- Navigation : priorité UI `low → verify → textModified`
- Feature flag : `window.AGILOTEXT_ENABLE_CONFIDENCE = false` désactive tout

## API publique

```js
window.AgiloConfidence = { reload, clear, markSegmentModified, toggle };
```

## Tests

```bash
node scripts/pages/editor/confidence-v1/agilo-confidence.test.mjs
```

Test API live (credentials requis) :

```bash
AGILOTEXT_USERNAME=... AGILOTEXT_TOKEN=... AGILOTEXT_JOB_ID=... \
  node scripts/pages/editor/confidence-v1/test-confidence-api-live.mjs
```

Token éditeur : `localStorage.getItem('agilo:token:ent')`

## Checklist validation manuelle (sign-off Nicolas)

1. [ ] Job récent `available:true` : badges `low` / `verify` visibles dans `.ag-seg__head`
2. [ ] Panneau global avec `summary.globalScore` correct
3. [ ] Édition locale : score conservé + « Texte modifié » immédiat
4. [ ] Sauvegarde + reload : `textModified:true` revient du backend
5. [ ] Changement rapide de job : aucun badge résiduel
6. [ ] `AGILOTEXT_ENABLE_CONFIDENCE = false` : aucun appel réseau confidence (onglet Network)

**Go/no-go prod :** les 6 scénarios OK + accord Nicolas sur navigation UI.

## Edge cases documentés

- Suppression/fusion de segment : badges peuvent être désalignés jusqu’au prochain reload job
- Segment sans score confidence édité : pas de badge « Texte modifié » (normal)
- jsDelivr : attendre 5–10 min après push avant test CDN
