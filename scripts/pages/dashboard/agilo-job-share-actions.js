/* ================================================================
   AGILOTEXT — Mes transcripts : partager un lien + copie vers un collègue
   Charger après logic-v2 (optionnel). Pin dédié, ne pas mélanger avec bulk v2.
   ================================================================ */
(function () {
  'use strict';
  if (window.__agiloJobShareActions) return;
  window.__agiloJobShareActions = true;

  var API_BASE = 'https://api.agilotext.com/api/v1';

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
    el.style.cssText = 'position:fixed;left:20px;bottom:20px;z-index:999999;background:#111;color:#fff;padding:9px 14px;border-radius:6px;max-width:92vw';
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

  function injectOnRow(row) {
    if (!row || row.getAttribute('data-agilo-share-actions') === '1') return;
    if (!row.getAttribute('data-job-id')) return;
    row.setAttribute('data-agilo-share-actions', '1');

    var host = row.querySelector('.custom-element.titles') || row;
    var wrap = document.createElement('div');
    wrap.className = 'agilo-row-share-actions';
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:4px';
    wrap.innerHTML =
      '<button type="button" class="agilo-row-share" style="font-size:11px;padding:3px 8px;border:1px solid #d1d5db;background:#fff;border-radius:4px;cursor:pointer">Partager</button>' +
      '<button type="button" class="agilo-row-dup" style="font-size:11px;padding:3px 8px;border:1px solid #d1d5db;background:#fff;border-radius:4px;cursor:pointer">Copie collègue</button>';
    host.appendChild(wrap);
  }

  function scan() {
    document.querySelectorAll('.wrapper-content_item-row[data-job-id]').forEach(injectOnRow);
  }

  document.addEventListener('click', async function (ev) {
    var shareBtn = ev.target && ev.target.closest && ev.target.closest('.agilo-row-share');
    var dupBtn = ev.target && ev.target.closest && ev.target.closest('.agilo-row-dup');
    if (!shareBtn && !dupBtn) return;
    var row = (shareBtn || dupBtn).closest('.wrapper-content_item-row[data-job-id]');
    if (!row) return;
    ev.preventDefault();
    var jobId = row.getAttribute('data-job-id');
    var auth = creds();
    if (!auth.email || !auth.token) {
      toast('Session indisponible. Rechargez la page.');
      return;
    }

    if (shareBtn) {
      var body = new URLSearchParams({ username: auth.email, token: auth.token, edition: auth.edition, jobId: String(jobId) });
      try {
        var r = await fetch(API_BASE + '/guestRead/create', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
        var j = await r.json().catch(function () { return {}; });
        if (!r.ok || String(j.status || '').toUpperCase() !== 'OK' || !j.shareUrl) {
          toast(j.errorMessage || 'Impossible de générer le lien');
          return;
        }
        var viewUrl = sharePageUrlFromApi(j.shareUrl);
        if (!viewUrl) { toast('Lien de lecture invalide'); return; }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(viewUrl);
          toast('Lien de lecture copié');
        } else {
          window.prompt('Copiez le lien de lecture', viewUrl);
        }
      } catch (e) {
        toast(e.message || 'Erreur réseau');
      }
      return;
    }

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
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan, { once: true });
  } else {
    scan();
  }
  var root = document.getElementById('jobs-container');
  if (root && window.MutationObserver) {
    var t = null;
    new MutationObserver(function () {
      clearTimeout(t);
      t = setTimeout(scan, 80);
    }).observe(root, { childList: true, subtree: true });
  }
})();
