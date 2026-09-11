# Email — Handoff Nicolas page `/auth/share` (lecture invitée)

**Destinataire :** nicolas.de.pomereu@agilotext.com  
**Objet :** Page lecture d’un transcript partagé (Webflow) : redirect + JSON, comme l’empreinte vocale  
**Statut envoi :** WAIT OK Florian (`OK envoi Nico partage page`)

Ne pas envoyer tant que Florian n’a pas collé cette phrase. **Pas de P1 duplicateJob dans ce mail** (autre sujet).

---

Bonjour Nicolas,

Petit sujet produit, même schéma que l’empreinte vocale. Je t’explique le besoin, ce que je fais côté page, et ce dont on a besoin côté API. Je n’ai rien touché au backend.

## Pourquoi

On a déjà `getSharedUrl`. Ça génère une URL du type :

https://api.agilotext.com/api/d8478fa34a{uuid}

Deux usages aujourd’hui :

1. **Export** : on ajoute `-download`, ça zippe. Ça reste. Le bouton Export de l’éditeur continue comme ça.
2. **Lecture** : l’URL sans `-download` ouvre ta page HTML servlet. Elle n’est plus au niveau produit (mobile, player, compte rendu, inscription). Les clients s’en servent peu, ou collent un Word.

Ce qu’on veut : quelqu’un **sans compte** Agilotext ouvre un lien, lit la transcription et le compte rendu, écoute l’audio s’il est encore là, peut copier / télécharger, **sans modifier** le job. Un peu le player Plaud / le lien Claude, mais pour un CR de réunion (santé, RH) : lecture seule, pas d’indexation.

Exemple : Karine (EHPAD) envoie le CR d’un entretien d’admission à un médecin extérieur qui n’a pas Agilotext. Il lit sur téléphone. S’il veut le même outil, bouton « Créer un compte gratuit » en bas.

Autre exemple, plus tard : copie **dans l’historique** d’un collègue qui a déjà un compte. Ça, c’est une autre API. Pas ce mail.

## Ce que je fais (front seulement)

Comme `/auth/voice-invite` :

- Page Webflow publique : **https://www.agilotext.com/auth/share?token=…**
- Dossier Auth, à côté de join-team et voice-invite
- `noindex`
- Script Flo : onglets Transcription / Compte rendu, lecteur audio, copier, télécharger, bandeau confidentiel, CTA inscription
- Je n’appelle **pas** tes servlets HTML. Le script fera un GET JSON (ci-dessous)

Staging : https://agilotext-test.webflow.io/auth/share?token=…

Maquette sans API : `?mock=1`

Je n’attends pas que tu codes pour poser la page. C’est pour gagner du temps, exactement comme voice-invite : moi la page, toi l’URL et le contrat.

## Ce dont on a besoin de toi (API)

### 1) Redirect des anciens liens (lecture seulement)

Aujourd’hui `GET /api/d8478fa34a{uuid}` (sans `-download`) sert du HTML.

Demande : **302** vers

https://www.agilotext.com/auth/share?token=d8478fa34a{uuid}

(staging si tu as un flag d’env : `https://agilotext-test.webflow.io/auth/share?token=…`)

**Ne pas** rediriger les URLs qui finissent par `-download`. L’export zip reste.

Le `token` dans l’URL Webflow = le segment après `/api/` (préfixe `d8478fa34a` inclus). Ta table `shared_url.the_url` ne change pas.

C’est le même geste que le redirect `speakerVoiceInvite` → `/auth/voice-invite`.

### 2) JSON public pour la page (nouveau, lecture)

La page a besoin des **données**, pas d’HTML.

Proposition de nom, tu fais comme tu veux si le nom te va mal :

`GET /api/v1/getSharedJobView?shareToken=d8478fa34a{uuid}`

Sans username / token utilisateur. Auth = possession du token de partage (comme aujourd’hui la servlet click).

Réponse souhaitée :

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
  "segments": []
}
```

- `sharedByName` : prénom ou libellé court, pas besoin de l’email en clair
- Audio déjà purgé (30 jours Business) : **quand même** renvoyer texte + CR, `audioAvailable: false`, `audioUrl` vide. Ne pas échouer le GET
- `segments` optionnel si `transcriptHtml` suffit
- CORS : `www.agilotext.com` et `agilotext-test.webflow.io` (comme getSpeakerVoices)
- `Accept: application/json`

Erreurs (`status: KO`) :

- `error_share_not_found`
- `error_share_expired`
- `error_share_revoked` (si tu l’as / plus tard)
- `error_share_not_ready` si le job n’est pas READY_SUMMARY_READY

Audio : si tu ne peux pas coller un fichier public dans `audioUrl`, un `GET /getSharedAudio?shareToken=…` en binaire audio, même auth token, convient. 404 si fichier absent.

### 3) Hors scope (volontairement)

- Ne pas refaire `share_url_download_step1.html`. La page Webflow remplace la vue lecture.
- Pas de re-prompt, chat, rename, droits d’édition pour l’invité
- Pas d’Open Graph avec le contenu du CR
- Révocation / expiration configurable : plus tard, pas bloquant

## Recette quand c’est prêt

1. `getSharedUrl` sur un job READY_SUMMARY_READY
2. GET l’URL **sans** `-download` → 302 vers `/auth/share?token=…`
3. GET `getSharedJobView` → JSON
4. GET **avec** `-download` → zip, pas de redirect
5. Token inventé → not_found
6. Audio purgé → JSON OK, audioAvailable false, CR visible

Dès que le JSON répond, la page Flo s’affiche toute seule. En 404 elle dit « page en cours de mise à jour ».

Si un nom d’endpoint ou un champ te va mal, dis-moi, on aligne. L’important c’est le contrat : token de partage → titre + transcript + CR + audio optionnel, sans login.

Merci,  
Florian
