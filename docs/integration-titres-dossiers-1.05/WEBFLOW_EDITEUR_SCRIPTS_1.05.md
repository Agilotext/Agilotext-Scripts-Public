# Webflow — page « Éditeur de transcripts » (Business) : scripts 1.05

Base CDN (remplace `@1.02` / fichiers locaux `_files` par la branche **`1.05`** une fois mergée et jsDelivr à jour) :

```text
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.05/scripts/pages/editor/<NOM_FICHIER>.js
```

## Option A — Un seul loader (recommandé si tu acceptes le bundle défini dans le repo)

Dans le **footer** de la page (ou un seul embed global), **une** balise :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.05/scripts/pages/editor/editor-main.js"></script>
```

Tests sans toucher la prod : ajoute sur l’URL de la page `?agilo_cdn_branch=1.05&debug=1` (la query `agilo_cdn_branch` surcharge la branche Git utilisée par jsDelivr dans `editor-main.js`).

**Important :** le loader charge `Code-main-editor.js` (iframe « standard » du repo). Si ta page utilise aujourd’hui **`Code-main-editor-IFRAME_V04.js`**, tu as deux choix :

1. **Garder IFRAME_V04** : laisse **un** embed avec ce script **en plus** du loader, mais **retire** du loader la ligne équivalente en dupliquant… En pratique, plus simple : **ne pas** utiliser le loader complet et passe à l’option B en remplaçant fichier par fichier.
2. **Aligner sur le repo** : remplace l’embed IFRAME_V04 par la version servie par le loader (`Code-main-editor.js`) **seulement** après test fonctionnel (comportement iframe / résumé).

Dans tous les cas : **supprime l’ancien embed inline** `code-ed-header` (le gros `<script>(()=>{ __agiloEditorHeader_v4 ...` ) **si** tu charges `editor-main.js` ou `Code-ed-header.js` depuis le CDN — sinon le header s’exécute en double (le garde `v5` bloquera la 2ᵉ copie, mais c’est fragile).

---

## Option B — Même ordre que `editor-main.js`, une balise par fichier (symboles Webflow)

Copie-colle **dans l’ordre** (tu peux répartir dans tes symboles, mais l’ordre global de la page doit rester celui-ci) :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.05/scripts/pages/editor/Code-editor-css.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.05/scripts/pages/editor/Code-rename-menu-css.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.05/scripts/pages/editor/Code-chat-css.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.05/scripts/pages/editor/Code-rail-css.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.05/scripts/pages/editor/token-resolver.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.05/scripts/pages/editor/orchestrator.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.05/scripts/pages/editor/ready-count.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.05/scripts/pages/editor/Code-lecteur-audio.js"></script>
```

**Éditeur principal** — choisir **un** des deux (comme sur ton export actuel) :

```html
<!-- Variante iframe V04 (ton export Webflow) -->
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.05/scripts/pages/editor/Code-main-editor-IFRAME_V04.js"></script>
```

ou

```html
<!-- Variante chargée par editor-main.js par défaut -->
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.05/scripts/pages/editor/Code-main-editor.js"></script>
```

Suite (ordre inchangé) :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.05/scripts/pages/editor/Code-changement-audio.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.05/scripts/pages/editor/Code-chat.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.05/scripts/pages/editor/Code-ed-header.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.05/scripts/pages/editor/Code-questions-ia.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.05/scripts/pages/editor/Code-copy-paste-text.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.05/scripts/pages/editor/Code-save_transcript.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.05/scripts/pages/editor/Code-gsap.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.05/scripts/pages/editor/Code-lottie.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.05/scripts/pages/editor/relance-compte-rendu.js"></script>
```

Les autres scripts de ton export (ex. `Code-modeles-compte-rendu.js`, variante `Code-chat_V05-rich-email-test.js`) restent **en plus** si tu les utilises encore — mets-les **après** les dépendances qu’ils supposent (souvent après chat / éditeur).

---

## Fichier nouveau côté 1.05

- [`Code-ed-header.js`](../../scripts/pages/editor/Code-ed-header.js) : header (titre via `jobTitle` + `renameTranscriptTitle`, plus téléchargements / export / webhook / suppression). Remplace l’embed inline `__agiloEditorHeader_v4`.

---

## Après publication Webflow

Purge cache navigateur ou ajoute `?v=` sur la première URL de script si jsDelivr met du temps à rafraîchir.
