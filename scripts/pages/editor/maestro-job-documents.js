/**
 * maestro-job-documents.js
 * Ligne « Documents joints » sur l’enregistrement ouvert.
 * Noms via getJobContext. Originaux via getJobContextFiles.
 * Rien à afficher si le fichier n’a pas de documents.
 */
(function (w) {
  'use strict';

  var API_CONTEXT = 'https://api.agilotext.com/api/v1/getJobContext';
  var API_FILES = 'https://api.agilotext.com/api/v1/getJobContextFiles';

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

  function mountBar(names, auth, jobId) {
    var existing = document.getElementById('maestro-job-documents');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    if (!names.length) return;

    var bar = document.createElement('div');
    bar.id = 'maestro-job-documents';
    bar.setAttribute('role', 'status');
    bar.style.cssText = 'margin:12px 16px;padding:10px 12px;border-radius:8px;background:#e8f5e9;color:#1b5e20;font-size:14px;line-height:1.4;';

    var label = document.createElement('div');
    label.textContent = 'Documents joints';
    label.style.fontWeight = '600';
    bar.appendChild(label);

    var list = document.createElement('div');
    list.textContent = names.join(', ');
    list.style.marginTop = '4px';
    bar.appendChild(list);

    var link = document.createElement('button');
    link.type = 'button';
    link.textContent = 'Télécharger les originaux';
    link.style.cssText = 'margin-top:8px;background:none;border:0;padding:0;color:#174a96;font-weight:600;cursor:pointer;text-decoration:underline;';
    link.addEventListener('click', function () {
      link.disabled = true;
      postForm(API_FILES, auth, jobId).then(function (res) {
        var type = (res.headers.get('content-type') || '').toLowerCase();
        if (!res.ok || type.indexOf('json') !== -1 || type.indexOf('text') !== -1) {
          list.textContent = names.join(', ') + ' Les originaux ne sont pas disponibles.';
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
        list.textContent = names.join(', ') + ' Les originaux ne sont pas disponibles.';
        link.disabled = false;
      });
    });
    bar.appendChild(link);

    var host = document.querySelector('main') || document.body;
    if (host.firstChild) host.insertBefore(bar, host.firstChild);
    else host.appendChild(bar);
  }

  function boot() {
    var jobId = jobIdFromLocation();
    if (!jobId) return;
    waitForAuth(8000).then(function (auth) {
      if (!auth) return;
      return postForm(API_CONTEXT, auth, jobId).then(function (res) {
        return res.json().catch(function () { return null; }).then(function (data) {
          if (!res.ok || !data || data.status !== 'OK') return;
          mountBar(namesFromJobContext(data), auth, jobId);
        });
      });
    }).catch(function () { /* pas de ligne si la lecture échoue */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
