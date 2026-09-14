# Éditeur : picker CR compact (staging)

Surface : HtmlEmbeds `code-redo-modele-compte-rendu` (modeles) et `Code-Redo_summary` (relance). Pin jsDelivr `@SHA` dans le `code` de l’embed. Ne pas coller le JS.

**Branche :** `fix/editor-model-label-staging` depuis le blob live `637a1ae4` (pas `origin/1.11` : relance + modeles + `agilo-cr-history.js` diffèrent).

**Publish :** `agilotext-test` only. www inchangé.

## SHA

| Rôle | SHA |
|------|-----|
| Live avant (rollback creds / history / modeles / relance www) | `637a1ae4637e0644bc91cc5713af9984d683d000` |
| Relance staging (vide CR) | `9ed906227e6e94f32ccb49994367d9fc749c3471` |
| Picker CR (`Code-modeles-compte-rendu.js`) | `9ed906227e6e94f32ccb49994367d9fc749c3471` |
| Palier précédent modeles (recherche + `#creer`) | `88660345b2a7654ea75e564848e99f4cdce424be` |
| Palier précédent relance | `70af415d97053914795f3260ed201de243f9082f` |

## Pages

Site `6815bee5a9c0b57da18354fb`.

| Édition | pageId | Path |
|---------|--------|------|
| Business | `68e0f3b838626e418962aeff` | `/app/business/editor` |
| Pro | `68ed41f20988e833cb4e3148` | `/app/premium/editor` |
| Free | `68ed64995fcf3e0b0b452916` | `/app/free/editor` |

Composants partagés (1 écriture, 3 instances : Business + Pro + Free) :

- `Code-Redo_summary` `086fb264-cc10-e6df-a42f-e8c803b7855e` : creds + history `@637a1ae4`, relance `@9ed90622`
- `Code-Redo-modele-compte-rendu` `04149a5d-6e7f-6c56-0bb7-aa8c58b5979a` : modeles `@9ed90622`

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

Pin staging (14 sept. 2026) : modeles + relance `@9ed906227e6e94f32ccb49994367d9fc749c3471`. Creds + `agilo-cr-history.js` restent sur `637a1ae4`.

## Recette

Job **avec** CR : [staging Business](https://agilotext-test.webflow.io/app/business/editor?jobId=1000040491&edition=ent) (compte Florian).

- Onglet Compte rendu : picker toolbar icône + nom. Clic autre modèle = confirm remplacer + quota.

Job **sans** CR (autre que `1000040213`, crash langue serveur) :

- Vide : select (icône + nom du défaut) **à côté** de Générer, même nom sur le picker toolbar.
- Ouvrir le select, choisir un autre modèle : nom mis à jour, pas de confirm, pas de loader, quota inchangé.
- Générer : confirm `Modèle : …`, OK lance, quota toujours 4/4.
- www : 0 occurrence de `9ed90622`.

## Rollback

Recoller les `code` snapshot ci-dessus (tout `@637a1ae4`) ou le palier `88660345` / `70af415d`. Re-publish staging only.
