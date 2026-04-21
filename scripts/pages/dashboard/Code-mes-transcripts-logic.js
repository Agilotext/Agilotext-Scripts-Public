(function() {
  'use strict';

  if (window.__AGILO_LOCKED_v1114) return;
  window.__AGILO_LOCKED_v1114 = true;

  // ═══════════════════════════════════════════════════════════════════
  //  DASHBOARD UNIFIED LOGIC — v1.1.14 (PRODUCTION LIVE 20/20)
  //  - Bypass Cache & Conflict Renaming
  //  - Aggressive Global Detection (MemberStack + globalToken)
  //  - Auto-Sanitizer for SVGs (Fixes 'auto' attribute errors)
  //  - Integrated Bridge (Folder ID sync)
  // ═══════════════════════════════════════════════════════════════════

  const VERSION = '1.1.14';
  const API_BASE = 'https://api.agilotext.com/api/v1';

  const __STATE = { 
    token: null, email: null, edition: 'ent', 
    folderMap: new Map(), lastApiData: null, version: VERSION,
    currentFolderId: null
  };
  window.__AGILO_V14 = __STATE;

  const SELECTORS = {
    container: '#jobs-container',
    row: '.wrapper-content_item-row',
    selectAll: '#select-all',
    selectedCount: '#selected-count',
    bulkBar: '.bulk-actions-bar', // Fixed for Business
    template: '#template-row',
    bulkDeleteBtn: '#bulkDeleteBtn',
    exportBtn: '#exportBtn'
  };

  (function injectTheme() {
    if (document.getElementById('agilo-dashboard-v1114-theme')) return;
    const css = `
      .is-disabled { opacity: .6; cursor: not-allowed; }
      .agilo-empty-state { text-align: center; padding: 40px 20px; color: #666; background: rgba(0,0,0,0.02); border-radius: 8px; margin: 10px 0; }
      .agilo-bulk-move-wrap { display: flex; align-items: center; gap: 8px; margin-left: 12px; padding-left: 12px; border-left: 1px solid rgba(0,0,0,0.1); }
      .agilo-select-move { padding: 6px 10px; border-radius: 4px; border: 1px solid #ddd; font-size: 13px; outline: none; background: #fff; cursor: pointer; max-width: 160px; color: #333 !important; height: auto !important; }
      .agilo-force-show { display: flex !important; opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; height: auto !important; }
    `;
    const st = document.createElement('style');
    st.id = 'agilo-dashboard-v1114-theme';
    st.textContent = css;
    document.head.appendChild(st);
  })();

  function sanitizeNode(node) {
    node.querySelectorAll('svg').forEach(s => {
      if (s.getAttribute('width') === 'auto') s.removeAttribute('width');
      if (s.getAttribute('height') === 'auto') s.removeAttribute('height');
    });
  }

  const findUserEmail = () => {
    if (__STATE.email) return __STATE.email;
    const selectors = ['[name="memberEmail"]', '[data-ms-member="email"]', '#memberEmail', '.memberemail'];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        let val = el.getAttribute('src') || el.value || el.textContent || '';
        val = val.trim();
        if (val.includes('@')) { __STATE.email = val; return val; }
      }
    }
    return null;
  };

  const syncFolderIdFromUrl = () => {
    const p = new URLSearchParams(location.search);
    const q = p.get('folderId') || p.get('folderid');
    const fid = (q !== null && q !== '' && !isNaN(Number(q))) ? Number(q) : null;
    __STATE.currentFolderId = fid;
    return fid;
  };

  const getBulkBar = () => {
    return document.querySelector(SELECTORS.bulkBar) || 
           document.querySelector(SELECTORS.selectedCount)?.parentElement || 
           document.querySelector(SELECTORS.bulkDeleteBtn)?.parentElement;
  };

  function updateSelectionUI() {
    const container = document.querySelector(SELECTORS.container);
    if (!container) return;
    const all = Array.from(container.querySelectorAll('.job-select'));
    const checked = all.filter(cb => cb.checked);
    const countEl = document.querySelector(SELECTORS.selectedCount);
    const bar = getBulkBar();

    if (countEl) countEl.textContent = `${checked.length} sélectionné(s)`;
    if (bar) {
        if (checked.length > 0) bar.classList.add('agilo-force-show');
        else bar.classList.remove('agilo-force-show');
    }
  }

  function ensureBulkMoveUI() {
    if (document.getElementById('agilo-bulk-folder-select')) return;
    const bar = getBulkBar();
    if (!bar) return;
    const wrap = document.createElement('div');
    wrap.className = 'agilo-bulk-move-wrap';
    wrap.innerHTML = `<select id="agilo-bulk-folder-select" class="agilo-select-move"><option value="" disabled selected>Déplacer vers...</option></select>`;
    const countEl = document.querySelector(SELECTORS.selectedCount);
    if (countEl && countEl.nextSibling) bar.insertBefore(wrap, countEl.nextSibling);
    else bar.appendChild(wrap);
    wrap.querySelector('select').addEventListener('change', async (e) => {
        if (e.target.value) { await handleBulkMove(e.target.value); e.target.value = ''; }
    });
  }

  async function fetchFolders(email, token) {
    try {
      const resp = await fetch(`${API_BASE}/getTranscriptFolders?username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=ent`);
      const j = await resp.json();
      if (j.status === 'OK') {
        const raw = j.folders || j.transcriptFolderDtos || j.transcriptFolders || [];
        __STATE.folderMap.clear(); __STATE.folderMap.set(0, 'Non classé');
        raw.forEach(f => {
          const id = Number(f.folderId != null ? f.folderId : f.id);
          const name = String(f.folderName != null ? f.folderName : f.name || '').trim();
          if (!isNaN(id) && name) __STATE.folderMap.set(id, name);
        });
        updateMoveDropdown();
      }
    } catch (e) {}
  }

  function updateMoveDropdown() {
    ensureBulkMoveUI();
    const sel = document.getElementById('agilo-bulk-folder-select');
    if (!sel) return;
    sel.innerHTML = '<option value="" disabled selected>Déplacer vers...</option>';
    Array.from(__STATE.folderMap.entries()).sort((a,b)=>(a[0]===0?-1:(b[0]===0?1:a[1].localeCompare(b[1]))))
      .forEach(([id, name]) => {
        const opt = document.createElement('option');
        opt.value = id; opt.textContent = name; sel.appendChild(opt);
      });
  }

  async function handleBulkMove(fid) {
    const ids = Array.from(document.querySelectorAll(`${SELECTORS.container} .job-select:checked`)).map(cb=>cb.closest(SELECTORS.row)?.dataset.jobId).filter(Boolean);
    if (!ids.length || !confirm(`Déplacer ${ids.length} fichier(s) ?`)) return;
    for (const id of ids) await fetch(`${API_BASE}/moveJob?username=${encodeURIComponent(__STATE.email)}&token=${encodeURIComponent(__STATE.token)}&jobId=${id}&folderId=${fid}&edition=ent`).catch(()=>{});
    location.reload();
  }

  async function handleBulkDelete() {
    const ids = Array.from(document.querySelectorAll(`${SELECTORS.container} .job-select:checked`)).map(cb=>cb.closest(SELECTORS.row)?.dataset.jobId).filter(Boolean);
    if (!ids.length || !confirm(`Supprimer ${ids.length} fichier(s) ?`)) return;
    for (const id of ids) await fetch(`${API_BASE}/deleteJob?username=${encodeURIComponent(__STATE.email)}&token=${encodeURIComponent(__STATE.token)}&jobId=${id}&edition=ent`).catch(()=>{});
    location.reload();
  }

  function buildJobRow(job, template, container) {
    const clone = document.importNode(template, true);
    sanitizeNode(clone);
    const row = clone.querySelector(SELECTORS.row);
    if (!row) return;
    row.dataset.jobId = job.jobid;
    const st = (job.transcriptStatus || '').toUpperCase();
    const icons = { err: clone.querySelector('.icon-error'), prog: clone.querySelector('.icon-inprogress'), ok: clone.querySelector('.icon-ready') };
    Object.values(icons).forEach(i => i && (i.style.display = 'none'));
    if (st.includes('ERROR')) icons.err && (icons.err.style.display='block');
    else if (['PENDING', 'IN_PROGRESS'].includes(st)) icons.prog && (icons.prog.style.display='block');
    else if (st.includes('READY')) icons.ok && (icons.ok.style.display='block');

    const nm = clone.querySelector('.file-name');
    if (nm) { 
        nm.textContent = (job.jobTitle || job.filename || 'Transcript').split('.')[0];
        nm.href = `${API_BASE}/receiveAudio?jobId=${job.jobid}&username=${encodeURIComponent(__STATE.email)}&token=${encodeURIComponent(__STATE.token)}&edition=ent`;
    }
    ['txt', 'rtf', 'docx', 'doc', 'pdf'].forEach(fmt => {
      const b = clone.querySelector(`.download_wrapper-link_transcript_${fmt}`);
      if (b && st.includes('READY')) { b.href = `${API_BASE}/receiveText?jobId=${job.jobid}&username=${encodeURIComponent(__STATE.email)}&token=${encodeURIComponent(__STATE.token)}&format=${fmt}&edition=ent`; b.target = "_blank"; }
    });
    container.appendChild(clone);
  }

  async function renderDashboard(email, token) {
    const container = document.querySelector(SELECTORS.container);
    const template = document.querySelector(SELECTORS.template)?.content;
    if (!container || !template) return;
    try {
        const resp = await fetch(`${API_BASE}/getJobsInfo?username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=ent&limit=2000&offset=0`);
        const data = await resp.json();
        if (data.status !== "OK") return;
        __STATE.lastApiData = data;
        const fid = syncFolderIdFromUrl();
        let jobs = data.jobsInfoDtos || [];
        if (fid !== null) jobs = jobs.filter(j => Number(j.folderId ?? j.folderid ?? 0) === fid);

        container.innerHTML = ''; 
        if (!jobs.length) container.innerHTML = `<div class="agilo-empty-state">Aucun fichier trouvé ici.</div>`;
        else {
            jobs.sort((a,b) => new Date(b.dtCreation?.split(/[- :]/).reverse().join('-') || 0) - new Date(a.dtCreation?.split(/[- :]/).reverse().join('-') || 0))
                .forEach(job => buildJobRow(job, template, container));
        }
        updateSelectionUI();
    } catch (e) { console.error('[Agilo] Render fail', e); }
  }

  function start(token, email) {
    if (__STATE.started) return;
    __STATE.token = token; __STATE.email = email; __STATE.started = true;
    console.log(`%c ⭐⭐⭐ AGILOTEXT v${VERSION} INITIALISÉ ⭐⭐⭐ `, "color: #1f8f3a; background: #e6ffec; font-weight: bold; border: 1px solid #1f8f3a; padding: 4px; border-radius: 4px;");
    fetchFolders(email, token);
    renderDashboard(email, token);
  }

  document.addEventListener('change', (e) => {
    if (e.target.closest(SELECTORS.selectAll)) {
      document.querySelectorAll(`${SELECTORS.container} .job-select`).forEach(cb => cb.checked = e.target.checked);
      updateSelectionUI();
    }
    if (e.target.classList.contains('job-select')) updateSelectionUI();
  });
  document.addEventListener('click', (e) => { if (e.target.closest(SELECTORS.bulkDeleteBtn)) handleBulkDelete(); });

  window.addEventListener('agilo:credentials:updated', (e) => {
    if (e.detail.token && (e.detail.username || findUserEmail())) {
        start(e.detail.token, e.detail.username || findUserEmail());
    }
  });

  const initTmr = setInterval(() => { 
    const email = findUserEmail();
    const token = (typeof globalToken !== 'undefined' ? globalToken : (window.globalToken || null));
    if (token && email) { clearInterval(initTmr); start(token, email); } 
  }, 250);

})();
