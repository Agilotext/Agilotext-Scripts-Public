# Tour onboarding Driver.js (`agilo-tour.js`)

**Branche :** `feat/agilo-tour-anonymiser`  
**Staging seulement :** `https://agilotext-test.webflow.io`  
**Prod www :** ne pas pin sans OK Florian.

Le guide vit dans le composant Webflow **`ONBOARDING_SCRIPT`** (19 instances, classe `code-agilo-tour`). Le CSS Driver.js est **`ONBOARDING_CSS`** (`css-guide`) : ne pas le modifier.

## Versions

| Version | SHA | Storage | Rôle |
|---|---|---|---|
| v1.0.0 / v23 | `7d5a786be2bc943f2d01de1fe9bc6afa114a4535` | `agilo_tour_state_v23` | Archive figée : [`archive/agilo-tour-v23-1.0.0.js`](../../scripts/pages/tour/archive/agilo-tour-v23-1.0.0.js) |
| v2.0.0 / v24 | `8ce2423bc0074fdfc4d9df9190e22ca9f8247a58` | `agilo_tour_state_v24` | Premier livrable, 8 étapes + stop, copy par seau |
| v2.0.1 / v24 | `8f0449eeadbff0c98b4f58dc606cdb76585413de` | `agilo_tour_state_v24` | Stop C’est bon = dernière étape Driver du 1er passage |
| v2.1.0 / v25 | (SHA après push) | `agilo_tour_state_v25` | Cibles visibles éditeur, 2 étapes library, Support = 2e stop, Agiloshield optionnel |

Rollback v2.1 : SHA `8f0449ee`. Archive v23 : `7d5a786b`.

## Inventaire `/auth/setup` (staging, 2026-09-15)

Radios réelles (collectivité **n’est pas** une persona) :

- **persona :** Dirigeant / Fondateur, Manager / Responsable d’équipe, Profession libérale / Indépendant, Professionnel(le) de santé, Salarié / Employé, Étudiant, Autre
- **use_case :** Rendez-vous clients, Réunions d’équipe / projets, Rendez-vous juridiques, Appels de vente, Entretiens, Consultations médicales / psychologiques, Support / Service client, Autre
- **meeting_tool :** Zoom, Google Meet, Microsoft Teams, Téléphone, Autre
- **meeting_volume :** Moins de 5, Entre 5 et 10, Entre 10 et 30, Plus de 30 (non utilisé par le tour)

Champ Memberstack `meeting-tool` : écrit par le setup (`MS_FIELDS.tool`). Absent du DOM dashboard (`#ms-persona` / `#ms-use_case` seulement). Le tour injecte `#ms-meeting-tool` dans `.wrapper-id-profil` et lit aussi `$memberstackDom.getCurrentMember()`. Pas d’Admin, pas de `sk_`.

## Seaux de copy (même parcours)

| Seau | Mapping |
|---|---|
| `default` | champs vides, `skipped`, Autre, libéral, santé, étudiant, ventes |
| `public` | use-case juridique, ou texte CSE / collectivité / élus / institution |
| `dirigeant` | persona Dirigeant / Fondateur |
| `equipe` | salarié, manager, réunions d’équipe |

`meeting_tool` ne change **que** la phrase Enregistrer (Zoom / Meet / Teams / téléphone / visio).

## Séquence

**A. 8 étapes** dashboard : welcome, record, file (`#panel-file`), options, prompt-picker, wb-picker, submit (`#submit-button`), stop (C’est bon / Continuer).

**B. Suite** si le hook est là : Mes fichiers, partage (`.agilo-row-share`), éditeur (onglets, `#agilo-audio-wrap`, `.ed-actions`, save sur onglet Transcription), `/library` (onglets + créer), Support (2e stop). Agiloshield (`#agfDropzone`) seulement si Continuer, hors Free. Max 19. Skip si absent ou non highlightable.

## Embed (après push)

Pin **HtmlEmbed du composant `ONBOARDING_SCRIPT`**, pas un 2e script. `ONBOARDING_CSS` inchangé. Publish subdomain `agilotext-test` only.

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@SHA/scripts/pages/tour/agilo-tour.js?v=SHA8"></script>
```

Recette console : `window.__AGILO_TOUR_VERSION__ === '2.1.0'`

Sans le navigateur Cursor : `python3 tests/agilo-tour-v2-recette-server.py` puis Chrome headless sur `http://127.0.0.1:8765/app/premium/dashboard`. Résultat dans `/tmp/agilo-tour-v2-recette.json`.
