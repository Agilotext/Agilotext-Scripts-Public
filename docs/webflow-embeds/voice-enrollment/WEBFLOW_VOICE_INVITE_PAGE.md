# Webflow — Page invitation empreinte vocale (`/auth/voice-invite`)

**voice23** — page publique pour les invités (sans compte Agilotext).

---

## Checklist Webflow (Florian)

- [ ] Créer la page slug **`voice-invite`** sous le dossier **`/auth/`**
- [ ] **Page publique** — pas de gate Memberstack (comme `/auth/join-team`)
- [ ] **SEO** : Settings → `noindex, nofollow`
- [ ] Dupliquer le layout d'une page auth existante (ex. `/auth/join-team`) : logo centré, fond clair, max-width ~720px
- [ ] Coller l'embed depuis [`voice-invite-page.html`](voice-invite-page.html) dans un bloc Embed (w-embed)
- [ ] Publier staging puis prod

---

## URL attendue (Brevo / redirect Nico)

```
https://www.agilotext.com/auth/voice-invite?inviteToken=sv_...&recipientName=Marie+Dupont&invitedBy=admin@entreprise.com
```

| Param | Obligatoire | Rôle |
|-------|-------------|------|
| `inviteToken` | oui | Autorisation backend (`sv_...`) |
| `recipientName` | non | Préremplit Prénom & Nom |
| `invitedBy` | non | Message « X vous invite… » |

---

## Embed (pin SHA après push)

```html
<div id="agilo-voice-invite"></div>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@8612019/scripts/pages/auth/voice-enrollment-invite.js?v=1.09-voice23"></script>
```

Voir [`voice-invite-page.html`](voice-invite-page.html) pour le SHA courant.

**Où coller :** Embed HTML dans la zone contenu principale (pas dans un composant Memberstack).

---

## Design

- Même UX que « Ajouter une voix » sur Mon compte Business (hero bleu, timer 15–45 s, drop zone, bouton `.button.save`)
- Le script injecte tout le UI dans `#agilo-voice-invite`
- Optionnel côté Webflow : H1 « Empreinte vocale » au-dessus de l'embed

---

## Staging

```
https://agilotext-test.webflow.io/auth/voice-invite?inviteToken=sv_47c6d920983e4a3985088afa2d1e7850&recipientName=Florian+Bauer&invitedBy=bauerwebpro@gmail.com
```

---

## Recette

1. Token absent → « Lien incomplet »
2. UI micro + import fichier
3. Submit → erreur edition **tant que Nico n'a pas fixé P0** (comportement attendu juin 2026)
4. Après fix Nico → succès inline (hero vert)
5. Mobile Safari — micro
6. Side-by-side avec profil Business « Ajouter une voix »

---

## Bloquant backend

Voir [`GUIDE_NICOLAS_VOICE_INVITE_URL.md`](GUIDE_NICOLAS_VOICE_INVITE_URL.md) — `submitSpeakerVoiceInvite` refuse certaines invites Business.

---

## Purge CDN (après deploy script)

```
curl "https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@8612019/scripts/pages/auth/voice-enrollment-invite.js"
```
