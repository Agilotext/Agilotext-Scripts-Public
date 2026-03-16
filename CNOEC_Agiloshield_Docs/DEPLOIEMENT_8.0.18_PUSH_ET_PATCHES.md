# Déploiement 8.0.18 — Push et patches

## 2. Pousser le moteur Python

Ça, tu peux le pousser directement si tu as les droits sur Agilotext/spacy-anon.

```bash
cd /Users/florianbauer/Documents/AGILOTEXT/Agilotext-Scripts-Public/CNOEC_Agiloshield_Docs/spacy-anon-8.0.18
git push -u origin codex/spacy-anon-8.0.18-excel-hardening
```

## 3. Pour l'API Java : ne pousse pas 1.9.220 directement

Le commit Java est actuellement sur 1.9.220.  
Je te conseille de créer une branche dédiée avant push, pour ne pas balancer ça brut sur la branche de travail.

```bash
cd /Users/florianbauer/Documents/AGILOTEXT/AgiloTextApi
git branch codex/agilotextapi-1.9.220-contextual-hardening
git checkout codex/agilotextapi-1.9.220-contextual-hardening
git push -u origin codex/agilotextapi-1.9.220-contextual-hardening
```

## Si le push échoue (droits Kawansoft)

Alors tu n'insistes pas. Tu fais juste ça :

- **API** : tu envoies à Nicolas le patch `PATCH_8.0.18_AGILOTEXTAPI_CONTEXTUAL_HARDENING.patch`
- **Moteur** : soit il pull la branche poussée, soit tu lui envoies aussi `PATCH_8.0.18_SPACY_ANON_CONTEXTUAL_HARDENING.patch`
