# Email — Handoff Nicolas empreinte vocale

**Destinataire :** nicolas.de.pomereu@agilotext.com  
**Objet :** Empreinte vocale — 3 points backend (micro invité, liste invites, bug invite)

---

Bonjour Nicolas,

On avance sur l'empreinte vocale côté front (Mon compte Pro/Business). Trois sujets backend pour aligner l'expérience invité et l'historique des invitations :

**1) MICRO SUR LA PAGE INVITÉ**

Page : https://api.agilotext.com/api/v1/speakerVoiceInvite?inviteToken=sv_...

Aujourd'hui upload fichier uniquement. On a le même pattern micro que Webflow (onboarding + Mon compte) : MediaRecorder → injecte le blob dans le champ `voiceFile` existant via DataTransfer, submit inchangé (POST `submitSpeakerVoiceInvite`).

Guide + snippet prêt à coller :
https://github.com/Agilotext/Agilotext-Scripts-Public/blob/1.09/docs/webflow-embeds/voice-enrollment/GUIDE_NICOLAS_MICRO_PAGE_INVITE.md

Prérequis : accepter webm/mp4 sur `submitSpeakerVoiceInvite` (comme `enrollSpeakerVoice`).

**2) LISTE DES INVITATIONS (API)**

Le front appelle déjà `getSpeakerVoiceInvites` avec fallback localStorage si 404.

Spec :
https://github.com/Agilotext/Agilotext-Scripts-Public/blob/1.09/docs/webflow-embeds/voice-enrollment/GUIDE_NICOLAS_GET_SPEAKER_VOICE_INVITES.md

Question : une invitation `pending` compte-t-elle dans `maxVoices` ? (On affiche voix + pending / max côté front.)

**3) BUG createSpeakerVoiceInvite**

Parfois `error_speaker_voice_invite_not_found` alors que l'email Brevo part. Peux-tu vérifier la persistance invite vs envoi mail ?

Merci,
Florian
