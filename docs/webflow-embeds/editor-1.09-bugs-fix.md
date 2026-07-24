# Webflow — correctifs bugs éditeur (branche 1.09)

Correctifs livrés juillet 2026 : corbeille manquante, bannière anonymisation, durcissement collage.

## Fichiers modifiés

| Fichier | Bugs | Version |
|---------|------|---------|
| `scripts/pages/editor/confidence-v1/Code-main-editor-IFRAME_V04-confidence.js` | 1, 2 + nav prev | `window.__agiloEditorConfidenceVersion = '1.09.2'` |
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

## Tests auto

```bash
node scripts/pages/editor/confidence-v1/agilo-confidence.test.mjs
```

Attendu : 21/21.

## Rollback

```bash
git revert <commit-sha>
```

Puis purge jsDelivr des deux URLs ci-dessus.

## Doc complémentaire

- Embeds inline et patch UX++ : [`inline-embed-scripts.md`](inline-embed-scripts.md)
- Confidence staging : [`editor-confidence-v1.md`](editor-confidence-v1.md)
