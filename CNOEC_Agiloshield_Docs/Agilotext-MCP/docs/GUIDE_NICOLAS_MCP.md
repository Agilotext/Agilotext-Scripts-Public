# Guide MCP Agiloshield — pour Nicolas

**Document interne · Mai 2026 · v1.3.0**

---

## 1. C'est quoi un MCP ? (en 2 minutes)

Imagine que **Claude, Cursor ou Claude Code** sont des assistants qui savent parler, mais qui ne savent pas anonymiser un PDF tout seuls.

Un **MCP (Model Context Protocol)** est un **petit programme local** qui tourne sur la machine de l'utilisateur et qui **donne des super-pouvoirs** à l'assistant :

| Sans MCP | Avec MCP Agiloshield |
|----------|----------------------|
| L'utilisateur copie-colle un contrat dans Claude | L'utilisateur dit : « Protège ce PDF avant Claude » |
| Les noms réels partent chez Anthropic | Le MCP appelle **notre API Anon2**, pseudonymise, renvoie un fichier safe |
| Risque RGPD | Couche de conformité |

**Analogie simple :** le MCP est une **prise murale** entre Cursor/Claude et notre API Agiloshield. L'IA branche un câble standard (MCP) ; nous fournissons l'électricité (anonymisation).

**Ce n'est PAS :**
- une application web (comme Marvin Lab)
- un plugin navigateur
- un nouveau serveur à déployer côté Agilotext pour chaque utilisateur

**C'est :**
- un binaire Node.js (`dist/index.js`) lancé en local
- qui appelle l'**API Anon2 existante** (`api.agilotext.com/api/v1`)
- avec les identifiants du compte Agiloshield de l'utilisateur

---

## 2. Architecture — qui fait quoi ?

```
[Utilisateur dans Cursor]
        │
        │  « Protège mon_bilan.docx »
        ▼
[MCP Agiloshield — LOCAL sur le PC du user]
        │  secure_file_for_ai
        │  (profil M&A, pseudonymisation)
        ▼
[API Agilotext — DÉJÀ EXISTANTE]
        │  /anon2AsyncOfficeText
        │  /getAnon2Status
        │  /receiveAnon2Text
        ▼
[Moteur Anon2 — SERVEURS AGILOTEXT]
        │  Java + Python (Presidio, PDFBox…)
        ▼
[Réponse → fichier .pseudonymized.docx]
        │
        ▼
[.agiloshield/outputs/ sur le PC du user]
        │
        ▼
[Utilisateur envoie CE fichier à Claude — pas l'original]
```

**Point clé pour Nicolas :** le MCP est un **client fin** de l'API Anon2. Il ne remplace pas Anon2. Il ne duplique pas le moteur. Toute la lourdeur (NER, PDF, Office) reste **chez nous**.

---

## 3. Ce qu'on a livré (v1.2.0)

| Composant | Rôle |
|-----------|------|
| `secure_file_for_ai` | Outil principal — profils métier (M&A, juridique…), sandbox, manifest |
| `restore_file` | Restauration via manifest + clé `.properties` |
| `list_data_types` | Liste des 13 types Anon2 |
| `dry_run: true` | Preview des entités avant écriture disque |
| Sandbox `.agiloshield/` | outputs, keys, manifests, restored — audit trail local |
| Onboarding web | `onboarding/index.html` — wizard 5 étapes sans terminal |
| 8 outils avancés | batch, download, configure… — marqués `[AVANCÉ]` |

**Tests validés (mai 2026) :**
- 12 tests unitaires OK
- 4 tests intégration API live OK
- E2E PDF pseudonymisation + restore OK
- E2E dry_run 70 entités détectées OK

---

## 4. Pourquoi c'est mieux que Marvin (honnêtement)

| Critère | Marvin Systems | Agiloshield MCP |
|---------|----------------|-----------------|
| **Standard** | Format `.skill` propriétaire, webapp Lab | **MCP standard** — Cursor, Claude Desktop, Claude Code, Windsurf |
| **Où tournent les docs** | Serveurs Marvin (SaaS) | API Agilotext (compte client) + **fichiers safe en local** |
| **Restauration** | `clientPseudoMap` côté client — perdu = irréversible | **`.properties` + manifest JSON** — traçabilité |
| **Verrou vendeur** | Ne marche que dans leur écosystème | Interopérable avec tout client MCP |
| **Preview** | UI web riche (leur force) | `dry_run` + preview entités (v1.2) |
| **Onboarding** | Wizard 7 étapes web (excellent) | Wizard HTML local (v1.2) — à héberger sur lab.agilotext.com |
| **Backend** | PocketBase + workers propres | **Réutilise Anon2** — pas de double infra |
| **HDS / hébergement FR** | Scaleway (à vérifier contrat) | **Déjà sur infra Agilotext Normandie** |

