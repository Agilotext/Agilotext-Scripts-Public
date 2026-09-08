# Webflow — Rangée audio in-flow + chip relire (éditeur)

**Staging only.** Ne pas coller sur www tant que la recette ci-dessous n’est pas OK.

## Comportement

- `#agilo-audio-wrap` (lecteur Netflix) reste dans le HTML Webflow, inchangé.
- Quand il quitte le viewport (onglet Transcription), un slot `#ag-editor-audio-slot` **dans le flux** de `#pane-transcript` s’ouvre (hauteur auto) et **pousse** le texte. Pas de `position:fixed`.
- Sticky seulement pour rester sous `nav.ed-tabs` (`--ag-editor-chrome-top`). Toolbar et slot ne sont pas mesurés dans ce `top`.
- Chip « à relire » dans `.ed-toolbar`, à gauche de Rechercher. Plus de dalle grise, plus de switch iOS, plus de panneau `is-floating`.

Le sticky V1 `@8c7da101` (`position:fixed`, z-index 26) est **obsolète**. Le remplacer, ne pas empiler une seconde ligne.

## Embed audio (fin de `.code-lecteur-audio`)

Garder `Code-lecteur-audio-V3.4.js`. **Une** ligne sticky, même SHA que confidence :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@PIN_SHA/scripts/pages/editor/agilo-audio-sticky.js?v=audio-slot-2"></script>
```

`PIN_SHA` = commit Git qui contient **à la fois** `agilo-audio-sticky.js` et `confidence-v1/agilo-confidence.js` + `.css.js`. Après `git push`.

## Embed confidence (même SHA, staging)

Remplacer les pins JS+CSS confidence (pas le loader iframe sauf besoin) :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@PIN_SHA/scripts/pages/editor/confidence-v1/agilo-confidence.css.js?v=chip-1"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@PIN_SHA/scripts/pages/editor/confidence-v1/agilo-confidence.js?v=chip-1"></script>
```

Purge jsDelivr après push :

```
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@PIN_SHA/scripts/pages/editor/agilo-audio-sticky.js
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@PIN_SHA/scripts/pages/editor/confidence-v1/agilo-confidence.js
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@PIN_SHA/scripts/pages/editor/confidence-v1/agilo-confidence.css.js
```

## Recette staging

`https://agilotext-test.webflow.io/app/business/editor?jobId=1000040008&edition=ent`

- Player visible en haut : pas de rangée audio. Chip toolbar si passages (`1 à relire`).
- Scroll jusqu’à disparition du player : rangée apparaît, **première ligne locuteur lisible** (poussée, pas recouverte). Pas de barre figée par-dessus le texte.
- Qualité % : tooltip du chip, pas dans la barre. Pas de « N modifiés » dans le chrome.
- Masquer relire (clic chip ou ×) : même emplacement devient `Relire`. Pas de dalle « masqués ».
- Onglet Compte rendu : pas de rangée audio.
- Rail Questions IA (`aside.ed-ia`) intact.
- Mobile étroit : 15s/30s en icônes, pas de collision Sauvegarder / Anonymiser.
- Helper « Compris » une fois (localStorage `agilo:confidence-helper-seen:v1`).
- Alt+← / Alt+→ inchangés. Espace dans un locuteur = espace, pas Play.

**Pas www.**
