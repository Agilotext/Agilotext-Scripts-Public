# Accessibilité légère — Agilotext (Webflow / app)

## Fichiers

| Fichier | Rôle |
|---------|------|
| `agilotext-a11y-lite.css` | Lien d’évitement (focus), zone live SR-only, `:focus-visible` sur `.agilo-a11y-app` |
| `agilotext-a11y-lite.js` | Landmarks, skip link (re-promu après cookies Finsweet), `window.AgilotextA11y.announce` |
| `BASELINE_VILLETTE.md` | Baseline smoke avant patches lot Villette |
| `TESTING.md` | Checklist smoke NVDA / JAWS |
| `PILOT.md` | Boucle pilote : 3 gestes bloquants |
| `DRAFT_MAIL_LEMAIRE_VILLETTE.md` | Brouillon mail (ne pas envoyer sans accord) |
| `BACKLOG_MES_FICHIERS.txt` | P1 Mes fichiers / éditeur si pilote P0 |
| `PLAN_DEPLOIEMENT_VILLETTE_1.10.txt` | Pin Webflow par hash |

## Intégration Webflow (fin de `<body>`)

**Pin obligatoire en prod :** hash de commit Git, **pas** `@1.10` (pointeur mouvant).

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@HASH/scripts/pages/dashboard/a11y/agilotext-a11y-lite.css?v=HASH" crossorigin="anonymous">
<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@HASH/scripts/pages/dashboard/a11y/agilotext-a11y-lite.js?v=HASH" crossorigin="anonymous"></script>
```

Ordre : CSS a11y → JS a11y → scripts dashboard (`upload_ent_v2.js`, Record, Maestro…).

Le script ne s’exécute que si l’URL contient `/app/`.

### Cookies (Finsweet)

Le bandeau cookies peut capturer le **premier Tab**. Après fermeture du bandeau, `a11y-lite` remet le skip link en tête de `<body>`.

### API

```js
window.AgilotextA11y.announce('Votre message court pour les lecteurs d’écran.');
```

Branché sur Business : `upload_ent_v2.js`, Record Ent, Maestro « Joindre des documents » (et historiques `ent.js` / `pro.js` / `free.js`).

### Honnêteté produit

Couche légère clavier / SR sur zones app — **pas** conformité RGAA ni « certifié JAWS » globale.
