# AgiloShield V2 — Instructions pour Nicolas : Pseudonymisation & Règles particulières (Inclusions / Exclusions)

**Cible :** `AgiloshieldV2StagingServlet.java` sur `kawansoft02` (branche recette `codex/agiloshield-v2-staging-bridge-2026-09-28`).
**Statut Python :** Le moteur Python V2 sur `127.0.0.1:8091` gère déjà **100 %** de la pseudonymisation (`TagBag`, `anon.properties`) et des listes d'inclusion/exclusion (`apply_anon2_lists_to_spans`). Il n'y a aucun algorithme à recoder côté Java.

Voici les **3 ajustements simples** à effectuer dans la servlet Java :

---

### 1. Annonce des capacités dans `GET /preferences`

Dans la méthode qui répond à `GET /api/agiloshield-v2/preferences`, inclure dans le JSON de réponse l'objet `capabilities` suivant :

```json
{
  "protectionPolicy": { ... },
  "accountRef": "...",
  "capabilities": {
    "workerCodeSha": "6498642a2702cbe5",
    "listDirectives": true,
    "processingModes": ["ANONYMIZE", "PSEUDONYMIZE"],
    "pseudonymKeyDownload": true,
    "uploadIdempotency": false
  }
}
```

*Effet :* Déverrouille instantanément dans l'interface le bouton radio **« Pseudonymiser »** et le bouton **« Règles particulières »** (inclusions / exclusions).

---

### 2. Relais des options dans `POST /jobs` (Multipart)

Dans le traitement de l'upload `POST /api/agiloshield-v2/jobs` :
Extraire les 3 champs texte envoyés par le front et les transmettre dans le multipart ou les options envoyées au worker Python `:8091` :

```java
String processingMode = request.getParameter("processingMode"); // "ANONYMIZE" ou "PSEUDONYMIZE"
String inclusionJson = request.getParameter("anon2InclusionList"); // Tableau JSON ex: ["terme1", "terme2"]
String exclusionJson = request.getParameter("anon2ExclusionList"); // Tableau JSON ex: ["terme3"]

// Transmettre à Python dans le formulaire multipart :
// - "doPseudoAnon" -> "true" si processingMode.equals("PSEUDONYMIZE") sinon "false"
// - "anon2InclusionList" -> inclusionJson (si présent)
// - "anon2ExclusionList" -> exclusionJson (si présent)
// - "processingMode" -> processingMode
```

*Effet :* Python applique les inclusions/exclusions dès la détection, et si `doPseudoAnon=true`, remplace les entités par `PER_A`, `ORG_A` et génère le fichier `anon.properties`.

---

### 3. Nouvelle route `GET /api/agiloshield-v2/jobs/{id}/pseudonym-key`

Ajouter l'endpoint de récupération de la clé de correspondance :

1. Valider l'authentification et l'appartenance du job au compte utilisateur (comme pour `/result` ou `/download`).
2. Récupérer le fichier `anon.properties` généré par Python pour ce job (soit via `GET http://127.0.0.1:8091/api/v1/jobs/{id}/pseudonym-key`, soit directement dans le dossier d'exécution du job sous Tomcat).
3. Renvoyer le flux avec les en-têtes HTTP suivants :
   - `Content-Type: text/plain; charset=utf-8`
   - `Content-Disposition: attachment; filename="cle-pseudonymes-{id}.properties"`
   - `X-Agiloshield-Processing-Mode: PSEUDONYMIZE`
   - `X-Agiloshield-Revision: {revision}`
   - `X-Agiloshield-Status: {status}`
   - `X-Agiloshield-Policy-Digest: {policyDigest}`
   - `X-Agiloshield-Assurance: technical-ready`

---

### Résumé des vérifications après modification

1. `GET /api/agiloshield-v2/preferences` renvoie `listDirectives: true` et `processingModes: ["ANONYMIZE", "PSEUDONYMIZE"]`.
2. Déposer un fichier en mode `PSEUDONYMIZE` : le résultat contient des étiquettes type `PER_A` au lieu de pavés noirs.
3. Télécharger la clé via `/jobs/{id}/pseudonym-key` : le fichier `cle-pseudonymes-...properties` contient bien la table de correspondance `PER_A=Jean Dupont`.
