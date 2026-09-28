# Lecteur audio éditeur : pause privacy veille Windows + Play volontaire

**Fichier :** `scripts/pages/editor/Code-lecteur-audio-V3.4.js`  
**Version runtime :** `window.__agiloAudioLite === '3.4-privacy-play'`  
**Debug :** `window.AgiloAudioPrivacy`

## Règle produit

| Cas | Attendu |
|-----|---------|
| Veille / Win+L / onglet caché **sans** clic | Silence (le navigateur ne relance pas le son tout seul). |
| Retour visible / `pageshow` | Jamais de `play()` auto, seulement resync UI (bouton **▶︎ Lire**). |
| Clic **Lire** / Espace / Enter dans le texte (geste) | Le son **doit** partir, y compris après une pause privacy. |

## Comportement technique

- Onglet / page cachée (`visibilitychange` hidden, `pagehide`, `freeze`) → `audio.pause()`, UI resync, MediaSession `paused`.
- Si le navigateur reprend le média **sans** geste user récent → re-pause (`play-while-hidden` + `userPlayIntentUntil`).
- `tryPlayFromUserGesture()` : pose une fenêtre d’intent ~2,5 s, `await audio.play()`, un retry ~200 ms si visible, hint `title` 3 s si échec.
- Pas de `mediaSession.setActionHandler('play', …)`.

## Smoke Node

```bash
node scripts/pages/editor/Code-lecteur-audio-V3.4.privacy.test.mjs
```

## Recette manuelle (Windows Chrome + Edge)

1. Staging éditeur : console `window.__agiloAudioLite` = `3.4-privacy-play`.
2. Lecture en cours → Win+L 10–20 s → déverrouiller.
3. Attendu : **silence**, bouton **▶︎ Lire**.
4. Clic **Lire** → **son**.
5. Même scénario veille OS réelle.
6. Mac smoke : autre onglet → pause ; pas de reprise auto ; clic Lire OK.

## Share

`/auth/share` charge le même `Code-lecteur-audio-V3.4.js` (voir `docs/webflow-embeds/share/share-page.html`). Après push, pinner le **même SHA** sur staging (éditeur + share) et purger jsDelivr. **Pas de www sans OK Florian.**

## Hors scope (piste séparée)

PC Grand Est « lecture bloquée » : Edge / proxy / politiques autoplay / Range HTTP. Pas le même bug que le son à la veille.
