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

Composants partagés (1 écriture, 3 instances : Business + Pro + Free) :

- `Code-Redo_summary` `086fb264-cc10-e6df-a42f-e8c803b7855e`
- `Code-Redo-modele-compte-rendu` `04149a5d-6e7f-6c56-0bb7-aa8c58b5979a`

## Snapshot rollback (HtmlEmbed `code`)

Ordre à conserver : creds, relance, history. Modeles dans l’autre embed.

```html
<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@637a1ae4637e0644bc91cc5713af9984d683d000/scripts/pages/editor/agilo-editor-creds.js?v=1.07"></script>
<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@637a1ae4637e0644bc91cc5713af9984d683d000/scripts/pages/editor/relance-compte-rendu.js?v=637a1ae4"></script>
<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@637a1ae4637e0644bc91cc5713af9984d683d000/scripts/pages/editor/agilo-cr-history.js?v=637a1ae4"></script>
```

```html
<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@637a1ae4637e0644bc91cc5713af9984d683d000/scripts/pages/editor/Code-modeles-compte-rendu.js?v=637a1ae4"></script>
```

Pin live (14 sept. 2026) : `relance-compte-rendu.js` et `Code-modeles-compte-rendu.js` sur `@70af415d97053914795f3260ed201de243f9082f`. Creds + `agilo-cr-history.js` restent sur `637a1ae4`.

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
