# Guide Nicolas — Page invite Webflow + correctifs backend

**Date :** 22 juin 2026  
**Contexte :** Florian déploie `/auth/voice-invite` sur Webflow (design profil). L'API reste la même ; seuls l'URL email et le redirect changent.

---

## Résumé pour Nicolas

| Priorité | Sujet | Effort estimé |
|----------|-------|---------------|
| **P0** | Fix `submitSpeakerVoiceInvite` — edition compte inviteur | Debug backend |
| **P1** | Redirect legacy `speakerVoiceInvite` → Webflow | ~15 min |
| **P1** | URL template Brevo | ~5 min |
| **P2** | CORS `getSpeakerVoiceInvites` | ~10 min |
| **P3** | JSON submit + validation token | Nice-to-have |

---

## P0 — Bug submit (BLOQUANT)

**Statut juin 2026 :** confirmé en prod — la page Webflow affiche « réf. invitation vocale » ; le message backend brut est « pas disponible pour ce compte ». Voir aussi [`DEBUG_VOICE_INVITE_CONSOLE.md`](DEBUG_VOICE_INVITE_CONSOLE.md).

**Reproduction :**

- Compte inviteur : `bauerwebpro@gmail.com` (Business, edition `ent`)
- Token : `sv_47c6d920983e4a3985088afa2d1e7850`
- `createSpeakerVoiceInvite` OK · `GET speakerVoiceInvite` OK · `getSpeakerVoices` OK
- Submit avec WAV 16s → **KO**

**Ask :** le contrôle d'édition au submit doit être aligné avec `createSpeakerVoiceInvite` et `getSpeakerVoices`. Vérifier l'edition stockée sur l'invite / le owner en BDD (`business` vs `ent`).

---

## P1 — URL Brevo (prod)

Remplacer l'URL actuelle :

```
https://api.agilotext.com/api/v1/speakerVoiceInvite?inviteToken={{token}}
```

Par :

```
https://www.agilotext.com/auth/voice-invite?inviteToken={{token}}&recipientName={{recipientNameEncoded}}&invitedBy={{inviterEmailEncoded}}
```

Staging :

```
https://agilotext-test.webflow.io/auth/voice-invite?inviteToken={{token}}&recipientName={{recipientNameEncoded}}&invitedBy={{inviterEmailEncoded}}
```

**Contrat submit inchangé :** `inviteToken`, `fullName`, `voiceFile` → `POST /submitSpeakerVoiceInvite`

---

## P1 — Redirect legacy (emails déjà envoyés)

```
GET https://api.agilotext.com/api/v1/speakerVoiceInvite?inviteToken=sv_XXX
```

→ **302** vers :

```
https://www.agilotext.com/auth/voice-invite?inviteToken=sv_XXX&recipientName=... 
```

(conserver `recipientName` si disponible côté invite)

---

## P2 — CORS `getSpeakerVoiceInvites`

Le front Mon compte appelle `getSpeakerVoiceInvites` en fetch depuis `www.agilotext.com`.

Actuellement : pas de `Access-Control-Allow-Origin` (contrairement à `getSpeakerVoices`).

Ajouter les mêmes headers CORS que sur `getSpeakerVoices` :

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept
```

---

## P3 — Nice-to-have

1. **`getSpeakerVoiceInviteByToken?inviteToken=`** → JSON `{ status, recipientName, inviteStatus }` (completed / expired)
2. **Réponse submit JSON** en plus du HTML : `{ "status": "OK" }` / `{ "status": "KO", "error": "..." }`

Note : `submitSpeakerVoiceInvite` a déjà CORS `*` — le front Webflow peut fetch + parser le HTML.

---

## Ce qui ne change pas

- `createSpeakerVoiceInvite` (Mon compte)
- Champs multipart submit
- Speechmatics / durée 15–45 s
- Acceptation webm/mp4 (micro)

---

## Contact

Florian — page Webflow + script `voice-enrollment-invite.js` côté repo Scripts-Public.
