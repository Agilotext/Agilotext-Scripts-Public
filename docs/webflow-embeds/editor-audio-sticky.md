# Webflow — Dock transcript (panneau + audio compact)

**Staging only.** Ne pas coller sur www tant que la recette ci-dessous n’est pas OK.

## Comportement

- `#agilo-audio-wrap` (lecteur Netflix) reste dans le HTML Webflow, inchangé.
- `#ag-editor-chrome-dock` est créé dans `#pane-transcript`, **avant** `#transcriptEditor`. Dedans : panneau confidence, puis `#ag-editor-audio-row` (audio compact).
- Le dock est `position: sticky` en nominal. Quand le scroll page fait sortir le sentinel, il passe en `is-floating` (`position:fixed`) calé sous les onglets / toolbar. Un seul sentinel, un seul `is-floating` pour panneau + audio.
- On ne touche **pas** à `.ed-body`, `html`, `body`, ni à la largeur de la sidebar `.ed-rail`. Pas de `html.ag-editor-shell-fit`, pas de lock html, pas de `#ag-editor-pin-host`.
- Quand le gros lecteur quitte le viewport, la bande compacte s’ouvre **dans** le dock. Si le dock flotte, l’audio flotte avec.
- Panneau : libellé passages à relire, score, toggle iOS. Interrupteur **éteint par défaut** (`agilo:confidence-visible:v2`) : le panneau reste visible, les oranges non. Helper auto une fois (`helper-seen:v1`) même interrupteur off.

Sonde console : `AgiloAudioSticky.getChromeDockState()` (`dockConnected`, `isFloating`, `chromeBottom`, `sentinelTop`).

Le sticky V1 `@8c7da101`, le slot `@cf0fe680`, le lock html `@15984c83`, l’in-flow pur `@bfd49ad5` et le fit `100dvh` `@1d2b4ee9` sont **obsolètes**.

## Embed audio (fin de `.code-lecteur-audio`)

Garder `Code-lecteur-audio-V3.4.js`. **Une** ligne audio, même SHA que confidence :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@PIN_SHA/scripts/pages/editor/agilo-audio-sticky.js?v=audio-dock-1"></script>
```

`PIN_SHA` = commit Git qui contient **à la fois** `agilo-audio-sticky.js` et `confidence-v1/agilo-confidence.js` + `.css.js`. Après `git push`.

## Embed confidence (même SHA, staging)

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@PIN_SHA/scripts/pages/editor/confidence-v1/agilo-confidence.css.js?v=audio-dock-1"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@PIN_SHA/scripts/pages/editor/confidence-v1/agilo-confidence.js?v=audio-dock-1"></script>
```

Purge jsDelivr après push :

```
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@PIN_SHA/scripts/pages/editor/agilo-audio-sticky.js
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@PIN_SHA/scripts/pages/editor/confidence-v1/agilo-confidence.js
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@PIN_SHA/scripts/pages/editor/confidence-v1/agilo-confidence.css.js
```

## Recette staging

`https://agilotext-test.webflow.io/app/business/editor?jobId=1000040008&edition=ent`

- Sidebar « Mes transcriptions » : largeur normale, scroll interne OK. Le centre n’est pas étiré.
- Scroller la page en bas : panneau + audio **restent sous les onglets**.
- Scroller le transcript : texte lisible, pas recouvert.
- Menus Télécharger au-dessus du dock (`z-index:25`, pas 9999). Rail Questions IA visible.
- Onglets Compte rendu et Assistant.
- Interrupteur off par défaut : pas d’orange au chargement. Toggle allume les surlignages, le panneau reste.
- Mobile 390.
- Job `1000040075` sans données : pas de panneau. Console : `AgiloConfidence.getDebugState()`.
- Si le dock part encore : `AgiloAudioSticky.getChromeDockState()`.

**Pas www.**
