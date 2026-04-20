(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  LISTE DES JOBS — v1.1.6
  //  - Robustesse filtrage (NaN, String vs Number)
  //  - Export global pour diagnostic: window.__AGILO_DEBUG
  //  - Gestion d'erreurs API explicite dans l'UI
  // ═══════════════════════════════════════════════════════════════════

  const VERSION = '1.1.6';
  const API_BASE = 'https://api.agilotext.com/api/v1';

  // --- Thème minimal ---
  (function injectListTheme() {
    if (document.getElementById('agilo-list-theme')) return;
    const css = `
      .is-disabled { opacity: .6; cursor: not-allowed; }
      .is-verifying { cursor: progress; }
      .file-name-input { width: 100%; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; }
      .agilo-empty-state { text-align: center; padding: 40px 20px; color: #666; font-style: italic; background: rgba(0,0,0,0.02); border-radius: 8px; margin: 10px 0; }
      .agilo-error-state { text-align: center; padding: 40px 20px; color: #d93025; background: #fce8e6; border-radius: 8px; margin: 10px 0; border: 1px solid #f28b82; }
    `;
    const st = document.createElement('style');
    st.id = 'agilo-list-theme';
    st.textContent = css;
    document.head.appendChild(st);
  })();

  // --- Global Debug state ---
  const __GLOBAL = { 
      token: null, 
      email: null, 
      edition: null, 
      folderMap: new Map(),
      lastApiData: null,
      version: VERSION
  };
  window.__AGILO_DEBUG = __GLOBAL;

  // --- Utilitaires ---
  function convertDateStringToDate(dateString) {
    if (!dateString) return new Date();
    const parts = dateString.split(/[- :]/);
    return new Date(parts[2], parts[1] - 1, parts[0], parts[3], parts[4], parts[5]);
  }

  function displayJobTitle(job) {
    if (!job) return 'Transcript';
    const jt = (job.jobTitle != null ? String(job.jobTitle) : '').trim();
    if (jt) return jt;
    const fn = job.filename || '';
    if (fn) {
        const i = fn.lastIndexOf('.');
        return i > 0 ? fn.slice(0, i) : fn;
    }
    return 'Transcript';
  }

  function extractErrorMessage(javaException) {
    if (!javaException) return 'Cause inconnue.';
    const parts = javaException.split(':');
    return (parts.length > 1 ? parts.slice(1).join(':') : javaException).trim();
  }

  // --- Détection de l'édition ---
  function getEdition() {
    const fromPath = location.pathname.match(/^\/app\/([^/]+)/);
    const tier = fromPath ? fromPath[1] : null;
    const fromQS = new URLSearchParams(location.search).get('edition');
    const fromLS = localStorage.getItem('agilo:edition');
    
    let v = String(tier || fromQS || fromLS || 'ent').toLowerCase().trim();
    if (/(^ent$|enterprise|entreprise|business|team|biz)/.test(v)) return 'ent';
    if (/^pro/.test(v)) return 'pro';
    if (/^free|gratuit/.test(v)) return 'free';
    return 'ent';
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
          if (!isNaN(id) && name) __GLOBAL.folderMap.set(id, name);
        });
        updateMoveDropdown();
        updateHeaderLabel();
      }
    } catch (e) { console.error('[Folders] Error fetching metadata:', e); }
  }

  function updateMoveDropdown() {
    const sel = document.getElementById('agilo-bulk-folder-select');
    if (!sel) return;
    const first = sel.options[0];
    sel.innerHTML = '';
    if (first) sel.appendChild(first);
    
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
    const q = new URLSearchParams(location.search).get('folderId');
    if (q === null || q === '') { labelEl.hidden = true; return; }
    const fid = Number(q);
    const name = __GLOBAL.folderMap.get(fid) || `Dossier ${q}`;
    labelEl.textContent = `Affichage : ${name}`;
    labelEl.hidden = false;
  }

  // --- UI building ----------------------------------------------------
  function setDownloadLink(link, href, disabledMsg = '') {
    if (!link) return;
    if (link.__clickHandler) {
      link.removeEventListener('click', link.__clickHandler);
      link.__clickHandler = null;
    }
    if (!disabledMsg) {
      link.classList.remove('is-disabled', 'is-verifying');
      link.removeAttribute('aria-disabled');
      link.setAttribute('href', href);
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener');
      return;
    }
    link.classList.add('is-disabled');
    link.setAttribute('aria-disabled', 'true');
    link.setAttribute('title', disabledMsg);
    link.setAttribute('href', '#');
    link.__clickHandler = (e) => { e.preventDefault(); e.stopPropagation(); alert(disabledMsg); };
    link.addEventListener('click', link.__clickHandler);
  }

  function buildJobRow({ job, userEmail, token, edition, template, container }) {
    const clone = document.importNode(template, true);
    const row = clone.querySelector('.wrapper-content_item-row');
    if (!row) return;

    row.setAttribute('data-job-id', job.jobid);
    
    // Icons
    const icons = {
      error: clone.querySelector('.icon-error'),
      inprogress: clone.querySelector('.icon-inprogress'),
      ready: clone.querySelector('.icon-ready')
    };
    Object.values(icons).forEach(i => i && (i.style.display = 'none'));
    const st = (job.transcriptStatus || '').toUpperCase();
    if (st.includes('ERROR')) { if(icons.error) icons.error.style.display='block'; }
    else if (['PENDING', 'IN_PROGRESS'].includes(st)) { if(icons.inprogress) icons.inprogress.style.display='block'; }
    else if (st.includes('READY')) { if(icons.ready) icons.ready.style.display='block'; }

    // Title
    const fileNameAnchor = clone.querySelector('.file-name');
    if (fileNameAnchor) {
      fileNameAnchor.textContent = displayJobTitle(job);
      fileNameAnchor.href = `${API_BASE}/receiveAudio?jobId=${job.jobid}&username=${encodeURIComponent(userEmail)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}`;
    }

    // Formats
    ['txt', 'rtf', 'docx', 'doc', 'pdf'].forEach(fmt => {
      const aT = clone.querySelector(`.download_wrapper-link_transcript_${fmt}`);
      if (aT) {
        if (st.includes('READY')) {
            const u = `${API_BASE}/receiveText?jobId=${job.jobid}&username=${encodeURIComponent(userEmail)}&token=${encodeURIComponent(token)}&format=${fmt}&edition=${encodeURIComponent(edition)}`;
            setDownloadLink(aT, u);
        } else setDownloadLink(aT, '#', 'Non disponible');
      }
    });

    const delBtn = clone.querySelector('.delete-job-button_to-confirm');
    if (delBtn) delBtn.addEventListener('click', () => { window.__currentJobIdToDelete = job.jobid; const p = document.querySelector('.popup-container'); if(p) p.style.display = 'flex'; });
    
    container.appendChild(clone);
  }

  // --- Orchestration ---
  async function mainScriptExecution(token) {
    const userEmail = document.querySelector('[name="memberEmail"]')?.value;
    if (!userEmail || !token) return;
    
    const edition = getEdition();
    __GLOBAL.token = token;
    __GLOBAL.email = userEmail;
    __GLOBAL.edition = edition;

    // Pas d'await ici pour charger les jobs même si les dossiers rament
    fetchFolders(userEmail, token, edition);

    const container = document.getElementById('jobs-container');
    if (!container) return;

    try {
        const resp = await fetch(`${API_BASE}/getJobsInfo?username=${encodeURIComponent(userEmail)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}&limit=9999&offset=0`);
        const data = await resp.json();
        __GLOBAL.lastApiData = data;

        if (data.status !== "OK") {
            container.innerHTML = `<div class="agilo-error-state">Erreur API : ${data.errorMessage || data.message || 'Status KO'}</div>`;
            return;
        }

        const templateEl = document.getElementById('template-row');
        if (!templateEl) return;
        const template = templateEl.content;

        const q = new URLSearchParams(location.search).get('folderId');
        const fid = (q !== null && q !== '' && !isNaN(Number(q))) ? Number(q) : null;
        
        let jobs = data.jobsInfoDtos || [];
        if (fid !== null) {
            jobs = jobs.filter(j => {
                const jfid = (j.folderId != null) ? Number(j.folderId) : 0;
                return jfid === fid;
            });
        }

        container.innerHTML = '';
        if (jobs.length === 0) {
            container.innerHTML = `<div class="agilo-empty-state">Aucune transcription trouvée ici.</div>`;
        } else {
            jobs.sort((a,b) => convertDateStringToDate(b.dtCreation) - convertDateStringToDate(a.dtCreation))
                .forEach(job => buildJobRow({ job, userEmail, token, edition, template, container }));
        }

    } catch (err) { 
        console.error('[TranscriptLogic] API Error:', err);
        container.innerHTML = `<div class="agilo-error-state">Erreur de connexion : impossible de charger vos fichiers.</div>`;
    }
  }

  const tmr = setInterval(() => {
    if (typeof globalToken !== 'undefined' && globalToken) { 
        clearInterval(tmr); 
        mainScriptExecution(globalToken); 
    }
  }, 100);

})();
