(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  LISTE DES JOBS — UNIVERSEL (Free, Pro, Enterprise)
  //  - Titres intelligents (jobTitle)
  //  - Détection automatique de l'édition
  //  - Renommage, partage, suppression, téléchargements
  // ═══════════════════════════════════════════════════════════════════

  const VERSION = '1.1.4';
  const API_BASE = 'https://api.agilotext.com/api/v1';

  // --- Thème minimal pour curseurs/états (🚫 interdit / ⏳ vérification) ---
  (function injectListTheme() {
    if (document.getElementById('agilo-list-theme')) return;
    const css = `
      .is-disabled { opacity: .6; cursor: not-allowed; }
      .is-verifying { cursor: progress; }
      .file-name-input { width: 100%; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; }
    `;
    const st = document.createElement('style');
    st.id = 'agilo-list-theme';
    st.textContent = css;
    document.head.appendChild(st);
  })();

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
    return 'ent'; // Default fallback
  }

  function getAppTierFromLocation() {
    const m = location.pathname.match(/^\/app\/([^/]+)/);
    return m ? m[1] : null;
  }

  function getEdition() {
    const fromPath = getAppTierFromLocation();
    const fromQS = new URLSearchParams(location.search).get('edition');
    const fromRoot = document.getElementById('editorRoot')?.dataset?.edition;
    const fromHtml = document.documentElement?.getAttribute('data-edition');
    const fromLS = localStorage.getItem('agilo:edition');
    return normalizeEdition(fromPath || fromQS || fromRoot || fromHtml || fromLS || 'ent');
  }

  // --- Garde de liens (enable / disable + popup) ---------------------
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
        alert(disabledMsg || "Pas de compte-rendu disponible.");
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
        redirect: 'follow',
        headers: {
          'Accept': 'application/octet-stream,application/pdf,application/msword,application/rtf,text/html;q=0.9,application/json;q=0.1'
        }
      });

      const ct = (r.headers.get('content-type') || '').toLowerCase();
      const cd = r.headers.get('content-disposition') || '';

      if (r.ok && (/attachment|filename=/i.test(cd) || /(application\/pdf|msword|officedocument|rtf)/.test(ct))) {
        ok = true;
      } else {
        const text = await r.text().catch(() => '');
        let j = null; try { j = JSON.parse(text); } catch {}
        if (j) {
          ok = (String(j.status || '').toUpperCase() === 'OK');
        } else {
          if (/"status"\s*:\s*"KO"/i.test(text) || /error_summary_transcript_file_not_exists/i.test(text)) {
            ok = false;
          } else {
            ok = r.ok && (ct.includes('text/html') || text.trim().length > 0);
          }
        }
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
        a.setAttribute('target', '_blank');
        window.open(url, '_blank', 'noopener');
      } else {
        setDownloadLink(a, '#', failMsg);
      }
    }, { passive: false });
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
      if (data.status === "OK") return { ok: true };
      return { ok: false, error: data.message || data.errorMessage || data.error || "Erreur inconnue" };
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
      
      const cleanup = () => { 
        if(input.parentNode) input.replaceWith(anchorEl); 
        anchorEl.__editing = false; 
      };
      
      const commit = async () => {
        if (anchorEl.__committing) return;
        const typedVal = input.value.trim();
        if (!typedVal || typedVal === currentTitle) { cleanup(); return; }
        
        anchorEl.__committing = true;
        const res = await renameOnServer({ jobId: job.jobid, userEmail, token, edition, jobTitle: typedVal });
        anchorEl.__committing = false;

        if (res.ok) {
          anchorEl.textContent = typedVal;
          job.jobTitle = typedVal; // Mise à jour locale pour que displayJobTitle() reste cohérent
        } else {
          alert(`Erreur : ${res.error || 'Impossible de renommer'}`);
        }
        cleanup();
      };
      
      input.addEventListener("keydown", (e) => { 
        if (e.key === "Enter") { e.preventDefault(); commit(); } 
        if (e.key === "Escape") { e.preventDefault(); cleanup(); } 
      });
      input.addEventListener("blur", () => {
        // On laisse un petit délai pour permettre au clic sur Enter d'aboutir proprement 
        // ou pour éviter les conflits si cleanup() est déjà en cours.
        setTimeout(() => { if (anchorEl.__editing) commit(); }, 100);
      });
    });
  }

  // --- Icônes d’état --------------------------------------------------
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

  // --- Suppression ----------------------------------------------------
  function deleteJob(jobId, userEmail, token, edition) {
    fetch(`${API_BASE}/deleteJob?username=${encodeURIComponent(userEmail)}&token=${encodeURIComponent(token)}&jobId=${encodeURIComponent(jobId)}&edition=${encodeURIComponent(edition)}`)
      .then(r => r.json())
      .then(data => {
        if (data.status === "OK") {
          const row = document.querySelector(`[data-job-id="${jobId}"]`);
          if (row) row.closest('.wrapper-content_item-row')?.remove();
        }
      }).catch(err => console.error('Erreur suppression:', err));
  }

  // --- Partage --------------------------------------------------------
  async function updateShareLink(jobId, userEmail, token, edition, el) {
    try {
      const r = await fetch(`${API_BASE}/getSharedUrl?jobId=${jobId}&username=${encodeURIComponent(userEmail)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}`);
      const data = await r.json();
      if (data.status === "OK" && data.url) { el.href = data.url; el.style.display = 'inline'; }
    } catch (e) { console.error('Erreur partage:', e); }
  }

  // --- Construction d’une ligne job ----------------------------------
  function buildJobRow({ job, userEmail, token, edition, template, container }) {
    const clone = document.importNode(template, true);
    const row = clone.querySelector('.wrapper-content_item-row');
    if (!row) return;

    row.setAttribute('data-creation-date', job.dtCreation);
    row.setAttribute('data-job-id', job.jobid);
    updateIconVisibility(clone, job.transcriptStatus);

    // Clic icône état
    const stateDiv = clone.querySelector('.state');
    const visibleIcon = stateDiv?.querySelector('svg:not([style*="display: none"])');
    if (visibleIcon) {
      visibleIcon.style.cursor = 'pointer';
      visibleIcon.addEventListener('click', () => {
        const st = (job.transcriptStatus || '').toUpperCase();
        let message = '';
        if (['ON_ERROR', 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS', 'ERROR_TOO_MANY_LANGUAGES_CODE', 'ERROR_TRANSLATE_FILES_NOT_EXISTS', 'ERROR_TRANSLATE_NOT_READY', 'ERROR_TRANSLATE_ON_ERROR'].includes(st)) message = `Le traitement a échoué : ${extractErrorMessage(job.javaException)}`;
        else if (['PENDING', 'IN_PROGRESS'].includes(st)) message = 'Le traitement est en cours, merci de patienter.';
        else if (st === 'READY_SUMMARY_PENDING') message = 'Le transcript est disponible, le résumé est en cours de génération.';
        else if (st === 'READY_SUMMARY_READY') message = 'Le transcript et le résumé sont disponibles.';
        else if (st === 'READY_SUMMARY_ON_ERROR') message = `Le transcript est disponible, mais le résumé a échoué : ${extractErrorMessage(job.javaException)}`;
        else message = 'Statut non reconnu.';
        alert(message);
      });
    }

    // Dates
    const creation = clone.querySelector('.creation-date');
    if (creation) creation.textContent = convertDateStringToDate(job.dtCreation).toLocaleString();
    const update = clone.querySelector('.update-date');
    if (update) update.textContent = convertDateStringToDate(job.dtUpdate).toLocaleString();

    // Nom + Titre Intelligent
    const fileNameAnchor = clone.querySelector('.file-name');
    const renameButton   = clone.querySelector('.rename-btn');
    if (fileNameAnchor) {
      fileNameAnchor.textContent = displayJobTitle(job);
      fileNameAnchor.href = `${API_BASE}/receiveAudio?jobId=${job.jobid}&username=${encodeURIComponent(userEmail)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}`;
      fileNameAnchor.setAttribute('download', job.filename);
    }
    setupInlineRename({ anchorEl: fileNameAnchor, buttonEl: renameButton, job, userEmail, token, edition });

    // Partage
    const shareLink = clone.querySelector('.share-link');
    if (shareLink) updateShareLink(job.jobid, userEmail, token, edition, shareLink);

    // Téléchargements
    const formats = ['txt', 'rtf', 'docx', 'doc', 'pdf'];
    const st = (job.transcriptStatus || '').toUpperCase();
    formats.forEach(fmt => {
      const aT = clone.querySelector(`.download_wrapper-link_transcript_${fmt}`);
      if (aT) {
        if (['ON_ERROR', 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS', 'ERROR_TRANSLATE_ON_ERROR'].includes(st)) setDownloadLink(aT, '#', `Erreur : ${extractErrorMessage(job.javaException)}`);
        else if (['PENDING', 'IN_PROGRESS'].includes(st)) setDownloadLink(aT, '#', 'En cours...');
        else {
          const u = `${API_BASE}/receiveText?jobId=${job.jobid}&username=${encodeURIComponent(userEmail)}&token=${encodeURIComponent(token)}&format=${fmt}&edition=${encodeURIComponent(edition)}`;
          setDownloadLink(aT, u);
          guardClick(aT, u, job.jobid, `${job.jobid}|${fmt}|text|${edition}`, 'Transcript indisponible.');
          aT.setAttribute('download', `transcript.${fmt}`);
        }
      }
      const aS = clone.querySelector(`.download_wrapper-link_summary_${fmt}`);
      if (aS) {
        if (['READY_SUMMARY_ON_ERROR', 'ON_ERROR', 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS'].includes(st)) setDownloadLink(aS, '#', 'Résumé indisponible.');
        else if (['PENDING', 'IN_PROGRESS', 'READY_SUMMARY_PENDING'].includes(st)) setDownloadLink(aS, '#', 'Patientez...');
        else if (st === 'READY_SUMMARY_READY') {
          const apiFmt = (fmt === 'txt') ? 'html' : fmt;
          const u = `${API_BASE}/receiveSummary?jobId=${job.jobid}&username=${encodeURIComponent(userEmail)}&token=${encodeURIComponent(token)}&format=${apiFmt}&edition=${encodeURIComponent(edition)}`;
          const key = `${job.jobid}|${fmt}|summary|${edition}`;
          setDownloadLink(aS, '#', 'Vérification...');
          aS.classList.add('is-verifying');
          verifyAssetOnce(job.jobid, u, key).then(ok => {
            aS.classList.remove('is-verifying');
            if (ok) { setDownloadLink(aS, u); aS.setAttribute('download', `summary.${fmt === 'txt' ? 'html' : fmt}`); }
            else setDownloadLink(aS, '#', 'Indisponible.');
          });
        } else setDownloadLink(aS, '#', 'Indisponible.');
      }
    });

    // Suppression
    const delBtn = clone.querySelector('.delete-job-button_to-confirm');
    if (delBtn) {
      delBtn.setAttribute('data-job-id', job.jobid);
      delBtn.addEventListener('click', () => {
        window.__currentJobIdToDelete = job.jobid;
        const popup = document.querySelector('.popup-container');
        if (popup) popup.style.display = 'flex';
      });
    }
    container.appendChild(clone);
  }

  // --- Orchestration --------------------------------------------------
  const __GLOBAL = { token: null, email: null, edition: getEdition() };

  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-job-button_to-confirm')) {
      window.__currentJobIdToDelete = e.target.closest('.wrapper-content_item-row')?.getAttribute('data-job-id');
      const popup = document.querySelector('.popup-container');
      if (popup) popup.style.display = 'flex';
    }
  });

  const confirmBtn = document.querySelector('.delete-job-button_confirmed');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      if (window.__currentJobIdToDelete) {
        const userEmail = document.querySelector('[name="memberEmail"]')?.value || '';
        deleteJob(window.__currentJobIdToDelete, userEmail, __GLOBAL.token, __GLOBAL.edition);
        const popup = document.querySelector('.popup-container'); if (popup) popup.style.display = 'none';
        window.__currentJobIdToDelete = null;
      }
    });
  }

  function mainScriptExecution(token) {
    const userEmail = document.querySelector('[name="memberEmail"]')?.value;
    const edition = __GLOBAL.edition;
    __GLOBAL.token = token;
    __GLOBAL.email = userEmail;

    fetch(`${API_BASE}/getJobsInfo?username=${encodeURIComponent(userEmail)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}&limit=9999&offset=0`)
      .then(r => r.json())
      .then(data => {
        if (data.status !== "OK") return;
        const container = document.getElementById('jobs-container');
        const templateEl = document.getElementById('template-row');
        if (!container || !templateEl) return;
        const template = templateEl.content;
        const sortedJobs = (data.jobsInfoDtos || []).slice().sort((a, b) => convertDateStringToDate(b.dtCreation) - convertDateStringToDate(a.dtCreation));
        const readyCount = sortedJobs.reduce((n, j) => n + (String(j.transcriptStatus).toUpperCase() === 'READY_SUMMARY_READY' ? 1 : 0), 0);
        const readyCountEl = document.getElementById('readyCount');
        if (readyCountEl) readyCountEl.textContent = readyCount;
        container.innerHTML = '';
        sortedJobs.forEach(job => buildJobRow({ job, userEmail, token, edition, template, container }));
      }).catch(err => console.error('Erreur data:', err));
  }

  const tmr = setInterval(() => {
    if (typeof globalToken !== 'undefined' && globalToken) { clearInterval(tmr); mainScriptExecution(globalToken); }
  }, 100);

})();