**Ce que Marvin fait mieux aujourd'hui :**
- UX preview visuelle dans le navigateur
- Zéro install (100 % web)
- 26 types d'entités FR vs nos 13

**Notre avantage structurel :**
- Pas de second backend à maintenir
- MCP = distribution virale dans la communauté dev/IA
- Pont Agilotext → Agiloshield (transcription → anonymisation)

---

## 5. Faut-il déployer un serveur MCP en HDS ?

**Non, pas pour le modèle actuel.**

| Élément | Où ça tourne | HDS ? |
|---------|--------------|-------|
| MCP serveur | **PC du client** (Cursor/Claude) | Non — c'est local |
| Traitement Anon2 | **Serveurs Agilotext** (existant) | **Oui — déjà le cas** |
| Fichiers `.properties` | **Disque local client** | Responsabilité client |
| API auth | `api.agilotext.com` | Infra actuelle |

**Conclusion :** le MCP n'ajoute **aucun nouveau composant serveur** à héberger. Il consomme l'API Anon2 comme le front Webflow actuel.

**Cas où un serveur MCP centralisé serait utile (plus tard, optionnel) :**
- Clients enterprise **sans** Cursor/Claude local (DSI qui veut tout centraliser)
- Audit centralisé des appels MCP
- → Ce serait un **MCP HTTP/SSE distant** pointant vers la même API — **phase 2**, pas nécessaire pour Fabienne ni pour les tests Nicolas.

**Pour scale :**
1. **Court terme** : MCP local + API Anon2 (actuel) — scale = scale Anon2
2. **Moyen terme** : rate limiting / quotas par compte sur API (déjà prévu côté backend)
3. **Long terme** : MCP gateway enterprise optionnel si demande contractuelle

---

## 6. Installation — étapes pour Nicolas

### Prérequis
- Node.js 18+
- Compte Agiloshield avec mot de passe application
- Cursor, Claude Desktop, ou Claude Code CLI

### Étape 1 — Cloner et builder

```bash
git clone https://github.com/Agilotext/MCP-Agiloshield.git
cd MCP-Agiloshield
npm install
npm run build
npm test
```

### Étape 2 — Fichier env (NE PAS mettre dans mcp.json)

Créer `~/.cursor/agiloshield-mcp.env` :

```env
AGILOSHIELD_USERNAME=nicolas@...
AGILOSHIELD_PASSWORD=...
AGILOSHIELD_EDITION=agiloshield
AGILOSHIELD_API_EDITION=ent
AGILOSHIELD_API_URL=https://api.agilotext.com/api/v1
AGILOSHIELD_MAX_FILE_MB=50
```

### Étape 3 — Launcher

Copier `scripts/agiloshield-ensure-with-env.mjs` vers `~/.cursor/` (ou utiliser celui généré par `onboarding/index.html`).

### Étape 4 — Config Cursor

Dans `~/.cursor/mcp.json` :

```json
{
  "mcpServers": {
    "agiloshield": {
      "command": "node",
      "args": ["/Users/nicolas/.cursor/agiloshield-ensure-with-env.mjs"]
    }
  }
}
```

Redémarrer Cursor → Settings → MCP → vérifier `agiloshield` (11 tools, v1.2.0).

### Étape 5 — Test manuel API

```bash
node scripts/integration-test.mjs
```

### Étape 6 — Test dans Cursor

> Protège `/chemin/vers/test.pdf` avec le profil M&A

> Prévisualise les entités avec dry_run sur le même fichier

---

## 7. Ce dont Nicolas a besoin côté backend (Anon2)

Le MCP **ne demande pas de nouvel endpoint Anon2**. Il utilise :

