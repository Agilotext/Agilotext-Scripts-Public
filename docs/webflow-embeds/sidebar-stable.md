# Sidebar Webflow — stabiliser le menu latéral

Sur agilotext-test, la sidebar « Accueil / Mes fichiers / Dossiers / Mon compte / Factures / Anonymiser / Support » s’affiche correctement sur **Tableau de bord** et casse sur **Mes transcripts**, **Mon compte** et autres.

## Diagnostic

Comparaison directe des exports Webflow `Business _ Tableau de bord` vs `Business _ Mes transcripts` :

| Bloc dans `dashboard-menu.menu-app` | Tableau de bord | Mes transcripts |
|--------------------------------------|-----------------|-----------------|
| Logo + brand | Oui | Oui |
| `dashboard-member` (avatar) | Oui | Oui |
| `agilo-quotas-flat` (compteur 1154/4080 min) | **Oui** | **Non** |
| `wrapper-transcriptioncounter` | **Oui** | **Non** |
| Liens nav (`dashboard-link`) | Oui | Oui |
| `coupon-wrap` (Votre lien d’invitation) | **Oui** | **Non** |
| `button.ambassador` (Devenir ambassadeur) | **Oui** | **Non** |
| `agilo-referral-widget` | **Oui** | **Non** |
| `spacer-20` | **Oui** | **Non** |

**Sur Tableau de bord** : la colonne est remplie de blocs jusqu’en bas → la largeur Auto se cale sur le contenu le plus large (texte d’invitation), et `space-between` distribue les éléments naturellement.

**Sur Mes transcripts** : ces blocs sont absents → la colonne devient courte. Avec `width: auto` + `justify-content: space-between`, les liens nav s’étirent verticalement (gros écart entre eux) et la largeur change d’une page à l’autre.

Cause exacte : la classe `dashboard-menu.menu-app` côté Webflow Designer (visible sur ton screenshot) est configurée :

- Display : Flex
- Direction : Column
- Y Align : **Space between** ← coupable
- Width : **Auto** ← coupable
- Min W / Max W : Auto / 15rem
- Gap : 1 REM

## Solution recommandée

### Option A — Fix CSS chargé via jsDelivr (rapide, déjà packagé)

Charger ce fichier UNE SEULE FOIS depuis le **symbole sidebar** (Webflow → Symbole `App_dashboard-menu` → Custom Code) :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@<HASH>/scripts/pages/dashboard/Code-sidebar-stable-css.js?v=<HASH>"></script>
```

Ce que fait le script :

- Force `width: 240px` fixe sur `.dashboard-menu.menu-app` (au lieu de `auto`)
- Passe en `justify-content: flex-start` (au lieu de `space-between`)
- Insère un `<div class="agilo-sidebar-spacer">` automatiquement avant le footer (`button.ambassador`, `modal_small`, `nav-bar-app`, `button-secondary`) → le footer reste collé en bas sans étirer les liens
- Force `width: 100%` sur les liens (`a.dashboard-link`) pour qu’ils prennent toute la largeur
- Passe à 64 px en mode replié (sidebar `is-collapsed`)

Périmètre : sélecteurs préfixés `.agilo-a11y-app` → ne touche que l’app, pas la home.

### Option B — Fix permanent dans Webflow Designer (recommandé long terme)

Dans le **Style selector** `dashboard-menu.menu-app` :

| Propriété | Valeur actuelle | À mettre |
|-----------|-----------------|----------|
| Y Align | Space between | **Flex start** |
| Width | Auto | **240 px** (fixe) |
| Min W | Auto | 240 px |
| Max W | 15 REM | 240 px |
| Gap | 1 REM | 0.4 REM |
| Padding | 0 / 1rem / 4rem / 0 | 1rem |

Sur la classe enfant `dashboard-link` :

| Propriété | Valeur |
|-----------|--------|
| Width | 100 % |
| Justify content | Flex start |
| Flex wrap | No wrap |

**Pourquoi un symbole partagé**

Toutes les pages app (Tableau de bord, Mes transcripts, Mon compte, Factures, Anonymiser, Support) doivent utiliser **le même symbole sidebar** dans Webflow. Si chaque page a son propre clone, supprimer un bloc (ex: invitation) sur une page change le rendu à cause du flex auto. Solution :

1. Vérifier dans Webflow que la sidebar est un **Symbol**, pas un copier-coller.
2. Si chaque page a son clone, créer un Symbol unique `App_Sidebar` et le remplacer partout.

### Option C — Quick win sans toucher Webflow

Ajouter le `<script>` du fichier `Code-sidebar-stable-css.js` dans le **Site-wide Custom Code** (Project Settings → Custom Code → Footer Code) — il s’applique partout, et le sélecteur `.agilo-a11y-app` cible uniquement les pages app.

## Embed à coller (test agilotext-test)

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@<HASH>/scripts/pages/dashboard/Code-sidebar-stable-css.js?v=<HASH>"></script>
```

Pages où le poser :

- Idéalement : **Project Settings → Custom Code → Footer** (toutes pages)
- Sinon : Symbol `App_Sidebar` Custom Code
- Sinon : embed dans chaque page concernée (Mes transcripts, Mon compte, Factures, Anonymiser, Support)

## Vérification

Console après chargement :

```javascript
document.getElementById('agilo-sidebar-stable-css')?.tagName
// => "STYLE"
document.querySelector('.agilo-sidebar-spacer')?.tagName
// => "DIV" (sur les pages où footer présent)
```

Test visuel : la sidebar Mes transcripts doit avoir la même largeur et le même espacement que Tableau de bord. Les liens nav doivent être collés en haut, pas étirés.
