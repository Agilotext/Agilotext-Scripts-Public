/**
 * maestro-context-ent.js — Agilotext Business / Maestro V1 B+
 * Branche Scripts-Public 1.10 (ne pas pousser sur @24cac26 / 1.09)
 *
 * Feature : « Joindre des documents »
 *   - Toggle injecté dans .options-wrapper (même markup que speakers / CR)
 *   - Doc #1 (primaire) → preAnalyze → contextId → enrichFormData
 *   - Docs #2..N → addJobContextAttachment après upload (job_id)
 *   - Fallback 1 doc si route attachments absente
 *
 * Auth = même pattern que sendMultipleAudio :
 *   resolveMemberEmail → ensureValidToken → FormData username+token+edition+…
 *   retry 1× sur error_invalid_token
 *
 * Limites : PDF/DOCX/TXT, 20 Mo max (MAESTRO_CONTEXT_MAX_BYTES)
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

  function syncDropHasFile() {
    var drop = $('maestro-context-drop');
    if (drop) {
      if (docs.length) drop.classList.add('has-file');
      else drop.classList.remove('has-file');
    }
  }

  function syncBlockWidth() {
    var block = $('maestro-context-block');
    if (!block || block.hidden) return;
    var pond = document.querySelector('.uploader .filepond--root') ||
      document.querySelector('.uploader');
    if (pond) {
      var wPx = pond.getBoundingClientRect().width;
      if (wPx > 40) {
        block.style.maxWidth = Math.round(wPx) + 'px';
        block.style.width = '100%';
      }
    }
    block.style.margin = '.5rem auto 0';
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

  function renderChips(list, label) {
    if (!list || !list.length) return '';
    var chips = list.slice(0, 12).map(function (t) {
      var labelText = typeof t === 'string' ? t : (t && (t.name || t.nom || t.label)) || String(t);
      return '<span class="maestro-chip">' + escapeHtml(String(labelText)) + '</span>';
    }).join('');
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

  function renderDocList() {
    var list = $('maestro-doc-list');
    if (!list) return;
    if (!docs.length) {
      list.hidden = true;
      list.innerHTML = '';
      return;
    }
    list.hidden = false;
    list.innerHTML = docs.map(function (d) {
      var badgeClass = 'maestro-status';
      var dotClass = 'maestro-status-dot';
      if (d.status === 'loading') { badgeClass += ' is-loading'; dotClass += ' is-loading'; }
      else if (d.status === 'ok') { badgeClass += ' is-ok'; dotClass += ' is-ok'; }
      else if (d.status === 'warn') { badgeClass += ' is-warn'; dotClass += ' is-warn'; }
      else if (d.status === 'fail') { badgeClass += ' is-fail'; dotClass += ' is-fail'; }
      else { dotClass += ' is-queued'; }

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
            '<span class="maestro-doc-name">' + escapeHtml(d.file.name) + '</span>' +
            '<span class="maestro-doc-size">' + escapeHtml(formatSize(d.file.size)) +
              (d.role === 'primary' ? ' · document principal' : ' · pièce jointe') +
            '</span>' +
            '<div class="' + badgeClass + '">' +
              '<span class="' + dotClass + '" aria-hidden="true"></span>' +
              '<span>' + escapeHtml(d.statusText || '') + '</span>' +
            '</div>' +
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
    syncDropHasFile();
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
      docs[0].statusText = 'Analyse du document…';
      docs[0].contextId = null;
      state.preAnalyzePromise = runPreAnalyze(docs[0]);
    } else if (!docs.length) {
      state.preAnalyzePromise = null;
      state.lastPreview = null;
      showPreviewHtml('');
    } else if (wasPrimary) {
      showPreviewHtml('');
    }
    syncDropHasFile();
    renderDocList();
  }

  function applyPreviewSuccess(doc, data) {
    doc.contextId = data.contextId || data.contextDocumentId || null;
    state.lastPreview = data;
    doc.status = 'ok';
    doc.statusText = 'Document analysé';
    renderDocList();

    var parts = [];
    var participants = data.participants || data.participantNames || [];
    var terms = data.terms || data.wordBoost || data.keywords || data.wordBoostCandidates || [];
    var topics = data.topics || [];
    if (participants.length) parts.push(renderChips(participants, 'Participants'));
    if (topics.length) parts.push(renderChips(topics, 'Thèmes'));
    if (terms.length) parts.push(renderChips(terms, 'Termes'));
    if (!parts.length && data.summary) {
      parts.push('<p class="text-color-grey">' + escapeHtml(String(data.summary).slice(0, 220)) + '</p>');
    }
    showPreviewHtml(parts.join(''));
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
      setDocStatus(doc.id, 'warn', 'Email introuvable — fichier joint à l’envoi');
      return Promise.resolve(null);
    }

    setDocStatus(doc.id, 'loading', 'Analyse du document…');

    return ensureTokenForEmail(email, false).then(function (ok) {
      var token = w.globalToken;
      if (!ok || !token) {
        setDocStatus(doc.id, 'warn', 'Connectez-vous pour analyser — fichier joint à l’envoi');
        return null;
      }

      function handleResult(result, canRetry) {
        var res = result.res;
        var data = result.data;

        if (canRetry && isInvalidTokenError(data, res)) {
          return ensureTokenForEmail(email, true).then(function (ok2) {
            var token2 = w.globalToken;
            if (!ok2 || !token2) {
              setDocStatus(doc.id, 'warn', 'Session expirée — fichier joint à l’envoi');
              return null;
            }
            return postPreAnalyze(doc.file, email, token2).then(function (r2) {
              return handleResult(r2, false);
            });
          });
        }

        if (!res.ok || !data || data.status !== 'OK') {
          var msg = (data && (data.userErrorMessage || data.errorMessage || data.message)) ||
            'Analyse impossible — fichier joint à l’envoi';
          setDocStatus(doc.id, 'warn', msg);
          showPreviewHtml('<p class="maestro-preview-warn">' + escapeHtml(msg) + '</p>');
          return null;
        }
        return applyPreviewSuccess(doc, data);
      }

      return postPreAnalyze(doc.file, email, token).then(function (result) {
        return handleResult(result, true);
      }).catch(function () {
        setDocStatus(doc.id, 'warn', 'Réseau indisponible — fichier joint à l’envoi');
        return null;
      });
    });
  }

  function addFiles(fileList) {
    var arr = Array.prototype.slice.call(fileList || []);
    if (!arr.length) return;

    var errors = [];
    arr.forEach(function (file) {
      var err = validateFile(file);
      if (err) {
        errors.push(file.name + ' : ' + err);
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
        statusText: role === 'primary' ? 'Analyse du document…' : 'Joint (non analysé)',
        contextId: null,
        attachmentId: null
      };
      docs.push(entry);
      if (role === 'primary') {
        forceSummaryOn();
        state.preAnalyzePromise = runPreAnalyze(entry);
      }
    });

    syncDropHasFile();
    renderDocList();
    if (errors.length) {
      showPreviewHtml('<p class="maestro-preview-fail">' + escapeHtml(errors.join(' · ')) + '</p>');
    }
  }

  function replacePrimary() {
    var input = $('maestro-context-file');
    if (!input) return;
    input.value = '';
    // temporary single-file pick for replace
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
          statusText: 'Analyse du document…',
          contextId: null,
          attachmentId: null
        };
        docs.unshift(entry);
        // demote any previous accidental primary
        for (var i = 1; i < docs.length; i++) docs[i].role = 'extra';
        forceSummaryOn();
        syncDropHasFile();
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

  /**
   * Appelé par upload_ent_v2 après succès (job_id connu).
   * Envoie les docs #2..N via addJobContextAttachment ; fallback propre si 404.
   */
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
          setDocStatus(doc.id, 'loading', 'Envoi de la pièce jointe…');
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
              setDocStatus(doc.id, 'warn', 'Envoi pièce jointe échoué');
              return { ok: false, count: acc.count };
            }
            doc.attachmentId = (data.attachmentId != null) ? String(data.attachmentId) : 'ok';
            setDocStatus(doc.id, 'ok', 'Joint (non analysé)');
            return { ok: true, count: acc.count + 1 };
          }).catch(function () {
            setDocStatus(doc.id, 'warn', 'Envoi pièce jointe échoué');
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
    if (block) {
      block.hidden = !(on && isFileTabActive());
      if (on) {
        setTimeout(syncBlockWidth, 0);
        setTimeout(syncBlockWidth, 200);
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
    row.title = TOOLTIP;
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
        '<span class="maestro-tip" title="' + escapeHtml(TOOLTIP) + '" aria-label="' + escapeHtml(TOOLTIP) + '">?</span>' +
      '</div>';

    insertBefore.parentNode.insertBefore(row, insertBefore);
    return row;
  }

  function placeBlockUnderToggle(row) {
    var block = $('maestro-context-block');
    if (!block || !row) return;
    row.insertAdjacentElement('afterend', block);
  }

  function bindToggleRow(row) {
    if (!row) return;
    function toggle() { setToggleChecked(!state.enabled, true); }
    row.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('.maestro-tip')) return;
      e.preventDefault();
      toggle();
    });
    row.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  }

  function syncVisibility() {
    var block = $('maestro-context-block');
    var row = $('maestro-context-option-row');
    if (row) row.style.display = isFileTabActive() ? '' : 'none';
    if (!block) return;
    block.hidden = !(state.enabled && isFileTabActive());
    if (state.enabled && isFileTabActive()) syncBlockWidth();
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
    if (row) {
      placeBlockUnderToggle(row);
      bindToggleRow(row);
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
