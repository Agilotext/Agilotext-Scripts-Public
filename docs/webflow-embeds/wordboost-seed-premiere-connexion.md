# Semis WordBoost, première connexion

Un thème `Mes mots` (prénom, nom, Agilotext) est créé une seule fois, seulement si le compte n’a encore aucun thème. Ce n’est pas la tâche Nicolas « Agilotext forcé sur tous les comptes », ni le décalage extension / application / streaming.

## Pages

| Dashboard | Page Webflow | Pin |
| --- | --- | --- |
| Premium `/app/premium/dashboard` | `6815bee5a9c0b57da183550e` | oui |
| Business `/app/business/dashboard` | `6815bee5a9c0b57da183557c` | oui |
| Free `/app/free/dashboard` | `6815bee5a9c0b57da183550c` | non |

Le picker déjà en place : `agilo-wb-picker.js@d9f19c90`. Le profil Premium et Business charge `wordboost2.js@bb4e49cb`. Le profil Free ne le charge pas. On n’ajoute pas `wordboost2.js` sur les tableaux de bord.

Pin, juste après le picker :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@SHA/scripts/pages/dashboard/agilo-wb-seed.js"></script>
```

Pas de collage du fichier. Pas dans le head du site. Staging d’abord. www et l’apex seulement avec une phrase qui nomme les tableaux de bord Premium et Business.

## Comportement

- Édition `pro` sur Premium, `ent` sur Business. Un CSE seul est déjà sur Business.
- `getWordBoostInfo2` vide : `setWordBoost2` avec `boostId` 0, puis `setWordBoostDefault2`.
- Liste déjà remplie : rien. On n’ajoute pas Agilotext dans un thème existant.
- Verrou `localStorage` `wb-seed-lock` pendant l’appel, marqueur `wb-seed-v1` après succès.
- Pas de toast. Erreur API : silence, la page continue.

## Recette staging

1. Compte Premium sans thème : `Mes mots` devient le défaut, mots = prénom, nom, Agilotext.
2. Rechargement : pas de second thème.
3. Compte qui a déjà un thème : aucun nouveau thème.
4. Business : même chose.
5. Free : le script n’est pas sur la page.