| Endpoint | Usage MCP / Skill |
|----------|-------------------|
| `/getAuthToken` | Auth (mot de passe application — devs uniquement) |
| `/getNewAutomationToken` | Génération clé `auto_*` (depuis la page Mon compte) |
| `/setAnon2UserDefaults` | Types par job (verrou + restore) |
| `/anon2AsyncOfficeText` | Upload fichier |
| `/getAnon2Status` | Polling |
| `/receiveAnon2Text` | Download ANON, properties, report |
| `/reconcileAnon2Text` | Restore |
| `/deleteAnon2Job` | Cleanup dry_run |

### Point bloquant v2 — auth `automationToken` sur Anon2

**Problème :** le token web `v2.xxx` (via `GET /getToken`) expire en ~20 min à 4 h et n'est accessible que depuis le navigateur (`error_forbidden_source` en curl). Les utilisateurs Memberstack/Google OAuth (ex. Fabienne) n'ont pas de mot de passe application pour `/getAuthToken`.

**Solution :** réutiliser le pattern **Automatisations Make/Zapier** déjà en prod :

| Composant | Existe déjà | Usage actuel |
|-----------|-------------|--------------|
| `POST /getNewAutomationToken` | Oui | Génère clé `auto_xxxxx` longue durée |
| Table `automation_auth` | Oui | Stocke `(username, automation_token)` |
| `AuthAutoTokenCheck.checkToken()` | Oui | Valide la clé |
| Endpoint consommateur | Oui | `/sendFromAutomation` (audio uniquement) |

**Travail backend demandé :** accepter `automationToken` en **alternative** à `token` sur les servlets Anon2 listés ci-dessus — même logique que `ApiSendFromAutomation.java`.

Priorité auth côté client (MCP + Skill) : `AUTOMATION_TOKEN` > `TOKEN` > `PASSWORD`.

