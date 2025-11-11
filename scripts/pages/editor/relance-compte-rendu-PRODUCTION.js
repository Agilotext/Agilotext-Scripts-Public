// Agilotext – Relance Compte-Rendu (VERSION PRODUCTION OPTIMISÉE)
(function() {
  'use strict';
  
  // ============================================
  // CONFIGURATION (logs désactivés en production)
  // ============================================
  const DEBUG = false; // Mettre à true pour activer les logs de debug
  const log = (...args) => { if (DEBUG) console.log('[AGILO:RELANCE]', ...args); };
  const logError = (...args) => { console.error('[AGILO:RELANCE]', ...args); }; // Erreurs toujours visibles
  
  // ============================================
  // RÉCUPÉRATION DES CREDENTIALS
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
    );
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
  
  async function ensureToken(email, edition) {
    const have = pickToken(edition, email);
    if (have) return have;
    
    if (typeof window.getToken === 'function' && email) {
      try {
        window.getToken(email, edition);
      } catch (_) {}
      for (let i = 0; i < 80; i++) {
        const t = pickToken(edition, email);
        if (t) return t;
        await new Promise(r => setTimeout(r, 100));
      }
    }
    
    if (email) {
      try {
        const url = `https://api.agilotext.com/api/v1/getToken?username=${encodeURIComponent(email)}&edition=${encodeURIComponent(edition)}`;
        const r = await fetch(url, { method: 'GET' });
        const j = await r.json().catch(() => null);
        if (r.ok && j?.status === 'OK' && j.token) {
          try {
            localStorage.setItem(`agilo:token:${edition}:${email.toLowerCase()}`, j.token);
            localStorage.setItem('agilo:username', email);
            localStorage.setItem('agilo:edition', edition);
          } catch (_) {}
          window.globalToken = j.token;
          return j.token;
        }
      } catch (_) {}
    }
    return '';
  }
  
  async function ensureCreds() {
    const edition = pickEdition();
    let email = pickEmail();
    for (let i = 0; i < 20 && !email; i++) {
      await new Promise(r => setTimeout(r, 100));
      email = pickEmail();
    }
    const token = await ensureToken(email, edition);
    let jobId = pickJobId();
    for (let i = 0; i < 10 && !jobId; i++) {
      await new Promise(r => setTimeout(r, 60));
      jobId = pickJobId();
    }
    return {
      email: (email || '').trim(),
      token: (token || '').trim(),
      edition,
      jobId: String(jobId || '').trim()
    };
  }
  
  // ============================================
  // VARIABLES GLOBALES
  // ============================================
  
  let transcriptModified = false;
  let isGenerating = false;
  let lastJobId = null;
  
  // ============================================
  // DÉTECTION SI COMPTE-RENDU EXISTE
  // ============================================
  
  const EXACT_ERROR_MESSAGE = "Le compte-rendu n'est pas encore disponible (fichier manquant/non publié).";
  
  function hasErrorMessageInDOM() {
    const root = document.querySelector('#editorRoot');
    
    // PRIORITÉ 1 : summaryEmpty=1 (le plus fiable)
    if (root?.dataset.summaryEmpty === '1') {
      log('summaryEmpty=1 détecté → Pas de compte-rendu');
      return true;
    }
    
    // PRIORITÉ 2 : Message d'erreur dans le DOM
    const summaryEl = document.querySelector('#summaryEditor') || 
                      document.querySelector('#ag-summary') || 
                      document.querySelector('[data-editor="summary"]');
    
    if (!summaryEl) return false;
    
    const text = (summaryEl.textContent || summaryEl.innerText || '').trim();
    const lowerText = text.toLowerCase();
    const exactLower = EXACT_ERROR_MESSAGE.toLowerCase();
    
    // Vérifier le message exact
    if (lowerText.includes(exactLower)) {
      log('Message erreur exact détecté → Pas de compte-rendu');
      return true;
    }
    
    // Vérifier les patterns d'erreur (seulement si le contenu est court)
    if (text.length < 200 && (
      lowerText.includes('pas encore disponible') || 
      lowerText.includes('fichier manquant') ||
      lowerText.includes('non publié')
    )) {
      log('Pattern erreur détecté dans contenu court → Pas de compte-rendu');
      return true;
    }
    
    return false;
  }
  
  function shouldHideButton() {
    return hasErrorMessageInDOM();
  }
  
  // ============================================
  // SYSTÈME DE LIMITES
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
  
  function updateRegenerationCounter(jobId, edition) {
    const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
    if (!btn) return;
    
    const oldCounter = btn.parentElement.querySelector('.regeneration-counter');
    if (oldCounter) oldCounter.remove();
    
    const oldMessage = btn.parentElement.querySelector('.regeneration-limit-message, .regeneration-premium-message');
    if (oldMessage) oldMessage.remove();
    
    const canRegen = canRegenerate(jobId, edition);
    
    if (canRegen.reason === 'free') {
      btn.style.display = 'flex';
      return;
    }
    
    btn.style.display = 'flex';
    
    if (canRegen.reason === 'limit') {
      const planName = edition === 'ent' || edition === 'business' ? 'Business' : 'Pro';
      const limitMsg = document.createElement('div');
      limitMsg.className = 'regeneration-limit-message';
      
      let upgradeButton = '';
      if (edition === 'pro' && typeof window.AgiloGate !== 'undefined' && window.AgiloGate.showUpgrade) {
        upgradeButton = `<button class="button bleu" style="margin-top: 8px; width: 100%;" data-plan-min="ent" data-upgrade-reason="Régénération de compte-rendu - Limite augmentée">Passer en Business (4 régénérations)</button>`;
      }
      
      limitMsg.innerHTML = `
        <span style="font-size: 16px;">⚠️</span>
        <div>
          <strong>Limite atteinte</strong>
          <div style="font-size: 12px; margin-top: 2px; color: var(--agilo-dim, #525252);">
            Vous avez utilisé ${canRegen.count}/${canRegen.limit} régénération${canRegen.limit > 1 ? 's' : ''} pour ce transcript (plan ${planName})
          </div>
          ${upgradeButton}
        </div>
      `;
      btn.parentElement.appendChild(limitMsg);
      
      if (upgradeButton && typeof window.AgiloGate !== 'undefined' && window.AgiloGate.decorate) {
        setTimeout(() => window.AgiloGate.decorate(), 100);
      }
      
      return;
    }
    
    const counter = document.createElement('div');
    counter.id = 'regeneration-info';
    counter.className = `regeneration-counter ${canRegen.remaining <= canRegen.limit * 0.5 ? 'has-warning' : ''}`;
    counter.textContent = `${canRegen.remaining}/${canRegen.limit} régénérations restantes`;
    counter.title = `Il vous reste ${canRegen.remaining} régénération${canRegen.remaining > 1 ? 's' : ''} pour ce transcript`;
    counter.setAttribute('aria-live', 'polite');
    counter.setAttribute('aria-atomic', 'true');
    btn.parentElement.appendChild(counter);
  }
  
  function updateButtonState(jobId, edition) {
    const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
    if (!btn) return;
    
    const canRegen = canRegenerate(jobId, edition);
    
    if (canRegen.reason === 'free') {
      btn.disabled = false;
      btn.removeAttribute('aria-disabled');
      btn.setAttribute('data-plan-min', 'pro');
      btn.setAttribute('data-upgrade-reason', 'Régénération de compte-rendu');
      btn.style.opacity = '0.5';
      btn.style.cursor = 'pointer';
      
      if (typeof window.AgiloGate !== 'undefined' && window.AgiloGate.decorate) {
        window.AgiloGate.decorate();
      }
      
      return;
    }
    
    if (!canRegen.allowed) {
      btn.disabled = true;
      btn.setAttribute('aria-disabled', 'true');
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
    } else {
      btn.disabled = false;
      btn.setAttribute('aria-disabled', 'false');
      btn.removeAttribute('data-plan-min');
      btn.removeAttribute('data-upgrade-reason');
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
    }
  }
  
  function updateButtonVisibility() {
    const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
    if (!btn) return;
    
    const shouldHide = shouldHideButton();
    
    if (shouldHide) {
      log('Cache le bouton (pas de compte-rendu)');
      btn.style.display = 'none';
      
      const counter = btn.parentElement.querySelector('.regeneration-counter, .regeneration-limit-message');
      if (counter) counter.style.display = 'none';
    } else {
      log('Affiche le bouton (compte-rendu existe)');
      btn.style.display = 'flex';
      
      const counter = btn.parentElement.querySelector('.regeneration-counter, .regeneration-limit-message');
      if (counter) counter.style.display = '';
    }
  }
  
  // ============================================
  // UI LOADER (DESIGN AMÉLIORÉ)
  // ============================================
  
  function openSummaryTab() {
    const summaryTab = document.querySelector('#tab-summary');
    if (summaryTab) summaryTab.click();
  }
  
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
        const animationData = {
          container: element,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path: 'https://cdn.prod.website-files.com/6815bee5a9c0b57da18354fb/6815bee5a9c0b57da18355b3_Animation%20-%201705419825493.json'
        };
        
        if (!element._lottie) {
          element._lottie = window.lottie.loadAnimation(animationData);
        }
      } catch (e) {}
    }
    
    setTimeout(() => {
      if (window.Webflow && window.Webflow.require) {
        try {
          window.Webflow.require('ix2').init();
        } catch (e) {}
      }
    }, 200);
  }
  
  function showSummaryLoading() {
    const summaryEditor = document.querySelector('#summaryEditor');
    if (!summaryEditor) return;
    
    let loaderContainer = summaryEditor.querySelector('.summary-loading-indicator');
    
    if (!loaderContainer) {
      loaderContainer = document.createElement('div');
      loaderContainer.className = 'summary-loading-indicator';
      
      let lottieElement = document.querySelector('#loading-summary');
      
      if (!lottieElement) {
        lottieElement = document.createElement('div');
        lottieElement.id = 'loading-summary';
        lottieElement.className = 'lottie-check-statut';
        lottieElement.setAttribute('data-animation-type', 'lottie');
        lottieElement.setAttribute('data-src', 'https://cdn.prod.website-files.com/6815bee5a9c0b57da18354fb/6815bee5a9c0b57da18355b3_Animation%20-%201705419825493.json');
        lottieElement.setAttribute('data-loop', '1');
        lottieElement.setAttribute('data-autoplay', '1');
      } else {
        const clonedLottie = lottieElement.cloneNode(true);
        clonedLottie.id = 'loading-summary-clone';
        lottieElement = clonedLottie;
      }
      
      const loadingText = document.createElement('p');
      loadingText.className = 'loading-text';
      loadingText.textContent = 'Génération du compte-rendu en cours...';
      
      const loadingSubtitle = document.createElement('p');
      loadingSubtitle.className = 'loading-subtitle';
      loadingSubtitle.textContent = 'La page se rechargera automatiquement dans :';
      
      summaryEditor.innerHTML = '';
      summaryEditor.appendChild(loaderContainer);
      loaderContainer.appendChild(lottieElement);
      loaderContainer.appendChild(loadingText);
      loaderContainer.appendChild(loadingSubtitle);
      
      setTimeout(() => initLottieAnimation(lottieElement), 100);
      
    } else {
      loaderContainer.style.display = 'flex';
    }
    
    loaderContainer.style.display = 'flex';
  }
  
  function hideSummaryLoading() {
    const loader = document.querySelector('.summary-loading-indicator');
    if (loader) loader.style.display = 'none';
  }
  
  function showSuccessMessage(message) {
    if (typeof window.toast === 'function') {
      window.toast('✅ ' + message);
    } else {
      const toast = document.createElement('div');
      toast.className = 'agilo-toast-success';
      toast.textContent = '✅ ' + message;
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4caf50;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 400px;
        font-size: 14px;
        font-weight: 500;
        animation: slideInRight 0.3s ease-out;
      `;
      document.body.appendChild(toast);
      
      setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
      }, 4000);
    }
  }
  
  // ============================================
  // FONCTION PRINCIPALE
  // ============================================
  
  async function relancerCompteRendu() {
    log('🚀 Début régénération');
    
    if (isGenerating) {
      log('Déjà en cours');
      return;
    }
    
    isGenerating = true;
    
    let creds;
    try {
      creds = await ensureCreds();
    } catch (err) {
      isGenerating = false;
      logError('Erreur credentials', err);
      alert('❌ Erreur de connexion. Veuillez réessayer.');
      return;
    }
    
    const { email, token, edition, jobId } = creds;
    
    if (!email || !token || !jobId) {
      isGenerating = false;
      logError('Informations incomplètes', { email: !!email, token: !!token, jobId: !!jobId });
      alert('❌ Informations incomplètes. Veuillez recharger la page.');
      return;
    }
    
    const canRegen = canRegenerate(jobId, edition);
    
    if (!canRegen.allowed) {
      isGenerating = false;
      if (canRegen.reason === 'free') {
        if (typeof window.AgiloGate !== 'undefined' && window.AgiloGate.showUpgrade) {
          window.AgiloGate.showUpgrade('pro', 'Régénération de compte-rendu');
        } else {
          alert('🔒 Cette fonctionnalité nécessite un abonnement Pro ou Business.');
        }
      } else {
        alert(`⚠️ Limite atteinte: ${canRegen.count}/${canRegen.limit} régénération${canRegen.limit > 1 ? 's' : ''} utilisée${canRegen.limit > 1 ? 's' : ''} pour ce transcript.`);
      }
      return;
    }
    
    const confirmed = confirm(
      `Remplacer le compte-rendu actuel ?\n\n` +
      `${canRegen.remaining}/${canRegen.limit} régénération${canRegen.remaining > 1 ? 's' : ''} restante${canRegen.remaining > 1 ? 's' : ''}.\n\n` +
      `⏳ La page se rechargera automatiquement après 2 min 30.`
    );
    
    if (!confirmed) {
      isGenerating = false;
      return;
    }
    
    try {
      const url = `https://api.agilotext.com/api/v1/redoSummary?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}`;
      
      log('Appel redoSummary...');
      
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit'
      });
      
      const result = await response.json();
      
      if (result.status === 'OK' || response.ok) {
        log('redoSummary OK - Incrémentation compteur');
        incrementRegenerationCount(jobId, edition);
        
        showSuccessMessage('Régénération lancée...');
        
        openSummaryTab();
        showSummaryLoading();
        
        const loaderContainer = document.querySelector('.summary-loading-indicator');
        
        if (loaderContainer) {
          const countdown = document.createElement('p');
          countdown.className = 'loading-countdown';
          countdown.style.cssText = `
            font-size: 36px;
            font-weight: 700;
            margin: 24px 0 12px;
            color: #174a96;
            font-variant-numeric: tabular-nums;
            letter-spacing: 0.05em;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
          `;
          loaderContainer.appendChild(countdown);
          
          let secondsLeft = 150; // 2 min 30
          
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
            }
            
            secondsLeft--;
          };
          
          updateCountdown();
          const countdownInterval = setInterval(updateCountdown, 1000);
          
          const cancelBtn = document.createElement('button');
          cancelBtn.className = 'button';
          cancelBtn.textContent = 'Annuler';
          cancelBtn.style.cssText = `
            margin-top: 24px;
            cursor: pointer;
            padding: 10px 24px;
            border-radius: 6px;
            transition: all 0.2s ease;
          `;
          cancelBtn.onclick = () => {
            clearInterval(countdownInterval);
            hideSummaryLoading();
            isGenerating = false;
            showSuccessMessage('Annulé - Rechargez plus tard');
          };
          loaderContainer.appendChild(cancelBtn);
        }
        
      } else if (result.status === 'KO') {
        isGenerating = false;
        alert('⚠️ Une génération est déjà en cours. Veuillez patienter.');
      } else {
        isGenerating = false;
        logError('Erreur redoSummary', result);
        alert('❌ Erreur: ' + (result.message || result.error || 'Une erreur est survenue. Veuillez réessayer.'));
      }
      
    } catch (err) {
      isGenerating = false;
      logError('Erreur réseau', err);
      alert('❌ Erreur de connexion. Vérifiez votre connexion internet et réessayez.');
    }
  }
  
  // ============================================
  // DÉTECTION CHANGEMENT DE JOBID
  // ============================================
  
  async function onJobIdChange() {
    const currentJobId = pickJobId();
    
    if (currentJobId && currentJobId !== lastJobId) {
      log('Changement de jobId détecté:', lastJobId, '→', currentJobId);
      lastJobId = currentJobId;
      
      isGenerating = false;
      
      try {
        const creds = await ensureCreds();
        if (creds.jobId && creds.edition) {
          updateRegenerationCounter(creds.jobId, creds.edition);
          updateButtonState(creds.jobId, creds.edition);
          updateButtonVisibility();
        }
      } catch (e) {
        logError('Erreur onJobIdChange', e);
      }
    }
  }
  
  // ============================================
  // INITIALISATION
  // ============================================
  
  function init() {
    if (window.__agiloRelanceProductionInitialized) {
      log('Script déjà initialisé');
      return;
    }
    window.__agiloRelanceProductionInitialized = true;
    
    log('Initialisation...');
    
    lastJobId = pickJobId();
    
    document.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-action="relancer-compte-rendu"]');
      if (btn && !btn.disabled) {
        log('Clic détecté sur le bouton');
        e.preventDefault();
        e.stopPropagation();
        relancerCompteRendu();
      }
    });
    
    const root = document.querySelector('#editorRoot');
    if (root) {
      const observer = new MutationObserver(() => {
        log('Changement summaryEmpty détecté');
        updateButtonVisibility();
      });
      observer.observe(root, { attributes: true, attributeFilter: ['data-summary-empty'] });
    }
    
    const summaryEl = document.querySelector('#summaryEditor');
    if (summaryEl) {
      const observer = new MutationObserver(() => {
        log('Changement DOM summaryEditor détecté');
        updateButtonVisibility();
      });
      observer.observe(summaryEl, { childList: true, subtree: true });
    }
    
    setInterval(onJobIdChange, 1000);
    
    setTimeout(async () => {
      try {
        const creds = await ensureCreds();
        if (creds.jobId && creds.edition) {
          updateRegenerationCounter(creds.jobId, creds.edition);
          updateButtonState(creds.jobId, creds.edition);
          updateButtonVisibility();
        }
      } catch (e) {
        logError('Erreur initialisation', e);
      }
    }, 500);
  }
  
  // ============================================
  // STYLES CSS (DESIGN AMÉLIORÉ)
  // ============================================
  
  if (!document.querySelector('#relance-summary-styles')) {
    const style = document.createElement('style');
    style.id = 'relance-summary-styles';
    style.textContent = `
      @keyframes slideInRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      @keyframes slideOutRight {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
      
      .summary-loading-indicator {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 80px 40px;
        text-align: center;
        min-height: 400px;
        background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
        color: #020202;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      }
      
      .summary-loading-indicator #loading-summary,
      .summary-loading-indicator #loading-summary-clone {
        width: 100px;
        height: 100px;
        margin: 0 auto 32px;
        filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1));
      }
      
      .summary-loading-indicator .loading-text {
        font: 600 18px/1.4 system-ui, -apple-system, Arial, sans-serif;
        margin: 0 0 8px;
        color: #1a1a1a;
        letter-spacing: -0.01em;
      }
      
      .summary-loading-indicator .loading-subtitle {
        font: 400 14px/1.5 system-ui, -apple-system, Arial, sans-serif;
        color: #6b7280;
        margin-top: 4px;
      }
      
      .loading-countdown {
        font-size: 40px;
        font-weight: 700;
        margin: 28px 0 16px;
        color: #174a96;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.05em;
        text-shadow: 0 2px 8px rgba(23, 74, 150, 0.2);
        font-family: system-ui, -apple-system, 'SF Mono', monospace;
      }
      
      .regeneration-counter {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 500;
        color: #525252;
        margin-top: 8px;
        padding: 6px 12px;
        border-radius: 6px;
        background: #f8f9fa;
        border: 1px solid #e5e7eb;
        transition: all 0.2s ease;
      }
      
      .regeneration-counter:hover {
        background: #f1f3f5;
        border-color: #d1d5db;
      }
      
      .regeneration-counter.has-warning {
        color: #fd7e14;
        background: #fff4e6;
        border-color: #ffd89b;
      }
      
      .regeneration-limit-message {
        display: flex;
        gap: 12px;
        padding: 14px 16px;
        margin-top: 10px;
        border-radius: 8px;
        font-size: 14px;
        background: rgba(253, 126, 20, 0.08);
        border: 1px solid rgba(253, 126, 20, 0.25);
        box-shadow: 0 2px 4px rgba(253, 126, 20, 0.1);
      }
      
      .regeneration-limit-message strong {
        color: #fd7e14;
        font-weight: 600;
      }
      
      .agilo-toast-success {
        animation: slideInRight 0.3s ease-out;
      }
    `;
    document.head.appendChild(style);
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }
  
  window.relancerCompteRendu = relancerCompteRendu;
  
  if (DEBUG) {
    console.log('[AGILO:RELANCE] ✅ Script chargé (VERSION PRODUCTION)');
  }
})();

