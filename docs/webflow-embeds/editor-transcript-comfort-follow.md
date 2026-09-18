# Éditeur — confort Magali (suivi lecture, 10 s, split)

**Pin Git :** fork `0dff73b0` (`1.09.9-follow`) ; sticky + CSS hint `aa75276d`  
Branche : `fix/mes-transcripts-summary-guard-1.09`. **Ne pas pousser `origin/1.09`.**

Console : `window.__agiloEditorConfidenceVersion === '1.09.9-follow'`  
Sauts : `#agilo-skip-back` / `#agilo-skip-fwd` libellés **10s**.  
Suivre : un seul `#agilo-transcript-follow`, déplacé (sticky si bande ouverte, sinon après `#agilo-speed`, sinon dock). Pas de barre pleine largeur dans le pane. **Réarmement Suivre** et **clic horodatage** recentrent le segment actif même sans changement d’horodatage. Hint hover **sous** le bouton, entier (dock `overflow:visible`).

## Inventaire live 17/09 (www = staging)

Pas de loader `editor-main-confidence.js`. Embeds SHA directs :

- `Code-main-editor-IFRAME_V04-confidence.js` → `@0dff73b0`
- `Code-lecteur-audio-V3.4.js` : **ne pas recoller** (10s déjà)
- `agilo-audio-sticky.js` → `@aa75276d`
- `agilo-confidence.css.js` (embed panneau) → `@aa75276d`
- header PV v10 reste `@7b09ce51` (ne pas recoller)

`?agilo_cdn_branch=` ne change **rien** sur cette page (pas de loader). Staging recollé **18/09** (fork `@0dff73b0`, sticky + CSS `@aa75276d`, V3.4 reste `@f95d42ee`). **WAIT `OK publish www`.**

## Src à recoller (Designer, page `/app/business/editor`)

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@0dff73b0/scripts/pages/editor/confidence-v1/Code-main-editor-IFRAME_V04-confidence.js?v=0dff73b0"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@aa75276d/scripts/pages/editor/confidence-v1/agilo-confidence.css.js?v=aa75276d"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@aa75276d/scripts/pages/editor/agilo-audio-sticky.js?v=panel-ui-2"></script>
```

V3.4 et header : inchangés.

Purge :

```
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@aa75276d/scripts/pages/editor/confidence-v1/agilo-confidence.css.js
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@aa75276d/scripts/pages/editor/agilo-audio-sticky.js
```

## Recette Bauer (job 705), pas Magali live

1. Ouverture : wrap visible, Suivre **petit** à côté de la vitesse du gros lecteur (ou dock), état ON (bleu `is-on`), pas de barre milieu de page.
2. Écoute sans toucher : le bloc actif reste visible.
3. Molette **dans le pane** (wrap encore à l’écran) : Suivre passe contour, surlignage continue.
4. Hover / focus Suivre **dans le dock** : bulle **entière** sous le bouton, texte lisible. Idem à côté de la vitesse. Dock flottant : bulle toujours sous Suivre, pas sous les onglets. 390px : pas coupée à gauche.
5. Long monologue (un seul horodatage) : scroller le pane → Suivre OFF → recliquer Suivre **sans** autre segment : l’écran revient sur le bloc actif. Clic horodatage dans le même bloc : idem.
6. Clic Suivre encore : gèle. Édition / `+` : gèle, texte collé sous le prénom.
7. Scroller la **page** jusqu’à cacher le wrap : Suivre est **dans** la bande 10s/Lire/10s (après la vitesse, avant la piste), pas dupliqué.
8. Surligner OFF : bandeau « passages à relire » grisé, coins alignés avec le dock (pas de débordement sur la bande audio).
9. 10s / Shift+flèche = 10. Ctrl+S puis **PV d’enquête (Word)**.

**WAIT `OK publish www`.** Rollback sticky/CSS : `0dff73b0`. Rollback confort follow : `628ba702` (`1.09.8-follow`).
