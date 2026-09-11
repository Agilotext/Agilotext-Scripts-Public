# Pipeline admin STANDARD library2

Staging / Bauer / compte admin API. Pas www. Pas Astrid. Pas `create_prompt` Maestro (ça crée un USER privé).

Script : [`tools/library2-standard/pipeline.py`](../../tools/library2-standard/pipeline.py)

## Auth

Le rôle utile est **administrateur API** (liste serveur), pas Super Admin Memberstack.

```bash
export AGILOTEXT_USERNAME='…'
export AGILOTEXT_TOKEN='…'   # jamais coller le hash dans un chat
export AGILOTEXT_EDITION=ent
python3 tools/library2-standard/pipeline.py check-admin
```

Ou `--env-file` (KEY=value). Le script ne log jamais le token.

`check-admin` appelle `listPromptLibraryAudit`. 403 `ADMIN_REQUIRED` = Nico whitelist. Il ne crée **pas** de STANDARD.

Recette 11 sept 2026, compte Bauer : audit HTTP 200, `member-access.admin=true`. Le rôle API est bon. Create hidden non lancé (pas de STANDARD fantôme).

## Pipeline

1. `create --manifest tools/library2-standard/example-manifest.json` → ID &lt; -1, `visible=false`
2. Recette sur le compte admin (invisible Cursor / Bauer client)
3. `publish --id -N --i-reviewed --reason "…"` seulement après relecture

Promote d’un USER déjà bon :

```bash
python3 tools/library2-standard/pipeline.py promote --user-id 736 --manifest tools/library2-standard/example-manifest.json
```

HTML : `${CONTENT}` minimum, ou le fichier USER via `receivePromptModelTemplate`. Sans HTML, le CR est plus pauvre que 0–7.

## Interdit

- UI admin dans la biblio Webflow client
- `targetUsername`
- Publish sans `--i-reviewed`
- `create_prompt` MCP
