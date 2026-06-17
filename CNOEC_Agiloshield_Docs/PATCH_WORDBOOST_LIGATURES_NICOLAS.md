# Proposition patch WordBoost — ligatures (pour Nicolas, non appliqué)

**Statut :** PROPOSITION UNIQUEMENT — le backend Java n'a **pas** été modifié par Florian. Nicolas gère le déploiement API.

**Contournement actuel côté Agilotext :** le front Webflow (`wordboost2.js` r14) et les scripts admin (`wordboost-sanitize.mjs`) normalisent les ligatures **avant** l'appel API — compatible avec le code Java actuel de Nicolas.

---

## Contexte

`ToWordNoSpecialCharsConverter.sanitize()` rejette `œ` car NFD ne décompose pas les ligatures → `ON_ERROR` sur tout le boost.

**Exemple :** `Sœurs` → IllegalArgumentException → job 118 ON_ERROR (17/06/2026).

**Fix côté scripts (déjà en place) :** `Sœurs` → `Soeurs` avant `setWordBoost2` → passe le backend tel quel.

---

## Proposition optionnelle backend (si Nicolas le souhaite)

### `ToWordNoSpecialCharsConverter.java`

Après le `trim()`, avant NFD :

```java
cleaned = cleaned
    .replace("œ", "oe").replace("Œ", "Oe")
    .replace("æ", "ae").replace("Æ", "Ae")
    .replace("ß", "ss")
    .replace("\uFB01", "fi").replace("\uFB02", "fl")
    .replace("\uFB00", "ff");
```

### `ApiGetStatusWordBoost2.getUserErrorMessage()`

Message ON_ERROR plus explicite + extraction du terme fautif.

### `FutureSetWordBoost2.java`

Stocker `throwable.getMessage()` pour les `IllegalArgumentException`.

---

## Côté Agilotext (sans toucher au backend)

| Fichier | Rôle |
|---------|------|
| `scripts/shared/wordboost-sanitize.mjs` | Normalisation Node (scripts deploy client) |
| `scripts/pages/profile/wordboost2.js` r14 | Normalisation front Webflow avant sauvegarde |
