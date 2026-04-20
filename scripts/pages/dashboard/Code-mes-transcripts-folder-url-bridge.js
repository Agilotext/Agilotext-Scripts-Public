// Agilotext — pont URL ?folderId= ↔ liste « Mes transcriptions » (JS inline Webflow)
//
// CONTEXTE
// La nav latérale (Code-sidebar-folders.js) pointe vers …/mes-transcripts?folderId=…
// La liste des jobs utilise en général une variable locale __selectedFolderFilter + folderQuerySuffix().
// Ce fichier ne peut pas lire cette variable : il faut exposer 2 hooks depuis le MÊME bloc script Webflow
// que loadJobs (juste après function loadJobs(){ … } ou en fin de mainScriptExecution) :
//
//   window.__agiloMesTranscriptsApplyFolderFromUrl = function (rawFolderIdParam) {
//     var q = rawFolderIdParam;
//     if (q === null || q === undefined || q === '') { __selectedFolderFilter = 'all'; return; }
//     if (String(q) === '0') { __selectedFolderFilter = 'root'; return; }
//     var n = Number(q);
//     __selectedFolderFilter = (Number.isFinite(n) && n > 0) ? n : 'all';
//   };
//   window.__agiloMesTranscriptsReloadJobs = loadJobs;
//
// PUIS, avant le premier loadJobs() dans mainScriptExecution, ajouter :
//   if (window.__agiloMesTranscriptsApplyFolderFromUrl) {
//     window.__agiloMesTranscriptsApplyFolderFromUrl(new URLSearchParams(location.search).get('folderId'));
//   }
//
// CHARGEMENT Webflow (page Mes transcriptions uniquement, après le script liste + token) :
//   <script src="https://cdn.jsdelivr.net/gh/…/Code-mes-transcripts-folder-url-bridge.js"></script>
//
// CHECKBOX « ajouter à un dossier » (recommandation produit) :
// - API : moveTranscriptToFolder (ou équivalent doc Nicolas) après création / depuis la liste.
// - UX : menu dérouliant des dossiers + confirmation ; pas seulement une checkbox sans cible.
// - Phase 1 : filtre URL + liste ; phase 2 : action lot / ligne avec sélecteur dossier.

(function () {
  'use strict';

  function isMesTranscriptsPage() {
    return /\/mes-transcripts(\/|$)/.test(location.pathname || '');
  }

  function rawFolderIdFromLocation() {
    try {
      return new URLSearchParams(location.search || '').get('folderId');
    } catch (_) {
      return null;
    }
  }

  function syncFromUrl() {
    if (!isMesTranscriptsPage()) return;
    var apply = window.__agiloMesTranscriptsApplyFolderFromUrl;
    var reload = window.__agiloMesTranscriptsReloadJobs;
    if (typeof apply !== 'function' || typeof reload !== 'function') return;
    try {
      apply(rawFolderIdFromLocation());
      reload();
    } catch (e) {
      if (window.AGILO_DEBUG) console.warn('[agilo folder bridge]', e);
    }
  }

  function onNav() {
    syncFromUrl();
  }

  window.addEventListener('agilo:nav-folder-url-changed', onNav, { passive: true });
  window.addEventListener('popstate', onNav, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function tryLater() {
      var n = 0;
      var id = setInterval(function () {
        if (typeof window.__agiloMesTranscriptsReloadJobs === 'function' || ++n > 200) {
          clearInterval(id);
          syncFromUrl();
        }
      }, 100);
    }, { once: true });
  } else {
    var n2 = 0;
    var id2 = setInterval(function () {
      if (typeof window.__agiloMesTranscriptsReloadJobs === 'function' || ++n2 > 200) {
        clearInterval(id2);
        syncFromUrl();
      }
    }, 100);
  }
})();
