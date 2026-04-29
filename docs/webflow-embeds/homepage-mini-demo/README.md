# Démo iframe homepage (mini-app statique)

Page HTML autonome destinée à être chargée dans un **élément Embed** Webflow via `<iframe src="…">`.

**Emplacement dans le repo :** `docs/webflow-embeds/homepage-mini-demo/index.html`  
(Fichiers sous `docs/` pour pouvoir les servir via **GitHub Pages** avec le bon `Content-Type: text/html`.)

---

## 1. URL recommandée — GitHub Pages (sans Vercel)

Après activation des Pages (voir ci-dessous), l’URL stable est :

```
https://agilotext.github.io/Agilotext-Scripts-Public/webflow-embeds/homepage-mini-demo/
```

(avec slash final ou `/index.html` — équivalent.)

### Activer GitHub Pages (une fois)

Sans cette étape, **`commit + push ne créent pas de site`** — vous obtiendrez une erreur **404 « There isn't a GitHub Pages site here »**.

---

#### Méthode automatique (recommandée — workflow inclus dans ce repo)

Un workflow **[Deploy docs to GitHub Pages](https://github.com/Agilotext/Agilotext-Scripts-Public/actions)** copie le dossier `docs/` sur la branche **`gh-pages`** à chaque push sur **`1.06`** (ou déclenchement manuel *Run workflow*).

1. Après le **premier run réussi** de ce workflow (onglet **Actions** du repo), ouvrir **Settings** → **Pages**.
2. **Build and deployment** → Source : **Deploy from a branch**.
3. Branch : **`gh-pages`** → Folder : **`/(root)`** → **Save**.
4. Attendre 1–3 minutes ; tester l’URL ci-dessous.

Si le workflow est bloqué : **Settings** → **Actions** → **General** → *Workflow permissions* → **Read and write**.

---

#### Méthode sans Actions (alternative)

1. **Settings** → **Pages** → Source : **Deploy from a branch**.
2. Branch : **`1.06`** → Folder : **`/docs`** → **Save**.

---

#### URL à vérifier

Adresse attendue (organization **`Agilotext`**) :

```
https://agilotext.github.io/Agilotext-Scripts-Public/webflow-embeds/homepage-mini-demo/
```

Si votre organisation GitHub utilise un **slug différent**, remplacez `agilotext` dans l’URL par le slug exact (`https://<org>.github.io/<repo>/…`).

Fichier `docs/.nojekyll` présent pour désactiver Jekyll (HTML brut servi tel quel).

---

## 2. Alternative — jsDelivr (CDN)

Utile si vous ne voulez pas activer Pages tout de suite. **Attention :** jsDelivr peut renvoyer du HTML avec `Content-Type: text/plain` ; certains navigateurs affichent alors du code au lieu du rendu. **Tester l’iframe avant mise en prod.**

```
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.06/docs/webflow-embeds/homepage-mini-demo/index.html
```

Commit immuable (remplacer par le SHA du dernier commit qui touche ce dossier) :

```
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@<SHA>/docs/webflow-embeds/homepage-mini-demo/index.html
```

---

## Snippet Webflow (Embed) — privilégier GitHub Pages

Coller dans **Add → Embed** :

```html
<div class="agilo-home-demo-wrap" style="width:100%;max-width:960px;margin:0 auto;border-radius:16px;overflow:hidden;box-shadow:0 24px 64px rgba(0,20,39,.12);">
  <iframe
    src="https://agilotext.github.io/Agilotext-Scripts-Public/webflow-embeds/homepage-mini-demo/"
    title="Démonstration Agilotext"
    width="100%"
    height="560"
    style="display:block;border:0;width:100%;min-height:520px;"
    loading="lazy"
    referrerpolicy="strict-origin-when-cross-origin"
  ></iframe>
</div>
```

Variante jsDelivr (si Pages pas encore activé) :

```html
<iframe
  src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.06/docs/webflow-embeds/homepage-mini-demo/index.html"
  title="Démonstration Agilotext"
  width="100%"
  height="560"
  style="display:block;border:0;width:100%;min-height:520px;"
  loading="lazy"
></iframe>
```

Ajuster `height` / `min-height` selon la section (mobile : souvent 480–520px).

---

## Modifier la démo

1. Éditer `docs/webflow-embeds/homepage-mini-demo/index.html`.
2. Commit + push sur **`1.06`**.
3. GitHub Pages se met à jour en quelques minutes ; jsDelivr peut mettre quelques minutes (cache CDN).
