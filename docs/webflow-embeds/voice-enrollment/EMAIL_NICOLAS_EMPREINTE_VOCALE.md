# Email — Handoff Nicolas empreinte vocale (v3 — juin 2026)

**Destinataire :** nicolas.de.pomereu@agilotext.com  
**Objet :** Empreinte vocale invité — page Webflow + 4 correctifs backend

---

Bonjour Nicolas,

Florian déploie la page invité sur **Webflow** (`/auth/voice-invite`) avec le même design que Mon compte. L'API submit reste identique ; on change seulement l'URL email et un redirect pour les liens déjà envoyés.

Guide complet : [`GUIDE_NICOLAS_VOICE_INVITE_URL.md`](GUIDE_NICOLAS_VOICE_INVITE_URL.md)

---

**P0 — BLOQUANT : `submitSpeakerVoiceInvite`**

Compte inviteur Business (`bauerwebpro@gmail.com`, edition `ent`) :
- `createSpeakerVoiceInvite` OK
- `getSpeakerVoices` OK
- Submit avec token `sv_47c6d920983e4a3985088afa2d1e7850` + WAV 16s → « La création d'empreinte vocale n'est pas disponible pour ce compte. »

Peux-tu aligner le contrôle d'édition du submit sur create/getSpeakerVoices ? (edition BDD invite : `business` vs `ent` ?)

---

**P1 — URL Brevo (5 min)**

Remplacer :
`https://api.agilotext.com/api/v1/speakerVoiceInvite?inviteToken={{token}}`

Par :
`https://www.agilotext.com/auth/voice-invite?inviteToken={{token}}&recipientName={{recipientNameEncoded}}&invitedBy={{inviterEmailEncoded}}`

Staging : `https://agilotext-test.webflow.io/auth/voice-invite?...`

---

**P1 — Redirect legacy (15 min)**

`GET api.agilotext.com/.../speakerVoiceInvite?inviteToken=X` → **302** vers Webflow avec les mêmes query params.

---

**P2 — CORS `getSpeakerVoiceInvites`**

Mêmes headers que `getSpeakerVoices` (`Access-Control-Allow-Origin: *`) — fetch bloqué depuis `www.agilotext.com` aujourd'hui.

---

**Rappels précédents (toujours d'actualité)**

1. Micro page API invité — [`GUIDE_NICOLAS_MICRO_PAGE_INVITE.md`](GUIDE_NICOLAS_MICRO_PAGE_INVITE.md) (optionnel si Webflow remplace la page API)
2. Liste invites — [`GUIDE_NICOLAS_GET_SPEAKER_VOICE_INVITES.md`](GUIDE_NICOLAS_GET_SPEAKER_VOICE_INVITES.md)
3. Bug `createSpeakerVoiceInvite` parfois `error_speaker_voice_invite_not_found` alors que l'email part

**Inchangé :** champs submit `inviteToken`, `fullName`, `voiceFile`.

Merci,  
Florian
