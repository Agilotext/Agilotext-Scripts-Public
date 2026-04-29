# Démo iframe homepage (mini-app statique)

Page HTML autonome destinée à être chargée dans un **élément Embed** Webflow via `<iframe src="…">`.

## Pourquoi jsDelivr et pas `raw.githubusercontent.com` ?

Les URLs `raw.githubusercontent.com` renvoient souvent du HTML avec un `Content-Type` inadapté ; le rendu dans une iframe est **peu fiable** selon navigateur et politiques.

[jsDelivr](https://www.jsdelivr.com/) sert les fichiers GitHub avec les bons en-têtes — **aucun Vercel requis**.

## URL à utiliser (branche `1.06`)

Après merge/push sur `origin/1.06`, l’URL stable est :

```
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.06/webflow-embeds/homepage-mini-demo/index.html
```

Pour pointer explicitement un commit (immuable, pour éviter tout cache ambigu) :

```
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@<SHA>/webflow-embeds/homepage-mini-demo/index.html
```

## Snippet Webflow (Embed)

Coller dans **Add → Embed** (ou bloc HTML personnalisé) :

```html
<div class="agilo-home-demo-wrap" style="width:100%;max-width:960px;margin:0 auto;border-radius:16px;overflow:hidden;box-shadow:0 24px 64px rgba(0,20,39,.12);">
  <iframe
    src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.06/webflow-embeds/homepage-mini-demo/index.html"
    title="Démonstration Agilotext"
    width="100%"
    height="560"
    style="display:block;border:0;width:100%;min-height:520px;"
    loading="lazy"
    referrerpolicy="strict-origin-when-cross-origin"
  ></iframe>
</div>
```

Ajuster `height` / `min-height` selon la section (mobile : 480–520px souvent suffisant).

## Modifier la démo

1. Éditer `index.html` dans ce dossier.
2. Commit + push sur la branche `1.06`.
3. Attendre la propagation CDN jsDelivr (souvent &lt; 5 min ; purge navigateur si besoin).
