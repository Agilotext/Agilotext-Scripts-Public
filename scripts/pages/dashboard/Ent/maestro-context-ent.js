/**
 * maestro-context-ent.js — Agilotext Business / Maestro V1 B+
 * Branche Scripts-Public 1.10 (ne pas pousser sur @24cac26 / 1.09)
 *
 * Flux :
 *   drop brief → POST /api/v1/preAnalyzeContextDocument → contextId
 *   → enrichFormData append contextId (prio) ou contextFile
 *   → sendMultipleAudio (fileUpload1 inchangé, géré par upload_ent_v2.js)
 *
 * Garde-fous :
 *   - no-op si AGILO_MAESTRO_CONTEXT.enabled === false ou nodes absents
 *   - input #maestro-context-file SANS name (évite pollution FormData(form))
 *   - enrichFormData attend preAnalyze en cours (race)
 *   - token via ensureValidToken (exposé par upload_ent_v2)
 *   - max 15 Mo ; UI hors onglet Fichier masquée
 *   - force doSummary / toggle CR si contexte actif
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

  var state = {
    file: null,
    contextId: null,
    preAnalyzePromise: null,
    lastPreview: null,
    enabled: true
  };

  function $(id) { return document.getElementById(id); }

  function apiBase() {
    if (typeof w.getApiBase === 'function') return w.getApiBase();
    return 'https://agilotext.com';
  }

  function ensureToken() {
    if (typeof w.ensureValidToken === 'function') {
      return w.ensureValidToken();
    }
    return Promise.resolve(w.globalToken || null);
  }

  function setToggleChecked(on) {
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
    var rgpd = $('maestro-context-rgpd');
    if (rgpd) rgpd.hidden = !on;
    if (!on) {
      clearFile(true);
    }
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
    if (preview && !silent) {
      preview.hidden = true;
      preview.innerHTML = '';
    } else if (preview) {
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
      return '<span class="maestro-chip">' + escapeHtml(String(t)) + '</span>';
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

  function runPreAnalyze(file) {
    return ensureToken().then(function (token) {
      if (!token) {
        showPreviewHtml('<p class="maestro-preview-warn">Connectez-vous pour analyser le brief. Le fichier sera joint à l’envoi.</p>');
        return null;
      }
      var fd = new FormData();
      fd.append('token', token);
      fd.append('edition', EDITION);
      fd.append('contextFile', file, file.name);

      return fetch(apiBase() + '/api/v1/preAnalyzeContextDocument', {
        method: 'POST',
        body: fd,
        credentials: 'same-origin'
      }).then(function (res) {
        return res.json().catch(function () { return null; }).then(function (data) {
          if (!res.ok || !data || data.status !== 'OK') {
            var msg = (data && (data.userErrorMessage || data.errorMessage || data.message)) ||
              'Analyse impossible — le brief sera joint à l’envoi.';
            showPreviewHtml('<p class="maestro-preview-warn">' + escapeHtml(msg) + '</p>');
            return null;
          }
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
        });
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

    // Sécurité : jamais de name sur l'input doc
    if (input.hasAttribute('name')) input.removeAttribute('name');

    var switchEl = $('maestro-context-switch');
    if (switchEl) {
      function toggle() { setToggleChecked(!state.enabled); }
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

    setToggleChecked(true);
    syncVisibility();

    w.AgiloMaestroContext = {
      enrichFormData: enrichFormData,
      hasActiveContext: hasActiveContext,
      clear: function () { clearFile(false); },
      getState: function () {
        return {
          enabled: state.enabled,
          hasFile: !!state.file,
          contextId: state.contextId
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
