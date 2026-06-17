# Patch WordBoost — ligatures (pour Nicolas)

**Contexte :** `ToWordNoSpecialCharsConverter.sanitize()` rejette `œ` car NFD ne décompose pas les ligatures → `ON_ERROR` sur tout le boost, email d'exception, utilisateur bloqué.

**Exemple :** `Sœurs` → IllegalArgumentException → job 118 ON_ERROR pour bauerwebpro@gmail.com (17/06/2026).

## Fichiers à patcher en prod

### 1. `ToWordNoSpecialCharsConverter.java`

Après le `trim()`, avant NFD :

```java
cleaned = cleaned
    .replace("œ", "oe").replace("Œ", "Oe")
    .replace("æ", "ae").replace("Æ", "Ae")
    .replace("ß", "ss")
    .replace("\uFB01", "fi").replace("\uFB02", "fl")
    .replace("\uFB00", "ff");
```

Patch déjà appliqué dans ce repo : `AgiloTextApi-github-2.0.5/.../ToWordNoSpecialCharsConverter.java`

### 2. `ApiGetStatusWordBoost2.getUserErrorMessage()`

Message ON_ERROR plus explicite + extraction du terme fautif depuis `javaException` :

```java
if (wordBoostStatus == WordBoostStatus.ON_ERROR) {
    errorMessage = "Un terme de votre liste contient un caractère non supporté.";
    Matcher m = Pattern.compile("got \"([^\"]+)\"").matcher(javaException);
    if (m.find()) {
        errorMessage += " Terme concerné : « " + m.group(1) + " ».";
    }
}
```

### 3. `FutureSetWordBoost2.java`

Stocker `throwable.getMessage()` pour les `IllegalArgumentException` (plus lisible que `toString()`).

## Front-end

Déployé côté Webflow : `scripts/pages/profile/wordboost2.js` r14 — normalise les ligatures avant envoi API.

## Scripts admin Agilotext

`scripts/shared/wordboost-sanitize.mjs` — utilisé par les scripts deploy client (ex. GODF).
