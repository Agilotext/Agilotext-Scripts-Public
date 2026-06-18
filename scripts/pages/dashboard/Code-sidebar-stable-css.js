// Agilotext — Sidebar stable CSS
// Stabilise la sidebar `.dashboard-left > .dashboard-menu.menu-app` quel que soit
// le contenu (avec ou sans bloc « Votre lien d'invitation », quotas, ambassadeur…).
//
// À charger UNE SEULE FOIS depuis le symbole « App_dashboard-menu » (Custom Code),
// avant tout autre script dashboard.
//
// Pourquoi : le selector Webflow `dashboard-menu.menu-app` a `width: auto` et
// `justify-content: space-between`. Quand la page contient peu de blocs (Mes
// transcripts, Mon compte, Anonymiser) le `space-between` étire les liens
// verticalement et le `width: auto` change la largeur. Résultat : layout cassé
// sur certaines pages, OK sur Tableau de bord (où il y a plus de contenu).

(function () {
  'use strict';
  if (document.getElementById('agilo-sidebar-stable-css')) return;

  const css = `
/* === Sidebar stable — appliqué sur .agilo-a11y-app pour ne toucher qu'app === */

/* Largeur stable, indépendante du contenu interne */
.agilo-a11y-app .dashboard-left { flex: 0 0 auto; }
.agilo-a11y-app .dashboard-left .dashboard-menu.menu-app {
  width: 240px !important;
  min-width: 240px !important;
  max-width: 240px !important;
  justify-content: flex-start !important;
  gap: 0.35rem !important;
  padding: 1rem 1rem 2rem 1rem !important;
  box-sizing: border-box !important;
}

/* Liens nav : largeur 100 %, pas de wrap, label visible */
.agilo-a11y-app .dashboard-menu.menu-app a.dashboard-link,
.agilo-a11y-app .dashboard-menu.menu-app .dashboard-link.folder {
  width: 100% !important;
  max-width: 100% !important;
  text-align: left !important;
  justify-content: flex-start !important;
  flex-wrap: nowrap !important;
  gap: 0.5rem !important;
  padding-block: 0.45rem !important;
}

.agilo-a11y-app .dashboard-menu.menu-app a.dashboard-link > div:not(.wrapper-link):not(.wrapper-new-button) {
  flex: 0 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Spacer Flex pour pousser footer (déconnexion / ambassador) en bas
   sans dépendre de space-between (qui étire les liens). */
.agilo-a11y-app .dashboard-menu.menu-app::before { content: none; }
.agilo-a11y-app .dashboard-menu.menu-app .agilo-sidebar-spacer { flex: 1 1 auto; }

/* Mode compact (sidebar repliée) */
.agilo-a11y-app .dashboard-left.is-collapsed .dashboard-menu.menu-app {
  width: 64px !important;
  min-width: 64px !important;
  max-width: 64px !important;
  padding: 1rem 0.4rem 2rem 0.4rem !important;
}

/* Bloc invitation / ambassador : ne plus tirer la largeur */
.agilo-a11y-app .dashboard-menu.menu-app .coupon-wrap,
.agilo-a11y-app .dashboard-menu.menu-app .modal_small,
.agilo-a11y-app .dashboard-menu.menu-app .button.ambassador,
.agilo-a11y-app .dashboard-menu.menu-app .agilo-referral-widget {
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box;
}

/* Compteur quotas : occupe la largeur disponible sans déborder */
.agilo-a11y-app .dashboard-menu.menu-app .agilo-quotas-flat,
.agilo-a11y-app .dashboard-menu.menu-app .wrapper-transcriptioncounter {
  width: 100% !important;
  max-width: 100% !important;
}
`;

  const style = document.createElement('style');
  style.id = 'agilo-sidebar-stable-css';
  style.textContent = css;
  document.head.appendChild(style);

  // Insère un spacer flex pour permettre le push du footer en flex-start
  function ensureSpacer() {
    const menu = document.querySelector('.agilo-a11y-app .dashboard-left .dashboard-menu.menu-app');
    if (!menu) return;
    if (menu.querySelector(':scope > .agilo-sidebar-spacer')) return;
    // Repérer le 1er bloc « footer » : ambassador / coupon / déconnexion
    const candidates = menu.querySelectorAll(':scope > .button.ambassador, :scope > .modal_small, :scope > .nav-bar-app, :scope > .button-secondary');
    if (!candidates.length) return;
    const footer = candidates[0];
    const spacer = document.createElement('div');
    spacer.className = 'agilo-sidebar-spacer';
    menu.insertBefore(spacer, footer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureSpacer, { once: true });
  } else {
    ensureSpacer();
  }
  // ré-essaie quand Webflow injecte le symbole tardivement
  const obs = new MutationObserver(() => ensureSpacer());
  obs.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => obs.disconnect(), 8000);
})();
