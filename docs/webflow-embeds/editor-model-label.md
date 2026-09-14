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
| Historique CR (`agilo-cr-history.js`) | `33aee578d4d39293b7ea8ef717336dd2846645e5` |
| Palier précédent modeles + relance (vide CR) | `9ed906227e6e94f32ccb49994367d9fc749c3471` |

## Pages

Site `6815bee5a9c0b57da18354fb`.

| Édition | pageId | Path |
|---------|--------|------|
| Business | `68e0f3b838626e418962aeff` | `/app/business/editor` |
| Pro | `68ed41f20988e833cb4e3148` | `/app/premium/editor` |
| Free | `68ed64995fcf3e0b0b452916` | `/app/free/editor` |

Composants partagés (1 écriture, 3 instances : Business + Pro + Free) :

- `Code-Redo_summary` `086fb264-cc10-e6df-a42f-e8c803b7855e` : creds `@637a1ae4`, relance `@9ed90622`, history `@33aee578`
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

Pin staging (14 sept. 2026) : modeles + history `@33aee578d4d39293b7ea8ef717336dd2846645e5`. Relance `@9ed90622`. Creds `@637a1ae4`.

## Recette

Job **avec** versions (celui où www montre déjà `Revenir · HH:mm`, pas `1000040491` si 1er CR, pas `1000040213`) :

- Onglet Compte rendu : picker + Régénérer + **`Revenir · HH:mm` + horloge**.
- Horloge : liste des versions, footer « Gratuit, ça ne consomme pas de relance ». Restore : quota inchangé.

Job **avec** CR sans versions : [staging Business](https://agilotext-test.webflow.io/app/business/editor?jobId=1000040491&edition=ent) : picker, **pas** de Revenir.

Job **sans** CR (autre que `1000040213`) : select + Générer, pas de Revenir.

www : 0 occurrence de `33aee578`.

## Rollback

Recoller les `code` snapshot ci-dessus (tout `@637a1ae4`) ou le palier `88660345` / `70af415d`. Re-publish staging only.
