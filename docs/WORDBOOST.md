# WordBoost — règles et scripts

## Règles côté API (custom_spelling)

Les termes sont validés en deux étapes :

1. **Liste word_boost** — lettres Unicode, chiffres, espaces, apostrophe, tiret (max 100 car./terme, 100 termes)
2. **Custom spelling (to_word)** — après normalisation : ASCII A-Z, chiffres, apostrophe, tiret uniquement

**Ligatures** (`œ`, `æ`, `ß`, ligatures typographiques Word `ﬁ`/`ﬂ`) doivent être converties en `oe`, `ae`, `ss`, `fi`, `fl` **avant** envoi, sinon status `ON_ERROR`.

**Artefact connu (2026-07-27)** : l’API peut échouer avec  
`Invalid to-word: … got "[oiuytr]"`  
alors que le front envoie `{"wordBoost":["oiuytr"]}`. Hypothèse : `List.toString()` passé à `ToWordNoSpecialCharsConverter.sanitize` (boost 146, démo Florian). Voir ticket Nicolas + [`webflow-embeds/WORDBOOST_AUDIT_ON_ERROR_2026-07-27.md`](webflow-embeds/WORDBOOST_AUDIT_ON_ERROR_2026-07-27.md).

## Fichiers

| Fichier | Rôle |
|---------|------|
| `scripts/shared/wordboost-sanitize.mjs` | Module Node : unwrap crochets, ligatures, `sanitizeWordList` |
| `scripts/shared/wordboost-sanitize.test.mjs` | Tests unitaires sanitize |
| `scripts/pages/profile/wordboost2.js` | Front Webflow Mon compte (**r14.1**) |
| `Script a changer` | Copie inline Webflow (coller dans la page) |

## Scripts admin (Node)

```js
import { sanitizeWordList } from "../../../Agilotext-Scripts-Public/scripts/shared/wordboost-sanitize.mjs";

const rawWords = parseTokens(md);
const { words, corrected, rejected } = sanitizeWordList(rawWords);
```

## Déploiement Webflow

Voir [`docs/WEBFLOW_WORDBOOST_UX.md`](WEBFLOW_WORDBOOST_UX.md).

**CDN pin (remplacer SHA après push r14.1) :**

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@dbe36dcdee374343677afa27464435402cfb78e6/scripts/pages/profile/wordboost2.js?v=r14.1"></script>
```

## Backend Java (Nicolas uniquement)

Le backend **n’est pas modifié** dans ce repo. Contournements front : normalisation ligatures + unwrap défensif `[mot]` + toasts ON_ERROR.

Proposition : `CNOEC_Agiloshield_Docs/PATCH_WORDBOOST_LIGATURES_NICOLAS.md`
