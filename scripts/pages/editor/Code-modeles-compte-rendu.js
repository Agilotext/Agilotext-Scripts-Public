// Agilotext – Modèles de Compte-Rendu (VERSION 3.4.1 – repo)
// Grille + promptId job ; après redoSummary l’API annonce désormais READY_SUMMARY_PENDING puis READY (poll via relance) ;
// sans bouton d’annulation superflu sur le loader.

(function() {
  'use strict';

  const DEBUG = false;
  const log = (...args) => { if (DEBUG) console.log('[AGILO:MODELES]', ...args); };
  const API_BASE = 'https://api.agilotext.com/api/v1';

  function agiloEditorCredsRoot() {
    const c = window.__agiloEditorCreds;
    if (!c || typeof c.pickEdition !== 'function') {
      throw new Error(
        '[AGILO:MODELES] Charger agilo-editor-creds.js avant Code-modeles-compte-rendu.js (ordre des <script> dans Webflow).'
      );
    }
    return c;
  }
  function pickEdition() {
    return agiloEditorCredsRoot().pickEdition();
  }
  function pickJobId() {
    return agiloEditorCredsRoot().pickJobId();
  }
  function pickEmail() {
    return agiloEditorCredsRoot().pickEmail();
  }
  function pickToken(edition, email) {
    return agiloEditorCredsRoot().pickToken(edition, email);
  }
  function querySummaryEditor() {
    return agiloEditorCredsRoot().querySummaryEditor();
  }

  let cachedModels = null;
  let isLoadingModels = false;
  let isPopulated = false;
  let lastPopulatedJobId = '';
  const cachedJobPromptIds = new Map();

  async function fetchGetWithRetry(url, maxAttempts) {
    var lastErr;
    var n = maxAttempts || 3;
    for (var a = 1; a <= n; a++) {
      try {
        return await fetch(url, { method: 'GET', cache: 'no-store' });
      } catch (err) {
        lastErr = err;
        if (a < n) await new Promise(function (r) { setTimeout(r, 400 * a); });
      }
    }
    throw lastErr || new Error('fetch réseau');
  }

  async function getJobPromptIdFromAPI(jobId, forceRefresh) {
    if (!jobId) return null;
    if (!forceRefresh && cachedJobPromptIds.has(jobId)) {
      return cachedJobPromptIds.get(jobId);
    }
    const email = pickEmail();
    const edition = pickEdition();
    const token = pickToken(edition, email);
    if (!email || !token) return null;
    try {
      let url = `${API_BASE}/getJobsInfo?username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}&limit=100&offset=0`;
      let res = await fetch(url, { method: 'GET', cache: 'no-store' });
      let data = await res.json();
      if (data.status === 'OK' && Array.isArray(data.jobsInfoDtos)) {
        let job = data.jobsInfoDtos.find(function (j) {
          const id = j.jobid != null ? j.jobid : j.jobId;
          return String(id) === String(jobId);
        });
        if (!job && data.jobsInfoDtos.length === 100) {
          for (let offset = 100; offset < 300; offset += 100) {
            url = `${API_BASE}/getJobsInfo?username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}&limit=100&offset=${offset}`;
            res = await fetch(url, { method: 'GET', cache: 'no-store' });
            data = await res.json();
            if (data.status === 'OK' && Array.isArray(data.jobsInfoDtos)) {
              job = data.jobsInfoDtos.find(function (j) {
                const id = j.jobid != null ? j.jobid : j.jobId;
                return String(id) === String(jobId);
              });
              if (job) break;
              if (data.jobsInfoDtos.length < 100) break;
            } else break;
          }
        }
        if (job) {
          const raw = job.promptid != null ? job.promptid : job.promptId;
          const promptId = raw && raw !== -1 && raw !== '-1' ? Number(raw) : null;
          if (promptId && !isNaN(promptId)) {
            cachedJobPromptIds.set(jobId, promptId);
            return promptId;
          }
          cachedJobPromptIds.set(jobId, null);
        }
      }
    } catch (err) {
      log('getJobsInfo', err);
    }
    return null;
  }

  function getJobPromptIdLocal(jobId) {
    if (!jobId) return null;
    try {
      const storage = localStorage.getItem('agilo:job-prompt-ids');
      if (!storage) return null;
      const data = JSON.parse(storage);
      const n = Number(data[jobId]);
      return !isNaN(n) ? n : null;
    } catch (e) {
      return null;
    }
  }

  function setJobPromptIdLocal(jobId, promptId) {
    if (!jobId || !promptId) return;
    try {
      const storage = localStorage.getItem('agilo:job-prompt-ids');
      const data = storage ? JSON.parse(storage) : {};
      data[jobId] = promptId;
      localStorage.setItem('agilo:job-prompt-ids', JSON.stringify(data));
    } catch (e) {}
  }

  function getRegenerationLimit(edition) {
    const ed = String(edition || '').toLowerCase().trim();
    if (ed.startsWith('pro')) return 2;
    if (ed === 'ent' || ed === 'business' || ed === 'enterprise' || ed === 'entreprise' || ed === 'team') return 4;
    return 0;
  }

  function getRegenerationCount(jobId) {
    if (!jobId) return 0;
    try {
      const storage = localStorage.getItem('agilo:regenerations');
      if (!storage) return 0;
      const data = JSON.parse(storage);
      return data[jobId]?.count || 0;
    } catch (e) {
      return 0;
    }
  }

  function incrementRegenerationCount(jobId, edition) {
    if (!jobId) return;
    try {
      const storage = localStorage.getItem('agilo:regenerations');
      const data = storage ? JSON.parse(storage) : {};
      if (!data[jobId]) {
        data[jobId] = {
          count: 0,
          max: getRegenerationLimit(edition),
          edition: edition,
          lastReset: new Date().toISOString()
        };
      }
      data[jobId].count += 1;
      data[jobId].lastUsed = new Date().toISOString();
      localStorage.setItem('agilo:regenerations', JSON.stringify(data));
    } catch (e) {}
  }

  function canRegenerate(jobId, edition) {
    const ed = String(edition || '').toLowerCase().trim();
    if (ed.startsWith('free') || ed === 'gratuit') {
      return { allowed: false, reason: 'free' };
    }
    const limit = getRegenerationLimit(edition);
    const count = getRegenerationCount(jobId);
    if (count >= limit) {
      return { allowed: false, reason: 'limit', count, limit };
    }
    return { allowed: true, count, limit, remaining: limit - count };
  }

  function updateExistingRegenerationCounter(jobId, edition) {
    const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
    if (!btn || !jobId) return;
    if (typeof window.updateRegenerationCounter === 'function') {
      window.updateRegenerationCounter(jobId, edition);
      return;
    }
    const canRegen = canRegenerate(jobId, edition);
    const oldCounter = btn.parentElement?.querySelector('.regeneration-counter, #regeneration-info, .regeneration-limit-message, .regeneration-premium-message');
    if (oldCounter) oldCounter.remove();
    if (canRegen.reason === 'free') return;
    if (canRegen.reason === 'limit') {
      const planName = edition === 'ent' || edition === 'business' ? 'Business' : 'Pro';
      const limitMsg = document.createElement('div');
      limitMsg.className = 'regeneration-limit-message';
      limitMsg.innerHTML =
        '<span class="regeneration-limit-icon">⚠️</span>' +
        '<div class="regeneration-limit-content">' +
        '<strong>Limite atteinte</strong>' +
        '<div class="regeneration-limit-detail">' +
        canRegen.count + '/' + canRegen.limit + ' régénération(s) utilisée(s) (plan ' + planName + ')' +
        '</div></div>';
      btn.parentElement?.appendChild(limitMsg);
      return;
    }
    const counter = document.createElement('div');
    counter.id = 'regeneration-info';
    counter.className = 'regeneration-counter';
    counter.textContent = canRegen.remaining + '/' + canRegen.limit + ' régénérations restantes';
    btn.parentElement?.appendChild(counter);
  }

  async function loadAllModels(forceRefresh) {
    if (cachedModels && !forceRefresh) return cachedModels;
    if (isLoadingModels) return cachedModels || { standard: [], custom: [], defaultId: null };

    const email = pickEmail();
    const edition = pickEdition();
    const token = pickToken(edition, email);
    if (!email || !token) {
      return { standard: [], custom: [], defaultId: null };
    }

    isLoadingModels = true;
    try {
      const [resUser, resStd] = await Promise.all([
        fetch(`${API_BASE}/getPromptModelsUserInfo?username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}`),
        fetch(`${API_BASE}/getPromptModelsStandardInfo?username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}`)
      ]);

      let userModels = [];
      let standardModels = [];
      let defaultId = null;

      if (resUser.ok) {
        const data = await resUser.json().catch(() => null);
        if (data?.status === 'OK' && Array.isArray(data.promptModeInfoDTOList)) {
          userModels = data.promptModeInfoDTOList;
          defaultId = data.defaultPromptModelId;
        }
      }
      if (resStd.ok) {
        const data = await resStd.json().catch(() => null);
        if (data?.status === 'OK' && Array.isArray(data.promptModeInfoDTOList)) {
          standardModels = data.promptModeInfoDTOList;
        }
      }

      const allMap = new Map();
      for (const m of standardModels) allMap.set(m.promptModelId, m);
      for (const m of userModels) allMap.set(m.promptModelId, m);
      const all = Array.from(allMap.values());
      const standard = all.filter(function (m) { return m.promptModelId < 100; });
      const custom = all.filter(function (m) { return m.promptModelId >= 100; });

      cachedModels = { standard, custom, defaultId };
      return cachedModels;
    } catch (err) {
      console.error('[AGILO:MODELES]', err);
      return { standard: [], custom: [], defaultId: null };
    } finally {
      isLoadingModels = false;
    }
  }

  function createAccordion(title, models, type, defaultId, jobPromptId, isOpen, isFree) {
    const section = document.createElement('div');
    section.className = 'models-section section-' + type;
    if (isOpen) section.classList.add('is-open');

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'models-section-header';
    header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    header.innerHTML =
      '<span class="models-section-title">' + title + '</span>' +
      '<span class="models-section-count">' + models.length + '</span>' +
      '<svg class="models-section-arrow" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<path d="M7 10l5 5 5-5z"/></svg>';

    const content = document.createElement('div');
    content.className = 'models-section-content';
    const chips = document.createElement('div');
    chips.className = 'models-chips';

    const defaultIdNum = defaultId != null ? Number(defaultId) : null;
    const jobPromptIdNum = jobPromptId != null ? Number(jobPromptId) : null;

    models.forEach(function (m) {
      const chip = document.createElement('button');
      chip.type = 'button';
      const colorClass = type === 'standard' ? 'chip-standard' : 'chip-custom';
      chip.className = 'model-chip ' + colorClass;

      const modelIdNum = Number(m.promptModelId);
      const chipText = m.promptModelName || 'Modèle ' + m.promptModelId;

      const isUsedForThisJob = jobPromptIdNum != null && !isNaN(jobPromptIdNum) && modelIdNum === jobPromptIdNum;
      const isDefaultAccount = defaultIdNum != null && !isNaN(defaultIdNum) && modelIdNum === defaultIdNum;

      if (isUsedForThisJob) {
        chip.classList.add('is-used');
        chip.disabled = true;
      } else if (isDefaultAccount) {
        chip.classList.add('is-default-account');
      }

      if (isFree && !isUsedForThisJob) {
        chip.classList.add('is-locked');
        chip.setAttribute('data-plan-min', 'pro');
        chip.setAttribute('data-upgrade-reason', 'Régénération avec le modèle « ' + chipText + ' »');
      }

      chip.dataset.promptId = m.promptModelId;
      const textSpan = document.createElement('span');
      textSpan.className = 'model-chip-text';
      textSpan.textContent = chipText;
      chip.appendChild(textSpan);
      chip.title = isUsedForThisJob
        ? chipText + ' — modèle actuel pour ce job'
        : isDefaultAccount
          ? chipText + ' — modèle par défaut du compte'
          : chipText;

      if (!isUsedForThisJob && !isFree) {
        chip.addEventListener('click', function () { handleChipClick(m); });
      }

      chips.appendChild(chip);
    });

    content.appendChild(chips);
    header.addEventListener('click', function () {
      const open = section.classList.toggle('is-open');
      header.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    section.appendChild(header);
    section.appendChild(content);
    return section;
  }

  let isGenerating = false;

  function initLottieAnimation(element) {
    if (window.Webflow && window.Webflow.require) {
      try {
        const ix2 = window.Webflow.require('ix2');
        if (ix2 && typeof ix2.init === 'function') {
          setTimeout(function () { ix2.init(); }, 100);
        }
      } catch (e) {}
    }
    if (window.lottie && typeof window.lottie.loadAnimation === 'function') {
      try {
        if (!element._lottie) {
          element._lottie = window.lottie.loadAnimation({
            container: element,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            path: 'https://cdn.prod.website-files.com/6815bee5a9c0b57da18354fb/6815bee5a9c0b57da18355b3_Animation%20-%201705419825493.json'
          });
        }
      } catch (e) {}
    }
  }

  function hideSummaryRegenLoader() {
    const summaryEditor = querySummaryEditor();
    if (!summaryEditor) return;
    const loader = summaryEditor.querySelector('.summary-loading-indicator');
    if (loader) loader.style.display = 'none';
  }

  /** Loader aligné relance-compte-rendu : pas de décompte ; le texte de statut est mis à jour par le polling. */
  function showSummaryRegenLoader(modelName) {
    const summaryEditor = querySummaryEditor();
    if (!summaryEditor) return null;

    summaryEditor.innerHTML = '';
    const loaderContainer = document.createElement('div');
    loaderContainer.className = 'summary-loading-indicator';

    let lottieElement = document.querySelector('#loading-summary');
    if (!lottieElement) {
      lottieElement = document.createElement('div');
      lottieElement.id = 'loading-summary-model';
      lottieElement.className = 'lottie-check-statut';
      lottieElement.setAttribute('data-animation-type', 'lottie');
      lottieElement.setAttribute('data-src', 'https://cdn.prod.website-files.com/6815bee5a9c0b57da18354fb/6815bee5a9c0b57da18355b3_Animation%20-%201705419825493.json');
      lottieElement.setAttribute('data-loop', '1');
      lottieElement.setAttribute('data-autoplay', '1');
      lottieElement.setAttribute('data-renderer', 'svg');
    } else {
      lottieElement = lottieElement.cloneNode(true);
      lottieElement.id = 'loading-summary-model';
    }

    const loadingText = document.createElement('p');
    loadingText.className = 'loading-text';
    loadingText.textContent = 'Génération du compte-rendu en cours...';
    const loadingSubtitle = document.createElement('p');
    loadingSubtitle.className = 'loading-subtitle';
    if (modelName) {
      loadingSubtitle.appendChild(document.createTextNode('Modèle : '));
      const strong = document.createElement('strong');
      strong.textContent = String(modelName);
      loadingSubtitle.appendChild(strong);
    }

    const statusEl = document.createElement('p');
    statusEl.className = 'loading-status-hint';
    statusEl.textContent = 'Surveillance du statut serveur…';

    summaryEditor.appendChild(loaderContainer);
    loaderContainer.appendChild(lottieElement);
    loaderContainer.appendChild(loadingText);
    if (modelName) loaderContainer.appendChild(loadingSubtitle);
    loaderContainer.appendChild(statusEl);

    setTimeout(function () {
      initLottieAnimation(lottieElement);
      setTimeout(function () {
        const hasLottie = lottieElement.querySelector('svg, canvas') || lottieElement._lottie;
        if (!hasLottie) {
          const fallback = document.createElement('div');
          fallback.className = 'lottie-fallback';
          lottieElement.style.display = 'none';
          loaderContainer.insertBefore(fallback, lottieElement);
        }
      }, 1000);
    }, 100);

    return { loaderContainer: loaderContainer, statusEl: statusEl };
  }

  async function handleChipClick(model) {
    if (isGenerating) return;

    const jobId = pickJobId();
    const email = pickEmail();
    const edition = pickEdition();
    const token = pickToken(edition, email);

    if (!jobId || !email || !token) {
      alert('Informations manquantes. Rechargez la page.');
      return;
    }

    const ed = String(edition || '').toLowerCase().trim();
    const isFree = ed.startsWith('free') || ed === 'gratuit';
    if (isFree) {
      const modelName = model.promptModelName || 'Modèle ' + model.promptModelId;
      if (typeof window.AgiloGate !== 'undefined' && window.AgiloGate.showUpgrade) {
        window.AgiloGate.showUpgrade('pro', 'Régénération avec le modèle « ' + modelName + ' »');
      } else {
        alert('Cette fonctionnalité nécessite un abonnement Pro ou Business.');
      }
      return;
    }

    const canRegen = canRegenerate(jobId, edition);
    if (!canRegen.allowed) {
      if (canRegen.reason === 'limit') {
        alert('Limite atteinte: ' + canRegen.count + '/' + canRegen.limit + ' régénération(s) pour ce transcript.');
      }
      return;
    }

    const modelName = model.promptModelName || 'Modèle ' + model.promptModelId;
    const confirmed = confirm(
      'Cela remplace le compte-rendu actuel.\n\n' +
      'Modèle : ' + modelName + '\n\n' +
      canRegen.remaining + '/' + canRegen.limit + ' régénération(s) restante(s).\n\n' +
      'L’interface attendra la fin de la génération (statut serveur) puis actualisera le compte-rendu dans l’éditeur.'
    );
    if (!confirmed) return;

    isGenerating = true;
    try {
      const url = API_BASE + '/redoSummary?jobId=' + encodeURIComponent(jobId) +
        '&username=' + encodeURIComponent(email) +
        '&token=' + encodeURIComponent(token) +
        '&edition=' + encodeURIComponent(edition) +
        '&promptId=' + encodeURIComponent(model.promptModelId);

      const res = await fetchGetWithRetry(url, 3);
      const data = await res.json();

      if (data.status === 'OK' || res.ok) {
        incrementRegenerationCount(jobId, edition);
        updateExistingRegenerationCounter(jobId, edition);
        setJobPromptIdLocal(jobId, model.promptModelId);
        cachedJobPromptIds.set(jobId, Number(model.promptModelId));
        try {
          sessionStorage.setItem('agilo:summaryPromptId:' + jobId, String(model.promptModelId));
        } catch (_) {}
        if (typeof window.toast === 'function') {
          window.toast('Régénération lancée avec « ' + modelName + ' »…');
        }
        const summaryTab = document.querySelector('#tab-summary');
        if (summaryTab) summaryTab.click();

        const summaryEditorClear = querySummaryEditor();
        if (summaryEditorClear) summaryEditorClear.innerHTML = '';

        const ui = showSummaryRegenLoader(modelName);
        const H = window.__agiloSummaryRegenHelpers;

        if (!ui || !ui.statusEl) {
          isGenerating = false;
        } else if (H && typeof H.waitForSummaryTerminalState === 'function') {
          if (typeof H.formatPollStatusLabel === 'function') {
            ui.statusEl.textContent = H.formatPollStatusLabel(null);
          }
          H.waitForSummaryTerminalState(jobId, email, token, edition, ui.statusEl, function () {
            return false;
          })
            .then(function (outcome) {
              if (outcome === 'cancelled') {
                if (typeof H.hideSummaryLoading === 'function') H.hideSummaryLoading();
                else hideSummaryRegenLoader();
                isGenerating = false;
                return;
              }
              if (typeof H.hideSummaryLoading === 'function') H.hideSummaryLoading();
              else hideSummaryRegenLoader();
              if (outcome === 'ready') {
                if (typeof H.refreshSummaryInEditorWithFallback === 'function') {
                  H.refreshSummaryInEditorWithFallback(jobId, function () { return false; });
                }
                if (typeof window.toast === 'function') window.toast('Compte-rendu prêt');
              } else if (outcome === 'error') {
                alert(
                  'Le serveur indique encore une erreur sur le compte-rendu après plusieurs vérifications.\n\n' +
                  'Rechargez la page : le compte-rendu est peut‑être déjà là.'
                );
              } else {
                alert('Délai d’attente dépassé. Rechargez la page pour vérifier le compte-rendu.');
              }
              isGenerating = false;
              try {
                isPopulated = false;
                cachedModels = null;
                populateContainer(true);
              } catch (e) {}
            })
            .catch(function (e) {
              log('waitForSummaryTerminalState', e);
              if (typeof H.hideSummaryLoading === 'function') H.hideSummaryLoading();
              else hideSummaryRegenLoader();
              isGenerating = false;
              alert('Erreur lors de la surveillance du statut. Rechargez la page.');
            });
        } else {
          ui.statusEl.textContent =
            'Script « relance-compte-rendu » introuvable ou obsolète. Actualisation du job dans quelques secondes…';
          setTimeout(function () {
            try {
              window.dispatchEvent(new CustomEvent('agilo:beforeload', { detail: { jobId: jobId } }));
              if (window.__agiloOrchestrator && typeof window.__agiloOrchestrator.loadJob === 'function') {
                window.__agiloOrchestrator.loadJob(jobId, { autoplay: false });
              } else {
                window.dispatchEvent(new CustomEvent('agilo:load', { detail: { jobId: jobId, autoplay: false } }));
              }
            } catch (e2) {}
            hideSummaryRegenLoader();
            isGenerating = false;
          }, 4000);
        }
      } else if (data.status === 'KO') {
        isGenerating = false;
        alert('Une génération est déjà en cours. Patientez un instant.');
      } else {
        isGenerating = false;
        alert('Erreur: ' + (data.errorMessage || data.message || 'Réessayez.'));
      }
    } catch (err) {
      isGenerating = false;
      console.error('[AGILO:MODELES]', err);
      alert('Erreur réseau. Vérifiez la connexion.');
    }
  }

  function injectStyles() {
    ['#agilo-modeles-styles', '#agilo-modeles-styles-v4', '#agilo-modeles-styles-v5', '#agilo-modeles-styles-v6', '#agilo-tpl-styles-v3'].forEach(function (sel) {
      const n = document.querySelector(sel);
      if (n) n.remove();
    });

    const style = document.createElement('style');
    style.id = 'agilo-modeles-styles-v6';
    style.textContent = `
      #cr-template-chips {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-height: 120px;
        padding-bottom: max(5.5rem, env(safe-area-inset-bottom, 0px));
        box-sizing: border-box;
      }

      .models-section {
        background: #fff;
        border: 1px solid rgba(52, 58, 64, 0.15);
        border-radius: 8px;
        overflow: hidden;
      }

      .models-section-header {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        min-height: 44px;
        padding: 12px 14px;
        background: #f8f9fa;
        border: none;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        color: #020202;
        text-align: left;
        box-sizing: border-box;
      }

      .models-section-header:hover { background: #eef1f4; }

      .models-section-title {
        flex: 1;
        min-width: 0;
        line-height: 1.35;
      }

      .models-section-count {
        flex-shrink: 0;
        min-width: 22px;
        height: 22px;
        padding: 0 6px;
        border-radius: 11px;
        font-size: 11px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .models-section.section-standard .models-section-count {
        background: rgba(23, 74, 150, 0.12);
        color: #174a96;
      }

      .models-section.section-custom .models-section-count {
        background: rgba(28, 102, 26, 0.12);
        color: #1c661a;
      }

      .models-section-arrow {
        flex-shrink: 0;
        align-self: center;
        width: 16px;
        height: 16px;
        transition: transform 0.2s;
        opacity: 0.55;
      }

      .models-section.is-open .models-section-arrow {
        transform: rotate(180deg);
      }

      .models-section-content {
        display: none;
        padding: 14px 14px 16px;
        border-top: 1px solid rgba(52, 58, 64, 0.1);
      }

      .models-section.is-open .models-section-content { display: block; }

      .models-chips {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(158px, 1fr));
        gap: 10px;
        align-items: stretch;
      }

      @media (max-width: 480px) {
        .models-chips { grid-template-columns: 1fr; gap: 8px; }
      }

      .model-chip {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        max-height: 72px;
        padding: 10px 12px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        line-height: 1.35;
        cursor: pointer;
        transition: box-shadow 0.15s ease, transform 0.15s ease, background 0.15s ease;
        text-align: center;
        box-sizing: border-box;
        width: 100%;
        border: 1px solid transparent;
      }

      .model-chip-text {
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
        word-break: break-word;
        text-align: center;
        width: 100%;
      }

      .model-chip:hover { transform: translateY(-1px); box-shadow: 0 2px 6px rgba(0,0,0,0.08); }

      .model-chip.chip-standard {
        border-color: rgba(23, 74, 150, 0.35);
        background: rgba(23, 74, 150, 0.08);
        color: #174a96;
      }
      .model-chip.chip-standard:hover { background: rgba(23, 74, 150, 0.14); }

      .model-chip.chip-custom {
        border-color: rgba(28, 102, 26, 0.35);
        background: rgba(28, 102, 26, 0.08);
        color: #1c661a;
      }
      .model-chip.chip-custom:hover { background: rgba(28, 102, 26, 0.14); }

      .model-chip.is-default-account {
        border-width: 2px;
        font-weight: 600;
      }

      .model-chip.is-default-account::after {
        content: ' (défaut)';
        font-size: 10px;
        font-weight: 600;
        opacity: 0.9;
        margin-left: 4px;
        white-space: nowrap;
        flex-shrink: 0;
      }

      .model-chip.is-used {
        cursor: default;
        opacity: 0.95;
      }
      .model-chip.is-used:hover { transform: none; box-shadow: none; }

      .model-chip.chip-standard.is-used {
        background: #174a96;
        color: #fff;
        border-color: #174a96;
      }
      .model-chip.chip-custom.is-used {
        background: #1c661a;
        color: #fff;
        border-color: #1c661a;
      }

      .model-chip.is-used .model-chip-text::after {
        content: ' (actuel)';
        font-size: 10px;
        font-weight: 600;
        opacity: 0.95;
      }

      .model-chip.is-locked {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .model-chip.is-locked:hover { transform: none; box-shadow: none; }

      .agilo-modeles-free-banner {
        padding: 12px 14px;
        margin-bottom: 4px;
        background: rgba(253, 126, 20, 0.08);
        border: 1px solid rgba(253, 126, 20, 0.28);
        border-radius: 8px;
        font-size: 13px;
        color: #525252;
      }

      [data-view="templates"] { display: none; }

      .summary-loading-indicator {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 3.75rem 1.25rem;
        text-align: center;
        min-height: 18.75rem;
        background: #ffffff;
        animation: agilo-fadeIn 0.3s ease-out;
      }
      @keyframes agilo-fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .summary-loading-indicator #loading-summary-model,
      .summary-loading-indicator .lottie-check-statut {
        width: 5.5rem;
        height: 5.5rem;
        margin: 0 auto 1.5rem;
        display: block;
      }
      .summary-loading-indicator .lottie-fallback {
        width: 5.5rem;
        height: 5.5rem;
        margin: 0 auto 1.5rem;
        border: 4px solid rgba(52, 58, 64, 0.25);
        border-top: 4px solid #174a96;
        border-radius: 50%;
        animation: agilo-spin 1s linear infinite;
      }
      @keyframes agilo-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .summary-loading-indicator .loading-text {
        font: 500 1rem/1.35 system-ui, -apple-system, sans-serif;
        color: #020202;
        margin-top: 0.5rem;
      }
      .summary-loading-indicator .loading-subtitle {
        font: 400 0.875rem/1.4 system-ui, -apple-system, sans-serif;
        color: #525252;
        margin-top: 0.5rem;
      }
      .summary-loading-indicator .loading-status-hint {
        font: 400 0.875rem/1.45 system-ui, -apple-system, sans-serif;
        color: #525252;
        margin: 0.75rem 1rem 0;
        text-align: center;
        max-width: 28rem;
      }
    `;
    document.head.appendChild(style);
  }

  async function populateContainer(forceRefresh) {
    const container = document.querySelector('#cr-template-chips');
    if (!container) return;

    const jobId = pickJobId();
    if (!forceRefresh && isPopulated && lastPopulatedJobId === jobId && container.querySelector('.models-section')) {
      return;
    }

    container.innerHTML = '<div style="padding:12px;color:#525252;font-size:13px;">Chargement…</div>';

    const pack = await loadAllModels(forceRefresh);
    const standard = pack.standard;
    const custom = pack.custom;
    const defaultId = pack.defaultId;

    let jobPromptId = null;
    if (jobId) {
      jobPromptId = await getJobPromptIdFromAPI(jobId, !!forceRefresh);
      if (jobPromptId == null || jobPromptId === -1) {
        jobPromptId = getJobPromptIdLocal(jobId);
      }
      if (jobPromptId != null) {
        const n = Number(jobPromptId);
        jobPromptId = isNaN(n) ? null : n;
      }
    }

    if (!document.querySelector('#cr-template-chips')) return;
    container.innerHTML = '';

    const edition = pickEdition();
    const ed = String(edition || '').toLowerCase().trim();
    const isFree = ed.startsWith('free') || ed === 'gratuit';

    if (isFree) {
      const banner = document.createElement('div');
      banner.className = 'agilo-modeles-free-banner';
      banner.innerHTML = '<strong style="color:#fd7e14;display:block;margin-bottom:4px;">Fonctionnalité Pro / Business</strong>' +
        '<span>Passez en Pro pour régénérer avec les modèles ci-dessous.</span>';
      container.appendChild(banner);
    }

    if (standard.length > 0) {
      container.appendChild(createAccordion('Modèles standards', standard, 'standard', defaultId, jobPromptId, true, isFree));
    }
    if (custom.length > 0) {
      container.appendChild(createAccordion('Mes modèles personnalisés', custom, 'custom', defaultId, jobPromptId, true, isFree));
    }
    if (standard.length === 0 && custom.length === 0) {
      container.innerHTML = '<div style="padding:16px;color:#525252;font-size:13px;text-align:center;">Aucun modèle disponible</div>';
    }

    if (jobId) updateExistingRegenerationCounter(jobId, edition);
    if (isFree && typeof window.AgiloGate !== 'undefined' && window.AgiloGate.decorate) {
      setTimeout(function () { window.AgiloGate.decorate(); }, 120);
    }

    isPopulated = true;
    lastPopulatedJobId = jobId || '';

    if (jobId && (jobPromptId == null || jobPromptId === -1)) {
      setTimeout(async function () {
        const retry = await getJobPromptIdFromAPI(jobId, true);
        if (retry != null && retry !== jobPromptId) {
          cachedModels = null;
          isPopulated = false;
          await populateContainer(true);
        }
      }, 2000);
    }
  }

  function isSummaryTabActive() {
    const tab = document.querySelector('[role="tab"][aria-selected="true"]');
    return tab?.id === 'tab-summary' || (tab?.id && tab.id.includes('summary'));
  }

  function hasSummaryContent() {
    const root = document.querySelector('#editorRoot');
    if (root?.dataset.summaryEmpty === '1') return false;
    const el = querySummaryEditor();
    if (!el) return false;
    const txt = (el.textContent || '').toLowerCase();
    if (txt.includes('pas encore disponible') || txt.includes('fichier manquant')) return false;
    return true;
  }

  let debounceTimer = null;
  function debouncedPopulate() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () { populateContainer(false); }, 280);
  }

  function switchView() {
    const iaView = document.querySelector('[data-view="ia"]');
    const templatesView = document.querySelector('[data-view="templates"]');
    if (!iaView || !templatesView) return;

    if (isSummaryTabActive() && hasSummaryContent()) {
      iaView.style.display = 'none';
      templatesView.style.display = 'block';
      debouncedPopulate();
    } else {
      iaView.style.display = 'block';
      templatesView.style.display = 'none';
    }
  }

  function init() {
    if (window.__agiloModelesInitialized) return;
    window.__agiloModelesInitialized = true;

    injectStyles();

    let lastJobId = pickJobId();
    setInterval(function () {
      const cur = pickJobId();
      if (cur && cur !== lastJobId) {
        lastJobId = cur;
        isPopulated = false;
        cachedModels = null;
        debouncedPopulate();
      }
    }, 2000);

    document.addEventListener('click', function (e) {
      if (e.target.closest('[role="tab"]')) {
        const t = e.target.closest('[role="tab"]');
        if (t && t.id && !t.id.includes('summary')) {
          isPopulated = false;
        }
        setTimeout(switchView, 100);
      }
    });

    const summaryEl = querySummaryEditor();
    if (summaryEl) {
      const obs = new MutationObserver(function () {
        if (isGenerating) return;
        setTimeout(switchView, 200);
      });
      obs.observe(summaryEl, { childList: true, subtree: true });
    }

    // Sécurité Token Resolver : rafraîchir quand le token arrive
    window.addEventListener('agilo:token', function () {
      if (isGenerating) return;
      cachedModels = null; // Invalider le cache pour forcer un vrai rechargement
      isPopulated = false; 
      setTimeout(switchView, 150);
    });

    setTimeout(switchView, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }
})();
