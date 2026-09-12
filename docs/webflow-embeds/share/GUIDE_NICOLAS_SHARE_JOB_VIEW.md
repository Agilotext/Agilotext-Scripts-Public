# Guide Nicolas — Page Webflow `/share` + API lecture publique

**Date :** 10 septembre 2026  
**Contexte :** la servlet HTML `GET /api/d8478fa34a*` (Share URL click) est illisible. Florian déploie une page Webflow lecture seule, comme `/auth/voice-invite`.  
**Front :** [`scripts/pages/share/share-view-invite.js`](../../../scripts/pages/share/share-view-invite.js)  
**Helper token :** [`scripts/shared/agilo-share-url.js`](../../../scripts/shared/agilo-share-url.js)  
**Référence playbook :** [`../voice-enrollment/GUIDE_NICOLAS_VOICE_INVITE_URL.md`](../voice-enrollment/GUIDE_NICOLAS_VOICE_INVITE_URL.md)

**Hors scope :** refonte de `share_url_download_step1.html`. Florian remplace la vue lecture. **Garder** le suffixe `-download` (export zip) inchangé.

**Contournement front (déjà codé) :** la page Webflow tente `GET …/api/d8478fa34a…-download`, dézippe, affiche transcript + CR. Ça marche **sans compte** dès que ce servlet envoie `Access-Control-Allow-Origin: *` (comme `/api/v1/*`). Aujourd’hui le zip se télécharge, mais `fetch` depuis `agilotext-test.webflow.io` est bloqué CORS. Une ligne d’en-tête CORS sur `ApiGetSharerUrlClick2` débloque la lecture sans attendre `getSharedJobView`.

---

## Résumé

| Priorité | Sujet | Effort estimé |
|----------|-------|----------------|
| **P0** | Redirect lecture (sans `-download`) → Webflow | ~30 min |
| **P0** | `GET /api/v1/getSharedJobView` JSON public | ~0,5–1 j |
| **P1** | CORS + `Accept: application/json` | ~10 min |
| **P2** | `revokeSharedUrl` + expiration à la création | plus tard |

---

## P0a — Redirect legacy (comme voice-invite)

Aujourd’hui :

```
GET https://api.agilotext.com/api/d8478fa34a{uuid}
```

sert du HTML (`ApiGetSharerUrlClick1`).

**Demande :** si l’URL **ne** se termine **pas** par `-download`, répondre **302** vers :

```
https://www.agilotext.com/auth/share?token=d8478fa34a{uuid}
```

Staging (si Host / paramètre d’env `SHARE_PAGE_ORIGIN`) :

```
https://agilotext-test.webflow.io/auth/share?token=d8478fa34a{uuid}
```

**Inchangé :**

```
GET https://api.agilotext.com/api/d8478fa34a{uuid}-download
```

reste l’export zip (`ApiGetSharerUrlClick2`). Le bouton Export éditeur continue d’utiliser `-download`.

Le `token` query = le segment d’URL après `/api/` (préfixe `d8478fa34a` inclus). La lookup `shared_url.the_url` reste la full URL stockée.

---

## P0b — `GET /api/v1/getSharedJobView`

Lecture **sans** `username` / `token` utilisateur. Auth = possession du `shareToken`.

**Endpoint**

```
GET https://api.agilotext.com/api/v1/getSharedJobView?shareToken=d8478fa34a594b71f6e5ec42e9a83b290928f78c46
```

POST urlencoded accepté aussi (`shareToken`).

**Réponse OK**

```json
{
  "status": "OK",
  "jobTitle": "Entretien d’admission",
  "filename": "admission.mp3",
  "sharedByName": "Karine",
  "expiresAt": "2026-10-10T12:00:00Z",
  "audioAvailable": true,
  "audioUrl": "https://api.agilotext.com/api/v1/getSharedAudio?shareToken=d8478fa34a…",
  "transcriptHtml": "<p>…</p>",
  "summaryHtml": "<h2>Compte rendu</h2>…",
  "sharedDocumentType": "cr",
  "summaryTabLabel": "",
  "pageKicker": "Partage",
  "segments": [
    { "speaker": "Intervenant 1", "start": 0, "text": "…" }
  ]
}
```

**Champs optionnels (libellés page)**

| Champ | Exemple | Effet front |
|-------|---------|-------------|
| `sharedDocumentType` | `transcript`, `cr`, `pv`, `pv_cse`, `note` | Onglet document + bouton copier (défaut : déduit du contenu) |
| `summaryTabLabel` | `Procès-verbal CSE` | Surcharge le libellé onglet / copier |
| `pageKicker` | `Partage` | Petit titre au-dessus du H1 (défaut script : `Partage`) |

`sharedByName` : prénom / email masqué du owner (`job.username`), jamais le token.

`audioUrl` : URL **signée ou tokenisée** (pas d’auth Memberstack). Si le fichier audio est déjà purgé (30 j Business) : `audioAvailable: false`, `audioUrl` vide, **ne pas** échouer : transcript + CR restent.

`segments` : optionnel si `transcriptHtml` suffit.

**Erreurs** (`status: "KO"`)

| errorMessage | Quand |
|--------------|--------|
| `error_share_not_found` | token inconnu dans `shared_url` |
| `error_share_expired` | hors rétention édition (doc actuelle : durée = rétention fichiers) |
| `error_share_revoked` | révocation (P2) |
| `error_share_not_ready` | job pas `READY_SUMMARY_READY` |

**CORS :** `Access-Control-Allow-Origin` pour `https://www.agilotext.com` et `https://agilotext-test.webflow.io` (même politique que `getSpeakerVoices` si déjà `*`).

**Headers :** honorer `Accept: application/json`.

**Sécurité :**

- Pas d’indexation : la page Webflow est `noindex`. Ne pas ajouter d’Open Graph avec le contenu du CR.
- Rate limit raisonnable (ex. 60 req / min / IP).
- Ne pas exposer `username` owner en clair si ce n’est pas nécessaire ; `sharedByName` suffit.

---

## P0c — Audio invité (si `audioUrl` n’est pas un fichier public)

Si le blob audio ne peut pas être une URL servlet existante, ajouter :

```
GET /api/v1/getSharedAudio?shareToken=…
```

`Content-Type: audio/mpeg` (ou wav). Même auth token que `getSharedJobView`. 404 si fichier purgé (la page Flo gère déjà ce cas).

---

## P2 (pas bloquant)

- `POST /api/v1/revokeSharedUrl` (username + token + jobId) : invalide la ligne `shared_url` ou flag `revoked`.
- Expiration configurable à `getSharedUrl` (7 / 30 jours). Aujourd’hui = rétention édition.

---

## Recette Nicolas

1. `getSharedUrl` sur un job `READY_SUMMARY_READY` → URL API
2. GET URL **sans** `-download` → 302 vers `/auth/share?token=…`
3. GET `/getSharedJobView?shareToken=…` → JSON transcript + CR
4. GET URL **avec** `-download` → zip, pas de redirect
5. Token inventé → `error_share_not_found`
6. Job audio purgé → JSON OK, `audioAvailable: false`

---

## Front déjà prêt

Dès que `getSharedJobView` répond 200 JSON, la page `/share` s’affiche sans autre ticket Flo. En 404, la page affiche « Page en cours de mise à jour ».
