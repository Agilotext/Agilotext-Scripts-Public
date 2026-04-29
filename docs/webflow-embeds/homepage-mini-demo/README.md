# Démo iframe homepage — fenêtre Mac orange/beige + 4 vues produit

Page HTML **autonome** (CSS inline) pour un embed Webflow (`<iframe src="…">`).

**Emplacement :** `docs/webflow-embeds/homepage-mini-demo/index.html`

- Logo SVG Agilotext (CDN Webflow) dans la titlebar uniquement.
- **Quatre onglets** : Capturer · Transcription · Compte rendu · Agent IA — tout est statique, sans API.
- **Palette** : orange `#FD7E14`, beige `#E7E0DA` — voir la note en bas de la démo.

---

## 1. URL recommandée — GitHub Pages

```
https://agilotext.github.io/Agilotext-Scripts-Public/webflow-embeds/homepage-mini-demo/
```

### Activer GitHub Pages (une fois)

Le workflow **[Deploy GitHub Pages (docs only)](https://github.com/Agilotext/Agilotext-Scripts-Public/actions/workflows/deploy-docs-gh-pages.yml)** ne clone que le dossier **`docs/`**.

1. **Settings** → **Pages** → source **GitHub Actions**.
2. Pousser sur **`1.06`** ou lancer le workflow ; attendre un run vert.

---

## 2. Alternative — jsDelivr

```
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.06/docs/webflow-embeds/homepage-mini-demo/index.html
```

Tester l’iframe avant mise en prod (certains CDN peuvent affecter le `Content-Type`).

---

## Snippet Webflow (Embed)

```html
<div class="agilo-home-demo-wrap" style="width:100%;max-width:960px;margin:0 auto;border-radius:16px;overflow:hidden;box-shadow:0 24px 64px rgba(0,20,39,.12);">
  <iframe
    src="https://agilotext.github.io/Agilotext-Scripts-Public/webflow-embeds/homepage-mini-demo/"
    title="Démonstration Agilotext"
    width="100%"
    height="580"
    style="display:block;border:0;width:100%;min-height:520px;"
    loading="lazy"
    referrerpolicy="strict-origin-when-cross-origin"
  ></iframe>
</div>
```

Ajuster `height` / `min-height` selon la section (souvent **560–620px** avec quatre onglets et les panneaux enrichis).

---

## Modifier la démo

1. Éditer uniquement `docs/webflow-embeds/homepage-mini-demo/index.html`.
2. Commit + push sur **`1.06`**.
3. Pages se met à jour en quelques minutes.
