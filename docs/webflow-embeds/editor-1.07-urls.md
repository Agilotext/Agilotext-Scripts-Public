# Webflow — scripts éditeur `@1.07` (compte-rendu, erreurs Mistral, redo)

Base CDN (branche **1.07**) :

```
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.07/scripts/pages/editor/<FICHIER>
```

Ajouter un cache-buster en prod si besoin : `?v=1.07.0` (ou hash court).

---

## Ordre conseillé (dépendances)

1. **`token-resolver.js`** — jetons Memberstack → `globalToken` (si votre page ne le charge pas déjà ailleurs).  
2. **`orchestrator.js`** — si utilisé comme sur la prod actuelle.  
3. **`agilo-editor-creds.js`** — **doit précéder `relance-compte-rendu.js`** (erreur sinon).  
4. Puis iframe, header, chat, modèles CR, etc.

---

## Les plus importants pour **compte-rendu / redo / erreurs API (dont Mistral)**

| Rôle | Fichier |
|------|---------|
| Transcript + résumé dans l’iframe, alertes métier (`userErrorMessage`), détails techniques | `Code-main-editor-IFRAME_V04.js` |
| Statut job, liens téléchargement CR/transcript (`userErrorMessage` / erreurs) | `Code-ed-header.js` |
| **Régénérer le compte-rendu**, `redoSummary`, alertes API | `relance-compte-rendu.js` |
| Modèles de compte-rendu / variations cases | `Code-modeles-compte-rendu.js` |
| Chat IA / re-prompt (**ON_ERROR**, message utilisateur avant exception Java) | `Code-chat_V05.js` |

---

## Balises `<script>` prêtes à copier-coller

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.07/scripts/pages/editor/Code-main-editor-IFRAME_V04.js?v=1.07" defer></script>

<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.07/scripts/pages/editor/Code-ed-header.js?v=1.07"></script>

<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.07/scripts/pages/editor/agilo-editor-creds.js?v=1.07"></script>

<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.07/scripts/pages/editor/relance-compte-rendu.js?v=1.07"></script>

<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.07/scripts/pages/editor/Code-modeles-compte-rendu.js?v=1.07"></script>

<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.07/scripts/pages/editor/Code-chat_V05.js?v=1.07"></script>
```

---

## Liens bruts (une URL par ligne)

```
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.07/scripts/pages/editor/Code-main-editor-IFRAME_V04.js
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.07/scripts/pages/editor/Code-ed-header.js
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.07/scripts/pages/editor/agilo-editor-creds.js
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.07/scripts/pages/editor/relance-compte-rendu.js
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.07/scripts/pages/editor/Code-modeles-compte-rendu.js
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.07/scripts/pages/editor/Code-chat_V05.js
```

Helper partagé (optionnel, chargement global avant les scripts métier) :

```
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.07/scripts/shared/agilo-api-error-format.js
```
