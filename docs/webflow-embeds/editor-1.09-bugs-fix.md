# Webflow — correctifs bugs éditeur (branche 1.09)

Correctifs livrés juillet 2026 : corbeille manquante, bannière anonymisation, durcissement collage.

Correctif août 2026 (`1.09.2`) : panneau « Passages à relire » qui recouvrait les onglets Transcription / Compte rendu / Assistant.

## Fichiers modifiés

| Fichier | Bugs | Version |
|---------|------|---------|
| `scripts/pages/editor/confidence-v1/Code-main-editor-IFRAME_V04-confidence.js` | 1, 2, 5 | `window.__agiloEditorConfidenceVersion = '1.09.2'` |
| `scripts/pages/editor/confidence-v1/agilo-confidence.js` | 5 | panneau flottant sous chrome + filet onglets |
| `scripts/pages/editor/confidence-v1/agilo-confidence.css.js` | 5 | z-index flottant 25, chrome onglets 40 |
| `CNOEC_Agiloshield_Docs/Front_END/agilo-editor-anonymiser-transcript-v3.js` | 3, 4 | `window.__agiloAnonVersion = '3.1.0'` |

## URLs CDN (@1.09)

```html
<!-- Fork confidence (staging / test) -->
<script>window.AGILOTEXT_ENABLE_CONFIDENCE = true;</script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/pages/editor/confidence-v1/editor-main-confidence.js?v=1.09.2"></script>

<!-- Anonymiser v3 (embed Webflow séparé — confirmer le src dans Designer) -->
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/CNOEC_Agiloshield_Docs/Front_END/agilo-editor-anonymiser-transcript-v3.js?v=3.1.0"></script>
```

## Vérification console

```js
window.__agiloEditorConfidenceVersion  // '1.09.2'
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
- [ ] Compte rendu iframe riche : pas de fuite CSS, onglets stables

## Tests auto

```bash
node scripts/pages/editor/confidence-v1/agilo-confidence.test.mjs
```

Attendu : 73/73.

## Rollback

```bash
git revert <commit-sha>
```

Puis purge jsDelivr des deux URLs ci-dessus.

## Doc complémentaire

- Embeds inline et patch UX++ : [`inline-embed-scripts.md`](inline-embed-scripts.md)
- Confidence staging : [`editor-confidence-v1.md`](editor-confidence-v1.md)
