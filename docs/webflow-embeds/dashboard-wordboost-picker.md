# Picker lexique dashboard (mots à surveiller)

**Branche :** `feat/dashboard-wordboost-picker`  
**Staging seulement :** `https://agilotext-test.webflow.io`  
**Prod www :** ne pas pin tant que Magalie n’a pas validé le visuel.

Le lexique existe déjà dans Mon compte (`wordboost2.js`, `setWordBoostDefault2`). Le dashboard ne le montrait pas au drop. Ce widget ajoute un 2e picker, jumeau visuel du picker PV, **toujours visible** (le lexique s’applique même sans CR).

## Ce que ça fait

- Ancre `#agilo-wb-picker-anchor` injectée sous le bloc PV (`#agilo-prompt-picker-anchor`).
- Libellé **Mots à surveiller**, select des thèmes, pastille **Par défaut**, lien **Gérer** vers `/app/{free|premium|business}/profile?tab=mots-cles`.
- Charge `getWordBoostInfo2`, enregistre `setWordBoostDefault2` au change (même contrat que le bouton Définir défaut du compte).
- **Pas** de 6e interrupteur orange, **pas** de chips / CSV sur le tableau de bord.
- **Pas** de `boostId` dans le `FormData` upload tant que Nico n’a pas confirmé le champ. L’upload continue d’appliquer le défaut compte.

## Fichier

```
scripts/pages/dashboard/agilo-wb-picker.js   (1.0.0)
```

Ne pas coller `wordboost2.js` dans le dashboard.

## Embed (après le picker PV)

Même HtmlEmbed que `library-picker.js`, **une ligne de plus** après le SHA du picker PV. Remplacer `SHA` par le commit après push.

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@SHA/scripts/pages/dashboard/agilo-wb-picker.js?v=SHA"></script>
```

Répéter sur les 3 dashboards (Business / Pro / Free). Staging only.

## Recette Magalie CSE

1. Dashboard Business staging : le thème affiché = celui marqué `(défaut)` au compte.
2. Changer le select **avant Envoyer**, uploader un audio, vérifier l’ortho du thème choisi.
3. Lien **Gérer** ouvre l’onglet mots-clés du profil.
4. Le picker reste visible si le toggle CR/PV est off.

Inconvénient v1 : changer le select met à jour le défaut compte (CSE le matin, lexique générique l’après-midi). Suffisant pour une semaine CSE, pas pour deux lexiques le même matin.

## Pin

| Surface | Pin jsDelivr | Où |
|---------|--------------|-----|
| Dashboard Business / Pro / Free | `SHA` (après push) | HtmlEmbed picker PV, staging `agilotext-test` |

Ne jamais `sites_publish` www sans OK Florian.
