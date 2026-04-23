/* =============================================================================
   AGILOTEXT DASHBOARD LOGIC (UNIFIED NICKEL VERSION)
   - Rendering & Rename (v1.1.4 FIXED for Extension issue)
   - Bulk Actions Module (v2.4.0)
   - v1.06: receiveSummary pour download_wrapper-link_summary_* (compte rendu)
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
    if (p.includes('/app/pro/') || p.includes('/app/premium/')) return 'pro';
    if (p.includes('/app/ent/') || p.includes('/app/business/')) return 'ent';
    return 'ent'; // Business par défaut si non trouvé
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

  function isSummaryReadyForDownload(transcriptStatus) {
    return String(transcriptStatus || '').toUpperCase() === 'READY_SUMMARY_READY';
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

  const FALLBACK_ROW_HTML = `
    <div class="wrapper-content_item-row responsive items-row">
      <div class="custom-element select"><input type="checkbox" class="job-checkbox"></div>
      <div class="custom-element state">
        <div class="icon-inprogress" style="display:none;font-size:1.2rem;">⏳</div>
        <div class="icon-error" style="display:none;font-size:1.2rem;">⚠️</div>
        <div class="icon-ready" style="display:none;font-size:1.2rem;">✅</div>
      </div>
      <div class="custom-element titles">
        <div style="display:flex; align-items:center; gap:8px;">
          <a href="#" class="file-name" style="text-decoration:none; color:inherit; font-weight:600;"></a>
          <button class="rename-btn" style="background:none; border:none; cursor:pointer; padding:0; opacity:0.5; font-size:14px;">✏️</button>
        </div>
      </div>
      <div class="custom-element titles"><a href="#" class="open-link" style="color:#174a96; font-weight:600; text-decoration:none;">Éditer</a></div>
      <div class="custom-element titles transcript-links" style="display:flex; gap:6px; flex-wrap:wrap;">
        <a href="#" class="download_wrapper-link_transcript_txt" title="Télécharger TXT" style="font-size:11px; padding:3px 6px; background:#f3f4f6; border-radius:4px; text-decoration:none; color:#374151; border:1px solid #d1d5db;">TXT</a>
        <a href="#" class="download_wrapper-link_transcript_pdf" title="Télécharger PDF" style="font-size:11px; padding:3px 6px; background:#f3f4f6; border-radius:4px; text-decoration:none; color:#374151; border:1px solid #d1d5db;">PDF</a>
        <a href="#" class="download_wrapper-link_transcript_docx" title="Télécharger DOCX" style="font-size:11px; padding:3px 6px; background:#f3f4f6; border-radius:4px; text-decoration:none; color:#374151; border:1px solid #d1d5db;">DOCX</a>
      </div>
      <div class="custom-element titles horizontal"><div class="creation-date" style="font-size:12px; color:#6b7280;"></div></div>
      <div class="custom-element titles report-links">
        <a href="#" class="download_wrapper-link_summary_doc" title="Télécharger Compte-rendu" style="font-size:11px; padding:3px 6px; background:#eff6ff; border-radius:4px; text-decoration:none; color:#1e40af; border:1px solid #bfdbfe; font-weight:500;">CR</a>
      </div>
      <div class="custom-element titles">
        <button class="delete-job-button" title="Supprimer" style="background:none; border:none; cursor:pointer; color:#991b1b; font-size:16px; padding:4px;">🗑️</button>
      </div>
    </div>
  `;

  function buildJobRow({ job, userEmail, token, edition, template, container }) {
    let row;
    let clone;

    // TENTATIVE 1: Utiliser le template de la page
    if (template && template.querySelector && template.querySelector('.wrapper-content_item-row')) {
      clone = document.importNode(template, true);
      row = clone.querySelector('.wrapper-content_item-row');
    }

    // TENTATIVE 2: Fallback si le template est absent ou vide (cas fréquent sur page Free)
    if (!row) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = FALLBACK_ROW_HTML;
      clone = tempDiv;
      row = tempDiv.querySelector('.wrapper-content_item-row');
    }

    if (!row) return;

    row.setAttribute('data-job-id', job.jobid);
    updateIconVisibility(clone, job.transcriptStatus);

    const creation = clone.querySelector('.creation-date');
    if (creation) creation.textContent = convertDateStringToDate(job.dtCreation).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });

    const fileNameAnchor = clone.querySelector('.file-name');
    const renameButton = clone.querySelector('.rename-btn');
    const openLink = clone.querySelector('.open-link');

    if (fileNameAnchor) {
      fileNameAnchor.textContent = displayJobTitle(job);
      // ✅ AJOUT : Tooltip affichant le nom de fichier original au survol
      fileNameAnchor.title = "Fichier original : " + (job.filename || "Inconnu");
      const tier = location.pathname.match(/^\/app\/([^\/]+)/)?.[1] || "business";
      fileNameAnchor.href = `/app/${tier}/editor?jobId=${job.jobid}&edition=${edition}`;
      if (openLink) openLink.href = fileNameAnchor.href;
    }
    setupInlineRename({ anchorEl: fileNameAnchor, buttonEl: renameButton, job, userEmail, token, edition });

    // Downloads logic v1.1.4
    const formats = ['txt', 'rtf', 'docx', 'doc', 'pdf'];
    formats.forEach(fmt => {
      const aT = clone.querySelector(`.download_wrapper-link_transcript_${fmt}`);
      if (aT && job.transcriptStatus && job.transcriptStatus.includes('READY')) {
        aT.href = `${API_BASE}/receiveText?jobId=${job.jobid}&username=${encodeURIComponent(userEmail)}&token=${encodeURIComponent(token)}&format=${fmt}&edition=${encodeURIComponent(edition)}`;
        aT.target = "_blank";
        aT.style.display = 'inline-block';
      } else if (aT) {
        aT.style.display = 'none';
      }
    });

    const summaryFormats = [
      { slot: 'txt', apiFormat: 'html' },
      { slot: 'rtf', apiFormat: 'rtf' },
      { slot: 'doc', apiFormat: 'doc' },
      { slot: 'docx', apiFormat: 'docx' },
      { slot: 'pdf', apiFormat: 'pdf' }
    ];
    summaryFormats.forEach(({ slot, apiFormat }) => {
      const aS = clone.querySelector(`.download_wrapper-link_summary_${slot}`);
      if (aS && isSummaryReadyForDownload(job.transcriptStatus)) {
        aS.href = `${API_BASE}/receiveSummary?jobId=${job.jobid}&username=${encodeURIComponent(userEmail)}&token=${encodeURIComponent(token)}&format=${apiFormat}&edition=${encodeURIComponent(edition)}`;
        aS.target = '_blank';
        aS.style.display = 'inline-block';
      } else if (aS) {
        aS.style.display = 'none';
      }
    });

    container.appendChild(row);
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

  async function mainScriptExecution(token) {
    const emailInput = document.querySelector('[name="memberEmail"]');
    const userEmail = (emailInput?.value || emailInput?.getAttribute('src') || emailInput?.textContent || "").trim();
    let edition = getEdition();

    if (!userEmail) {
      console.warn("[Agilo] Email utilisateur non trouvé dans le DOM.");
      return;
    }
    
    async function getJobs(ed) {
      const urlParams = new URLSearchParams(window.location.search);
      const folderId = urlParams.get('folderId');
      let url = `${API_BASE}/getJobsInfo?username=${encodeURIComponent(userEmail)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(ed)}&limit=2000&offset=0`;
      if (folderId) {
        url += `&folderId=${encodeURIComponent(folderId)}`;
      }
      const r = await fetch(url);
      return await r.json();
    }

    try {
      let data = await getJobs(edition);
      
      // FALLBACK LOGIQUE : Si vide en "free", on regarde en "ent" (Business)
      if ((!data.jobsInfoDtos || data.jobsInfoDtos.length === 0) && edition === 'free') {
        console.log("[Agilo] Aucun job en 'free', tentative de secours en 'ent' pour :", userEmail);
        const fallbackData = await getJobs('ent');
        if (fallbackData.status === "OK" && fallbackData.jobsInfoDtos?.length > 0) {
          data = fallbackData;
          edition = 'ent'; 
        }
      }

      if (data.status !== "OK") return;
      const container = document.getElementById('jobs-container');
      const templateEl = document.getElementById('template-row');
      if (!container || !templateEl) return;
      
      container.innerHTML = '';

      if (!data.jobsInfoDtos || data.jobsInfoDtos.length === 0) {
        container.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 60px 20px; text-align: center; background: #ffffff; border: 1px dashed #d1d5db; border-radius: 12px; margin: 20px 0; width: 100%;">
            <div style="font-size: 32px; margin-bottom: 12px;">📁</div>
            <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 600;">Aucune transcription trouvée</p>
            <p style="margin: 8px 0 0; color: #6b7280; font-size: 14px;">Ce dossier est vide ou vos fichiers sont en cours de traitement.</p>
          </div>
        `;
        return;
      }

      data.jobsInfoDtos.forEach(job => buildJobRow({ 
          job, userEmail, token, edition, 
          template: templateEl.content, 
          container 
      }));
      initializeBulkActions();
    } catch (err) {
      console.error('[Agilo] Execution error:', err);
    }
  }

  const tmr = setInterval(() => {
    if (typeof globalToken !== 'undefined' && globalToken) { 
        clearInterval(tmr); 
        mainScriptExecution(globalToken); 
    }
  }, 250);

})();
