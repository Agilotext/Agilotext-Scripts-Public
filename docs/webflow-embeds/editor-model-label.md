# Éditeur : picker CR compact (staging)

Surface : HtmlEmbeds `code-redo-modele-compte-rendu` (modeles) et `Code-Redo_summary` (relance). Pin jsDelivr `@SHA` dans le `code` de l’embed. Ne pas coller le JS.

**Branche :** `fix/editor-model-label-staging` depuis le blob live `637a1ae4` (pas `origin/1.11` : relance + modeles + `agilo-cr-history.js` diffèrent).

**Publish :** `agilotext-test` only. www inchangé.

## SHA

| Rôle | SHA |
|------|-----|
| Live avant (rollback creds / history / modeles / relance www) | `637a1ae4637e0644bc91cc5713af9984d683d000` |
| Relance staging (vide CR) | `9ed906227e6e94f32ccb49994367d9fc749c3471` |
| Picker CR + Revenir (`Code-modeles-compte-rendu.js`) | `33aee578d4d39293b7ea8ef717336dd2846645e5` |
| Historique CR POST A/B (`agilo-cr-history.js`) | `c81c7ddc51c7361bc5f8d3ab2f0092c0231e60c8` |
| Palier GET history | `ff454aa015708e28e72fd0da538c69c9df30d696` |
| Palier précédent history (POST, layout Revenir) | `33aee578d4d39293b7ea8ef717336dd2846645e5` |
| Palier précédent modeles + relance (vide CR) | `9ed906227e6e94f32ccb49994367d9fc749c3471` |

## Pages

Site `6815bee5a9c0b57da18354fb`.

| Édition | pageId | Path |
|---------|--------|------|
| Business | `68e0f3b838626e418962aeff` | `/app/business/editor` |
| Pro | `68ed41f20988e833cb4e3148` | `/app/premium/editor` |
| Free | `68ed64995fcf3e0b0b452916` | `/app/free/editor` |

Composants partagés (1 écriture, 3 instances : Business + Pro + Free) :

- `Code-Redo_summary` `086fb264-cc10-e6df-a42f-e8c803b7855e` : creds `@637a1ae4`, relance `@9ed90622`, history `@c81c7ddc`
- `Code-Redo-modele-compte-rendu` `04149a5d-6e7f-6c56-0bb7-aa8c58b5979a` : modeles `@33aee578`

## Snapshot rollback (HtmlEmbed `code`)

Ordre à conserver : creds, relance, history. Modeles dans l’autre embed.

```html
<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@637a1ae4637e0644bc91cc5713af9984d683d000/scripts/pages/editor/agilo-editor-creds.js?v=1.07"></script>
<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@637a1ae4637e0644bc91cc5713af9984d683d000/scripts/pages/editor/relance-compte-rendu.js?v=637a1ae4"></script>
<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@637a1ae4637e0644bc91cc5713af9984d683d000/scripts/pages/editor/agilo-cr-history.js?v=637a1ae4"></script>
```

```html
<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@637a1ae4637e0644bc91cc5713af9984d683d000/scripts/pages/editor/Code-modeles-compte-rendu.js?v=637a1ae4"></script>
```

Pin Designer (14 sept. 2026, A/B POST live) : history `@c81c7ddc51c7361bc5f8d3ab2f0092c0231e60c8`. Modeles `@33aee578`. Relance `@9ed90622`. Creds `@637a1ae4`. HTML live `agilotext-test` encore `@ff454aa0` tant que Designer n’a pas compilé (Data API `sites_publish` 202 sans `lastPublished` ; Designer déconnecté).

## Recette

A/B : history **POST** urlencoded comme live `637a1ae4`. Picker inchangé. www inchangé.

1. Job live avec Revenir : [www 1000040851](https://www.agilotext.com/app/business/editor?jobId=1000040851&edition=ent&tab=summary) (`@637a1ae4`).
2. **Même origin staging** Harriet Pro `1000040315` : `POST` et `GET listSummaryVersions` = `Failed to fetch`. `GET getTranscriptStatus` = 200 `status: OK`. Horloge sans `is-on`. Le GET n’était pas la cause.
3. Job `1000040491` / `1000040851` Business staging : 403 Harriet. Recette Florian compte Business.

www : 0 occurrence de `c81c7ddc`, `ff454aa0`, `33aee578`.

## Rollback

Recoller les `code` snapshot ci-dessus (tout `@637a1ae4`) ou le palier `88660345` / `70af415d`. Re-publish staging only.
