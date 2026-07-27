# Audit WordBoost ON_ERROR — 2026-07-27

## Contexte

Démo client (Florian) : Sauvegarder une liste avec le terme `oiuytr` → pastille **Erreur** + mail robot Agilotext.

## Email (extrait)

```
username=florian.bauer@agilotext.com, boostid=146
java.lang.IllegalArgumentException: Invalid to-word: only A-Z, a-z, 0-9, apostrophe (') and hyphen (-) allowed – got "[oiuytr]"
at ToWordNoSpecialCharsConverter.sanitize
at CustomSpellingInserter.insertWords
at FutureSetWordBoost2.storeVariantsInSql / executeInThread
```

## Preuves front

| Élément | Constat |
|---------|---------|
| Page live (HTML export) | Embed inline **r13 (2026-01-07)**, pas le CDN r14 |
| Payload source (`wordboost2.js`) | `wordBoost: JSON.stringify({ wordBoost: listSent })` → `{"wordBoost":["oiuytr"]}` |
| `oiuytr` | ASCII valide ; `WORD_RE` accepte |
| Crochets dans `got "[oiuytr]"` | Match exact de `List.of("oiuytr").toString()` en Java |

## Repro MCP / API (tentative)

- MCP `list_wordboosts` / script local : `error_invalid_token` (token `.env` MCP expiré, `getToken` 403).
- Repro isolée à refaire dès token frais : `setWordBoost2` avec `{"wordBoost":["oiuytr"]}` puis `getStatusWordBoost2`.

## Checklist Network (Florian)

1. Filtrer `setWordBoost2`, `getStatusWordBoost2`, `getWordBoost2`.
2. Sauvegarder `oiuytr` (thème neuf de préférence).
3. Confirmer body sans crochets autour du mot.
4. Noter `ON_ERROR` + `userErrorMessage`.

## Actions livrées (repo)

- **r14.1** : sanitize au load, re-sanitize avant save, unwrap `[…]`, toast dédié si `got "[...]"`.
- Docs Webflow + brouillon mail Nicolas.
- Embed CDN pin SHA après push (ne pas laisser r13 + CDN).

## Verdict

- Pas un « mauvais mot » utilisateur.
- Probable **bug / parse backend** si payload Network propre.
- Déploiement Webflow r13 obsolète = UX dégradée (messages), pas la cause des crochets dans `sanitize`.
