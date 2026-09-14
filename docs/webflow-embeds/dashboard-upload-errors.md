# Dashboard upload v2 — erreurs audio vide / invalide

Fix UX : bandeau `#form_error` « Audio non exploitable » à la place de l’alert serveur et du texte Webflow « connexion internet ».

**Branche :** `fix/upload-audio-empty-ux` (depuis `origin/1.11`). `free_v2.js` part du blob live `@50cc2c16`. Ne pas pousser sur `1.09`.

**SHA pin staging :** `1f708d82445ef0d1ea4d7f65a9006d7d0881edcb`

**Version JS :** `1.10.0` (`window.__agiloUploadErrorVersion`)

## Pins live avant ce fix (rollback)

| Page | ID | v2 | Autres (ne pas toucher) |
|------|----|----|-------------------------|
| Business `6815bee5a9c0b57da183557c` | `upload_ent_v2` `@5b661b9` | maestro `@987cf1ad`, loader `@5b661b9` |
| Pro `6815bee5a9c0b57da183550e` | `pro_v2` `@2c2a315314c0bad8be1b1374a793ca9ce5a518a8` | maestro `@987cf1ad` |
| Free `6815bee5a9c0b57da183550c` | `free_v2` `@50cc2c16e97efcf12db5e9f9a88ab4582737df50` | maestro `@987cf1ad`, speakers + pretty `@50cc2c16` |

Registered `agiloapierrorfmt110` @`3fad75c2` : **ne pas appliquer**.

### Snippets footer à restaurer (sans classifier)

Business :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@5b661b9/scripts/pages/dashboard/Ent/upload_ent_v2.js"></script>
```

Pro :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@2c2a315314c0bad8be1b1374a793ca9ce5a518a8/scripts/pages/dashboard/pro_v2.js"></script>
```

Free :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@50cc2c16e97efcf12db5e9f9a88ab4582737df50/scripts/pages/dashboard/free_v2.js"></script>
```

Retirer aussi la ligne `agilo-api-error-format.js` ajoutée. Re-publish **agilotext-test** seulement.

## Pin après push

SHA : `1f708d82445ef0d1ea4d7f65a9006d7d0881edcb` (branch `fix/upload-audio-empty-ux`)

Ordre footer (shared **avant** le v2) :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@<SHA>/scripts/shared/agilo-api-error-format.js?v=1.10.0"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@<SHA>/scripts/pages/dashboard/Ent/upload_ent_v2.js?v=1.10.0"></script>
```

Même shared + `pro_v2.js` / `free_v2.js` sur leurs pages. `AGILO_SCRIPTS_BASE`, loaders, maestro inchangés.

## Vérif console (staging, après login)

```javascript
window.__agiloUploadErrorVersion === '1.10.0'
typeof window.agiloMapUploadErrorResponse === 'function'
```

## Tests auto

```bash
node scripts/shared/agilo-api-error-format.test.mjs
```

## Recette manuelle

1. Fichier vide / 0 octet → « Audio non exploitable », pas d’alert, pas de `/home/admin`
2. Business : `#form_error_audio_format` caché pour ce cas
3. `Could not get duration…` → même bandeau
4. Poll `ON_ERROR` + `javaException` `error_invalid_audio_file_content` → même bandeau
5. Offline / timeout inchangés

Dictée live : hors scope (loaders restent aux SHA live).

## Publish

`sites_publish` : `publishToWebflowSubdomain: true`, `customDomains: []`. Pas www.
