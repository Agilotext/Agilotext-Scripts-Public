// Agilotext – Relance Compte-Rendu (VERSION FINALE AVEC VISIBILITÉ + POLLING INTELLIGENT)
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
  let lastSummaryHash = null; // Hash du dernier compte-rendu affiché
  
  // ============================================
  // LOGIQUE DE VISIBILITÉ DU BOUTON (DU SCRIPT SIMPLE)
  // ============================================
  
  const EXACT_ERROR_MESSAGE = "Le compte-rendu n'est pas encore disponible (fichier manquant/non publié).";
  
  function hasErrorMessageInDOM() {
    const root = document.querySelector('#editorRoot');
    
    // PRIORITÉ 1 : summaryEmpty=1 (le plus fiable)
    if (root?.dataset.summaryEmpty === '1') {
      return true;
    }
    
    // PRIORITÉ 2 : Message d'erreur dans le DOM
    const summaryEl = document.querySelector('#summaryEditor') || 
                      document.querySelector('#ag-summary') || 
                      document.querySelector('[data-editor="summary"]');
    
    if (!summaryEl) return false;
    
    const text = (summaryEl.textContent || summaryEl.innerText || '').trim();
    const html = (summaryEl.innerHTML || '').trim();
    const lowerText = text.toLowerCase();
    const lowerHtml = html.toLowerCase();
    const exactLower = EXACT_ERROR_MESSAGE.toLowerCase();
    
    // Vérifier le message exact
    if (lowerText.includes(exactLower) || lowerHtml.includes(exactLower)) {
      return true;
    }
    
    // Vérifier les patterns d'erreur (seulement si le contenu est court)
    if (text.length < 200 && (
      lowerText.includes('pas encore disponible') || 
      lowerText.includes('fichier manquant') ||
      lowerText.includes('non publié')
    )) {
      return true;
    }
    
    return false;
  }
  
  function shouldHideButton() {
    return hasErrorMessageInDOM();
  }
  
  function hideButton(btn, reason = '') {
    if (!btn) return;
    btn.style.setProperty('display', 'none', 'important');
    btn.style.setProperty('visibility', 'hidden', 'important');
    btn.style.setProperty('opacity', '0', 'important');
    btn.style.setProperty('pointer-events', 'none', 'important');
    btn.setAttribute('hidden', 'true');
    btn.setAttribute('aria-hidden', 'true');
    btn.disabled = true;
    
    // Cacher aussi le compteur
    const counter = btn.parentElement?.querySelector('.regeneration-counter, #regeneration-info');
    if (counter) {
      counter.style.setProperty('display', 'none', 'important');
      counter.style.setProperty('visibility', 'hidden', 'important');
    }
  }
  
  function showButton(btn, reason = '') {
    if (!btn) return;
    btn.style.removeProperty('display');
    btn.style.removeProperty('visibility');
    btn.style.removeProperty('opacity');
    btn.style.removeProperty('pointer-events');
    btn.removeAttribute('hidden');
    btn.removeAttribute('aria-hidden');
    
    // Réafficher le compteur si nécessaire
    const counter = btn.parentElement?.querySelector('.regeneration-counter, #regeneration-info');
    if (counter) {
      counter.style.removeProperty('display');
      counter.style.removeProperty('visibility');
    }
  }
  
  // Cache d'état pour éviter appels inutiles
  let lastButtonState = null; // 'hidden' ou 'visible'
  
  function updateButtonVisibility() {
    const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
    if (!btn) return;
    
    const shouldHide = shouldHideButton();
    const currentState = shouldHide ? 'hidden' : 'visible';
    
    // Ne rien faire si l'état n'a pas changé
    if (lastButtonState === currentState) {
      return;
    }
    
    lastButtonState = currentState;
    
    if (shouldHide) {
      hideButton(btn, 'message erreur ou summaryEmpty=1');
    } else {
      showButton(btn, 'compte-rendu disponible');
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
  
  // ============================================
  // HASH DE CONTENU POUR DÉTECTER LES CHANGEMENTS
  // ============================================
  
  function getContentHash(text) {
    if (!text || typeof text !== 'string') return '';
    const s = text.trim();
    if (s.length === 0) return '';
    const head = s.substring(0, 100);
    const tail = s.substring(Math.max(0, s.length - 100));
    return `${s.length}:${head.slice(0, 40)}:${tail.slice(-40)}`;
  }
  
  function getCurrentSummaryHash() {
    const summaryEl = document.querySelector('#summaryEditor') || 
                      document.querySelector('#ag-summary') || 
                      document.querySelector('[data-editor="summary"]');
    if (!summaryEl) return null;
    const text = (summaryEl.textContent || summaryEl.innerText || '').trim();
    return getContentHash(text);
  }
  
  // ============================================
  // POLLING INTELLIGENT POUR LE NOUVEAU COMPTE-RENDU
  // ============================================
  
  async function getTranscriptStatus(jobId, email, token, edition) {
    try {
      const url = `https://api.agilotext.com/api/v1/getTranscriptStatus?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}`;
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit'
      });
      
      if (!response.ok) return null;
      
      const result = await response.json();
      if (result.status === 'OK' && result.transcriptStatus) {
        return result.transcriptStatus;
      }
      return null;
    } catch (e) {
      return null;
    }
  }
  
  async function fetchSummary(jobId, email, token, edition) {
    try {
      const url = `https://api.agilotext.com/api/v1/receiveSummary?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}&format=html&_t=${Date.now()}`;
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        return { ok: false, status: response.status };
      }
      
      const html = await response.text();
      
      // Vérifier que ce n'est pas un message d'erreur
      const lowerHtml = html.toLowerCase();
      if (lowerHtml.includes('pas encore disponible') || 
          lowerHtml.includes('fichier manquant') || 
          lowerHtml.includes('non publié')) {
        return { ok: false, error: 'ERROR_MESSAGE' };
      }
      
      return { ok: true, html, hash: getContentHash(html) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  
  async function pollForNewSummary(jobId, email, token, edition, oldHash, maxAttempts = 60) {
    console.log('[AGILO:RELANCE] 🔄 Début polling pour nouveau compte-rendu (hash actuel:', oldHash, ')');
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Vérifier le statut d'abord
      const status = await getTranscriptStatus(jobId, email, token, edition);
      console.log(`[AGILO:RELANCE] Tentative ${attempt + 1}/${maxAttempts} - Statut:`, status);
      
      if (status === 'READY_SUMMARY_READY') {
        // Le compte-rendu est prêt, récupérer le contenu
        const result = await fetchSummary(jobId, email, token, edition);
        
        if (result.ok && result.hash) {
          // Vérifier que le hash a changé (nouveau compte-rendu)
          if (result.hash !== oldHash) {
            console.log('[AGILO:RELANCE] ✅ NOUVEAU compte-rendu détecté ! Hash:', result.hash, '(ancien:', oldHash, ')');
            return { ok: true, html: result.html, hash: result.hash };
          } else {
            console.log('[AGILO:RELANCE] ⏳ Compte-rendu prêt mais hash identique (encore l\'ancien), attente...');
          }
        }
      } else if (status === 'READY_SUMMARY_PENDING') {
        console.log('[AGILO:RELANCE] ⏳ Compte-rendu en cours de génération...');
      } else if (status === 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS') {
        console.log('[AGILO:RELANCE] ❌ Erreur: fichier transcript manquant');
        return { ok: false, error: 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS' };
      }
      
      // Attendre avant la prochaine tentative
      await new Promise(r => setTimeout(r, 5000)); // 5 secondes entre chaque tentative
    }
    
    console.log('[AGILO:RELANCE] ⚠️ Timeout: nouveau compte-rendu non détecté après', maxAttempts, 'tentatives');
    return { ok: false, error: 'TIMEOUT' };
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
      loadingSubtitle.textContent = 'Recherche du nouveau compte-rendu...';
      
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
  
  function updateLoadingStatus(message) {
    const subtitle = document.querySelector('.loading-subtitle');
    if (subtitle) {
      subtitle.textContent = message;
    }
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
  
  // ============================================
  // FONCTION PRINCIPALE (AVEC POLLING INTELLIGENT)
  // ============================================
  
  async function relancerCompteRendu() {
    console.log('[AGILO:RELANCE] 🚀 Début régénération (VERSION FINALE AVEC POLLING)');
    
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
    
    // Récupérer le hash du compte-rendu actuel AVANT la régénération
    const oldHash = getCurrentSummaryHash();
    console.log('[AGILO:RELANCE] Hash du compte-rendu actuel:', oldHash);
    
    const confirmed = confirm(
      `Remplacer le compte-rendu actuel ?\n\n` +
      `${canRegen.remaining}/${canRegen.limit} régénération(s) restante(s).\n\n` +
      `⏳ Le nouveau compte-rendu sera détecté automatiquement.`
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
        updateLoadingStatus('Lancement de la régénération...');
        
        // ✅ POLLING INTELLIGENT : Attendre le VRAI nouveau compte-rendu
        setTimeout(async () => {
          updateLoadingStatus('Recherche du nouveau compte-rendu...');
          
          const pollResult = await pollForNewSummary(jobId, email, token, edition, oldHash, 60); // Max 5 minutes (60 * 5s)
          
          if (pollResult.ok && pollResult.html) {
            // ✅ NOUVEAU COMPTE-RENDU DÉTECTÉ !
            console.log('[AGILO:RELANCE] ✅ Affichage du nouveau compte-rendu');
            
            const summaryEditor = document.querySelector('#summaryEditor');
            if (summaryEditor) {
              summaryEditor.innerHTML = pollResult.html;
              lastSummaryHash = pollResult.hash; // Mettre à jour le hash
              
              // Mettre à jour editorRoot
              const root = document.querySelector('#editorRoot');
              if (root) {
                root.dataset.summaryEmpty = '0';
              }
              
              hideSummaryLoading();
              showSuccessMessage('Nouveau compte-rendu généré avec succès !');
              
              // Mettre à jour la visibilité du bouton
              lastButtonState = null; // Reset cache
              updateButtonVisibility();
            }
          } else {
            // ⚠️ Timeout ou erreur
            hideSummaryLoading();
            const errorMsg = pollResult.error === 'TIMEOUT' 
              ? 'Le compte-rendu prend plus de temps que prévu. Rechargez la page dans quelques minutes.'
              : 'Erreur lors de la récupération du nouveau compte-rendu.';
            
            alert('⚠️ ' + errorMsg);
            
            // Recharger la page pour voir l'état actuel
            setTimeout(() => {
              const newUrl = new URL(window.location.href);
              newUrl.searchParams.set('tab', 'summary');
              newUrl.searchParams.set('_t', Date.now());
              window.location.href = newUrl.toString();
            }, 2000);
          }
          
          isGenerating = false;
        }, 2000); // Attendre 2 secondes avant de commencer le polling
        
      } else if (result.status === 'KO') {
        isGenerating = false;
        alert('⚠️ Une génération est déjà en cours.');
      } else {
        isGenerating = false;
        alert('❌ Erreur: ' + (result.message || result.error || 'Inconnue'));
      }
      
    } catch (err) {
      isGenerating = false;
      console.error('[AGILO:RELANCE] Erreur:', err);
      alert('❌ Erreur réseau');
    }
  }
  
  function getButtonText() {
    const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
    if (activeTab?.id === 'tab-summary') return 'Régénérer';
    if (activeTab?.id === 'tab-transcript' && transcriptModified) return 'Régénérer compte-rendu';
    return 'Relancer';
  }
  
  // ============================================
  // INITIALISATION
  // ============================================
  
  function init() {
    if (window.__agiloRelanceFinalInitialized) return;
    window.__agiloRelanceFinalInitialized = true;
    
    // Enregistrer le hash initial du compte-rendu
    lastSummaryHash = getCurrentSummaryHash();
    
    // Gestionnaire de clic
    document.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-action="relancer-compte-rendu"]');
      if (btn && !btn.disabled) {
        e.preventDefault();
        e.stopPropagation();
        relancerCompteRendu();
      }
    });
    
    // Mise à jour de la visibilité du bouton
    updateButtonVisibility();
    
    // Observer les changements de summaryEmpty
    const root = document.querySelector('#editorRoot');
    if (root) {
      const observer = new MutationObserver(() => {
        lastButtonState = null; // Reset cache
        updateButtonVisibility();
      });
      observer.observe(root, { attributes: true, attributeFilter: ['data-summary-empty'] });
    }
    
    // Observer les changements dans summaryEditor
    const summaryEl = document.querySelector('#summaryEditor') || 
                      document.querySelector('#ag-summary') || 
                      document.querySelector('[data-editor="summary"]');
    if (summaryEl) {
      const observer = new MutationObserver(() => {
        lastButtonState = null; // Reset cache
        updateButtonVisibility();
      });
      observer.observe(summaryEl, { childList: true, subtree: true, characterData: true });
    }
    
    // Écouter agilo:load
    window.addEventListener('agilo:load', () => {
      lastButtonState = null; // Reset cache
      lastSummaryHash = getCurrentSummaryHash(); // Mettre à jour le hash
      updateButtonVisibility();
    });
    
    // Vérification périodique (toutes les 1000ms)
    setInterval(updateButtonVisibility, 1000);
    
    // Initialisation des compteurs et états
    setTimeout(async () => {
      try {
        const creds = await ensureCreds();
        if (creds.jobId && creds.edition) {
          updateRegenerationCounter(creds.jobId, creds.edition);
          updateButtonState(creds.jobId, creds.edition);
          updateButtonVisibility();
        }
      } catch (e) {}
    }, 500);
  }
  
  // STYLES CSS
  if (!document.querySelector('#relance-summary-styles')) {
    const style = document.createElement('style');
    style.id = 'relance-summary-styles';
    style.textContent = `
      .summary-loading-indicator {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        text-align: center;
        min-height: 300px;
        background: #ffffff;
        color: #020202;
      }
      
      .summary-loading-indicator #loading-summary,
      .summary-loading-indicator #loading-summary-clone {
        width: 88px;
        height: 88px;
        margin: 0 auto 24px;
      }
      
      .summary-loading-indicator .loading-text {
        font: 500 16px/1.35 system-ui, Arial;
        margin: 8px 0 4px;
      }
      
      .summary-loading-indicator .loading-subtitle {
        font: 400 14px/1.4 system-ui, Arial;
        color: #525252;
        margin-top: 8px;
      }
      
      .regeneration-counter {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        font-weight: 500;
        color: #525252;
        margin-top: 6px;
        padding: 4px 8px;
        border-radius: 4px;
        background: #f8f9fa;
      }
      
      .regeneration-counter.has-warning {
        color: #fd7e14;
      }
      
      .regeneration-limit-message {
        display: flex;
        gap: 10px;
        padding: 10px 12px;
        margin-top: 8px;
        border-radius: 4px;
        font-size: 13px;
        background: rgba(253, 126, 20, 0.1);
        border: 1px solid rgba(253, 126, 20, 0.35);
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
  
  console.log('[AGILO:RELANCE] ✅ Script chargé (VERSION FINALE AVEC VISIBILITÉ + POLLING)');
})();

