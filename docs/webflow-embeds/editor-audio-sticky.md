# Webflow — Coque éditeur bornée + chip relire

**Staging only.** Ne pas coller sur www tant que la recette ci-dessous n’est pas OK.

## Comportement

- `#agilo-audio-wrap` (lecteur Netflix) reste dans le HTML Webflow, inchangé.
- `#ag-editor-pin-host` est créé dans `main.ed-main`, avant le premier `.edtr-pane`. Dedans : chip relire (premier enfant) puis `#ag-editor-audio-row`.
- Au chargement, `html.ag-editor-shell-fit` borne `.ed-body` à `100dvh`. `main.ed-main` est une colonne flex : onglets, toolbar et pin-host restent en haut, le pane scrolle. Les colonnes latérales (liste de transcripts) sont bornées à `max-height:100%` et scrollent **dans** la colonne, sans étirer la page.
- On ne touche **pas** à `overflow` / `height` de `html` ni `body` (le lock `@15984c83` faisait remonter le scroll). Pas de `position:fixed`.
- Quand le gros lecteur quitte le viewport, la bande compacte s’ouvre in-flow sous les onglets. Une fois la coque calée, chip + audio restent visibles.
- Chip : `3 passages à relire` / `1 passage à relire` / `Aucun passage à relire`. Interrupteur **éteint par défaut** (`agilo:confidence-visible:v2`). Bouton `?` même si off. Chevrons seulement si on. Helper auto une fois (`helper-seen:v1`) même interrupteur off.

Sonde console si un CSS Webflow résiste : `AgiloAudioSticky.getShellFitState()`.

Le sticky V1 `@8c7da101`, le slot `@cf0fe680` et le lock html `@15984c83` sont **obsolètes**.

## Embed audio (fin de `.code-lecteur-audio`)

Garder `Code-lecteur-audio-V3.4.js`. **Une** ligne audio, même SHA que confidence :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@PIN_SHA/scripts/pages/editor/agilo-audio-sticky.js?v=audio-fit-1"></script>
```

`PIN_SHA` = commit Git qui contient **à la fois** `agilo-audio-sticky.js` et `confidence-v1/agilo-confidence.js` + `.css.js`. Après `git push`.

## Embed confidence (même SHA, staging)

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

- Scroller la molette dans la **liste de transcripts à gauche** : la page se cale, onglets + toolbar + chip + audio restent en haut, ça ne monte pas plus.
- Scroller la page ailleurs : même résultat, **pas de rappel en haut**.
- Le transcript continue de scroller à l’intérieur, texte jamais recouvert.
- Menus Télécharger et rail Questions IA entièrement visibles.
- Onglets Compte rendu et Assistant.
- Interrupteur off par défaut, `?` explique, chevrons après on.
- Mobile 390 : le pane garde une hauteur utilisable. Si ce n’est pas le cas, désactiver le fit sous 640 px.
- Job `1000040075` sans données : pas de chip. Console : `AgiloConfidence.getDebugState()`.
- Si la barre part encore : `AgiloAudioSticky.getShellFitState()` (hauteur `.ed-body` vs viewport, `mainTop`, `documentScrollTop`).

**Pas www.**
