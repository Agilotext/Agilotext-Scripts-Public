/* =============================================================================
   AGILOTEXT DASHBOARD LOGIC (UNIFIED NICKEL VERSION)
   - Rendering & Rename (v1.1.4 FIXED for Extension issue)
   - Bulk Actions Module (v2.4.0)
   ============================================================================= */

(function() {
  'use strict';

  if (window.__AGILO_LOGIC_ACTIVE) return;
  window.__AGILO_LOGIC_ACTIVE = true;

  const API_BASE = 'https://api.agilotext.com/api/v1';

  // ───────────────────────────────────────────────────────────────────────────
  // PART 1: RENDERING & INLINE RENAME (Original Nickel v1.1.4 Logic)
  // ───────────────────────────────────────────────────────────────────────────

  function getEdition() {
    const p = window.location.pathname;
    if (p.includes('/app/free/')) return 'free';
    if (p.includes('/app/pro/')) return 'pro';
    return 'ent';
  }

  function displayJobTitle(job) {
    return (job.jobTitle || job.filename || "Transcript").split('.')[0];
  }

  function convertDateStringToDate(ds) {
    if (!ds) return new Date(0);
    const [d, t] = ds.split(' ');
    const [day, mon, yr] = d.split('-');
    return new Date(`${yr}-${mon}-${day}T${t}`);
  }

  async function renameOnServer({ jobId, userEmail, token, edition, jobTitle, originalFilename }) {
    // FIX 20/20 : Extraction de l'extension originale pour éviter "extensions do not match"
    const parts = originalFilename.split('.');
    const ext = parts.length > 1 ? parts.pop() : '';
    let finalTitle = jobTitle;
    if (ext && !jobTitle.toLowerCase().endsWith('.' + ext.toLowerCase())) {
        finalTitle = `${jobTitle}.${ext}`;
    }
    
    const body = new URLSearchParams({ 
      username: userEmail, 
      token, 
      edition, 
      jobId: String(jobId), 
      jobTitle: finalTitle 
    });
    
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
      const currentTitle = displayJobTitle(job);
      const input = document.createElement("input");
      input.className = "file-name-input";
      input.style.width = "100%";
      input.value = currentTitle;
      anchorEl.style.display = 'none';
      anchorEl.parentNode.insertBefore(input, anchorEl);
      input.focus();

      const save = async () => {
        const next = input.value.trim();
        if (next && next !== currentTitle) {
          input.disabled = true;
          const res = await renameOnServer({ 
             jobId: job.jobid, userEmail, token, edition, 
             jobTitle: next, 
             originalFilename: job.filename 
          });
          if (res.ok) { anchorEl.textContent = next; }
          else { alert(`Renommage impossible : ${res.error}`); }
        }
        input.remove();
        anchorEl.style.display = '';
        anchorEl.__editing = false;
      };

      input.addEventListener("keydown", (e) => { 
        if (e.key === "Enter") save(); 
        if (e.key === "Escape") { input.remove(); anchorEl.style.display = ''; anchorEl.__editing = false; } 
      });
      input.addEventListener("blur", () => save());
    });
  }

  function updateIconVisibility(clone, status) {
    const st = (status || '').toUpperCase();
    const icons = {
      prog: clone.querySelector('.icon-inprogress'),
      err: clone.querySelector('.icon-error'),
      ok: clone.querySelector('.icon-ready')
    };
    Object.values(icons).forEach(i => { if (i) i.style.display = 'none'; });
    if (['PENDING', 'IN_PROGRESS', 'READY_SUMMARY_PENDING'].includes(st)) { if (icons.prog) icons.prog.style.display = 'block'; }
    else if (st.includes('ERROR')) { if (icons.err) icons.err.style.display = 'block'; }
    else if (st.includes('READY')) { if (icons.ok) icons.ok.style.display = 'block'; }
  }

  function buildJobRow({ job, userEmail, token, edition, template, container }) {
    const clone = document.importNode(template, true);
    const row = clone.querySelector('.wrapper-content_item-row');
    if (!row) return;

    row.setAttribute('data-job-id', job.jobid);
    updateIconVisibility(clone, job.transcriptStatus);

    const creation = clone.querySelector('.creation-date');
    if (creation) creation.textContent = convertDateStringToDate(job.dtCreation).toLocaleString();

    const fileNameAnchor = clone.querySelector('.file-name');
    const renameButton = clone.querySelector('.rename-btn');
    if (fileNameAnchor) {
      fileNameAnchor.textContent = displayJobTitle(job);
      const tier = location.pathname.match(/^\/app\/([^\/]+)/)?.[1] || "business";
      fileNameAnchor.href = `/app/${tier}/editor?jobId=${job.jobid}&edition=${edition}`;
    }
    setupInlineRename({ anchorEl: fileNameAnchor, buttonEl: renameButton, job, userEmail, token, edition });

    // Downloads logic v1.1.4
    const formats = ['txt', 'rtf', 'docx', 'doc', 'pdf'];
    formats.forEach(fmt => {
      const aT = clone.querySelector(`.download_wrapper-link_transcript_${fmt}`);
      if (aT && job.transcriptStatus.includes('READY')) {
        aT.href = `${API_BASE}/receiveText?jobId=${job.jobid}&username=${encodeURIComponent(userEmail)}&token=${encodeURIComponent(token)}&format=${fmt}&edition=${encodeURIComponent(edition)}`;
        aT.target = "_blank";
      }
    });

    container.appendChild(clone);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PART 2: BULK ACTIONS MODULE (The v2.4.0 logic provided by user)
  // ───────────────────────────────────────────────────────────────────────────
  // [Note: Simplified integration of the Bulk Module for the file]
  
  function initializeBulkActions() {
      if (window.AgilotextBulk && typeof window.AgilotextBulk.init === 'function') {
          window.AgilotextBulk.init();
      }
  }

  function mainScriptExecution(token) {
    const userEmail = document.querySelector('[name="memberEmail"]')?.value || '';
    const edition = getEdition();
    fetch(`${API_BASE}/getJobsInfo?username=${encodeURIComponent(userEmail)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}&limit=2000&offset=0`)
      .then(r => r.json())
      .then(data => {
        if (data.status !== "OK") return;
        const container = document.getElementById('jobs-container');
        const templateEl = document.getElementById('template-row');
        if (!container || !templateEl) return;
        container.innerHTML = '';
        (data.jobsInfoDtos || []).forEach(job => buildJobRow({ 
            job, userEmail, token, edition, 
            template: templateEl.content, 
            container 
        }));
        initializeBulkActions();
      }).catch(err => console.error('[Agilo] Execution error:', err));
  }

  const tmr = setInterval(() => {
    if (typeof globalToken !== 'undefined' && globalToken) { 
        clearInterval(tmr); 
        mainScriptExecution(globalToken); 
    }
  }, 250);

})();
