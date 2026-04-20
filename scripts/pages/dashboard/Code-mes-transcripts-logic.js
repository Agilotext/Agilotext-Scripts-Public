(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  LISTE DES JOBS — UNIVERSEL (Free, Pro, Enterprise)
  //  - Titres intelligents (jobTitle)
  //  - Actions en masse (Bulk Actions: Delete, Export, Webhook)
  //  - Détection automatique de l'édition
  //  - UI Dialog & Confirmation intégrée
  // ═══════════════════════════════════════════════════════════════════

  const VERSION = '1.1.0';
  const API_BASE = 'https://api.agilotext.com/api/v1';

  // --- Thème UI (Dialog + List) ---------------------------------------
  (function injectUITheme() {
    if (document.getElementById('agilo-unified-theme')) return;
    const css = `
      .is-disabled { opacity: .6; cursor: not-allowed; }
      .is-verifying { cursor: progress; }
      .file-name-input { width: 100%; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
      
      .agilo-overlay{position:fixed; inset:0; display:none; z-index:99999; background: rgba(0,0,0,.35);}
      .agilo-modal{max-width:560px; margin:6vh auto; background:#fff; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,.2); overflow:hidden; color: #333; font-family: sans-serif;}
      .agilo-modal__header{padding:18px 22px; border-bottom:1px solid #eee; background: #fff;}
      .agilo-modal__title{margin:0; font-size:18px; font-weight: 600;}
      .agilo-modal__subtitle{margin:6px 0 0; color: #666; font-size:14px;}
      .agilo-modal__body{padding:16px 22px; max-height:60vh; overflow:auto; background: #fff; line-height: 1.5;}
      .agilo-modal__footer{display:flex; gap:8px; justify-content:flex-end; padding:14px 16px; border-top:1px solid #eee; background: #f9f9f9;}
      
      .agilo-block{margin-bottom:14px;}
      .agilo-block__heading{font-weight:600; margin-bottom:4px;}
      .agilo-block__text{color: #444; margin-bottom:6px;}
      .agilo-block__pre{white-space:pre-wrap; background: #f4f4f4; border:1px solid #ddd; border-radius: 4px; padding:8px; margin-top:6px; font-size:12px; font-family: monospace;}
      
      .agilo-btn, .agilo-link{padding:10px 16px; border-radius: 6px; border:1px solid #ddd; background: #fff; color: #333; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; font-size: 14px; font-weight: 500; transition: all .15s ease;}
      .agilo-btn:hover{background: #f0f0f0; border-color: #ccc;}
      .agilo-btn--primary{border-color: #0056b3; background: #0056b3; color: #fff;}
      .agilo-btn--primary:hover{background: #004494; border-color: #004494;}
      .agilo-btn--danger{border-color: #dc3545; background: #dc3545; color: #fff;}
      .agilo-btn--danger:hover{background: #c82333; border-color: #bd2130;}
      
      .agilo-linklist{font-size:13px;}
      .agilo-linklist a{display:block; margin:4px 0; color: #0056b3; text-decoration: none;}
      .agilo-linklist a:hover{text-decoration: underline;}
      .agilo-kbdrow{display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px;}
    `;
    const st = document.createElement('style');
    st.id = 'agilo-unified-theme';
    st.textContent = css;
    document.head.appendChild(st);
  })();

  // --- Dialog & UI Elements -------------------------------------------
  function ensureDialog() {
    if (document.getElementById('agilo-dialog')) return;
    const html = `
      <div id="agilo-dialog" role="dialog" aria-modal="true" class="agilo-overlay" lang="fr">
        <div class="agilo-modal">
          <div class="agilo-modal__header">
            <h3 id="agilo-dialog-title" class="agilo-modal__title">Résultat</h3>
            <p id="agilo-dialog-sub" class="agilo-modal__subtitle"></p>
          </div>
          <div id="agilo-dialog-body" class="agilo-modal__body"></div>
          <div class="agilo-modal__footer" id="agilo-dialog-footer">
            <button id="agilo-dialog-close" class="agilo-btn">Fermer</button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('agilo-dialog-close').addEventListener('click', () => hideDialog());
    document.getElementById('agilo-dialog').addEventListener('click', (e) => { if(e.target.id === 'agilo-dialog') hideDialog(); });
  }

  function hideDialog() { 
    const m = document.getElementById('agilo-dialog'); 
    if (m) m.style.display = 'none'; 
  }

  function showDialog({ title, subtitle, blocks, footerHtml }) {
    ensureDialog();
    document.getElementById('agilo-dialog-title').textContent = title || 'Information';
    document.getElementById('agilo-dialog-sub').textContent = subtitle || '';
    const body = document.getElementById('agilo-dialog-body');
    body.innerHTML = '';
    (blocks || []).forEach(b => {
      const box = document.createElement('div');
      box.className = 'agilo-block';
      box.innerHTML = `
        ${b.heading ? `<div class="agilo-block__heading">${b.heading}</div>` : ''}
        ${b.text ? `<div class="agilo-block__text">${b.text}</div>` : ''}
        ${b.html ? b.html : ''}
        ${b.cta ? `<a href="${b.cta.href}" ${b.cta.sameTab ? '' : 'target="_blank"'} class="agilo-link">${b.cta.label}</a>` : ''}
        ${b.details ? `<details style="margin-top:8px"><summary style="cursor:pointer; font-size:12px; color:#666">Détails techniques</summary><pre class="agilo-block__pre">${b.details}</pre></details>` : ''}`;
      body.appendChild(box);
    });
    
    // Restaurer le bouton fermer par défaut ou utiliser le footer spécial
    const footer = document.getElementById('agilo-dialog-footer');
    if (footerHtml) {
      footer.innerHTML = footerHtml;
    } else {
      footer.innerHTML = `<button id="agilo-dialog-close" class="agilo-btn">Fermer</button>`;
      document.getElementById('agilo-dialog-close').addEventListener('click', () => hideDialog());
    }
    
    document.getElementById('agilo-dialog').style.display = 'block';
  }

  function showConfirmation({ title, message, confirmText = "Oui", cancelText = "Non", confirmClass = "agilo-btn--primary" }) {
    return new Promise((resolve) => {
      showDialog({
        title,
        blocks: [{ html: `<div class="agilo-block__text">${message}</div>` }],
        footerHtml: `
          <button id="agilo-confirm-yes" class="agilo-btn ${confirmClass}">${confirmText}</button>
          <button id="agilo-confirm-no" class="agilo-btn">${cancelText}</button>
        `
      });
      document.getElementById('agilo-confirm-yes').addEventListener('click', () => { hideDialog(); resolve(true); });
      document.getElementById('agilo-confirm-no').addEventListener('click', () => { hideDialog(); resolve(false); });
    });
  }

  // --- Utilitaires ----------------------------------------------------
  function convertDateStringToDate(dateString) {
    if (!dateString) return new Date();
    const parts = dateString.split(/[- :]/);
    return new Date(parts[2], parts[1] - 1, parts[0], parts[3], parts[4], parts[5]);
  }

  function sanitizeFilenameBase(base) {
    return (base || "").replace(/[<>:"/\\|?*\x00-\x1F]/g, "").replace(/\s+/g, " ").trim();
  }

  function extractErrorMessage(javaException) {
    if (!javaException) return 'Cause inconnue.';
    const parts = javaException.split(':');
    return (parts.length > 1 ? parts.slice(1).join(':') : javaException).trim();
  }

  function stemDisplay(fn) {
    const s = String(fn || '');
    const i = s.lastIndexOf('.');
    return i > 0 ? s.slice(0, i) : s;
  }

  function displayJobTitle(job) {
    if (!job) return 'Transcript';
    const jt = (job.jobTitle != null ? String(job.jobTitle) : '').trim();
    if (jt) return jt;
    const fn = job.filename || '';
    if (fn) return stemDisplay(fn) || fn;
    return 'Transcript';
  }

  // --- Détection de l'édition -----------------------------------------
  function normalizeEdition(v) {
    v = String(v || '').trim().toLowerCase();
    if (/(^ent$|enterprise|entreprise|business|team|biz)/.test(v)) return 'ent';
    if (/^pro/.test(v)) return 'pro';
    if (/^free|gratuit/.test(v)) return 'free';
    return 'ent';
  }

  function getEdition() {
    const fromQS = new URLSearchParams(location.search).get('edition');
    const fromRoot = document.getElementById('editorRoot')?.dataset?.edition || document.querySelector('.dashboard-content')?.dataset?.edition;
    const fromHtml = document.documentElement?.getAttribute('data-edition');
    const fromLS = localStorage.getItem('agilo:edition');
    return normalizeEdition(fromQS || fromRoot || fromHtml || fromLS || 'ent');
  }

  const __GLOBAL = { token: null, email: null, edition: getEdition() };

  // --- Garde de liens -------------------------------------------------
  function setDownloadLink(link, href, disabledMsg = '') {
    if (!link) return;
    if (link.__clickHandler) { link.removeEventListener('click', link.__clickHandler); link.__clickHandler = null; }
    if (!disabledMsg) {
      link.classList.remove('is-disabled', 'is-verifying');
      link.setAttribute('href', href);
      link.setAttribute('target', '_blank');
      link.style.pointerEvents = '';
      return;
    }
    link.classList.add('is-disabled'); link.setAttribute('href', '#'); link.removeAttribute('target');
    link.__clickHandler = (e) => { e.preventDefault(); alert(disabledMsg); };
    link.addEventListener('click', link.__clickHandler);
  }

  // --- API calls ------------------------------------------------------
  const _assetOkCache = new Map();
  async function verifyAssetOnce(jobId, url, key) {
    if (_assetOkCache.has(key)) return _assetOkCache.get(key);
    let ok = false;
    try {
      const r = await fetch(url, { method: 'GET', cache: 'no-store' });
      const ct = (r.headers.get('content-type') || '').toLowerCase();
      const cd = r.headers.get('content-disposition') || '';
      if (r.ok && (/attachment|filename=/i.test(cd) || /(application\/pdf|msword|officedocument|rtf)/.test(ct))) ok = true;
      else {
        const text = await r.text();
        if (/"status"\s*:\s*"OK"/i.test(text)) ok = true;
        else ok = r.ok && (ct.includes('text/html') || text.trim().length > 0) && !/"status"\s*:\s*"KO"/i.test(text);
      }
    } catch { ok = false; }
    _assetOkCache.set(key, ok); return ok;
  }

  function guardClick(a, url, jobId, key, failMsg) {
    if (!a || a.__guarded) return; a.__guarded = true;
    a.addEventListener('click', async (e) => {
      if (a.getAttribute('href') !== '#') return;
      e.preventDefault(); a.classList.add('is-verifying');
      const ok = await verifyAssetOnce(jobId, url, key);
      a.classList.remove('is-verifying');
      if (ok) { setDownloadLink(a, url); window.open(url, '_blank'); }
      else alert(failMsg);
    });
  }

  async function renameOnServer({ jobId, userEmail, token, edition, newFilename }) {
    const body = new URLSearchParams({ username: userEmail, token, edition, jobId: String(jobId), filename: newFilename });
    try {
      const r = await fetch(`${API_BASE}/renameTranscriptFile`, {
        method: "POST", headers: { "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString()
      });
      const data = await r.json();
      return { ok: data.status === "OK", error: data.errorMessage || data.error };
    } catch (e) { return { ok: false, error: "Erreur réseau" }; }
  }

  function setupInlineRename({ anchorEl, buttonEl, job, userEmail, token, edition }) {
    if (!anchorEl || !buttonEl) return;
    buttonEl.addEventListener("click", () => {
      if (anchorEl.__editing) return;
      anchorEl.__editing = true;
      
      const currentFullFilename = (job.filename || "").trim();
      const dot = currentFullFilename.lastIndexOf(".");
      const ext = dot > 0 ? currentFullFilename.slice(dot) : "";
      
      const currentTitle = (anchorEl.textContent || "").trim();
      const input = document.createElement("input");
      input.className = "file-name-input";
      input.value = currentTitle;
      
      anchorEl.replaceWith(input);
      input.focus(); input.select();
      
      const cleanup = () => { if(input.parentNode) input.replaceWith(anchorEl); anchorEl.__editing = false; };
      
      const commit = async () => {
        let typedVal = input.value.trim();
        if (!typedVal) { cleanup(); return; }
        
        // Si l'utilisateur a tapé l'extension, on l'enlève pour éviter les doublons type .mp3.mp3
        if (ext && typedVal.toLowerCase().endsWith(ext.toLowerCase())) {
          typedVal = typedVal.slice(0, -ext.length);
        }
        
        const newBase = sanitizeFilenameBase(typedVal);
        const newFilename = `${newBase}${ext}`;
        
        if (newFilename === currentFullFilename) { cleanup(); return; }
        
        const res = await renameOnServer({ jobId: job.jobid, userEmail, token, edition, newFilename });
        if (res.ok) {
          anchorEl.textContent = typedVal; // On affiche le nouveau titre (sans extension)
          anchorEl.setAttribute("download", newFilename);
          job.filename = newFilename;
        } else {
          alert(`Renommage impossible : ${res.error || 'Erreur inconnue'}`);
        }
        cleanup();
      };
      
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") cleanup(); });
      input.addEventListener("blur", commit);
    });
  }

  // --- Bulk Actions Module -------------------------------------------
  const AgilotextBulk = (function() {
    const SELECTORS = {
      container: '#jobs-container',
      row: '.wrapper-content_item-row',
      selectAll: '#select-all',
      selectedCount: '#selected-count',
      exportBtn: '#exportBtn',
      resendWebhookBtn: '#resendWebhookBtn',
      bulkDeleteBtn: '#bulkDeleteBtn',
      automationProvider: '#automationProvider'
    };

    const getSelectedRows = () => Array.from(document.querySelectorAll(`${SELECTORS.container} ${SELECTORS.row} .job-select:checked`)).map(cb => cb.closest(SELECTORS.row));
    const getJobId = (row) => row?.getAttribute('data-job-id');

    async function pMap(array, mapper, concurrency = 4) {
      const ret = []; let i = 0;
      const exec = async () => { for (; i < array.length;) { const c = i++; try { ret[c] = await mapper(array[c], c); } catch(e) { ret[c] = { ok: false, error: e.message }; }}};
      await Promise.all(Array.from({ length: Math.min(concurrency, array.length) }, exec));
      return ret;
    }

    async function handleBulkDelete() {
      const rows = getSelectedRows();
      if (!rows.length) return alert('Sélectionnez au moins un élément.');
      
      const confirmed = await showConfirmation({
        title: "Suppression multiple",
        message: `Voulez-vous supprimer ces <strong>${rows.length}</strong> transcriptions ?`,
        confirmText: "Supprimer", confirmClass: "agilo-btn--danger"
      });
      if (!confirmed) return;

      const results = await pMap(rows, async (row) => {
        const jobId = getJobId(row);
        const r = await fetch(`${API_BASE}/deleteJob?username=${encodeURIComponent(__GLOBAL.email)}&token=${encodeURIComponent(__GLOBAL.token)}&jobId=${encodeURIComponent(jobId)}&edition=${encodeURIComponent(__GLOBAL.edition)}`);
        const d = await r.json();
        if (d.status === "OK") { row.remove(); return { ok: true }; }
        return { ok: false, jobId, error: d.errorMessage };
      });
      
      const kos = results.filter(r => !r.ok);
      if (kos.length) showDialog({ title: "Résultat suppression", subtitle: `${results.length - kos.length} OK, ${kos.length} échecs.`, blocks: [{ details: kos.map(r => `${r.jobId}: ${r.error}`).join('\n') }] });
      updateUI();
    }

    async function handleBulkWebhook() {
      const rows = getSelectedRows();
      if (!rows.length) return alert('Sélectionnez au moins un élément.');
      
      const confirmed = await showConfirmation({
        title: "Renvoi Webhook",
        message: `Relancer l'automatisation pour <strong>${rows.length}</strong> éléments ?`,
        confirmText: "Relancer"
      });
      if (!confirmed) return;

      const provider = document.querySelector(SELECTORS.automationProvider)?.value?.trim() || '';
      const results = await pMap(rows, async (row) => {
        const jobId = getJobId(row);
        const body = new URLSearchParams({ username: __GLOBAL.email, token: __GLOBAL.token, jobId, edition: __GLOBAL.edition });
        if (provider) body.set('automationProvider', provider);
        const r = await fetch(`${API_BASE}/webhookResend`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
        const d = await r.json();
        return { ok: d.status === "OK", jobId, error: d.errorMessage || d.status };
      });

      const kos = results.filter(r => !r.ok);
      showDialog({ title: "Résultat Webhook", subtitle: `${results.length - kos.length} réussis.`, blocks: kos.length ? [{ heading: "Échecs", details: kos.map(r => `${r.jobId}: ${r.error}`).join('\n') }] : [{ text: "Tout a été envoyé avec succès ✅" }] });
    }

    async function handleBulkExport() {
      const rows = getSelectedRows();
      if (!rows.length) return alert('Sélectionnez au moins un élément.');

      const results = await pMap(rows, async (row) => {
        const jobId = getJobId(row);
        const r = await fetch(`${API_BASE}/getSharedUrl`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username: __GLOBAL.email, token: __GLOBAL.token, jobId, edition: __GLOBAL.edition }).toString() });
        const d = await r.json();
        return { ok: d.status === "OK", jobId, url: d.url };
      });

      const oks = results.filter(r => r.ok);
      const kos = results.filter(r => !r.ok);
      
      if (oks.length) {
        const html = `
          <div class="agilo-kbdrow"><button id="agilo-dl-all" class="agilo-btn agilo-btn--primary">Tout ouvrir (${oks.length})</button></div>
          <div class="agilo-linklist">${oks.map(o => `<a href="${o.url}-download" target="_blank">${o.jobId} — Télécharger</a>`).join('')}</div>
        `;
        showDialog({ title: "Export", subtitle: `${oks.length} liens générés.`, blocks: [{ html }] });
        document.getElementById('agilo-dl-all')?.addEventListener('click', () => {
          oks.forEach((o, i) => setTimeout(() => window.open(`${o.url}-download`, '_blank'), i * 600));
        });
      } else {
        alert("Aucun lien n'a pu être généré.");
      }
    }

    function updateUI() {
      const all = document.querySelectorAll(`${SELECTORS.container} ${SELECTORS.row} .job-select`);
      const checked = document.querySelectorAll(`${SELECTORS.container} ${SELECTORS.row} .job-select:checked`);
      const countEl = document.querySelector(SELECTORS.selectedCount);
      if (countEl) countEl.textContent = `${checked.length} sélectionné(s)`;
      const master = document.querySelector(SELECTORS.selectAll);
      if (master) { master.checked = checked.length === all.length && all.length > 0; master.indeterminate = checked.length > 0 && checked.length < all.length; }
    }

    function bind() {
      document.addEventListener('change', (e) => { 
        if (e.target.matches(SELECTORS.selectAll)) {
          document.querySelectorAll(`${SELECTORS.container} ${SELECTORS.row} .job-select`).forEach(cb => cb.checked = e.target.checked);
          updateUI();
        }
        if (e.target.matches('.job-select')) updateUI();
      });

      document.getElementById('bulkDeleteBtn')?.addEventListener('click', (e) => { e.preventDefault(); handleBulkDelete(); });
      document.getElementById('resendWebhookBtn')?.addEventListener('click', (e) => { e.preventDefault(); handleBulkWebhook(); });
      document.getElementById('exportBtn')?.addEventListener('click', (e) => { e.preventDefault(); handleBulkExport(); });
      
      const obs = new MutationObserver(() => updateUI());
      const container = document.querySelector(SELECTORS.container);
      if (container) obs.observe(container, { childList: true });
    }

    return { init: bind };
  })();

  // --- Rendering ------------------------------------------------------
  function buildJobRow({ job, userEmail, token, edition, template, container }) {
    const clone = document.importNode(template, true);
    const row = clone.querySelector('.wrapper-content_item-row');
    if (!row) return;

    row.setAttribute('data-job-id', job.jobid);
    const creation = clone.querySelector('.creation-date'); 
    if (creation) creation.textContent = convertDateStringToDate(job.dtCreation).toLocaleString();

    const fileNameAnchor = clone.querySelector('.file-name');
    const renameButton = clone.querySelector('.rename-btn');
    if (fileNameAnchor) {
      fileNameAnchor.textContent = displayJobTitle(job);
      fileNameAnchor.href = `${API_BASE}/receiveAudio?jobId=${job.jobid}&username=${encodeURIComponent(userEmail)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}`;
    }
    setupInlineRename({ anchorEl: fileNameAnchor, buttonEl: renameButton, job, userEmail, token, edition });

    // Status icons & guard clicks
    const st = (job.transcriptStatus || '').toUpperCase();
    const formats = ['txt', 'rtf', 'docx', 'doc', 'pdf'];
    formats.forEach(f => {
      const aT = clone.querySelector(`.download_wrapper-link_transcript_${f}`);
      if (aT) {
        const u = `${API_BASE}/receiveText?jobId=${job.jobid}&username=${encodeURIComponent(userEmail)}&token=${encodeURIComponent(token)}&format=${f}&edition=${encodeURIComponent(edition)}`;
        setDownloadLink(aT, '#', ['PENDING','IN_PROGRESS'].includes(st) ? 'En cours...' : '');
        guardClick(aT, u, job.jobid, `${job.jobid}|${f}|tx`, 'Indisponible');
      }
      const aS = clone.querySelector(`.download_wrapper-link_summary_${f}`);
      if (aS) {
        const apiFmt = f === 'txt' ? 'html' : f;
        const u = `${API_BASE}/receiveSummary?jobId=${job.jobid}&username=${encodeURIComponent(userEmail)}&token=${encodeURIComponent(token)}&format=${apiFmt}&edition=${encodeURIComponent(edition)}`;
        setDownloadLink(aS, '#', st !== 'READY_SUMMARY_READY' ? 'Non prêt' : '');
        guardClick(aS, u, job.jobid, `${job.jobid}|${f}|sum`, 'Indisponible');
      }
    });

    container.appendChild(clone);
  }

  function main(token) {
    __GLOBAL.token = token;
    __GLOBAL.email = document.querySelector('[name="memberEmail"]')?.value;
    fetch(`${API_BASE}/getJobsInfo?username=${encodeURIComponent(__GLOBAL.email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(__GLOBAL.edition)}&limit=9999`)
      .then(r => r.json())
      .then(data => {
        const container = document.getElementById('jobs-container');
        const template = document.getElementById('template-row')?.content;
        if (!container || !template) return;
        container.innerHTML = '';
        (data.jobsInfoDtos || []).sort((a,b) => convertDateStringToDate(b.dtCreation) - convertDateStringToDate(a.dtCreation)).forEach(job => {
          buildJobRow({ job, userEmail: __GLOBAL.email, token, edition: __GLOBAL.edition, template, container });
        });
        AgilotextBulk.init();
      });
  }

  const itv = setInterval(() => { if (window.globalToken) { clearInterval(itv); main(window.globalToken); } }, 100);
})();
