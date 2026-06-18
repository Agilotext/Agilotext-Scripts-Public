# Webflow — Confidence Speechmatics V2 (segment-level, test isolé)

> **Important :** la prod Webflow ne doit **pas** être modifiée. Les scripts prod (`Code-main-editor-IFRAME_V04.js`, `editor-main.js`, etc.) restent inchangés.

Toute l'expérimentation confidence vit dans :

```text
scripts/pages/editor/confidence-v1/
```

Source de vérité : `PLAN_CONFIDENCE_CLIENT_v2.md` (Nicolas).

## Prod (inchangé)

Continuer d'utiliser l'embed actuel :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/pages/editor/Code-main-editor-IFRAME_V04.js"></script>
```

## Test confidence (page staging uniquement)

```html
<script>window.AGILOTEXT_ENABLE_CONFIDENCE = true;</script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/pages/editor/confidence-v1/editor-main-confidence.js"></script>
```

## API backend

```http
POST /api/v1/receiveConfidenceTextJson
Content-Type: application/x-www-form-urlencoded;charset=UTF-8
```

Paramètres : `username`, `token`, `edition`, `jobId`

### Contrat V2 (segmentsConfidence)

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

## Comportement V2

- Confidence **segment-level** (badges dans `.ag-seg__head`, pas de highlight mot-à-mot)
- Scores **conservés après édition** + badge « Texte modifié »
- Panneau global : score, compteurs, « Zone suivante », « Masquer »
- `summary.globalScore` utilisé tel quel (pondéré back par `wordCount`)
- Sauvegarde : JSON principal seul — jamais de champs confidence
- Feature flag : `window.AGILOTEXT_ENABLE_CONFIDENCE = false` désactive tout

## API publique client

```js
window.AgiloConfidence = {
  reload,              // recharger confidence pour le job courant
  clear,                 // nettoyer UI confidence
  markSegmentModified,   // appelé à l'édition d'un segment
  toggle                 // masquer / afficher badges + panneau
};
```

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `confidence-v1/editor-main-confidence.js` | Loader test isolé |
| `confidence-v1/Code-main-editor-IFRAME_V04-confidence.js` | V04 + hook confidence |
| `confidence-v1/agilo-confidence-speechmatics.js` | Module V2 segment-level |
| `confidence-v1/agilo-confidence-speechmatics.css.js` | Styles badges + panneau |
| `../Code-main-editor-IFRAME_V04.js` | **Prod — ne pas modifier** |

## Tests

```bash
node scripts/pages/editor/confidence-v1/agilo-confidence-speechmatics.test.mjs
```

## Documentation

- [`confidence-v1/README.md`](../../scripts/pages/editor/confidence-v1/README.md)
- [`docs/analysis/confidence-speechmatics-brief-codex-nicolas.md`](../analysis/confidence-speechmatics-brief-codex-nicolas.md)
