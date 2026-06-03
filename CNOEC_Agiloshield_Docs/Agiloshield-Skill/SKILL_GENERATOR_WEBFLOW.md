# Déploiement Webflow — Générateur de skill (popup dashboard)

## Principe

- **Pas de page `/generate-skill`** pour l’usage courant.
- **Panneau latéral** sur `/tools/agiloshield/premium/dashboard` : clic pill « Claude » → popup avec formulaire.
- **Gros fichier** (`skill-generator-embed.html`, ~55 Ko) **uniquement sur jsDelivr** — jamais collé en entier dans Webflow.

## Limite Webflow (50 000 caractères)

| Zone | Limite | Usage |
|------|--------|--------|
| **Embed** (élément `</>`) | 50 000 car. max | HTML + CSS + JS comptent ensemble |
| Head / footer site | Autre quota | Éviter pour ce feature |

Référence : [Webflow Help — Custom code embed](https://help.webflow.com/hc/en-us/articles/33961332238611-Custom-code-embed)

`skill-generator-embed.html` ≈ **55 Ko** → **dépasse** la limite.  
→ Charger via [`skill-generator-dashboard.html`](skill-generator-dashboard.html) (fetch lazy au clic).

---

## Fichiers du repo

| Fichier | Où le coller dans Webflow |
|---------|---------------------------|
| [`skill-generator-sidebar-cta.html`](skill-generator-sidebar-cta.html) | Embed dans **`dashboard-left`** — CTA centré « Intégration Claude Cowork » |
| [`skill-generator-dashboard.html`](skill-generator-dashboard.html) | **1 embed** en bas du dashboard — panneau **75 %** largeur (88 % tablette, 100 % mobile) |
| [`skill-generator-embed.html`](skill-generator-embed.html) | **Ne pas coller** — servi par jsDelivr |
| [`generate_skill_embed.py`](generate_skill_embed.py) | Régénère l’embed après changement SKILL.md / agiloshield.py |

**Dépréciés** (ne plus utiliser) : `skill-generator-launcher.html`, `skill-generator-cdn-loader.html`, page dédiée `generate-skill`.

---

## CDN jsDelivr (branche `1.09`)

**Embed générateur (chargé dans le panneau) :**

```
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/CNOEC_Agiloshield_Docs/Agiloshield-Skill/skill-generator-embed.html
```

**Dashboard (drawer + lazy load) :**

```
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/CNOEC_Agiloshield_Docs/Agiloshield-Skill/skill-generator-dashboard.html
```

**Pill sidebar :**

```
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/CNOEC_Agiloshield_Docs/Agiloshield-Skill/skill-generator-sidebar-cta.html
```

Après chaque mise à jour : **recoller les 2 embeds** (sidebar + drawer), publier Webflow. Le drawer charge l’embed via `EMBED_CDN` (épinglé sur `@<sha>` dans le repo).

---

## Checklist Webflow — dashboard premium

### À faire

- [ ] **Supprimer** le 2e embed qui contient tout `skill-generator-embed.html` collé (visible en pleine page).
- [ ] Embed sidebar : contenu de `skill-generator-sidebar-cta.html` (bouton, **pas de lien** vers une autre page).
- [ ] Embed fin de page : contenu de `skill-generator-dashboard.html` (drawer seul).
- [ ] Embed anonymisation : `HTML_` inchangé côté skill (lien retiré dans la colonne droite).
- [ ] Stripe / tarifs : success URL → `/tools/agiloshield/premium/dashboard?upgraded=1`
- [ ] Lien upsell `?return=` pointe vers le dashboard (généré automatiquement par l’embed).

### Tests

- [ ] Clic pill → panneau droit, **pas** de navigation
- [ ] Compte Classic → formulaire 3 étapes + `.skill`
- [ ] Compte free → upsell dans le panneau
- [ ] Retour paiement `?upgraded=1` → panneau ouvert + activation Memberstack

---

## Stripe / tarifs

**Success URL par défaut :**

```
/tools/agiloshield/premium/dashboard?upgraded=1
```

**Return depuis upsell (généré par JS) :**

```
/tools/agiloshield/tarifs?return=%2Ftools%2Fagiloshield%2Fpremium%2Fdashboard%3Fupgraded%3D1
```

---

## Gate paywall

Agiloshield Classic : `prc_classic-mensuel-3u5vr0uq5` — géré dans l’embed, Memberstack sur la page parent (fetch dans le drawer, même origine).

---

## Régénérer l’embed

```bash
cd CNOEC_Agiloshield_Docs/Agiloshield-Skill
python3 generate_skill_embed.py
git add -f skill-generator-embed.html
# commit + push 1.09
```

Le dashboard charge la nouvelle version au prochain clic (cache jsDelivr : utiliser `@sha` si besoin immédiat).

---

## Support

- Build CLI : `python3 build.py --user email@...`
- Auth Claude : whitelist `api.agilotext.com`
