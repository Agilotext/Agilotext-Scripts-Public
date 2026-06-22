# Debug console — page invite voix (`/auth/voice-invite`)

## Erreur « réf. invitation vocale » après submit

**Ce n'est pas l'audio ni Webflow.** Le backend refuse le submit (`submitSpeakerVoiceInvite`) alors que l'invite a été créée. Bug P0 Nicolas — voir [`GUIDE_NICOLAS_VOICE_INVITE_URL.md`](GUIDE_NICOLAS_VOICE_INVITE_URL.md).

Le script logue en console :
```
[agilo-voice-invite] backend edition check failed — known P0 submitSpeakerVoiceInvite
```

---

## Script A — diagnostic rapide

Coller sur `/auth/voice-invite` (après une erreur) :

```javascript
(async function agiloInviteDebugQuick() {
  const API = 'https://api.agilotext.com/api/v1';
  const token = new URLSearchParams(location.search).get('inviteToken');
  console.group('[agilo-invite-debug]');
  console.log('URL', location.href);
  console.log('Token', token);
  console.log('Erreur UI', document.querySelector('.agilo-voice-status')?.textContent);
  if (!token) { console.warn('Pas de inviteToken'); console.groupEnd(); return; }

  const fd = new FormData();
  fd.append('inviteToken', token);
  fd.append('fullName', document.querySelector('#agilo-voice-display-name')?.value || 'Debug Test');
  const r = await fetch(API + '/submitSpeakerVoiceInvite', { method: 'POST', body: fd });
  const html = await r.text();
  const h1 = html.match(/<h1>([^<]+)/)?.[1];
  const p = html.match(/<p>([^<]+)/)?.[1];
  console.log('Submit sans audio →', { http: r.status, h1, p });
  console.groupEnd();
})();
```

Si `p` contient « pas disponible pour ce compte » → bug backend confirmé.

---

## Script B — submit avec enregistrement en cours

```javascript
(async function agiloInviteDebugWithBlob() {
  const API = 'https://api.agilotext.com/api/v1';
  const token = new URLSearchParams(location.search).get('inviteToken');
  const preview = document.querySelector('#agilo-voice-preview');
  const name = document.querySelector('#agilo-voice-display-name')?.value?.trim();
  if (!preview?.src) return console.error('Pas de preview audio — enregistre d\'abord');
  const blob = await fetch(preview.src).then(r => r.blob());
  const fd = new FormData();
  fd.append('inviteToken', token);
  fd.append('fullName', name || 'Debug Test');
  fd.append('voiceFile', blob, 'voice-enrollment.webm');
  const r = await fetch(API + '/submitSpeakerVoiceInvite', { method: 'POST', body: fd });
  const html = await r.text();
  console.log('[agilo-invite-debug] submit réel', {
    http: r.status,
    title: html.match(/<h1>([^<]+)/)?.[1],
    message: html.match(/<p>([^<]+)/)?.[1]
  });
})();
```

---

## Script C — compte inviteur (Mon compte Business)

Sur `/app/business/profile`, onglet Profil :

```javascript
(async function agiloInviteOwnerDebug() {
  const API = 'https://api.agilotext.com/api/v1';
  function normEdition(v) {
    v = String(v || '').toLowerCase().trim();
    if (['business','enterprise','entreprise','biz'].includes(v)) return 'ent';
    if (['premium','pro'].includes(v)) return 'pro';
    return v || 'free';
  }
  const ms = window.$memberstackDom;
  const m = ms ? await ms.getCurrentMember() : null;
  const email = (m?.data?.auth?.email || localStorage.getItem('agilo:username') || '').toLowerCase();
  const edition = normEdition(localStorage.getItem('agilo:edition') || 'business');
  const token = typeof window.getToken === 'function'
    ? await window.getToken(email, edition)
    : (await fetch(API + '/getToken?username=' + encodeURIComponent(email) + '&edition=' + edition).then(r => r.json())).token;
  async function post(endpoint) {
    const body = new URLSearchParams({ username: email, token, edition });
    const r = await fetch(API + '/' + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: body.toString()
    });
    return { http: r.status, data: await r.json().catch(() => ({})) };
  }
  console.log('getSpeakerVoices', await post('getSpeakerVoices'));
})();
```

Si `getSpeakerVoices` OK et submit invite KO → incohérence backend à signaler à Nico avec token `sv_47c6d920983e4a3985088afa2d1e7850`.
