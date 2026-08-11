# Webflow — correctifs bugs éditeur (branche 1.09)

Correctifs livrés juillet 2026 : corbeille manquante, bannière anonymisation, durcissement collage.

Correctif août 2026 (`1.09.2`) : panneau flottant (piste secondaire, recouvrement).

Correctif août 2026 (`1.09.3`) : « Passage suivant » scrolle `.ed-body` (`overflow:hidden`) et découpait la barre d'onglets sans possibilité de remonter.

Correctif août 2026 (`1.09.4`) : retrait du filet sticky qui masquait partiellement les menus, remplacé par un garde JS sur `.ed-body`.

Correctif août 2026 (`1.09.5`) : suppression du `z-index: 40` sur la chrome éditeur (1.09.2) qui faisait passer les menus de téléchargement sous la barre d'onglets ; protection panneau flottant désormais géométrique (pas de float si chrome non mesurable).

Correctif août 2026 (`1.09.6`) : restauration UI « Passage précédent » (feature `f3bbc9e` jamais mergée dans `1.09` ; disparue quand l'embed a quitté ce hash). Port chirurgical sans reprendre le floating `top:10px` / `z-index:9999` de f3.

## Fichiers modifiés

| Fichier | Bugs | Version |
|---------|------|---------|
| `scripts/pages/editor/confidence-v1/Code-main-editor-IFRAME_V04-confidence.js` | 1, 2, 5 | `window.__agiloEditorConfidenceVersion = '1.09.6'` |
| `scripts/pages/editor/confidence-v1/agilo-confidence.js` | 5, 6 | scroll borné + garde shell + float sûr + `buildNavControlsHtml` (prev/next) |
| `scripts/pages/editor/confidence-v1/agilo-confidence.css.js` | 5, 6 | pas de z-index chrome ; styles `__nav` / icônes mobile |
| `CNOEC_Agiloshield_Docs/Front_END/agilo-editor-anonymiser-transcript-v3.js` | 3, 4 | `window.__agiloAnonVersion = '3.1.0'` |

## URLs CDN (@1.09)

```html
<!-- Fork confidence (staging / test) — les 3 scripts sur @1.09, même ?v= -->
<script>window.AGILOTEXT_ENABLE_CONFIDENCE = true;</script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/pages/editor/confidence-v1/agilo-confidence.css.js?v=1.09.6"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/pages/editor/confidence-v1/agilo-confidence.js?v=1.09.6"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/pages/editor/confidence-v1/Code-main-editor-IFRAME_V04-confidence.js?v=1.09.6"></script>

<!-- Anonymiser v3 (embed Webflow séparé — confirmer le src dans Designer) -->
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/CNOEC_Agiloshield_Docs/Front_END/agilo-editor-anonymiser-transcript-v3.js?v=3.1.0"></script>
```

## Vérification console

```js
window.__agiloEditorConfidenceVersion  // '1.09.6'
window.__agiloAnonVersion              // '3.1.0'
```

## Checklist manuelle

- [ ] « + » → nouvel intervenant avec corbeille ; suppression OK ; Ctrl+Z restaure
- [ ] Pas de double corbeille après re-render
- [ ] Sauvegarder sans anonymiser → aucune bannière verte
- [ ] Anonymiser → appliquer → bannière jaune ; sauvegarder → bannière verte **uniquement** sur Transcription
- [ ] Modifier le texte après save anonymisé → bannière disparaît
- [ ] Basculer onglets : pas de bannière fantôme sur Compte rendu / Assistant
- [ ] Coller HTML riche → texte brut ; coller transcript timé → smart-paste UX++ intact
- [ ] Toggle « Passages à relire » ON puis scroll : onglets Transcription / Compte rendu / Assistant toujours visibles et cliquables
- [ ] Ouvrir « Télécharger transcription », « Télécharger compte rendu » et « Analyses IA » : menus entièrement visibles (aucun libellé d'onglet ne traverse le menu)
- [ ] `getComputedStyle(document.querySelector('main.ed-main nav.ed-tabs')).zIndex` retourne `'auto'`
- [ ] Panneau : boutons « Passage précédent » et « Passage suivant » visibles quand il y a des passages
- [ ] « Passage précédent » x5 et « Passage suivant » x5 : barre d'onglets reste visible, pas de reload nécessaire
- [ ] `Alt+Flèche droite` / `Alt+Flèche gauche` : même comportement que les boutons
- [ ] Depuis l'onglet Compte rendu, « Passage suivant » bascule sur Transcription et centre le segment
- [ ] `window.__agiloProbe()` : `.ed-body` et `document` restent à `scrollTop: 0`
- [ ] Compte rendu iframe riche : pas de fuite CSS, onglets stables

## Tests auto

```bash
node scripts/pages/editor/confidence-v1/agilo-confidence.test.mjs
```

Attendu : 117/117.

## Rollback

Retirer les deux lignes `<script>` confidence de la page Webflow (retour immédiat à l'éditeur sans confidence). Revenir à 1.09.4 ne répare pas les menus de téléchargement (le `z-index: 40` y est déjà présent).

Pour rollback git :

```bash
git revert <commit-sha>
```

Puis purge jsDelivr des deux URLs ci-dessus.

## Doc complémentaire

- Embeds inline et patch UX++ : [`inline-embed-scripts.md`](inline-embed-scripts.md)
- Confidence staging : [`editor-confidence-v1.md`](editor-confidence-v1.md)
- Nav précédent / suivant : [`editor-confidence-nav-prev-2026-07-24.md`](editor-confidence-nav-prev-2026-07-24.md)
