# Email Nicolas — 1er juin 2026 (envoyé)

**À :** nicolas.de.pomereu@agilotext.com  
**Objet :** Fabienne / Claude Co-work ce soir — ton avis sur l'auth (getToken vs getAuthToken ?)

---

Nicolas,

Fabienne HANRAS (Eurallia, séminaire **mercredi**) veut pseudonymiser ses bilans dans **Claude Co-work**. On lui a promis un retour **ce soir**.

On prépare un **skill** (comme Marvin) : Python qui appelle Anon2. J'ai besoin de ton avis backend — quelques questions simples :

---

**1. getToken vs getAuthToken pour le skill ?**

Sur le web (scripts 1.09), on fait `GET /getToken` puis Anon2.

Hors navigateur (curl, skill Python), getToken renvoie `error_forbidden_source`.

Est-ce que pour le skill Co-work, tu recommandes :
- **A)** mot de passe app + `POST /getAuthToken` (comme mon MCP Cursor) ?
- **B)** ouvrir `GET /getToken` headless (sans navigateur) ?
- **C)** autre chose ?

Si **B** : tu peux le faire ce soir ? Avec quelle sécurité (pas juste username seul, j'imagine) ?

---

**2. Ce soir — tu peux activer pour f.hanras@eurallia.fr ?**

- Essai Agiloshield Classic (1 mois)
- Mot de passe app pour getAuthToken (si tu confirmes l'option A)
- Quelle valeur **`edition`** pour Anon2 sur un abonné Classic : `ent` ou `agiloshield` ?

---

**3. auto_* sur Anon2 — priorité juin ?**

Pattern Make/Zapier déjà en prod. Spec dans le guide joint (§10).

C'est le bon fix long terme pour éviter getAuthToken / mot de passe app ?

---

**4. Côté API — something à ouvrir pour Claude ?**

Le skill appelle `api.agilotext.com` en Python (pas navigateur). Faut-il whitelist IP / CORS / autre, ou getAuthToken suffit tel quel ?

---

Dis-moi ce que tu peux faire **ce soir** vs **plus tard** — je pars le skill dès ton OK.

Merci,
Florian

PJ : GUIDE_NICOLAS_MCP.md
