# Email — Handoff Nicolas duplicateJobToUser (P1 JCQ)

**Destinataire :** nicolas.de.pomereu@agilotext.com  
**Objet :** Dupliquer un job vers un autre siège (historique collègue)  
**Statut envoi :** WAIT OK Florian (`OK envoi Nico partage JCQ`)

Ne pas envoyer tant que Florian n’a pas collé cette phrase. Ne pas promettre de date à Karine.

---

Bonjour Nicolas,

Besoin EHPAD (sièges Business isolés) : envoyer un compte rendu **dans l’espace** d’un collègue qui a déjà un compte, pour qu’il apparaisse dans son historique. Ce n’est pas le lien `getSharedUrl`.

Guide : `docs/webflow-embeds/share/GUIDE_NICOLAS_DUPLICATE_JOB.md`

**API :** `POST /api/v1/duplicateJobToUser`  
Champs : `username`, `token`, `edition`, `jobId`, `targetEmail`.

Copier transcript + CR. Audio seulement s’il est encore sur disque. Le job d’origine reste. Email cible = compte existant, sinon erreur claire. Audit log (qui → qui, job source, nouveau jobId).

Le bouton éditeur est déjà prévu côté front. On ne dira « c’est en prod » au client qu’après recette.

Merci,  
Florian
