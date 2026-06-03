# Déploiement Webflow — Générateur de skill Agiloshield

## Fichiers

| Fichier | Rôle |
|---------|------|
| `skill-generator-embed.html` | Embed Custom Code à coller dans Webflow (HTML + CSS + JS + assets inlinés) |
| `generate_skill_embed.py` | Régénère l'embed après modification de `SKILL.md` ou `agiloshield.py` |

### Régénérer l'embed après mise à jour du skill

```bash
cd CNOEC_Agiloshield_Docs/Agiloshield-Skill
python3 generate_skill_embed.py
```

Puis commit + push, et recopier le HTML dans Webflow (ou servir via CDN si vous externalisez plus tard).

---

## Page Webflow

**URL recommandée :** `/tools/agiloshield/generate-skill`

- Page protégée Memberstack (utilisateur connecté)
- Un seul bloc **Embed** (Custom Code) : contenu complet de `skill-generator-embed.html`
- JSZip est déjà inclus dans l'embed (`cdnjs.cloudflare.com`)

**Option :** section dans le dashboard premium Agiloshield au lieu d'une page dédiée.

---

## Gate paywall (Agiloshield Classic uniquement)

Seuls les membres avec plan actif **Agiloshield Classic** peuvent accéder au formulaire :

- `priceId` : `prc_classic-mensuel-3u5vr0uq5`
- ou `planId` commençant par `pln_agiloshield`

Statuts acceptés : `ACTIVE`, `TRIALING`, `GRACE`.

### Écrans affichés

| Situation | Écran |
|-----------|--------|
| Memberstack indisponible / non connecté | Connexion requise → `/auth/login` |
| Connecté sans Classic | Upsell + « Voir les tarifs » |
| Retour post-paiement `?upgraded=1`, plan pas encore actif | Activation en cours + Recharger |
| Classic actif | Formulaire 3 étapes + téléchargement `.skill` |

---

## Parcours post-paiement

### 1. Lien « Voir les tarifs » (généré par l'embed)

```
/tools/agiloshield/tarifs?return=%2Ftools%2Fagiloshield%2Fgenerate-skill%3Fupgraded%3D1
```

### 2. Page tarifs Webflow

Sur la page `/tools/agiloshield/tarifs`, ajouter un script (ou logique existante) qui :

1. Lit `?return=` dans l'URL
2. Passe cette URL à Stripe / Webflow Memberships comme **success URL** après paiement

Si pas de `return`, utiliser par défaut :

```
/tools/agiloshield/generate-skill?upgraded=1
```

### 3. Retour utilisateur

Après paiement, l'utilisateur arrive sur :

```
/tools/agiloshield/generate-skill?upgraded=1
```

L'embed :

- affiche le spinner « Vérification de votre accès… »
- relance `getCurrentMember({ useCache: false })` jusqu'à **3 fois** (intervalle 2 s)
- débloque le formulaire dès que Classic est détecté
- sinon affiche « abonnement en cours d'activation »

### 4. Déjà abonné

Bouton **« Déjà abonné ? Recharger la page »** → `location.reload()` pour re-vérifier Memberstack.

---

## Lien depuis « Mon compte » / dashboard

Ajouter un CTA dans le dashboard Agiloshield premium :

- Texte : **Générer mon skill Claude**
- Lien : `/tools/agiloshield/generate-skill`

---

## Contenu du fichier `.skill` généré

```
agiloshield-skill/
  SKILL.md
  scripts/
    agiloshield.py
    config.py      ← email Memberstack + types + mode
    __init__.py
```

- Nom : `agiloshield-{profil}-{YYYYMMDD}.skill`
- Auth : `USE_GET_TOKEN = True`, `EDITION = "ent"` (compatible API getToken)
- Aucun token saisi par l'utilisateur dans le formulaire

---

## Checklist déploiement

- [ ] Page `/tools/agiloshield/generate-skill` créée avec embed
- [ ] Page membre Memberstack (login requis)
- [ ] Success URL Stripe → `.../generate-skill?upgraded=1`
- [ ] Lien tarifs avec param `return` testé bout en bout
- [ ] Test compte Free → upsell visible, pas de download
- [ ] Test compte Classic → download OK, ZIP ouvrable dans Claude Cowork
- [ ] Test Fabienne : profil Juridique, décocher LOC / JOB / PRO

---

## CDN (optionnel — maintenance)

Si vous préférez ne pas coller 50+ Ko dans Webflow à chaque release :

1. Commit `skill-generator-embed.html` sur `Agilotext-Scripts-Public`
2. Webflow : `<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@{commit}/CNOEC_Agiloshield_Docs/Agiloshield-Skill/skill-generator-embed.html"></script>` — **non applicable** pour un HTML embed ; utiliser un **div + fetch** réintroduit le problème CORS. **Recommandation :** garder le copier-coller Webflow ou héberger le HTML en Custom Code via fichier statique sur le même domaine.

---

## Support

- Skill CLI interne (équipe) : `python3 build.py --user email@...` (inchangé)
- Problème auth dans Claude : vérifier whitelist `api.agilotext.com` et `python3 .../agiloshield.py settings`
