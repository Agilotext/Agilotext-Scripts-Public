# Récap enjeux Fabienne / Nicolas — alignement interne

**Date :** 1er juin 2026  
**Problème actuel :** mauvaise communication — on parle « démo qu’on ne maîtrise pas » alors que ce n’est pas le sujet.

---

## Enjeu Fabienne (client réel, pas prospect froid)

| | |
|---|---|
| **Qui** | Fabienne HANRAS — Eurallia Finance, réseau M&A (16 cabinets, CNCEF/CNCFA) |
| **Quoi** | Elle **utilise déjà** Agiloshield. Elle veut pseudonymiser ses **bilans M&A** avant analyse IA. |
| **Quand** | Réunion direction **3–4 juin** — elle présente **seule** devant ses associés. |
| **Portée** | Si la direction valide → déploiement potentiel sur **tout le réseau** (pas un compte test). |
| **Ce qu’elle demande** | Rester dans **Claude** : upload bilan → pseudonymisation → analyse. C’est le **skill** (Python → API Anon2), pas la webapp seule. |
| **Ce qu’on lui a promis** | Retour accès + mode d’emploi **ce soir / demain**. |

**Point clé :** ce n’est pas « une démo Agilotext le 3 juin ». **C’est elle qui présente.** Nous, on doit lui livrer un truc qui **fonctionne quand elle l’utilise**.

---

## Enjeu Nicolas (backend — 15–30 min, pas un projet)

| | |
|---|---|
| **Blocage technique** | `GET /getToken` → `error_forbidden_source` dès qu’on appelle l’API **hors domaines autorisés** (curl, Python, skill Claude, MCP). |
| **Pourquoi ça bloque** | Le skill = appels **headless** vers `api.agilotext.com`. Même problème pour Cursor si on passait par getToken sans navigateur. |
| **Ce qu’on ne lui demande PAS** | Faire une démo. Présenter chez Fabienne. Ouvrir CORS / whitelist IP Claude en urgence. Livrer `auto_*` sur Anon2 **cette semaine**. |
| **Ce qu’on lui demande** | **Une** des deux voies auth ci-dessous — pour que Florian puisse tester le skill **de son côté** avant envoi à Fabienne. |
| **Intérêt pour lui** | Même flux que le MCP Cursor (getAuthToken) déjà en prod. Utile pour **tous** les clients headless (skill, scripts, Make), pas seulement Fabienne. |

---

## Ce qui a créé la confusion (à ne plus dire)

| Mauvais framing | Bon framing |
|-----------------|-------------|
| « Démo qu’on ne maîtrise pas le 3 juin » | **Zéro démo de notre côté.** Fabienne présente ; Claude + skill font le boulot. |
| « Plan B webapp si ça plante » | Plan B = secours **Fabienne**, pas notre responsabilité réunion. **Notre job = skill qui marche avant qu’elle le reçoive.** |
| « Marvin a Co-work, urgence concurrentielle » | Marvin n’est **pas** le moteur. **Fabienne est un client actif** avec une fenêtre réseau réelle. Marvin = référence produit à regarder 10 min, pas l’argument principal. |
| « Il faut livrer pour la démo mercredi » | Il faut livrer pour que **Florian valide end-to-end**, puis envoie guide + `.skill` à Fabienne. |

---

## Division du travail (clair)

### Florian (côté skill / client)
1. Reçoit auth de Nicolas
2. `build.py` → `.skill` pour `f.hanras@eurallia.fr`
3. **Teste tout chez lui** (pseudonymiser un bilan demo, vérifier clé `.properties`)
4. Envoie à Fabienne : accès + guide simple (Capabilities Claude, domaine `api.agilotext.com`, upload skill)
5. **Ne participe pas** à la réunion du 3–4

### Fabienne (côté usage)
1. Configure Claude Co-work (whitelist réseau si besoin)
2. Upload le `.skill`
3. Présente à sa direction **en autonomie**

### Nicolas (côté backend — choix **A ou B**)

**Option A — recommandée (≈15 min, déjà en prod MCP)**
1. Activer essai **Agiloshield Classic** sur `f.hanras@eurallia.fr` (1 mois)
2. Créer **mot de passe application** → envoyer le secret à Florian en privé
3. Confirmer **`edition`** Anon2 pour un abonné Classic (`ent` ou `agiloshield`)
4. Florian valide : `POST /getAuthToken` OK + appel Anon2 OK

**Option B — si tu préfères getToken**
1. Ouvrir `GET /getToken` pour appels **headless** (skill Python / Co-work / Cursor)
2. Avec contrôle sécurité explicite (pas username seul — à définir ensemble)
3. Florian adapte le skill pour utiliser getToken au lieu de getAuthToken

**Une seule option suffit.** Dis laquelle tu choisis.

**P1 juin (pas cette semaine) :** `automationToken` (`auto_*`) sur endpoints Anon2 — spec GUIDE_NICOLAS_MCP §10.

---

## Résumé une phrase

**Fabienne = client M&A qui veut anonymiser dans Claude ; Nicolas = débloquer l’auth API headless (getAuthToken ou getToken) ; Florian = faire marcher le skill avant de le lui envoyer — personne ne « fait la démo » pour elle.**
