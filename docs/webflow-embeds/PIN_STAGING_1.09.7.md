# Pin staging 1.09.7 / anon 3.2.1 / chat V05.2

Après merge de `fix/demo-grand-est-1.09.7` dans `origin/1.09`. **Pas de publish www sans OK Florian.**

## Embeds Designer (éditeur Free / Pro / Business)

Les pins confidence + chat + anon sont dans les embeds canvas (`code-main-editor`, `code-chat_CSS&JS`, `Code-Anon_transcript&CR`), pas dans le custom code page (head/footer).

Chat live = `chat-loader.js` → V05 (pas V06). Anon CR = export only (`?v=3.2.1`). Confidence inchangé (`?v=1.09.7`).

Embed page Business `code-cr-history-maquette` : vidé le 01/09/2026. Free / Premium n’avaient pas cet embed.

Pages :

- `/app/free/editor` (`68ed64995fcf3e0b0b452916`)
- `/app/premium/editor` (`68ed41f20988e833cb4e3148`)
- `/app/business/editor` (`68e0f3b838626e418962aeff`)

Snippets : [`editor-1.09-bugs-fix.md`](editor-1.09-bugs-fix.md)

## Dashboard Free (speakers)

Le footer live charge `free_v2.js` depuis le SHA Maestro `2c2a315…` (1.10), pas `@1.09`.

Ne pas remplacer ce SHA par `@1.09` : ça casserait Maestro.

Après cherry-pick speakers vers la branche dashboard live (1.10 / 1.11), ajouter `?v=1.09.7` sur **ce** `free_v2.js`.

## Purge jsDelivr

```
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/pages/editor/confidence-v1/agilo-confidence.css.js
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/pages/editor/confidence-v1/agilo-confidence.js
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/pages/editor/confidence-v1/Code-main-editor-IFRAME_V04-confidence.js
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/CNOEC_Agiloshield_Docs/Front_END/agilo-editor-anonymiser-transcript-v3.js
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/pages/editor/chat-loader.js
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/pages/editor/Code-chat_V05.js
```

## Rollback

Staging précédent : `@56c20f30` (`?v=1.09.7` / `v05.1` / `3.2.0`). www : ne pas republier.
