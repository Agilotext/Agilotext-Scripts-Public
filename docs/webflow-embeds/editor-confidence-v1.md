# Webflow — Confidence transcript V2.4/V3 (test isolé)

> **Important :** la prod Webflow ne doit **pas** être modifiée. Les scripts prod (`Code-main-editor-IFRAME_V04.js`, `editor-main.js`, etc.) restent inchangés.

Toute l'expérimentation confidence vit dans :

```text
scripts/pages/editor/confidence-v1/
```

## Prod (inchangé)

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/pages/editor/Code-main-editor-IFRAME_V04.js"></script>
```

## Test confidence (page staging uniquement)

```html
<script>window.AGILOTEXT_ENABLE_CONFIDENCE = true;</script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/pages/editor/confidence-v1/editor-main-confidence.js"></script>
```

Debug : `?agilo_cdn_branch=1.09&debug=1`

## Rollback staging

Retirer les 2 lignes `<script>` ci-dessus → retour immédiat à l’éditeur prod.

## API backend

```http
POST /api/v1/receiveConfidenceTextJson
Content-Type: application/x-www-form-urlencoded;charset=UTF-8
```

Paramètres : `username`, `token`, `edition`, `jobId`

### Contrat V2.1 (segmentsConfidence)

```json
{
  "status": "OK",
  "available": true,
  "version": "2.0",
  "jobId": 1000032216,
  "thresholds": { "normalMin": 0.85, "verifyMin": 0.65 },
  "summary": {
    "globalScore": 0.92,
    "totalSegments": 42,
    "verifySegments": 7,
    "lowSegments": 3,
    "modifiedSegments": 5
  },
  "segmentsConfidence": [
    {
      "segmentId": "s1",
      "segmentIndex": 0,
      "score": 0.52,
      "wordCount": 12,
      "level": "low",
      "textModified": true
    }
  ]
}
```

Si `available !== true` : transcript normal, aucun message utilisateur.

### Extension V3 optionnelle (mot-à-mot)

Le backend peut enrichir chaque segment sans casser V2.1 :

```json
{
  "segmentId": "s12",
  "score": 0.72,
  "level": "verify",
  "textModified": false,
  "wordCount": 8,
  "originalTextHash": "fnv1a:3f31a8c2",
  "issues": [
    {
      "text": "climatisé",
      "score": 0.6,
      "level": "low",
      "startChar": 11,
      "endChar": 20,
      "startTime": 20.1,
      "endTime": 20.8,
      "wordIndex": 2
    }
  ]
}
```

Le frontend applique `issues[]` uniquement si les offsets correspondent encore au texte affiché. Si le texte a été modifié ou si les issues ne correspondent pas, il retire le surlignage mot-à-mot et garde le signal segment-level.

## Comportement V2.4/V3

- Confidence **segment-level** par défaut : badge dans `.ag-seg__head` + fond arrondi léger sur `.ag-seg__text`
- Wording visible : « À relire » / « Prioritaire » (jamais « Faible confiance »)
- Score `%` affiché en secondaire : « Qualité estimée », avec tooltip explicatif
- Scores **conservés après édition** + badge « Modifié depuis transcription »
- États de revue locaux : « Relu », « Ignoré », « Réouvrir »
- Panneau global sticky/floating : passages à relire en premier, score en secondaire, boutons « Passage précédent » / « Passage suivant » (titles Alt+←/→), compteur `Passage X / N`, toggle « Passages à relire »
- Cas zéro : ligne sobre « Aucun passage signalé à relire · Qualité estimée »
- Après revue complète : ligne sobre « Tous les passages signalés sont traités »
- Helper one-shot si des passages existent : explique brièvement pourquoi relire ces passages, bouton « Compris »
- Désactivation utilisateur locale : les repères sont masqués mais le panneau minimal reste affiché pour réactiver
- Raccourcis hors édition : `Alt+ArrowRight` passage suivant, `Alt+ArrowLeft` passage précédent (mêmes actions que les boutons ; navigation circulaire)
- Extension V3 : surlignage `mark.ag-confidence-word` si `issues[]` compatible
- `summary.globalScore` utilisé tel quel (pondéré back par `wordCount`)
- Sauvegarde : JSON principal seul — jamais de champs confidence
- Feature flag : `window.AGILOTEXT_ENABLE_CONFIDENCE = false` désactive tout
- Textes UX neutres : « Passages à relire », « À relire », « Prioritaire », « Qualité estimée »

## Activation et préférences

- Activation globale Webflow : `window.AGILOTEXT_ENABLE_CONFIDENCE = true|false`
- Disponibilité backend par job : `available:true|false`
- Préférence utilisateur locale : `localStorage.getItem('agilo:confidence-visible:v1')`
- Helper déjà vu : `localStorage.getItem('agilo:confidence-helper-seen:v1')`

Le toggle éditeur ne remplace pas le flag Webflow : il masque uniquement les repères pour l'utilisateur courant sur ce navigateur.

## API publique client

```js
window.AgiloConfidence = {
  reload,
  clear,
  markSegmentModified,
  setReviewState,
  goToNextConfidenceZone,
  goToPreviousConfidenceZone,
  buildNavControlsHtml,
  toggleUserConfidenceVisible,
  toggle
};
```

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `confidence-v1/editor-main-confidence.js` | Loader test isolé |
| `confidence-v1/Code-main-editor-IFRAME_V04-confidence.js` | V04 + hooks confidence |
| `confidence-v1/agilo-confidence.js` | Module V2.4/V3 confidence |
| `confidence-v1/agilo-confidence.css.js` | Styles badges + panneau + highlights |
| `../Code-main-editor-IFRAME_V04.js` | **Prod — ne pas modifier** |

## Tests

```bash
node scripts/pages/editor/confidence-v1/agilo-confidence.test.mjs
```

## Checklist validation (Nicolas)

Voir [`confidence-v1/README.md`](../../scripts/pages/editor/confidence-v1/README.md) — section « Checklist validation manuelle ».