**Améliorations backend souhaitables (non bloquantes) :**
- Options Anon2 **par job** sans muter les defaults du compte (au lieu du verrou MVP)
- `fileType=report` stable pour preview enrichi
- Support TXT en upload fichier (incohérence doc vs API aujourd'hui)
- Endpoint `getAnon2Usage` pour afficher les crédits

---

## 8. Fichiers importants du repo

```
MCP-Agiloshield/
├── src/index.ts              # Point d'entrée MCP, 11 tools
├── src/tools/secure-file-for-ai.ts   # Outil principal
├── src/tools/shared.ts       # Pipeline Anon2 partagé
├── src/api-client.ts         # Client API Agilotext
├── onboarding/index.html     # Wizard installation
├── scripts/integration-test.mjs
├── docs/GUIDE_NICOLAS_MCP.md # Ce guide
├── docs/ARCHITECTURE.md
├── docs/HDS_ET_DEPLOIEMENT.md
└── README.md
```

---

## 9. Questions fréquentes (Nicolas)

**Q : Le MCP stocke-t-il des documents chez Agilotext ?**
R : Comme le front actuel — upload temporaire pour traitement, puis download. Pas de nouveau stockage persistant introduit par le MCP.

**Q : Pourquoi Node et pas Java ?**
R : Le SDK MCP officiel est TypeScript. Java pourrait exposer MCP plus tard, mais ce client fin est plus rapide à itérer.

**Q : Ça remplace le front Webflow ?**
R : Non. C'est un **canal d'accès supplémentaire** pour les utilisateurs IA (Cursor/Claude).

**Q : Marvin a Claude Cowork, nous ?**
R : Nous avons MCP standard = compatible Claude Code + Cursor + Claude Desktop. Plus large, moins de lock-in.

**Q : Pourquoi pas le token web dans le skill Claude ?**
R : Le token `v2.xxx` issu de `GET /getToken` expire et est réservé au navigateur. Le skill et le MCP tournent hors navigateur — il faut une clé `auto_*` longue durée (pattern Make) ou un mot de passe application.

---

## 10. Extension auth automation — spec backend pour Nicolas

### Contexte

Marvin Systems distribue un `.skill` Claude avec un token API longue durée généré depuis leur lab après login. Agilotext a **déjà** l'équivalent pour Make/Zapier (page Mon compte → Automatisations → « Générer ma clé »). Il suffit d'étendre ce mécanisme aux endpoints Anon2.

```
[Utilisateur connecté sur agiloshield.com]
        │
        │  Clic « Générer ma clé Claude »
        ▼
[POST /getNewAutomationToken]  ← token session web en entrée
        │
        │  auto_e22a49ee... (longue durée, révocable)
        ▼
[Skill .skill téléchargé]  ou  [MCP .env]
        │
        │  username + automationToken (pas token v2)
        ▼
[Endpoints Anon2]  ← AuthAutoTokenCheck (à brancher)
```

### Servlets Java à modifier

Réutiliser `com.sqlephant.ws.servlet.auto.from.AuthAutoTokenCheck` — déjà utilisé par `ApiSendFromAutomation`.

Pour chaque servlet Anon2, ajouter une branche auth :

```java
// Pseudo-code — pattern identique à ApiSendFromAutomation
String token = req.getParameter("token");
String automationToken = req.getParameter("automationToken");

boolean tokenOk = false;
if (automationToken != null && !automationToken.isBlank()) {
    try (Connection c = new ConnectionUtil().getConnection()) {
        tokenOk = AuthAutoTokenCheck.checkToken(username, automationToken, c);
    }
} else {
    tokenOk = new TokenUtil().isTokenValid(username, token, edition);
}
```

**Endpoints concernés :**

| Endpoint | Servlet |
|----------|---------|
| `/anon2AsyncOfficeText` | `ApiAnonAsyncOfficeText` |
| `/getAnon2Status` | `ApiGetAnon2Status` (ou équivalent) |
| `/receiveAnon2Text` | `ApiReceiveAnon2Text` |
| `/setAnon2UserDefaults` | servlet defaults Anon2 |
| `/getAnon2UserDefaults` | servlet defaults Anon2 |
| `/deleteAnon2Job` | `ApiDeleteAnon2Job` |

Optionnel mais recommandé : `/getAnon2JobsInfo`, `/receiveAnon2Zip`, `/reconcileAnon2Text`.

### Paramètres API (identiques à Make)

| Paramètre | Type | Description |
|-----------|------|-------------|
| `username` | text | Email du compte Agilotext |
| `automationToken` | text | Clé `auto_*` (alternative à `token`) |
| `edition` | text | `free`, `pro`, `ent` |

Exemple curl (upload Anon2 — après extension backend) :

```bash
curl -X POST "https://api.agilotext.com/api/v1/anon2AsyncOfficeText" \
  -H "Content-Type: multipart/form-data" \
  -F "username=fabienne@exemple.fr" \
  -F "automationToken=auto_xxxxxxxx" \
  -F "edition=ent" \
  -F "fileUpload=@bilan.docx"
```

### UX frontend suggérée (agiloshield.com)

Section à ajouter dans Mon compte → Intégrations (à côté de Make/Zapier) :

```
Intégration Claude / Skill Agiloshield
─────────────────────────────────────
Générez votre clé d'intégration pour pseudonymiser
vos documents directement depuis Claude Desktop.

[Générer ma clé]   [Télécharger mon skill .skill]
```

Flux :
1. Utilisateur connecté Memberstack (Google OAuth OK)
2. Clic « Générer ma clé » → appel interne `/getNewAutomationToken`
3. Affichage clé `auto_*` + bouton téléchargement `.skill` préconfiguré
4. Upload dans Claude Desktop → prêt

Révocation : « Régénérer ma clé » (comme Make) — supprime l'ancienne entrée `automation_auth`.

### Côté client déjà préparé (Florian)

| Fichier | Changement |
|---------|------------|
| `Agiloshield-Skill/agiloshield-skill/scripts/config.py` | Champ `AUTOMATION_TOKEN` |
| `Agiloshield-Skill/build.py` | Argument `--automation-token` |
| `Agiloshield-Skill/agiloshield-skill/scripts/agiloshield.py` | Envoie `automationToken` si configuré |

Commande de génération skill :

```bash
python3 build.py \
  --user fabienne.hanras@eurallia.fr \
  --automation-token "auto_xxxxxxxx" \
  --profile ma
```

### Démo Fabienne (3–4 juin 2026)

| Scénario | Prérequis | Statut |
|----------|-----------|--------|
| **Plan A** — Skill Claude live | Backend accepte `automationToken` sur Anon2 | Dépend Nicolas |
| **Plan B** — Webapp + fichier pré-pseudonymisé | Rien (déjà OK) | Prêt |
| **Plan C** — Mot de passe app + `/getAuthToken` | Compte avec mot de passe Agilotext | OK pour devs |

---

Support technique : Florian · Backend Anon2 : Nicolas
