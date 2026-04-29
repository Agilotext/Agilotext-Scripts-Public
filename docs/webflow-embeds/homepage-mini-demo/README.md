# Démo iframe homepage (mini-app statique — version « fenêtre Mac »)

Page HTML **autonome** (CSS inline) destinée à être chargée dans un **élément Embed** Webflow via `<iframe src="…">`.

**Emplacement dans le repo :** `docs/webflow-embeds/homepage-mini-demo/index.html`

- **Une seule dépendance externe** : logo SVG Agilotext sur le CDN Webflow (affichage dans la barre de titre).
- **Pas** de feuille Webflow CSS obligatoire pour le rendu ; **pas** de fichier `demo-agilo-editor-patch.css`.
- **Palette** : orange `#FD7E14`, beige `#E7E0DA` — voir note en bas de page dans la démo.

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
    height="520"
    style="display:block;border:0;width:100%;min-height:480px;"
    loading="lazy"
    referrerpolicy="strict-origin-when-cross-origin"
  ></iframe>
</div>
```

Ajuster `height` / `min-height` selon la section (la démo V1 est relativement compacte).

---

## Modifier la démo

1. Éditer uniquement `docs/webflow-embeds/homepage-mini-demo/index.html`.
2. Commit + push sur **`1.06`**.
3. Pages se met à jour en quelques minutes.
