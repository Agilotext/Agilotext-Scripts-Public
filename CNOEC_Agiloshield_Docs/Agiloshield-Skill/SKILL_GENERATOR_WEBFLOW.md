# Déploiement Webflow — Générateur de skill Agiloshield

## Fichiers du repo

| Fichier | Rôle |
|---------|------|
| `skill-generator-embed.html` | Embed principal (~52 Ko) — page dédiée **ou** iframe drawer |
| `skill-generator-launcher.html` | Panneau latéral Marvin (dashboard) — lazy-load iframe |
| `skill-generator-sidebar-cta.html` | Carte CTA pour `dashboard-left` |
| `generate_skill_embed.py` | Régénère l'embed après modification de `SKILL.md` ou `agiloshield.py` |

**Ne pas fusionner** le générateur dans `HTML_` (réservé à l'anonymisation). Un lien discret optionnel existe dans `aside.agf-side` de `HTML_`.

### Régénérer l'embed

```bash
cd CNOEC_Agiloshield_Docs/Agiloshield-Skill
python3 generate_skill_embed.py
```

Puis recopier `skill-generator-embed.html` dans Webflow (ou republier si vous servez la page iframe depuis le même domaine).

**Logo Claude (CDN Webflow) :**  
`https://cdn.prod.website-files.com/6815bee5a9c0b57da18354fb/6a1f116a08744afd7c5e0ee9_claude-color.png`

---

## Niveau 1 — Page dédiée (prioritaire)

**URL :** `/tools/agiloshield/generate-skill`

1. Dupliquer la structure du dashboard premium (navbar / sidebar si souhaité).
2. **Un seul bloc Embed** : coller **tout** `skill-generator-embed.html`.
3. Memberstack : **Members only** (comme le dashboard).
4. Publier.

Cette page sert de :

- URL de retour Stripe : `?upgraded=1`
- Lien direct doc / emails
- Cible iframe du drawer (`?drawer=1`)

---

## Niveau 2 — Expérience Marvin (dashboard premium)

Trois blocs Webflow sur `/tools/agiloshield/premium/dashboard` :

| Emplacement | Fichier | Détail |
|-------------|---------|--------|
| **A. Sidebar** (`dashboard-left`) | `skill-generator-sidebar-cta.html` | Carte logo Claude + lien ; `data-ags-open-drawer` ouvre le panneau si le launcher est présent |
| **B. Bas de page** (hors embed anonymisation) | `skill-generator-launcher.html` | Drawer + iframe lazy vers `/generate-skill?drawer=1` |
| **C. Page dédiée** | `skill-generator-embed.html` | Contenu chargé dans l'iframe (mode drawer via `?drawer=1`) |

**Alternative rapide (sans drawer) :** carte sidebar avec lien seul vers `/generate-skill` — retirer `data-ags-open-drawer` du snippet ou ne pas coller le launcher.

**Hash d'ouverture :** `#open-skill-gen` ou `#ags-open-drawer` ouvre le drawer au chargement.

---

## Stripe / tarifs

### Success URL (obligatoire)

Sur `/tools/agiloshield/tarifs`, après paiement Classic :

```
/tools/agiloshield/generate-skill?upgraded=1
```

Configurer dans Stripe / Webflow Memberships comme **success URL** par défaut si aucun `?return=` n'est fourni.

### Lien « Voir les tarifs » (généré par l'embed upsell)

```
/tools/agiloshield/tarifs?return=%2Ftools%2Fagiloshield%2Fgenerate-skill%3Fupgraded%3D1
```

La page tarifs doit lire `?return=` et le transmettre à Stripe comme success URL.

### Comportement post-paiement

L'embed sur `?upgraded=1` :

- affiche « Vérification de votre accès… »
- relance `getCurrentMember({ useCache: false })` jusqu'à **3×** (2 s d'intervalle)
- débloque le formulaire si Classic actif
- sinon « abonnement en cours d'activation » + Recharger

---

## Gate paywall (Agiloshield Classic uniquement)

