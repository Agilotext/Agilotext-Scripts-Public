/**
 * maestro-context-ent.js — Agilotext Business / Maestro V1 B+
 * Branche Scripts-Public 1.10 (ne pas pousser sur @24cac26 / 1.09)
 *
 * Flux :
 *   drop brief → POST /api/v1/preAnalyzeContextDocument → contextId
 *   → enrichFormData append contextId (prio) ou contextFile
 *   → sendMultipleAudio (fileUpload1 inchangé, géré par upload_ent_v2.js)
 *
 * Auth = même pattern que sendMultipleAudio :
 *   resolveMemberEmail → ensureValidToken(email) → FormData username+token+edition+contextFile
 *   retry 1× sur error_invalid_token
 *
 * Garde-fous :
 *   - no-op si AGILO_MAESTRO_CONTEXT.enabled === false ou nodes absents
 *   - input #maestro-context-file SANS name (évite pollution FormData(form))
 *   - enrichFormData attend preAnalyze en cours (race)
 *   - max 15 Mo ; UI hors onglet Fichier masquée
 *   - force doSummary / toggle CR si contexte actif
 *   - toggle OFF par défaut ; préférence ON/OFF en localStorage (pas dans UserSendDefaults)
 */
(function (w) {
  'use strict';

  var CFG = w.AGILO_MAESTRO_CONTEXT || {};
  if (CFG.enabled === false) {
    w.AgiloMaestroContext = {
      enrichFormData: function (fd) { return Promise.resolve(fd); },
      hasActiveContext: function () { return false; }
    };
    return;
  }

  var MAX_BYTES = typeof CFG.maxBytes === 'number' ? CFG.maxBytes : 15728640;
  var EDITION = CFG.edition || 'ent';
  var ACCEPT_EXT = /\.(pdf|docx?|txt)$/i;
  var PREF_KEY = 'agilo.maestro.contextBriefEnabled.' + EDITION;
  var API_PREANALYZE = 'https://api.agilotext.com/api/v1/preAnalyzeContextDocument';

  var state = {
    file: null,
    contextId: null,
    preAnalyzePromise: null,
    lastPreview: null,
    enabled: false
  };

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

  /** Même résolution email que upload_ent_v2 / SendDefaults */
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

  function setToggleChecked(on, persist) {
    var box = $('maestro-context-toggle');
    var input = $('maestro-context-toggle-input');
    state.enabled = !!on;
    if (box) {
      if (on) box.classList.add('w--redirected-checked');
      else box.classList.remove('w--redirected-checked');
    }
    if (input) input.checked = !!on;
    var switchEl = $('maestro-context-switch');
    if (switchEl) switchEl.setAttribute('aria-pressed', on ? 'true' : 'false');
    var drop = $('maestro-context-drop');
    if (drop) drop.hidden = !on;
    var help = document.querySelector('.maestro-context-help');
    if (help) help.hidden = !on;
    var rgpd = $('maestro-context-rgpd');
    if (rgpd) rgpd.hidden = !on;
    var preview = $('maestro-context-preview');
    if (preview && !on) {
      preview.hidden = true;
      preview.innerHTML = '';
    }
    if (!on) {
      clearFile(true);
    }
    if (persist !== false) writePref(!!on);
  }

  function clearFile(silent) {
    state.file = null;
    state.contextId = null;
    state.preAnalyzePromise = null;
    state.lastPreview = null;
    var input = $('maestro-context-file');
    if (input) input.value = '';
    var nameEl = $('maestro-context-file-name');
    if (nameEl) { nameEl.hidden = true; nameEl.textContent = ''; }
    var clearBtn = $('maestro-context-clear');
    if (clearBtn) clearBtn.hidden = true;
    var drop = $('maestro-context-drop');
    if (drop) drop.classList.remove('has-file', 'is-dragover');
    var preview = $('maestro-context-preview');
    if (preview) {
      preview.hidden = true;
      preview.innerHTML = '';
    }
  }

  function forceSummaryOn() {
    var toggle = $('toggle-summary');
    if (toggle && !toggle.checked) {
      toggle.checked = true;
      try {
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) { /* ignore */ }
    }
  }

  function showPreviewHtml(html) {
    var preview = $('maestro-context-preview');
    if (!preview) return;
    preview.innerHTML = html;
    preview.hidden = false;
  }

  function renderChips(list, label) {
    if (!list || !list.length) return '';
    var chips = list.slice(0, 12).map(function (t) {
      var labelText = typeof t === 'string' ? t : (t && (t.name || t.nom || t.label)) || String(t);
      return '<span class="maestro-chip">' + escapeHtml(String(labelText)) + '</span>';
    }).join('');
    return '<div><strong>' + escapeHtml(label) + '</strong><div class="maestro-chips">' + chips + '</div></div>';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function validateFile(file) {
    if (!file) return 'Aucun fichier.';
    if (file.size > MAX_BYTES) return 'Fichier trop volumineux (max 15 Mo).';
    if (!ACCEPT_EXT.test(file.name || '')) return 'Formats acceptés : PDF, DOC, DOCX, TXT.';
    return null;
  }

  function setFile(file) {
    var err = validateFile(file);
    if (err) {
      showPreviewHtml('<p class="maestro-preview-fail">' + escapeHtml(err) + '</p>');
      return;
    }
    state.file = file;
    state.contextId = null;
    state.lastPreview = null;
    forceSummaryOn();

    var drop = $('maestro-context-drop');
    if (drop) drop.classList.add('has-file');
    var nameEl = $('maestro-context-file-name');
    if (nameEl) {
      nameEl.hidden = false;
      nameEl.textContent = file.name + ' (' + Math.round(file.size / 1024) + ' Ko)';
    }
    var clearBtn = $('maestro-context-clear');
    if (clearBtn) clearBtn.hidden = false;

    showPreviewHtml('<p class="maestro-preview-loading">Analyse du brief…</p>');
    state.preAnalyzePromise = runPreAnalyze(file);
  }

  function isInvalidTokenError(data, res) {
    if (!data && res && res.status === 401) return true;
    var msg = String(
      (data && (data.errorMessage || data.userErrorMessage || data.message || data.error)) || ''
    ).toLowerCase();
    return msg.indexOf('invalid_token') !== -1 || msg.indexOf('invalid token') !== -1 ||
      msg.indexOf('error_invalid_token') !== -1;
  }

  function applyPreviewSuccess(data) {
    state.contextId = data.contextId || data.contextDocumentId || null;
    state.lastPreview = data;
    var parts = ['<p class="maestro-preview-ok">Brief prêt</p>'];
    var participants = data.participants || data.participantNames || [];
    var terms = data.terms || data.wordBoost || data.keywords || [];
    if (participants.length) parts.push(renderChips(participants, 'Participants'));
    if (terms.length) parts.push(renderChips(terms, 'Termes'));
    if (!participants.length && !terms.length && data.summary) {
      parts.push('<p class="text-color-grey">' + escapeHtml(String(data.summary).slice(0, 220)) + '</p>');
    }
    showPreviewHtml(parts.join(''));
    return state.contextId;
  }

  function postPreAnalyze(file, email, token) {
    var fd = new FormData();
    fd.append('username', email);
    fd.append('token', token);
    fd.append('edition', EDITION);
    fd.append('contextFile', file, file.name);

    console.log('[MaestroContext] preAnalyze', { username: email, hasToken: !!token, edition: EDITION });

    return fetch(API_PREANALYZE, {
      method: 'POST',
      body: fd
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        return { res: res, data: data };
      });
    });
  }

  function runPreAnalyze(file) {
    var email = resolveMemberEmail();
    if (!email) {
      showPreviewHtml('<p class="maestro-preview-warn">Email compte introuvable — le brief sera joint à l’envoi.</p>');
      return Promise.resolve(null);
    }

    return ensureTokenForEmail(email, false).then(function (ok) {
      var token = w.globalToken;
      if (!ok || !token) {
        showPreviewHtml('<p class="maestro-preview-warn">Connectez-vous pour analyser le brief. Le fichier sera joint à l’envoi.</p>');
        return null;
      }

      function handleResult(result, canRetry) {
        var res = result.res;
        var data = result.data;

        if (canRetry && isInvalidTokenError(data, res)) {
          return ensureTokenForEmail(email, true).then(function (ok2) {
            var token2 = w.globalToken;
            if (!ok2 || !token2) {
              showPreviewHtml('<p class="maestro-preview-warn">Session expirée — le brief sera joint à l’envoi.</p>');
              return null;
            }
            return postPreAnalyze(file, email, token2).then(function (r2) {
              return handleResult(r2, false);
            });
          });
        }

        if (!res.ok || !data || data.status !== 'OK') {
          var msg = (data && (data.userErrorMessage || data.errorMessage || data.message)) ||
            'Analyse impossible — le brief sera joint à l’envoi.';
          showPreviewHtml('<p class="maestro-preview-warn">' + escapeHtml(msg) + '</p>');
          return null;
        }
        return applyPreviewSuccess(data);
      }

      return postPreAnalyze(file, email, token).then(function (result) {
        return handleResult(result, true);
      }).catch(function () {
        showPreviewHtml('<p class="maestro-preview-warn">Réseau indisponible — le brief sera joint à l’envoi.</p>');
        return null;
      });
    });
  }

  function waitPreAnalyze() {
    if (!state.preAnalyzePromise) return Promise.resolve(null);
    return state.preAnalyzePromise.then(function (id) { return id; }, function () { return null; });
  }

  function hasActiveContext() {
    return !!(state.enabled && state.file);
  }

  /**
   * Appelé par upload_ent_v2 (branche 1.10) juste avant sendWithRetry(FormData).
   * Attend preAnalyze ; append contextId (prio) sinon contextFile ; force doSummary.
   */
  function enrichFormData(fd) {
    if (!hasActiveContext()) return Promise.resolve(fd);

    return waitPreAnalyze().then(function () {
      forceSummaryOn();
      try {
        fd.delete('doSummary');
      } catch (e) { /* ignore */ }
      fd.append('doSummary', 'true');

      if (state.contextId) {
        try { fd.delete('contextId'); } catch (e1) { /* ignore */ }
        try { fd.delete('contextFile'); } catch (e2) { /* ignore */ }
        fd.append('contextId', state.contextId);
      } else if (state.file) {
        try { fd.delete('contextFile'); } catch (e3) { /* ignore */ }
        fd.append('contextFile', state.file, state.file.name);
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

  function syncVisibility() {
    var block = $('maestro-context-block');
    if (!block) return;
    block.hidden = !isFileTabActive();
  }

  function bindUi() {
    var block = $('maestro-context-block');
    var input = $('maestro-context-file');
    if (!block || !input) {
      w.AgiloMaestroContext = {
        enrichFormData: function (fd) { return Promise.resolve(fd); },
        hasActiveContext: function () { return false; }
      };
      return;
    }

    if (input.hasAttribute('name')) input.removeAttribute('name');

    var switchEl = $('maestro-context-switch');
    if (switchEl) {
      function toggle() { setToggleChecked(!state.enabled, true); }
      switchEl.addEventListener('click', function (e) {
        e.preventDefault();
        toggle();
      });
      switchEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      });
    }

    input.addEventListener('change', function () {
      if (input.files && input.files[0]) setFile(input.files[0]);
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
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) setFile(f);
      });
    }

    var clearBtn = $('maestro-context-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function (e) {
        e.preventDefault();
        clearFile(false);
      });
    }

    document.querySelectorAll('.source-tab[data-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        setTimeout(syncVisibility, 0);
      });
    });

    setToggleChecked(readPref(), false);
    syncVisibility();

    w.AgiloMaestroContext = {
      enrichFormData: enrichFormData,
      hasActiveContext: hasActiveContext,
      clear: function () { clearFile(false); },
      getState: function () {
        return {
          enabled: state.enabled,
          hasFile: !!state.file,
          contextId: state.contextId,
          prefKey: PREF_KEY
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
