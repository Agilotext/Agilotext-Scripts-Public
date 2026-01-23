// Agilotext – Modèles de Compte-Rendu (VERSION 3 - OPTIMISÉE)
// Affiche les modèles standards ET personnalisés dans des accordéons
// AMÉLIORATION: Stocke le promptId utilisé par jobId pour afficher le bon modèle "actuel"

(function() {
  'use strict';

  // ============================================
  // CONFIGURATION
  // ============================================
  const DEBUG = false;
  const log = (...args) => { if (DEBUG) console.log('[AGILO:TPL]', ...args); };
  const API_BASE = 'https://api.agilotext.com/api/v1';

  // ============================================
  // CACHE & STATE
  // ============================================
  let cachedModels = null;
  let isLoading = false;
  let isPopulated = false;
  let debounceTimer = null;
  let cachedJobPromptIds = new Map(); // Cache pour les promptIds par jobId

  // ============================================
  // RÉCUPÉRER LE PROMPTID DEPUIS L'API (nouveau v1.9.162)
  // ============================================
  async function getJobPromptIdFromAPI(jobId, forceRefresh = false) {
    if (!jobId) return null;
    
    // Vérifier le cache d'abord
    if (!forceRefresh && cachedJobPromptIds.has(jobId)) {
      const cached = cachedJobPromptIds.get(jobId);
      log('PromptId depuis cache pour jobId', jobId, ':', cached);
      return cached;
    }
    
    const email = pickEmail();
    const edition = pickEdition();
    const token = pickToken(edition, email);
    
    if (!email || !token) return null;
    
    try {
      // Essayer d'abord avec les 100 premiers jobs (les plus récents)
      let url = `${API_BASE}/getJobsInfo?username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}&limit=100&offset=0`;
      
      let res = await fetch(url, { method: 'GET', cache: 'no-store' });
      let data = await res.json();
      
      if (data.status === 'OK' && Array.isArray(data.jobsInfoDtos)) {
        let job = data.jobsInfoDtos.find(j => String(j.jobid) === String(jobId));
        
        // Si pas trouvé dans les 100 premiers, chercher plus loin (max 3 pages)
        if (!job && data.jobsInfoDtos.length === 100) {
          for (let offset = 100; offset < 300; offset += 100) {
            url = `${API_BASE}/getJobsInfo?username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}&limit=100&offset=${offset}`;
            res = await fetch(url, { method: 'GET', cache: 'no-store' });
            data = await res.json();
            
            if (data.status === 'OK' && Array.isArray(data.jobsInfoDtos)) {
              job = data.jobsInfoDtos.find(j => String(j.jobid) === String(jobId));
              if (job) break;
              // Si moins de 100 résultats, on a atteint la fin
              if (data.jobsInfoDtos.length < 100) break;
            } else {
              break;
            }
          }
        }
        
        if (job) {
          log('Job trouvé:', { jobid: job.jobid, promptid: job.promptid, type: typeof job.promptid });
          // promptid peut être -1 si aucun modèle spécifique n'a été utilisé
          const rawPromptId = job.promptid;
          const promptId = rawPromptId && rawPromptId !== -1 && rawPromptId !== '-1' ? Number(rawPromptId) : null;
          if (promptId && !isNaN(promptId)) {
            // Mettre en cache
            cachedJobPromptIds.set(jobId, promptId);
            log('✅ PromptId récupéré depuis API pour jobId', jobId, ':', promptId, '(type:', typeof promptId, ')');
            return promptId;
          } else {
            // Mettre null en cache pour éviter de chercher à nouveau
            cachedJobPromptIds.set(jobId, null);
            log('⚠️ JobId', jobId, 'n\'a pas de promptId spécifique (promptid:', rawPromptId, ')');
          }
        } else {
          log('⚠️ JobId', jobId, 'non trouvé dans les jobs récupérés');
        }
      }
    } catch (err) {
      log('Erreur getJobsInfo:', err);
    }
    
    return null;
  }

  // ============================================
  // STOCKAGE LOCAL: promptId utilisé par jobId (fallback)
  // ============================================
  function getJobPromptIdLocal(jobId) {
    if (!jobId) return null;
    try {
      const storage = localStorage.getItem('agilo:job-prompt-ids');
      if (!storage) return null;
      const data = JSON.parse(storage);
      const promptId = data[jobId];
      if (promptId) {
        const numPromptId = Number(promptId);
        return !isNaN(numPromptId) ? numPromptId : null;
      }
      return null;
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
      log('PromptId stocké localement pour jobId', jobId, ':', promptId);
    } catch (e) {}
  }

  // ============================================
  // CREDENTIALS
  // ============================================
  function pickEdition() {
    const root = document.querySelector('#editorRoot');
    const raw = window.AGILO_EDITION
      || new URLSearchParams(location.search).get('edition')
      || root?.dataset.edition
      || localStorage.getItem('agilo:edition')
      || 'ent';
    const v = String(raw || '').toLowerCase().trim();
    if (['enterprise', 'entreprise', 'business', 'team', 'ent'].includes(v)) return 'ent';
    if (v.startsWith('pro')) return 'pro';
    if (v.startsWith('free') || v === 'gratuit') return 'free';
    return 'ent';
  }

  function pickEmail() {
    const root = document.querySelector('#editorRoot');
    return (
      root?.dataset.username ||
      document.querySelector('[name="memberEmail"]')?.value ||
      window.memberEmail ||
      window.__agiloOrchestrator?.credentials?.email ||
      localStorage.getItem('agilo:username') ||
      document.querySelector('[data-ms-member="email"]')?.textContent ||
      ''
    ).trim();
  }

  function pickToken(edition, email) {
    const root = document.querySelector('#editorRoot');
    const k = `agilo:token:${edition}:${String(email || '').toLowerCase()}`;
    return (
      root?.dataset.token ||
      window.__agiloOrchestrator?.credentials?.token ||
      window.globalToken ||
      localStorage.getItem(k) ||
      localStorage.getItem(`agilo:token:${edition}`) ||
      localStorage.getItem('agilo:token') ||
      ''
    );
  }

  function pickJobId() {
    const u = new URL(location.href);
    const root = document.querySelector('#editorRoot');
    return (
      u.searchParams.get('jobId') ||
      root?.dataset.jobId ||
      window.__agiloOrchestrator?.currentJobId ||
      document.querySelector('.rail-item.is-active')?.dataset?.jobId ||
      ''
    );
  }

  // ============================================
  // CHARGER LES MODÈLES (avec CACHE)
  // ============================================
  async function loadAllModels(forceRefresh = false) {
    // Retourner le cache si disponible
    if (cachedModels && !forceRefresh) {
      log('Utilisation du cache');
      return cachedModels;
    }

    // Éviter les appels simultanés
    if (isLoading) {
      log('Chargement déjà en cours, skip');
      return cachedModels || { standard: [], custom: [], defaultId: null };
    }

    const email = pickEmail();
    const edition = pickEdition();
    const token = pickToken(edition, email);

    if (!email || !token) {
      log('Credentials manquants');
      return { standard: [], custom: [], defaultId: null };
    }

    isLoading = true;
    log('Chargement des modèles...');

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
          log('API User:', userModels.length, 'modèles, default:', defaultId);
        }
      }

      if (resStd.ok) {
        const data = await resStd.json().catch(() => null);
        if (data?.status === 'OK' && Array.isArray(data.promptModeInfoDTOList)) {
          standardModels = data.promptModeInfoDTOList;
          log('API Standard:', standardModels.length, 'modèles');
        }
      }

      const allMap = new Map();
      for (const m of standardModels) allMap.set(m.promptModelId, m);
      for (const m of userModels) allMap.set(m.promptModelId, m);

      const all = Array.from(allMap.values());
      const standard = all.filter(m => m.promptModelId < 100);
      const custom = all.filter(m => m.promptModelId >= 100);

      log('Standard:', standard.length, '| Custom:', custom.length);
      
      // Mettre en cache
      cachedModels = { standard, custom, defaultId };
      return cachedModels;
    } catch (err) {
      console.error('[AGILO:TPL] Erreur:', err);
      return { standard: [], custom: [], defaultId: null };
    } finally {
      isLoading = false;
    }
  }

  // ============================================
  // CRÉER UN ACCORDÉON
  // ============================================
  function createAccordion(title, models, type, defaultId, jobPromptId, isOpen = false, isFree = false) {
    log('📋 createAccordion:', { title, type, modelsCount: models.length, defaultId, jobPromptId, jobPromptIdType: typeof jobPromptId, isFree });
    
    const section = document.createElement('div');
    section.className = `tpl-accordion tpl-accordion--${type}`;
    if (isOpen) section.classList.add('tpl-open');

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'tpl-accordion-head';
    header.id = `tpl-accordion-${type}-header`;
    header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    header.setAttribute('aria-controls', `tpl-accordion-${type}-content`);
    header.innerHTML = `
      <span class="tpl-accordion-title">${title}</span>
      <span class="tpl-accordion-badge" aria-label="${models.length} modèles">${models.length}</span>
      <svg class="tpl-accordion-arrow" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M7 10l5 5 5-5z"/>
      </svg>
    `;

    const content = document.createElement('div');
    content.className = 'tpl-accordion-body';
    content.id = `tpl-accordion-${type}-content`;
    content.setAttribute('aria-labelledby', `tpl-accordion-${type}-header`);

    const chips = document.createElement('div');
    chips.className = 'tpl-chips';

    models.forEach(m => {
      const chip = document.createElement('button');
      chip.type = 'button';
      const colorClass = type === 'standard' ? 'tpl-chip--blue' : 'tpl-chip--green';
      chip.className = `tpl-chip ${colorClass}`;
      
      // AMÉLIORATION: Marquer comme "actuel" si c'est le promptId utilisé pour CE job
      // Sinon, marquer comme "par défaut" si c'est le modèle par défaut du compte
      // Comparaison stricte avec conversion pour gérer string vs number
      const modelIdNum = Number(m.promptModelId);
      const jobPromptIdNum = jobPromptId ? Number(jobPromptId) : null;
      const defaultIdNum = defaultId ? Number(defaultId) : null;
      
      const isUsedForThisJob = jobPromptIdNum && modelIdNum === jobPromptIdNum;
      const isDefaultAccount = defaultIdNum && modelIdNum === defaultIdNum;
      
      // Debug détaillé pour chaque modèle
      if (jobPromptId) {
        log(`  🔍 Modèle "${m.promptModelName}" (ID: ${m.promptModelId}, type: ${typeof m.promptModelId}) | jobPromptId: ${jobPromptId} (type: ${typeof jobPromptId}) | Match: ${isUsedForThisJob}`);
      }
      
      // Debug pour vérifier la détection
      if (isUsedForThisJob) {
        log('🎯 ✅ Modèle "actuel" détecté et marqué:', m.promptModelName, '| promptModelId:', m.promptModelId, '| jobPromptId:', jobPromptId);
      }
      
      if (isUsedForThisJob) {
        chip.classList.add('tpl-chip--used');
        chip.disabled = true; // Désactiver pour éviter de régénérer avec le même modèle
      } else if (isDefaultAccount) {
        chip.classList.add('tpl-chip--default');
      }
      
      // Désactiver visuellement si c'est gratuit
      if (isFree && !isUsedForThisJob) {
        chip.classList.add('tpl-chip--locked');
        chip.setAttribute('data-plan-min', 'pro');
        chip.setAttribute('data-upgrade-reason', `Régénération de compte-rendu avec le modèle "${chipText}"`);
      }
      
      chip.dataset.promptId = m.promptModelId;
      
      // Envelopper le texte dans un span pour la gestion du multi-lignes
      const chipText = m.promptModelName || 'Modèle ' + m.promptModelId;
      const textSpan = document.createElement('span');
      textSpan.textContent = chipText;
      chip.appendChild(textSpan);
      
      // Tooltip avec le texte complet (utile si tronqué)
      chip.title = chipText;
      
      // Tooltip et aria-label adaptés
      let ariaLabel = '';
      if (isUsedForThisJob) {
        chip.title = `${chipText} - Modèle actuellement utilisé pour ce compte-rendu (déjà appliqué)`;
        ariaLabel = `${chipText} - Modèle actuellement utilisé`;
      } else if (isFree && !isUsedForThisJob) {
        chip.title = `🔒 Réservé au plan Pro/Business - Cliquez pour passer en Pro`;
        ariaLabel = `${chipText} - Réservé au plan Pro/Business`;
      } else if (isDefaultAccount) {
        chip.title = `${chipText} - Votre modèle par défaut - Cliquez pour régénérer avec ce modèle`;
        ariaLabel = `${chipText} - Modèle par défaut`;
      } else {
        chip.title = `${chipText} - Cliquez pour régénérer avec ce modèle`;
        ariaLabel = `Régénérer avec le modèle ${chipText}`;
      }
      chip.setAttribute('aria-label', ariaLabel);

      // Ne pas ajouter le listener si c'est le modèle actuel (désactivé)
      // Pour les gratuits, le listener sera géré par AgiloGate via data-plan-min
      if (!isUsedForThisJob && !isFree) {
        chip.addEventListener('click', () => handleChipClick(m));
      }
      chips.appendChild(chip);
    });

    content.appendChild(chips);

    header.addEventListener('click', () => {
      const isNowOpen = section.classList.toggle('tpl-open');
      header.setAttribute('aria-expanded', isNowOpen ? 'true' : 'false');
    });

    section.appendChild(header);
    section.appendChild(content);
    return section;
  }

  // ============================================
  // ÉTAT GLOBAL
  // ============================================
  let isGenerating = false;

  // ============================================
  // LOADER
  // ============================================
  function initLottieAnimation(element) {
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

  function showSummaryLoading(modelName) {
    const summaryEditor = document.querySelector('#summaryEditor, #ag-summary, [data-editor="summary"]');
    if (!summaryEditor) return;

    const loaderContainer = document.createElement('div');
    loaderContainer.className = 'tpl-loader';
    
    let lottieElement = document.querySelector('#loading-summary');
    if (!lottieElement) {
      lottieElement = document.createElement('div');
      lottieElement.id = 'tpl-lottie';
      lottieElement.className = 'tpl-lottie';
    } else {
      lottieElement = lottieElement.cloneNode(true);
      lottieElement.id = 'tpl-lottie';
    }
    
    const loadingText = document.createElement('p');
    loadingText.className = 'tpl-loader-text';
    loadingText.textContent = 'Génération du compte-rendu en cours...';
    
    const loadingSubtitle = document.createElement('p');
    loadingSubtitle.className = 'tpl-loader-sub';
    loadingSubtitle.innerHTML = modelName 
      ? `Modèle : <strong>${modelName}</strong>` 
      : 'La page se rechargera automatiquement dans :';
    
    const countdown = document.createElement('p');
    countdown.className = 'tpl-countdown';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'tpl-cancel-btn';
    cancelBtn.textContent = 'Annuler le rechargement';
    
    summaryEditor.innerHTML = '';
    summaryEditor.appendChild(loaderContainer);
    loaderContainer.appendChild(lottieElement);
    loaderContainer.appendChild(loadingText);
    loaderContainer.appendChild(loadingSubtitle);
    loaderContainer.appendChild(countdown);
    loaderContainer.appendChild(cancelBtn);
    
    setTimeout(() => {
      initLottieAnimation(lottieElement);
      setTimeout(() => {
        if (!lottieElement.querySelector('svg, canvas') && !lottieElement._lottie) {
          const fallback = document.createElement('div');
          fallback.className = 'tpl-spinner';
          lottieElement.style.display = 'none';
          loaderContainer.insertBefore(fallback, lottieElement);
        }
      }, 1000);
    }, 100);
    
    let secondsLeft = 150;
    const updateCountdown = () => {
      const minutes = Math.floor(secondsLeft / 60);
      const seconds = secondsLeft % 60;
      countdown.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      if (secondsLeft <= 0) {
        countdown.textContent = 'Rechargement...';
        setTimeout(() => {
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('tab', 'summary');
          newUrl.searchParams.set('_t', Date.now());
          window.location.href = newUrl.toString();
        }, 500);
        return;
      }
      secondsLeft--;
    };
    updateCountdown();
    const countdownInterval = setInterval(updateCountdown, 1000);
    
    cancelBtn.onclick = () => {
      clearInterval(countdownInterval);
      countdown.textContent = 'Rechargement annulé';
      cancelBtn.textContent = 'Recharger maintenant';
      cancelBtn.onclick = () => window.location.reload();
      isGenerating = false;
    };
    
    return countdownInterval;
  }

  // ============================================
  // SYSTÈME DE LIMITES DE RÉGÉNÉRATION
  // ============================================
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
      log('Compteur régénération incrémenté:', data[jobId].count, '/', data[jobId].max);
    } catch (e) {
      log('Erreur incrémentation compteur:', e);
    }
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

  // ============================================
  // CLIC SUR UN CHIP
  // ============================================
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

    // Vérifier si l'utilisateur est en gratuit
    const ed = String(edition || '').toLowerCase().trim();
    const isFree = ed.startsWith('free') || ed === 'gratuit';
    
    if (isFree) {
      // Afficher la popup d'upgrade AgiloGate
      if (typeof window.AgiloGate !== 'undefined' && window.AgiloGate.showUpgrade) {
        const modelName = model.promptModelName || 'Modèle ' + model.promptModelId;
        window.AgiloGate.showUpgrade('pro', `Régénération de compte-rendu avec le modèle "${modelName}"`);
      } else {
        alert('🔒 Cette fonctionnalité nécessite un abonnement Pro ou Business.\n\nPassez en Pro pour régénérer vos comptes-rendus avec différents modèles.');
      }
      return;
    }

    // Vérifier les limites de régénération
    const canRegen = canRegenerate(jobId, edition);
    if (!canRegen.allowed) {
      if (canRegen.reason === 'free') {
        // Ne devrait pas arriver ici car on a déjà vérifié isFree, mais au cas où
        if (typeof window.AgiloGate !== 'undefined' && window.AgiloGate.showUpgrade) {
          window.AgiloGate.showUpgrade('pro', 'Régénération de compte-rendu');
        } else {
          alert('🔒 Cette fonctionnalité nécessite un abonnement Pro ou Business.');
        }
        return;
      } else {
        alert(`⚠️ Limite atteinte: ${canRegen.count}/${canRegen.limit} régénération${canRegen.limit > 1 ? 's' : ''} utilisée${canRegen.limit > 1 ? 's' : ''} pour ce transcript.`);
        return;
      }
    }

    const modelName = model.promptModelName || 'Modèle ' + model.promptModelId;
    const confirmed = confirm(
      `⚠️ Attention, cela va remplacer le compte-rendu existant.\n\n` +
      `Modèle : ${modelName}\n\n` +
      `${canRegen.remaining}/${canRegen.limit} régénération${canRegen.remaining > 1 ? 's' : ''} restante${canRegen.remaining > 1 ? 's' : ''}.\n\n` +
      `La page se rechargera automatiquement après 2 min 30.`
    );

    if (!confirmed) return;
    isGenerating = true;

    try {
      const url = `${API_BASE}/redoSummary?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}&promptId=${encodeURIComponent(model.promptModelId)}`;
      
      const res = await fetch(url, { method: 'GET', cache: 'no-store' });
      const data = await res.json();

      if (data.status === 'OK' || res.ok) {
        // Incrémenter le compteur de régénérations (partagé avec le script relance-compte-rendu)
        incrementRegenerationCount(jobId, edition);
        
        // Mettre à jour l'affichage du compteur existant
        updateExistingRegenerationCounter(jobId, edition);
        
        // Stocker le promptId localement (fallback si API pas encore à jour)
        setJobPromptIdLocal(jobId, model.promptModelId);
        
        // Mettre à jour le cache immédiatement pour feedback instantané
        cachedJobPromptIds.set(jobId, model.promptModelId);
        
        if (typeof window.toast === 'function') {
          window.toast(`Régénération lancée avec "${modelName}"...`);
        }
        const summaryTab = document.querySelector('#tab-summary');
        if (summaryTab) summaryTab.click();
        showSummaryLoading(modelName);
      } else if (data.status === 'KO') {
        isGenerating = false;
        alert('⚠️ Une génération est déjà en cours. Veuillez patienter.');
      } else {
        isGenerating = false;
        alert('❌ Erreur: ' + (data.errorMessage || data.message || 'Une erreur est survenue'));
      }
    } catch (err) {
      isGenerating = false;
      alert('❌ Erreur de connexion.');
    }
  }

  // ============================================
  // INJECTION DES STYLES
  // ============================================
  function injectStyles() {
    if (document.querySelector('#agilo-tpl-styles-v3')) return;

    const style = document.createElement('style');
    style.id = 'agilo-tpl-styles-v3';
    style.textContent = `
      /* Container */
      #cr-template-chips {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-height: 200px;
      }

      /* Accordéon */
      .tpl-accordion {
        background: #fff;
        border: 1px solid rgba(52, 58, 64, 0.15);
        border-radius: 8px;
        overflow: hidden;
      }

      .tpl-accordion-head {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 12px 14px;
        background: #f8f9fa;
        border: none;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        color: #020202;
        text-align: left;
      }

      .tpl-accordion-head:hover {
        background: #eef1f4;
      }

      .tpl-accordion-title {
        flex: 1;
      }

      .tpl-accordion-badge {
        min-width: 22px;
        height: 22px;
        padding: 0 6px;
        border-radius: 11px;
        font-size: 11px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .tpl-accordion--standard .tpl-accordion-badge {
        background: rgba(23, 74, 150, 0.12);
        color: #174a96;
      }

      .tpl-accordion--custom .tpl-accordion-badge {
        background: rgba(28, 102, 26, 0.12);
        color: #1c661a;
      }

      .tpl-accordion-arrow {
        transition: transform 0.2s;
        opacity: 0.5;
      }

      .tpl-accordion.tpl-open .tpl-accordion-arrow {
        transform: rotate(180deg);
      }

      .tpl-accordion-body {
        display: none;
        padding: 14px 16px;
        border-top: 1px solid rgba(52, 58, 64, 0.1);
      }

      .tpl-accordion.tpl-open .tpl-accordion-body {
        display: block;
      }

      .tpl-chips {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 10px;
        align-items: stretch;
      }

      @media (min-width: 600px) {
        .tpl-chips {
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        }
      }

      @media (max-width: 480px) {
        .tpl-chips {
          grid-template-columns: 1fr;
          gap: 8px;
        }
      }

      /* Chips */
      .tpl-chip {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 40px;
        height: auto;
        max-height: 56px;
        padding: 10px 14px;
        border-radius: 0.5rem;
        font-size: 13px;
        font-weight: 500;
        line-height: 1.4;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: center;
        overflow: hidden;
        position: relative;
        word-break: break-word;
        word-wrap: break-word;
        box-sizing: border-box;
      }

      /* Texte sur plusieurs lignes avec gestion propre */
      .tpl-chip > span {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
        min-width: 0;
        line-height: 1.4;
        text-align: center;
        color: inherit;
      }

      .tpl-chip:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
      }

      /* Bleu (standard) */
      .tpl-chip--blue {
        border: 1px solid rgba(23, 74, 150, 0.3);
        background: rgba(23, 74, 150, 0.08);
        color: #174a96;
      }

      .tpl-chip--blue:hover {
        background: rgba(23, 74, 150, 0.15);
      }

      .tpl-chip--blue.tpl-chip--default {
        background: rgba(23, 74, 150, 0.15);
        border-color: rgba(23, 74, 150, 0.4);
      }

      .tpl-chip--blue.tpl-chip--used {
        background: #174a96;
        color: #ffffff;
        border-color: #174a96;
        font-weight: 600;
        box-shadow: 0 2px 6px rgba(23, 74, 150, 0.25);
      }

      .tpl-chip--blue.tpl-chip--used:hover {
        background: #0f3a6b;
        box-shadow: 0 2px 8px rgba(23, 74, 150, 0.35);
      }

      /* Vert (personnalisé) */
      .tpl-chip--green {
        border: 1px solid rgba(28, 102, 26, 0.3);
        background: rgba(28, 102, 26, 0.08);
        color: #1c661a;
      }

      .tpl-chip--green:hover {
        background: rgba(28, 102, 26, 0.15);
      }

      .tpl-chip--green.tpl-chip--default {
        background: rgba(28, 102, 26, 0.15);
        border-color: rgba(28, 102, 26, 0.4);
      }

      .tpl-chip--green.tpl-chip--used {
        background: #1c661a;
        color: #ffffff;
        border-color: #1c661a;
        font-weight: 600;
        box-shadow: 0 2px 6px rgba(28, 102, 26, 0.25);
      }

      .tpl-chip--green.tpl-chip--used:hover {
        background: #134d14;
        box-shadow: 0 2px 8px rgba(28, 102, 26, 0.35);
      }

      /* Chip verrouillé (gratuit) */
      .tpl-chip--locked {
        opacity: 0.6;
        cursor: not-allowed;
        position: relative;
      }

      .tpl-chip--locked:hover {
        transform: none;
        box-shadow: none;
      }

      .tpl-chip--blue.tpl-chip--locked {
        background: rgba(23, 74, 150, 0.05);
        border-color: rgba(23, 74, 150, 0.2);
        color: rgba(23, 74, 150, 0.5);
      }

      .tpl-chip--green.tpl-chip--locked {
        background: rgba(28, 102, 26, 0.05);
        border-color: rgba(28, 102, 26, 0.2);
        color: rgba(28, 102, 26, 0.5);
      }

      /* Chip par défaut */
      .tpl-chip--default {
        cursor: pointer;
      }

      .tpl-chip--default:hover {
        transform: translateY(-1px);
      }

      .tpl-chip--default::after {
        content: ' (par défaut)';
        font-size: 10px;
        opacity: 0.8;
        margin-left: 3px;
        white-space: nowrap;
        flex-shrink: 0;
      }

      /* Chip utilisé pour ce CR (prioritaire) - Style inversé (fond foncé, texte clair) */
      .tpl-chip--used {
        cursor: default;
        opacity: 1;
        position: relative;
      }

      .tpl-chip--used:hover {
        transform: none;
      }

      .tpl-chip--used:disabled {
        cursor: not-allowed;
        opacity: 0.85;
      }

      .tpl-chip--used::after {
        content: ' (actuel)';
        font-size: 10px;
        opacity: 0.95;
        margin-left: 4px;
        font-weight: 500;
        white-space: nowrap;
        flex-shrink: 0;
        color: inherit;
      }

      /* Vue templates cachée par défaut */
      [data-view="templates"] {
        display: none;
      }

      /* Loading skeleton */
      .tpl-skeleton {
        padding: 12px;
        color: #525252;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .tpl-skeleton::before {
        content: '';
        width: 16px;
        height: 16px;
        border: 2px solid rgba(23, 74, 150, 0.2);
        border-top-color: #174a96;
        border-radius: 50%;
        animation: tpl-spin 0.8s linear infinite;
      }

      /* Loader */
      .tpl-loader {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        text-align: center;
        min-height: 300px;
        background: #ffffff;
      }

      .tpl-lottie {
        width: 88px;
        height: 88px;
        margin: 0 auto 24px;
      }

      .tpl-spinner {
        width: 88px;
        height: 88px;
        margin: 0 auto 24px;
        border: 4px solid rgba(52, 58, 64, 0.25);
        border-top: 4px solid #174a96;
        border-radius: 50%;
        animation: tpl-spin 1s linear infinite;
      }

      @keyframes tpl-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .tpl-loader-text {
        font: 500 16px/1.35 system-ui, sans-serif;
        color: #020202;
        margin: 8px 0 4px;
      }

      .tpl-loader-sub {
        font: 400 14px/1.4 system-ui, sans-serif;
        color: #525252;
        margin-top: 8px;
      }

      .tpl-countdown {
        font-size: 28px;
        font-weight: 700;
        margin: 20px 0 12px;
        color: #174a96;
        font-variant-numeric: tabular-nums;
        font-family: ui-monospace, Menlo, monospace;
      }

      .tpl-cancel-btn {
        margin-top: 20px;
        cursor: pointer;
        padding: 10px 20px;
        border-radius: 8px;
        border: 1px solid rgba(52, 58, 64, 0.25);
        background: #020202;
        color: #ffffff;
        font: 500 14px/1.4 system-ui, sans-serif;
      }

      .tpl-cancel-btn:hover {
        background: #333;
      }

      /* Responsive */
      @media (max-width: 480px) {
        .tpl-chip { 
          padding: 8px 12px; 
          font-size: 12px; 
          min-height: 36px;
          max-height: 50px;
        }
        .tpl-chip > span {
          font-size: 12px;
        }
        .tpl-accordion-head { 
          padding: 10px 12px; 
          font-size: 12px; 
        }
        .tpl-accordion-body {
          padding: 12px;
        }
        .tpl-countdown { 
          font-size: 24px; 
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ============================================
  // METTRE À JOUR LE COMPTEUR DE RÉGÉNÉRATIONS EXISTANT
  // ============================================
  function updateExistingRegenerationCounter(jobId, edition) {
    // Utiliser la fonction du script relance-compte-rendu si disponible
    // Sinon, mettre à jour directement le compteur existant
    const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
    if (!btn) return;
    
    // Appeler la fonction updateRegenerationCounter du script relance-compte-rendu si elle existe
    // Cette fonction gère déjà l'affichage du compteur au bon endroit
    if (typeof window.updateRegenerationCounter === 'function') {
      window.updateRegenerationCounter(jobId, edition);
      return;
    }
    
    // Sinon, mettre à jour directement le compteur existant
    const canRegen = canRegenerate(jobId, edition);
    
    // Supprimer les anciens compteurs s'ils existent
    const oldCounter = btn.parentElement?.querySelector('.regeneration-counter, #regeneration-info, .regeneration-limit-message, .regeneration-premium-message');
    if (oldCounter) oldCounter.remove();
    
    if (canRegen.reason === 'free') {
      return;
    }
    
    if (canRegen.reason === 'limit') {
      const planName = edition === 'ent' || edition === 'business' ? 'Business' : 'Pro';
      const limitMsg = document.createElement('div');
      limitMsg.className = 'regeneration-limit-message';
      
      // Si l'utilisateur est en Pro, ajouter un bouton pour passer en Business
      const ed = String(edition || '').toLowerCase().trim();
      const isPro = ed === 'pro' || ed.startsWith('pro');
      let upgradeButton = '';
      
      if (isPro) {
        upgradeButton = `
          <button data-ms-price:update="prc_business-1-seat-aj1780sye" class="button upgrade" style="margin-top: 8px;">
            <svg xmlns="http://www.w3.org/2000/svg" enable-background="new 0 0 24 24" viewBox="0 0 24 24" class="icon-1x1-small white">
              <rect fill="none" height="24" width="24"></rect>
              <path d="M9.68,13.69L12,11.93l2.31,1.76l-0.88-2.85L15.75,9h-2.84L12,6.19L11.09,9H8.25l2.31,1.84L9.68,13.69z M20,10 c0-4.42-3.58-8-8-8s-8,3.58-8,8c0,2.03,0.76,3.87,2,5.28V23l6-2l6,2v-7.72C19.24,13.87,20,12.03,20,10z M12,4c3.31,0,6,2.69,6,6 s-2.69,6-6,6s-6-2.69-6-6S8.69,4,12,4z" fill="currentColor"></path>
            </svg>
            <div>Passer en Business 🇫🇷</div>
            <a data-ms-price:update="prc_business-1-seat-aj1780sye" href="#" class="button-business_upgrade w-inline-block absolute-link"></a>
          </button>`;
      }
      
      limitMsg.innerHTML = `
        <span class="regeneration-limit-icon">⚠️</span>
        <div class="regeneration-limit-content">
          <strong>Limite atteinte</strong>
          <div class="regeneration-limit-detail">${canRegen.count}/${canRegen.limit} régénération${canRegen.limit > 1 ? 's' : ''} utilisée${canRegen.limit > 1 ? 's' : ''} (plan ${planName})</div>
          ${upgradeButton}
        </div>
      `;
      
      if (btn.parentElement) {
        btn.parentElement.appendChild(limitMsg);
      }
      
      return;
    }
    
    // Afficher le compteur
    const counter = document.createElement('div');
    counter.id = 'regeneration-info';
    counter.className = `regeneration-counter ${canRegen.remaining <= canRegen.limit * 0.5 ? 'has-warning' : ''}`;
    counter.textContent = `${canRegen.remaining}/${canRegen.limit} régénérations restantes`;
    counter.title = `Il vous reste ${canRegen.remaining} régénération${canRegen.remaining > 1 ? 's' : ''} pour ce transcript`;
    counter.setAttribute('aria-live', 'polite');
    counter.setAttribute('aria-atomic', 'true');
    if (btn.parentElement) {
      btn.parentElement.appendChild(counter);
    }
  }

  // ============================================
  // REMPLIR LE CONTAINER (avec protection)
  // ============================================
  async function populateContainer(forceRefresh = false) {
    const container = document.querySelector('#cr-template-chips');
    if (!container) return;

    // Si déjà populé avec des accordéons, ne pas recharger (sauf si forceRefresh)
    if (!forceRefresh && isPopulated && container.querySelector('.tpl-accordion')) {
      log('Container déjà populé, skip');
      return;
    }

    // Skeleton loading
    container.innerHTML = '<div class="tpl-skeleton">Chargement des modèles...</div>';

    const { standard, custom, defaultId } = await loadAllModels();
    
    // AMÉLIORATION: Récupérer le promptId utilisé pour ce jobId depuis l'API
    const jobId = pickJobId();
    let jobPromptId = null;
    
    if (jobId) {
      // Essayer d'abord l'API (nouveau v1.9.162) - forcer refresh si demandé
      jobPromptId = await getJobPromptIdFromAPI(jobId, forceRefresh);
      
      // Fallback sur localStorage si l'API ne retourne rien
      if (!jobPromptId || jobPromptId === -1) {
        jobPromptId = getJobPromptIdLocal(jobId);
      }
      
      // S'assurer que le promptId est un nombre
      if (jobPromptId) {
        jobPromptId = Number(jobPromptId);
        if (isNaN(jobPromptId)) {
          log('⚠️ PromptId invalide (NaN):', jobPromptId);
          jobPromptId = null;
        }
      }
      
      // Vérifier que le promptId existe dans les modèles chargés
      if (jobPromptId) {
        const allModels = [...standard, ...custom];
        const modelExists = allModels.some(m => Number(m.promptModelId) === Number(jobPromptId));
        if (!modelExists) {
          log('⚠️ PromptId', jobPromptId, 'non trouvé dans les modèles chargés');
          // Le modèle peut avoir été supprimé, on garde quand même le promptId pour l'affichage
        } else {
          log('✅ PromptId', jobPromptId, 'trouvé dans les modèles');
        }
      }
      
      log('JobId:', jobId, '| PromptId utilisé:', jobPromptId || 'aucun (première génération)', '| Type:', typeof jobPromptId);
    }

    // Vérifier que le container existe toujours
    if (!document.querySelector('#cr-template-chips')) return;

    container.innerHTML = '';

    // Détecter si l'utilisateur est en gratuit
    const edition = pickEdition();
    const ed = String(edition || '').toLowerCase().trim();
    const isFree = ed.startsWith('free') || ed === 'gratuit';

    // Message informatif pour les utilisateurs gratuits
    if (isFree) {
      const freeMessage = document.createElement('div');
      freeMessage.className = 'tpl-free-message';
      freeMessage.innerHTML = `
        <div style="padding: 12px 14px; margin-bottom: 12px; background: rgba(253, 126, 20, 0.08); border: 1px solid rgba(253, 126, 20, 0.25); border-radius: 8px; font-size: 13px; color: #525252;">
          <strong style="color: #fd7e14; display: block; margin-bottom: 4px;">🔒 Fonctionnalité Pro/Business</strong>
          <span>Passez en Pro ou Business pour régénérer vos comptes-rendus avec différents modèles.</span>
        </div>
      `;
      container.appendChild(freeMessage);
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

    // Mettre à jour le compteur de régénérations existant (partagé avec le script relance-compte-rendu)
    if (jobId) {
      const edition = pickEdition();
      updateExistingRegenerationCounter(jobId, edition);
    }

    // Décorer les chips verrouillés avec AgiloGate si disponible
    if (isFree && typeof window.AgiloGate !== 'undefined' && window.AgiloGate.decorate) {
      setTimeout(() => {
        window.AgiloGate.decorate();
      }, 100);
    }

    isPopulated = true;
    log('Container populé');
    
    // Retry automatique si le promptId n'a pas été trouvé (l'API peut mettre du temps à se mettre à jour)
    if (jobId && !jobPromptId) {
      log('⏳ PromptId non trouvé, retry dans 2 secondes...');
      setTimeout(async () => {
        const retryPromptId = await getJobPromptIdFromAPI(jobId, true);
        if (retryPromptId && retryPromptId !== jobPromptId) {
          log('✅ PromptId trouvé au retry:', retryPromptId);
          // Re-populer avec le nouveau promptId
          await populateContainer(true);
        }
      }, 2000);
    }
  }

  // ============================================
  // SWITCH VIEW (avec debounce)
  // ============================================
  function isSummaryTabActive() {
    const tab = document.querySelector('[role="tab"][aria-selected="true"]');
    return tab?.id === 'tab-summary' || tab?.id?.includes('summary');
  }

  function hasSummaryContent() {
    const root = document.querySelector('#editorRoot');
    if (root?.dataset.summaryEmpty === '1') return false;
    const el = document.querySelector('#summaryEditor, #ag-summary, [data-editor="summary"]');
    if (!el) return false;
    const txt = el.textContent?.toLowerCase() || '';
    if (txt.includes('pas encore disponible') || txt.includes('fichier manquant')) return false;
    return true;
  }

  function switchView() {
    const iaView = document.querySelector('[data-view="ia"]');
    const templatesView = document.querySelector('[data-view="templates"]');
    if (!iaView || !templatesView) return;

    const shouldShowTemplates = isSummaryTabActive() && hasSummaryContent();

    if (shouldShowTemplates) {
      iaView.style.display = 'none';
      templatesView.style.display = 'block';
      // Populate seulement si pas déjà fait
      if (!isPopulated) {
        populateContainer();
      } else {
        // Mettre à jour le compteur même si déjà peuplé (au cas où le jobId a changé)
        const jobId = pickJobId();
        if (jobId) {
          const edition = pickEdition();
          updateExistingRegenerationCounter(jobId, edition);
        }
      }
    } else {
      iaView.style.display = 'block';
      templatesView.style.display = 'none';
    }
  }

  // Debounced version
  function debouncedSwitchView() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(switchView, 300);
  }

  // ============================================
  // INIT
  // ============================================
  function init() {
    if (window.__agiloTplV3Initialized) return;
    window.__agiloTplV3Initialized = true;

    log('Init v3...');
    injectStyles();

    // Reset des états
    cachedModels = null;
    isPopulated = false;
    isLoading = false;
    let lastJobId = pickJobId();

    // Détecter les changements de jobId pour invalider le cache
    setInterval(() => {
      const currentJobId = pickJobId();
      if (currentJobId && currentJobId !== lastJobId) {
        log('Changement de jobId détecté:', lastJobId, '→', currentJobId);
        lastJobId = currentJobId;
        isPopulated = false; // Forcer le rechargement des modèles avec le nouveau promptId
        cachedJobPromptIds.delete(lastJobId); // Nettoyer l'ancien cache si nécessaire
        debouncedSwitchView();
      }
    }, 2000);

    // Écouter les clics sur les onglets
    document.addEventListener('click', (e) => {
      if (e.target.closest('[role="tab"]')) {
        const clickedTab = e.target.closest('[role="tab"]');
        if (!clickedTab?.id?.includes('summary')) {
          isPopulated = false;
        }
        debouncedSwitchView();
      }
    });

    // Observer le summaryEditor avec debounce
    const summaryEl = document.querySelector('#summaryEditor');
    if (summaryEl) {
      const obs = new MutationObserver(() => {
        if (isGenerating) return;
        debouncedSwitchView();
      });
      obs.observe(summaryEl, { childList: true, subtree: false });
    }

    // Check initial
    setTimeout(switchView, 500);
    log('Prêt v3');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }

})();
