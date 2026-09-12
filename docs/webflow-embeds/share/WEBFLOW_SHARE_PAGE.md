# Webflow — Page partage (`/auth/share`)

**share-v1** — page publique pour un invité **sans compte** (transcription, compte rendu, PV, etc.). Même dossier que voice-invite et join-team : **Auth**.

**Ne jamais coller `@PIN`.** Scripts jsDelivr **après** commit + push. Pin actuel : `fc15219e`. Mount : `#editorRoot` (pas de carte 960 px, pas de `body.appendChild`).

---

## 1) Dupliquer « Rejoindre une équipe »

Pages → **Auth** → **Rejoindre une équipe** → Duplicate.

Dans **New Page settings**, coller exactement :

| Champ | Valeur |
|-------|--------|
| **Page name** | `Partage` |
| **Parent folder** | `Auth` (déjà) |
| **Slug** | `share` |
| URL attendue | `www.agilotext.com/auth/share` |

**Access control :** **Public** (comme join-team). Pas de mot de passe. Pas de gate Memberstack.

**SEO settings :**

| Champ | Valeur |
|-------|--------|
| **Title** | `Partage \| Agilotext` |
| **Meta description** | `Lien de lecture d’un document Agilotext (transcription, compte rendu, PV). Accès en lecture seule, sans compte. Document confidentiel, non indexé.` |
| **Hide from search engines** | **Oui** (`noindex, nofollow`) |

L’aperçu Google peut rester. L’important : **cocher hide from search engines**. Ne pas mettre d’Open Graph avec un vrai CR.

Clic **Create**.

Puis dans la page : **renommer** si Webflow a laissé « Rejoindre une équipe Copy ». Slug **uniquement** `share` (pas `join-team-copy`, pas `share-copy`).

---

## 2) Canvas : garder le cadre, vider le formulaire

Squelette **éditeur** (sans scripts d’édition) :

- `section.section_hero.app` > `.dashboard.mes-transcript`
- `.dashboard-left` : logo + Aide / Créer un compte (pas Mes fichiers)
- `.dashboard-right` > `#editorRoot.editorroot`
- Nav marketing + footer **masqués** sur cette page
- Access control **Public** (retirer `data-ms-content="!members"`)

HtmlEmbed jsDelivr **dans** `.dashboard-right`, **frère** de `#editorRoot` (scripts seulement, pas un 2e mount) :

L’HtmlEmbed est **frère** de `#editorRoot` (pas dedans) : le JS remplace `innerHTML` du mount.

Recette maquette, une fois les scripts pinnés :

```
https://agilotext-test.webflow.io/auth/share?mock=1
https://agilotext-test.webflow.io/auth/share?mock=1&doc=pv
https://agilotext-test.webflow.io/auth/share?mock=1&doc=transcript
```

---

## 3) Publish

**Staging seulement** (`agilotext-test.webflow.io`). Pas www tant que Nico n’a pas le redirect et que le SHA n’est pas collé.

---

## Embed complet (plus tard, SHA réel)

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@fc15219e/scripts/shared/agilo-share-url.js?v=share-v1"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@fc15219e/scripts/pages/share/share-view-invite.js?v=share-v1"></script>
```

---

## UX (script)

- Kicker **Partage** (ou `pageKicker` API), titre job, bandeau confidentialité
- Onglets **Transcription** + libellé dynamique (Compte rendu, Procès-verbal, PV, Note…) selon `sharedDocumentType` ou contenu
- Lecteur audio si `audioUrl`, sinon message 30 jours
- Copier / télécharger (`…-download`)
- CTA « Créer un compte gratuit » (`utm_source=share_link`)
- États : token manquant, expiré, révoqué, API pas encore en prod

Pas de re-prompt, chat, rename, édition.

---

## Mes transcripts (optionnel, plus tard)

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@SHA/scripts/pages/dashboard/agilo-job-share-actions.js?v=share-v1"></script>
```

---

## Backend

[`GUIDE_NICOLAS_SHARE_JOB_VIEW.md`](GUIDE_NICOLAS_SHARE_JOB_VIEW.md)  
Mail : [`EMAIL_NICOLAS_SHARE_PAGE.md`](EMAIL_NICOLAS_SHARE_PAGE.md)
