# Spec — Passages à relire · navigation précédent / suivant

**Date :** 2026-07-24  
**Origine feedback :** Astrid Grandjean (appel CSE) + revue code branche `1.09`  
**Scope :** UI panneau confidence uniquement (pas de changement scoring)  
**Fichiers :**  
- `scripts/pages/editor/confidence-v1/agilo-confidence.js`
- `scripts/pages/editor/confidence-v1/agilo-confidence.css.js`
- Doc existante : [`editor-confidence-v1.md`](editor-confidence-v1.md)

**Statut :** implémenté (version console `1.09.2`, branche `feature/confidence-nav-prev-2026-07-24`)

---

## Problème

Sur un long transcript (ex. ~100+ passages à relire), l’utilisateur clique « Passage suivant », veut revenir au passage précédent pour comparer audio / contexte, et **ne peut pas** via l’UI.

## État actuel (vérifié avant fix)

| Couche | Suivant | Précédent |
|--------|---------|-----------|
| Bouton panneau | Oui `#ag-confidence-next` | **Non** |
| API JS | `goToNextConfidenceZone()` | `goToPreviousConfidenceZone()` **déjà implémentée** |
| Clavier | `Alt+ArrowRight` | `Alt+ArrowLeft` |

---

## Spec UI (livré)

1. Bouton `#ag-confidence-prev` **avant** `#ag-confidence-next` dans `.ag-confidence-panel__nav`.
2. Libellés desktop : `Passage précédent` · `Passage suivant`.  
   Mobile étroit : flèches `←` / `→` via dual-span CSS (pas `matchMedia` JS) + `aria-label` complets.
3. Listeners :

```javascript
panel.querySelector('#ag-confidence-prev')?.addEventListener('click', goToPreviousConfidenceZone);
panel.querySelector('#ag-confidence-next')?.addEventListener('click', goToNextConfidenceZone);
```

4. Compteur `#ag-confidence-nav-count` **entre** prev et next (`Passage X / N`).
5. États :
   - Si `pendingRisk === 0` : aucun bouton nav.
   - Nav **circulaire** (cohérent clavier) ; `title` prev mentionne la boucle en début de liste.
6. Prev = bouton secondaire, Next = primary.
7. Découverte raccourcis : `title` + `aria-keyshortcuts` persistants + hint dans le helper one-shot.
8. Raccourcis clavier inchangés.

## Critères d’acceptation

- [x] Depuis le panneau, on peut aller au suivant **et** revenir au précédent.
- [x] Le compteur se met à jour dans les deux sens.
- [x] `Alt+←` / `Alt+→` inchangés.
- [x] Pas de régression panneau floating (desktop + mobile dual-span).
- [ ] Mockups LinkedIn / docs com (hors commit, ticket com séparé).

## Hors scope (P2, feedback Astrid)

- ~50 % des flags « à relire » perçus comme faux positifs = chevauchements / coupures de parole.
- Couche optionnelle « transcription nettoyée » (répétitions, overlaps).
- Sync lecteur audio au passage navigué (P1.5).
- Ne pas mélanger scoring et cette spec nav.

## Effort estimé

Très faible (HTML panneau + 1 listener + CSS groupe). Logique métier déjà là.
