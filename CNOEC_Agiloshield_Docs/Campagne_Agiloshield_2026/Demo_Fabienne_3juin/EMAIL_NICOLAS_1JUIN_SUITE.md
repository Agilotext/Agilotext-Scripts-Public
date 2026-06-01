# Email Nicolas — suite (1er juin 2026, envoyé)

**Fil :** réponse au mail getToken vs getAuthToken  
**Objet :** Re: Fabienne / Claude Co-work ce soir — ton avis sur l'auth (getToken vs getAuthToken ?)

---

Nicolas,

Complément sur le mail d'avant — pour que tu voies pourquoi je te sollicite même si la démo n'est pas 100 % maîtrisée.

---

**Pourquoi ça vaut le coup (côté produit, pas juste « une démo »)**

1. **Fabienne = porte d'entrée réseau M&A**, pas un compte isolé  
   Eurallia Finance, 16 cabinets, CNCEF/CNCFA. Elle présente **mercredi devant ses associés**. C'est exactement le segment où **Marvin vient de sortir son skill Claude Co-work** — si on n'a pas l'équivalent, on perd la comparaison sur le terrain.

2. **Elle a demandé Claude Co-work / MCP**, pas seulement la webapp  
   On peut tenir une démo avec webapp + fichiers pré-pseudonymisés (Plan B prêt). Mais ce qu'elle veut montrer à ses associés, c'est : *« je reste dans Claude, mes bilans sont pseudonymisés avant analyse »*. C'est le use case qu'on veut industrialiser.

3. **Ce qu'on te demande ce soir = déjà en prod pour Cursor/MCP**  
   Essai + mot de passe app + getAuthToken. Pas d'ouverture getToken headless, pas de CORS, pas de whitelist IP Claude. **15–30 min max** pour valider le même chemin auth que mon MCP — et débloquer le skill pour Fabienne + tous les prochains utilisateurs Claude.

4. **On ne parie pas sur une démo fragile**  
   - Plan A : skill Co-work (si tu confirmes l'auth)  
   - Plan B : webapp live + kit fichiers (déjà prêt)  
   Donc le risque « démo foireuse » est couvert. Ton intervention sert surtout à **tester le parcours qu'on veut vendre en juin**, pas à sauver une réunion à tout prix.

5. **Retour utile pour toi aussi**  
   - Quelle auth recommandes-tu pour tout headless (skill, scripts, Make) : getAuthToken, auto_*, autre ?  
   - Quelle `edition` Anon2 pour Classic ?  
   → Une réponse claire ce soir = on arrête de bricoler côté skill et on aligne le guide §10.

---

**En résumé** : ce n'est pas « faire un hack pour une démo qu'on ne maîtrise pas », c'est **valider le parcours Claude sur un vrai cas M&A**, avec un plan B si ça coince, et **15 min backend** sur un flux que tu connais déjà.

Les 4 questions du mail précédent restent ouvertes — surtout la 1 (getToken vs getAuthToken) et la 2 (compte Fabienne ce soir).

Merci,
Florian
