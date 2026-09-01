# Pin staging 1.09.7 / anon 3.2 / chat V05.1

Après merge de `fix/demo-grand-est-1.09.7` dans `origin/1.09`. **Pas de publish www sans OK Florian.**

## Embeds Designer (éditeur Free / Pro / Business)

Les pins confidence + chat + anon sont dans les embeds canvas (`code-main-editor`, `code-chat`, embed après `relance-compte-rendu`), pas dans le custom code page (head/footer).

Remplacer `?v=1.09.6` → `?v=1.09.7`, `?v=3.1.0` → `?v=3.2.0`, et bust chat `?v=v05.1`.

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

Retirer les `?v=` / revenir à `1.09.6` et `3.1.0`.
