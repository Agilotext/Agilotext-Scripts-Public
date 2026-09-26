# Lecteur audio : pause privacy veille Windows (staging)

**Fichier :** `scripts/pages/editor/Code-lecteur-audio-V3.4.js`  
**Base live :** `@57101fff` (`3.4-text-play-pause`) + privacy additif  
**Version runtime :** `window.__agiloAudioLite === '3.4-privacy-vis'`  
**Pin staging :** `@dd9a6992` (`?v=privacy-vis`) sur composant `Code-lecteur-audio` + share  
**Debug :** `window.AgiloAudioPrivacy`  
**Rollback éditeur :** `@57101fff4aff111afcc98cae856fd9f6998fbbd9`

## Comportement

- Onglet / page cachée → `audio.pause()`, UI resync, MediaSession `paused`
- Reprise navigateur pendant hidden → re-pause (`play-while-hidden`)
- Retour visible → **jamais** de `play()` auto
- Enter dans le texte segment + sauts 10s : inchangés

## Smoke

```bash
node scripts/pages/editor/Code-lecteur-audio-V3.4.privacy.test.mjs
```

## Staging

Pin **une seule ligne** `Code-lecteur-audio-V3.4.js` `@NEWSHA?v=privacy-vis` sur éditeur Free/Pro/Business + share.  
Publish : `agilotext-test` only. **Pas www** sans OK Florian.
