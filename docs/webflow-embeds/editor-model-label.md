# Éditeur : nom du modèle CR (staging)

Surface : HtmlEmbed `code-redo_summary` et `code-redo-modele-compte-rendu` (pas le footer page). Pin jsDelivr `@SHA` dans le `code` de l’embed. Ne pas coller le JS.

**Branche :** `fix/editor-model-label-staging` depuis le blob live `637a1ae4` (pas `origin/1.11` : relance + modeles + `agilo-cr-history.js` diffèrent).

**Publish :** `agilotext-test` only. www inchangé.

## SHA

| Rôle | SHA |
|------|-----|
| Live avant (rollback) | `637a1ae4637e0644bc91cc5713af9984d683d000` |
| Nouveau (JS) | `70af415d97053914795f3260ed201de243f9082f` |

## Pages

Site `6815bee5a9c0b57da18354fb`.

| Édition | pageId | Path |
|---------|--------|------|
| Business | `68e0f3b838626e418962aeff` | `/app/business/editor` |
| Pro | `68ed41f20988e833cb4e3148` | `/app/premium/editor` |
| Free | `68ed64995fcf3e0b0b452916` | `/app/free/editor` |

## Snapshot rollback (HtmlEmbed `code`)

Ordre à conserver : creds, relance, history. Modeles dans l’autre embed.

```html
<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@637a1ae4637e0644bc91cc5713af9984d683d000/scripts/pages/editor/agilo-editor-creds.js"></script>
<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@637a1ae4637e0644bc91cc5713af9984d683d000/scripts/pages/editor/relance-compte-rendu.js"></script>
<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@637a1ae4637e0644bc91cc5713af9984d683d000/scripts/pages/editor/agilo-cr-history.js"></script>
```

```html
<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@637a1ae4637e0644bc91cc5713af9984d683d000/scripts/pages/editor/Code-modeles-compte-rendu.js"></script>
```

Pin nouveau : remplacer **seulement** `@637a1ae4637e0644bc91cc5713af9984d683d000` par `@70af415d97053914795f3260ed201de243f9082f` sur `relance-compte-rendu.js` et `Code-modeles-compte-rendu.js`. Garder creds + `agilo-cr-history.js` sur `637a1ae4`.

## Recette

- Bandeau `#agilo-current-model` visible sur Transcription et Compte rendu.
- Rail : lignes (pas 3 colonnes). Un accordéon ouvert. Chip actuel non `disabled`.
- Régénérer : `confirm()` avec le nom. Relance le même modèle.
- Autre chip : `confirm()` nom, une régénération.
- `promptId -1` : « Aucun compte-rendu demandé » / phrase sans ID, jamais `ID 2`.
- Historique CR, dock, chat, Surligner : inchangés.
- www : 0 occurrence du SHA `70af415d`.

## Rollback

Recoller les `code` snapshot ci-dessus. Re-publish staging only.
