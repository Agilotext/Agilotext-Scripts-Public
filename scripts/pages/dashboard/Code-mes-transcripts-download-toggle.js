/**
 * Mes transcripts — ouverture/fermeture du panneau « Télécharger » (delegation au document).
 *
 * Webflow : supprimez l’embed inline `.script-toglledown-link` (anciennement un <script>
 * dans Custom Code qui appelait toggleDownloadOptions sur DOMContentLoaded) et chargez-
 * UNIQUEment ce fichier après `Code-mes-transcripts-logic.js`, par exemple :
 *
 * <script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.08/scripts/pages/dashboard/Code-mes-transcripts-download-toggle.js"></script>
 *
 * v1.08 — Respecte lignes verrouillées (`data-agilo-download-locked`, panneau sans lien utile).
 */
(function () {
  'use strict';
  if (window.__AGILO_MES_TR_DL_TOGGLE) return;
  window.__AGILO_MES_TR_DL_TOGGLE = true;

  function jobsContainer() {
    return document.getElementById('jobs-container');
  }

  function countUsableDownloadLinks(panel) {
    if (!panel) return 0;
    let cnt = 0;
    panel.querySelectorAll('a[href]').forEach((a) => {
      const href = (a.getAttribute('href') || '').trim();
      if (!href || href === '#' || href.startsWith('#')) return;
      if (!href.includes('receiveText') && !href.includes('receiveSummary')) return;
      const st = window.getComputedStyle(a);
      if (st.display === 'none' || st.visibility === 'hidden') return;
      cnt++;
    });
    return cnt;
  }

  function panelIsOpen(panel) {
    if (!panel) return false;
    return window.getComputedStyle(panel).display !== 'none';
  }

  function closeAllPanels() {
    const root = jobsContainer();
    if (!root) return;
    root.querySelectorAll('.download_link-options').forEach((p) => {
      p.style.display = 'none';
    });
    root.querySelectorAll('.custom-element.options.is-open').forEach((box) => {
      box.classList.remove('is-open');
    });
    root.querySelectorAll('.custom-element.options .download-link').forEach((btn) => {
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  document.addEventListener('click', function agiloMesTranscriptsDlToggle(ev) {
    const root = jobsContainer();
    if (!root) return;

    const linkInsidePanel =
      ev.target.closest &&
      ev.target.closest('.download_link-options a[href*="receiveText"], .download_link-options a[href*="receiveSummary"]');
    if (linkInsidePanel) return;

    let target = ev.target;
    while (target && target !== document) {
      if (
        target.classList &&
        target.classList.contains('custom-element') &&
        target.classList.contains('options')
      ) {
        if (!root.contains(target)) return;

        if (
          target.getAttribute('data-agilo-download-locked') === '1' ||
          target.classList.contains('agilo-download-locked')
        ) {
          ev.preventDefault();
          ev.stopPropagation();
          closeAllPanels();
          return;
        }

        const downloadPanel = target.querySelector('.download_link-options');
        const usable = countUsableDownloadLinks(downloadPanel);
        const alreadyOpen = panelIsOpen(downloadPanel);

        closeAllPanels();

        if (!alreadyOpen && usable === 0) {
          ev.preventDefault();
          ev.stopPropagation();
          return;
        }

        if (!alreadyOpen && downloadPanel) {
          ev.preventDefault();
          ev.stopPropagation();
          downloadPanel.style.display = 'block';
          target.classList.add('is-open');
          const dl = target.querySelector('.download-link');
          if (dl) dl.setAttribute('aria-expanded', 'true');
        }

        return;
      }
      target = target.parentElement;
    }

    closeAllPanels();
  });
})();
