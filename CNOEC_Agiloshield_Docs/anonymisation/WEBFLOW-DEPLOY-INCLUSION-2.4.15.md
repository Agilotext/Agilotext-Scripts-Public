# Déploiement Webflow — Inclusion / Exclusion Anon2 (embed 2.4.15)

**Repo :** `Agilotext/Agilotext-Scripts-Public` uniquement (ne pas toucher `kawansoft/AgiloTextApi`).  
**Branche :** `feat/anon2-inclusion-exclusion-2.4.15` → merge dans `1.09`.  
**Page cible canary :** `/app/business/dashboard/anonymiser`

## Contrat API (lecture seule)

- Endpoint fichiers : `POST /api/v1/anon2AsyncOfficeText`
- Params : `anon2InclusionListJson`, `anon2ExclusionListJson` (JSON array de strings)
- Disponible depuis API **4.0.79** (prod vérifiée **4.0.98** le 10/08/2026)
- Pas de CRUD serveur : listes en localStorage navigateur

## Script à pin dans Webflow (après merge / push)

Remplacer le `src` de `agiloshield-embed-anonymisation-anon2-beta.js` par le **SHA du commit** (pas `@1.09`) :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@79cc7a3a2a7f1fbdac620e8062b75538db60a993/CNOEC_Agiloshield_Docs/anonymisation/agiloshield-embed-anonymisation-anon2-beta.js?v=2.4.15" defer></script>
```

Canary Business : l’UI Inclusion s’affiche automatiquement sur les paths `/business/` et `/app/business/dashboard/anonymiser` si `getVersion >= 4.0.79`.

Override QA : `?featureInclusionUi=1`  
Kill-switch : `?featureInclusion=0`

## Checklist post-pin

1. Console : `__AGILO_EMBED_ANON_VERSION__ === '2.4.15'`
2. Bouton Inclusion/Exclusion visible sur Business anonymiser
3. Network upload : FormData contient `anon2InclusionListJson` et `anon2ExclusionListJson`
4. Fixture `fixtures/inclusion-exclusion-smoke.txt` :
   - inclusion `ACME_FORCE_ANON_TEST` → anonymisé
   - exclusion `KEEP_VISIBLE_TEST` → visible
5. Upload sans listes : comportement inchangé
6. Collage texte : pas d’envoi des listes (toast informatif)

## Hors scope

- Repo Java Nicolas
- `limited.js` / pages free
- Persistance multi-appareils
