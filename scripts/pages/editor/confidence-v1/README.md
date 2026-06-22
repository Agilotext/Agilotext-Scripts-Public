# confidence-v1 — branche test Confidence transcript V2.1/V3

Stack éditeur **isolé** pour tester la confidence segment-level et préparer le mot-à-mot V3 sans modifier les scripts prod Webflow.

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
| `agilo-confidence.js` | Fetch POST, réconciliation segment, badges, états de revue, panneau, navigation, issues V3 |
| `agilo-confidence.css.js` | Styles badges + panneau + highlights |
| `Code-main-editor-IFRAME_V04-confidence.js` | Fork V04 + hooks confidence (~40 lignes de diff) |
| `editor-main-confidence.js` | Loader staging (scripts prod via PARENT_ONLY) |
| `agilo-confidence.test.mjs` | Tests unitaires |
| `test-confidence-api-live.mjs` | Test API live (credentials requis) |

Les autres scripts éditeur sont chargés depuis `../` (prod) pour éviter la duplication.

## Comportement V2.1/V3

- Confidence **segment-level** par défaut : badge dans `.ag-seg__head` + fond léger sur `.ag-seg__text`
- Wording visible : « À vérifier » / « À vérifier en priorité » (pas « Faible confiance »)
- Score `%` en tooltip, pas dans le badge principal
- Scores conservés après édition + badge « Modifié depuis transcription »
- États de revue locaux : « Vérifié », « Ignoré », « Réouvrir »
- Panneau global : qualité transcription, zones à vérifier, prioritaires, modifiées, « Zone suivante », « Masquer »
- Extension V3 : `segmentsConfidence[].issues[]` surligne les mots si les offsets correspondent encore au texte
- `summary.globalScore` utilisé tel quel
- Mode `plain` (transcript non structuré) : confidence désactivée
- Navigation : priorité UI `low → verify → textModified`, en excluant les zones vérifiées/ignorées
- Feature flag : `window.AGILOTEXT_ENABLE_CONFIDENCE = false` désactive tout

## API publique

```js
window.AgiloConfidence = { reload, clear, markSegmentModified, setReviewState, toggle };
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

1. [ ] Job récent `available:true` : badges « À vérifier » / « À vérifier en priorité » visibles
2. [ ] Panneau global avec « Qualité transcription » + `summary.globalScore` correct
3. [ ] Édition locale : score conservé + « Modifié depuis transcription » immédiat
4. [ ] Sauvegarde + reload : `textModified:true` revient du backend
5. [ ] Boutons « Vérifié » / « Ignorer » retirent la zone de la navigation courante
6. [ ] Changement rapide de job : aucun badge résiduel
7. [ ] `AGILOTEXT_ENABLE_CONFIDENCE = false` : aucun appel réseau confidence (onglet Network)

**Go/no-go prod :** les 7 scénarios OK + accord Nicolas sur navigation UI.

## Promotion prod (après sign-off Nicolas)

Ne **pas** modifier `editor-main.js` in-place.

1. Extraire `agilo-confidence.js` → `scripts/pages/editor/Code-confidence.js`
2. Remplacer le fork IFRAME 2952 lignes par un patch hooks ~40 lignes (`Code-main-editor-IFRAME_V04-confidence-hooks.js`)
3. Activer via embed prod dédié ou feature flag page par page

Voir [`docs/webflow-embeds/editor-confidence-SIGNOFF_NICOLAS.md`](../../../docs/webflow-embeds/editor-confidence-SIGNOFF_NICOLAS.md) pour le message de validation à envoyer à Nicolas.

## Edge cases documentés

- Suppression/fusion de segment : badges peuvent être désalignés jusqu’au prochain reload job
- Segment sans score confidence édité : pas de badge « Modifié depuis transcription » (normal)
- Issues V3 incompatibles avec le texte courant : pas de surlignage mot-à-mot, fallback segment-level
- jsDelivr : attendre 5–10 min après push avant test CDN
