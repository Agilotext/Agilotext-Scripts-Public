# Changelog UI / UX — Refonte SaaS B2B AgiloShield V2

Date : 02 Octobre 2026  
Branche : `codex/agiloshield-v2-ui-product-grade-2026-10-02`  

---

## Synthèse des Modifications

### 1. PASS A — Structure & UX

| Écran / Composant | Avant | Après | Bénéfice Produit |
|---|---|---|---|
| **Barre d'outils Document** | Deux boutons concurrents : `Masquer une zone` + `Ajouter un masquage` | Bouton unique proéminent : **« Masquer une zone »** | Clarté immédiate, zéro confusion |
| **Zone de masquage** | Forçage obligatoire vers l'original (`entry.previewKind = 'origin'`) | Masquage direct sur `anon`, `origin` et `compare` | L'utilisateur modifie directement le document sans voir les données sensibles en clair |
| **Cartes d'occurrences** | Bouton pleine largeur « Voir le passage » + rechargement complet du canvas | Clic direct sur la ligne de l'occurrence $\rightarrow$ scroll fluide et centrage en 150 ms | Navigation ultra-rapide sans flash blanc |
| **Validation du document** | Parcours bloquant exigeant la décision préalable sur toutes les occurrences | Validation en 1 clic : masquage automatique des propositions en suspens + attestation | Gain de temps considérable (1 clic au lieu de 10) |
| **Sélection multi-documents** | Nécessitait un clic manuel pour ouvrir le document traité | Ouverture et centrage automatiques du dernier document téléversé | Expérience fluide dès la fin de l'envoi |

### 2. PASS B — Visual & UI Design System

| Écran / Composant | Avant | Après | Bénéfice Produit |
|---|---|---|---|
| **Catégories de données** | Teinte bleue uniforme et triste | Palette sémantique distinctive (Personnes = Violet, Emails = Rose, Entreprises = Cyan, Lieux = Vert, Dates = Ambre) | Scanning visuel instantané (benchmark Marvin) |
| **Surbrillances sur Document** | Bordure orange générique | Liserés et fonds teintés selon la catégorie de l'entité | Corrélation directe entre la liste et le document |
| **Carte « DERNIER DOCUMENT »** | Sous-titre décalé, texte non aligné | Summary Card horizontale avec alignement strict sur la grille 4px | Finition SaaS professionnelle |
| **Boutons Décisions** | Tailles disparates, icônes désalignées | Rangée équilibrée à 50/50, hauteur unique 34px, icônes `eye` et `eye-slash` centrées | Rassurance et confiance de l'opérateur |
| **Identifiant Job** | Masqué ou relégué dans la console | Badge `#<jobId>` visible partout avec bouton de copie diagnostic | Traçabilité technique exemplaire |
