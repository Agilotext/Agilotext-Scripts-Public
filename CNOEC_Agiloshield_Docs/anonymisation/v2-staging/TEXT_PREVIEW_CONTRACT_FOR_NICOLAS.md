# Aperçu texte automatique V2 — contrat demandé, non disponible à ce jour

Le script Anon2 appelait `/anonText` après une pause de 1 seconde et interprétait des marqueurs textuels. Le worker V2 actuel crée au contraire un job durable pour chaque TXT. **Ne pas brancher le contrôleur candidat sur Anon2, ni simuler un aperçu par création puis suppression de jobs.** L’Embed publié continue à créer un job TXT sur clic.

La candidate front contient `agiloshield-v2-text-preview.js`, isolé derrière deux conditions : `TEXT_PREVIEW_READY:true` dans un futur Embed **et** `/preferences.capabilities.textPreview` avec `enabled:true`, `ephemeral:true`, `schemaVersion:1`, `processingModes:["ANONYMIZE"]` et un entier `maxChars >= 10`. Le réglage Webflow seul ne lance aucun appel. Pseudonymiser reste sur le parcours TXT durable, afin de ne pas produire une clé de restitution sans contrat.

Route Java demandée, à confirmer et qualifier avant activation : `POST /api/agiloshield-v2/text/preview`, authentification Agilotext existante, tenant dérivé côté Java. Le navigateur envoie une requête JSON sans secret serveur :

```json
{
  "schemaVersion": 1,
  "requestId": "UUID généré côté navigateur",
  "text": "Texte saisi",
  "processingMode": "ANONYMIZE",
  "protectionPolicy": {"schemaVersion": 1, "selectedTypes": [], "sensitiveKeepAcknowledged": true},
  "anon2InclusionList": [],
  "anon2ExclusionList": []
}
```

Réponse attendue, sans HTML libre ni données personnelles supplémentaires :

```json
{
  "requestId": "même UUID",
  "policyDigest": "SHA-256 canonique appliqué",
  "listDigest": "SHA-256 canonique appliqué",
  "status": "READY",
  "assurance": "EPHEMERAL_PREVIEW",
  "qa": {"passed": true},
  "fragments": [
    {"kind": "plain", "text": "Bonjour "},
    {"kind": "masked", "text": "[PER]", "code": "PER"}
  ]
}
```

`status` peut aussi être `REVIEW_REQUIRED` ou `FAILED`, avec une QA explicite. `READY` ici n’est **pas** un artefact certifié ou téléchargeable : l’interface affiche « Aperçu temporaire · non certifié ». Les fragments affichés proviennent de Python et sont rendus par `textContent`. Java doit documenter le chemin de traitement réellement éphémère, limites et coût, rétention/logging, cache désactivé, erreurs et isolation entre tenants. Le front attend 1 seconde après la frappe et au moins 10 caractères ; une nouvelle saisie annule ou invalide l’ancienne réponse. Une modification du mode, de la politique ou des listes efface l’aperçu. Aucun texte d’aperçu n’est placé en stockage navigateur.

Avant d’activer : prouver l’absence de job et d’historique, les digests appliqués y compris `selectedTypes:[]`, l’isolation de deux comptes, les réponses hors ordre, la QA et la disponibilité sous frappes répétées ; tester ensuite la page Webflow authentifiée. Livrer l’activation dans un commit et un pin CDN distincts du seul correctif visuel.
