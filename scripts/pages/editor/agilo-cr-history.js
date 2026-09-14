// Agilotext – Historique CR (Relancer / Essayer). Horloge + Revenir.
// Contrat GET : listSummaryVersions / restoreSummaryVersion (aligné redoSummary). Strip url.
// 0 relance. Rien si previousVersions vide. Pas de maquette.
(function () {
  'use strict';

  const VERSION = '1.0.2';
  window.__agiloCrHistoryVersion = VERSION;

  const API_V1 = 'https://api.agilotext.com/api/v1';
  const ANCHOR_SEL = '[data-action="relancer-compte-rendu"]:not(.agilo-inline-gen-cr-btn)';
  const ROOT_ID = 'agilo-cr-hist';
  const COPY_FREE = 'Gratuit, ça ne consomme pas de relance';

  // --- agilo-cr-history helpers ---
  function stripVersionUrls(data) {
    if (!data || typeof data !== 'object') return data;
    const stripOne = function (row) {
      if (!row || typeof row !== 'object') return row;
      const copy = {};
      Object.keys(row).forEach(function (k) {
        if (k !== 'url') copy[k] = row[k];
      });
      return copy;
    };
    return {
      status: data.status,
      currentVersion: stripOne(data.currentVersion),
      previousVersions: Array.isArray(data.previousVersions)
        ? data.previousVersions.map(stripOne)
        : []
    };
  }

  function previousVersionsOf(data) {
    const stripped = stripVersionUrls(data || {});
    const list = Array.isArray(stripped.previousVersions) ? stripped.previousVersions.slice() : [];
    list.sort(function (a, b) {
      const ta = Date.parse(a && (a.archivedAt || a.createdAt)) || 0;
      const tb = Date.parse(b && (b.archivedAt || b.createdAt)) || 0;
      return tb - ta;
    });
    return list;
  }

  function shouldShowHistory(previousVersions) {
    return Array.isArray(previousVersions) && previousVersions.length > 0;
  }

  function canRestoreHistory(opts) {
    const o = opts || {};
    if (o.pending) return false;
    if (!o.versionId) return false;
    return shouldShowHistory(o.previousVersions);
  }

  function restoreIncrementsRegenerations() {
    return false;
  }

  function formatVersionWhen(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const date = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d);
    const time = new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(d);
    return date + ', ' + time;
  }

  function formatVersionTime(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(d);
  }

  function versionWhenIso(row) {
    if (!row) return '';
    return row.createdAt || row.archivedAt || '';
  }

  function formatVersionRow(row) {
    const when = formatVersionWhen(versionWhenIso(row));
    const model = String((row && (row.promptModelName || row.modelName)) || '').trim();
    if (when && model) return when + ' · ' + model;
    return when || model || 'Version précédente';
  }

  function formatUndoLabel(row) {
    const t = formatVersionTime(versionWhenIso(row));
    return t ? 'Revenir · ' + t : 'Revenir';
  }
  // --- end helpers ---

  function creds() {
    const c = window.__agiloEditorCreds;
    if (!c || typeof c.pickJobId !== 'function') return null;
    const edition = c.pickEdition();
    const email = c.pickEmail();
    const jobId = c.pickJobId();
    const token = c.pickToken(edition, email);
    if (!jobId || !email || !token) return null;
    return { edition: edition, email: email, jobId: String(jobId), token: token };
  }

  function isPending() {
    return Boolean(window.__agiloSummaryRegenInProgress);
  }

  function fetchGetWithRetry(url, maxAttempts) {
    var lastErr;
    var n = maxAttempts || 3;
    function attempt(a) {
      return fetch(url, { method: 'GET', cache: 'no-store', credentials: 'omit' }).catch(function (err) {
        lastErr = err;
        if (a < n) {
          return new Promise(function (resolve) {
            setTimeout(function () {
              resolve(attempt(a + 1));
            }, 400 * a);
          });
        }
        throw lastErr || new Error('fetch réseau');
      });
    }
    return attempt(1);
  }

  function getApi(path, extra) {
    const a = creds();
    if (!a) return Promise.resolve(null);
    const q = new URLSearchParams({
      username: a.email,
      token: a.token,
      edition: a.edition,
      jobId: a.jobId
    });
    Object.keys(extra || {}).forEach(function (k) {
      if (extra[k] !== undefined && extra[k] !== null) q.set(k, String(extra[k]));
    });
    q.set('_t', String(Date.now()));
    return fetchGetWithRetry(API_V1 + path + '?' + q.toString(), 3).then(function (r) {
      return r.json().catch(function () {
        return {};
      });
    });
  }

  function toast(msg) {
    if (typeof window.toast === 'function') {
      window.toast(msg);
      return;
    }
    if (typeof window.showSuccessMessage === 'function') {
      window.showSuccessMessage(msg);
    }
  }

  function refreshSummary(jobId) {
    const H = window.__agiloSummaryRegenHelpers;
    if (H && typeof H.refreshSummaryInEditorWithFallback === 'function') {
      H.refreshSummaryInEditorWithFallback(jobId, function () {
        return false;
      });
      return;
    }
    window.dispatchEvent(new CustomEvent('agilo:beforeload', { detail: { jobId: jobId, force: true } }));
    window.dispatchEvent(new CustomEvent('agilo:load', { detail: { jobId: jobId, force: true } }));
  }

  function injectStyles() {
    if (document.getElementById('agilo-cr-hist-css')) return;
    const style = document.createElement('style');
    style.id = 'agilo-cr-hist-css';
    style.textContent = `
      .agilo-cr-regen-cluster {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-end;
        gap: 4px 8px;
      }
      .agilo-cr-hist {
        display: none;
        position: relative;
        align-items: center;
        gap: 4px;
      }
      .agilo-cr-hist.is-on {
        display: flex;
        flex-basis: 100%;
        width: 100%;
        justify-content: flex-end;
      }
      .agilo-cr-hist__undo {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 0;
        background: transparent;
        color: #174a96;
        font: 600 13px/1.2 inherit;
        padding: 6px 4px;
        cursor: pointer;
        border-radius: 4px;
      }
      .agilo-cr-hist__undo:hover { text-decoration: underline; }
      .agilo-cr-hist__undo:focus-visible,
      .agilo-cr-hist__clock:focus-visible {
        outline: 0.125rem solid color-mix(in srgb, #174a96 70%, transparent);
        outline-offset: 2px;
      }
      .agilo-cr-hist__undo:disabled,
      .agilo-cr-hist__clock:disabled {
        opacity: 0.45;
        cursor: not-allowed;
        text-decoration: none;
      }
      .agilo-cr-hist__clock {
        width: 28px;
        height: 28px;
        padding: 0;
        border: 0;
        background: transparent;
        color: #525252;
        border-radius: 6px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .agilo-cr-hist__clock svg { width: 18px; height: 18px; display: block; }
      .agilo-cr-hist__clock:hover { background: #f3f4f6; color: #1a1a1a; }
      .agilo-cr-hist__clock[aria-expanded="true"] { background: #eef2f7; color: #174a96; }
      .agilo-cr-hist__pop {
        display: none;
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        width: 280px;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(17, 24, 39, 0.1);
        z-index: 40;
        padding: 6px;
      }
      .agilo-cr-hist.is-open .agilo-cr-hist__pop { display: block; }
      .agilo-cr-hist__head {
        display: flex;
        justify-content: flex-end;
        padding: 2px 2px 4px;
      }
      .agilo-cr-hist__close {
        width: 28px;
        height: 28px;
        border: 0;
        background: transparent;
        color: #525252;
        border-radius: 6px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .agilo-cr-hist__close:hover { background: #f3f4f6; }
      .agilo-cr-hist__row {
        width: 100%;
        text-align: left;
        border: 0;
        background: transparent;
        padding: 8px 10px;
        border-radius: 6px;
        cursor: pointer;
        font: 13px/1.35 inherit;
        color: #1a1a1a;
      }
      .agilo-cr-hist__row:hover { background: #f3f4f6; }
      .agilo-cr-hist__row[aria-selected="true"] { background: #eef2f7; }
      .agilo-cr-hist__foot {
        border-top: 1px solid #e5e7eb;
        margin-top: 4px;
        padding: 8px 10px 6px;
      }
      .agilo-cr-hist__foot p {
        margin: 0;
        font-size: 12px;
        color: #525252;
      }
    `;
    document.head.appendChild(style);
  }

  const ICO_UNDO =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><line x1="2.75" y1="9" x2="15.25" y2="9" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></line><polyline points="7 13.25 2.75 9 7 4.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></polyline></svg>';
  const ICO_CLOCK =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="7.25" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></circle><polyline points="9 4.75 9 9 12.25 11.25" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></polyline></svg>';
  const ICO_CLOSE =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><line x1="14" y1="4" x2="4" y2="14" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></line><line x1="4" y1="4" x2="14" y2="14" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></line></svg>';

  let root = null;
  let undoBtn = null;
  let clockBtn = null;
  let pop = null;
  let listEl = null;
  let previous = [];
  let selectedId = '';
  let restoring = false;

  function toolbarAnchor() {
    return document.querySelector(ANCHOR_SEL);
  }

  function placeRootAfterAnchor() {
    const anchor = toolbarAnchor();
    const parent = anchor && anchor.parentElement;
    if (!root || !parent) return;
    parent.classList.add('agilo-cr-regen-cluster');
    if (root.previousElementSibling === anchor && root.parentElement === parent) return;
    if (anchor.nextSibling) parent.insertBefore(root, anchor.nextSibling);
    else parent.appendChild(root);
  }

  function ensureRoot() {
    injectStyles();
    root = document.getElementById(ROOT_ID);
    if (root) {
      undoBtn = root.querySelector('.agilo-cr-hist__undo');
      clockBtn = root.querySelector('.agilo-cr-hist__clock');
      pop = root.querySelector('.agilo-cr-hist__pop');
      listEl = root.querySelector('.agilo-cr-hist__list');
      placeRootAfterAnchor();
      return root;
    }
    const anchor = toolbarAnchor();
    const parent = anchor && anchor.parentElement;
    if (!parent) return null;

    root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'agilo-cr-hist';
    root.innerHTML =
      '<button type="button" class="agilo-cr-hist__undo">' +
      ICO_UNDO +
      '<span class="agilo-cr-hist__undo-label">Revenir</span></button>' +
      '<button type="button" class="agilo-cr-hist__clock" aria-label="Comptes-rendus précédents" aria-expanded="false" aria-haspopup="dialog">' +
      ICO_CLOCK +
      '</button>' +
      '<div class="agilo-cr-hist__pop" role="dialog" aria-label="Comptes-rendus précédents">' +
      '<div class="agilo-cr-hist__head"><button type="button" class="agilo-cr-hist__close" aria-label="Fermer">' +
      ICO_CLOSE +
      '</button></div>' +
      '<div class="agilo-cr-hist__list"></div>' +
      '<div class="agilo-cr-hist__foot"><p>' +
      COPY_FREE +
      '</p></div></div>';

    if (anchor.nextSibling) parent.insertBefore(root, anchor.nextSibling);
    else parent.appendChild(root);
    parent.classList.add('agilo-cr-regen-cluster');

    undoBtn = root.querySelector('.agilo-cr-hist__undo');
    clockBtn = root.querySelector('.agilo-cr-hist__clock');
    pop = root.querySelector('.agilo-cr-hist__pop');
    listEl = root.querySelector('.agilo-cr-hist__list');

    undoBtn.addEventListener('click', function () {
      if (undoBtn.disabled) return;
      restoreVersion(selectedId || (previous[0] && previous[0].versionId));
    });
    clockBtn.addEventListener('click', function () {
      if (clockBtn.disabled) return;
      setOpen(!root.classList.contains('is-open'));
    });
    root.querySelector('.agilo-cr-hist__close').addEventListener('click', function () {
      setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });
    document.addEventListener('click', function (e) {
      if (!root || !root.classList.contains('is-open')) return;
      if (root.contains(e.target)) return;
      setOpen(false);
    });
    return root;
  }

  function setOpen(on) {
    if (!root) return;
    root.classList.toggle('is-open', Boolean(on));
    if (clockBtn) clockBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
  }

  function setBusy(on) {
    if (undoBtn) undoBtn.disabled = Boolean(on);
    if (clockBtn) clockBtn.disabled = Boolean(on);
    if (on) setOpen(false);
  }

  function renderList() {
    if (!root) return;
    const emptyCr = typeof window.agiloIsSummaryEmpty === 'function' && window.agiloIsSummaryEmpty();
    const show = !emptyCr && shouldShowHistory(previous);
    root.classList.toggle('is-on', show);
    if (!show) {
      setOpen(false);
      return;
    }
    const first = previous[0];
    const label = root.querySelector('.agilo-cr-hist__undo-label');
    if (label) label.textContent = formatUndoLabel(first);
    if (!selectedId) selectedId = first && first.versionId ? String(first.versionId) : '';
    if (!listEl) return;
    listEl.innerHTML = '';
    previous.forEach(function (row) {
      const id = String(row.versionId || '');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'agilo-cr-hist__row';
      btn.setAttribute('aria-selected', id && id === selectedId ? 'true' : 'false');
      btn.textContent = formatVersionRow(row);
      btn.addEventListener('click', function () {
        selectedId = id;
        renderList();
        restoreVersion(id);
      });
      listEl.appendChild(btn);
    });
  }

  function applyPending() {
    setBusy(isPending() || restoring);
  }

  function fetchList() {
    if (!creds()) {
      return Promise.resolve();
    }
    return getApi('/listSummaryVersions')
      .then(function (data) {
        if (!data || data.status !== 'OK') {
          return;
        }
        previous = previousVersionsOf(data);
        selectedId = previous[0] && previous[0].versionId ? String(previous[0].versionId) : '';
        if (ensureRoot()) renderList();
        applyPending();
      })
      .catch(function () {});
  }

  function scheduleFetchRetries() {
    [400, 1500].forEach(function (ms) {
      setTimeout(function () {
        if (previous.length === 0 && creds()) fetchList();
      }, ms);
    });
  }

  function restoreVersion(versionId) {
    const a = creds();
    if (!a) return;
    if (
      !canRestoreHistory({
        pending: isPending() || restoring,
        versionId: versionId,
        previousVersions: previous
      })
    ) {
      return;
    }
    if (restoreIncrementsRegenerations()) return;
    restoring = true;
    applyPending();
    getApi('/restoreSummaryVersion', { versionId: versionId })
      .then(function (data) {
        if (!data || data.status !== 'OK') {
          toast((data && (data.userErrorMessage || data.errorMessage)) || 'Restore impossible.');
          return;
        }
        refreshSummary(a.jobId);
        window.dispatchEvent(
          new CustomEvent('agilo:summary-restored', { detail: { jobId: a.jobId, versionId: versionId } })
        );
        toast('Compte-rendu remis. ' + COPY_FREE + '.');
        return fetchList();
      })
      .catch(function () {
        toast('Restore impossible.');
      })
      .then(function () {
        restoring = false;
        applyPending();
        setOpen(false);
      });
  }

  function onReady() {
    applyPending();
    fetchList();
  }

  function onPending() {
    applyPending();
  }

  function init() {
    window.addEventListener('agilo:summary-ready', onReady);
    window.addEventListener('agilo:summary-pending', onPending);
    window.addEventListener('agilo:load', function () {
      fetchList();
    });
    ensureRoot();
    fetchList();
    scheduleFetchRetries();
  }

  window.__agiloCrHistoryHelpers = {
    stripVersionUrls: stripVersionUrls,
    previousVersionsOf: previousVersionsOf,
    shouldShowHistory: shouldShowHistory,
    canRestoreHistory: canRestoreHistory,
    restoreIncrementsRegenerations: restoreIncrementsRegenerations,
    formatVersionWhen: formatVersionWhen,
    formatVersionRow: formatVersionRow,
    formatUndoLabel: formatUndoLabel,
    placeRoot: placeRootAfterAnchor
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 80);
  }
})();
