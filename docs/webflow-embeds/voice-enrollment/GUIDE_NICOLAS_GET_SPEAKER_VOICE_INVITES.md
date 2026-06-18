# Guide Nicolas — Lister les invitations empreinte vocale

**Date :** 13 juin 2026  
**Contexte :** Empreinte vocale Agilotext (`/app/*/voice`, legacy `/app/*/profile`) — section « Inviter par email »  
**Front :** [`scripts/pages/settings/voice-enrollment-settings.js`](../../scripts/pages/settings/voice-enrollment-settings.js)

---

## Besoin produit

Les utilisateurs Pro/Business envoient des invitations par email (`createSpeakerVoiceInvite`) pour que des collègues enregistrent leur voix sans compte Agilotext.

Aujourd'hui le front ne peut **pas** lister les invitations déjà envoyées. Un historique localStorage temporaire est en place côté Florian ; il faut un endpoint serveur pour :

- synchroniser multi-appareils ;
- afficher le **vrai statut** (pending / completed / expired) ;
- éviter les doublons d'invitation.

---

## Endpoint demandé

### `POST /api/v1/getSpeakerVoiceInvites`

**Auth :** identique aux autres endpoints voix (`username`, `token`, `edition` en `application/x-www-form-urlencoded`).

**Réponse attendue :**

```json
{
  "status": "OK",
  "invites": [
    {
      "inviteId": "sv_abc123",
      "recipientName": "Marie Dupont",
      "recipientEmail": "marie@entreprise.com",
      "status": "pending",
      "dtSent": "2026-06-13T08:30:00Z",
      "dtCompleted": null,
      "dtExpires": "2026-07-13T08:30:00Z"
    }
  ]
}
```

**Valeurs `status` :**

| Statut | Signification |
|--------|---------------|
| `pending` | Email envoyé, invité n'a pas encore soumis sa voix |
| `completed` | Voix enregistrée via `submitSpeakerVoiceInvite` |
| `expired` | Lien expiré, non utilisé |
| `cancelled` | Invitation annulée par l'émetteur |

**Tri :** du plus récent au plus ancien (`dtSent` desc).

---

## Questions ouvertes

1. **Quota `maxVoices`** : une invitation `pending` compte-t-elle dans le quota affiché par `getSpeakerVoices` ? Si oui, le front affichera `(voix enregistrées + invites pending) / maxVoices`.

2. **Bug connu** : parfois `createSpeakerVoiceInvite` renvoie `error_speaker_voice_invite_not_found` alors que l'email Brevo part. À corriger côté backend si possible.

3. **Endpoints optionnels (phase 2)** :
   - `POST cancelSpeakerVoiceInvite` — `inviteId` + auth
   - `POST resendSpeakerVoiceInvite` — `inviteId` + auth (ou réutiliser `createSpeakerVoiceInvite` avec dédup email)

---

## Intégration front (déjà préparée)

Le script appelle `getSpeakerVoiceInvites` au chargement. Si l'endpoint répond `404` ou erreur, **fallback localStorage** automatique.

Dès que l'endpoint est live, le front basculera sans changement Webflow supplémentaire.

---

## Recette suggérée

1. Compte Pro avec 0 voix → envoyer 2 invitations → `getSpeakerVoiceInvites` retourne 2 lignes `pending`.
2. Invité soumet sa voix → statut passe à `completed`.
3. Attendre expiration (ou forcer côté test) → statut `expired`.
4. Vérifier cohérence avec `getSpeakerVoices` après enregistrement invité.
