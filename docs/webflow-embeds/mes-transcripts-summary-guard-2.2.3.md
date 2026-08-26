# Mes transcripts — logic-v2 2.2.6-empty-demo

**Branche :** `1.09` (pas `1.10`).  
**Fichier :** `scripts/pages/dashboard/Code-mes-transcripts-logic-v2.js`  
**Version JS :** `__agiloMesTranscriptsLogicVersion === '2.2.6-empty-demo'`

Inclut le probe CR (`2.2.5`) et l’état vide Free (plus d’erreur + 1 ligne exemple hors cache).

## Embed à changer uniquement

Remplacer **seulement** le `src` de `Code-mes-transcripts-logic-v2.js` (un seul tag) :

| Page | URL |
|------|-----|
| Business | `/app/business/mes-transcripts` |
| Pro | `/app/premium/mes-transcripts` |
| Free | `/app/free/mes-transcripts` |

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@SHA_PLACEHOLDER/scripts/pages/dashboard/Code-mes-transcripts-logic-v2.js?v=fc-SHA_PLACEHOLDER"></script>
```

Ordre : staging `agilotext-test`, puis Production www.

## Vérif

```js
window.__agiloMesTranscriptsLogicVersion
// attendu : '2.2.6-empty-demo'
```

Compte Free à 0 fichier : pas « Erreur de chargement », légende + 1 ligne Exemple, badge Mes fichiers reste 0. Compte avec des jobs : inchangé.
