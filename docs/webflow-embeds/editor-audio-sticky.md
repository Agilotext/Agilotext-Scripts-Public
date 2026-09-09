# Webflow — Verrou de coque + chip relire (éditeur)

**Staging only.** Ne pas coller sur www tant que la recette ci-dessous n’est pas OK.

## Comportement

- `#agilo-audio-wrap` (lecteur Netflix) reste dans le HTML Webflow, inchangé.
- `#ag-editor-pin-host` est créé dans `main.ed-main`, avant le premier `.edtr-pane`. Dedans : chip relire (premier enfant) puis `#ag-editor-audio-row`.
- Quand le gros lecteur quitte le viewport : `html.ag-editor-shell-lock` (`overflow:hidden; height:100dvh`), `.page-wrapper{overflow:visible}`, `.ed-body` à `100dvh`. Un seul scroll utile ensuite : `#pane-transcript`.
- Molette (ou swipe) vers le haut en haut du transcript : déverrouillage, le gros lecteur revient.
- Pas de `position:fixed` sur le chemin nominal. Filet `.is-fallback-fixed` (`z-index:5`) seulement si un ancêtre overflow empêche le lock. Ce n’est pas le chemin de recette.
- Chip toujours visible s’il y a des données : `3 passages à relire` / `1 passage à relire` / `Aucun passage à relire`. Interrupteur **éteint par défaut** (clé `agilo:confidence-visible:v2`, v1 ignorée). Bouton `?` même si off. Chevrons seulement si on et passages restants. Helper auto une fois (`helper-seen:v1`) même interrupteur off.

Le sticky V1 `@8c7da101` (`position:fixed`), le slot `@cf0fe680` et le pin dock spacer sont **obsolètes**. Les remplacer, ne pas empiler une seconde ligne.

## Embed audio (fin de `.code-lecteur-audio`)

Garder `Code-lecteur-audio-V3.4.js`. **Une** ligne audio, même SHA que confidence :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@PIN_SHA/scripts/pages/editor/agilo-audio-sticky.js?v=audio-lock-1"></script>
```

`PIN_SHA` = commit Git qui contient **à la fois** `agilo-audio-sticky.js` et `confidence-v1/agilo-confidence.js` + `.css.js`. Après `git push`.

## Embed confidence (même SHA, staging)

Remplacer les pins JS+CSS confidence (pas le loader iframe sauf besoin) :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@PIN_SHA/scripts/pages/editor/confidence-v1/agilo-confidence.css.js?v=chip-3"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@PIN_SHA/scripts/pages/editor/confidence-v1/agilo-confidence.js?v=chip-3"></script>
```

Purge jsDelivr après push :

```
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@PIN_SHA/scripts/pages/editor/agilo-audio-sticky.js
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@PIN_SHA/scripts/pages/editor/confidence-v1/agilo-confidence.js
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@PIN_SHA/scripts/pages/editor/confidence-v1/agilo-confidence.css.js
```

## Recette staging

`https://agilotext-test.webflow.io/app/business/editor?jobId=1000040008&edition=ent`

- Player visible en haut : page scrollable, pas de bande compacte.
- Scroll interne du transcript : bande chip + audio sous la toolbar, texte poussé (pas recouvert).
- Scroll page / sidebar : bande reste, texte lisible, menus Télécharger OK.
- Molette haut en haut du transcript : gros lecteur revient.
- Interrupteur off par défaut, `?` explique, chevrons après on. Aucun orange dans le texte tant que off.
- Onglets Compte rendu / Assistant, rail Questions IA, iOS 390 : une ligne qui wrappe, pas de collision Sauvegarder.
- Helper « Compris » une fois (localStorage `agilo:confidence-helper-seen:v1`), même si l’interrupteur est off.
- Job `1000040075` sans données : pas de chip. Console : `AgiloConfidence.getDebugState()`.
- Alt+← / Alt+→ gated sur l’interrupteur. Espace dans un locuteur = espace, pas Play.

**Pas www.**
