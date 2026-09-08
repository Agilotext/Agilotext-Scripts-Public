# Webflow — Rangée audio in-flow + chip relire (éditeur)

**Staging only.** Ne pas coller sur www tant que la recette ci-dessous n’est pas OK.

## Comportement

- `#agilo-audio-wrap` (lecteur Netflix) reste dans le HTML Webflow, inchangé.
- Quand il quitte le viewport, une ligne `#ag-editor-audio-row` s’ouvre **dans `main.ed-main`**, entre la toolbar et les panneaux. Elle n’est pas dans `#pane-transcript` (le scroller). Pas de `position:sticky`, pas de `position:fixed`.
- La ligne reste visible sous les onglets tant que la coque éditeur l’est. Le transcript rétrécit par flexbox, le texte n’est jamais recouvert.
- Chip « à relire » dans `.ed-toolbar .ed-tools` (gauche de la rangée d’outils). Si 0 passage mais données présentes : chip fantôme `Relu · 97 %`. Plus de dalle grise, plus de switch iOS, plus de panneau `is-floating`.

Le sticky V1 `@8c7da101` (`position:fixed`) et le slot `@cf0fe680` (`position:sticky` dans le panneau) sont **obsolètes**. Les remplacer, ne pas empiler une seconde ligne.

## Embed audio (fin de `.code-lecteur-audio`)

Garder `Code-lecteur-audio-V3.4.js`. **Une** ligne audio, même SHA que confidence :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@PIN_SHA/scripts/pages/editor/agilo-audio-sticky.js?v=audio-row-1"></script>
```

`PIN_SHA` = commit Git qui contient **à la fois** `agilo-audio-sticky.js` et `confidence-v1/agilo-confidence.js` + `.css.js`. Après `git push`.

## Embed confidence (même SHA, staging)

Remplacer les pins JS+CSS confidence (pas le loader iframe sauf besoin) :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@PIN_SHA/scripts/pages/editor/confidence-v1/agilo-confidence.css.js?v=chip-2"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@PIN_SHA/scripts/pages/editor/confidence-v1/agilo-confidence.js?v=chip-2"></script>
```

Purge jsDelivr après push :

```
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@PIN_SHA/scripts/pages/editor/agilo-audio-sticky.js
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@PIN_SHA/scripts/pages/editor/confidence-v1/agilo-confidence.js
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@PIN_SHA/scripts/pages/editor/confidence-v1/agilo-confidence.css.js
```

## Recette staging

`https://agilotext-test.webflow.io/app/business/editor?jobId=1000040008&edition=ent`

- Player visible en haut : pas de rangée audio. Chip toolbar si passages (`N à relire`) ou fantôme `Relu · xx %`.
- Scroll jusqu’à disparition du player : rangée apparaît sous la toolbar, **première ligne locuteur lisible**. Pas de barre figée par-dessus le texte.
- Qualité % : tooltip du chip actif, ou libellé du fantôme. Pas de « N modifiés » dans le chrome.
- Masquer relire (clic chip ou ×) : même emplacement devient `Relire` s’il reste des passages. Le fantôme `Relu` reste visible et toggle les surlignages.
- Onglets Compte rendu et Assistant : la rangée audio reste (elle est hors des panneaux).
- Rail Questions IA (`aside.ed-ia`) intact. Menus Télécharger s’ouvrent au-dessus.
- Mobile étroit : 15s/30s en icônes, pas de collision Sauvegarder / Anonymiser.
- Helper « Compris » une fois (localStorage `agilo:confidence-helper-seen:v1`).
- Job sans données : pas de chip. Console : `AgiloConfidence.getDebugState()` (reason `unavailable` ou `no_matches`).
- Alt+← / Alt+→ inchangés. Espace dans un locuteur = espace, pas Play.

**Pas www.**
