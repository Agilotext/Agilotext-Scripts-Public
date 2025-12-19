// Agilotext – Modèles de Compte-Rendu (VERSION SIMPLIFIÉE)
// Affiche les modèles standards ET personnalisés dans des accordéons

(function() {
  'use strict';

  // ============================================
  // CONFIGURATION
  // ============================================
  const DEBUG = false;
  const log = (...args) => { if (DEBUG) console.log('[AGILO:MODELES]', ...args); };
  const API_BASE = 'https://api.agilotext.com/api/v1';

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
  // CHARGER LES MODÈLES (2 APIs en parallèle)
  // ============================================
  async function loadAllModels() {
    const email = pickEmail();
    const edition = pickEdition();
    const token = pickToken(edition, email);

    if (!email || !token) {
      log('Credentials manquants');
      return { standard: [], custom: [], defaultId: null };
    }

    log('Chargement des modèles...');

    try {
      // Appeler les DEUX APIs (les deux ont besoin de edition!)
      const [resUser, resStd] = await Promise.all([
        fetch(`${API_BASE}/getPromptModelsUserInfo?username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}`),
        fetch(`${API_BASE}/getPromptModelsStandardInfo?username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}`)
      ]);

      let userModels = [];
      let standardModels = [];
      let defaultId = null;

      // Réponse User
      if (resUser.ok) {
        const data = await resUser.json().catch(() => null);
        if (data?.status === 'OK' && Array.isArray(data.promptModeInfoDTOList)) {
          userModels = data.promptModeInfoDTOList;
          defaultId = data.defaultPromptModelId;
          log('API User:', userModels.length, 'modèles, default:', defaultId);
          log('API User - Tous les IDs:', userModels.map(m => m.promptModelId));
        }
      }

      // Réponse Standard
      log('API Standard - Status HTTP:', resStd.status);
      if (resStd.ok) {
        const data = await resStd.json().catch(() => null);
        log('API Standard - Réponse:', JSON.stringify(data));
        if (data?.status === 'OK' && Array.isArray(data.promptModeInfoDTOList)) {
          standardModels = data.promptModeInfoDTOList;
          log('API Standard:', standardModels.length, 'modèles');
        } else {
          log('API Standard - Format inattendu ou pas de modèles');
        }
      } else {
        log('API Standard - Erreur HTTP:', resStd.status);
      }

      // Fusionner tout (dédupliquer par ID)
      const allMap = new Map();
      for (const m of standardModels) allMap.set(m.promptModelId, m);
      for (const m of userModels) allMap.set(m.promptModelId, m);

      const all = Array.from(allMap.values());
      
      // Séparer: standard = ID < 100, custom = ID >= 100
      const standard = all.filter(m => m.promptModelId < 100);
      const custom = all.filter(m => m.promptModelId >= 100);

      log('Résultat: Standard:', standard.length, '| Custom:', custom.length);
      log('IDs Standards:', standard.map(m => m.promptModelId));
      log('IDs Custom:', custom.map(m => m.promptModelId));

      return { standard, custom, defaultId };
    } catch (err) {
      console.error('[AGILO:MODELES] Erreur:', err);
      return { standard: [], custom: [], defaultId: null };
    }
  }

  // ============================================
  // CRÉER UN ACCORDÉON
  // ============================================
  function createAccordion(title, models, type, defaultId, isOpen = false) {
    const section = document.createElement('div');
    section.className = `models-section section-${type}`;
    if (isOpen) section.classList.add('is-open');

    // Header
    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'models-section-header';
    header.innerHTML = `
      <span class="models-section-title">${title}</span>
      <span class="models-section-count">${models.length}</span>
      <svg class="models-section-arrow" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7 10l5 5 5-5z"/>
      </svg>
    `;

    // Contenu
    const content = document.createElement('div');
    content.className = 'models-section-content';

    const chips = document.createElement('div');
    chips.className = 'models-chips';

    models.forEach(m => {
      const chip = document.createElement('button');
      chip.type = 'button';
      // Classe de base + classe de couleur selon le type
      const colorClass = type === 'standard' ? 'chip-standard' : 'chip-custom';
      chip.className = `model-chip ${colorClass}`;
      if (m.promptModelId === defaultId) chip.classList.add('is-current');
      
      chip.dataset.promptId = m.promptModelId;
      chip.textContent = m.promptModelName || 'Modèle ' + m.promptModelId;
      chip.title = m.promptModelId === defaultId 
        ? 'Votre modèle par défaut' 
        : 'Cliquez pour régénérer avec ce modèle';

      chip.addEventListener('click', () => handleChipClick(m));
      chips.appendChild(chip);
    });

    content.appendChild(chips);

    // Toggle
    header.addEventListener('click', () => {
      section.classList.toggle('is-open');
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
  // LOADER (même style que le script relance)
  // ============================================
  function initLottieAnimation(element) {
    if (window.Webflow && window.Webflow.require) {
      try {
        const ix2 = window.Webflow.require('ix2');
        if (ix2 && typeof ix2.init === 'function') {
          setTimeout(() => ix2.init(), 100);
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

  function showSummaryLoading(modelName) {
    const summaryEditor = document.querySelector('#summaryEditor') || 
                          document.querySelector('#ag-summary') || 
                          document.querySelector('[data-editor="summary"]');
    if (!summaryEditor) return;

    // Créer le loader
    const loaderContainer = document.createElement('div');
    loaderContainer.className = 'summary-loading-indicator';
    
    // Animation Lottie
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
    loadingSubtitle.innerHTML = modelName 
      ? `Modèle : <strong>${modelName}</strong>` 
      : 'La page se rechargera automatiquement dans :';
    
    const countdown = document.createElement('p');
    countdown.className = 'loading-countdown';
    countdown.id = 'model-countdown';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'loading-cancel-btn';
    cancelBtn.textContent = 'Annuler le rechargement';
    
    summaryEditor.innerHTML = '';
    summaryEditor.appendChild(loaderContainer);
    loaderContainer.appendChild(lottieElement);
    loaderContainer.appendChild(loadingText);
    loaderContainer.appendChild(loadingSubtitle);
    loaderContainer.appendChild(countdown);
    loaderContainer.appendChild(cancelBtn);
    
    // Initialiser Lottie
    setTimeout(() => {
      initLottieAnimation(lottieElement);
      // Fallback si Lottie ne charge pas
      setTimeout(() => {
        const hasLottie = lottieElement.querySelector('svg, canvas') || lottieElement._lottie;
        if (!hasLottie) {
          const fallback = document.createElement('div');
          fallback.className = 'lottie-fallback';
          lottieElement.style.display = 'none';
          loaderContainer.insertBefore(fallback, lottieElement);
        }
      }, 1000);
    }, 100);
    
    // Countdown 2min30
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
    
    // Bouton annuler
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
  // CLIC SUR UN CHIP
  // ============================================
  async function handleChipClick(model) {
    if (isGenerating) {
      log('Déjà en cours de génération');
      return;
    }

    const jobId = pickJobId();
    const email = pickEmail();
    const edition = pickEdition();
    const token = pickToken(edition, email);

    if (!jobId || !email || !token) {
      alert('Informations manquantes. Rechargez la page.');
      return;
    }

    const modelName = model.promptModelName || 'Modèle ' + model.promptModelId;
    const confirmed = confirm(
      `⚠️ Attention, cela va remplacer le compte-rendu existant.\n\n` +
      `Modèle : ${modelName}\n\n` +
      `La page se rechargera automatiquement après 2 min 30.`
    );

    if (!confirmed) return;

    isGenerating = true;

    try {
      const url = `${API_BASE}/redoSummary?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}&promptId=${encodeURIComponent(model.promptModelId)}`;
      
      log('Appel redoSummary avec promptId:', model.promptModelId);
      
      const res = await fetch(url, { method: 'GET', cache: 'no-store' });
      const data = await res.json();

      if (data.status === 'OK' || res.ok) {
        // Toast de succès
        if (typeof window.toast === 'function') {
          window.toast(`Régénération lancée avec "${modelName}"...`);
        }
        
        // Basculer sur l'onglet compte-rendu
        const summaryTab = document.querySelector('#tab-summary');
        if (summaryTab) summaryTab.click();
        
        // Afficher le loader avec countdown
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
      console.error('[AGILO:MODELES] Erreur:', err);
      alert('❌ Erreur de connexion. Vérifiez votre connexion internet.');
    }
  }

  // ============================================
  // INJECTION DES STYLES
  // ============================================
  function injectStyles() {
    if (document.querySelector('#agilo-modeles-styles')) return;

    const style = document.createElement('style');
    style.id = 'agilo-modeles-styles';
    style.textContent = `
      /* Container */
      #cr-template-chips {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      /* Section accordéon */
      .models-section {
        background: #fff;
        border: 1px solid rgba(52, 58, 64, 0.15);
        border-radius: 8px;
        overflow: hidden;
      }

      /* Header */
      .models-section-header {
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

      .models-section-header:hover {
        background: #eef1f4;
      }

      .models-section-title {
        flex: 1;
      }

      .models-section-count {
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

      /* Couleurs des badges selon le type */
      .models-section.section-standard .models-section-count {
        background: rgba(23, 74, 150, 0.12);
        color: #174a96;
      }

      .models-section.section-custom .models-section-count {
        background: rgba(28, 102, 26, 0.12);
        color: #1c661a;
      }

      .models-section-arrow {
        transition: transform 0.2s;
        opacity: 0.5;
      }

      .models-section.is-open .models-section-arrow {
        transform: rotate(180deg);
      }

      /* Contenu */
      .models-section-content {
        display: none;
        padding: 12px 14px;
        border-top: 1px solid rgba(52, 58, 64, 0.1);
      }

      .models-section.is-open .models-section-content {
        display: block;
      }

      /* Chips container */
      .models-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      /* Chip - Base */
      .model-chip {
        display: inline-flex;
        align-items: center;
        padding: 8px 14px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
      }

      .model-chip:hover {
        transform: translateY(-1px);
      }

      /* Chip Standard (bleu) */
      .model-chip.chip-standard {
        border: 1px solid rgba(23, 74, 150, 0.3);
        background: rgba(23, 74, 150, 0.08);
        color: #174a96;
      }

      .model-chip.chip-standard:hover {
        background: rgba(23, 74, 150, 0.15);
      }

      .model-chip.chip-standard.is-current {
        background: #174a96;
        color: #fff;
        border-color: #174a96;
      }

      /* Chip Personnalisé (vert) */
      .model-chip.chip-custom {
        border: 1px solid rgba(28, 102, 26, 0.3);
        background: rgba(28, 102, 26, 0.08);
        color: #1c661a;
      }

      .model-chip.chip-custom:hover {
        background: rgba(28, 102, 26, 0.15);
      }

      .model-chip.chip-custom.is-current {
        background: #1c661a;
        color: #fff;
        border-color: #1c661a;
      }

      /* État actuel */
      .model-chip.is-current {
        cursor: default;
      }

      .model-chip.is-current:hover {
        transform: none;
      }

      .model-chip.is-current::after {
        content: ' (par défaut)';
        font-size: 10px;
        opacity: 0.8;
        margin-left: 4px;
      }

      /* Vue templates cachée par défaut */
      [data-view="templates"] {
        display: none;
      }

      /* Responsive */
      @media (max-width: 480px) {
        .model-chip {
          padding: 6px 12px;
          font-size: 12px;
        }
        .models-section-header {
          padding: 10px 12px;
          font-size: 12px;
        }
      }

      /* ================================
         LOADER (même style que relance)
         ================================ */
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
        margin-bottom: 0.25rem;
      }

      .summary-loading-indicator .loading-subtitle {
        font: 400 0.875rem/1.4 system-ui, -apple-system, sans-serif;
        color: #525252;
        margin-top: 0.5rem;
      }

      .loading-countdown {
        font-size: 1.75rem;
        font-weight: 700;
        margin: 1.25rem 0 0.75rem;
        color: #174a96;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.04em;
        font-family: ui-monospace, Menlo, monospace;
      }

      .loading-cancel-btn {
        margin-top: 1.25rem;
        cursor: pointer;
        padding: 0.625rem 1.25rem;
        border-radius: 0.5rem;
        border: 1px solid rgba(52, 58, 64, 0.25);
        background: #020202;
        color: #ffffff;
        font: 500 0.875rem/1.4 system-ui, -apple-system, sans-serif;
        transition: all 0.15s ease;
      }

      .loading-cancel-btn:hover {
        background: #333;
        transform: translateY(-1px);
      }

      @media (max-width: 480px) {
        .summary-loading-indicator {
          padding: 2.5rem 1rem;
          min-height: 15rem;
        }
        .loading-countdown {
          font-size: 1.5rem;
        }
        .loading-cancel-btn {
          padding: 0.5rem 1rem;
          font-size: 0.8125rem;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ============================================
  // REMPLIR LE CONTAINER
  // ============================================
  async function populateContainer() {
    const container = document.querySelector('#cr-template-chips');
    if (!container) {
      log('Container #cr-template-chips non trouvé');
      return;
    }

    // Loader
    container.innerHTML = '<div style="padding:12px;color:#525252;font-size:13px;">Chargement...</div>';

    const { standard, custom, defaultId } = await loadAllModels();

    container.innerHTML = '';

    // Section Standards
    if (standard.length > 0) {
      const stdSection = createAccordion('Modèles standards', standard, 'standard', defaultId, true);
      container.appendChild(stdSection);
    } else {
      log('Aucun modèle standard trouvé');
    }

    // Section Personnalisés
    if (custom.length > 0) {
      const custSection = createAccordion('Mes modèles personnalisés', custom, 'custom', defaultId, true);
      container.appendChild(custSection);
    }

    if (standard.length === 0 && custom.length === 0) {
      container.innerHTML = '<div style="padding:16px;color:#525252;font-size:13px;text-align:center;">Aucun modèle disponible</div>';
    }
  }

  // ============================================
  // SWITCH VIEW (IA vs Templates)
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

    if (isSummaryTabActive() && hasSummaryContent()) {
      iaView.style.display = 'none';
      templatesView.style.display = 'block';
      populateContainer();
    } else {
      iaView.style.display = 'block';
      templatesView.style.display = 'none';
    }
  }

  // ============================================
  // INIT
  // ============================================
  function init() {
    if (window.__agiloModelesInitialized) return;
    window.__agiloModelesInitialized = true;

    log('Initialisation...');
    injectStyles();

    // Écouter les clics sur les onglets
    document.addEventListener('click', (e) => {
      if (e.target.closest('[role="tab"]')) {
        setTimeout(switchView, 100);
      }
    });

    // Observer le summaryEditor
    const summaryEl = document.querySelector('#summaryEditor');
    if (summaryEl) {
      const obs = new MutationObserver(() => setTimeout(switchView, 200));
      obs.observe(summaryEl, { childList: true, subtree: true });
    }

    // Check initial
    setTimeout(switchView, 500);

    log('Prêt');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }

})();
