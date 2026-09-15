# Picker lexique dashboard (mots à surveiller)

**Branche :** `feat/dashboard-wordboost-picker`  
**Staging seulement :** `https://agilotext-test.webflow.io`  
**Prod www :** ne pas pin tant que Magalie n’a pas validé le visuel.

Le lexique existe déjà dans Mon compte (`wordboost2.js`, `setWordBoostDefault2`). Le dashboard affiche une **ligne muted** sous le picker PV (même gabarit de taille que « Créer un modèle », pas orange, pas gras).

## Ce que ça fait

- Ancre `#agilo-wb-picker-anchor` injectée sous le bloc PV (`#agilo-prompt-picker-anchor`).
- Summary Pro/Business : `Mots à surveiller · nom (défaut) ▾`. Ouvert : select max 280px. **Pas** de lien Gérer.
- Free : même ligne, texte `réservé Pro et Business`. Clic = `AgiloGate.showUpgrade('pro', 'Mots à surveiller')` (alert fallback). Pas de select, pas d’appel API.
- Catalogue 1:1 `fillSelect` (Pro/Business). `setWordBoostDefault2` au change. Liste vide OK : widget caché. Erreur API : toast, widget caché.
- **Pas** de 6e interrupteur orange, **pas** de chips / CSV, **pas** sous « Joindre des documents ».
- **Pas** de `boostId` dans le `FormData` upload tant que Nico n’a pas confirmé le champ.

## Fichier

```
scripts/pages/dashboard/agilo-wb-picker.js   (1.2.0)
```

Ne pas coller `wordboost2.js` dans le dashboard.

## Embed (après le picker PV)

Pin **footer custom code** (les 3 dashboards), une ligne après les scripts upload / FilePond. SHA `d9f19c90`. Remplacer **seulement** cette ligne, jamais tout le footer.

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@d9f19c90/scripts/pages/dashboard/agilo-wb-picker.js?v=d9f19c90"></script>
```

Le JS injecte `#agilo-wb-picker-anchor` sous le bloc PV. Staging only.

## Recette Magalie CSE

1. Dashboard Business / Pro staging, hard refresh : ligne petite, select, change = défaut.
2. Dashboard Free staging : ligne `réservé Pro et Business`, clic = popup upgrade, pas de select.
3. Compte Pro/Business sans thème : rien d’affiché. Erreur API : toast.

Inconvénient v1 : changer le select met à jour le défaut compte (CSE le matin, lexique générique l’après-midi). Suffisant pour une semaine CSE, pas pour deux lexiques le même matin.

## Pin

| Surface | Pin jsDelivr | Où |
|---------|--------------|-----|
| Dashboard Business `6815bee5a9c0b57da183557c` | `d9f19c90` | Footer custom code, staging `agilotext-test` |
| Dashboard Pro `6815bee5a9c0b57da183550e` | `d9f19c90` | Idem |
| Dashboard Free `6815bee5a9c0b57da183550c` | `d9f19c90` | Idem |

Ne jamais `sites_publish` www sans OK Florian.
