# Baseline a11y — Dashboard Business (Atelier de la Villette)

Date : 2026-07-21  
Branche : `1.10` @ `9abfc4a` (avant patches P0 de ce lot)  
Méthode : analyse statique HTML live + code (NVDA non disponible dans l’environnement CI/agent)

## Checklist TESTING.md (pré-patch)

| # | Test | Résultat baseline |
|---|------|-------------------|
| 1 | Landmarks navigation / main | OK — `a11y-lite` pose `role=navigation` (#agiloSidebar) + `role=main` |
| 2 | Skip « Aller au contenu principal » | Présent dans le DOM ; risque **1er Tab capturé par Finsweet cookies** si bandeau ouvert |
| 3 | Focus visible | CSS `:focus-visible` sous `.agilo-a11y-app` |
| 4 | Annonces envoi fichier | **ÉCHEC probable** — Business charge `upload_ent_v2.js` sans `AgilotextA11y.announce` (contrairement à `ent.js`) |
| 5 | Record CTA | Boutons `.button.record` / `#startrecording` sans `aria-label` dédié |
| 6 | Maestro joindre docs | Row a `aria-label` générique ; pas d’annonce à l’activation / ajout doc |

## Conclusion baseline

Couche légère OK (skip + landmarks). Trou métier principal = **annonces muettes sur le flux upload Business live**. Priorité P0 confirmée.