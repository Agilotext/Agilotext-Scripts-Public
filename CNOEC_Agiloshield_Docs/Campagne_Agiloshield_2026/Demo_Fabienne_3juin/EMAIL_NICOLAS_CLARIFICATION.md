# Email Nicolas — clarification (1er juin 2026)

**Objet :** Re: Fabienne — clarification + ce qu'il te faut faire (15 min)

---

Nicolas,

Je reprends après nos échanges — je pense qu'on s'est mal compris. Voici la version claire.

---

**Ce que c'est (le fond)**

Fabienne HANRAS utilise déjà Agiloshield. Elle veut **pseudonymiser ses bilans M&A** avant de les analyser dans Claude.

Claude Co-work = **le conteneur** (skill Python qui appelle Anon2). L'objectif produit = **anonymisation**, pas « faire du Co-work ».

Elle présente **seule** devant sa direction Eurallia (3–4 juin). **On ne fait pas de démo pour elle.** Mon job : que le skill **marche chez moi**, puis lui envoyer le `.skill` + un mode d'emploi. Ensuite c'est Claude qui fait le boulot.

---

**Pourquoi ça vaut le coup (pas « une démo qu'on ne maîtrise pas »)**

- Client **réel**, réseau **16 cabinets M&A** — pas un test isolé
- Le dev skill + auth headless sert **Fabienne + tous les prochains** (Cursor, Co-work, scripts)
- Que sa réunion se passe bien ou non, **le travail backend reste utile**

---

**Le blocage technique (unique)**

Hors navigateur autorisé → `GET /getToken` renvoie **`error_forbidden_source`**.

Le skill appelle l'API en Python (comme mon MCP). Il lui faut une auth qui marche headless.

---

**Ce que j'attends de toi — une option suffit**

**Option A (recommandée, ~15 min, même chemin que mon MCP)**
1. Essai Agiloshield Classic sur `f.hanras@eurallia.fr`
2. Mot de passe application → `POST /getAuthToken`
3. Me confirmer la valeur `edition` Anon2 pour Classic (`ent` ou `agiloshield`)
4. M'envoyer le secret en privé → je teste, je build le `.skill`, j'envoie à Fabienne

**Option B (si tu préfères getToken)**
- Ouvrir `GET /getToken` headless pour skill / Co-work / Cursor
- Avec la sécurité que tu juges correcte (on en parle si besoin)

**Dis-moi A ou B.** Je m'adapte côté skill.

---

**Ce que je ne te demande pas**
- Participer à une démo le 3 juin
- Livrer `auto_*` sur Anon2 cette semaine (juin, §10 du guide)
- Whitelist IP Claude / CORS en urgence

---

Dès ton OK, je valide de mon côté et Fabienne reçoit le package. Merci.

Florian
