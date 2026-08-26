# Webflow : restore Classic (embed 2.4.19)

Branche : `fix/anon2-restore-classic-2.4.19`
SHA pin : `420f5be2bbd3e3890a717c86bf392cd0ab283469`

Un seul fichier `agiloshield-embed-anonymisation-anon2-beta.js` sert Lite et Classic.
Classic est additif : Free ou Business sans Classic = Lite anonymisation. Free ou Business + Classic = restore / pseudo débloqués. `getToken` reste `free` / `pro` / `ent`.

## Pages (même bloc partout)

- `/app/business/dashboard/anonymiser`
- `/app/premium/dashboard/anonymiser`
- `/app/free/dashboard/anonymiser`
- `/tools/agiloshield/premium/dashboard` seulement si `anon2-beta.js` y est déjà

Un site Designer. Publish subdomain (test) d’abord, puis `www.agilotext.com`.

Ne pas charger ce script sur `/sondage/campagne-agiloshield-2026`.
Ne pas charger `agiloshield-embed-anonymisation-limited.js` sur ces dashboards.

## Coller (remplace `@1769f350?v=2.4.17`)

```html
<!-- Script unifié Lite/Classic. Upsell 19 € seulement sans plan Classic actif. -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@420f5be2bbd3e3890a717c86bf392cd0ab283469/CNOEC_Agiloshield_Docs/anonymisation/agiloshield-embed-anonymisation-anon2-beta.js?v=2.4.19" defer></script>
```

jsDelivr peut mettre 1 à 5 min. Le `?v=2.4.19` seul sur l’ancien SHA ne change rien.

## Bonus même page

Embed `code-ready-count-all-editions` : retirer `localStorage.setItem("agilo:edition", …)`.
Garde optionnelle : `webflow-agilo-edition-guard.js` en head.

## Rollback

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1769f3501c4d3b62b4d2cf9298318119d73f7c95/CNOEC_Agiloshield_Docs/anonymisation/agiloshield-embed-anonymisation-anon2-beta.js?v=2.4.17" defer></script>
```

## Vérif

- `window.__AGILO_EMBED_ANON_VERSION__` → `2.4.19`
- Business + Classic : Restauration et Pseudonymiser sans modal. Badge Team inchangé.
- Free ou Business sans Classic : modal 19 € toujours là.
