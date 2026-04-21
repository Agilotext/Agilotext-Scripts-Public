(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  DASHBOARD UNIFIED LOGIC — v1.1.8
  //  - Full Selection Management (Count, Select All, Visibility)
  //  - Case-insensitive folderId detection
  //  - Unified Bulk Handlers (Delete, Export, Move)
  //  - Auto-UI Injection recovery
  // ═══════════════════════════════════════════════════════════════════

  const VERSION = '1.1.8';
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
    bulkBar: '.code-open-editor-bulk-select', 
    template: '#template-row',
    bulkDeleteBtn: '#bulkDeleteBtn',
    exportBtn: '#exportBtn'
  };

  // --- Theme ---
  (function injectTheme() {
    if (document.getElementById('agilo-dashboard-v118-theme')) return;
    const css = `
      .is-disabled { opacity: .6; cursor: not-allowed; }
      .agilo-empty-state { text-align: center; padding: 40px 20px; color: #666; font-style: italic; background: rgba(0,0,0,0.02); border-radius: 8px; margin: 10px 0; }
      .agilo-error-state { text-align: center; padding: 40px 20px; color: #d93025; background: #fce8e6; border-radius: 8px; margin: 10px 0; border: 1px solid #f28b82; }
      .agilo-bulk-move-wrap { display: flex; align-items: center; gap: 8px; margin-left: 12px; padding-left: 12px; border-left: 1px solid #eee; }
      .agilo-select-move { padding: 6px 10px; border-radius: 4px; border: 1px solid #ddd; font-size: 13px; outline: none; background: #fff; cursor: pointer; max-width: 160px; }
      .agilo-select-move:hover { border-color: #bbb; }
      /* Force bulk bar visibility when active */
      .code-open-editor-bulk-select.is-active { display: flex !important; opacity: 1 !important; pointer-events: auto !important; height: auto !important; }
    `;
    const st = document.createElement('style');
    st.id = 'agilo-dashboard-v118-theme';
    st.textContent = css;
    document.head.appendChild(st);
  })();

  // --- Utils ---
  const getFidFromUrl = () => {
    const p = new URLSearchParams(location.search);
    const q = p.get('folderId') || p.get('folderid'); // Case-insensitive
    return (q !== null && q !== '' && !isNaN(Number(q))) ? Number(q) : null;
  };

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

  // --- Selection Management ---
  function updateSelectionUI() {
    const all = Array.from(document.querySelectorAll(`${SELECTORS.container} .job-select`));
    const checked = all.filter(cb => cb.checked);
    const countEl = document.querySelector(SELECTORS.selectedCount);
    const selectAll = document.querySelector(SELECTORS.selectAll);
    const bulkBar = document.querySelector(SELECTORS.bulkBar);

    if (countEl) countEl.textContent = `${checked.length} sélectionné(s)`;
    if (selectAll) {
        selectAll.checked = (all.length > 0 && checked.length === all.length);
        selectAll.indeterminate = (checked.length > 0 && checked.length < all.length);
    }
    
    if (bulkBar) {
        if (checked.length > 0) bulkBar.classList.add('is-active');
        else bulkBar.classList.remove('is-active');
    }
  }

  // --- UI Injection for Bulk Move ---
  function ensureBulkMoveUI() {
    if (document.getElementById('agilo-bulk-folder-select')) return;
    const targets = [SELECTORS.bulkDeleteBtn, SELECTORS.exportBtn, SELECTORS.bulkBar];
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
    wrap.innerHTML = `<select id="agilo-bulk-folder-select" class="agilo-select-move"><option value="" disabled selected>Déplacer vers...</option></select>`;
    parent.insertBefore(wrap, anchor);

    const sel = wrap.querySelector('select');
    sel.addEventListener('change', async (e) => {
        const targetFid = e.target.value;
        if (!targetFid) return;
        await handleBulkMove(targetFid);
        e.target.value = '';
    });
  }

  // --- API Handlers ---
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
    } catch (e) { console.error('[Folders] Metadata fail', e); }
  }

  function updateMoveDropdown() {
    ensureBulkMoveUI();
    const sel = document.getElementById('agilo-bulk-folder-select');
    if (!sel) return;
    sel.innerHTML = '<option value="" disabled selected>Déplacer vers...</option>';
    Array.from(__GLOBAL.folderMap.entries()).sort((a,b) => (a[0]===0?-1:(b[0]===0?1:a[1].localeCompare(b[1]))))
      .forEach(([id, name]) => {
        const opt = document.createElement('option');
        opt.value = String(id); opt.textContent = name;
        sel.appendChild(opt);
      });
  }

  function updateHeaderLabel() {
    const labelEl = document.getElementById('agilo-bulk-folder-current');
    if (!labelEl) return;
    const fid = getFidFromUrl();
    if (fid === null) { labelEl.hidden = true; return; }
    labelEl.textContent = `Dossier : ${__GLOBAL.folderMap.get(fid) || fid}`;
    labelEl.hidden = false;
  }

  function getSelectedJobIds() {
    return Array.from(document.querySelectorAll(`${SELECTORS.container} .job-select:checked`))
                .map(cb => cb.closest(SELECTORS.row)?.getAttribute('data-job-id'))
                .filter(Boolean);
  }

  async function handleBulkMove(targetFolderId) {
    const ids = getSelectedJobIds();
    if (ids.length === 0) return;
    if (!confirm(`Déplacer ${ids.length} fichier(s) ?`)) return;
    for (const jobId of ids) {
      await fetch(`${API_BASE}/moveJob?username=${encodeURIComponent(__GLOBAL.email)}&token=${encodeURIComponent(__GLOBAL.token)}&jobId=${jobId}&folderId=${targetFolderId}&edition=${__GLOBAL.edition}`).catch(()=>{});
    }
    location.reload();
  }

  async function handleBulkDelete() {
    const ids = getSelectedJobIds();
    if (ids.length === 0) return;
    if (!confirm(`Supprimer définitivement ${ids.length} fichier(s) ?`)) return;
    for (const jobId of ids) {
      await fetch(`${API_BASE}/deleteJob?username=${encodeURIComponent(__GLOBAL.email)}&token=${encodeURIComponent(__GLOBAL.token)}&jobId=${jobId}&edition=${__GLOBAL.edition}`).catch(()=>{});
    }
    location.reload();
  }

  // --- Rendering ---
  function buildJobRow(job, template, container) {
    const clone = document.importNode(template, true);
    const row = clone.querySelector(SELECTORS.row);
    if (!row) return;

    row.setAttribute('data-job-id', job.jobid);
    const st = (job.transcriptStatus || '').toUpperCase();
    
    // Status Icons
    const icons = { err: clone.querySelector('.icon-error'), prog: clone.querySelector('.icon-inprogress'), ok: clone.querySelector('.icon-ready') };
    Object.values(icons).forEach(i => i && (i.style.display = 'none'));
    if (st.includes('ERROR')) icons.err && (icons.err.style.display='block');
    else if (['PENDING', 'IN_PROGRESS'].includes(st)) icons.prog && (icons.prog.style.display='block');
    else if (st.includes('READY')) icons.ok && (icons.ok.style.display='block');

    const nameAnchor = clone.querySelector('.file-name');
    if (nameAnchor) {
      nameAnchor.textContent = displayJobTitle(job);
      nameAnchor.href = `${API_BASE}/receiveAudio?jobId=${job.jobid}&username=${encodeURIComponent(__GLOBAL.email)}&token=${encodeURIComponent(__GLOBAL.token)}&edition=${encodeURIComponent(__GLOBAL.edition)}`;
    }

    // Buttons
    ['txt', 'rtf', 'docx', 'doc', 'pdf'].forEach(fmt => {
      const b = clone.querySelector(`.download_wrapper-link_transcript_${fmt}`);
      if (b) {
        if (st.includes('READY')) {
            b.href = `${API_BASE}/receiveText?jobId=${job.jobid}&username=${encodeURIComponent(__GLOBAL.email)}&token=${encodeURIComponent(__GLOBAL.token)}&format=${fmt}&edition=${encodeURIComponent(__GLOBAL.edition)}`;
            b.classList.remove('is-disabled'); b.target = "_blank";
        } else { b.classList.add('is-disabled'); b.href = "#"; b.onclick = (e) => { e.preventDefault(); alert("En cours..."); }; }
      }
    });

    container.appendChild(clone);
  }

  async function renderDashboard(email, token, edition) {
    const container = document.querySelector(SELECTORS.container);
    if (!container) return;
    try {
        const resp = await fetch(`${API_BASE}/getJobsInfo?username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}&limit=2000&offset=0`);
        const data = await resp.json();
        __GLOBAL.lastApiData = data;
        const template = document.querySelector(SELECTORS.template)?.content;
        if (!template || data.status !== "OK") return;

        const fid = getFidFromUrl();
        let jobs = data.jobsInfoDtos || [];
        if (fid !== null) {
            jobs = jobs.filter(j => Number(j.folderId != null ? j.folderId : (j.folderid != null ? j.folderid : 0)) === fid);
        }

        container.innerHTML = '';
        if (jobs.length === 0) container.innerHTML = `<div class="agilo-empty-state">Aucun fichier ici.</div>`;
        else {
            jobs.sort((a,b) => convertDateStringToDate(b.dtCreation) - convertDateStringToDate(a.dtCreation))
                .forEach(job => buildJobRow(job, template, container));
        }
        updateSelectionUI();
    } catch (e) { console.error('Render fail', e); }
  }

  // --- Events ---
  function bindGlobalEvents() {
    document.addEventListener('change', (e) => {
      if (e.target.closest(SELECTORS.selectAll)) {
        const checked = e.target.checked;
        document.querySelectorAll(`${SELECTORS.container} .job-select`).forEach(cb => cb.checked = checked);
        updateSelectionUI();
      }
      if (e.target.classList.contains('job-select')) updateSelectionUI();
    });

    document.addEventListener('click', (e) => {
        if (e.target.closest(SELECTORS.bulkDeleteBtn)) handleBulkDelete();
    });
  }

  function onCredentials(creds) {
    if (!creds || !creds.token || !creds.username) return;
    __GLOBAL.token = creds.token; __GLOBAL.email = creds.username;
    __GLOBAL.edition = getEdition();
    fetchFolders(__GLOBAL.email, __GLOBAL.token, __GLOBAL.edition);
    renderDashboard(__GLOBAL.email, __GLOBAL.token, __GLOBAL.edition);
  }

  bindGlobalEvents();
  window.addEventListener('agilo:credentials:updated', (e) => onCredentials(e.detail));
  const initTmr = setInterval(() => { if (window.globalToken && window.globalEmail) { clearInterval(initTmr); onCredentials({ token: window.globalToken, username: window.globalEmail }); } }, 200);

})();


