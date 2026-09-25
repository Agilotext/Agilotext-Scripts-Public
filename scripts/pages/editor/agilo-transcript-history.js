// Historique des sauvegardes rotatives de transcription, adjacent à Sauvegarder.
(function () {
  'use strict';

  if (window.__agiloTranscriptHistoryVersion) return;
  window.__agiloTranscriptHistoryVersion = '1.1.0-tab';

  const API = 'https://api.agilotext.com/api/v1';
  const ROOT_ID = 'agilo-tx-hist';
  const ANCHOR = '[data-action="save-transcript"]';
  const TIMEOUT_MS = 45000;
  const CLOCK = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="7.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 4.75V9l3.25 2.25" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"/></svg>';
  const UNDO = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M15 9H3m4-4L3 9l4 4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/></svg>';
  const UNDO_HINT = 'Revenir à une sauvegarde précédente de la transcription';
  const CLOCK_HINT = 'Historique des sauvegardes de la transcription';

  function parseApiDate(value) {
    const match = /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(String(value || ''));
    if (!match) return null;
    const [, dd, mm, yyyy, hh, min, sec] = match;
    const date = new Date(+yyyy, +mm - 1, +dd, +hh, +min, +sec);
    if (date.getFullYear() !== +yyyy || date.getMonth() !== +mm - 1 || date.getDate() !== +dd ||
        date.getHours() !== +hh || date.getMinutes() !== +min || date.getSeconds() !== +sec) return null;
    return { key: `${yyyy}${mm}${dd}${hh}${min}${sec}`, display: `${dd}/${mm}/${yyyy} ${hh}:${min}`, time: `${hh}:${min}` };
  }

  function cleanSavedList(data) {
    if (!data || data.status !== 'OK' || !Array.isArray(data.savedTranscripts)) throw new Error('history_unavailable');
    const rows = data.savedTranscripts.map((row) => {
      const index = Number(row?.index);
      const date = parseApiDate(row?.date);
      if (!Number.isInteger(index) || index < 0 || index > 9 || !date ||
          typeof row.filename !== 'string' || !row.filename.trim()) throw new Error('history_invalid');
      return { index, date: String(row.date), filename: row.filename, parsed: date };
    });
    if (new Set(rows.map((row) => row.index)).size !== rows.length) throw new Error('history_invalid');
    return rows.sort((a, b) => b.parsed.key.localeCompare(a.parsed.key) || a.index - b.index);
  }

  function validateTranscript(dto, jobId) {
    if (!dto || typeof dto !== 'object' || Array.isArray(dto) || dto.status === 'KO' ||
        String(dto.job_meta?.jobId) !== String(jobId) ||
        !Array.isArray(dto.segments) || !dto.segments.length) throw new Error('transcript_invalid');
    for (const seg of dto.segments) {
      if (!seg || typeof seg.id !== 'string' ||
          !Number.isSafeInteger(seg.milli_start) || seg.milli_start < 0 ||
          !Number.isSafeInteger(seg.milli_end) || seg.milli_end < seg.milli_start ||
          typeof seg.speaker !== 'string' || typeof seg.text !== 'string') throw new Error('transcript_invalid');
    }
    if (!dto.segments.some((seg) => seg.text.trim())) throw new Error('transcript_empty');
    return dto;
  }

  function canonicalSegments(segments) {
    if (!Array.isArray(segments)) return '';
    return JSON.stringify(segments.map((s) => ({
      start: Math.floor(Number(s.milli_start) / 1000),
      end: Math.floor(Number(s.milli_end) / 1000),
      speaker: String(s.speaker || '').trim(),
      text: String(s.text || '').replace(/\\n/g, '\n').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ')
    })));
  }

  function sameTranscript(left, right) {
    return canonicalSegments(left?.segments) === canonicalSegments(right?.segments);
  }

  function creds() {
    const helper = window.__agiloEditorCreds;
    if (!helper) return null;
    const edition = helper.pickEdition();
    const username = helper.pickEmail();
    const jobId = String(helper.pickJobId() || '');
    const token = helper.pickToken(edition, username);
    return username && jobId && token ? { edition, username, jobId, token } : null;
  }

  async function post(path, extra, timeout = TIMEOUT_MS, fixedAuth = null) {
    const auth = fixedAuth || creds();
    if (!auth) throw new Error('credentials_missing');
    const body = new URLSearchParams({
      username: auth.username, token: auth.token, edition: auth.edition, jobId: auth.jobId
    });
    for (const [key, value] of Object.entries(extra || {})) body.set(key, String(value));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(API + path, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: body.toString(), credentials: 'omit', cache: 'no-store', signal: controller.signal
      });
      const raw = await response.text();
      let data;
      try { data = JSON.parse(raw); } catch (_) {
        const error = new Error('invalid_json');
        error.httpStatus = response.status;
        throw error;
      }
      if (!response.ok || data?.status === 'KO') {
        const error = new Error(String(data?.errorMessage || 'api_error'));
        error.httpStatus = response.status;
        throw error;
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  let root, undoButton, clockButton, retryButton, listNode;
  let rows = [];
  let listState = 'idle';
  let listedJobId = '';
  let baseline = null;
  let baselineJobId = '';
  let restoring = false;
  let listRequest = 0;

  function announce(message) {
    if (typeof window.toast === 'function') window.toast(message);
    else if (typeof window.showSuccessMessage === 'function') window.showSuccessMessage(message);
    else console.info('[agilo:tx-history]', message);
  }

  function activeTabId() {
    const tab = document.querySelector('[role="tab"][aria-selected="true"]');
    return tab ? String(tab.id || '') : '';
  }
  function isTranscriptTab(tabId) { return tabId === 'tab-transcript'; }
  function isTranscriptVisible() {
    const tabId = activeTabId();
    if (tabId) return isTranscriptTab(tabId);
    const anchor = document.querySelector(ANCHOR);
    return Boolean(anchor && getComputedStyle(anchor).display !== 'none' && getComputedStyle(anchor).visibility !== 'hidden');
  }
  function bindTabVisibility(onChange) {
    document.addEventListener('click', (event) => {
      if (event.target.closest('[role="tab"]')) requestAnimationFrame(onChange);
    });
    new MutationObserver(onChange).observe(document.documentElement, {
      attributes: true, subtree: true, attributeFilter: ['aria-selected']
    });
  }

  function busy() {
    return restoring || Boolean(window.__agiloSavePending) || Boolean(window.__agiloSaveInProgress) || Boolean(window.__agiloSummaryRegenInProgress);
  }

  function injectStyles() {
    if (document.getElementById(ROOT_ID + '-css')) return;
    const style = document.createElement('style');
    style.id = ROOT_ID + '-css';
    style.textContent = `
      .agilo-tx-hist{display:none;position:relative;align-items:center;gap:4px;font-family:inherit}
      .agilo-tx-hist.is-on{display:inline-flex}
      .agilo-tx-hist [hidden]{display:none!important}
      .agilo-tx-hist__undo,.agilo-tx-hist__clock{border:0;background:transparent;cursor:pointer;border-radius:6px;display:inline-flex;align-items:center;justify-content:center}
      .agilo-tx-hist__undo{gap:6px;color:#174a96;font:600 13px/1.2 inherit;padding:6px 4px;border-radius:6px}
      .agilo-tx-hist__undo:hover{text-decoration:underline}
      .agilo-tx-hist__retry{border:0;background:transparent;color:#525252;cursor:pointer;font-family:inherit;font-size:12px;line-height:1.2;padding:6px}
      .agilo-tx-hist__retry:hover{text-decoration:underline}
      .agilo-tx-hist__clock{width:28px;height:28px;color:#525252}
      .agilo-tx-hist__clock:hover,.agilo-tx-hist__clock[aria-expanded="true"]{background:#eef2f7;color:#174a96}
      .agilo-tx-hist button:disabled{opacity:.45;cursor:not-allowed;text-decoration:none}
      .agilo-tx-hist button:focus-visible{outline:2px solid #174a96;outline-offset:2px}
      .agilo-tx-hist__pop{display:none;position:absolute;top:calc(100% + 4px);right:0;width:300px;max-width:min(90vw,300px);background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 8px 24px #1118271a;z-index:50;padding:6px}
      .agilo-tx-hist.is-open .agilo-tx-hist__pop{display:block}
      .agilo-tx-hist__head{display:flex;justify-content:space-between;align-items:center;padding:4px 8px;font-size:13px;font-weight:600}
      .agilo-tx-hist__close{border:0;background:transparent;cursor:pointer;font-size:18px;color:#525252}
      .agilo-tx-hist__row{display:block;width:100%;text-align:left;border:0;background:transparent;padding:8px 10px;border-radius:6px;cursor:pointer;font-family:inherit;font-size:13px;line-height:1.35;color:#1a1a1a}
      .agilo-tx-hist__row:hover{background:#f3f4f6}
      .agilo-tx-hist__foot{border-top:1px solid #e5e7eb;margin-top:4px;padding:8px 10px 6px;font-size:12px;color:#525252}
    `;
    document.head.appendChild(style);
  }

  function ensureRoot() {
    const anchor = document.querySelector(ANCHOR);
    if (!anchor?.parentElement) return false;
    injectStyles();
    if (root) {
      if (root.parentElement !== anchor.parentElement || root.previousElementSibling !== anchor) anchor.after(root);
      return true;
    }
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'agilo-tx-hist';
    root.innerHTML = `<button type="button" class="agilo-tx-hist__undo" title="${UNDO_HINT}" aria-label="${UNDO_HINT}">${UNDO}<span>Revenir</span></button>` +
      `<button type="button" class="agilo-tx-hist__clock" title="${CLOCK_HINT}" aria-label="${CLOCK_HINT}" aria-expanded="false" aria-haspopup="dialog">${CLOCK}</button>` +
      '<button type="button" class="agilo-tx-hist__retry">Historique indisponible · réessayer</button>' +
      '<div class="agilo-tx-hist__pop" role="dialog" aria-label="Historique des transcriptions">' +
      '<div class="agilo-tx-hist__head"><span>Transcriptions précédentes</span><button type="button" class="agilo-tx-hist__close" aria-label="Fermer">×</button></div>' +
      '<div class="agilo-tx-hist__list"></div>' +
      '<div class="agilo-tx-hist__foot">Le compte-rendu peut ne plus correspondre. Régénérez-le après le retour.</div></div>';
    anchor.after(root);
    undoButton = root.querySelector('.agilo-tx-hist__undo');
    clockButton = root.querySelector('.agilo-tx-hist__clock');
    retryButton = root.querySelector('.agilo-tx-hist__retry');
    listNode = root.querySelector('.agilo-tx-hist__list');
    undoButton.addEventListener('click', () => restore(rows[0]));
    clockButton.addEventListener('click', () => setOpen(!root.classList.contains('is-open')));
    retryButton.addEventListener('click', () => fetchList().catch(() => {}));
    root.querySelector('.agilo-tx-hist__close').addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setOpen(false); });
    document.addEventListener('click', (event) => { if (!root.contains(event.target)) setOpen(false); });
    return true;
  }

  function setOpen(open) {
    if (!root) return;
    root.classList.toggle('is-open', Boolean(open));
    clockButton.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function render() {
    if (!ensureRoot()) return;
    const showHistory = listState === 'ready' && listedJobId === creds()?.jobId && rows.length > 0;
    const showError = listState === 'error' && Boolean(creds());
    const show = (showHistory || showError) && isTranscriptVisible();
    root.classList.toggle('is-on', show);
    if (!show) setOpen(false);
    undoButton.hidden = !showHistory;
    clockButton.hidden = !showHistory;
    retryButton.hidden = !showError;
    retryButton.disabled = busy();
    const disabled = busy() || listState !== 'ready' || !baseline || baselineJobId !== creds()?.jobId;
    undoButton.disabled = disabled;
    clockButton.disabled = busy() || listState !== 'ready';
    undoButton.querySelector('span').textContent = rows[0] ? `Revenir · ${rows[0].parsed.time}` : 'Revenir';
    listNode.replaceChildren();
    for (const row of rows) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'agilo-tx-hist__row';
      button.textContent = `${row.parsed.display}${row.filename ? ` · ${row.filename}` : ''}`;
      button.disabled = disabled;
      button.addEventListener('click', () => restore(row));
      listNode.appendChild(button);
    }
    if (disabled) setOpen(false);
  }

  async function fetchList(fixedAuth = null) {
    const request = ++listRequest;
    if (!(fixedAuth || creds())) { rows = []; listedJobId = ''; listState = 'disabled'; render(); return []; }
    try {
      const cleaned = cleanSavedList(await post('/listSavedTranscripts', null, TIMEOUT_MS, fixedAuth));
      if (request === listRequest && (!fixedAuth || creds()?.jobId === fixedAuth.jobId)) {
        rows = cleaned; listedJobId = (fixedAuth || creds()).jobId; listState = cleaned.length ? 'ready' : 'empty'; render();
      }
      return cleaned;
    } catch (error) {
      if (request === listRequest && (!fixedAuth || creds()?.jobId === fixedAuth.jobId)) {
        listState = [404, 405, 501].includes(error.httpStatus) || /history[_ ]disabled|not[_ ]implemented|endpoint[_ ]disabled/i.test(error.message)
          ? 'disabled' : 'error';
        render();
      }
      throw error;
    }
  }

  function onLoaded(event) {
    const jobId = String(event?.detail?.jobId || '');
    const transcript = event?.detail?.transcript;
    try {
      validateTranscript(transcript, jobId);
      baseline = transcript;
      baselineJobId = jobId;
    } catch (_) {
      baseline = null;
      baselineJobId = '';
    }
    render();
    if (!restoring) fetchList().catch(() => {});
  }

  function onSaved(event) {
    const detail = event?.detail || {};
    if (String(detail.jobId || '') !== creds()?.jobId) return;
    if (!restoring && detail.transcript) {
      try {
        baseline = validateTranscript(detail.transcript, detail.jobId);
        baselineJobId = String(detail.jobId);
      } catch (_) {}
    }
    if (!restoring) fetchList().catch(() => {});
    render();
  }

  function waitForLoad(jobId) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        window.removeEventListener('agilo:transcript-loaded', handler);
        reject(new Error('reload_timeout'));
      }, TIMEOUT_MS);
      function handler(event) {
        if (String(event?.detail?.jobId || '') !== jobId) return;
        clearTimeout(timer);
        window.removeEventListener('agilo:transcript-loaded', handler);
        resolve(event.detail.transcript);
      }
      window.addEventListener('agilo:transcript-loaded', handler);
    });
  }

  async function restoreTransaction(options) {
    const { row, jobId, reference, list, display, current, local, presave, write, reload, finish, checkJob } = options;
    const fresh = await list();
    if (!fresh.some((item) => item.index === row.index && item.date === row.date && item.filename === row.filename)) {
      throw new Error('slot_changed');
    }
    checkJob();
    const target = validateTranscript(await display(row.index), jobId);
    const live = validateTranscript(await current(), jobId);
    if (!sameTranscript(live, reference)) throw new Error('server_changed');
    const pick = await local();
    if (!Array.isArray(pick?.segmentsMs)) throw new Error('save_unavailable');
    if (!sameTranscript({segments:pick.segmentsMs}, reference)) {
      const saved = await presave();
      if (!saved?.ok) {
        const reason = String(saved?.error || saved?.reason || '');
        throw new Error(/error_transcript_not_ready|READY_SUMMARY_PENDING/i.test(reason)
          ? 'error_transcript_not_ready' : 'presave_failed');
      }
    }
    checkJob();
    const result = await write(target);
    if (!result?.ok) throw new Error(String(result?.reason || 'restore_failed'));
    checkJob();
    const displayed = validateTranscript(await reload(), jobId);
    if (!sameTranscript(displayed, target)) throw new Error('reload_mismatch');
    checkJob();
    await finish();
    return target;
  }

  async function restore(row) {
    const auth = creds();
    if (!row || !auth || busy() || !baseline || baselineJobId !== auth.jobId || !isTranscriptVisible()) return;
    restoring = true;
    window.__agiloTranscriptHistoryRestoring = true;
    let serverWritten = false;
    render();
    try {
      if (typeof window.agiloGetPayload !== 'function' || typeof window.agiloPostTranscriptFromBackupJson !== 'function') {
        throw new Error('save_unavailable');
      }
      await restoreTransaction({
        row, jobId: auth.jobId, reference: baseline,
        list: () => fetchList(auth),
        display: (index) => post('/displaySavedTranscript', {savedTranscriptIndex:index, format:'txt'}, TIMEOUT_MS, auth),
        current: () => post('/receiveTextJson', null, TIMEOUT_MS, auth),
        local: async () => {
          const payload = await window.agiloGetPayload();
          if (String(payload.creds.jobId) !== auth.jobId) throw new Error('job_changed');
          return payload.pick;
        },
        presave: () => window.agiloSaveCurrentForHistory(),
        write: async (dto) => {
          const result = await window.agiloPostTranscriptFromBackupJson(dto);
          serverWritten = Boolean(result?.ok);
          return result;
        },
        reload: () => {
          const loaded = waitForLoad(auth.jobId);
          window.dispatchEvent(new CustomEvent('agilo:load', {detail:{jobId:auth.jobId, force:true, reason:'transcript-history'}}));
          return loaded;
        },
        finish: () => window.agiloFinishTranscriptRestore(auth.jobId),
        checkJob: () => { if (creds()?.jobId !== auth.jobId) throw new Error('job_changed'); }
      });
      window.dispatchEvent(new CustomEvent('agilo:transcript-restored', {
        detail: { jobId: auth.jobId, savedTranscriptIndex: row.index }
      }));
      await fetchList(auth);
      announce('Transcription restaurée. Régénérez le compte-rendu si nécessaire.');
    } catch (error) {
      const messages = {
        slot_changed: 'Cette sauvegarde a changé. Ouvrez à nouveau l’historique.',
        server_changed: 'La transcription a été modifiée dans un autre onglet. Rechargez la page avant de revenir.',
        job_changed: 'Le job affiché a changé. Vérifiez la transcription avant de réessayer.',
        presave_failed: 'La version actuelle n’a pas pu être sauvegardée. Aucun retour effectué.',
        error_transcript_not_ready: 'Le compte-rendu est en préparation. Réessayez lorsque la transcription est prête.',
        reload_timeout: 'Le serveur a enregistré le retour, mais l’éditeur ne s’est pas rechargé. Rechargez la page.',
        reload_mismatch: 'Le retour est enregistré, mais le contenu affiché ne correspond pas. Rechargez la page.'
      };
      announce(messages[error.message] || (serverWritten
        ? 'Le retour est enregistré, mais la vérification a échoué. Rechargez la page.'
        : 'Retour impossible. La transcription actuelle reste affichée.'));
      console.warn('[agilo:tx-history] restore failed:', error.message);
      fetchList().catch(() => {});
    } finally {
      restoring = false;
      window.__agiloTranscriptHistoryRestoring = false;
      setOpen(false);
      render();
    }
  }

  function init() {
    bindTabVisibility(render);
    window.addEventListener('agilo:transcript-loaded', onLoaded);
    window.addEventListener('agilo:transcript-saved', onSaved);
    window.addEventListener('agilo:transcript-save-busy', render);
    document.addEventListener('agilo:save-visibility', render);
    window.addEventListener('agilo:summary-pending', render);
    window.addEventListener('agilo:summary-ready', render);
    window.addEventListener('online', () => fetchList().catch(() => {}));
    window.addEventListener('agilo:load', () => { listState = 'idle'; rows = []; render(); setTimeout(() => fetchList().catch(() => {}), 150); });
    const last = window.__agiloLastLoadedTranscript;
    if (last) onLoaded({detail:last});
    ensureRoot();
    render();
    fetchList().catch(() => {});
    let attempts = 0;
    const mount = setInterval(() => {
      if (ensureRoot() || ++attempts > 30) clearInterval(mount);
      render();
    }, 500);
    let previousBusy = busy();
    setInterval(() => {
      const nextBusy = busy();
      if (nextBusy !== previousBusy) { previousBusy = nextBusy; render(); }
    }, 500);
  }

  window.__agiloTxHistoryHelpers = { parseApiDate, cleanSavedList, validateTranscript, canonicalSegments, sameTranscript, restoreTransaction, isTranscriptTab, isTranscriptVisible };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
