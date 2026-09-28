# Lecteur audio éditeur : pause privacy veille Windows + Play volontaire

**Fichier :** `scripts/pages/editor/Code-lecteur-audio-V3.4.js`  
**Version runtime :** `window.__agiloAudioLite === '3.4-privacy-play'`  
**Pin staging :** `@26fc7b49` (`?v=privacy-play`) sur composant `Code-lecteur-audio` + share  
**Debug :** `window.AgiloAudioPrivacy`  
**Rollback éditeur :** `@dd9a6992` (privacy-vis) ou `@57101fff` (pre-privacy)

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

## Staging

Pin **une seule ligne** `Code-lecteur-audio-V3.4.js` :
`https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@26fc7b49/scripts/pages/editor/Code-lecteur-audio-V3.4.js?v=privacy-play`  
sur éditeur Free/Pro/Business + share. Publish : `agilotext-test` only. **Pas www** sans OK Florian.

## Share

Voir `docs/webflow-embeds/share/share-page.html` (même SHA lecteur).

## Hors scope (piste séparée)

PC Grand Est « lecture bloquée » : Edge / proxy / politiques autoplay / Range HTTP. Pas le même bug que le son à la veille.
