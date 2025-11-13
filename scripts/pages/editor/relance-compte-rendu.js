// Agilotext – Relance Compte-Rendu (VERSION PRODUCTION OPTIMISÉE)
(function() {
  'use strict';

  // ============================================
  // CONFIGURATION
  // ============================================
  const DEBUG = false;
  const log = (...args) => { if (DEBUG) console.log('[AGILO:RELANCE]', ...args); };
  const logError = (...args) => { console.error('[AGILO:RELANCE]', ...args); };

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
    if (root?.dataset.summaryEmpty === '1') {
      log('summaryEmpty=1 détecté → Pas de compte-rendu');
      return true;
    }
    const summaryEl = document.querySelector('#summaryEditor') || 
                      document.querySelector('#ag-summary') || 
                      document.querySelector('[data-editor="summary"]');
    if (!summaryEl) return false;
    const text = (summaryEl.textContent || summaryEl.innerText || '').trim();
    const lowerText = text.toLowerCase();
    const exactLower = EXACT_ERROR_MESSAGE.toLowerCase();
    if (lowerText.includes(exactLower)) {
      log('Message erreur exact détecté → Pas de compte-rendu');
      return true;
    }
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

  /**
   * Vérifier si un compte-rendu existe (pour le compteur)
   * Retourne true si le compte-rendu existe, false sinon
   */
  function hasSummaryExists() {
    return !hasErrorMessageInDOM();
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

  /**
   * Créer ou mettre à jour le badge de compteur
   * ✅ CORRECTION : Ne crée le compteur QUE si un compte-rendu existe
   */
  function updateRegenerationCounter(jobId, edition) {
    const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
    if (!btn) return;
    
    // ✅ NOUVEAU : Vérifier d'abord si un compte-rendu existe
    // Si pas de compte-rendu, supprimer le compteur et ne rien créer
    if (!hasSummaryExists()) {
      const oldCounter = btn.parentElement.querySelector('.regeneration-counter, #regeneration-info');
      if (oldCounter) oldCounter.remove();
      const oldMessage = btn.parentElement.querySelector('.regeneration-limit-message, .regeneration-premium-message');
      if (oldMessage) oldMessage.remove();
      return; // Ne pas créer de compteur si pas de compte-rendu
    }
    
    // Supprimer l'ancien compteur s'il existe
    const oldCounter = btn.parentElement.querySelector('.regeneration-counter, #regeneration-info');
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
      limitMsg.innerHTML = `
        <span class="regeneration-limit-icon">⚠️</span>
        <div class="regeneration-limit-content">
          <strong>Limite atteinte</strong>
          <div class="regeneration-limit-detail">${canRegen.count}/${canRegen.limit} régénération${canRegen.limit > 1 ? 's' : ''} utilisée${canRegen.limit > 1 ? 's' : ''} (plan ${planName})</div>
        </div>
      `;
      btn.parentElement.appendChild(limitMsg);
      return;
    }
    
    // ✅ Afficher le compteur UNIQUEMENT si un compte-rendu existe (vérifié au début)
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

  function getButtonText() {
    const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
    if (activeTab?.id === 'tab-summary') return 'Régénérer';
    if (activeTab?.id === 'tab-transcript' && transcriptModified) return 'Régénérer compte-rendu';
    return 'Relancer';
  }

  function updateButtonVisibility() {
    const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
    if (!btn) return;
    const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
    const isSummaryTab = activeTab?.id === 'tab-summary';
    const isTranscriptTab = activeTab?.id === 'tab-transcript';
    const textDiv = btn.querySelector('div');
    if (textDiv) textDiv.textContent = getButtonText();
    const shouldHide = shouldHideButton();
    
    if (shouldHide) {
      log('Cache le bouton (pas de compte-rendu)');
      btn.style.setProperty('display', 'none', 'important');
      btn.style.setProperty('visibility', 'hidden', 'important');
      btn.style.setProperty('opacity', '0', 'important');
      btn.style.setProperty('pointer-events', 'none', 'important');
      const counter = btn.parentElement?.querySelector('.regeneration-counter, .regeneration-limit-message, #regeneration-info');
      if (counter) {
        counter.style.setProperty('display', 'none', 'important');
        counter.style.setProperty('visibility', 'hidden', 'important');
      }
      return;
    }
    
    if (isSummaryTab) {
      log('Affiche le bouton (onglet compte-rendu)');
      btn.style.removeProperty('display');
      btn.style.removeProperty('visibility');
      btn.style.removeProperty('opacity');
      btn.style.removeProperty('pointer-events');
      const counter = btn.parentElement?.querySelector('.regeneration-counter, .regeneration-limit-message, #regeneration-info');
      if (counter) {
        counter.style.removeProperty('display');
        counter.style.removeProperty('visibility');
      }
    } else if (isTranscriptTab && transcriptModified) {
      log('Affiche le bouton (transcript modifié)');
      btn.style.removeProperty('display');
      btn.style.removeProperty('visibility');
      btn.style.removeProperty('opacity');
      btn.style.removeProperty('pointer-events');
      const counter = btn.parentElement?.querySelector('.regeneration-counter, .regeneration-limit-message, #regeneration-info');
      if (counter) {
        counter.style.removeProperty('display');
        counter.style.removeProperty('visibility');
      }
    } else {
      log('Cache le bouton (transcript non modifié ou autre onglet)');
      btn.style.setProperty('display', 'none', 'important');
      btn.style.setProperty('visibility', 'hidden', 'important');
      btn.style.setProperty('opacity', '0', 'important');
      btn.style.setProperty('pointer-events', 'none', 'important');
      const counter = btn.parentElement?.querySelector('.regeneration-counter, .regeneration-limit-message, #regeneration-info');
      if (counter) {
        counter.style.setProperty('display', 'none', 'important');
        counter.style.setProperty('visibility', 'hidden', 'important');
      }
    }
  }

  // ============================================
  // UI LOADER
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
    const summaryEditor = document.querySelector('#summaryEditor') || 
                          document.querySelector('#ag-summary') || 
                          document.querySelector('[data-editor="summary"]');
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
        lottieElement.setAttribute('data-w-id', '3f0ed4f9-0ff3-907d-5d6d-28f23fb3783f');
        lottieElement.setAttribute('data-animation-type', 'lottie');
        lottieElement.setAttribute('data-src', 'https://cdn.prod.website-files.com/6815bee5a9c0b57da18354fb/6815bee5a9c0b57da18355b3_Animation%20-%201705419825493.json');
        lottieElement.setAttribute('data-loop', '1');
        lottieElement.setAttribute('data-direction', '1');
        lottieElement.setAttribute('data-autoplay', '1');
        lottieElement.setAttribute('data-is-ix2-target', '0');
        lottieElement.setAttribute('data-renderer', 'svg');
        lottieElement.setAttribute('data-default-duration', '2');
        lottieElement.setAttribute('data-duration', '0');
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
      
      setTimeout(() => {
        initLottieAnimation(lottieElement);
        setTimeout(() => {
          const hasLottieContent = lottieElement.querySelector('svg, canvas') || lottieElement._lottie;
          if (!hasLottieContent) {
            const fallback = document.createElement('div');
            fallback.className = 'lottie-fallback';
            lottieElement.style.display = 'none';
            loaderContainer.insertBefore(fallback, lottieElement);
          }
        }, 1000);
      }, 100);
    } else {
      loaderContainer.style.display = 'flex';
      const lottieEl = loaderContainer.querySelector('#loading-summary, #loading-summary-clone');
      if (lottieEl) {
        setTimeout(() => {
          initLottieAnimation(lottieEl);
        }, 100);
      }
    }
    loaderContainer.style.display = 'flex';
  }

  function hideSummaryLoading() {
    const summaryEditor = document.querySelector('#summaryEditor') || 
                          document.querySelector('#ag-summary') || 
                          document.querySelector('[data-editor="summary"]');
    if (!summaryEditor) return;
    const loader = summaryEditor.querySelector('.summary-loading-indicator');
    const lottieElement = summaryEditor.querySelector('#loading-summary, #loading-summary-clone');
    if (loader) loader.style.display = 'none';
    if (lottieElement) lottieElement.style.display = 'none';
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
        top: 1.25rem;
        right: 1.25rem;
        background: #4caf50;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 0.25rem 0.75rem rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 25rem;
        font-size: 0.875rem;
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
          loaderContainer.appendChild(countdown);
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
            }
            secondsLeft--;
          };
          
          updateCountdown();
          const countdownInterval = setInterval(updateCountdown, 1000);
          
          const cancelBtn = document.createElement('button');
          cancelBtn.className = 'loading-cancel-btn';
          cancelBtn.textContent = 'Annuler';
          cancelBtn.onclick = () => {
            const confirmed = confirm(
              '⚠️ La régénération est déjà en cours sur le serveur.\n\n' +
              'Si vous annulez maintenant :\n' +
              '• Le compte-rendu actuel sera remplacé dans 2-3 minutes\n' +
              '• Vous devrez recharger la page pour voir le nouveau compte-rendu\n\n' +
              '💡 CONSEIL : Téléchargez et sauvegardez votre compte-rendu actuel avant de continuer, car il sera remplacé.\n\n' +
              'Souhaitez-vous vraiment annuler ?'
            );
            
            if (confirmed) {
              clearInterval(countdownInterval);
              hideSummaryLoading();
              isGenerating = false;
              const infoMsg = document.createElement('div');
              infoMsg.className = 'regeneration-cancel-info';
              infoMsg.innerHTML = `
                <div style="padding: 1rem; background: color-mix(in srgb, var(--agilo-primary, #174a96) 8%, var(--agilo-surface, #ffffff) 92%); border: 1px solid color-mix(in srgb, var(--agilo-primary, #174a96) 25%, transparent); border-radius: var(--agilo-radius, 0.5rem); margin-top: 1rem;">
                  <strong style="color: var(--agilo-primary, #174a96); display: block; margin-bottom: 0.5rem; font-size: 0.875rem;">ℹ️ Régénération en cours sur le serveur</strong>
                  <p style="font-size: 0.8125rem; color: var(--agilo-dim, #525252); margin: 0 0 0.5rem; line-height: 1.5;">
                    <strong>⚠️ Important :</strong> La régénération est déjà lancée. Votre compte-rendu actuel sera remplacé dans 2-3 minutes.
                  </p>
                  <p style="font-size: 0.8125rem; color: var(--agilo-dim, #525252); margin: 0 0 0.5rem; line-height: 1.5;">
                    💡 Si vous souhaitez conserver le compte-rendu actuel, <strong>téléchargez-le maintenant</strong> via les boutons de téléchargement avant qu'il ne soit remplacé.
                  </p>
                  <p style="font-size: 0.8125rem; color: var(--agilo-dim, #525252); margin: 0 0 0.75rem; line-height: 1.5;">
                    Rechargez la page dans 2-3 minutes pour voir le nouveau compte-rendu.
                  </p>
                  <button class="loading-cancel-btn" style="margin-top: 0.5rem; width: 100%;" onclick="window.location.reload()">
                    Recharger la page maintenant
                  </button>
                </div>
              `;
              const summaryEditor = document.querySelector('#summaryEditor');
              if (summaryEditor) {
                summaryEditor.innerHTML = '';
                summaryEditor.appendChild(infoMsg);
              }
              showSuccessMessage('Régénération annulée - Rechargez la page dans 2-3 minutes');
            } else {
              log('Annulation non confirmée - Le compteur continue');
            }
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
    
    const saveBtn = document.querySelector('[data-action="save-transcript"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        transcriptModified = true;
        try {
          const jobId = pickJobId();
          if (jobId) {
            localStorage.setItem(`agilo:transcript-saved:${jobId}`, 'true');
            localStorage.setItem('agilo:last-jobId', jobId);
          }
        } catch (e) {}
        if (typeof window.toast === 'function') {
          window.toast('✅ Transcript sauvegardé - Vous pouvez régénérer le compte-rendu');
        }
        updateButtonVisibility();
        setTimeout(async () => {
          try {
            const creds = await ensureCreds();
            if (creds.jobId && creds.edition) {
              updateRegenerationCounter(creds.jobId, creds.edition);
              updateButtonState(creds.jobId, creds.edition);
            }
          } catch (e) {
            log('Erreur mise à jour compteurs:', e);
          }
        }, 500);
      });
    }
    
    const currentJobId = pickJobId();
    if (currentJobId) {
      try {
        const wasSaved = localStorage.getItem(`agilo:transcript-saved:${currentJobId}`);
        const lastJobId = localStorage.getItem('agilo:last-jobId');
        if (wasSaved === 'true' && lastJobId === currentJobId) {
          transcriptModified = true;
          log('Transcript déjà sauvegardé détecté');
        }
      } catch (e) {}
    }
    
    const tabs = document.querySelectorAll('[role="tab"]');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        setTimeout(() => {
          updateButtonVisibility();
        }, 100);
      });
    });
    
    const root = document.querySelector('#editorRoot');
    if (root) {
      let debounceTimer;
      const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          log('Changement summaryEmpty détecté');
          updateButtonVisibility();
        }, 100);
      });
      observer.observe(root, { attributes: true, attributeFilter: ['data-summary-empty'] });
    }
    
    const summaryEl = document.querySelector('#summaryEditor');
    if (summaryEl) {
      let debounceTimer;
      const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          log('Changement DOM summaryEditor détecté');
          updateButtonVisibility();
        }, 150);
      });
      observer.observe(summaryEl, { childList: true, subtree: true, characterData: true });
    }
    
    setInterval(onJobIdChange, 2000);
    
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
  // STYLES CSS
  // ============================================
  if (!document.querySelector('#relance-summary-styles')) {
    const style = document.createElement('style');
    style.id = 'relance-summary-styles';
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
      .summary-loading-indicator {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 3.75rem 1.25rem;
        text-align: center;
        min-height: 18.75rem;
        background: var(--agilo-surface, var(--color--white, #ffffff));
        color: var(--agilo-text, var(--color--gris_foncé, #020202));
        animation: agilo-fadeIn 0.3s ease-out;
      }
      .summary-loading-indicator #loading-summary,
      .summary-loading-indicator #loading-summary-clone {
        width: 5.5rem;
        height: 5.5rem;
        margin: 0 auto 1.5rem;
        display: block;
      }
      .summary-loading-indicator .lottie-fallback {
        width: 5.5rem;
        height: 5.5rem;
        margin: 0 auto 1.5rem;
        border: 0.25rem solid var(--agilo-border, rgba(52, 58, 64, 0.25));
        border-top: 0.25rem solid var(--agilo-primary, #174a96);
        border-radius: 50%;
        animation: agilo-spin 1s linear infinite;
      }
      @keyframes agilo-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes agilo-fadeIn {
        from { opacity: 0; transform: translateY(0.625rem); }
        to { opacity: 1; transform: translateY(0); }
      }
      @media (prefers-reduced-motion: reduce) {
        .summary-loading-indicator { animation: none; }
        .summary-loading-indicator .lottie-fallback { animation: none; }
      }
      .summary-loading-indicator .loading-text {
        font: 500 1rem/1.35 system-ui, -apple-system, Segoe UI, Roboto, Arial;
        color: var(--agilo-text, var(--color--gris_foncé, #020202));
        margin-top: 0.5rem;
        margin-bottom: 0.25rem;
      }
      .summary-loading-indicator .loading-subtitle {
        font: 400 0.875rem/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial;
        color: var(--agilo-dim, var(--color--gris, #525252));
        margin-top: 0.5rem;
      }
      .regeneration-cancel-info {
        padding: 1rem;
        background: color-mix(in srgb, var(--agilo-primary, #174a96) 8%, var(--agilo-surface, #ffffff) 92%);
        border: 1px solid color-mix(in srgb, var(--agilo-primary, #174a96) 25%, transparent);
        border-radius: var(--agilo-radius, 0.5rem);
        margin-top: 1rem;
      }
      .regeneration-cancel-info strong {
        color: var(--agilo-primary, #174a96);
        display: block;
        margin-bottom: 0.5rem;
        font-size: 0.875rem;
      }
      .regeneration-cancel-info p {
        font-size: 0.8125rem;
        color: var(--agilo-dim, #525252);
        margin: 0 0 0.5rem;
        line-height: 1.5;
      }
      .loading-countdown {
        font-size: 1.75rem;
        font-weight: 700;
        margin: 1.25rem 0 0.75rem;
        color: var(--agilo-primary, #174a96);
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.04em;
        font-family: ui-monospace, Menlo, monospace;
      }
      .loading-cancel-btn {
        margin-top: 1.25rem;
        cursor: pointer;
        padding: 0.625rem 1.25rem;
        border-radius: var(--agilo-radius, 0.5rem);
        border: 1px solid var(--agilo-border, rgba(52, 58, 64, 0.25));
        background: var(--agilo-text, #020202);
        color: var(--agilo-surface, #ffffff);
        font: 500 0.875rem/1.4 system-ui, -apple-system, Arial, sans-serif;
        transition: all 0.15s ease;
        user-select: none;
      }
      .loading-cancel-btn:hover {
        background: color-mix(in srgb, var(--agilo-text, #020202) 90%, transparent);
        transform: translateY(0.0625rem);
      }
      .loading-cancel-btn:active {
        transform: translateY(0.125rem);
      }
      .loading-cancel-btn:focus-visible {
        outline: var(--agilo-focus, 0.125rem solid color-mix(in srgb, var(--agilo-primary) 70%, transparent));
        outline-offset: 0.125rem;
      }
      @media (max-width: 40rem) {
        .summary-loading-indicator {
          padding: 2.5rem 1rem;
          min-height: 15rem;
        }
        .summary-loading-indicator #loading-summary,
        .summary-loading-indicator #loading-summary-clone {
          width: 4.5rem;
          height: 4.5rem;
          margin: 0 auto 1.25rem;
        }
        .loading-countdown {
          font-size: 1.5rem;
          margin: 1rem 0 0.5rem;
        }
        .summary-loading-indicator .loading-text {
          font-size: 0.9375rem;
        }
        .summary-loading-indicator .loading-subtitle {
          font-size: 0.8125rem;
        }
        .loading-cancel-btn {
          padding: 0.5rem 1rem;
          font-size: 0.8125rem;
        }
      }
      .regeneration-counter {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--agilo-dim, #525252);
        margin-top: 0.375rem;
        padding: 0.3125rem 0.625rem;
        border-radius: var(--agilo-radius, 0.5rem);
        background: var(--agilo-surface-2, #f8f9fa);
        border: 1px solid var(--agilo-border, rgba(52, 58, 64, 0.25));
        transition: all 0.15s ease;
      }
      .regeneration-counter:hover {
        background: color-mix(in srgb, var(--agilo-surface-2, #f8f9fa) 86%, var(--agilo-primary, #174a96) 14%);
        border-color: var(--agilo-border, rgba(52, 58, 64, 0.35));
      }
      .regeneration-counter.has-warning {
        color: var(--color--orange, #fd7e14);
        background: color-mix(in srgb, var(--color--orange, #fd7e14) 8%, var(--agilo-surface, #ffffff) 92%);
        border-color: color-mix(in srgb, var(--color--orange, #fd7e14) 25%, var(--agilo-border, rgba(52, 58, 64, 0.25)) 75%);
      }
      .regeneration-limit-message {
        display: flex;
        gap: 0.625rem;
        padding: 0.625rem 0.75rem;
        margin-top: 0.5rem;
        border-radius: var(--agilo-radius, 0.5rem);
        font-size: 0.8125rem;
        background: color-mix(in srgb, var(--color--orange, #fd7e14) 8%, var(--agilo-surface, #ffffff) 92%);
        border: 1px solid color-mix(in srgb, var(--color--orange, #fd7e14) 25%, var(--agilo-border, rgba(52, 58, 64, 0.25)) 75%);
        box-shadow: 0 0.0625rem 0.125rem color-mix(in srgb, var(--color--orange, #fd7e14) 10%, transparent);
      }
      .regeneration-limit-icon {
        font-size: 1rem;
        line-height: 1;
        flex-shrink: 0;
      }
      .regeneration-limit-content {
        flex: 1;
        text-align: left;
      }
      .regeneration-limit-message strong {
        color: var(--color--orange, #fd7e14);
        font-weight: 600;
        display: block;
        margin-bottom: 0.125rem;
        font-size: 0.8125rem;
      }
      .regeneration-limit-detail {
        font-size: 0.75rem;
        color: var(--agilo-dim, #525252);
        margin-top: 0.125rem;
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

