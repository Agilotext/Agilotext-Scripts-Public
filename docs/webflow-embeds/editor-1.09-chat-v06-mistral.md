# Webflow — Chat V06 (logo Mistral) — branche 1.09

**Test uniquement** : remplace temporairement `chat-loader.js` par `chat-loader-v06.js` sur la page éditeur.

**Prod inchangée** : `chat-loader.js` → `Code-chat_V05.js`

## Script à coller dans Webflow (Before `</body>` ou zone custom code éditeur)

```html
<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/pages/editor/chat-loader-v06.js?v=1.09"></script>
```

## Forcer le rechargement CDN (si cache)

Ajouter sur l’URL de la page éditeur : `?agilo_cdn_bust=20260602-1`

## Vérification console

```js
window.__agiloChatLoaderDiag?.()
// attendu : loader: 'v06-mistral', v06: true, ref: '1.09'
window.__agiloChatVersion
// attendu : 'V06-mistral-thinking'
```

## Fichiers du lot

| Fichier | Rôle |
|---------|------|
| `chat-loader-v06.js` | Loader test → V06 |
| `Code-chat_V06.js` | Chat (copie V05 + logo Mistral) |
| `chat-embed-styles.css` | Styles `.mistral-thinking*` (partagé V05/V06) |

## Retour prod

```html
<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/pages/editor/chat-loader.js?v=1.09"></script>
```