- `priceId` : `prc_classic-mensuel-3u5vr0uq5`
- ou `planId` commençant par `pln_agiloshield`
- Statuts : `ACTIVE`, `TRIALING`, `GRACE`

| Situation | Écran |
|-----------|--------|
| Non connecté | Connexion → `/auth/login` |
| Sans Classic | Upsell + tarifs |
| `?upgraded=1`, plan pas encore actif | Activation en cours |
| Classic actif | Formulaire 3 étapes + `.skill` |

**CTA visible pour tous** (free inclus) : le paywall est géré en JS dans l'embed — ne pas masquer le CTA avec `data-ms-content` seul.

---

## Premium vs free

| Contexte | Mise en place |
|----------|----------------|
| Dashboard premium | Sidebar CTA + launcher (optionnel) + page dédiée |
| Utilisateur Classic | Formulaire + download automatique |
| Free / legacy | Même CTA → upsell dans embed ou drawer |
| Variante free dashboard | Dupliquer la carte CTA + lien ou embed identique |

---

## Lien dans la colonne anonymisation (`HTML_`)

Au-dessus de « Voter pour la prochaine fonctionnalité » : lien **Générer mon skill Claude →** avec `data-ags-open-drawer` (nécessite `skill-generator-launcher.html` sur la page dashboard).

Sans launcher : le lien navigue vers `/tools/agiloshield/generate-skill`.

---

## Mode drawer (`?drawer=1`)

L'embed ajoute la classe `ags--drawer` (pleine hauteur, pas de `max-width` centré) quand :

- l'URL contient `?drawer=1`, ou
- la page est dans une iframe (`window.self !== window.top`)

Utilisé par `skill-generator-launcher.html` pour l'iframe.

---

## Contenu du `.skill` généré

```
agiloshield-skill/
  SKILL.md
  scripts/
    agiloshield.py
    config.py
    __init__.py
```

- Nom : `agiloshield-{profil}-{YYYYMMDD}.skill`
- Auth : `USE_GET_TOKEN = True`, `EDITION = "ent"`

---

## Checklist Webflow

### Page `/tools/agiloshield/generate-skill`

- [ ] Slug `generate-skill`, dossier `tools/agiloshield`
- [ ] Memberstack members only
- [ ] 1 embed = `skill-generator-embed.html` complet
- [ ] Test Classic → download OK
- [ ] Test sans Classic → upsell

### Stripe

- [ ] Success URL → `/tools/agiloshield/generate-skill?upgraded=1`
- [ ] `?return=` depuis upsell testé bout en bout

### Dashboard premium

- [ ] Carte CTA : `skill-generator-sidebar-cta.html` dans `dashboard-left`
- [ ] Option Marvin : `skill-generator-launcher.html` en bas de page
- [ ] Embed anonymisation inchangé (`HTML_` seul)

### Free / teasing

- [ ] Même carte CTA sur variante free (si existante)

### Optionnel

- [ ] Republier embed anonymisation après mise à jour `HTML_` (lien skill dans `agf-side`)

---

## Limite de caractères Webflow (CDN)

Si l’embed complet (~55 Ko) dépasse la limite Webflow, coller **`skill-generator-cdn-loader.html`** (~650 caractères) à la place. Il charge le HTML depuis jsDelivr ; Memberstack reste sur la page parent (même origine).

**Fichier complet sur GitHub (branche `1.09`) :**

https://github.com/Agilotext/Agilotext-Scripts-Public/blob/1.09/CNOEC_Agiloshield_Docs/Agiloshield-Skill/skill-generator-embed.html

**CDN jsDelivr (contenu servi au loader) :**

```
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/CNOEC_Agiloshield_Docs/Agiloshield-Skill/skill-generator-embed.html
```

Après un nouveau commit, mettre à jour la version dans `skill-generator-cdn-loader.html` (`@1.09` ou `@<sha>`).

**Alternative sans fetch :** page `/generate-skill` + iframe (voir `skill-generator-launcher.html`).

---

## Support

- Build CLI équipe : `python3 build.py --user email@...`
- Auth Claude : whitelist `api.agilotext.com`, `agiloshield.py settings`
