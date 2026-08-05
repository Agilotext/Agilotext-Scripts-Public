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
- Panneau global sticky/floating : passages à relire en premier, score en secondaire, bouton « Passage suivant », toggle « Passages à relire »
- Cas zéro : ligne sobre « Aucun passage signalé à relire · Qualité estimée »
- Après revue complète : ligne sobre « Tous les passages signalés sont traités »
- Helper one-shot si des passages existent : explique brièvement pourquoi relire ces passages, bouton « Compris »
- Désactivation utilisateur locale : les repères sont masqués mais le panneau minimal reste affiché pour réactiver
- Raccourcis hors édition : `Alt+ArrowRight` passage suivant, `Alt+ArrowLeft` passage précédent
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
  toggleUserConfidenceVisible,
  toggle
};
```

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `confidence-v1/editor-main-confidence.js` | Loader test isolé |
| `confidence-v1/Code-main-editor-IFRAME_V04-confidence.js` | V04 + hooks confidence (`__agiloEditorConfidenceVersion`) |
| `confidence-v1/agilo-confidence.js` | Module V2.4/V3 confidence |
| `confidence-v1/agilo-confidence.css.js` | Styles badges + panneau + highlights |
| `confidence-v1/DIAGNOSTIC_PASSAGES_A_RELIRE.js` | Diagnostic console recouvrement onglets |
| `../Code-main-editor-IFRAME_V04.js` | **Prod — ne pas modifier** |

## Correctif 1.09.3 — onglets masqués après « Passage suivant »

**Symptôme :** après plusieurs clics sur « Passage suivant », la barre Transcription / Compte rendu / Assistant disparaît. Remonter en haut de page ne suffit pas, il faut recharger.

**Cause :** `activateNavTarget()` appelait `art.scrollIntoView({ block: 'center' })`, ce qui scrollait aussi `.ed-body` (`overflow:hidden`). Le conteneur n'a pas de barre de défilement utilisable : les onglets sortent du cadre découpé sans retour possible.

**Fix :** `scrollSegmentIntoView()` borne le scroll au seul conteneur `overflow:auto` (`#pane-transcript`), restaure les positions des autres ancêtres, active l'onglet Transcription si besoin, garde JS shell (sticky retiré en 1.09.4).

Le correctif 1.09.2 (recouvrement panneau flottant) reste utile mais ne couvrait pas ce scénario.

Voir aussi [`inline-embed-scripts.md`](./inline-embed-scripts.md) section « Passages à relire ».

Version attendue en console : `window.__agiloEditorConfidenceVersion === '1.09.4'` (voir aussi 1.09.3 pour le scroll Passage suivant)


## Correctif 1.09.4 — menus de téléchargement masqués

**Symptôme :** les panneaux « Télécharger transcription » / « Télécharger compte rendu » passent sous la barre d'onglets (milieu du menu invisible).

**Cause :** le filet sticky 1.09.3 (`position: sticky; background: #fff; z-index: 40`) peignait par-dessus les dropdowns Webflow (`.wrapper-message-pro.download`, sans z-index, ouverts depuis `.ed-actions` placé avant `.ed-body`).

**Fix :** retour à `position: relative; z-index: 40` sans fond opaque ; filet remplacé par `startEditorShellScrollGuard()` qui remet `.ed-body` / `.ed-main` à `scrollTop: 0` uniquement si `overflow: hidden`.

Version attendue en console : `window.__agiloEditorConfidenceVersion === '1.09.4'`

## Tests

```bash
node scripts/pages/editor/confidence-v1/agilo-confidence.test.mjs
```

Couvre notamment : scroll « Passage suivant » borné, restauration scroll ancêtres, activation onglet Transcription, top flottant sous chrome, restauration d'un volet si aucun `.is-active`, persistence toggle ON/OFF sans rechargement.

## Checklist validation (Nicolas)

Voir [`confidence-v1/README.md`](../../scripts/pages/editor/confidence-v1/README.md) — section « Checklist validation manuelle ».
