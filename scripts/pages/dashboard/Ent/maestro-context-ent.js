/**
 * maestro-context-ent.js — Maestro V1 B+ « Joindre des documents »
 * Branche Scripts-Public 1.10 — partagé Free / Pro / Ent (ne pas pousser sur @24cac26 / 1.09)
 *
 * Tiers :
 *   free/perso → toggle locked + upsell Business
 *   pro        → 1 doc max + aperçu bêta
 *   ent        → jusqu’à 5 docs + aperçu bêta
 *
 * API Section 7 : multi contextFile → 1 contextId ; upload audio = contextId seul.
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

  var CFG_MAX_BYTES = typeof CFG.maxBytes === 'number' ? CFG.maxBytes : 10 * 1024 * 1024;
  var CFG_MAX_TOTAL = typeof CFG.maxTotalBytes === 'number' ? CFG.maxTotalBytes : 50 * 1024 * 1024;
  var ACCEPT_EXT = /\.(pdf|docx|txt)$/i;
  var LABEL_EMPTY = 'Glissez un PDF, DOCX ou TXT ou&nbsp;<span class="browse">Parcourir</span>';
  var LABEL_COMPACT = '+ Ajouter un document';
  var API_PREANALYZE = 'https://api.agilotext.com/api/v1/preAnalyzeContextDocument';
  var DEBOUNCE_MS = 400;

  var ERROR_MAP = {
    error_maestro_not_enabled: 'Maestro n’est pas activé sur ce serveur.',
    error_maestro_user_not_allowed: 'Votre compte n’est pas autorisé à utiliser Maestro.',
    error_maestro_context_file_missing: 'Aucun document fourni.',
    error_maestro_context_file_empty: 'Document sans texte extractible.',
    error_maestro_context_file_too_many: 'Maximum de documents atteint pour votre offre.',
    error_maestro_context_file_too_large: 'Un document dépasse 10 Mo.',
    error_maestro_context_total_too_large: 'Total des documents supérieur à 50 Mo.',
    error_maestro_context_pdf_too_many_pages: 'Plus de 50 pages PDF au total.',
    error_maestro_context_file_unsupported: 'Formats acceptés : PDF, DOCX, TXT.',
    error_maestro_context_ocr_failed: 'Échec OCR du PDF scanné.',
    error_maestro_context_segment_limit: 'Documents trop longs pour l’analyse.',
    error_maestro_context_json_invalid: 'Analyse structurée invalide.',
    error_maestro_context_not_found: 'Contexte introuvable.',
    error_invalid_token: 'Session expirée — reconnectez-vous.'
  };

  /** @type {{ id: string, file: File, status: string, statusText: string }[]} */
  var docs = [];
  var state = {
    enabled: false,
    contextId: null,
    preAnalyzePromise: null,
    lastPreview: null,
    debounceTimer: null,
    analyzeGen: 0,
    edition: 'ent',
    locked: false,
    maxDocs: 5,
    maxBytes: CFG_MAX_BYTES,
    maxTotalBytes: CFG_MAX_TOTAL
  };
  var uidSeq = 0;

  function resolveEdition() {
    if (w.edition) return String(w.edition).toLowerCase();
    var inp = document.querySelector('input[name="edition"]');
    if (inp && inp.value) return String(inp.value).toLowerCase();
    if (CFG.edition) return String(CFG.edition).toLowerCase();
    return 'ent';
  }

  function tierLimits(edition) {
    var ed = String(edition || 'ent').toLowerCase();
    if (ed === 'free' || ed === 'perso' || ed === 'personal') {
      return { edition: 'free', allowed: false, locked: true, maxDocs: 0, maxBytes: 0, maxTotalBytes: 0 };
    }
    if (ed === 'pro') {
      return {
        edition: 'pro',
        allowed: true,
        locked: false,
        maxDocs: 1,
        maxBytes: CFG_MAX_BYTES,
        maxTotalBytes: CFG_MAX_BYTES
      };
    }
    return {
      edition: 'ent',
      allowed: true,
      locked: false,
      maxDocs: typeof CFG.maxDocs === 'number' ? CFG.maxDocs : 5,
      maxBytes: CFG_MAX_BYTES,
      maxTotalBytes: CFG_MAX_TOTAL
    };
  }

  function applyTier(tier) {
    state.edition = tier.edition;
    state.locked = !!tier.locked;
    state.maxDocs = tier.maxDocs;
    state.maxBytes = tier.maxBytes;
    state.maxTotalBytes = tier.maxTotalBytes;
  }

  function prefKey() {
    return 'agilo.maestro.contextBriefEnabled.' + state.edition;
  }

  function tooltipText() {
    if (state.locked) {
      return 'Joignez une convocation ou un brief pour ancrer le compte rendu — disponible avec l’offre Business.';
    }
    if (state.edition === 'pro') {
      return '1 document (PDF, DOCX, TXT, 10 Mo). L’aperçu est indicatif ; seule une convocation avec liste de présences garantit les participants. Jusqu’à 5 documents en Business.';
    }
    return 'Ajoutez jusqu’à 5 documents (PDF, DOCX, TXT, 10 Mo chacun). L’aperçu est indicatif ; une convocation avec liste de présences garantit les participants.';
  }

  function helpText() {
    if (state.edition === 'pro') {
      return 'PDF, DOCX, TXT — 1 document (10 Mo max). Aperçu indicatif.';
    }
    return 'PDF, DOCX, TXT — jusqu’à 5 documents (10 Mo chacun). Tous sont analysés ensemble.';
  }

  function toggleLabel() {
    if (state.locked) return 'Joindre des documents';
    if (state.edition === 'pro') return 'Joindre un document';
    return 'Joindre des documents';
  }

  function toggleSubLabel() {
    if (state.locked) return 'Offre Business';
    if (state.edition === 'pro') return '1 PDF/DOCX/TXT · aperçu indicatif';
    return '';
  }

  function showUpgradeBusiness(reason) {
    if (w.AgiloGate && typeof w.AgiloGate.showUpgrade === 'function') {
      w.AgiloGate.showUpgrade('ent', reason || 'Joindre des documents');
      return;
    }
    alert(reason || 'Passez à Business pour joindre des documents de contexte.');
  }

  function readPref() {
    try {
      var v = w.localStorage && w.localStorage.getItem(prefKey());
      if (v === '1' || v === 'true') return true;
      if (v === '0' || v === 'false') return false;
    } catch (e) { /* private mode */ }
    return false;
  }

  function writePref(on) {
    try {
      if (w.localStorage) w.localStorage.setItem(prefKey(), on ? '1' : '0');
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
    } catch (e2) { /* keep */ }
    return n;
  }

  function formatSize(bytes) {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '') + ' Mo';
    return Math.round(bytes / 1024) + ' Ko';
  }

  function totalBytes() {
    return docs.reduce(function (s, d) { return s + (d.file.size || 0); }, 0);
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
    if (state.locked || !state.maxDocs) return 'Documents de contexte — offre Business.';
    if (file.size > state.maxBytes) return 'Fichier trop volumineux (max 10 Mo).';
    if (!ACCEPT_EXT.test(file.name || '')) return 'Formats acceptés : PDF, DOCX, TXT.';
    return null;
  }

  function mapMaestroError(data) {
    var code = (data && (data.errorMessage || data.error || data.code)) || '';
    code = String(code);
    if (code.indexOf('ocr') !== -1 && state.edition === 'pro') {
      return 'OCR PDF scanné — disponible avec l’offre Business. Essayez un DOCX/TXT ou un PDF texte.';
    }
    if (ERROR_MAP[code]) return ERROR_MAP[code];
    for (var key in ERROR_MAP) {
      if (code.indexOf(key) !== -1) return ERROR_MAP[key];
    }
    return (data && (data.userErrorMessage || data.message)) ||
      'Analyse impossible — réessayez ou retirez un document.';
  }

  function renderChips(list, label, maxShow, nameKey) {
    if (!list || !list.length) return '';
    var max = typeof maxShow === 'number' ? maxShow : 8;
    var shown = list.slice(0, max);
    var rest = list.length - shown.length;
    var chips = shown.map(function (t) {
      var labelText;
      if (typeof t === 'string') labelText = t;
      else if (t && nameKey && t[nameKey]) labelText = t[nameKey];
      else labelText = (t && (t.canonicalName || t.name || t.nom || t.label)) || String(t);
      var full = String(labelText);
      return '<span class="maestro-chip" title="' + escapeHtml(full) + '">' + escapeHtml(full) + '</span>';
    }).join('');
    if (rest > 0) {
      chips += '<span class="maestro-chip maestro-chip-more">+' + rest + '</span>';
    }
    return '<div><strong>' + escapeHtml(label) + '</strong><div class="maestro-chips">' + chips + '</div></div>';
  }

  var TRASH_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<path stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ' +
        'd="M3.5 4.5h9M6.5 4.5V3.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75V4.5m1.5 0v8.25a.75.75 0 0 1-.75.75h-5.5a.75.75 0 0 1-.75-.75V4.5"/>' +
    '</svg>';

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
      var shown = displayFileName(d.file.name);
      var actions =
        '<button type="button" class="maestro-doc-btn" data-maestro-action="replace" data-id="' + d.id + '">Remplacer</button>' +
        '<button type="button" class="maestro-doc-btn maestro-doc-btn--icon" data-maestro-action="remove" data-id="' + d.id + '" aria-label="Retirer">' +
          TRASH_SVG +
        '</button>';

      return (
        '<li class="maestro-doc-item" data-id="' + d.id + '">' +
          '<span class="maestro-doc-name" title="' + escapeHtml(shown) + '">' + escapeHtml(shown) + '</span>' +
          '<span class="maestro-doc-size">' + escapeHtml(formatSize(d.file.size)) + '</span>' +
          '<div class="maestro-doc-actions">' + actions + '</div>' +
          badgeHtml(d) +
        '</li>'
      );
    }).join('');
    syncDropMode();
    syncBlockWidth();
  }

  function setAllDocsStatus(status, text) {
    docs.forEach(function (d) {
      d.status = status;
      d.statusText = text || '';
    });
    renderDocList();
  }

  function clearAllDocs() {
    docs = [];
    state.contextId = null;
    state.preAnalyzePromise = null;
    state.lastPreview = null;
    state.analyzeGen += 1;
    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = null;
    }
    var input = $('maestro-context-file');
    if (input) input.value = '';
    renderDocList();
    showPreviewHtml('');
  }

  function buildPreviewFromAnalysis(data) {
    var analysis = (data && data.analysis) || data || {};
    var parts = [];
    var rosterDetected = analysis.rosterDetected === true || data.rosterDetected === true;
    var participants = analysis.participants || data.participants || [];

    if (rosterDetected && participants.length) {
      parts.push(renderChips(participants, 'Participants', 8, 'canonicalName'));
    } else if (participants.length && state.edition === 'ent') {
      parts.push(renderChips(participants, 'Participants', 8, 'canonicalName'));
    } else {
      parts.push(
        '<div class="maestro-preview-note">' +
          '<strong>Contexte</strong>' +
          '<p class="text-color-grey" style="margin:.25rem 0 0;font-size:.75rem">' +
            'Contexte métier pris en compte (pas de liste de présences).' +
          '</p></div>'
      );
    }

    var agenda = analysis.agendaItems || data.agendaItems || [];
    if (agenda.length) parts.push(renderChips(agenda, 'Ordre du jour', 8));

    var terms = analysis.wordBoostCandidates || data.wordBoostCandidates ||
      data.terms || data.wordBoost || data.keywords || [];
    parts.push(renderChips(terms, 'Termes', 6));

    var hints = analysis.summaryHints || data.summaryHints || [];
    if (hints.length) {
      parts.push('<div><strong>Pistes CR</strong><p class="text-color-grey" style="margin:.25rem 0 0;font-size:.75rem">' +
        escapeHtml(hints.slice(0, 4).join(' · ')) + '</p></div>');
    }

    parts = parts.filter(Boolean);
    if (!parts.length) {
      showPreviewHtml('');
      return;
    }
    showPreviewHtml(
      '<details class="maestro-preview-details">' +
        '<summary>Aperçu indicatif <span class="maestro-beta-badge">bêta</span></summary>' +
        '<div class="maestro-preview-body">' + parts.join('') + '</div>' +
      '</details>'
    );
  }

  function isInvalidTokenError(data, res) {
    if (!data && res && res.status === 401) return true;
    var msg = String(
      (data && (data.errorMessage || data.userErrorMessage || data.message || data.error)) || ''
    ).toLowerCase();
    return msg.indexOf('invalid_token') !== -1 || msg.indexOf('invalid token') !== -1 ||
      msg.indexOf('error_invalid_token') !== -1;
  }

  function postPreAnalyzeAll(email, token) {
    var fd = new FormData();
    fd.append('username', email);
    fd.append('token', token);
    fd.append('edition', state.edition);
    docs.forEach(function (d) {
      fd.append('contextFile', d.file, d.file.name);
    });
    console.log('[MaestroContext] preAnalyze', {
      username: email,
      files: docs.length,
      edition: state.edition
    });
    return fetch(API_PREANALYZE, { method: 'POST', body: fd }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        return { res: res, data: data };
      });
    });
  }

  function runPreAnalyzeAll() {
    if (!docs.length) {
      state.contextId = null;
      state.preAnalyzePromise = null;
      showPreviewHtml('');
      return Promise.resolve(null);
    }

    var gen = ++state.analyzeGen;
    var email = resolveMemberEmail();
    if (!email) {
      setAllDocsStatus('warn', 'Email introuvable');
      return Promise.resolve(null);
    }

    setAllDocsStatus('loading', 'Analyse…');
    forceSummaryOn();

    var promise = ensureTokenForEmail(email, false).then(function (ok) {
      if (gen !== state.analyzeGen) return null;
      var token = w.globalToken;
      if (!ok || !token) {
        setAllDocsStatus('warn', 'Connectez-vous pour analyser');
        return null;
      }

      function handleResult(result, canRetry) {
        if (gen !== state.analyzeGen) return null;
        var res = result.res;
        var data = result.data;

        if (canRetry && isInvalidTokenError(data, res)) {
          return ensureTokenForEmail(email, true).then(function (ok2) {
            var token2 = w.globalToken;
            if (!ok2 || !token2) {
              setAllDocsStatus('warn', 'Session expirée');
              return null;
            }
            return postPreAnalyzeAll(email, token2).then(function (r2) {
              return handleResult(r2, false);
            });
          });
        }

        if (!res.ok || !data || data.status !== 'OK') {
          var msg = mapMaestroError(data);
          setAllDocsStatus('warn', msg);
          state.contextId = null;
          showPreviewHtml('<p class="maestro-preview-warn">' + escapeHtml(msg) + '</p>');
          return null;
        }

        state.contextId = data.contextId || null;
        state.lastPreview = data;
        setAllDocsStatus('ok', 'Analysé');
        buildPreviewFromAnalysis(data);
        return state.contextId;
      }

      return postPreAnalyzeAll(email, token).then(function (result) {
        return handleResult(result, true);
      }).catch(function () {
        if (gen !== state.analyzeGen) return null;
        setAllDocsStatus('warn', 'Réseau indisponible');
        state.contextId = null;
        return null;
      });
    });

    state.preAnalyzePromise = promise;
    return promise;
  }

  function schedulePreAnalyze() {
    state.contextId = null;
    if (state.debounceTimer) clearTimeout(state.debounceTimer);
    if (!docs.length) {
      showPreviewHtml('');
      return;
    }
    setAllDocsStatus('loading', 'Analyse…');
    state.debounceTimer = setTimeout(function () {
      state.debounceTimer = null;
      runPreAnalyzeAll();
    }, DEBOUNCE_MS);
  }

  function addFiles(fileList) {
    var arr = Array.prototype.slice.call(fileList || []);
    if (!arr.length) return;
    if (state.locked) {
      showUpgradeBusiness('Joindre des documents');
      return;
    }

    var errors = [];
    var upgradeHint = '';
    arr.forEach(function (file) {
      var err = validateFile(file);
      if (err) {
        errors.push(displayFileName(file.name) + ' : ' + err);
        return;
      }
      if (docs.length >= state.maxDocs) {
        if (state.edition === 'pro') {
          upgradeHint = '1 document max — offre Pro. <button type="button" class="maestro-upgrade-hint" data-maestro-upgrade="ent">Jusqu’à 5 documents — passez à Business</button>';
        } else {
          errors.push('Maximum ' + state.maxDocs + ' documents.');
        }
        return;
      }
      if (totalBytes() + file.size > state.maxTotalBytes) {
        errors.push('Total supérieur à 50 Mo.');
        return;
      }
      docs.push({
        id: 'd' + (++uidSeq),
        file: file,
        status: 'loading',
        statusText: 'Analyse…'
      });
    });

    renderDocList();
    if (upgradeHint) {
      showPreviewHtml('<p class="maestro-preview-fail">' + upgradeHint + '</p>');
    } else if (errors.length) {
      showPreviewHtml('<p class="maestro-preview-fail">' + escapeHtml(errors.join(' · ')) + '</p>');
    }
    if (docs.length) schedulePreAnalyze();
  }

  function removeDoc(id) {
    docs = docs.filter(function (d) { return d.id !== id; });
    renderDocList();
    if (!docs.length) {
      clearAllDocs();
      return;
    }
    schedulePreAnalyze();
  }

  function replaceDoc(id) {
    var input = $('maestro-context-file');
    if (!input || !id) return;
    var idx = -1;
    for (var i = 0; i < docs.length; i++) {
      if (docs[i].id === id) { idx = i; break; }
    }
    if (idx < 0) return;
    input.value = '';
    var prevMultiple = input.multiple;
    input.multiple = false;
    function onChange() {
      input.removeEventListener('change', onChange);
      input.multiple = prevMultiple;
      if (!(input.files && input.files[0])) return;
      var file = input.files[0];
      var err = validateFile(file);
      if (err) {
        showPreviewHtml('<p class="maestro-preview-fail">' + escapeHtml(err) + '</p>');
        return;
      }
      var restSize = 0;
      for (var j = 0; j < docs.length; j++) {
        if (j !== idx) restSize += docs[j].file.size || 0;
      }
      if (restSize + file.size > state.maxTotalBytes) {
        showPreviewHtml('<p class="maestro-preview-fail">Total supérieur à 50 Mo.</p>');
        return;
      }
      docs[idx] = { id: 'd' + (++uidSeq), file: file, status: 'loading', statusText: 'Analyse…' };
      renderDocList();
      schedulePreAnalyze();
    }
    input.addEventListener('change', onChange);
    input.click();
  }

  function waitPreAnalyze() {
    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = null;
      return runPreAnalyzeAll();
    }
    if (!state.preAnalyzePromise) {
      if (docs.length && !state.contextId) return runPreAnalyzeAll();
      return Promise.resolve(state.contextId);
    }
    return state.preAnalyzePromise.then(function (id) { return id; }, function () { return null; });
  }

  function hasActiveContext() {
    return !!(state.enabled && !state.locked && docs.length > 0);
  }

  /** Envoi audio : contextId seul (jamais contextFile → error_maestro_context_ambiguous) */
  function enrichFormData(fd) {
    if (!hasActiveContext()) return Promise.resolve(fd);

    return waitPreAnalyze().then(function () {
      forceSummaryOn();
      try { fd.delete('doSummary'); } catch (e) { /* ignore */ }
      fd.append('doSummary', 'true');
      try { fd.delete('contextFile'); } catch (e1) { /* ignore */ }
      try { fd.delete('contextId'); } catch (e2) { /* ignore */ }

      if (state.contextId) {
        fd.append('contextId', state.contextId);
      } else if (docs.length === 1) {
        // Dernier recours : 1 seul fichier sans contextId (preAnalyze a échoué)
        fd.append('contextFile', docs[0].file, docs[0].file.name);
      }
      return fd;
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
    if (state.locked) on = false;
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
    if (row) {
      row.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (state.locked) row.classList.add('is-disabled');
      else row.classList.remove('is-disabled');
    }

    var block = $('maestro-context-block');
    var slot = $('maestro-context-slot');
    if (block) {
      block.hidden = !(on && isFileTabActive() && !state.locked);
      if (slot) slot.hidden = block.hidden;
      if (on && !state.locked) {
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
    if (persist !== false && !state.locked) writePref(!!on);
  }

  function findOptionsInsertPoint() {
    var select = $('default-template-select');
    if (select) {
      var wrap = select.closest('.wrapper-pro') || select.closest('.options-wrapper') || select.parentElement;
      if (wrap) return wrap;
    }
    return document.querySelector('.options-wrapper .text-align-left._0-25-rem_gap') ||
      document.querySelector('.options-wrapper .text-align-left') ||
      document.querySelector('.options-wrapper');
  }

  function injectToggleRow() {
    if ($('toggle-maestro-context') || $('maestro-context-option-row')) {
      return $('maestro-context-option-row') || $('toggle-maestro-context').closest('.checkbox-component');
    }
    var insertBefore = findOptionsInsertPoint();
    if (!insertBefore) {
      console.warn('[MaestroContext] .options-wrapper introuvable');
      return null;
    }

    var tip = tooltipText();
    var sub = toggleSubLabel();
    var row = document.createElement('div');
    row.className = 'checkbox-component' + (state.locked ? ' is-disabled' : '');
    row.id = 'maestro-context-option-row';
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.setAttribute('aria-pressed', 'false');
    row.setAttribute('aria-label', toggleLabel());
    if (state.locked) row.setAttribute('aria-disabled', 'true');
    row.innerHTML =
      '<label data-visual-for="toggle-maestro-context" class="w-checkbox checkbox-field">' +
        '<div class="w-checkbox-input w-checkbox-input--inputType-custom checkbox_toggle"></div>' +
        '<input type="checkbox" id="toggle-maestro-context" name="toggle-maestro-context" ' +
          'data-option-type="maestroContext" data-name="toggle-maestro-context" ' +
          (state.locked ? 'disabled ' : '') +
          'style="opacity:0;position:absolute;z-index:-1">' +
        '<span class="checkbox-label w-form-label" for="toggle-maestro-context">Off/ On</span>' +
      '</label>' +
      '<div class="text-size-small text-color-grey">' +
        '<span class="maestro-toggle-label">' + escapeHtml(toggleLabel()) + '</span>' +
        (sub ? '<span class="maestro-tier-badge">' + escapeHtml(sub) + '</span>' : '') +
        '<span class="maestro-tip-wrap">' +
          '<button type="button" class="maestro-tip" aria-label="' + escapeHtml(tip) + '" ' +
            'aria-describedby="maestro-tip-bubble">?</button>' +
          '<span id="maestro-tip-bubble" class="maestro-tip-bubble" role="tooltip">' +
            escapeHtml(tip) +
          '</span>' +
        '</span>' +
      '</div>';

    insertBefore.parentNode.insertBefore(row, insertBefore);
    return row;
  }

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
    } else if (insertBefore && insertBefore.parentNode) {
      insertBefore.parentNode.insertBefore(slot, insertBefore);
    }

    if (block.parentNode !== slot) slot.appendChild(block);
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
    function toggle() {
      if (state.locked) {
        showUpgradeBusiness('Joindre des documents');
        return;
      }
      setToggleChecked(!state.enabled, true);
    }
    row.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('.maestro-tip-wrap')) return;
      if (e.target && e.target.closest && e.target.closest('[data-maestro-upgrade]')) return;
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
    var show = state.enabled && !state.locked && isFileTabActive();
    block.hidden = !show;
    if (slot) slot.hidden = !show;
    if (show) syncBlockWidth();
  }

  function bindUi() {
    applyTier(tierLimits(resolveEdition()));

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
    input.multiple = state.maxDocs > 1;

    var help = block.querySelector('.maestro-context-help');
    if (help) help.textContent = helpText();

    var rgpd = block.querySelector('.maestro-context-rgpd');
    if (!rgpd) {
      rgpd = document.createElement('p');
      rgpd.className = 'maestro-context-rgpd text-size-small text-color-grey';
      rgpd.textContent = 'Document traité pour enrichir votre compte rendu ; données nominatives possibles. Usage conforme à votre compte.';
      block.appendChild(rgpd);
    }

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
        if (action === 'replace' && id) replaceDoc(id);
      });
    }

    document.addEventListener('click', function (e) {
      var up = e.target && e.target.closest ? e.target.closest('[data-maestro-upgrade]') : null;
      if (!up) return;
      e.preventDefault();
      showUpgradeBusiness('Joindre des documents');
    });

    document.querySelectorAll('.source-tab[data-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        setTimeout(syncVisibility, 0);
      });
    });

    w.addEventListener('resize', function () {
      if (state.enabled) syncBlockWidth();
    });

    setToggleChecked(state.locked ? false : readPref(), false);
    syncVisibility();

    w.AgiloMaestroContext = {
      enrichFormData: enrichFormData,
      hasActiveContext: hasActiveContext,
      uploadAttachments: function () { return Promise.resolve({ ok: true, skipped: true }); },
      clear: function () { clearAllDocs(); },
      getState: function () {
        return {
          enabled: state.enabled,
          locked: state.locked,
          edition: state.edition,
          maxDocs: state.maxDocs,
          docsCount: docs.length,
          hasFile: docs.length > 0,
          contextId: state.contextId,
          prefKey: prefKey()
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
