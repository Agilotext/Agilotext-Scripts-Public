# Démo iframe homepage (mini-app statique)

Page HTML autonome destinée à être chargée dans un **élément Embed** Webflow via `<iframe src="…">`.

**Emplacement dans le repo :** `docs/webflow-embeds/homepage-mini-demo/index.html`  
**Styles :** feuille Webflow officielle (CDN) + patch local `demo-agilo-editor-patch.css` (thème éditeur violet / lecteur / transcript / onglets).

**Feuille Webflow utilisée (snapshot — à documenter si publish Webflow change le hash) :**

```
https://cdn.prod.website-files.com/6815bee5a9c0b57da18354fb/css/agilotext-test.webflow.shared.e5b39dcfe.min.css
```

Référence enregistrée le **29 avril 2026**. Si le fichier `*.min.css` change de nom après un publish Webflow, mettre à jour l’URL dans `index.html` et cette section.

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

#### Méthode recommandée — **GitHub Actions** (sparse checkout, sans sous-modules)

Le dépôt contient des sous-modules pointant vers des dépôts **privés ou inaccessibles** au runner anonyme. Le workflow officiel « Deploy from branch » tente de tout cloner → échec.

Le workflow **[Deploy GitHub Pages (docs only)](https://github.com/Agilotext/Agilotext-Scripts-Public/actions/workflows/deploy-docs-gh-pages.yml)** ne télécharge que le dossier **`docs/`** (pas les sous-modules).

1. **Settings** → **Pages** → **Build and deployment**.
2. Source : **GitHub Actions** (pas « Deploy from a branch » — désactive le build qui clone les sous-modules).
3. Pousser sur **`1.06`** ou lancer **Run workflow** sur ce fichier ; attendre un run **vert**.
4. L’URL ci-dessus doit répondre après 1–3 minutes.

Si besoin : **Settings** → **Actions** → **General** → *Workflow permissions* → **Read and write** (souvent déjà OK avec `permissions:` dans le YAML).

---

#### Méthode déconseillée — « Deploy from branch » + `/docs`

Peut échouer sur ce repo à cause des **sous-modules** (erreurs `repository … not found` sur Actions).

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
    height="620"
    style="display:block;border:0;width:100%;min-height:560px;"
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
  height="620"
  style="display:block;border:0;width:100%;min-height:560px;"
  loading="lazy"
></iframe>
```

Ajuster `height` / `min-height` selon la section (mobile : souvent 480–560px ; la démo « éditeur » est un peu plus haute que l’ancienne mini-app).

---

## Modifier la démo

1. Éditer `docs/webflow-embeds/homepage-mini-demo/index.html` et, si besoin, `demo-agilo-editor-patch.css`.
2. Commit + push sur **`1.06`**.
3. GitHub Pages se met à jour en quelques minutes ; jsDelivr peut mettre quelques minutes (cache CDN).
