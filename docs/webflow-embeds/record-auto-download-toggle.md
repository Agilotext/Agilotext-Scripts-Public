# Webflow — Opt-out téléchargement auto audio (Business / Ent)

Après push sur la branche `1.10`, mettre à jour les embeds du **dashboard Business**.

Remplacer `<HASH>` par le SHA du commit poussé (ou utiliser `@1.10` + `?v=<HASH>` pour cache-bust).

## 1. Script Record Ent (`script_record-ent`)

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.10/scripts/pages/dashboard/Ent/Record.production.final.fixed.recovery-fix.js?v=<HASH>"></script>
```

## 2. Nouveau toggle (à ajouter près de la zone Enregistrer)

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.10/scripts/pages/dashboard/Code-record-audio-toggle.js?v=<HASH>"></script>
```

## 3. Streaming (`mount-streaming.js` — actuellement épinglé `@24cac26`)

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.10/scripts/pages/dashboard/mount-streaming.js?v=<HASH>"></script>
```

## 4. Onboarding (inline Webflow / driver.js)

Remplacer le passage « par sécurité, l’audio est aussi enregistré localement… » par :

> Par défaut, une **copie locale de sécurité** est enregistrée dans votre dossier **Téléchargements** à la fin (**désactivable** dans la zone Enregistrer).

## Comportement

- Défaut : téléchargement auto **ON** (identique à avant).
- Case « Copie locale de sécurité » décochée → plus de download auto ; upload + recovery IndexedDB inchangés.
- Force IT : `window.AGILO_RECORD_AUTO_DOWNLOAD = false` avant le script.
