# Audit Product Design & Diagnostic UX/UI — AgiloShield V2

Date : 02 Octobre 2026  
Statut : Pré-implémentation  
Contexte : Passage au standard SaaS B2B Professionnel (Niveau Marvin / Logiciels documentaires majeurs)  

---

## 1. Contexte & Méthodologie

Cet audit analyse en profondeur l'interface Webflow / Embed d'AgiloShield V2 déployée en staging. Il s'appuie sur :
1. L'inspection détaillée du code client (`agiloshield-v2-embed.js`) et des styles (`agiloshield-v2.css`).
2. Les 4 captures d'écran transmises par Florian (`media_1790939379972`, `media_1790939401723`, `media_1790939461314` [benchmark Marvin], `media_1790939521076`).
3. Le parcours complet d'un utilisateur professionnel manipulant des documents hautement confidentiels (PDF de factures, contrats, bilans, pièces d'identité).

---

## 2. Diagnostic Critique Écran par Écran

### A. Écran Principal & Zone d'Accueil
- **Hiérarchie & Surcharge cognitive** :
  - Dès l'ouverture, l'utilisateur est confronté simultanément au sélecteur d'onglets (Fichier / Texte / Restauration), aux commutateurs Anonymiser / Pseudonymiser, au bouton « Données à masquer », aux raccourcis et aux listes d'inclusion/exclusion.
  - La dropzone, qui devrait être le cœur battant du produit, est visuellement concurrencée par des paramètres techniques secondaires.
- **Orientation (Règle des 3 secondes)** :
  - *Où suis-je ?* Oui, l'en-tête est clair.
  - *Que s'est-il passé ?* Difficile à dire si des réglages par défaut s'appliquent sans ouvrir la modale.
  - *Que dois-je faire maintenant ?* L'œil hésite entre modifier les 13 catégories ou déposer un fichier.

### B. Carte « DERNIER DOCUMENT » (Capture `media_1790939521076.png`)
- **Défauts d'alignement majeurs** :
  - Le badge `DERNIER DOCUMENT` flotte à gauche avec un décalage vertical par rapport au nom de fichier `Facture F905PJ78913.pdf`.
  - La mention `Traitement impossible` apparaît sur une ligne inférieure, indentée de façon asymétrique sans repère d'alignement avec le badge ou le titre.
  - Le bouton `Voir les détails` est rejeté tout à droite, sans lien visuel fort avec l'état d'échec.
  - L'ensemble ressemble à un bloc HTML empilé par manque d'espace plutôt qu'à une Summary Card B2B soignée.

### C. Panneau de Revue & Détections (Captures `media_1790939379972.png` et `media_1790939401723.png`)
- **Structure « poupées russes » (Card dans Card dans Card)** :
  - Niveau 1 : Le panneau latéral entier (`issuePane`).
  - Niveau 2 : L'accordéon de catégorie (`Personne 14 passages`).
  - Niveau 3 : La sous-carte d'entité (`[Personne] Invoice Invoice [1 passage]`).
  - Niveau 4 : Le bloc de snippet (`...Page 1 of 1 [Invoice Invoice]...`).
  - Niveau 5 : L'empilement vertical de 3 boutons (`Voir le passage`, `Conserver`, `Masquer`).
- **Friction d'interaction et lenteur ressentie** :
  - Pourquoi un bouton `Voir le passage` pleine largeur ? L'utilisateur doit cliquer sur l'accordéon, puis sur l'entité, puis sur « Voir le passage ».
  - `focusOccurrence` force `entry.previewKind = 'origin'` et détruit le canvas PDF pour le reconstruire de zéro (`renderPreview`), provoquant un flash blanc et un délai de plusieurs centaines de millisecondes même pour rester sur la même page.
  - Les boutons `Conserver` et `Masquer` n'ont pas de contraste sémantique évident (tous deux bleus/blancs à bordure fine) et sont accompagnés de textes d'aide redondants.
- **Monotonie et manque d'aide visuelle** :
  - Toutes les catégories ont la même teinte bleue délavée. L'utilisateur ne peut pas scanner visuellement d'un coup d'œil où sont les personnes, les emails ou les organisations.
  - Le benchmark Marvin (`media_1790939461314.png`) démontre à l'inverse la puissance des badges colorés (Personnes en violet, Emails en rose, Entreprises en cyan, Localisation en vert) directement répercutés en surbrillance sur le document.

### D. Barre d'outils du Document & Outils de Masquage
- **Doublon incompréhensible** :
  - Deux boutons coexistent dans la barre d'outils : `Masquer une zone` et `Ajouter un masquage`.
  - `Ajouter un masquage` se contente d'ouvrir un `<details>` textuel replié dans la colonne gauche, déroutant l'utilisateur qui s'attend à une action directe sur le PDF.
- **Absurdité du forçage vers l'original** :
  - Cliquer sur `Masquer une zone` bascule obligatoirement sur l'original en données claires.
  - Or, un juriste, DPO ou expert-comptable inspecte la **version anonymisée**. S'il repère un oubli, c'est **sur cette version anonymisée** qu'il veut tracer son rectangle pour corriger immédiatement l'omission.
- **Parcours du combattant de « Valider ma vérification »** :
  - Le bouton bloque en erreur `409` dès qu'une détection reste en statut `REVIEW`.
  - L'utilisateur est forcé de résoudre chaque passage un par un, provoquant autant de recalculs lourds côté serveur.

---

## 3. Plan de Correction Structuré

1. **Suppression immédiate du doublon** : Éliminer `Ajouter un masquage`. Ne conserver qu'un unique bouton proéminent **« Masquer une zone »**.
2. **Masquage multi-vues** : Rendre le lasso de masquage opérant directement sur l'aperçu anonymisé `anon`, ainsi que sur `origin` et `compare`.
3. **Remplacement de l'empilement par la sélection directe (Marvin UX)** :
   - Clic direct sur la ligne d'occurrence pour défiler instantanément sur la zone (sans recharger le canvas).
   - Palette de couleurs sémantiques distincte par famille d'entités.
4. **Validation en 1 étape** : Bouton d'attestation humaine automatisant le masquage des occurrences résiduelles avant de valider.
5. **Alignement au pixel de la carte Dernier Document**.
