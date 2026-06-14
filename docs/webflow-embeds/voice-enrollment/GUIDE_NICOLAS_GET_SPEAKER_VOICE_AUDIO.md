# Guide Nicolas — Lire l'audio d'une empreinte vocale

**Date :** 14 juin 2026  
**Contexte :** Mon compte Agilotext (`/app/*/profile`) — liste des empreintes vocales  
**Front :** [`scripts/pages/settings/voice-enrollment-settings.js`](../../scripts/pages/settings/voice-enrollment-settings.js)

---

## Besoin produit

L'admin du compte voit la liste des voix enregistrées (`getSpeakerVoices`) mais **ne peut pas réécouter** l'extrait audio source. Demande retour test (14/06) : bouton **« Écouter l'audio »** par voix.

`getSpeakerVoices` ne renvoie aujourd'hui que des métadonnées (`voiceId`, `speakerLabel`, `firstName`, `lastName`, `dtUpdate`, …) — pas de blob ni d'URL.

---

## Endpoint demandé

### `POST /api/v1/getSpeakerVoiceAudio`

**Auth :** identique aux autres endpoints voix (`username`, `token`, `edition` en `application/x-www-form-urlencoded`).

**Paramètres :**

| Name | Type | Value |
|------|------|-------|
| username | text | Email utilisateur |
| token | text | Token auth |
| edition | text | `free`, `pro`, `ent` |
| voiceId | text | ID technique de la voix |

**Réponse recommandée (option A — binaire) :**

- `Content-Type: audio/mpeg` (ou `audio/wav`)
- Corps : flux binaire du fichier d'enrollment stocké côté serveur

**Réponse alternative (option B — JSON) :**

```json
{
  "status": "OK",
  "mimeType": "audio/mpeg",
  "audioBase64": "..."
}
```

**Erreurs :**

| Code | Quand |
|------|-------|
| `error_invalid_speaker_voice_id` | voiceId manquant ou invalide |
| `error_speaker_voice_not_found` | Voix absente ou autre compte |
| `error_voice_file_not_found` | Fichier source introuvable en stockage |

**Sécurité :** l'audio ne doit être accessible qu'au propriétaire du compte (même règles que `deleteSpeakerVoice`).

---

## Côté front (déjà branché)

Le script appelle `POST /getSpeakerVoiceAudio` au clic sur « Écouter l'audio » :

- Si réponse `audio/*` → lecture via `URL.createObjectURL`
- Si JSON `audioBase64` → décodage puis lecture
- Si **404** → message « Lecture indisponible — mise à jour API en cours »

---

## Recette

1. Compte Pro avec ≥1 voix enregistrée → Mon compte → clic « Écouter l'audio » → lecture OK
2. `voiceId` invalide → erreur API claire
3. Voix d'un autre compte → refus auth
