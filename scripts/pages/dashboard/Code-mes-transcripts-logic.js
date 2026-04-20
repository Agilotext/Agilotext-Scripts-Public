(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  LISTE DES JOBS — UNIVERSEL (Free, Pro, Enterprise)
  //  - Titres intelligents (jobTitle)
  //  - Métadonnées de dossiers (folderId mapping)
  //  - Déplacer vers dossier, filtrage
  //  - État vide, notifications
  // ═══════════════════════════════════════════════════════════════════

  const VERSION = '1.1.5';
  const API_BASE = 'https://api.agilotext.com/api/v1';

  // --- Thème minimal pour curseurs/états (🚫 interdit / ⏳ vérification) ---
  (function injectListTheme() {
    if (document.getElementById('agilo-list-theme')) return;
    const css = `
      .is-disabled { opacity: .6; cursor: not-allowed; }
      .is-verifying { cursor: progress; }
      .file-name-input { width: 100%; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; }
      .agilo-empty-state { text-align: center; padding: 40px 20px; color: #666; font-style: italic; background: rgba(0,0,0,0.02); border-radius: 8px; margin: 10px 0; }
    `;
    const st = document.createElement('style');
    st.id = 'agilo-list-theme';
    st.textContent = css;
    document.head.appendChild(st);
  })();

  // --- Utilitaires ----------------------------------------------------
  const __GLOBAL = { token: null, email: null, edition: null, folderMap: new Map() };

  function convertDateStringToDate(dateString) {
    if (!dateString) return new Date();
    const parts = dateString.split(/[- :]/);
    return new Date(parts[2], parts[1] - 1, parts[0], parts[3], parts[4], parts[5]);
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

  function extractErrorMessage(javaException) {
    if (!javaException) return 'Cause inconnue.';
    const parts = javaException.split(':');
    return (parts.length > 1 ? parts.slice(1).join(':') : javaException).trim();
  }

  // --- Détection de l'édition -----------------------------------------
  function normalizeEdition(v) {
    v = String(v || '').trim().toLowerCase();
    if (/(^ent$|enterprise|entreprise|business|team|biz)/.test(v)) return 'ent';
    if (/^pro/.test(v)) return 'pro';
    if (/^free|gratuit/.test(v)) return 'free';
    return 'ent';
  }

  function getAppTierFromLocation() {
    const m = location.pathname.match(/^\/app\/([^/]+)/);
    return m ? m[1] : null;
  }

  function getEdition() {
    const fromPath = getAppTierFromLocation();
    const fromQS = new URLSearchParams(location.search).get('edition');
    const fromRoot = document.getElementById('editorRoot')?.dataset?.edition;
    const fromLS = localStorage.getItem('agilo:edition');
    return normalizeEdition(fromPath || fromQS || fromRoot || fromLS || 'ent');
  }

  // --- Garde de liens ------------------------------------------------
  function setDownloadLink(link, href, disabledMsg = '', opts = {}) {
    if (!link) return;
    if (link.__clickHandler) {
      link.removeEventListener('click', link.__clickHandler);
      link.__clickHandler = null;
    }
    if (!disabledMsg) {
      link.classList.remove('is-disabled', 'is-verifying');
      link.removeAttribute('aria-disabled');
      link.removeAttribute('title');
      link.style.pointerEvents = '';
      link.style.cursor = '';
      link.setAttribute('href', href);
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener');
      return;
    }
    const hard = opts.hard === true;
    link.classList.add('is-disabled');
    link.classList.remove('is-verifying');
    link.setAttribute('aria-disabled', 'true');
    link.setAttribute('title', disabledMsg);
    if (hard) {
      link.style.pointerEvents = 'none';
      link.style.cursor = 'not-allowed';
      link.removeAttribute('href');
      link.removeAttribute('target');
      link.removeAttribute('download');
    } else {
      link.style.pointerEvents = 'auto';
      link.style.cursor = 'not-allowed';
      link.setAttribute('href', '#');
      link.removeAttribute('target');
      link.removeAttribute('download');
      link.__clickHandler = (e) => {
        e.preventDefault(); e.stopPropagation();
        alert(disabledMsg);
      };
      link.addEventListener('click', link.__clickHandler);
    }
  }

  // --- Vérif Asset ---------------------------------------------------
  const _assetOkCache = new Map();
  async function verifyAssetOnce(jobId, url, key) {
    if (_assetOkCache.has(key)) return _assetOkCache.get(key);
    let ok = false;
    try {
      const r = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: { 'Accept': 'application/octet-stream,application/pdf,application/msword,application/rtf,text/html;q=0.9' }
      });
      const ct = (r.headers.get('content-type') || '').toLowerCase();
      const cd = r.headers.get('content-disposition') || '';
      if (r.ok && (/attachment|filename=/i.test(cd) || /(application\/pdf|msword|officedocument|rtf)/.test(ct))) {
        ok = true;
      } else {
        const text = await r.text().catch(() => '');
        let j = null; try { j = JSON.parse(text); } catch {}
        if (j) ok = (String(j.status || '').toUpperCase() === 'OK');
        else ok = r.ok && (ct.includes('text/html') || text.trim().length > 0);
      }
    } catch { ok = false; }
    _assetOkCache.set(key, ok);
    return ok;
  }

  function guardClick(a, url, jobId, key, failMsg = 'Résumé indisponible.') {
    if (!a || a.__guarded) return;
    a.__guarded = true;
    a.addEventListener('click', async (e) => {
      if (a.getAttribute('href') && !a.hasAttribute('aria-disabled')) return;
      e.preventDefault(); e.stopPropagation();
      a.classList.add('is-verifying');
      const ok = await verifyAssetOnce(jobId, url, key);
      a.classList.remove('is-verifying');
      if (ok) {
        setDownloadLink(a, url);
        window.open(url, '_blank', 'noopener');
      } else {
        setDownloadLink(a, '#', failMsg);
      }
    });
  }

  // --- API: dossiers --------------------------------------------------
  async function fetchFolders(email, token, edition) {
    try {
      const resp = await fetch(`${API_BASE}/getTranscriptFolders?username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}`);
      const j = await resp.json();
      if (j.status === 'OK') {
        const raw = j.folders || j.transcriptFolderDtos || j.transcriptFolders || [];
        __GLOBAL.folderMap.clear();
        __GLOBAL.folderMap.set(0, 'Non classé');
        raw.forEach(f => {
          const id = Number(f.folderId != null ? f.folderId : f.id);
          const name = String(f.folderName != null ? f.folderName : f.name || '').trim();
          if (id > 0 && name) __GLOBAL.folderMap.set(id, name);
        });
        updateMoveDropdown();
        updateHeaderLabel();
      }
    } catch (e) { console.error('[Folders] Error:', e); }
  }

  function updateMoveDropdown() {
    const sel = document.getElementById('agilo-bulk-folder-select');
    if (!sel) return;
    // Garder le premier item "Déplacer vers..."
    const first = sel.options[0];
    sel.innerHTML = '';
    if (first) sel.appendChild(first);
    
    // Trier par nom
    const sorted = Array.from(__GLOBAL.folderMap.entries()).sort((a, b) => {
        if (a[0] === 0) return -1; if (b[0] === 0) return 1;
        return a[1].localeCompare(b[1]);
    });

    sorted.forEach(([id, name]) => {
      const opt = document.createElement('option');
      opt.value = String(id);
      opt.textContent = name;
      sel.appendChild(opt);
    });
  }

  function updateHeaderLabel() {
    const labelEl = document.getElementById('agilo-bulk-folder-current');
    if (!labelEl) return;
    const currentId = Number(new URLSearchParams(location.search).get('folderId'));
    if (isNaN(currentId)) {
        labelEl.hidden = true;
        return;
    }
    const name = __GLOBAL.folderMap.get(currentId) || `Dossier ${currentId}`;
    labelEl.textContent = `Affichage : ${name}`;
    labelEl.hidden = false;
  }

  async function moveSelectedToFolder(targetFolderId) {
    const selected = Array.from(document.querySelectorAll('#jobs-container .job-select:checked'))
      .map(cb => cb.closest('.wrapper-content_item-row')?.getAttribute('data-job-id'))
      .filter(Boolean);

    if (selected.length === 0) return alert('Veuillez sélectionner au moins une transcription.');
    if (!targetFolderId && targetFolderId !== '0') return;

    const btn = document.getElementById('agilo-bulk-folder-apply');
    const oldText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    let count = 0;
    for (const jobId of selected) {
      try {
        const body = new URLSearchParams({
          username: __GLOBAL.email,
          token: __GLOBAL.token,
          jobId,
          folderId: targetFolderId,
          edition: __GLOBAL.edition
        });
        const r = await fetch(`${API_BASE}/updateJobFolder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString()
        });
        const data = await r.json();
        if (data.status === 'OK') count++;
      } catch (e) { console.error('Error moving job', jobId, e); }
    }

    if (btn) { btn.disabled = false; btn.textContent = oldText; }
    if (count > 0) {
      alert(`${count} transcription(s) déplacée(s).`);
      location.reload(); // Refresh pour mettre à jour la liste filtrée
    }
  }

  // --- API: renommage ------------------------------------------------
  async function renameOnServer({ jobId, userEmail, token, edition, jobTitle }) {
    const body = new URLSearchParams({ username: userEmail, token, edition, jobId: String(jobId), jobTitle });
    try {
      const r = await fetch(`${API_BASE}/renameTranscriptTitle`, {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString()
      });
      const data = await r.json();
      return { ok: data.status === "OK", error: data.message || data.errorMessage || "Erreur" };
    } catch (e) { return { ok: false, error: e?.message || "Erreur réseau" }; }
  }

  function setupInlineRename({ anchorEl, buttonEl, job, userEmail, token, edition }) {
    if (!anchorEl || !buttonEl) return;
    buttonEl.addEventListener("click", () => {
      if (anchorEl.__editing) return;
      anchorEl.__editing = true;
      const currentTitle = (anchorEl.textContent || "").trim();
      const input = document.createElement("input");
      input.className = "file-name-input";
      input.value = currentTitle;
      anchorEl.replaceWith(input);
      input.focus(); input.select();
      const cleanup = () => { if(input.parentNode) input.replaceWith(anchorEl); anchorEl.__editing = false; };
      const commit = async () => {
        if (anchorEl.__committing) return;
        const typedVal = input.value.trim();
        if (!typedVal || typedVal === currentTitle) { cleanup(); return; }
        anchorEl.__committing = true;
        const res = await renameOnServer({ jobId: job.jobid, userEmail, token, edition, jobTitle: typedVal });
        anchorEl.__committing = false;
        if (res.ok) { anchorEl.textContent = typedVal; job.jobTitle = typedVal; }
        else alert(`Erreur : ${res.error}`);
        cleanup();
      };
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") cleanup(); });
      input.addEventListener("blur", () => { setTimeout(() => { if (anchorEl.__editing) commit(); }, 150); });
    });
  }

  // --- UI building ----------------------------------------------------
  function updateIconVisibility(root, status) {
    const icons = {
      error: root.querySelector('.icon-error'),
      inprogress: root.querySelector('.icon-inprogress'),
      readySummaryPending: root.querySelector('.icon-ready_summary_pending'),
      readySummaryReady: root.querySelector('.icon-ready_summary_ready'),
      readySummaryOnError: root.querySelector('.icon-ready_summary_on_error'),
      ready: root.querySelector('.icon-ready')
    };
    Object.values(icons).forEach(i => i && (i.style.display = 'none'));
    const st = (status || '').toUpperCase();
    if (['ON_ERROR', 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS', 'ERROR_TOO_MANY_LANGUAGES_CODE', 'ERROR_TRANSLATE_FILES_NOT_EXISTS', 'ERROR_TRANSLATE_NOT_READY', 'ERROR_TRANSLATE_ON_ERROR'].includes(st)) {
      if (icons.error) icons.error.style.display = 'block';
    } else if (['PENDING', 'IN_PROGRESS'].includes(st)) {
      if (icons.inprogress) icons.inprogress.style.display = 'block';
    } else if (st === 'READY_SUMMARY_PENDING') {
      if (icons.readySummaryPending) icons.readySummaryPending.style.display = 'block';
    } else if (st === 'READY_SUMMARY_READY') {
      if (icons.readySummaryReady) icons.readySummaryReady.style.display = 'block';
    } else if (st === 'READY_SUMMARY_ON_ERROR') {
      if (icons.readySummaryOnError) icons.readySummaryOnError.style.display = 'block';
    } else {
      if (icons.ready) icons.ready.style.display = 'block';
    }
  }

  function buildJobRow({ job, userEmail, token, edition, template, container }) {
    const clone = document.importNode(template, true);
    const row = clone.querySelector('.wrapper-content_item-row');
    if (!row) return;

    row.setAttribute('data-creation-date', job.dtCreation);
    row.setAttribute('data-job-id', job.jobid);
    updateIconVisibility(clone, job.transcriptStatus);

    const creation = clone.querySelector('.creation-date');
    if (creation) creation.textContent = convertDateStringToDate(job.dtCreation).toLocaleString();
    const update = clone.querySelector('.update-date');
    if (update) update.textContent = convertDateStringToDate(job.dtUpdate).toLocaleString();

    const fileNameAnchor = clone.querySelector('.file-name');
    const renameButton   = clone.querySelector('.rename-btn');
    if (fileNameAnchor) {
      fileNameAnchor.textContent = displayJobTitle(job);
      fileNameAnchor.href = `${API_BASE}/receiveAudio?jobId=${job.jobid}&username=${encodeURIComponent(userEmail)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}`;
      fileNameAnchor.setAttribute('download', job.filename);
    }
    setupInlineRename({ anchorEl: fileNameAnchor, buttonEl: renameButton, job, userEmail, token, edition });

    const formats = ['txt', 'rtf', 'docx', 'doc', 'pdf'];
    const st = (job.transcriptStatus || '').toUpperCase();
    formats.forEach(fmt => {
      const aT = clone.querySelector(`.download_wrapper-link_transcript_${fmt}`);
      if (aT) {
        if (['ON_ERROR', 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS'].includes(st)) setDownloadLink(aT, '#', 'Erreur transcript.');
        else if (['PENDING', 'IN_PROGRESS'].includes(st)) setDownloadLink(aT, '#', 'En cours...');
        else {
          const u = `${API_BASE}/receiveText?jobId=${job.jobid}&username=${encodeURIComponent(userEmail)}&token=${encodeURIComponent(token)}&format=${fmt}&edition=${encodeURIComponent(edition)}`;
          setDownloadLink(aT, u);
          guardClick(aT, u, job.jobid, `${job.jobid}|${fmt}|text|${edition}`, 'Transcript indisponible.');
        }
      }
      const aS = clone.querySelector(`.download_wrapper-link_summary_${fmt}`);
      if (aS) {
        if (['READY_SUMMARY_ON_ERROR', 'ON_ERROR'].includes(st)) setDownloadLink(aS, '#', 'Résumé indisponible.');
        else if (['PENDING', 'IN_PROGRESS', 'READY_SUMMARY_PENDING'].includes(st)) setDownloadLink(aS, '#', 'Patientez...');
        else if (st === 'READY_SUMMARY_READY') {
          const apiFmt = (fmt === 'txt') ? 'html' : fmt;
          const u = `${API_BASE}/receiveSummary?jobId=${job.jobid}&username=${encodeURIComponent(userEmail)}&token=${encodeURIComponent(token)}&format=${apiFmt}&edition=${encodeURIComponent(edition)}`;
          setDownloadLink(aS, u);
          guardClick(aS, u, job.jobid, `${job.jobid}|${fmt}|summary|${edition}`, 'Résumé indisponible.');
        } else setDownloadLink(aS, '#', 'Indisponible.');
      }
    });

    const delBtn = clone.querySelector('.delete-job-button_to-confirm');
    if (delBtn) delBtn.addEventListener('click', () => { window.__currentJobIdToDelete = job.jobid; const p = document.querySelector('.popup-container'); if(p) p.style.display = 'flex'; });
    
    container.appendChild(clone);
  }

  // --- Orchestration --------------------------------------------------
  function setupBulkMove() {
      const applyBtn = document.getElementById('agilo-bulk-folder-apply');
      const selectEl = document.getElementById('agilo-bulk-folder-select');
      if (applyBtn && selectEl) {
          applyBtn.addEventListener('click', (e) => {
              e.preventDefault();
              const target = selectEl.value;
              if (target === "") return alert("Choisissez un dossier de destination.");
              moveSelectedToFolder(target);
          });
      }
  }

  async function mainScriptExecution(token) {
    const userEmail = document.querySelector('[name="memberEmail"]')?.value;
    if (!userEmail || !token) return;
    
    const edition = getEdition();
    __GLOBAL.token = token;
    __GLOBAL.email = userEmail;
    __GLOBAL.edition = edition;

    await fetchFolders(userEmail, token, edition);
    setupBulkMove();

    try {
        const resp = await fetch(`${API_BASE}/getJobsInfo?username=${encodeURIComponent(userEmail)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}&limit=9999&offset=0`);
        const data = await resp.json();
        if (data.status !== "OK") return;

        const container = document.getElementById('jobs-container');
        const templateEl = document.getElementById('template-row');
        if (!container || !templateEl) return;
        const template = templateEl.content;

        const currentFolderId = new URLSearchParams(location.search).get('folderId');
        let filteredJobs = data.jobsInfoDtos || [];
        
        // Filtrage par dossier
        if (currentFolderId !== null && currentFolderId !== '') {
            const fid = Number(currentFolderId);
            filteredJobs = filteredJobs.filter(j => (j.folderId != null ? Number(j.folderId) : 0) === fid);
        }

        const sortedJobs = filteredJobs.slice().sort((a, b) => convertDateStringToDate(b.dtCreation) - convertDateStringToDate(a.dtCreation));
        
        // Quotas / Ready count (sur tous les jobs du compte pour le badge)
        const readyCount = (data.jobsInfoDtos || []).reduce((n, j) => n + (String(j.transcriptStatus).toUpperCase() === 'READY_SUMMARY_READY' ? 1 : 0), 0);
        const readyCountEl = document.getElementById('readyCount');
        if (readyCountEl) readyCountEl.textContent = readyCount;

        container.innerHTML = '';
        if (sortedJobs.length === 0) {
            container.innerHTML = `<div class="agilo-empty-state">Aucune transcription trouvée dans ce dossier.</div>`;
        } else {
            sortedJobs.forEach(job => buildJobRow({ job, userEmail, token, edition, template, container }));
        }
    } catch (err) { console.error('Error fetching jobs:', err); }
  }

  const tmr = setInterval(() => {
    if (typeof globalToken !== 'undefined' && globalToken) { clearInterval(tmr); mainScriptExecution(globalToken); }
  }, 100);

})();
