# WordBoost — règles et scripts

## Règles côté API (custom_spelling)

Les termes sont validés en deux étapes :

1. **Liste word_boost** — lettres Unicode, chiffres, espaces, apostrophe, tiret (max 100 car./terme, 100 termes)
2. **Custom spelling (to_word)** — après normalisation : ASCII A-Z, chiffres, apostrophe, tiret uniquement

**Ligatures** (`œ`, `æ`, `ß`, ligatures typographiques Word `ﬁ`/`ﬂ`) doivent être converties en `oe`, `ae`, `ss`, `fi`, `fl` **avant** envoi, sinon status `ON_ERROR`.

## Fichiers

| Fichier | Rôle |
|---------|------|
| `scripts/shared/wordboost-sanitize.mjs` | Module Node : `normalizeLigatures`, `validateWord`, `sanitizeWordList` |
| `scripts/pages/profile/wordboost2.js` | Front Webflow Mon compte (r14) |
| `Script a changer` | Copie inline Webflow (coller dans la page) |

## Scripts admin (Node)

Tout script `apply_*_wordboost.mjs` doit importer le module partagé :

```js
import { sanitizeWordList } from "../../../Agilotext-Scripts-Public/scripts/shared/wordboost-sanitize.mjs";

const rawWords = parseTokens(md);
const { words, corrected, rejected } = sanitizeWordList(rawWords);
```

## Déploiement Webflow

Page **Mon compte → Mots à surveiller** :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/pages/profile/wordboost2.js"></script>
```

Ou coller le contenu de `Script a changer` (inline).

Voir aussi `docs/WEBFLOW_WORDBOOST_UX.md` pour les textes à ajouter dans Webflow.

## Backend Java (Nicolas uniquement)

Le backend **n'est pas modifié** dans ce repo. Les scripts front/admin normalisent les termes avant envoi pour rester compatibles avec `ToWordNoSpecialCharsConverter` actuel.

Proposition optionnelle pour Nicolas : `CNOEC_Agiloshield_Docs/PATCH_WORDBOOST_LIGATURES_NICOLAS.md`
