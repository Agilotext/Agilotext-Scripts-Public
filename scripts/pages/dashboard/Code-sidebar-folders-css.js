// Agilotext — styles barre latérale dossiers (nav sous Transcriptions)
// ⚠️ PRODUCTION LIVE v1.8.0 — Normalisation Business Edition
// Harmonise l'alignement entre « Dashboard », « Tous les fichiers » et « Dossiers ».

(function () {
  if (document.getElementById('agilo-sidebar-folders-css')) {
    const el = document.getElementById('agilo-sidebar-folders-css');
    if (el.dataset.version === '1.8.0') return;
    el.remove();
  }

  const css = `
/* =============================================================================
   RE-NORMALISATION ICONES (Business Edition Fix)
   Webflow utilise .icon-small (1.5rem x 1.5rem) avec padding .1875rem.
   ============================================================================= */

/* Fix pour l'icône orpheline de "Tous les fichiers" (data-tour="nav-transcripts") */
a.dashboard-link[data-tour="nav-transcripts"] {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
}

/* On force le premier SVG du lien "Tous les fichiers" à se comporter comme un .icon-small */
a.dashboard-link[data-tour="nav-transcripts"] > svg:first-child {
  flex: 0 0 auto !important;
  width: 1.5rem !important;
  height: 1.5rem !important;
  padding: .1875rem !important;
  margin-right: .2rem !important;
  box-sizing: border-box !important;
  display: block;
}

/* =============================================================================
   NAV DOSSIERS — Structure Harmonisée
   ============================================================================= */
#agilo-nav-folders-root {
  display: block !important;
  width: 100% !important;
  box-sizing: border-box;
}

/* Toutes les icônes de dossiers et le summary utilisent .icon-small */
#agilo-nav-folders-root .icon-small.w-embed {
  flex: 0 0 auto !important;
  width: 1.5rem !important;
  height: 1.5rem !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: .1875rem !important; /* Identique Webflow */
  box-sizing: border-box !important;
}

/* FIX : L'ICÔNE ENORME. On bride le SVG à l'intérieur du conteneur de 1.5rem */
#agilo-nav-folders-root .icon-small.w-embed svg {
  width: 1.1rem !important;
  height: auto !important;
  max-width: 100%;
  max-height: 100%;
  display: block;
}

/* Aligner le résumé "Dossiers" */
#agilo-nav-folders-root summary.agilo-nav-folders__summary {
  display: flex !important;
  align-items: center !important;
  gap: .2rem !important; /* Même gap que les autres menu-items */
  width: 100% !important;
  padding: .5rem 0;
  cursor: pointer;
  list-style: none;
}

.agilo-nav-folders__summary-main {
  display: flex;
  align-items: center;
  min-width: 0;
  flex: 1;
}

.agilo-nav-folders__summary-text {
  font-size: .82rem;
  font-weight: 600;
  color: var(--color--gris, #525252);
  margin-left: 0.15rem;
}

/* Lignes dossiers individuelles */
.agilo-nav-folders__list {
  display: flex;
  flex-direction: column;
  padding-left: 0;
}

.agilo-nav-folders__row {
  display: flex !important;
  align-items: center !important;
  padding: .25rem 0;
  text-decoration: none;
  color: inherit;
  width: 100%;
}

.agilo-nav-folders__name {
  font-size: .8rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

/* Masquer le marqueur par défaut de Webflow/Browser */
summary::-webkit-details-marker { display: none; }
`;

  const style = document.createElement('style');
  style.id = 'agilo-sidebar-folders-css';
  style.dataset.version = '1.8.0';
  style.textContent = css;
  document.head.appendChild(style);
})();
