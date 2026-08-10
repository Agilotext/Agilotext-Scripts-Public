# Déploiement Webflow — collage texte via Anon2 async (embed 2.4.16)

**Repo :** `Agilotext/Agilotext-Scripts-Public` uniquement (ne pas toucher `kawansoft/AgiloTextApi`).  
**Branche :** `fix/anon2-text-via-async-2.4.16` → merge dans `1.09` (après ou avec inclusion 2.4.15).  
**Page cible :** `/app/business/dashboard/anonymiser`

## Changement

Le collage texte n’utilise plus `/anonText`. Il passe par le même moteur que les fichiers :
`agilo-paste.txt` → `/anon2AsyncOfficeText` → poll → `/receiveAnon2Text`, avec `saveAnon2Options` + listes inclusion/exclusion.

## Script à pin dans Webflow (après push)

Remplacer le `src` par le **SHA du commit** tip de la branche (pas `@1.09`) :

Tip branche poussée : `1b9ffc0d2be2dc4271d7cd457afef60845c2b18b`

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1b9ffc0d2be2dc4271d7cd457afef60845c2b18b/CNOEC_Agiloshield_Docs/anonymisation/agiloshield-embed-anonymisation-anon2-beta.js?v=2.4.16" defer></script>
```

## Checklist post-pin

1. Console : `__AGILO_EMBED_ANON_VERSION__ === '2.4.16'`
2. Collage « Je suis Florian BAUER… » avec PER → nom tagué
3. Inclusion `Florian BAUER` / `ACME_FORCE_ANON_TEST` → forcé
4. Exclusion `KEEP_VISIBLE_TEST` → préservé
5. Frappe rapide dans le textarea → pas de spam de jobs
6. Historique : pas de `agilo-paste.txt` visible
7. Onglet Fichiers : régression zéro

## Coordination Nicolas

Ne pas supprimer l’alias `/anonText` avant ce pin CDN. Message : `MESSAGE_NICOLAS_TEXTE_ASYNC_2.4.16.txt`.
