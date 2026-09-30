/* ================================================================
   AGILOTEXT — Mes transcripts : colonne Actions (Partager + Supprimer)
   Charger après logic-v2. Pin dédié jsDelivr.
   ================================================================ */
(function () {
  'use strict';
  if (window.__agiloJobShareActions) return;
  window.__agiloJobShareActions = true;

  var API_BASE = 'https://api.agilotext.com/api/v1';

  var NUCLEO_SHARE_SVG =
    '<svg class="agilo-ico-share" viewBox="0 0 18 18" width="1.125rem" height="1.125rem" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="13.5" cy="4.5" r="2.25"/>' +
    '<circle cx="4.5" cy="9" r="2.25"/>' +
    '<circle cx="13.5" cy="13.5" r="2.25"/>' +
    '<path d="M6.5 7.9l4.9-2.4M6.5 10.1l4.9 2.4"/>' +
    '</svg>';

  var NUCLEO_CHECK_SVG =
    '<svg class="agilo-ico-check" viewBox="0 0 18 18" width="1.125rem" height="1.125rem" fill="none" stroke="#15803d" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:none;">' +
    '<polyline points="2.75 9.25 6.75 14.25 15.25 3.75"/>' +
    '</svg>';

  var CSS_INJECTED = false;
  function injectStyles() {
    if (CSS_INJECTED || document.getElementById('agilo-actions-column-styles')) return;
    CSS_INJECTED = true;
    var st = document.createElement('style');
    st.id = 'agilo-actions-column-styles';
    st.textContent =
      '.agilo-actions-cell {' +
      '  display: flex !important;' +
      '  align-items: center !important;' +
      '  justify-content: center !important;' +
      '  gap: 0.5rem !important;' +
      '  min-width: 4.75rem !important;' +
      '  white-space: nowrap !important;' +
      '  flex-shrink: 0 !important;' +
      '}' +
      '.agilo-action-btn {' +
      '  display: inline-flex !important;' +
      '  align-items: center !important;' +
      '  justify-content: center !important;' +
      '  width: 1.875rem !important;' +
      '  height: 1.875rem !important;' +
      '  padding: 0 !important;' +
      '  background: transparent !important;' +
      '  border: none !important;' +
      '  border-radius: 0.375rem !important;' +
      '  cursor: pointer !important;' +
      '  transition: all 0.15s ease-in-out !important;' +
      '  line-height: 1 !important;' +
      '  box-sizing: border-box !important;' +
      '}' +
      '.agilo-action-btn:hover:not(:disabled) {' +
      '  background-color: #f3f4f6 !important;' +
      '}' +
      '.agilo-row-share {' +
      '  color: #6b7280 !important;' +
      '}' +
      '.agilo-row-share:hover:not(:disabled) {' +
      '  color: #174a96 !important;' +
      '  background-color: #eff6ff !important;' +
      '}' +
      '.agilo-row-share.is-copied {' +
      '  color: #15803d !important;' +
      '  background-color: #f0fdf4 !important;' +
      '}' +
      '.agilo-row-share:disabled, .agilo-row-share.is-disabled {' +
      '  opacity: 0.35 !important;' +
      '  cursor: not-allowed !important;' +
      '  pointer-events: none !important;' +
      '}' +
      '.delete-job-button_to-confirm, .delete-job-button {' +
      '  color: #991b1b !important;' +
      '}' +
      '.delete-job-button_to-confirm:hover:not(:disabled), .delete-job-button:hover:not(:disabled) {' +
      '  color: #dc2626 !important;' +
      '  background-color: #fef2f2 !important;' +
      '}' +
      '.agilo-action-btn svg {' +
      '  width: 1.125rem !important;' +
      '  height: 1.125rem !important;' +
      '  display: block !important;' +
      '}';
    document.head.appendChild(st);
  }

  function edition() {
    if (typeof window.agiloBulkApiEdition === 'function') return window.agiloBulkApiEdition();
    var p = window.location.pathname || '';
    if (p.indexOf('/app/free/') !== -1) return 'free';
    if (p.indexOf('/app/pro/') !== -1 || p.indexOf('/app/premium/') !== -1) return 'pro';
    return 'ent';
  }

  function creds() {
    var emailEl = document.querySelector('[name="memberEmail"]');
    var email = (emailEl && (emailEl.value || emailEl.textContent) || '').trim();
    var token = (typeof window.globalToken !== 'undefined' && window.globalToken) ? window.globalToken : '';
    return { email: email, token: token, edition: edition() };
  }

  function toast(msg) {
    var el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:20px;bottom:20px;z-index:999999;background:#111;color:#fff;padding:9px 14px;border-radius:6px;max-width:92vw;box-shadow:0 4px 12px rgba(0,0,0,0.15);font-size:13px;';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 3200);
  }

  function sharePageUrlFromApi(shareUrl) {
    var raw = String(shareUrl || '').trim();
    if (!raw) return '';
    if (window.AgiloShareUrl && window.AgiloShareUrl.rewriteSharePageOrigin) {
      return window.AgiloShareUrl.rewriteSharePageOrigin(raw, location.hostname) || raw;
    }
    if (/agilotext-test\.webflow\.io/i.test(location.hostname)) {
      return raw.replace(/^https:\/\/www\.agilotext\.com/i, 'https://agilotext-test.webflow.io');
    }
    return raw;
  }

  function updateHeader() {
    var table = document.querySelector('.wrapper-content_table');
    if (!table) return;
    var candidates = table.querySelectorAll('.wrapper-content_item:not(.wrapper-content_item-row) .custom-element, .transcript-header .custom-element');
    candidates.forEach(function (el) {
      var txt = (el.textContent || '').trim();
      if (txt === 'Supprimer') {
        var d = el.querySelector('div') || el;
        d.textContent = 'Actions';
        el.setAttribute('title', 'Actions rapides');
      }
    });
  }

  function isJobReady(row) {
    var inprog = row.querySelector('.icon-inprogress');
    if (inprog && window.getComputedStyle(inprog).display !== 'none') return false;
    var err = row.querySelector('.icon-error');
    if (err && window.getComputedStyle(err).display !== 'none') return false;
    return true;
  }

  function injectOnRow(row) {
    if (!row || !row.getAttribute('data-job-id')) return;

    var deleteBtn = row.querySelector('.delete-job-button_to-confirm, .delete-job-button');
    var cell = deleteBtn ? deleteBtn.parentElement : (row.querySelector('.custom-element.trash') || row.lastElementChild);
    if (!cell) return;

    cell.classList.add('agilo-actions-cell');

    if (deleteBtn) {
      deleteBtn.classList.add('agilo-action-btn');
      if (!deleteBtn.getAttribute('title')) deleteBtn.setAttribute('title', 'Supprimer');
      if (!deleteBtn.getAttribute('aria-label')) deleteBtn.setAttribute('aria-label', 'Supprimer');
    }

    var shareBtn = cell.querySelector('.agilo-row-share');
    if (!shareBtn) {
      shareBtn = document.createElement('button');
      shareBtn.type = 'button';
      shareBtn.className = 'agilo-row-share agilo-action-btn';
      shareBtn.innerHTML = NUCLEO_SHARE_SVG + NUCLEO_CHECK_SVG;

      if (deleteBtn) {
        cell.insertBefore(shareBtn, deleteBtn);
      } else {
        cell.appendChild(shareBtn);
      }
    }

    if (isJobReady(row)) {
      shareBtn.disabled = false;
      shareBtn.classList.remove('is-disabled');
      shareBtn.setAttribute('title', 'Partager la transcription');
      shareBtn.setAttribute('aria-label', 'Partager la transcription');
    } else {
      shareBtn.disabled = true;
      shareBtn.classList.add('is-disabled');
      shareBtn.setAttribute('title', 'Partage disponible lorsque la transcription est prête');
      shareBtn.setAttribute('aria-label', 'Partage indisponible');
    }
  }

  function scan() {
    injectStyles();
    updateHeader();
    document.querySelectorAll('.wrapper-content_item-row[data-job-id]').forEach(injectOnRow);
  }

  document.addEventListener('click', async function (ev) {
    var shareBtn = ev.target && ev.target.closest && ev.target.closest('.agilo-row-share');
    var dupBtn = ev.target && ev.target.closest && ev.target.closest('.agilo-row-dup');
    if (!shareBtn && !dupBtn) return;
    var row = (shareBtn || dupBtn).closest('.wrapper-content_item-row[data-job-id]');
    if (!row) return;
    ev.preventDefault();
    ev.stopPropagation();

    var jobId = row.getAttribute('data-job-id');
    var auth = creds();
    if (!auth.email || !auth.token) {
      toast('Session indisponible. Rechargez la page.');
      return;
    }

    if (shareBtn) {
      if (shareBtn.disabled) return;
      var icoShare = shareBtn.querySelector('.agilo-ico-share');
      var icoCheck = shareBtn.querySelector('.agilo-ico-check');

      shareBtn.disabled = true;
      var body = new URLSearchParams({ username: auth.email, token: auth.token, edition: auth.edition, jobId: String(jobId) });
      try {
        var r = await fetch(API_BASE + '/guestRead/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString()
        });
        var j = await r.json().catch(function () { return {}; });
        if (!r.ok || String(j.status || '').toUpperCase() !== 'OK' || !j.shareUrl) {
          toast(j.errorMessage || 'Impossible de générer le lien');
          shareBtn.disabled = false;
          return;
        }
        var viewUrl = sharePageUrlFromApi(j.shareUrl);
        if (!viewUrl) {
          toast('Lien de lecture invalide');
          shareBtn.disabled = false;
          return;
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(viewUrl);
        } else {
          window.prompt('Copiez le lien de lecture', viewUrl);
        }

        toast('Lien de lecture copié');
        shareBtn.classList.add('is-copied');
        if (icoShare) icoShare.style.display = 'none';
        if (icoCheck) icoCheck.style.display = 'block';

        setTimeout(function () {
          shareBtn.classList.remove('is-copied');
          if (icoShare) icoShare.style.display = 'block';
          if (icoCheck) icoCheck.style.display = 'none';
          shareBtn.disabled = false;
        }, 2000);

      } catch (e) {
        toast(e.message || 'Erreur réseau');
        shareBtn.disabled = false;
      }
      return;
    }

    if (dupBtn) {
      var email = window.prompt('Email du compte Agilotext du collègue');
      if (email == null) return;
      email = String(email).trim();
      if (!email || email.indexOf('@') === -1) {
        toast('Email invalide');
        return;
      }
      var dupBody = new URLSearchParams({
        username: auth.email,
        token: auth.token,
        edition: auth.edition,
        jobId: String(jobId),
        targetEmail: email
      });
      try {
        var dr = await fetch(API_BASE + '/duplicateJobToUser', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
          body: dupBody.toString()
        });
        var dj = await dr.json().catch(function () { return {}; });
        if (dr.status === 404) {
          toast('Fonction en cours de déploiement. Le transfert vers un collègue arrive bientôt.');
          return;
        }
        if (dr.ok && dj.status === 'OK') {
          toast(dj.audioCopied ? 'Copie envoyée (avec audio)' : 'Copie envoyée (texte et compte rendu)');
          return;
        }
        if (dj.errorMessage === 'error_target_user_not_found') {
          toast('Aucun compte Agilotext pour cet email.');
          return;
        }
        toast(dj.userErrorMessage || dj.errorMessage || 'Impossible d’envoyer la copie');
      } catch (e2) {
        toast(e2.message || 'Erreur réseau');
      }
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan, { once: true });
  } else {
    scan();
  }

  var root = document.getElementById('jobs-container') || document.body;
  if (root && window.MutationObserver) {
    var t = null;
    new MutationObserver(function () {
      clearTimeout(t);
      t = setTimeout(scan, 80);
    }).observe(root, { childList: true, subtree: true });
  }
})();
