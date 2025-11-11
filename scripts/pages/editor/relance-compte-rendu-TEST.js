// Agilotext – Relance Compte-Rendu (VERSION FINALE PROPRE)
(function() {
  'use strict';
  
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
  
  // ============================================
  // VÉRIFICATION EXISTENCE COMPTE-RENDU
  // ============================================
  
  /**
   * Vérifier si un compte-rendu existe déjà pour ce jobId
   * Utilise receiveSummary directement (comme dans le script staging qui fonctionne)
   */
  async function checkSummaryExists(jobId, email, token, edition) {
    try {
      const url = `https://api.agilotext.com/api/v1/receiveSummary?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}&format=html`;
      
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit'
      });
      
      console.log('[AGILO:RELANCE] Vérification existence compte-rendu:', {
        status: response.status,
        ok: response.ok
      });
      
      if (response.ok) {
        const text = await response.text();
        // Vérifier que ce n'est pas un message d'erreur
        const isError = text.includes('pas encore disponible') || 
                       text.includes('non publié') || 
                       text.includes('fichier manquant');
        
        return !isError && text.length > 100; // Au moins 100 caractères pour être valide
      }
      
      return false;
    } catch (error) {
      console.error('[AGILO:RELANCE] Erreur vérification existence:', error);
      return false;
    }
  }
  
  /**
   * Vérifier si la régénération est possible (compte-rendu existe)
   */
  async function checkIfRegenerationPossible(jobId, edition) {
    try {
      const creds = await ensureCreds();
      if (!creds.email || !creds.token) {
        return { possible: false, reason: 'no-credentials' };
      }
      
      const exists = await checkSummaryExists(jobId, creds.email, creds.token, edition);
      if (!exists) {
        return { possible: false, reason: 'no-summary' };
      }
      
      return { possible: true };
    } catch (e) {
      console.error('[AGILO:RELANCE] Erreur vérification régénération possible:', e);
      return { possible: false, reason: 'error' };
    }
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
    
    const oldMessage = btn.parentElement.querySelector('.regeneration-limit-message, .regeneration-premium-message, .regeneration-no-summary-message');
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
  
  // ============================================
  // FONCTIONS UI
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
        border-radius: 4px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 10000;
        max-width: 400px;
      `;
      document.body.appendChild(toast);
      
      setTimeout(() => toast.remove(), 4000);
    }
  }
  
  function getButtonText() {
    const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
    if (activeTab?.id === 'tab-summary') return 'Régénérer';
    if (activeTab?.id === 'tab-transcript' && transcriptModified) return 'Régénérer compte-rendu';
    return 'Relancer';
  }
  
  // ============================================
  // VISIBILITÉ DU BOUTON (AVEC VÉRIFICATION COMPTE-RENDU)
  // ============================================
  
  async function updateButtonVisibility() {
    const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
    if (!btn) return;
    
    const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
    if (!activeTab) return;
    
    const isSummaryTab = activeTab.id === 'tab-summary';
    const isTranscriptTab = activeTab.id === 'tab-transcript';
    
    const textDiv = btn.querySelector('div');
    if (textDiv) textDiv.textContent = getButtonText();
    
    // Cacher aussi le compteur/message si le bouton est caché
    const counter = btn.parentElement.querySelector('.regeneration-counter, .regeneration-limit-message, .regeneration-premium-message, .regeneration-no-summary-message');
    
    // ⚠️ PRIORITÉ 1 : Vérifier si un compte-rendu existe avant d'afficher le bouton
    // (Logique exacte du script staging qui fonctionne)
    try {
      const creds = await ensureCreds();
      if (creds.jobId && creds.email && creds.token) {
        const summaryExists = await checkSummaryExists(creds.jobId, creds.email, creds.token, creds.edition);
        
        // Si aucun compte-rendu n'existe, cacher le bouton et RETOURNER IMMÉDIATEMENT
        if (!summaryExists) {
          console.log('[AGILO:RELANCE] ⚠️ Aucun compte-rendu détecté - Bouton caché');
          btn.style.display = 'none';
          if (counter) counter.style.display = 'none';
          return; // ⚠️ IMPORTANT : Retour immédiat pour ne pas continuer avec la logique normale
        }
      }
    } catch (error) {
      console.error('[AGILO:RELANCE] Erreur vérification compte-rendu:', error);
      // En cas d'erreur, on continue avec la logique normale (ne pas bloquer)
    }
    
    // Gérer la visibilité (si compte-rendu existe)
    if (isSummaryTab) {
      btn.style.display = 'flex';
      if (counter) counter.style.display = '';
    } else if (isTranscriptTab && transcriptModified) {
      btn.style.display = 'flex';
      if (counter) counter.style.display = '';
    } else {
      btn.style.display = 'none';
      if (counter) counter.style.display = 'none';
    }
  }
  
  // ============================================
  // FONCTION PRINCIPALE (VERSION SIMPLIFIÉE)
  // ============================================
  
  async function relancerCompteRendu() {
    console.log('[AGILO:RELANCE] 🚀 Début régénération (VERSION SIMPLIFIÉE SELON NICOLAS)');
    
    if (isGenerating) {
      console.warn('[AGILO:RELANCE] Déjà en cours');
      return;
    }
    
    isGenerating = true;
    
    let creds;
    try {
      creds = await ensureCreds();
    } catch (err) {
      isGenerating = false;
      alert('❌ Erreur credentials');
      return;
    }
    
    const { email, token, edition, jobId } = creds;
    
    if (!email || !token || !jobId) {
      isGenerating = false;
      alert('❌ Informations incomplètes');
      return;
    }
    
    const canRegen = canRegenerate(jobId, edition);
    
    if (!canRegen.allowed) {
      isGenerating = false;
      if (canRegen.reason === 'free') {
        if (typeof window.AgiloGate !== 'undefined' && window.AgiloGate.showUpgrade) {
          window.AgiloGate.showUpgrade('pro', 'Régénération de compte-rendu');
        } else {
          alert('🔒 Fonctionnalité Premium');
        }
      } else {
        alert(`⚠️ Limite atteinte: ${canRegen.count}/${canRegen.limit}`);
      }
      return;
    }
    
    const confirmed = confirm(
      `Remplacer le compte-rendu actuel ?\n\n` +
      `${canRegen.remaining}/${canRegen.limit} régénération(s) restante(s).\n\n` +
      `⏳ La page se rechargera automatiquement après 2 min 30.`
    );
    
    if (!confirmed) {
      isGenerating = false;
      return;
    }
    
    try {
      // ✅ APPEL redoSummary (GET)
      const url = `https://api.agilotext.com/api/v1/redoSummary?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}`;
      
      console.log('[AGILO:RELANCE] 🚀 Appel redoSummary...');
      
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit'
      });
      
      const result = await response.json();
      
      if (result.status === 'OK' || response.ok) {
        console.log('[AGILO:RELANCE] ✅ redoSummary OK - Incrémentation compteur');
        incrementRegenerationCount(jobId, edition);
        
        showSuccessMessage('Régénération lancée...');
        
        // ✅ AFFICHER LE LOADER
        openSummaryTab();
        showSummaryLoading();
        
        // ⏳ COMPTE À REBOURS 2 MIN 30
        const loaderContainer = document.querySelector('.summary-loading-indicator');
        
        if (loaderContainer) {
          const countdown = document.createElement('p');
          countdown.className = 'loading-countdown';
          countdown.style.cssText = `
            font-size: 32px;
            font-weight: 700;
            margin: 20px 0 10px;
            color: #174a96;
            font-variant-numeric: tabular-nums;
            letter-spacing: 0.05em;
          `;
          loaderContainer.appendChild(countdown);
          
          let secondsLeft = 150; // 2 min 30
          
          const updateCountdown = () => {
            const minutes = Math.floor(secondsLeft / 60);
            const seconds = secondsLeft % 60;
            countdown.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            if (secondsLeft <= 0) {
              countdown.textContent = 'Rechargement...';
              
              // ✅ RECHARGER LA PAGE
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
          
          // BOUTON ANNULER
          const cancelBtn = document.createElement('button');
          cancelBtn.className = 'button';
          cancelBtn.textContent = 'Annuler';
          cancelBtn.style.cssText = 'margin-top: 20px; cursor: pointer;';
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
        alert('⚠️ Une génération est déjà en cours.');
      } else {
        isGenerating = false;
        alert('❌ Erreur: ' + (result.message || result.error || 'Inconnue'));
      }
      
    } catch (err) {
      isGenerating = false;
      alert('❌ Erreur réseau');
    }
  }
  
  // ============================================
  // INITIALISATION
  // ============================================
  
  function init() {
    if (window.__agiloRelanceInitialized) return;
    window.__agiloRelanceInitialized = true;
    
    document.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-action="relancer-compte-rendu"]');
      if (btn && !btn.disabled) {
        e.preventDefault();
        e.stopPropagation();
        relancerCompteRendu();
      }
    });
    
    const tabs = document.querySelectorAll('[role="tab"]');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => setTimeout(updateButtonVisibility, 100));
    });
    
    updateButtonVisibility();
    
    // Initialiser les compteurs et limites (avec vérification compte-rendu)
    const initLimits = async () => {
      try {
        const creds = await ensureCreds();
        const { edition, jobId } = creds;
        if (jobId && edition) {
          updateRegenerationCounter(jobId, edition);
          updateButtonState(jobId, edition);
          
          // ⚠️ Vérifier si un compte-rendu existe (pour désactiver le bouton si nécessaire)
          // (Logique copiée du script staging qui fonctionne)
          const canRegen = await checkIfRegenerationPossible(jobId, edition);
          if (!canRegen.possible && canRegen.reason === 'no-summary') {
            const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
            if (btn) {
              btn.disabled = true;
              btn.setAttribute('aria-disabled', 'true');
              btn.title = 'Générez d\'abord un compte-rendu via le formulaire d\'upload pour pouvoir le régénérer';
              
              // Ajouter un message informatif
              const infoMsg = btn.parentElement.querySelector('.regeneration-no-summary-message');
              if (!infoMsg) {
                const msg = document.createElement('div');
                msg.className = 'regeneration-no-summary-message';
                msg.innerHTML = `
                  <span style="font-size: 16px;">ℹ️</span>
                  <div>
                    <strong>Générez d'abord un compte-rendu</strong>
                    <div style="font-size: 12px; margin-top: 2px; color: var(--agilo-dim, #525252);">
                      Utilisez le formulaire d'upload avec l'option "Générer le compte-rendu" activée
                    </div>
                  </div>
                `;
                btn.parentElement.appendChild(msg);
              }
            }
          }
          
          // Mettre à jour la visibilité après initialisation des compteurs
          updateButtonVisibility();
        }
      } catch (e) {
        console.log('[AGILO:RELANCE] Limites non initialisées:', e);
      }
    };
    
    // Attendre un peu que les credentials soient disponibles
    setTimeout(initLimits, 500);
  }
  
  // STYLES CSS - Design professionnel inspiré du style Agilotext
  if (!document.querySelector('#relance-summary-styles')) {
    const style = document.createElement('style');
    style.id = 'relance-summary-styles';
    style.textContent = `
      /* Import de la police Inter si disponible */
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      
      /* Variables de couleurs (style Agilotext) */
      :root {
        --agilo-primary: #174a96;
        --agilo-primary-light: rgba(23, 74, 150, 0.1);
        --agilo-primary-border: rgba(23, 74, 150, 0.25);
        --agilo-text: #020202;
        --agilo-text-secondary: #525252;
        --agilo-text-muted: #666;
        --agilo-surface: #ffffff;
        --agilo-surface-2: #f8f9fa;
        --agilo-border: rgba(0, 0, 0, 0.12);
        --agilo-warning: #fd7e14;
        --agilo-warning-light: rgba(253, 126, 20, 0.1);
        --agilo-warning-border: rgba(253, 126, 20, 0.35);
        --agilo-info: #2196f3;
        --agilo-info-light: rgba(33, 150, 243, 0.1);
        --agilo-info-border: rgba(33, 150, 243, 0.35);
        --agilo-success: #4caf50;
        --agilo-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        --agilo-shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.12);
      }
      
      /* Conteneur de chargement - Design épuré et moderne */
      .summary-loading-indicator {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 80px 40px;
        text-align: center;
        min-height: 400px;
        background: var(--agilo-surface);
        color: var(--agilo-text);
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        border-radius: 12px;
        box-shadow: var(--agilo-shadow);
        margin: 20px 0;
      }
      
      /* Animation Lottie - Taille optimisée */
      .summary-loading-indicator #loading-summary,
      .summary-loading-indicator #loading-summary-clone {
        width: 100px;
        height: 100px;
        margin: 0 auto 32px;
        filter: drop-shadow(0 4px 8px rgba(23, 74, 150, 0.15));
      }
      
      /* Texte de chargement - Typographie moderne */
      .summary-loading-indicator .loading-text {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 18px;
        font-weight: 600;
        line-height: 1.5;
        color: var(--agilo-text);
        margin: 0 0 8px;
        letter-spacing: -0.01em;
      }
      
      .summary-loading-indicator .loading-subtitle {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 15px;
        font-weight: 400;
        line-height: 1.6;
        color: var(--agilo-text-secondary);
        margin: 8px 0 0;
      }
      
      /* Compte à rebours - Design premium */
      .loading-countdown {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 48px;
        font-weight: 700;
        margin: 32px 0 16px;
        color: var(--agilo-primary);
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.05em;
        text-shadow: 0 2px 4px rgba(23, 74, 150, 0.1);
        background: linear-gradient(135deg, var(--agilo-primary) 0%, #1e5fb8 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      
      /* Compteur de régénérations - Badge moderne */
      .regeneration-counter {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        font-weight: 500;
        color: var(--agilo-text-secondary);
        margin-top: 10px;
        padding: 8px 14px;
        border-radius: 8px;
        background: var(--agilo-surface-2);
        border: 1px solid var(--agilo-border);
        box-shadow: var(--agilo-shadow);
        transition: all 0.2s ease;
        letter-spacing: -0.01em;
      }
      
      .regeneration-counter:hover {
        box-shadow: var(--agilo-shadow-lg);
        transform: translateY(-1px);
      }
      
      .regeneration-counter.has-warning {
        color: var(--agilo-warning);
        background: var(--agilo-warning-light);
        border-color: var(--agilo-warning-border);
      }
      
      /* Messages d'information - Design professionnel */
      .regeneration-limit-message,
      .regeneration-premium-message,
      .regeneration-no-summary-message {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        padding: 16px 20px;
        margin-top: 12px;
        border-radius: 10px;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.6;
        color: var(--agilo-text);
        box-shadow: var(--agilo-shadow);
        transition: all 0.2s ease;
        border-left: 4px solid;
      }
      
      .regeneration-limit-message {
        background: var(--agilo-warning-light);
        border-color: var(--agilo-warning);
        border-left-color: var(--agilo-warning);
      }
      
      .regeneration-premium-message {
        background: var(--agilo-primary-light);
        border-color: var(--agilo-primary);
        border-left-color: var(--agilo-primary);
      }
      
      .regeneration-no-summary-message {
        background: var(--agilo-info-light);
        border-color: var(--agilo-info);
        border-left-color: var(--agilo-info);
      }
      
      .regeneration-limit-message strong,
      .regeneration-premium-message strong,
      .regeneration-no-summary-message strong {
        display: block;
        margin-bottom: 4px;
        font-weight: 600;
        font-size: 15px;
        color: var(--agilo-text);
      }
      
      .regeneration-limit-message div,
      .regeneration-premium-message div,
      .regeneration-no-summary-message div {
        flex: 1;
      }
      
      .regeneration-limit-message span,
      .regeneration-premium-message span,
      .regeneration-no-summary-message span {
        font-size: 20px;
        line-height: 1;
        margin-top: 2px;
      }
      
      /* Toast de succès - Animation fluide */
      .agilo-toast-success {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        line-height: 1.5;
        padding: 16px 24px;
        border-radius: 10px;
        box-shadow: var(--agilo-shadow-lg);
        animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }
      
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
      
      /* Bouton annuler - Style cohérent */
      .cancel-polling-btn {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        padding: 10px 20px;
        border-radius: 8px;
        transition: all 0.2s ease;
        box-shadow: var(--agilo-shadow);
      }
      
      .cancel-polling-btn:hover {
        box-shadow: var(--agilo-shadow-lg);
        transform: translateY(-1px);
      }
      
      /* Responsive mobile */
      @media (max-width: 560px) {
        .summary-loading-indicator {
          padding: 60px 24px;
          min-height: 300px;
        }
        
        .loading-countdown {
          font-size: 36px;
        }
        
        .regeneration-counter {
          font-size: 12px;
          padding: 6px 12px;
        }
        
        .regeneration-limit-message,
        .regeneration-premium-message,
        .regeneration-no-summary-message {
          padding: 12px 16px;
          font-size: 13px;
        }
      }
      
      /* Accessibilité : Focus visible */
      [data-action="relancer-compte-rendu"]:focus-visible {
        outline: 2px solid var(--agilo-primary);
        outline-offset: 2px;
        border-radius: 4px;
      }
      
      /* Respecte "réduire les animations" */
      @media (prefers-reduced-motion: reduce) {
        .summary-loading-indicator,
        .agilo-toast-success,
        .regeneration-counter,
        .cancel-polling-btn {
          animation: none;
          transition: none;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  window.relancerCompteRendu = relancerCompteRendu;
  
  console.log('[AGILO:RELANCE] ✅ Script chargé (VERSION FINALE PROPRE)');
})();
