# Mes transcripts — logic-v2 2.2.7-demo-row

**Parent Git :** `1.11` (nouvelle branche = `git checkout -b fix/foo origin/1.11`).  
**Gelées :** `1.09` et `1.10` (fourches parallèles, pas une suite). Ne pas forker le plus grand numéro.  
**Live Mes transcripts :** pin SHA `@5094a73`, pas `@1.11` flottant. Créer `1.11` ne change pas Webflow.  
**Tickets :** `fix/…` ou `feat/…`. `1.12` seulement pour une nouvelle intégration figée.  
**Fichier :** `scripts/pages/dashboard/Code-mes-transcripts-logic-v2.js`  
**Version JS :** `__agiloMesTranscriptsLogicVersion === '2.2.7-demo-row'`

Inclut le probe CR (`2.2.5`), l’état vide Free, et la ligne exemple sans badge (clics bloqués).

## Embed à changer uniquement

Remplacer **seulement** le `src` de `Code-mes-transcripts-logic-v2.js` (un seul tag) :

| Page | URL |
|------|-----|
| Business | `/app/business/mes-transcripts` |
| Pro | `/app/premium/mes-transcripts` |
| Free | `/app/free/mes-transcripts` |

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@5094a73/scripts/pages/dashboard/Code-mes-transcripts-logic-v2.js?v=fc-5094a73"></script>
```

Ordre : staging `agilotext-test`, puis Production www.

## Vérif

```js
window.__agiloMesTranscriptsLogicVersion
// attendu : '2.2.7-demo-row'
```

Compte Free à 0 fichier : une ligne, pas de tag bleu, Éditer / Télécharger ne font rien. Badge Mes fichiers reste 0.
