# confidence-v1 — branche test Confidence transcript V2.4/V3

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
| `Code-main-editor-IFRAME_V04-confidence.js` | Fork V04 + hooks confidence (`__agiloEditorConfidenceVersion` = `1.09.5`) |
| `editor-main-confidence.js` | Loader staging (scripts prod via PARENT_ONLY) |
| `DIAGNOSTIC_PASSAGES_A_RELIRE.js` | Diagnostic console si les onglets semblent disparaître |
| `agilo-confidence.test.mjs` | Tests unitaires |
| `test-confidence-api-live.mjs` | Test API live (credentials requis) |

Les autres scripts éditeur sont chargés depuis `../` (prod) pour éviter la duplication.

## Comportement V2.4/V3

- Confidence **segment-level** par défaut : badge dans `.ag-seg__head` + fond arrondi léger sur `.ag-seg__text`
- Wording visible : « À relire » / « Prioritaire » (pas « Faible confiance »)
- Score `%` en secondaire : « Qualité estimée », pas comme action principale
- Scores conservés après édition + badge « Modifié depuis transcription »
- États de revue locaux : « Relu », « Ignoré », « Réouvrir »
- Panneau global sticky/floating : passages à relire en premier, score en secondaire, « Passage suivant », toggle « Passages à relire »
- Cas zéro passage : affichage sobre, sans helper
- Après revue complète : affichage sobre « Tous les passages signalés sont traités »
- Helper one-shot : affiché seulement avec des passages à relire, dismissible par « Compris »
- Préférence utilisateur locale : le toggle masque/réaffiche les repères sans désactiver le flag Webflow
- Extension V3 : `segmentsConfidence[].issues[]` surligne les mots si les offsets correspondent encore au texte
- `summary.globalScore` utilisé tel quel
- Mode `plain` (transcript non structuré) : confidence désactivée
- Navigation : priorité UI `low → verify → textModified`, en excluant les zones vérifiées/ignorées
- Raccourcis hors édition : `Alt+ArrowRight` passage suivant, `Alt+ArrowLeft` passage précédent
- Feature flag : `window.AGILOTEXT_ENABLE_CONFIDENCE = false` désactive tout
- Clés locales : `agilo:confidence-visible:v1`, `agilo:confidence-helper-seen:v1`

## API publique

```js
window.AgiloConfidence = { reload, clear, markSegmentModified, setReviewState, goToNextConfidenceZone, goToPreviousConfidenceZone, toggleUserConfidenceVisible, toggle };
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

1. [ ] Job récent `available:true` : badges « À relire » / « Prioritaire » visibles
2. [ ] Panneau global avec passages à relire en premier + « Qualité estimée » secondaire
3. [ ] Édition locale : score conservé + « Modifié depuis transcription » immédiat
4. [ ] Sauvegarde + reload : `textModified:true` revient du backend
5. [ ] Boutons « Relu » / « Ignorer » retirent le passage de la navigation courante
6. [ ] Le panneau reste accessible en scroll puis revient à sa position normale
7. [ ] Helper visible au premier transcript avec passages à relire, absent si zéro passage, puis absent après « Compris » + reload
8. [ ] Toggle « Passages à relire » OFF masque les repères, persiste au reload, et garde le panneau de réactivation
9. [ ] « Passage suivant » x5 : barre d'onglets reste visible sans reload
10. [ ] `Alt+ArrowRight` / `Alt+ArrowLeft` : même comportement, onglets stables
11. [ ] Depuis Compte rendu, « Passage suivant » bascule sur Transcription
12. [ ] Ouvrir « Télécharger transcription », « Télécharger compte rendu » et « Analyses IA » : menus entiers visibles, aucun libellé d'onglet ne traverse le menu
13. [ ] Popups upsell `.wrapper-message-pro.download`, menu renommage intervenant, bannière anonymisation : pas de recouvrement par la barre d'onglets
14. [ ] Toggle ON + scroll : onglets restent visibles (garde JS shell, pas de sticky)
15. [ ] `getComputedStyle(document.querySelector('main.ed-main nav.ed-tabs')).zIndex` retourne `'auto'`
16. [ ] Changement rapide de job : aucun badge résiduel
17. [ ] `AGILOTEXT_ENABLE_CONFIDENCE = false` : aucun appel réseau confidence (onglet Network)

**Go/no-go prod :** les 17 scénarios OK + accord Nicolas sur navigation UI.

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
