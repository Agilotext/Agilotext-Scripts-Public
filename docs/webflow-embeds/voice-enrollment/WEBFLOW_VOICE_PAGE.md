# Webflow — Page dédiée « Empreinte vocale » (`/voice`)

**voice22** — sortir l'empreinte vocale du sous-onglet Profil vers une page first-class dans la sidebar.

---

## Pages à créer (×3 éditions)

| Édition Webflow | Slug | URL publiée |
|-----------------|------|-------------|
| Free | `voice` sous `/app/free/` | `/app/free/voice` |
| Premium (Pro) | `voice` sous `/app/premium/` | `/app/premium/voice` |
| Business | `voice` sous `/app/business/` | `/app/business/voice` |

**Template recommandé :** dupliquer la page **Mes transcripts** (layout sidebar + zone contenu) plutôt que Mon compte — pas de tabs internes.

---

## Sidebar — ajouter le lien

Dans le **symbole sidebar** partagé (`App_dashboard-menu` ou équivalent), ajouter un lien entre **Mes transcripts** et **Mon compte** :

| Label | Lien | Classe |
|-------|------|--------|
| Empreinte vocale | `/app/{edition}/voice` | `dashboard-link` (même style que les autres) |

Répéter pour les 3 éditions (ou utiliser un lien dynamique Memberstack si déjà en place pour les autres items).

**Active state :** si Webflow gère `w--current` sur les liens nav, vérifier que la page `/voice` active bien ce lien.

---

## Contenu de la page

1. Titre H1 (optionnel — le script injecte déjà « Empreinte vocale ») : laisser la zone contenu vide sauf l'embed
2. Coller l'embed depuis [`voice-page.html`](voice-page.html) :

```html
<div id="agilo-voice-settings"></div>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@<SHA>/scripts/pages/settings/voice-enrollment-settings.js?v=1.09-voice22"></script>
```

3. **Memberstack** : mêmes permissions que la page Mon compte / profile (membres authentifiés free, premium, business selon l'édition)

---

## Migration depuis Mon compte (tab Profil)

### Option recommandée — transition douce (1 mois)

1. **Garder** l'embed sur `/profile` (tab Profil) le temps de la transition
2. **Ajouter** la page `/voice` + lien sidebar
3. Sur l'ancien tab Profil, ajouter un bandeau Webflow au-dessus de l'embed (optionnel) :

```html
<p style="padding:12px;background:#f0f4fa;border-radius:8px;margin-bottom:16px">
  L'empreinte vocale est désormais accessible directement via
  <a href="/app/business/voice">Empreinte vocale</a> dans le menu.
</p>
```

(Adapter l'URL selon l'édition ou utiliser un attribut data-edition.)

### Option clean — retrait immédiat

1. Retirer `<div id="agilo-voice-settings">` + script du tab Profil sur `/profile`
2. Les anciens liens `#agilo-voice-settings` sur profile ne fonctionneront plus → le popup dashboard pointe déjà vers `/voice`

---

## Popup dashboard

Le script [`agilo-voice-dashboard-popup.js`](../../../scripts/shared/agilo-voice-dashboard-popup.js) redirige désormais vers `/app/{edition}/voice` (plus besoin de `?tab=profile#agilo-voice-settings`).

Vérifier que l'embed popup est toujours chargé sur les pages dashboard (free/premium/business).

---

## Recette Webflow

1. `/app/business/voice` → liste voix + formulaire batch OK
2. Sidebar : lien « Empreinte vocale » actif sur cette page
3. Dashboard → popup « Configurer mon empreinte vocale » → arrive sur `/voice`
4. `/app/business/profile` → si embed conservé, fonctionne encore ; sinon bandeau redirection
5. Free `/app/free/voice` → upsell Pro (comportement script inchangé)
6. Mobile : sidebar + page scrollables, micro OK

---

## Fichiers repo liés

| Fichier | Rôle |
|---------|------|
| [`voice-page.html`](voice-page.html) | Embed page dédiée |
| [`profile-voice-settings.html`](profile-voice-settings.html) | Embed legacy tab Profil (compat) |
| [`voice-enrollment-settings.js`](../../../scripts/pages/settings/voice-enrollment-settings.js) | Script unique (profile + voice) |
| [`agilo-voice-dashboard-popup.js`](../../../scripts/shared/agilo-voice-dashboard-popup.js) | Redirect popup → `/voice` |
