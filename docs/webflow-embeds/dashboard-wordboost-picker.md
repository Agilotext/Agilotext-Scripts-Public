# Picker lexique dashboard (mots à surveiller)

**Branche :** `feat/dashboard-wordboost-picker`  
**Staging seulement :** `https://agilotext-test.webflow.io`  
**Prod www :** ne pas pin tant que Magalie n’a pas validé le visuel.

Le lexique existe déjà dans Mon compte (`wordboost2.js`, `setWordBoostDefault2`). Le dashboard affiche une **ligne details** sous le picker PV : le nom du défaut reste visible, le select s’ouvre à la flèche.

## Ce que ça fait

- Ancre `#agilo-wb-picker-anchor` injectée sous le bloc PV (`#agilo-prompt-picker-anchor`).
- Summary : **Mots à surveiller** + nom `(défaut)`. Ouvert : `select.custom-select.grey` (même contrat que `#wb2-select`). Lien **Gérer** toujours visible, y compris liste vide.
- Catalogue 1:1 `fillSelect` : toute `boostNamesDTOList`, pick défaut puis `wb2:lastThemeId` puis premier. `setWordBoostDefault2` au change.
- **Pas** de 6e interrupteur orange, **pas** de chips / CSV, **pas** sous « Joindre des documents ».
- **Pas** de `boostId` dans le `FormData` upload tant que Nico n’a pas confirmé le champ.

## Fichier

```
scripts/pages/dashboard/agilo-wb-picker.js   (1.1.0)
```

Ne pas coller `wordboost2.js` dans le dashboard.

## Embed (après le picker PV)

Pin **footer custom code** (les 3 dashboards), une ligne après les scripts upload / FilePond. SHA `063b28c5`. Remplacer **seulement** cette ligne, jamais tout le footer.

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@063b28c5/scripts/pages/dashboard/agilo-wb-picker.js?v=063b28c5"></script>
```

Le JS injecte `#agilo-wb-picker-anchor` sous le bloc PV. Staging only.

## Recette Magalie CSE

1. Dashboard Business staging : le thème affiché = celui marqué `(défaut)` au compte.
2. Changer le select **avant Envoyer**, uploader un audio, vérifier l’ortho du thème choisi.
3. Lien **Gérer** ouvre l’onglet mots-clés du profil.
4. Le picker reste visible si le toggle CR/PV est off.

Inconvénient v1 : changer le select met à jour le défaut compte (CSE le matin, lexique générique l’après-midi). Suffisant pour une semaine CSE, pas pour deux lexiques le même matin.

## Pin

| Surface | Pin jsDelivr | Où |
|---------|--------------|-----|
| Dashboard Business `6815bee5a9c0b57da183557c` | `063b28c5` | Footer custom code, staging `agilotext-test` |
| Dashboard Pro `6815bee5a9c0b57da183550e` | `063b28c5` | Idem |
| Dashboard Free `6815bee5a9c0b57da183550c` | `063b28c5` | Idem |

Ne jamais `sites_publish` www sans OK Florian.
