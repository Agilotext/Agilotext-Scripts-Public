/**
 * maestro-context-ent.js — Agilotext Business / Maestro V1 B+
 * Branche Scripts-Public 1.10 (ne pas pousser sur @24cac26 / 1.09)
 *
 * Feature : « Joindre des documents » (polish v2)
 *   - Toggle injecté dans .options-wrapper
 *   - Drop dans #maestro-context-slot (avant .wrapper-pro) — ne décale pas les toggles
 *   - Doc #1 (primaire) → preAnalyze → contextId
 *   - Docs #2..N → addJobContextAttachment après upload (jamais preAnalyze — contrat API V1)
 *   - Tooltip ? immédiat (hover + tap)
 *
 * Auth = sendMultipleAudio : username + token + edition
 * Limites : PDF/DOCX/TXT, 20 Mo max
 */
(function (w) {
  'use strict';

  var CFG = w.AGILO_MAESTRO_CONTEXT || {};
  if (CFG.enabled === false) {
    w.AgiloMaestroContext = {
      enrichFormData: function (fd) { return Promise.resolve(fd); },
      hasActiveContext: function () { return false; },
      uploadAttachments: function () { return Promise.resolve({ ok: true, skipped: true }); }
    };
    return;
  }

  var MAX_BYTES = typeof CFG.maxBytes === 'number' ? CFG.maxBytes : 20 * 1024 * 1024;
  var MAX_DOCS = typeof CFG.maxDocs === 'number' ? CFG.maxDocs : 8;
  var EDITION = CFG.edition || 'ent';
  var ACCEPT_EXT = /\.(pdf|docx|txt)$/i;
  var PREF_KEY = 'agilo.maestro.contextBriefEnabled.' + EDITION;
  var TOOLTIP = 'Ajoutez un document (PDF, DOCX, TXT, 20 Mo) : ses noms et termes guident le compte rendu.';
  var LABEL_EMPTY = 'Glissez un PDF, DOCX ou TXT ou&nbsp;<span class="browse">Parcourir</span>';
  var LABEL_COMPACT = '+ Ajouter un document';
  var API_PREANALYZE = 'https://api.agilotext.com/api/v1/preAnalyzeContextDocument';
  var API_ATTACHMENT = 'https://api.agilotext.com/api/v1/addJobContextAttachment';

  /** @type {{ id: string, file: File, role: 'primary'|'extra', status: string, statusText: string, contextId: string|null, attachmentId: string|null }[]} */
  var docs = [];
  var state = {
    enabled: false,
    preAnalyzePromise: null,
    lastPreview: null,
    attachmentsUnavailable: false,
    attachmentsNote: ''
  };
  var uidSeq = 0;

  function readPref() {
    try {
      var v = w.localStorage && w.localStorage.getItem(PREF_KEY);
      if (v === '1' || v === 'true') return true;
      if (v === '0' || v === 'false') return false;
    } catch (e) { /* private mode */ }
    return false;
  }

  function writePref(on) {
    try {
      if (w.localStorage) w.localStorage.setItem(PREF_KEY, on ? '1' : '0');
    } catch (e) { /* ignore */ }
  }

  function $(id) { return document.getElementById(id); }

  function resolveMemberEmail() {
    var el = document.querySelector('input[name="memberEmail"]') ||
      document.getElementById('memberEmail') ||
      document.querySelector('[data-ms-member="email"]');
    if (el) {
      var v = (el.value || el.getAttribute('src') || el.getAttribute('data-src') ||
        el.textContent || '').trim();
      if (v) return v;
    }
    if (w.memberEmail && String(w.memberEmail).trim()) return String(w.memberEmail).trim();
    try {
      var stored = w.localStorage && w.localStorage.getItem('agilo:username');
      if (stored && String(stored).trim()) return String(stored).trim();
    } catch (e2) { /* ignore */ }
    return '';
  }

  function ensureTokenForEmail(email, forceRefresh) {
    if (typeof w.ensureValidToken === 'function') {
      return Promise.resolve(w.ensureValidToken(email, !!forceRefresh)).then(function (ok) {
        return !!(ok && w.globalToken);
      });
    }
    return Promise.resolve(!!w.globalToken);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Best-effort fix mojibake (ex. prÃªt → prêt) */
  function displayFileName(name) {
    var n = String(name || '');
    if (!/Ã.|Â./.test(n)) return n;
    try {
      var bytes = new Uint8Array(n.length);
      for (var i = 0; i < n.length; i++) bytes[i] = n.charCodeAt(i) & 0xff;
      var fixed = new TextDecoder('utf-8').decode(bytes);
      if (fixed && fixed.indexOf('\ufffd') === -1) return fixed;
    } catch (e1) { /* ignore */ }
    try {
      return decodeURIComponent(escape(n));
    } catch (e2) { /* keep original */ }
    return n;
  }

  function formatSize(bytes) {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '') + ' Mo';
    return Math.round(bytes / 1024) + ' Ko';
  }

  function primaryDoc() {
    for (var i = 0; i < docs.length; i++) {
      if (docs[i].role === 'primary') return docs[i];
    }
    return docs[0] || null;
  }

  function extraDocs() {
    return docs.filter(function (d) { return d.role === 'extra'; });
  }

  function syncDropMode() {
    var drop = $('maestro-context-drop');
    var label = $('maestro-context-drop-label');
    if (!drop || !label) return;
    if (docs.length) {
      drop.classList.add('has-file', 'is-compact');
      label.innerHTML = LABEL_COMPACT;
    } else {
      drop.classList.remove('has-file', 'is-compact');
      label.innerHTML = LABEL_EMPTY;
    }
  }

  function syncBlockWidth() {
    var block = $('maestro-context-block');
    var slot = $('maestro-context-slot');
    var row = $('maestro-context-option-row');
    if (!block || block.hidden || !slot) return;

    // Slot ne contribue PAS à la largeur du parent (évite le saut des toggles)
    slot.style.width = '0';
    slot.style.maxWidth = '0';
    slot.style.minWidth = '0';
    slot.style.overflow = 'visible';
    slot.style.marginLeft = '0';
    slot.style.marginRight = '0';

    var pond = document.querySelector('.uploader .filepond--root') ||
      document.querySelector('.uploader');
    var wPx = pond ? pond.getBoundingClientRect().width : 0;
    if (wPx < 40) wPx = Math.min(640, (w.innerWidth || 800) - 32);
    wPx = Math.round(wPx);

    block.style.width = wPx + 'px';
    block.style.maxWidth = 'calc(100vw - 2rem)';
    block.style.position = 'relative';
    block.style.left = '0';
    block.style.right = 'auto';
    block.style.transform = 'none';
    block.style.marginRight = '0';

    // Centre le drop sur l’axe de la colonne options (pas sur le bord gauche)
    var anchor = (row && row.parentElement) || slot.parentElement;
    if (!anchor) {
      block.style.marginLeft = '0';
      return;
    }
    var anchorRect = anchor.getBoundingClientRect();
    var slotRect = slot.getBoundingClientRect();
    var centerX = anchorRect.left + anchorRect.width / 2;
    var targetLeft = centerX - wPx / 2;
    block.style.marginLeft = Math.round(targetLeft - slotRect.left) + 'px';
  }

  function forceSummaryOn() {
    var toggle = $('toggle-summary');
    if (toggle && !toggle.checked) {
      toggle.checked = true;
      try { toggle.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) { /* ignore */ }
    }
  }

  function validateFile(file) {
    if (!file) return 'Aucun fichier.';
    if (file.size > MAX_BYTES) return 'Fichier trop volumineux (max 20 Mo).';
    if (!ACCEPT_EXT.test(file.name || '')) return 'Formats acceptés : PDF, DOCX, TXT.';
    return null;
  }

  function renderChips(list, label, maxShow) {
    if (!list || !list.length) return '';
    var max = typeof maxShow === 'number' ? maxShow : 8;
    var shown = list.slice(0, max);
    var rest = list.length - shown.length;
    var chips = shown.map(function (t) {
      var labelText = typeof t === 'string' ? t : (t && (t.name || t.nom || t.label)) || String(t);
      return '<span class="maestro-chip">' + escapeHtml(String(labelText)) + '</span>';
    }).join('');
    if (rest > 0) {
      chips += '<span class="maestro-chip maestro-chip-more">+' + rest + '</span>';
    }
    return '<div><strong>' + escapeHtml(label) + '</strong><div class="maestro-chips">' + chips + '</div></div>';
  }

  function showPreviewHtml(html) {
    var preview = $('maestro-context-preview');
    if (!preview) return;
    if (!html) {
      preview.hidden = true;
      preview.innerHTML = '';
      return;
    }
    preview.innerHTML = html;
    preview.hidden = false;
  }

  function badgeHtml(d) {
    if (d.status === 'loading') {
      return '<div class="maestro-badge is-loading">' +
        '<span class="maestro-spinner" aria-hidden="true"></span>' +
        '<span>' + escapeHtml(d.statusText || 'Analyse…') + '</span></div>';
    }
    var cls = 'maestro-badge';
    if (d.status === 'ok') cls += ' is-ok';
    else if (d.status === 'warn') cls += ' is-warn';
    else if (d.status === 'fail') cls += ' is-fail';
    else cls += ' is-queued';
    return '<div class="' + cls + '">' + escapeHtml(d.statusText || '') + '</div>';
  }

  function renderDocList() {
    var list = $('maestro-doc-list');
    if (!list) return;
    if (!docs.length) {
      list.hidden = true;
      list.innerHTML = '';
      syncDropMode();
      syncBlockWidth();
      return;
    }
    list.hidden = false;
    list.innerHTML = docs.map(function (d) {
      var actions = '';
      if (d.role === 'primary') {
        actions =
          '<button type="button" class="maestro-doc-btn" data-maestro-action="replace" data-id="' + d.id + '">Remplacer</button>' +
          '<button type="button" class="maestro-doc-btn" data-maestro-action="remove" data-id="' + d.id + '">Retirer</button>';
      } else {
        actions =
          '<button type="button" class="maestro-doc-btn" data-maestro-action="remove" data-id="' + d.id + '">Retirer</button>';
      }

      return (
        '<li class="maestro-doc-item" data-id="' + d.id + '">' +
          '<div class="maestro-doc-meta">' +
            '<div class="maestro-doc-line1">' +
              '<span class="maestro-doc-name" title="' + escapeHtml(displayFileName(d.file.name)) + '">' +
                escapeHtml(displayFileName(d.file.name)) +
              '</span>' +
              '<span class="maestro-doc-size">' + escapeHtml(formatSize(d.file.size)) + '</span>' +
            '</div>' +
            badgeHtml(d) +
          '</div>' +
          '<div class="maestro-doc-actions">' + actions + '</div>' +
        '</li>'
      );
    }).join('');

    if (state.attachmentsNote) {
      list.insertAdjacentHTML('beforeend',
        '<li class="maestro-doc-item"><p class="maestro-preview-warn">' +
        escapeHtml(state.attachmentsNote) + '</p></li>');
    }
    syncDropMode();
    syncBlockWidth();
  }

  function setDocStatus(id, status, text) {
    for (var i = 0; i < docs.length; i++) {
      if (docs[i].id === id) {
        docs[i].status = status;
        docs[i].statusText = text || '';
        break;
      }
    }
    renderDocList();
  }

  function clearAllDocs() {
    docs = [];
    state.preAnalyzePromise = null;
    state.lastPreview = null;
    state.attachmentsNote = '';
    var input = $('maestro-context-file');
    if (input) input.value = '';
    renderDocList();
    showPreviewHtml('');
  }

  function removeDoc(id) {
    var wasPrimary = false;
    docs = docs.filter(function (d) {
      if (d.id === id) {
        wasPrimary = d.role === 'primary';
        return false;
      }
      return true;
    });
    if (wasPrimary && docs.length) {
      docs[0].role = 'primary';
      docs[0].status = 'loading';
      docs[0].statusText = 'Analyse…';
      docs[0].contextId = null;
      state.preAnalyzePromise = runPreAnalyze(docs[0]);
    } else if (!docs.length) {
      state.preAnalyzePromise = null;
      state.lastPreview = null;
      showPreviewHtml('');
    } else if (wasPrimary) {
      showPreviewHtml('');
    }
    renderDocList();
  }

  function applyPreviewSuccess(doc, data) {
    doc.contextId = data.contextId || data.contextDocumentId || null;
    state.lastPreview = data;
    doc.status = 'ok';
    doc.statusText = 'Analysé';
    renderDocList();

    var participants = data.participants || data.participantNames || [];
    var terms = data.terms || data.wordBoost || data.keywords || data.wordBoostCandidates || [];
    var parts = [];
    if (participants.length) parts.push(renderChips(participants, 'Participants', 8));
    if (terms.length) parts.push(renderChips(terms, 'Termes', 6));
    if (!parts.length && data.summary) {
      parts.push('<p class="text-color-grey">' + escapeHtml(String(data.summary).slice(0, 220)) + '</p>');
    }
    if (!parts.length) {
      showPreviewHtml('');
      return doc.contextId;
    }
    showPreviewHtml(
      '<details class="maestro-preview-details">' +
        '<summary>Aperçu (non modifiable)</summary>' +
        '<div class="maestro-preview-body">' + parts.join('') + '</div>' +
      '</details>'
    );
    return doc.contextId;
  }

  function isInvalidTokenError(data, res) {
    if (!data && res && res.status === 401) return true;
    var msg = String(
      (data && (data.errorMessage || data.userErrorMessage || data.message || data.error)) || ''
    ).toLowerCase();
    return msg.indexOf('invalid_token') !== -1 || msg.indexOf('invalid token') !== -1 ||
      msg.indexOf('error_invalid_token') !== -1;
  }

  function postPreAnalyze(file, email, token) {
    var fd = new FormData();
    fd.append('username', email);
    fd.append('token', token);
    fd.append('edition', EDITION);
    fd.append('contextFile', file, file.name);
    console.log('[MaestroContext] preAnalyze', { username: email, hasToken: !!token, edition: EDITION });
    return fetch(API_PREANALYZE, { method: 'POST', body: fd }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        return { res: res, data: data };
      });
    });
  }

  function runPreAnalyze(doc) {
    var email = resolveMemberEmail();
    if (!email) {
      setDocStatus(doc.id, 'warn', 'Email introuvable — joint à l’envoi');
      return Promise.resolve(null);
    }

    setDocStatus(doc.id, 'loading', 'Analyse…');

    return ensureTokenForEmail(email, false).then(function (ok) {
      var token = w.globalToken;
      if (!ok || !token) {
        setDocStatus(doc.id, 'warn', 'Connectez-vous — joint à l’envoi');
        return null;
      }

      function handleResult(result, canRetry) {
        var res = result.res;
        var data = result.data;

        if (canRetry && isInvalidTokenError(data, res)) {
          return ensureTokenForEmail(email, true).then(function (ok2) {
            var token2 = w.globalToken;
            if (!ok2 || !token2) {
              setDocStatus(doc.id, 'warn', 'Session expirée — joint à l’envoi');
              return null;
            }
            return postPreAnalyze(doc.file, email, token2).then(function (r2) {
              return handleResult(r2, false);
            });
          });
        }

        if (!res.ok || !data || data.status !== 'OK') {
          var msg = (data && (data.userErrorMessage || data.errorMessage || data.message)) ||
            'Analyse impossible — joint à l’envoi';
          setDocStatus(doc.id, 'warn', msg);
          showPreviewHtml('<p class="maestro-preview-warn">' + escapeHtml(msg) + '</p>');
          return null;
        }
        return applyPreviewSuccess(doc, data);
      }

      return postPreAnalyze(doc.file, email, token).then(function (result) {
        return handleResult(result, true);
      }).catch(function () {
        setDocStatus(doc.id, 'warn', 'Réseau indisponible — joint à l’envoi');
        return null;
      });
    });
  }

  // Docs #2..N : jamais preAnalyze (contrat API V1 — 1 contextId primaire)
  function addFiles(fileList) {
    var arr = Array.prototype.slice.call(fileList || []);
    if (!arr.length) return;

    var errors = [];
    arr.forEach(function (file) {
      var err = validateFile(file);
      if (err) {
        errors.push(displayFileName(file.name) + ' : ' + err);
        return;
      }
      if (docs.length >= MAX_DOCS) {
        errors.push('Maximum ' + MAX_DOCS + ' documents.');
        return;
      }
      var role = docs.length === 0 ? 'primary' : 'extra';
      var entry = {
        id: 'd' + (++uidSeq),
        file: file,
        role: role,
        status: role === 'primary' ? 'loading' : 'queued',
        statusText: role === 'primary' ? 'Analyse…' : 'Joint à l’envoi',
        contextId: null,
        attachmentId: null
      };
      docs.push(entry);
      if (role === 'primary') {
        forceSummaryOn();
        state.preAnalyzePromise = runPreAnalyze(entry);
      }
    });

    renderDocList();
    if (errors.length) {
      showPreviewHtml('<p class="maestro-preview-fail">' + escapeHtml(errors.join(' · ')) + '</p>');
    }
  }

  function replacePrimary() {
    var input = $('maestro-context-file');
    if (!input) return;
    input.value = '';
    var prevMultiple = input.multiple;
    input.multiple = false;
    function onChange() {
      input.removeEventListener('change', onChange);
      input.multiple = prevMultiple;
      if (input.files && input.files[0]) {
        var file = input.files[0];
        var err = validateFile(file);
        if (err) {
          showPreviewHtml('<p class="maestro-preview-fail">' + escapeHtml(err) + '</p>');
          return;
        }
        var old = primaryDoc();
        if (old) {
          docs = docs.filter(function (d) { return d.id !== old.id; });
        }
        var entry = {
          id: 'd' + (++uidSeq),
          file: file,
          role: 'primary',
          status: 'loading',
          statusText: 'Analyse…',
          contextId: null,
          attachmentId: null
        };
        docs.unshift(entry);
        for (var i = 1; i < docs.length; i++) {
          docs[i].role = 'extra';
          if (docs[i].status === 'ok' && !docs[i].contextId) {
            docs[i].status = 'queued';
            docs[i].statusText = 'Joint à l’envoi';
          }
        }
        forceSummaryOn();
        renderDocList();
        state.preAnalyzePromise = runPreAnalyze(entry);
        console.log('[MaestroContext] doc principal remplacé');
      }
    }
    input.addEventListener('change', onChange);
    input.click();
  }

  function waitPreAnalyze() {
    if (!state.preAnalyzePromise) return Promise.resolve(null);
    return state.preAnalyzePromise.then(function (id) { return id; }, function () { return null; });
  }

  function hasActiveContext() {
    return !!(state.enabled && docs.length > 0);
  }

  function enrichFormData(fd) {
    if (!hasActiveContext()) return Promise.resolve(fd);

    return waitPreAnalyze().then(function () {
      forceSummaryOn();
      try { fd.delete('doSummary'); } catch (e) { /* ignore */ }
      fd.append('doSummary', 'true');

      var prim = primaryDoc();
      if (!prim) return fd;

      if (prim.contextId) {
        try { fd.delete('contextId'); } catch (e1) { /* ignore */ }
        try { fd.delete('contextFile'); } catch (e2) { /* ignore */ }
        fd.append('contextId', prim.contextId);
      } else if (prim.file) {
        try { fd.delete('contextFile'); } catch (e3) { /* ignore */ }
        fd.append('contextFile', prim.file, prim.file.name);
      }
      return fd;
    });
  }

  function postAttachment(jobId, file, email, token) {
    var fd = new FormData();
    fd.append('username', email);
    fd.append('token', token);
    fd.append('edition', EDITION);
    fd.append('jobId', String(jobId));
    fd.append('attachmentType', 'context_document');
    fd.append('attachmentFile', file, file.name);
    return fetch(API_ATTACHMENT, { method: 'POST', body: fd }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        return { res: res, data: data };
      });
    });
  }

  function uploadAttachments(jobId) {
    var extras = extraDocs();
    if (!jobId || !extras.length) {
      return Promise.resolve({ ok: true, skipped: true });
    }
    if (state.attachmentsUnavailable) {
      state.attachmentsNote = 'Un seul document pris en compte pour l’instant (pièces jointes indisponibles).';
      renderDocList();
      return Promise.resolve({ ok: false, fallback: true });
    }

    var email = resolveMemberEmail();
    if (!email) {
      state.attachmentsNote = 'Pièces jointes non envoyées (email introuvable).';
      renderDocList();
      return Promise.resolve({ ok: false });
    }

    return ensureTokenForEmail(email, false).then(function (ok) {
      var token = w.globalToken;
      if (!ok || !token) {
        state.attachmentsNote = 'Pièces jointes non envoyées (session).';
        renderDocList();
        return { ok: false };
      }

      var chain = Promise.resolve({ ok: true, count: 0 });
      extras.forEach(function (doc) {
        chain = chain.then(function (acc) {
          if (acc.fallback) return acc;
          setDocStatus(doc.id, 'loading', 'Envoi…');
          return postAttachment(jobId, doc.file, email, token).then(function (result) {
            var res = result.res;
            var data = result.data;
            if (res && (res.status === 404 || res.status === 501)) {
              state.attachmentsUnavailable = true;
              state.attachmentsNote = 'Un seul document pris en compte pour l’instant.';
              setDocStatus(doc.id, 'warn', 'Non envoyé (route indisponible)');
              extras.forEach(function (d2) {
                if (d2.id !== doc.id) setDocStatus(d2.id, 'warn', 'Non envoyé');
              });
              renderDocList();
              return { ok: false, fallback: true, count: acc.count };
            }
            if (!res.ok || !data || (data.status && data.status !== 'OK')) {
              setDocStatus(doc.id, 'warn', 'Envoi échoué');
              return { ok: false, count: acc.count };
            }
            doc.attachmentId = (data.attachmentId != null) ? String(data.attachmentId) : 'ok';
            setDocStatus(doc.id, 'ok', 'Joint à l’envoi');
            return { ok: true, count: acc.count + 1 };
          }).catch(function () {
            setDocStatus(doc.id, 'warn', 'Envoi échoué');
            return { ok: false, count: acc.count };
          });
        });
      });
      return chain;
    });
  }

  function isFileTabActive() {
    var panel = $('panel-file');
    if (!panel) return true;
    if (panel.hidden) return false;
    if (panel.classList.contains('is-hidden')) return false;
    var style = w.getComputedStyle ? w.getComputedStyle(panel) : null;
    if (style && style.display === 'none') return false;
    return true;
  }

  function setToggleChecked(on, persist) {
    state.enabled = !!on;
    var input = $('toggle-maestro-context');
    var visual = document.querySelector('[data-visual-for="toggle-maestro-context"] .checkbox_toggle') ||
      document.querySelector('#maestro-context-option-row .checkbox_toggle');
    if (input) input.checked = !!on;
    if (visual) {
      if (on) visual.classList.add('w--redirected-checked');
      else visual.classList.remove('w--redirected-checked');
    }
    var row = $('maestro-context-option-row');
    if (row) row.setAttribute('aria-pressed', on ? 'true' : 'false');

    var block = $('maestro-context-block');
    var slot = $('maestro-context-slot');
    if (block) {
      block.hidden = !(on && isFileTabActive());
      if (slot) slot.hidden = block.hidden;
      if (on) {
        syncBlockWidth();
        if (w.requestAnimationFrame) {
          w.requestAnimationFrame(function () {
            syncBlockWidth();
            w.requestAnimationFrame(syncBlockWidth);
          });
        }
        setTimeout(syncBlockWidth, 50);
        setTimeout(syncBlockWidth, 250);
      }
    }
    if (!on) clearAllDocs();
    if (persist !== false) writePref(!!on);
  }

  function findOptionsInsertPoint() {
    var select = $('default-template-select');
    if (select) {
      var wrap = select.closest('.wrapper-pro') || select.closest('.options-wrapper') || select.parentElement;
      if (wrap) return wrap;
    }
    var opts = document.querySelector('.options-wrapper .text-align-left._0-25-rem_gap') ||
      document.querySelector('.options-wrapper .text-align-left') ||
      document.querySelector('.options-wrapper');
    return opts || null;
  }

  function injectToggleRow() {
    if ($('toggle-maestro-context') || $('maestro-context-option-row')) {
      return $('maestro-context-option-row') || $('toggle-maestro-context').closest('.checkbox-component');
    }

    var insertBefore = findOptionsInsertPoint();
    if (!insertBefore) {
      console.warn('[MaestroContext] .options-wrapper introuvable — toggle reste dans le panel');
      return null;
    }

    var row = document.createElement('div');
    row.className = 'checkbox-component';
    row.id = 'maestro-context-option-row';
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.setAttribute('aria-pressed', 'false');
    row.setAttribute('aria-label', 'Joindre des documents');
    row.innerHTML =
      '<label data-visual-for="toggle-maestro-context" class="w-checkbox checkbox-field">' +
        '<div class="w-checkbox-input w-checkbox-input--inputType-custom checkbox_toggle"></div>' +
        '<input type="checkbox" id="toggle-maestro-context" name="toggle-maestro-context" ' +
          'data-option-type="maestroContext" data-name="toggle-maestro-context" ' +
          'style="opacity:0;position:absolute;z-index:-1">' +
        '<span class="checkbox-label w-form-label" for="toggle-maestro-context">Off/ On</span>' +
      '</label>' +
      '<div class="text-size-small text-color-grey">' +
        'Joindre des documents' +
        '<span class="maestro-tip-wrap">' +
          '<button type="button" class="maestro-tip" aria-label="' + escapeHtml(TOOLTIP) + '" ' +
            'aria-describedby="maestro-tip-bubble">?</button>' +
          '<span id="maestro-tip-bubble" class="maestro-tip-bubble" role="tooltip">' +
            escapeHtml(TOOLTIP) +
          '</span>' +
        '</span>' +
      '</div>';

    insertBefore.parentNode.insertBefore(row, insertBefore);
    return row;
  }

  /** Slot avant .wrapper-pro — ne pas afterend sur la row (évite d’étirer les options) */
  function placeBlockInSlot() {
    var block = $('maestro-context-block');
    var insertBefore = findOptionsInsertPoint();
    if (!block) return null;

    var slot = $('maestro-context-slot');
    if (!slot) {
      slot = document.createElement('div');
      slot.id = 'maestro-context-slot';
      if (insertBefore && insertBefore.parentNode) {
        insertBefore.parentNode.insertBefore(slot, insertBefore);
      } else if (block.parentNode) {
        block.parentNode.insertBefore(slot, block);
      }
    } else if (insertBefore && slot.nextSibling !== insertBefore && slot.parentNode !== insertBefore.parentNode) {
      insertBefore.parentNode.insertBefore(slot, insertBefore);
    } else if (insertBefore && slot.parentNode === insertBefore.parentNode && slot !== insertBefore.previousSibling) {
      insertBefore.parentNode.insertBefore(slot, insertBefore);
    }

    if (block.parentNode !== slot) {
      slot.appendChild(block);
    }
    return slot;
  }

  function bindTip(row) {
    if (!row) return;
    var wrap = row.querySelector('.maestro-tip-wrap');
    var tip = row.querySelector('.maestro-tip');
    if (!wrap || !tip) return;

    tip.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      wrap.classList.toggle('is-open');
    });

    document.addEventListener('click', function (e) {
      if (!wrap.classList.contains('is-open')) return;
      if (wrap.contains(e.target)) return;
      wrap.classList.remove('is-open');
    });
  }

  function bindToggleRow(row) {
    if (!row) return;
    function toggle() { setToggleChecked(!state.enabled, true); }
    row.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('.maestro-tip-wrap')) return;
      e.preventDefault();
      toggle();
    });
    row.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target && e.target.closest && e.target.closest('.maestro-tip')) return;
        e.preventDefault();
        toggle();
      }
    });
  }

  function syncVisibility() {
    var block = $('maestro-context-block');
    var slot = $('maestro-context-slot');
    var row = $('maestro-context-option-row');
    if (row) row.style.display = isFileTabActive() ? '' : 'none';
    if (!block) return;
    var show = state.enabled && isFileTabActive();
    block.hidden = !show;
    if (slot) slot.hidden = !show;
    if (show) syncBlockWidth();
  }

  function bindUi() {
    var block = $('maestro-context-block');
    var input = $('maestro-context-file');
    if (!block || !input) {
      w.AgiloMaestroContext = {
        enrichFormData: function (fd) { return Promise.resolve(fd); },
        hasActiveContext: function () { return false; },
        uploadAttachments: function () { return Promise.resolve({ ok: true, skipped: true }); }
      };
      return;
    }

    if (input.hasAttribute('name')) input.removeAttribute('name');

    var row = injectToggleRow();
    placeBlockInSlot();
    if (row) {
      bindToggleRow(row);
      bindTip(row);
    }

    input.addEventListener('change', function () {
      if (input.files && input.files.length) {
        addFiles(input.files);
        input.value = '';
      }
    });

    var drop = $('maestro-context-drop');
    if (drop) {
      ['dragenter', 'dragover'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) {
          e.preventDefault();
          e.stopPropagation();
          drop.classList.add('is-dragover');
        });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) {
          e.preventDefault();
          e.stopPropagation();
          drop.classList.remove('is-dragover');
        });
      });
      drop.addEventListener('drop', function (e) {
        var files = e.dataTransfer && e.dataTransfer.files;
        if (files && files.length) addFiles(files);
      });
    }

    var list = $('maestro-doc-list');
    if (list) {
      list.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('[data-maestro-action]') : null;
        if (!btn) return;
        e.preventDefault();
        var action = btn.getAttribute('data-maestro-action');
        var id = btn.getAttribute('data-id');
        if (action === 'remove' && id) removeDoc(id);
        if (action === 'replace') replacePrimary();
      });
    }

    document.querySelectorAll('.source-tab[data-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        setTimeout(syncVisibility, 0);
      });
    });

    w.addEventListener('resize', function () {
      if (state.enabled) syncBlockWidth();
    });

    setToggleChecked(readPref(), false);
    syncVisibility();

    w.AgiloMaestroContext = {
      enrichFormData: enrichFormData,
      hasActiveContext: hasActiveContext,
      uploadAttachments: uploadAttachments,
      clear: function () { clearAllDocs(); },
      getState: function () {
        var prim = primaryDoc();
        return {
          enabled: state.enabled,
          docsCount: docs.length,
          hasFile: docs.length > 0,
          contextId: prim ? prim.contextId : null,
          prefKey: PREF_KEY,
          attachmentsUnavailable: state.attachmentsUnavailable
        };
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindUi);
  } else {
    bindUi();
  }
})(window);
