# À savoir — partage et organisation

Texte collable en note interne, mail équipe ou FAQ aide. Pas de date promise aux clients.

---

## Pour l’équipe

- Le partage **existe déjà** côté API (`getSharedUrl`) mais la **page de lecture est obsolète** (servlet Java). On refait l’expérience comme `/auth/voice-invite` : **Flo = front Webflow `/share`**, **Nico = redirect + API JSON** (`getSharedJobView`).
- **Deux features** : (1) lien lecture pour invité sans compte, (2) copie vers le compte d’un collègue (historique). Karine a besoin des deux à terme ; la copie collègue nécessite **`duplicateJobToUser`**.
- Les sièges Business **ne partagent pas** automatiquement leurs fichiers : chaque email = espace isolé, sauf action explicite (copie ou lien).
- Audio cloud Business : **30 jours** ; copie locale mobile = filet de sécurité (tutoriel blog, upsert **après OK Florian**).
- Mails Nico : ne pas envoyer sans `OK envoi Nico partage page` (P2) et `OK envoi Nico partage JCQ` (P1).

---

## Pour les clients (FAQ courte)

**Puis-je envoyer un compte rendu à quelqu’un sans compte Agilotext ?**  
Oui, via un lien de lecture. La personne pourra lire la transcription et le compte rendu, sans modifier le fichier d’origine. La page de lecture est en cours de refonte (même confort que l’éditeur, sans les boutons d’édition).

**Puis-je transférer un compte rendu dans l’espace de ma collègue ?**  
Fonction en cours de déploiement. En attendant : export Word / PDF, ou réimport du fichier audio depuis le téléphone qui a enregistré (copie automatique dans Téléchargements).

**Nos comptes sont-ils liés parce qu’on est dans la même entreprise ?**  
Aujourd’hui chaque utilisateur a son espace. Un espace entreprise commun (services, rôles) est prévu. Contactez-nous si vous avez plusieurs sièges.
