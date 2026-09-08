# Webflow — Mini-barre audio flottante (éditeur)

**Gate 0 (8 sept. 2026)** mesurée sur le dump live Business `Éditeur de transcripts _ Business.html` (job `1000040008`) et le screenshot client :

- `#agilo-audio-wrap` est dans le flux de `.dashboard-content`, **au-dessus** des onglets et du texte.
- `.ed-body` / `.ed-main` restent en `overflow: hidden` (filet 1.09.3) : ce n’est pas le scroller.
- Le document / `.dashboard-right` scrolle. En bas d’un job long, le player quitte le viewport. La barre « passages à relire » flotte déjà.
- Même coquille page Free / Pro / Business (`edition` change, pas le layout).

Donc V1 (mini-barre si le wrap n’intersecte plus le viewport) a un vrai job. Pas de follow-playhead.

## Embed (après le lecteur V3.4)

**Garder** la ligne `Code-lecteur-audio-V3.4.js` telle quelle. **Ajouter** seulement, à la fin de l’embed `code-lecteur-audio` :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@8c7da101/scripts/pages/editor/agilo-audio-sticky.js?v=audio-sticky-1"></script>
```

Le HTML `wrapper-audio-api` / `#agilo-audio-wrap` **ne change pas**.

Staging `agilotext-test` d’abord, puis www. Onglet Transcription seulement. Stack sous les onglets, au-dessus de « passages à relire » via `--ag-editor-audio-dock-height`.

## Recette

- Job ~45 min : scroller jusqu’à disparition du player → mini-barre sous les onglets
- Toggle « passages à relire » on/off : les deux barres ne se superposent pas
- Passage suivant : le segment n’est pas sous le dock
- Édition locuteur : Espace insère un espace ; Play mini met pause
- Onglet Compte rendu : mini-barre absente
- Sidebar, mobile 375, cookie / bandeau app
- Audio expiré : pas de mini-barre
- Changement de fichier (rail)
