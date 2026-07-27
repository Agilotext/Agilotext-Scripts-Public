# Brouillon mail — Nicolas (WordBoost ON_ERROR)

**Statut :** prêt à envoyer après que Florian ait collé le payload Network (ou confirmé).  
**Ne pas envoyer automatiquement.**

---

**Objet :** WordBoost ON_ERROR — to-word `"[oiuytr]"` boost 146

Bonjour Nicolas,

Lors d’une démo, la sauvegarde d’une liste Mots à surveiller (boost 146, terme `oiuytr`) est passée en `ON_ERROR` avec le mail robot suivant :

`Invalid to-word: only A-Z, a-z, 0-9, apostrophe (') and hyphen (-) allowed – got "[oiuytr]"`

Stack : `ToWordNoSpecialCharsConverter.sanitize` ← `CustomSpellingInserter.insertWords` ← `FutureSetWordBoost2.storeVariantsInSql` / `executeInThread`.

Côté front, l’envoi est :

`wordBoost={"wordBoost":["oiuytr"]}`

(`JSON.stringify({ wordBoost: ["oiuytr"] })` dans `wordboost2.js`)

`oiuytr` est ASCII pur. Si `sanitize` recevait vraiment `oiuytr`, le message serait `got "oiuytr"`. Or on a `got "[oiuytr]"`, ce qui correspond exactement à `List.toString()` en Java.

Hypothèse : quelque part dans `insertWords` / `storeVariantsInSql`, une `List` (ou équivalent) est passée en String à `sanitize` au lieu d’itérer chaque terme.

Peux-tu vérifier ces classes et me dire si tu reproduis avec le même payload ?

P1 bis (démo) : depuis `https://www.agilotext.com`, CORS bloque aussi `setWordBoostDefault2` et `setMailNotifyType` (pas d’`Access-Control-Allow-Origin`). Ça casse « Définir défaut » / prefs mail en console.

Merci,  
Florian

---

**Pièce jointe utile :** stack complète du mail robot du 27/07/2026 11:19.
