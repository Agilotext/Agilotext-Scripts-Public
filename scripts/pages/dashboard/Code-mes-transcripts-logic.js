(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  DASHBOARD UNIFIED LOGIC — v1.1.7
  //  - Centralized Bulk Actions: Delete, Export, Move
  //  - Automatic UI Injection for Move-to-folder
  //  - Robust Filtering (Folder matching fixed)
  //  - Event-driven (orchestrator.js)
  // ═══════════════════════════════════════════════════════════════════

  const VERSION = '1.1.7';
  const API_BASE = 'https://api.agilotext.com/api/v1';

  const __GLOBAL = { 
    token: null, 
    email: null, 
    edition: null, 
    folderMap: new Map(),
    lastApiData: null,
    version: VERSION
  };
  window.__AGILO_DEBUG = __GLOBAL;

  const SELECTORS = {
    container: '#jobs-container',
    row: '.wrapper-content_item-row',
    selectAll: '#select-all',
    selectedCount: '#selected-count',
    bulkBar: '.code-open-editor-bulk-select', // Injection parent
    template: '#template-row'
  };

  // --- Theme ---
  (function injectTheme() {
    if (document.getElementById('agilo-dashboard-v117-theme')) return;
    const css = `
      .is-disabled { opacity: .6; cursor: not-allowed; }
      .agilo-empty-state { text-align: center; padding: 40px 20px; color: #666; font-style: italic; background: rgba(0,0,0,0.02); border-radius: 8px; margin: 10px 0; }
      .agilo-error-state { text-align: center; padding: 40px 20px; color: #d93025; background: #fce8e6; border-radius: 8px; margin: 10px 0; border: 1px solid #f28b82; }
      
      /* Bulk Folder Select Styling */
      .agilo-bulk-move-wrap { display: flex; align-items: center; gap: 8px; margin-left: 12px; padding-left: 12px; border-left: 1px solid #eee; }
      .agilo-select-move { padding: 6px 10px; border-radius: 4px; border: 1px solid #ddd; font-size: 13px; outline: none; background: #fff; cursor: pointer; max-width: 160px; }
      .agilo-select-move:hover { border-color: #bbb; }
    `;
    const st = document.createElement('style');
    st.id = 'agilo-dashboard-v117-theme';
    st.textContent = css;
    document.head.appendChild(st);
  })();

  // --- Date/String Utils ---
  function convertDateStringToDate(dateString) {
    if (!dateString) return new Date();
    const parts = dateString.split(/[- :]/);
    return new Date(parts[2], parts[1] - 1, parts[0], parts[3], parts[4], parts[5]);
  }

  function displayJobTitle(job) {
    const jt = (job.jobTitle != null ? String(job.jobTitle) : '').trim();
    if (jt) return jt;
    const fn = job.filename || '';
    if (fn) {
        const i = fn.lastIndexOf('.');
        return i > 0 ? fn.slice(0, i) : fn;
    }
    return 'Transcript';
  }

  // --- Authentication ---
  function getEdition() {
    const fromPath = location.pathname.match(/^\/app\/([^/]+)/);
    const tier = fromPath ? fromPath[1] : null;
    return String(tier || 'ent').toLowerCase().includes('free') ? 'free' : (tier && tier.startsWith('pro') ? 'pro' : 'ent');
  }

  // --- UI Injection for Bulk Move ---
  function ensureBulkMoveUI() {
    if (document.getElementById('agilo-bulk-folder-select')) return;
    
    // On cherche un endroit où l'injecter (idéalement près des boutons existants)
    const targets = ['#bulkDeleteBtn', '#exportBtn', SELECTORS.bulkBar];
    let parent = null;
    let anchor = null;

    for (const sel of targets) {
        const el = document.querySelector(sel);
        if (el) {
            parent = el.parentElement;
            anchor = el.nextSibling;
            break;
        }
    }

    if (!parent) return;

    const wrap = document.createElement('div');
    wrap.className = 'agilo-bulk-move-wrap';
    wrap.innerHTML = `
        <select id="agilo-bulk-folder-select" class="agilo-select-move">
            <option value="" disabled selected>Déplacer vers...</option>
        </select>
    `;
    parent.insertBefore(wrap, anchor);

    const sel = wrap.querySelector('select');
    sel.addEventListener('change', async (e) => {
        const folderId = e.target.value;
        if (!folderId) return;
        await handleBulkMove(folderId);
        e.target.value = ''; // Reset
    });
  }

  // --- Folder API ---
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
    ensureBulkMoveUI();
    const sel = document.getElementById('agilo-bulk-folder-select');
    if (!sel) return;
    
    sel.innerHTML = '<option value="" disabled selected>Déplacer vers...</option>';
    
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
    labelEl.textContent = `Dossier : ${name}`;
    labelEl.hidden = false;
  }

  // --- Bulk Actions Implementation ---
  function getSelectedJobIds() {
    return Array.from(document.querySelectorAll(`${SELECTORS.container} .job-select:checked`))
                .map(cb => cb.closest(SELECTORS.row)?.getAttribute('data-job-id'))
                .filter(Boolean);
  }

  async function handleBulkMove(targetFolderId) {
    const ids = getSelectedJobIds();
    if (ids.length === 0) return alert('Sélectionnez au moins un fichier.');
    if (!confirm(`Déplacer ${ids.length} fichier(s) ?`)) return;

    let success = 0;
    for (const jobId of ids) {
        try {
            const url = `${API_BASE}/moveJob?username=${encodeURIComponent(__GLOBAL.email)}&token=${encodeURIComponent(__GLOBAL.token)}&jobId=${jobId}&folderId=${targetFolderId}&edition=${__GLOBAL.edition}`;
            const res = await fetch(url);
            const d = await res.json();
            if (d.status === 'OK') success++;
        } catch(e) { console.error('Move error', jobId, e); }
    }
    
    alert(`${success}/${ids.length} fichier(s) déplacé(s).`);
    location.reload();
  }

  // --- Job List Rendering ---
  function buildJobRow(job, template, container) {
    const clone = document.importNode(template, true);
    const row = clone.querySelector(SELECTORS.row);
    if (!row) return;

    row.setAttribute('data-job-id', job.jobid);
    
    // Status Icons
    const st = (job.transcriptStatus || '').toUpperCase();
    const icons = {
      error: clone.querySelector('.icon-error'),
      inprogress: clone.querySelector('.icon-inprogress'),
      ready: clone.querySelector('.icon-ready')
    };
    Object.values(icons).forEach(i => i && (i.style.display = 'none'));
    if (st.includes('ERROR')) { if(icons.error) icons.error.style.display='block'; }
    else if (['PENDING', 'IN_PROGRESS'].includes(st)) { if(icons.inprogress) icons.inprogress.style.display='block'; }
    else if (st.includes('READY')) { if(icons.ready) icons.ready.style.display='block'; }

    // Filename & Audio link
    const nameAnchor = clone.querySelector('.file-name');
    if (nameAnchor) {
      nameAnchor.textContent = displayJobTitle(job);
      nameAnchor.href = `${API_BASE}/receiveAudio?jobId=${job.jobid}&username=${encodeURIComponent(__GLOBAL.email)}&token=${encodeURIComponent(__GLOBAL.token)}&edition=${encodeURIComponent(__GLOBAL.edition)}`;
    }

    // Formats
    ['txt', 'rtf', 'docx', 'doc', 'pdf'].forEach(fmt => {
      const btn = clone.querySelector(`.download_wrapper-link_transcript_${fmt}`);
      if (btn) {
        if (st.includes('READY')) {
            btn.href = `${API_BASE}/receiveText?jobId=${job.jobid}&username=${encodeURIComponent(__GLOBAL.email)}&token=${encodeURIComponent(__GLOBAL.token)}&format=${fmt}&edition=${encodeURIComponent(__GLOBAL.edition)}`;
            btn.classList.remove('is-disabled');
            btn.target = "_blank";
        } else {
            btn.classList.add('is-disabled');
            btn.href = "#";
            btn.onclick = (e) => { e.preventDefault(); alert("Transcript en cours..."); };
        }
      }
    });

    container.appendChild(clone);
  }

  async function renderDashboard(email, token, edition) {
    const container = document.querySelector(SELECTORS.container);
    if (!container) return;

    try {
        const url = `${API_BASE}/getJobsInfo?username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}&limit=2000&offset=0`;
        const resp = await fetch(url);
        const data = await resp.json();
        __GLOBAL.lastApiData = data;

        if (data.status !== "OK") {
            container.innerHTML = `<div class="agilo-error-state">Erreur : ${data.errorMessage || 'Réponse invalide'}</div>`;
            return;
        }

        const template = document.querySelector(SELECTORS.template)?.content;
        if (!template) return;

        // Current Folder filtering
        const q = new URLSearchParams(location.search).get('folderId');
        const fid = (q !== null && q !== '' && !isNaN(Number(q))) ? Number(q) : null;
        
        let jobs = data.jobsInfoDtos || [];
        if (fid !== null) {
            jobs = jobs.filter(j => {
                // Defensive: check both folderId and folderid
                const jfid = Number(j.folderId != null ? j.folderId : (j.folderid != null ? j.folderid : 0));
                return jfid === fid;
            });
        }

        container.innerHTML = '';
        if (jobs.length === 0) {
            container.innerHTML = `<div class="agilo-empty-state">Aucun fichier dans ce dossier.</div>`;
        } else {
            jobs.sort((a,b) => convertDateStringToDate(b.dtCreation) - convertDateStringToDate(a.dtCreation))
                .forEach(job => buildJobRow(job, template, container));
        }

    } catch (err) {
        console.error('[Dashboard v1.1.7] Render error:', err);
        container.innerHTML = `<div class="agilo-error-state">Erreur de chargement.</div>`;
    }
  }

  // --- Startup ---
  function onCredentials(creds) {
    if (!creds || !creds.token || !creds.username) return;
    __GLOBAL.token = creds.token;
    __GLOBAL.email = creds.username;
    __GLOBAL.edition = getEdition();

    fetchFolders(__GLOBAL.email, __GLOBAL.token, __GLOBAL.edition);
    renderDashboard(__GLOBAL.email, __GLOBAL.token, __GLOBAL.edition);
  }

  // Support both events and legacy globalToken polling
  window.addEventListener('agilo:credentials:updated', (e) => onCredentials(e.detail));
  
  const initTmr = setInterval(() => {
    if (window.globalToken && window.globalEmail) {
        clearInterval(initTmr);
        onCredentials({ token: window.globalToken, username: window.globalEmail });
    }
  }, 200);

})();

