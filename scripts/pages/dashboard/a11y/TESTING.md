# Tests smoke — NVDA / JAWS (dashboard Business)

Environnement : **Windows**, navigateur **Chrome** ou **Edge** (JAWS). Secours mac : VoiceOver + Chrome.

## Pré-requis

- Scripts Webflow : CSS a11y → `agilotext-a11y-lite.js` → `upload_ent_v2.js` / Record / Maestro.
- Page : `/app/.../dashboard` Business connecté.
- Pin CDN = **hash commit**, pas `@1.10`.

## Checklist (15–20 min)

1. **Landmarks** — navigation (menu) + main (contenu).
2. **Lien d’évitement** — après fermeture cookies : Tab → « Aller au contenu principal ».
3. **Focus visible** — contour sur liens / boutons.
4. **Upload** — « Envoi en cours », puis succès ou erreur via `aria-live`.
5. **Record** — labels CTA / start / stop ; annonce démarrage & arrêt ; focus dans le popup à l’ouverture, retour au bouton Enregistrer à la fermeture. Vérifier que « Copie locale » (auto-download) n’a pas régressé.
6. **Maestro** — activer « Joindre des documents » → annonce ; ajouter un fichier → annonce.
7. **Régression visuelle** — layout OK sous `.agilo-a11y-app`.

## Notes

- Iframes (Turnstile, éditeur) hors scope smoke.
- Hotjar / Posthog : noter seulement si focus bizarre signalé.
