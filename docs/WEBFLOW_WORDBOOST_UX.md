# Webflow — Mots à surveiller (WordBoost)

Page : **Mon compte → Mots à surveiller** (`/fr/business/mon-compte`)

## Script

Remplacer l'inline actuel par :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/pages/profile/wordboost2.js"></script>
```

Ou coller le contenu de [`Script a changer`](../Script%20a%20changer) dans un embed HTML.

## Textes à ajouter dans Webflow

### Sous l'input de saisie (`.chip-input`)

> Lettres, chiffres, tiret, apostrophe. Les accents sont acceptés. Les expressions composées fonctionnent (ex : Grand Maître Adjoint).

### Sous le bouton « Importer CSV »

> Fichier .csv ou .txt, un mot par ligne. Depuis Excel : copiez la colonne et collez dans la zone « Importer une liste » ci-dessus.

### Élément `#status-error` — texte fallback (si l'API ne renvoie pas de détail)

> Un terme de votre liste contient un caractère non supporté. Corrigez votre liste et sauvegardez à nouveau.

## Placeholder input

Géré automatiquement par le script r14 :

`Ex : Grand Maître, Jean-François, 261B…`

## Vérification après déploiement

1. Ajouter « Sœurs » → doit devenir « Soeurs » avec toast de normalisation
2. Importer un .csv Windows (accents) → mots acceptés
3. Tenter un .xlsx → message guide Excel affiché
4. Terme « Très Sage et Parfait Grand Vénérable » (6 mots) → accepté
