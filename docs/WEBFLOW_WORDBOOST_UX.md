# Webflow — Mots à surveiller (WordBoost)

Page : **Mon compte → Mots à surveiller** (`/app/business/profile?tab=mots-cles`)

## Déploiement (obligatoire)

1. Ouvrir l’embed **Mots à surveiller** (classe Webflow `code-mots-cl-s`).
2. **Supprimer entièrement** l’ancien bloc inline  
   `<script id="wordboost2-module">… r13 …</script>`  
   (ne jamais laisser r13 + CDN en même temps).
3. Coller **uniquement** :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@<dbe36dcdee374343677afa27464435402cfb78e6>/scripts/pages/profile/wordboost2.js?v=r14.1"></script>
```

Remplacer `<dbe36dcdee374343677afa27464435402cfb78e6>` par le SHA du commit r14.1 (voir fin de [`docs/WORDBOOST.md`](WORDBOOST.md) après push).

Alternative : coller le fichier [`Script a changer`](../Script%20a%20changer) **à la place** de l’inline (pas en plus).

## Textes à mettre dans Webflow

### Sous l’input de saisie (`.chip-input`)

> Lettres, chiffres, tiret et apostrophe. Les accents sont acceptés à la saisie ; les ligatures du type « œ » sont normalisées (ex. Sœurs → Soeurs). Évitez symboles et crochets. Jusqu’à 100 termes ; expressions jusqu’à 6 mots.

### Sous le bouton « Importer CSV » / collage liste

> Fichier .csv ou .txt, un mot par ligne. Depuis Excel : copiez la colonne et collez dans la zone « Coller une liste » ci-dessus.

### Élément `#status-error` — texte fallback

> Un terme n’a pas pu être enregistré côté serveur. Vérifiez la liste (caractères spéciaux, ligatures) puis sauvegardez à nouveau. Si le problème continue avec un mot simple, contactez le support.

## Placeholder input

Géré automatiquement par le script r14+ :

`Ex : Grand Maître, Jean-François, 261B…`

## Vérification après déploiement

1. Network : un seul `wordboost2.js` depuis jsDelivr (plus de script inline r13).
2. Ajouter « Sœurs » → devient « Soeurs » avec toast de normalisation.
3. Ajouter `oiuytr` → Sauvegarder : si pastille Erreur + toast « crochets » / mail `got "[oiuytr]"`, c’est un **bug backend** (voir ticket Nicolas), pas l’embed.
4. Console : `?v=r14.1` chargé.

## Checklist Network (Phase 0 audit)

Filtrer `setWordBoost2` / `getStatusWordBoost2` / `getWordBoost2` :

- body attendu : `wordBoost={"wordBoost":["oiuytr"]}` (sans crochets autour du mot) ;
- si HTTP OK puis `wordboostStatus=ON_ERROR` avec `got "[oiuytr]"` → Java `List.toString` / parse côté API.
