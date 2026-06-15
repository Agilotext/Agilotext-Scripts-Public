/* =============================================================================
   AGILOTEXT DASHBOARD LOGIC (UNIFIED NICKEL VERSION)
   - Rendering & Rename (v1.1.4 FIXED for Extension issue)
   - Bulk Actions Module (v2.4.0)
   - v1.06: receiveSummary pour download_wrapper-link_summary_* (compte rendu)
   - v1.06.1: ne pas forcer display:inline-block sur les liens (laisser le flex Webflow)
   - v1.08: liste blanche receiveText ; verrou téléchargements vides ; tooltips État ;
            icônes SVG alignées editor ; data-creation-date ; aria-expanded fermé au rendu.
   ============================================================================= */

(function () {
  'use strict';

  if (window.__AGILO_LOGIC_ACTIVE) return;
  window.__AGILO_LOGIC_ACTIVE = true;
  window.__agiloMesTranscriptsLogicVersion = '1.10';

  const API_BASE = 'https://api.agilotext.com/api/v1';

  (function injectAgiloMesTranscriptsLockStyles() {
    if (document.getElementById('agilo-mes-transcripts-lock-style')) return;
    const style = document.createElement('style');
    style.id = 'agilo-mes-transcripts-lock-style';
    style.textContent =
      '#jobs-container .custom-element.options.agilo-download-locked{' +
      'pointer-events:none;opacity:.5;cursor:not-allowed;}' +
      '#jobs-container .custom-element.options.agilo-download-locked .download-link,' +
      '#jobs-container .custom-element.options.agilo-download-locked svg.options{cursor:not-allowed;}';
    document.head.appendChild(style);
  })();

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
    return (job.jobTitle || job.filename || 'Transcript').split('.')[0];
  }

  function convertDateStringToDate(ds) {
    if (!ds) return new Date(0);
    const [d, t] = ds.split(' ');
    const [day, mon, yr] = d.split('-');
    return new Date(`${yr}-${mon}-${day}T${t}`);
  }

  /** Liste blanche : transcript textuel considéré disponible api receiveText ; pas de sous-chaîne ERROR. */
  const TRANSCRIPT_TEXT_DOWNLOAD_STATUSES = new Set([
    'READY',
    'READY_TRANSCRIPT',
    'READY_TEXT',
    'READY_SUMMARY_PENDING',
    'READY_SUMMARY_READY'
  ]);

  function isTranscriptTextDownloadAllowed(status) {
    const st = String(status || '').toUpperCase();
    if (!st || st.includes('ERROR')) return false;
    return TRANSCRIPT_TEXT_DOWNLOAD_STATUSES.has(st);
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
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });
      const data = await r.json();
      if (data.status === 'OK') return { ok: true };
      return {
        ok: false,
        error: data.message || data.errorMessage || data.error || 'Erreur inconnue'
      };
    } catch (e) {
      return { ok: false, error: e?.message || 'Erreur réseau' };
    }
  }

  function setupInlineRename({ anchorEl, buttonEl, job, userEmail, token, edition }) {
    if (!anchorEl || !buttonEl) return;
    buttonEl.setAttribute('type', 'button');
    buttonEl.setAttribute('title', 'Renommer ce fichier');
    buttonEl.setAttribute('aria-label', 'Renommer ce fichier');
    const icon = buttonEl.querySelector('svg');
    if (icon) {
      icon.style.display = 'flex';
      icon.removeAttribute('hidden');
      icon.setAttribute('aria-hidden', 'true');
    }
    buttonEl.addEventListener('click', () => {
      if (anchorEl.__editing) return;
      anchorEl.__editing = true;
      const currentTitle = displayJobTitle(job);
      const input = document.createElement('input');
      input.className = 'file-name-input';
      input.style.width = '100%';
      input.value = currentTitle;
      anchorEl.style.display = 'none';
      anchorEl.parentNode.insertBefore(input, anchorEl);
      input.focus();

      const save = async () => {
        const next = input.value.trim();
        if (next && next !== currentTitle) {
          input.disabled = true;
          const res = await renameOnServer({
            jobId: job.jobid,
            userEmail,
            token,
            edition,
            jobTitle: next,
            originalFilename: job.filename
          });
          if (res.ok) {
            anchorEl.textContent = next;
          } else {
            console.warn('[Agilo][MesTranscripts] renameTranscriptTitle failed', {
              jobId: job.jobid,
              reason: res.error
            });
            alert(`Impossible de renommer ce fichier : ${res.error}`);
          }
        }
        input.remove();
        anchorEl.style.display = '';
        anchorEl.__editing = false;
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') {
          input.remove();
          anchorEl.style.display = '';
          anchorEl.__editing = false;
        }
      });
      input.addEventListener('blur', () => save());
    });
  }

  function jobJavaException(job) {
    return String(
      job?.javaException || job?.exceptionMessage || job?.errorMessage || ''
    ).toLowerCase();
  }

  function isNoSummaryRequested(job) {
    const pid = Number(job?.promptid ?? job?.promptId);
    return pid === -1;
  }

  function isDurationTooLongError(job) {
    return jobJavaException(job).includes('error_duration_is_too_long');
  }

  function retentionAudioDays(edition) {
    const e = String(edition || getEdition()).toLowerCase();
    if (e === 'free') return 1;
    if (e === 'pro') return 30;
    return 30;
  }

  function isExpiredJob(job) {
    if (!job || isDurationTooLongError(job)) return false;
    const ex = jobJavaException(job);
    if (ex.includes('error_summary_transcript_file_not_exists')) {
      if (isNoSummaryRequested(job)) return false;
      return true;
    }
    const st = String(job?.transcriptStatus || '').toUpperCase();
    return st === 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS';
  }

  function isNoSummaryCase(job) {
    if (!job || isExpiredJob(job) || isDurationTooLongError(job)) return false;
    if (isNoSummaryRequested(job)) return true;
    return false;
  }

  function archivedJobMessage(job) {
    const days = retentionAudioDays(getEdition());
    return `Ce fichier audio a été archivé (conservation : ${days} j max). Le contenu n'est plus accessible.`;
  }

  function isSummaryReadyForDownload(transcriptStatus) {
    return String(transcriptStatus || '').toUpperCase() === 'READY_SUMMARY_READY';
  }

  function getSummaryAvailability(job) {
    const status = String(job?.transcriptStatus || '').toUpperCase();
    const detail = getStatusTooltipFrench(job?.transcriptStatus, job);
    if (status === 'READY_SUMMARY_READY') {
      return { downloadable: true, label: 'Télécharger', title: detail };
    }
    if (status === 'READY_SUMMARY_PENDING') {
      return {
        downloadable: false,
        label: 'En cours',
        title: 'Le compte-rendu est en cours de génération.'
      };
    }
    if (isNoSummaryCase(job)) {
      return {
        downloadable: false,
        label: 'Non demandé',
        title: "Aucun compte-rendu n'a été demandé pour cette transcription."
      };
    }
    if (isExpiredJob(job) || status === 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS') {
      return {
        downloadable: false,
        label: 'Archivé',
        title: archivedJobMessage(job)
      };
    }
    if (status === 'READY_SUMMARY_ON_ERROR' || status === 'ERROR_SUMMARY_ON_ERROR') {
      return {
        downloadable: false,
        label: 'Indisponible',
        title: detail || "Le compte-rendu n'a pas pu être généré."
      };
    }
    return {
      downloadable: false,
      label: 'Indisponible',
      title: detail || "Le compte-rendu n'est pas disponible pour cette transcription."
    };
  }

  function isRestrictedFreeFormat(fmt) {
    const f = String(fmt || '').toLowerCase();
    return f === 'doc' || f === 'pdf';
  }

  function showProUpgradeForLockedFormat() {
    if (window.AgiloGate?.showUpgrade) {
      window.AgiloGate.showUpgrade('pro', 'Formats DOC/PDF');
      return;
    }
    window.alert('Format réservé aux offres Pro et Business.');
  }

  function lockFormatForFree(link, msg) {
    if (!link) return;
    link.setAttribute('href', '#');
    link.removeAttribute('target');
    link.setAttribute('title', msg);
    link.setAttribute('aria-disabled', 'true');
    if (!link.__agiloPlanLockedClick) {
      link.__agiloPlanLockedClick = true;
      link.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        showProUpgradeForLockedFormat();
      });
    }
  }

  function getStatusTooltipFrench(status, job) {
    const code = String(status || '').trim() || '—';
    const up = code.toUpperCase();
    const userMsg =
      job && (job.userErrorMessage || job.userMessage || '').toString().trim();
    const errMsg = job && (job.errorMessage || job.exceptionMessage || '').toString().trim();
    let line = '';

    if (job && isExpiredJob(job)) {
      return archivedJobMessage(job);
    }
    if (job && isNoSummaryCase(job)) {
      return "Compte rendu non demandé pour cette transcription.";
    }

    switch (up) {
      case 'PENDING':
        line = 'En attente de traitement';
        break;
      case 'IN_PROGRESS':
      case 'QUEUED':
      case 'UPLOADING':
        line = 'Transcription en cours de traitement';
        break;
      case 'READY_SUMMARY_PENDING':
        line = 'Transcription prête ; compte rendu en cours de génération';
        break;
      case 'READY_SUMMARY_READY':
        line = 'Transcription et compte rendu prêts';
        break;
      case 'READY_SUMMARY_ON_ERROR':
        if (job && isDurationTooLongError(job)) {
          line = "Le compte rendu n'a pas pu être généré : audio trop long pour votre offre.";
        } else {
          line = "Le compte rendu n'a pas pu être généré";
        }
        break;
      case 'ERROR_SUMMARY_ON_ERROR':
        line = "Le compte rendu n'a pas pu être généré";
        break;
      case 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS':
        line = archivedJobMessage(job || {});
        break;
      case 'ERROR_TOO_MANY_LANGUAGES_CODE':
        line = "Erreur : trop de langues détectées dans l'audio";
        break;
      case 'ON_ERROR':
        line = "Le traitement n'a pas pu aboutir";
        break;
      case 'UNKNOWN':
        line = 'État inconnu';
        break;
      case 'READY':
      case 'READY_TRANSCRIPT':
      case 'READY_TEXT':
        line = 'Transcription prête (téléchargement disponible)';
        break;
      default:
        if (up.includes('ERROR')) line = 'Une erreur est survenue pendant le traitement';
        else if (TRANSCRIPT_TEXT_DOWNLOAD_STATUSES.has(up)) line = 'Transcription prête (téléchargement disponible)';
        else line = 'Traitement en cours';
    }

    if ((up.includes('ERROR') || up === 'READY_SUMMARY_ON_ERROR') && !isNoSummaryCase(job) && !isExpiredJob(job)) {
      if (userMsg) line += ` — ${userMsg}`;
      else if (errMsg) line += ` — ${errMsg}`;
      else if (job && jobJavaException(job) && up === 'READY_SUMMARY_ON_ERROR') {
        line += ` — ${job.javaException}`;
      }
    }

    return line;
  }

  function buildStatusAlertMessage(job) {
    const detail = getStatusTooltipFrench(job?.transcriptStatus, job);
    const title = displayJobTitle(job);
    return `État de la transcription\n\n${title}\n\n${detail}`;
  }

  function setupStatusAlert(row, job) {
    const stateWrap =
      row.querySelector('.custom-element.state') ||
      row.querySelector('.custom-element.select .state') ||
      row.querySelector('.state');
    if (!stateWrap) return;

    const clickHint = 'Cliquer pour voir le détail du statut';
    const detail = getStatusTooltipFrench(job?.transcriptStatus, job);

    stateWrap.style.cursor = 'pointer';
    stateWrap.setAttribute('role', 'button');
    stateWrap.setAttribute('tabindex', '0');
    stateWrap.setAttribute('aria-label', `${detail}. ${clickHint}`);
    stateWrap.setAttribute('title', `${detail} — ${clickHint}`);

    const showAlert = () => {
      window.alert(buildStatusAlertMessage(job));
    };

    stateWrap.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      showAlert();
    });

    stateWrap.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      showAlert();
    });
  }

  /**
   * Icônes alignées avec scripts/pages/editor/Code-ed-header.js ; support div fallback + SVG Webflow.
   */
  function updateIconVisibility(clone, status, job) {
    const stateWrap = clone.querySelector('.custom-element.state');
    const st = (status || '').toUpperCase();
    const tip = job ? getStatusTooltipFrench(job.transcriptStatus, job) : '';

    const root = stateWrap || clone;

    root
      .querySelectorAll(
        '.icon-inprogress, .icon-error, .icon-ready, .icon-ready_summary_pending,' +
          ' .icon-ready_summary_ready, .icon-ready_summary_on_error,' +
          ' svg[class^="icon-"]'
      )
      .forEach((node) => {
        node.style.display = 'none';
        node.removeAttribute('title');
        node.removeAttribute('role');
      });

    const map = {
      '.icon-error': ['ON_ERROR', 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS', 'ERROR_TOO_MANY_LANGUAGES_CODE'],
      '.icon-inprogress': ['PENDING', 'IN_PROGRESS', 'QUEUED', 'UPLOADING'],
      '.icon-ready_summary_pending': ['READY_SUMMARY_PENDING'],
      '.icon-ready_summary_ready': ['READY_SUMMARY_READY'],
      '.icon-ready_summary_on_error': ['READY_SUMMARY_ON_ERROR'],
      '.icon-ready': ['READY', 'READY_TRANSCRIPT', 'READY_TEXT']
    };

    function show(sel) {
      const n = root.querySelector(sel);
      if (n) {
        n.style.display = 'block';
        if (tip) {
          n.setAttribute('title', tip);
          n.setAttribute('role', 'img');
        }
        return n;
      }
      return null;
    }

    let shown = null;

    if (
      job &&
      (isExpiredJob(job) || isNoSummaryCase(job)) &&
      (st.includes('ERROR') || st === 'READY_SUMMARY_ON_ERROR' || st === 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS')
    ) {
      shown = show('.icon-ready_summary_pending');
    }

    if (!shown) {
      for (const sel in map) {
        if (map[sel].includes(st)) {
          shown = show(sel);
          break;
        }
      }
    }

    if (!shown) {
      if (st.includes('ERROR')) shown = show('.icon-error');
      else if (['PENDING', 'IN_PROGRESS', 'QUEUED', 'UPLOADING'].includes(st))
        shown = show('.icon-inprogress');
      else if (isTranscriptTextDownloadAllowed(st)) shown = show('.icon-ready');
      else shown = show('.icon-ready');
    }

    if (stateWrap && tip) {
      stateWrap.setAttribute('aria-label', tip);
      stateWrap.setAttribute('title', tip);
    }
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

  function lockDownloadStack(row, lock) {
    const optionsEl = row.querySelector('.custom-element.options');
    const panel = row.querySelector('.download_link-options');
    const dlBtn = row.querySelector('.download-link');
    const dotSvg = row.querySelector('svg.icon-1x1-small.options');

    if (!optionsEl) return;

    const lockedTitle = 'Aucun téléchargement disponible pour ce traitement';

    if (lock) {
      optionsEl.setAttribute('data-agilo-download-locked', '1');
      optionsEl.classList.add('agilo-download-locked');
      if (panel) {
        panel.style.display = 'none';
      }
      if (dlBtn) {
        dlBtn.setAttribute('aria-expanded', 'false');
        dlBtn.setAttribute('title', lockedTitle);
      }
      if (dotSvg) dotSvg.setAttribute('title', lockedTitle);
    } else {
      optionsEl.removeAttribute('data-agilo-download-locked');
      optionsEl.classList.remove('agilo-download-locked');
      if (dlBtn && dlBtn.getAttribute('title') === lockedTitle) {
        dlBtn.removeAttribute('title');
      }
      if (dotSvg && dotSvg.getAttribute('title') === lockedTitle) dotSvg.removeAttribute('title');
      if (dlBtn && !dlBtn.hasAttribute('aria-expanded')) dlBtn.setAttribute('aria-expanded', 'false');
    }
  }

  function setSummaryCellState(row, job) {
    const availability = getSummaryAvailability(job);
    const summaryLinks = Array.from(row.querySelectorAll('[class*="download_wrapper-link_summary_"]'));
    if (!summaryLinks.length) {
      console.warn('[Agilo][MesTranscripts] summary cell missing', {
        jobId: job?.jobid,
        transcriptStatus: job?.transcriptStatus
      });
      return availability;
    }

    const summaryCell = summaryLinks
      .map((link) => link.closest('.custom-element.options') || link.closest('.custom-element') || link.parentElement)
      .find(Boolean);

    if (!summaryCell) {
      console.warn('[Agilo][MesTranscripts] summary container missing', {
        jobId: job?.jobid,
        transcriptStatus: job?.transcriptStatus
      });
      return availability;
    }

    const summaryToggle = summaryCell.querySelector('.download-link');
    const summaryPanel = summaryCell.querySelector('.download_link-options');
    let stateChip = summaryCell.querySelector('.agilo-summary-state');

    summaryLinks.forEach((link) => {
      if (!availability.downloadable) {
        link.style.display = 'none';
        link.removeAttribute('href');
        link.removeAttribute('target');
      }
    });

    summaryCell.setAttribute('title', availability.title || '');
    summaryCell.setAttribute('aria-label', availability.title || '');

    if (availability.downloadable) {
      summaryCell.classList.remove('agilo-download-locked');
      if (summaryToggle) {
        summaryToggle.style.display = '';
        summaryToggle.textContent = 'Télécharger';
        summaryToggle.setAttribute('aria-expanded', 'false');
        summaryToggle.setAttribute('title', availability.title || '');
      }
      if (summaryPanel) summaryPanel.style.display = 'none';
      if (stateChip) stateChip.remove();
      return availability;
    }

    if (summaryToggle) {
      summaryToggle.style.display = 'none';
      summaryToggle.setAttribute('aria-expanded', 'false');
    }
    if (summaryPanel) summaryPanel.style.display = 'none';

    if (!stateChip) {
      stateChip = document.createElement('span');
      stateChip.className = 'agilo-summary-state';
      stateChip.style.display = 'inline-flex';
      stateChip.style.alignItems = 'center';
      stateChip.style.justifyContent = 'center';
      stateChip.style.padding = '6px 10px';
      stateChip.style.borderRadius = '999px';
      stateChip.style.fontSize = '12px';
      stateChip.style.fontWeight = '600';
      stateChip.style.background = '#f3f4f6';
      stateChip.style.color = '#6b7280';
      stateChip.style.border = '1px solid #e5e7eb';
      summaryCell.appendChild(stateChip);
    }

    stateChip.textContent = availability.label;
    stateChip.title = availability.title || '';
    summaryCell.classList.add('agilo-download-locked');
    return availability;
  }

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
    row.setAttribute('data-creation-date', job.dtCreation || '');

    updateIconVisibility(clone, job.transcriptStatus, job);
    setupStatusAlert(row, job);

    const creation = clone.querySelector('.creation-date');
    if (creation)
      creation.textContent = convertDateStringToDate(job.dtCreation).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

    const fileNameAnchor = clone.querySelector('.file-name');
    const renameButton = clone.querySelector('.rename-btn');
    const openLink = clone.querySelector('.button-open, .open-link');

    if (fileNameAnchor) {
      fileNameAnchor.textContent = displayJobTitle(job);
      fileNameAnchor.title = 'Fichier original : ' + (job.filename || 'Inconnu');
      fileNameAnchor.href = `${API_BASE}/receiveAudio?jobId=${job.jobid}&username=${encodeURIComponent(
        userEmail
      )}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}`;
      fileNameAnchor.setAttribute('download', job.filename || `${displayJobTitle(job)}.mp3`);
    }

    const tier = location.pathname.match(/^\/app\/([^/]+)/)?.[1] || 'business';
    const editorUrl = `/app/${tier}/editor?jobId=${job.jobid}&edition=${edition}`;
    if (openLink) {
      if (openLink.tagName === 'A') {
        openLink.href = editorUrl;
      } else {
        openLink.setAttribute('data-editor-url', editorUrl);
        if (!openLink.__agiloOpenBound) {
          openLink.__agiloOpenBound = true;
          openLink.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            window.location.href = openLink.getAttribute('data-editor-url') || editorUrl;
          });
        }
      }
    }
    if (!fileNameAnchor || !renameButton) {
      console.warn('[Agilo][MesTranscripts] rename UI incomplete', {
        jobId: job.jobid,
        hasAnchor: !!fileNameAnchor,
        hasButton: !!renameButton
      });
    }
    setupInlineRename({ anchorEl: fileNameAnchor, buttonEl: renameButton, job, userEmail, token, edition });

    // Downloads logic v1.1.4+
    let hasAnyTranscriptLink = false;
    let hasAnySummaryLink = false;
    const formats = ['txt', 'rtf', 'docx', 'doc', 'pdf'];
    const isFree = String(edition || '').toLowerCase() === 'free';
    formats.forEach((fmt) => {
      const aT = clone.querySelector(`.download_wrapper-link_transcript_${fmt}`);
      if (aT && isFree && isRestrictedFreeFormat(fmt)) {
        lockFormatForFree(aT, 'Réservé aux offres Pro et Business');
        aT.style.removeProperty('display');
      } else if (aT && isTranscriptTextDownloadAllowed(job.transcriptStatus)) {
        aT.href = `${API_BASE}/receiveText?jobId=${job.jobid}&username=${encodeURIComponent(
          userEmail
        )}&token=${encodeURIComponent(token)}&format=${fmt}&edition=${encodeURIComponent(edition)}`;
        aT.target = '_blank';
        aT.style.removeProperty('display');
        hasAnyTranscriptLink = true;
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
      if (aS && isFree && isRestrictedFreeFormat(slot)) {
        lockFormatForFree(aS, 'Réservé aux offres Pro et Business');
        aS.style.removeProperty('display');
      } else if (aS && isSummaryReadyForDownload(job.transcriptStatus)) {
        aS.href = `${API_BASE}/receiveSummary?jobId=${job.jobid}&username=${encodeURIComponent(
          userEmail
        )}&token=${encodeURIComponent(token)}&format=${apiFormat}&edition=${encodeURIComponent(
          edition
        )}`;
        aS.target = '_blank';
        aS.style.removeProperty('display');
        hasAnySummaryLink = true;
      } else if (aS) {
        aS.style.display = 'none';
      }
    });

    const summaryAvailability = setSummaryCellState(row, job);
    hasAnySummaryLink = !!summaryAvailability.downloadable;
    const hasAnyDownloadable = hasAnyTranscriptLink || hasAnySummaryLink;
    lockDownloadStack(row, !hasAnyDownloadable);

    const optsBox = row.querySelector('.custom-element.options');
    const dlBtnEarly = row.querySelector('.download-link');
    if (dlBtnEarly && optsBox && !optsBox.classList.contains('agilo-download-locked')) {
      dlBtnEarly.setAttribute('aria-expanded', 'false');
    }

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
    const userEmail = (
      emailInput?.value ||
      emailInput?.getAttribute('src') ||
      emailInput?.textContent ||
      ''
    ).trim();
    let edition = getEdition();

    if (!userEmail) {
      console.warn('[Agilo] Email utilisateur non trouvé dans le DOM.');
      return;
    }

    async function getJobs(ed) {
      const urlParams = new URLSearchParams(window.location.search);
      const folderId = urlParams.get('folderId');
      let url = `${API_BASE}/getJobsInfo?username=${encodeURIComponent(
        userEmail
      )}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(ed)}&limit=2000&offset=0`;
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
        if (fallbackData.status === 'OK' && fallbackData.jobsInfoDtos?.length > 0) {
          data = fallbackData;
          edition = 'ent';
        }
      }

      if (data.status !== 'OK') return;
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

      data.jobsInfoDtos.forEach((job) =>
        buildJobRow({
          job,
          userEmail,
          token,
          edition,
          template: templateEl.content,
          container
        })
      );
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
