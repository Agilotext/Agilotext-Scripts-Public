# Déploiement Webflow — pastilles / compteur collage Anon2 (embed 2.4.17)

**Repo :** `Agilotext/Agilotext-Scripts-Public` uniquement.  
**Branche :** `fix/anon2-text-display-2.4.17` (empilée sur 2.4.16 texte async).  
**Page :** `/app/business/dashboard/anonymiser`

## Changement

- Pastilles colorées pour placeholders Anon2 `<PREFIX_SUFFIX>` (après `escapeHtml` → `&lt;…&gt;`)
- Compteur / chips : plus de faux « Aucune donnée personnelle… » quand des tags sont visibles
- Copie = plain avec tags `<…>` intacts
- CSS : `.agf-tag-PII` (= PR), alias TEL/EML

## Script à pin (après push)

Remplacer par le **SHA tip** de la branche :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@SHA_DU_COMMIT/CNOEC_Agiloshield_Docs/anonymisation/agiloshield-embed-anonymisation-anon2-beta.js?v=2.4.17" defer></script>
```

Si le CSS est chargé depuis le même repo / CDN, republier aussi `agiloshield-embed-anonymisation.css` (sinon l’alias `PII`→`PR` côté JS suffit pour le cas screenshot).

## Checklist

1. Console : `__AGILO_EMBED_ANON_VERSION__ === '2.4.17'`
2. Collage phrase Florian / Saint-mandé → pastilles + résumé > 0
3. Copier → clipboard contient `<PII_AA>`
4. Legacy `[PR]` toujours coloré
5. Fichiers + debounce 2.4.16 OK
