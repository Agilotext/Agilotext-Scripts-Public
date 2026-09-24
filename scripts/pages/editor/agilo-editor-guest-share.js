/* ================================================================
   AGILOTEXT — Éditeur staging : bouton Partager (guestRead 11.0.5)
   Pin sibling, ne pas recoller dans Code-ed-header.js (www @1.09).
   Export zip historique reste getSharedUrl + -download dans le header.
   ================================================================ */
(function () {
  'use strict';
  if (window.__agiloEditorGuestShare) return;
  window.__agiloEditorGuestShare = true;

  var API_BASE = 'https://api.agilotext.com/api/v1';

  function edition() {
    var q = '';
    try { q = new URLSearchParams(location.search).get('edition') || ''; } catch (_) { q = ''; }
    if (q) return String(q).toLowerCase();
    var p = location.pathname || '';
    if (p.indexOf('/app/free/') !== -1) return 'free';
    if (p.indexOf('/app/pro/') !== -1 || p.indexOf('/app/premium/') !== -1) return 'pro';
    return 'ent';
  }

  function jobId() {
    try {
      var fromQ = (new URLSearchParams(location.search).get('jobId') || '').trim();
      if (fromQ) return fromQ;
    } catch (_) { /* ignore */ }
    var root = document.getElementById('editorRoot');
    return (root && root.getAttribute('data-job-id')) || '';
  }

  function creds() {
    var emailEl = document.querySelector('[name="memberEmail"]');
    var email = (emailEl && (emailEl.value || emailEl.textContent) || '').trim();
    if (!email) {
      try { email = localStorage.getItem('agilo:username') || ''; } catch (_) { email = ''; }
    }
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

  function rewriteUrl(shareUrl) {
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

  function insertButton() {
    if (document.getElementById('agiloGuestShareBtn')) return true;
    var exportBtn = document.getElementById('exportBtn');
    if (!exportBtn || !exportBtn.parentNode) return false;
    var btn = document.createElement('button');
    btn.id = 'agiloGuestShareBtn';
    btn.type = 'button';
    btn.textContent = 'Partager';
    btn.className = exportBtn.className || 'agilo-btn';
    exportBtn.parentNode.insertBefore(btn, exportBtn);
    btn.addEventListener('click', onShare);
    return true;
  }

  async function onShare(ev) {
    if (ev) ev.preventDefault();
    var id = jobId();
    var auth = creds();
    if (!id) {
      toast('Fichier introuvable.');
      return;
    }
    if (!auth.email || !auth.token) {
      toast('Session indisponible. Rechargez la page.');
      return;
    }
    var body = new URLSearchParams({
      username: auth.email,
      token: auth.token,
      edition: auth.edition,
      jobId: String(id)
    });
    try {
      var r = await fetch(API_BASE + '/guestRead/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: body.toString(),
        credentials: 'omit'
      });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok || String(j.status || '').toUpperCase() !== 'OK' || !j.shareUrl) {
        toast(j.errorMessage || 'Impossible de générer le lien');
        return;
      }
      var viewUrl = rewriteUrl(j.shareUrl);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(viewUrl);
        toast(j.reused ? 'Lien de lecture copié (déjà créé)' : 'Lien de lecture copié');
      } else {
        window.prompt('Copiez le lien de lecture', viewUrl);
      }
    } catch (e) {
      toast(e.message || 'Erreur réseau');
    }
  }

  function boot() {
    if (insertButton()) return;
    var n = 0;
    var t = setInterval(function () {
      n += 1;
      if (insertButton() || n > 40) clearInterval(t);
    }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
