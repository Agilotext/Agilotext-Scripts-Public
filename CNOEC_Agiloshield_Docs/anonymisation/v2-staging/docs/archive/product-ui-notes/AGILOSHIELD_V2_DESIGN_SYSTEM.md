# Mini Design System — AgiloShield V2

Date : 02 Octobre 2026  
Version : 2.1 (SaaS B2B Professional Grade)  
Compatibilité : Webflow Staging & Production (CSS scoped sous `#agiloshield-v2-staging`)  

---

## 1. Principes Fondateurs

1. **Calme & Densité Contrôlée** : Aucun composant criard, pas d'animations gratuites. Espacements rigoureux basés sur un pas de 4 px.
2. **Sémantique Métier Évidente** : L'utilisateur sait en un regard ce qui est masqué, ce qui est à vérifier et ce qui est conservé.
3. **Palette d'Entités Distinctive (Benchmark Marvin)** : Chaque type de donnée confidentielle possède son identité chromatique unique, de la liste latérale jusqu'aux surbrillances du document.
4. **Zéro Approximation d'Alignement** : Même hauteur pour tous les boutons d'une même ligne, icônes optiquement centrées, alignement strict sur la grille.

---

## 2. Échelle de Spacing (Grille 4 px)

```css
--as-space-1: 4px;   /* Micro-gap, badge padding vertical */
--as-space-2: 8px;   /* Gap standard entre icône et texte, petits paddings */
--as-space-3: 12px;  /* Padding interne des cartes et contrôles compacts */
--as-space-4: 16px;  /* Marges de section, padding des containers */
--as-space-5: 20px;  /* Padding des tiroirs et panneaux principaux */
--as-space-6: 24px;  /* Séparation entre grands blocs */
--as-space-8: 32px;  /* Respirations majeures de layout */
--as-space-10: 40px; /* Marges supérieures d'écrans */
```

*Interdiction stricte des paddings et margins arbitraires de 11px, 13px, 17px ou 19px.*

---

## 3. Palette Sémantique des Entités (Inspiration Marvin)

| Famille de Données | Code / Catégorie | Couleur Fond Chip | Couleur Texte Chip | Couleur Liseré Document |
|---|---|---|---|---|
| **Personnes & Identités** | `PER`, `CIVIL_STATUS`, `SIGNATURE` | `#e0e7ff` (Indigo 100) | `#3730a3` (Indigo 800) | `#6366f1` (Indigo 500) |
| **Contacts & Emails** | `EMAIL`, `PHONE` | `#fce7f3` (Pink 100) | `#9d174d` (Pink 800) | `#ec4899` (Pink 500) |
| **Entreprises & Métier** | `ORG`, `JOB_TITLE` | `#ccfbf1` (Teal 100) | `#115e59` (Teal 800) | `#14b8a6` (Teal 500) |
| **Localisation & Lieux** | `LOC`, `ADDRESS` | `#dcfce7` (Emerald 100) | `#166534` (Emerald 800) | `#22c55e` (Emerald 500) |
| **Finances & Identifiants**| `IBAN`, `ID_NUM` | `#ede9fe` (Violet 100) | `#5b21b6` (Violet 800) | `#8b5cf6` (Violet 500) |
| **Dates & Délais** | `DATE` | `#fef3c7` (Amber 100) | `#92400e` (Amber 800) | `#f59e0b` (Amber 500) |

---

## 4. Typographie & Hiérarchie

| Niveau | Taille | Graisse | Hauteur de Ligne | Rôle |
|---|---|---|---|---|
| **Title / H2** | 20 px | 700 (Bold) | 1.3 | Titre de document, Titre de modale |
| **Subtitle / H3** | 15 px | 650 (Semi-bold) | 1.4 | Sections du panneau de vérification |
| **Body** | 13 px | 450 (Regular) | 1.5 | Textes explicatifs, résumés de décision |
| **Label / Button**| 13 px | 600 (Medium) | 1.2 | Textes des boutons, en-têtes d'accordéon |
| **Badge / Tag** | 11 px | 700 (Bold) | 1.0 | Compteurs, codes entités (`MAIL`, `PER`) |
| **Monospace / Code**| 11 px | 500 (Regular) | 1.4 | Identifiants Job `#1000040819`, révisions |

---

## 5. Composants Boutons : Zéro Approximation

1. **Bouton Primaire (`asv2-primary`)** :
   - Fond : `var(--asv2-blue)` (`#205cb7`) $\rightarrow$ Hover : `#184a96`.
   - Texte : `#ffffff`, `font-weight: 650`.
   - Hauteur fixe : `38 px` (compact : `32 px`).
   - Padding : `0 16 px`.
   - Radius : `8 px`.
2. **Bouton Secondaire (`asv2-secondary`)** :
   - Fond : `#ffffff` $\rightarrow$ Hover : `#f8fafc`.
   - Bordure : `1px solid #cbd5e1`.
   - Texte : `#1e293b`.
   - Hauteur fixe : `38 px`.
   - Padding : `0 14 px`.
3. **Boutons de Décision « Conserver » et « Masquer »** :
   - **Conserver** : Neutre/secondaire doux. Bordure `#cbd5e1`, fond blanc, icône `eye`.
   - **Masquer** : Accentuation de protection distincte. Bordure `#3b82f6`, fond `#eff6ff`, texte `#1d4ed8`, icône `eye-slash`.
   - Disposés côte à côte à égalité stricte de largeur (`flex: 1 1 50%`) et même hauteur (`34 px`).
4. **Bouton d'action sur zone (« Masquer une zone »)** :
   - Placé en tête de toolbar.
   - État actif : fond `#1e293b`, texte blanc, icône lasso/selection animée sobrement.

---

## 6. Structure Spatiale du Drawer (2 Colonnes Stables)

```text
┌────────────────────────────────────────────────────────────────────────┐
│ [Doc Icon] Facture F905PJ78913.pdf   Job #1000040819    [Toolbar]  [✕] │
├─────────────────────────┬──────────────────────────────────────────────┤
│ COLONNE REVUE (380px)   │ COLONNE DOCUMENT (Reste de l'écran)          │
│                         │                                              │
│ • Header état & statut  │ [Original | Anonymisé | Comparer] [Masquer]  │
│ • Décisions restantes   │                                              │
│ • Catégories colorées   │ [ Canvas PDF centré avec ombre naturelle ]   │
│ • Actions rapides       │                                              │
│ • Validation 1 clic     │ [ Marqueurs colorés assortis aux catégories] │
└─────────────────────────┴──────────────────────────────────────────────┘
```
