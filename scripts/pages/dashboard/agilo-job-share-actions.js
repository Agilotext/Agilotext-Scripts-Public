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

  var NUCLEO_EMAIL_SVG =
    '<svg class="agilo-ico-email" viewBox="0 0 18 18" width="1.125rem" height="1.125rem" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="2" y="3.5" width="14" height="11" rx="2"/>' +
    '<polyline points="3 5.5 9 10 15 5.5"/>' +
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
      '  gap: 0.375rem !important;' +
      '  min-width: 6.5rem !important;' +
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
      '.agilo-row-share, .agilo-row-email {' +
      '  color: #6b7280 !important;' +
      '}' +
      '.agilo-row-share:hover:not(:disabled), .agilo-row-email:hover:not(:disabled) {' +
      '  color: #174a96 !important;' +
      '  background-color: #eff6ff !important;' +
      '}' +
      '.agilo-row-share:disabled, .agilo-row-share.is-disabled, .agilo-row-email:disabled, .agilo-row-email.is-disabled {' +
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
      shareBtn.innerHTML = NUCLEO_SHARE_SVG;

      if (deleteBtn) {
        cell.insertBefore(shareBtn, deleteBtn);
      } else {
        cell.appendChild(shareBtn);
      }
    }

    var emailBtn = cell.querySelector('.agilo-row-email');
    if (!emailBtn) {
      emailBtn = document.createElement('button');
      emailBtn.type = 'button';
      emailBtn.className = 'agilo-row-email agilo-action-btn';
      emailBtn.innerHTML = NUCLEO_EMAIL_SVG;

      if (deleteBtn) {
        cell.insertBefore(emailBtn, deleteBtn);
      } else {
        cell.appendChild(emailBtn);
      }
    }

    var ready = isJobReady(row);
    if (ready) {
      shareBtn.disabled = false;
      shareBtn.classList.remove('is-disabled');
      shareBtn.setAttribute('title', 'Copier le lien et ouvrir la vue partagée');
      shareBtn.setAttribute('aria-label', 'Copier le lien et ouvrir');

      emailBtn.disabled = false;
      emailBtn.classList.remove('is-disabled');
      emailBtn.setAttribute('title', 'Copier le message d’invitation et ouvrir l’e-mail');
      emailBtn.setAttribute('aria-label', 'Inviter par e-mail');
    } else {
      shareBtn.disabled = true;
      shareBtn.classList.add('is-disabled');
      shareBtn.setAttribute('title', 'Partage disponible lorsque la transcription est prête');
      shareBtn.setAttribute('aria-label', 'Partage indisponible');

      emailBtn.disabled = true;
      emailBtn.classList.add('is-disabled');
      emailBtn.setAttribute('title', 'Partage disponible lorsque la transcription est prête');
      emailBtn.setAttribute('aria-label', 'Partage indisponible');
    }
  }

  function scan() {
    injectStyles();
    updateHeader();
    document.querySelectorAll('.wrapper-content_item-row[data-job-id]').forEach(injectOnRow);
  }

  var shareUrlCache = {};

  async function getOrFetchShareUrl(jobId, auth) {
    if (shareUrlCache[jobId]) return shareUrlCache[jobId];
    var body = new URLSearchParams({
      username: auth.email,
      token: auth.token,
      edition: auth.edition,
      jobId: String(jobId)
    });
    var r = await fetch(API_BASE + '/guestRead/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || String(j.status || '').toUpperCase() !== 'OK' || !j.shareUrl) {
      throw new Error(j.errorMessage || 'Impossible de générer le lien de partage');
    }
    var viewUrl = sharePageUrlFromApi(j.shareUrl);
    if (!viewUrl) throw new Error('Lien de lecture invalide');
    shareUrlCache[jobId] = viewUrl;
    return viewUrl;
  }

  document.addEventListener('click', async function (ev) {
    var shareBtn = ev.target && ev.target.closest && ev.target.closest('.agilo-row-share');
    var emailBtn = ev.target && ev.target.closest && ev.target.closest('.agilo-row-email');
    var dupBtn = ev.target && ev.target.closest && ev.target.closest('.agilo-row-dup');
    if (!shareBtn && !emailBtn && !dupBtn) return;
    var row = (shareBtn || emailBtn || dupBtn).closest('.wrapper-content_item-row[data-job-id]');
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
      shareBtn.disabled = true;
      try {
        var viewUrl = await getOrFetchShareUrl(jobId, auth);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(viewUrl);
        } else {
          window.prompt('Copiez le lien de lecture', viewUrl);
        }
        window.open(viewUrl, '_blank');
        toast('Lien copié & page ouverte');
      } catch (e) {
        toast(e.message || 'Erreur réseau');
      } finally {
        shareBtn.disabled = false;
      }
      return;
    }

    if (emailBtn) {
      if (emailBtn.disabled) return;
      emailBtn.disabled = true;
      try {
        var shareUrl = await getOrFetchShareUrl(jobId, auth);
        var titleEl = row.querySelector('.wrapper-content_item-name, [data-aq="job-name"], .file-name');
        var audioTitle = (titleEl && (titleEl.value || titleEl.textContent) || 'votre enregistrement').trim();
        var msgText =
          'Bonjour,\n\n' +
          'Voici le lien pour accéder à la transcription de l\'enregistrement "' + audioTitle + '" :\n' +
          shareUrl + '\n\n' +
          'Bonne consultation,\n' +
          'Agilotext';

        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(msgText);
        }
        var mailtoUrl = 'mailto:?subject=' + encodeURIComponent('Transcription partagée : ' + audioTitle) +
          '&body=' + encodeURIComponent(msgText);
        window.location.href = mailtoUrl;
        toast('Message copié dans le presse-papier & e-mail ouvert');
      } catch (e2) {
        toast(e2.message || 'Erreur réseau');
      } finally {
        emailBtn.disabled = false;
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
