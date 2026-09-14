# Éditeur : picker CR compact (staging)

Surface : HtmlEmbed `code-redo-modele-compte-rendu` uniquement pour ce SHA. Pin jsDelivr `@SHA` dans le `code` de l’embed. Ne pas coller le JS.

**Branche :** `fix/editor-model-label-staging` depuis le blob live `637a1ae4` (pas `origin/1.11` : relance + modeles + `agilo-cr-history.js` diffèrent).

**Publish :** `agilotext-test` only. www inchangé.

## SHA

| Rôle | SHA |
|------|-----|
| Live avant (rollback creds / history / modeles) | `637a1ae4637e0644bc91cc5713af9984d683d000` |
| Relance (inchangé) | `70af415d97053914795f3260ed201de243f9082f` |
| Picker CR (`Code-modeles-compte-rendu.js`) | à coller après push |

## Pages

Site `6815bee5a9c0b57da18354fb`.

| Édition | pageId | Path |
|---------|--------|------|
| Business | `68e0f3b838626e418962aeff` | `/app/business/editor` |
| Pro | `68ed41f20988e833cb4e3148` | `/app/premium/editor` |
| Free | `68ed64995fcf3e0b0b452916` | `/app/free/editor` |

Composants partagés (1 écriture, 3 instances : Business + Pro + Free) :

- `Code-Redo_summary` `086fb264-cc10-e6df-a42f-e8c803b7855e` : creds + history `@637a1ae4`, relance `@70af415d`
- `Code-Redo-modele-compte-rendu` `04149a5d-6e7f-6c56-0bb7-aa8c58b5979a` : modeles `@nouveauSHA`

## Snapshot rollback (HtmlEmbed `code`)

Ordre à conserver : creds, relance, history. Modeles dans l’autre embed.

```html
<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@637a1ae4637e0644bc91cc5713af9984d683d000/scripts/pages/editor/agilo-editor-creds.js?v=1.07"></script>
<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@70af415d97053914795f3260ed201de243f9082f/scripts/pages/editor/relance-compte-rendu.js?v=70af415d"></script>
<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@637a1ae4637e0644bc91cc5713af9984d683d000/scripts/pages/editor/agilo-cr-history.js?v=637a1ae4"></script>
```

```html
<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@637a1ae4637e0644bc91cc5713af9984d683d000/scripts/pages/editor/Code-modeles-compte-rendu.js?v=637a1ae4"></script>
```

## Recette

Compte test, job `1000040491` : [éditeur staging](https://agilotext-test.webflow.io/app/business/editor?jobId=1000040491&edition=ent).

- Transcription / Assistant / Compte rendu : **même** largeur de colonne droite (Raccourcis).
- Plus de liste « Modèles de compte-rendu » à droite.
- Onglet Compte rendu : select compact collé à Régénérer (icône + nom, ex. Compte Rendu SWOT). Panneau liste plate avec icônes. Pas de dictée.
- Clic autre modèle : `confirm()` avec le **nom**, puis `redoSummary`.
- Régénérer bleu : même `promptId` actuel, confirm **nom**.
- Free : lignes `is-locked` + AgiloGate.
- www : 0 occurrence du SHA picker.

## Rollback

Recoller les `code` snapshot ci-dessus (modeles `@637a1ae4` ou relance+modeles `@70af415d` selon le palier). Re-publish staging only.
