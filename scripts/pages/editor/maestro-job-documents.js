/**
 * maestro-job-documents.js
 * Trombone « Documents joints » sur la ligne du titre de l’enregistrement.
 * Noms via getJobContext. Originaux via getJobContextFiles.
 * Rien à afficher si le fichier n’a pas de documents.
 */
(function (w) {
  'use strict';

  if (w.__agiloJobDocuments) return;
  w.__agiloJobDocuments = true;

  var API_CONTEXT = 'https://api.agilotext.com/api/v1/getJobContext';
  var API_FILES = 'https://api.agilotext.com/api/v1/getJobContextFiles';
  var PAPERCLIP = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18" aria-hidden="true" fill="none"><path d="M7.75,5v6.75c0,.828,.672,1.5,1.5,1.5h0c.828,0,1.5-.672,1.5-1.5V4.75c0-1.657-1.343-3-3-3h0c-1.657,0-3,1.343-3,3v7c0,2.485,2.015,4.5,4.5,4.5h0c2.485,0,4.5-2.015,4.5-4.5V5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"></path></svg>';

  function namesFromJobContext(data) {
    var analysis = (data && data.analysis) || {};
    var list = analysis.documents || [];
    if (!Array.isArray(list)) return [];
    return list.map(function (d) {
      if (!d) return '';
      if (typeof d === 'string') return d.trim();
      return String(d.filename || d.fileName || d.name || '').trim();
    }).filter(Boolean);
  }

  function jobIdFromLocation() {
    try {
      var q = new URLSearchParams(w.location.search);
      return q.get('jobId') || q.get('jobid') || '';
    } catch (e) {
      return '';
    }
  }

  function editionFromLocation() {
    try {
      var q = new URLSearchParams(w.location.search);
      return (q.get('edition') || localStorage.getItem('agilo:edition') || 'ent').toLowerCase();
    } catch (e) {
      return 'ent';
    }
  }

  function readEmail() {
    var el = document.querySelector('input[name="memberEmail"]') ||
      document.getElementById('memberEmail') ||
      document.querySelector('[data-ms-member="email"]');
    var fromEl = '';
    if (el) {
      fromEl = (el.value || el.getAttribute('value') || el.textContent || '').trim();
    }
    if (fromEl) return fromEl;
    if (w.memberEmail && String(w.memberEmail).trim()) return String(w.memberEmail).trim();
    try {
      return (localStorage.getItem('agilo:username') || '').trim();
    } catch (e) {
      return '';
    }
  }

  function readToken(email, edition) {
    if (w.globalToken) return String(w.globalToken);
    try {
      var key = 'agilo:token:' + String(edition || 'ent').toLowerCase() + ':' + String(email || '').toLowerCase();
      return localStorage.getItem(key) || localStorage.getItem('agilo:token') || '';
    } catch (e) {
      return '';
    }
  }

  function waitForAuth(ms) {
    return new Promise(function (resolve) {
      var email = readEmail();
      var edition = editionFromLocation();
      var token = readToken(email, edition);
      if (email && token) {
        resolve({ username: email, token: token, edition: edition });
        return;
      }
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        email = readEmail();
        token = readToken(email, edition);
        resolve(email && token ? { username: email, token: token, edition: edition } : null);
      }, ms);
      w.addEventListener('agilo:token', function (e) {
        if (done) return;
        var d = (e && e.detail) || {};
        if (!d.token) return;
        done = true;
        clearTimeout(timer);
        resolve({
          username: d.email || readEmail(),
          token: d.token,
          edition: String(d.edition || edition)
        });
      }, { once: true });
    });
  }

  function waitForTitleWrap(ms) {
    return new Promise(function (resolve) {
      var found = document.querySelector('.ed-title-wrap');
      if (found) {
        resolve(found);
        return;
      }
      var start = Date.now();
      var timer = setInterval(function () {
        var el = document.querySelector('.ed-title-wrap');
        if (el) {
          clearInterval(timer);
          resolve(el);
          return;
        }
        if (Date.now() - start >= ms) {
          clearInterval(timer);
          resolve(null);
        }
      }, 200);
    });
  }

  function postForm(url, auth, jobId) {
    var body = new URLSearchParams();
    body.set('username', auth.username);
    body.set('token', auth.token);
    body.set('jobId', String(jobId));
    body.set('edition', auth.edition || 'ent');
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
  }

  function ancestorClips(el) {
    var node = el && el.parentElement;
    while (node && node !== document.documentElement) {
      var style = w.getComputedStyle(node);
      var overflow = style.overflow + style.overflowX + style.overflowY;
      if (/auto|hidden|scroll|clip/.test(overflow)) return true;
      node = node.parentElement;
    }
    return false;
  }

  function ensureStyle() {
    if (document.getElementById('maestro-job-documents-style')) return;
    var style = document.createElement('style');
    style.id = 'maestro-job-documents-style';
    style.textContent = [
      '#maestro-job-documents{position:relative;display:inline-flex;align-items:center;flex:0 0 auto;margin-left:4px;vertical-align:middle;}',
      '#maestro-job-documents-btn{position:relative;width:28px;height:28px;padding:0;border:0;border-radius:6px;background:transparent;color:#020202;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;}',
      '#maestro-job-documents-btn:hover{background:#f3f4f6;}',
      '#maestro-job-documents-btn:focus-visible{outline:2px solid #174a96;outline-offset:1px;}',
      '#maestro-job-documents-count{position:absolute;right:1px;bottom:1px;font-size:10px;line-height:1;color:#525252;background:transparent;pointer-events:none;}',
      '#maestro-job-documents-panel{position:absolute;top:calc(100% + 6px);right:0;z-index:120;width:min(280px,calc(100vw - 16px));box-sizing:border-box;background:#fff;color:#020202;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12);padding:10px 12px;font-size:13px;line-height:1.4;}',
      '#maestro-job-documents-panel[hidden]{display:none;}',
      '#maestro-job-documents-panel h2{margin:0;font-size:13px;font-weight:600;}',
      '#maestro-job-documents-list{max-height:7em;overflow:auto;margin:6px 0 0;padding:0;}',
      '#maestro-job-documents-list div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '#maestro-job-documents-error{margin:6px 0 0;color:#525252;}',
      '#maestro-job-documents-download{margin-top:8px;background:none;border:0;padding:0;color:#174a96;font-weight:600;cursor:pointer;text-align:left;}',
      '#maestro-job-documents-download:disabled{opacity:.6;cursor:default;}'
    ].join('');
    document.head.appendChild(style);
  }

  function placePanel(wrap, btn, panel) {
    if (panel.hidden) return;
    if (ancestorClips(wrap)) {
      var rect = btn.getBoundingClientRect();
      var width = Math.min(280, w.innerWidth - 16);
      var left = Math.max(8, Math.min(rect.right - width, w.innerWidth - width - 8));
      panel.style.position = 'fixed';
      panel.style.top = (rect.bottom + 6) + 'px';
      panel.style.left = left + 'px';
      panel.style.right = 'auto';
      panel.style.width = width + 'px';
      panel.style.zIndex = '120';
      return;
    }
    panel.style.position = '';
    panel.style.top = '';
    panel.style.left = '';
    panel.style.right = '';
    panel.style.width = '';
  }

  function mountChip(host, names, auth, jobId) {
    var existing = document.getElementById('maestro-job-documents');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    if (!names.length || !host) return;

    ensureStyle();
    var label = 'Documents joints, ' + names.length;
    var wrap = document.createElement('span');
    wrap.id = 'maestro-job-documents';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'maestro-job-documents-btn';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'maestro-job-documents-panel');
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.innerHTML = PAPERCLIP;
    var count = document.createElement('span');
    count.id = 'maestro-job-documents-count';
    count.setAttribute('aria-hidden', 'true');
    count.textContent = String(names.length);
    btn.appendChild(count);

    var panel = document.createElement('div');
    panel.id = 'maestro-job-documents-panel';
    panel.hidden = true;
    var title = document.createElement('h2');
    title.textContent = 'Documents joints';
    panel.appendChild(title);
    var list = document.createElement('div');
    list.id = 'maestro-job-documents-list';
    names.forEach(function (name) {
      var row = document.createElement('div');
      row.textContent = name;
      row.title = name;
      list.appendChild(row);
    });
    panel.appendChild(list);
    var error = document.createElement('div');
    error.id = 'maestro-job-documents-error';
    panel.appendChild(error);
    var link = document.createElement('button');
    link.type = 'button';
    link.id = 'maestro-job-documents-download';
    link.textContent = 'Télécharger les originaux';

    function setOpen(open) {
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) placePanel(wrap, btn, panel);
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(panel.hidden);
    });
    panel.addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });
    w.addEventListener('resize', function () { placePanel(wrap, btn, panel); });
    w.addEventListener('scroll', function () { placePanel(wrap, btn, panel); }, true);

    link.addEventListener('click', function (e) {
      e.stopPropagation();
      error.textContent = '';
      link.disabled = true;
      postForm(API_FILES, auth, jobId).then(function (res) {
        var type = (res.headers.get('content-type') || '').toLowerCase();
        if (!res.ok || type.indexOf('json') !== -1 || type.indexOf('text') !== -1) {
          error.textContent = 'Les originaux ne sont pas disponibles.';
          link.disabled = false;
          return null;
        }
        return res.blob();
      }).then(function (blob) {
        if (!blob) return;
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'documents-' + jobId + '.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        link.disabled = false;
      }).catch(function () {
        error.textContent = 'Les originaux ne sont pas disponibles.';
        link.disabled = false;
      });
    });
    panel.appendChild(link);

    wrap.appendChild(btn);
    wrap.appendChild(panel);
    var rename = host.querySelector('.ed-rename');
    if (rename) host.insertBefore(wrap, rename.nextSibling);
    else host.appendChild(wrap);
  }

  function boot() {
    var jobId = jobIdFromLocation();
    if (!jobId) return;
    waitForAuth(8000).then(function (auth) {
      if (!auth) return;
      return postForm(API_CONTEXT, auth, jobId).then(function (res) {
        return res.json().catch(function () { return null; }).then(function (data) {
          if (!res.ok || !data || data.status !== 'OK') return;
          var names = namesFromJobContext(data);
          if (!names.length) return;
          return waitForTitleWrap(4000).then(function (host) {
            mountChip(host, names, auth, jobId);
          });
        });
      });
    }).catch(function () { /* pas de bouton si la lecture échoue */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
