// Agilotext – Relance Compte-Rendu (VERSION FINALE CORRIGÉE)
// ⚠️ Ce fichier est chargé depuis GitHub
(function() {
  'use strict';
  
  const DEBUG = true;
  const log = (...args) => { if (DEBUG) console.log('[AGILO:RELANCE]', ...args); };
  const warn = (...args) => console.warn('[AGILO:RELANCE]', ...args);
  const error = (...args) => console.error('[AGILO:RELANCE]', ...args);
  
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
  // LOGIQUE PRINCIPALE
  // ============================================
  
  let transcriptModified = false;
  let isGenerating = false;
  
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
    } catch (e) {
      error('Erreur sauvegarde compteur:', e);
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
        upgradeButton = `
          <button class="button bleu" style="margin-top: 8px; width: 100%;" 
                  data-plan-min="ent" 
                  data-upgrade-reason="Régénération de compte-rendu - Limite augmentée">
            Passer en Business (4 régénérations)
          </button>`;
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
    const summaryPane = document.querySelector('#pane-summary');
    const summaryEditor = document.querySelector('#summaryEditor');
    
    if (!summaryPane || !summaryEditor) return;
    
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
      loadingSubtitle.textContent = 'Cela peut prendre quelques minutes';
      
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
      
      const lottieElement = loaderContainer.querySelector('#loading-summary, #loading-summary-clone');
      if (lottieElement) {
        setTimeout(() => initLottieAnimation(lottieElement), 100);
      }
    }
    
    loaderContainer.style.display = 'flex';
  }
  
  function hideSummaryLoading() {
    const loader = document.querySelector('.summary-loading-indicator');
    if (loader) loader.style.display = 'none';
    
    const lottieElement = document.querySelector('#loading-summary');
    if (lottieElement) lottieElement.style.display = 'none';
  }
  
  function disableEditorActions(disable) {
    const saveBtn = document.querySelector('[data-action="save-transcript"]');
    if (saveBtn) {
      saveBtn.disabled = disable;
      saveBtn.style.opacity = disable ? '0.5' : '1';
      saveBtn.style.cursor = disable ? 'not-allowed' : 'pointer';
    }
    
    const transcriptEditor = document.querySelector('#transcriptEditor');
    if (transcriptEditor) {
      if (disable) {
        transcriptEditor.setAttribute('contenteditable', 'false');
        transcriptEditor.style.opacity = '0.7';
        transcriptEditor.style.pointerEvents = 'none';
      } else {
        transcriptEditor.setAttribute('contenteditable', 'true');
        transcriptEditor.style.opacity = '1';
        transcriptEditor.style.pointerEvents = 'auto';
      }
    }
  }
  
  async function getTranscriptStatus(jobId, email, token, edition) {
    try {
      const url = `https://api.agilotext.com/api/v1/getTranscriptStatus?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit'
      });
      
      if (!response.ok) return null;
      
      const data = await response.json();
      
      if (data.status === 'OK' && data.transcriptStatus) {
        return data.transcriptStatus;
      }
      
      if (data.status === 'KO') {
        if (data.errorMessage && /ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS/i.test(data.errorMessage)) {
          return 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS';
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
  
  function getContentHash(text) {
    const s = String(text || '');
    if (s.length < 60) return `len:${s.length}`;
    const head = s.slice(0, 180).replace(/\s+/g, '');
    const tail = s.slice(-180).replace(/\s+/g, '');
    return `${s.length}:${head.slice(0, 40)}:${tail.slice(-40)}`;
  }
  
  async function checkSummaryExists(jobId, email, token, edition) {
    try {
      const status = await getTranscriptStatus(jobId, email, token, edition);
      
      if (status === 'READY_SUMMARY_READY' || status === 'READY_SUMMARY_PENDING') {
        return true;
      }
      
      if (status === 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS') {
        return false;
      }
      
      const url = `https://api.agilotext.com/api/v1/receiveSummary?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}&format=html`;
      
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit'
      });
      
      if (response.ok) {
        const text = await response.text();
        const isError = text.includes('pas encore disponible') || 
                       text.includes('non publié') || 
                       text.includes('fichier manquant');
        
        return !isError && text.length > 100;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }
  
  // ============================================
  // POLLING INTELLIGENT (9 MINUTES MAX)
  // ============================================
  
  async function waitForSummaryReady(jobId, email, token, edition, maxAttempts = 180, delay = 3000, oldHash = '') {
    log('========================================');
    log('🎯 Début polling READY_SUMMARY_READY', {
      jobId,
      maxAttempts,
      delay,
      maxDuration: Math.round((maxAttempts * delay) / 60000) + ' minutes'
    });
    log('========================================');
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const status = await getTranscriptStatus(jobId, email, token, edition);
        
        log(`📊 Tentative ${attempt}/${maxAttempts} - Statut:`, status);
        
        if (status === 'READY_SUMMARY_READY') {
          log('✅ READY_SUMMARY_READY détecté !');
          
          try {
            const url = `https://api.agilotext.com/api/v1/receiveSummary?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}&format=html`;
            const response = await fetch(url, {
              method: 'GET',
              cache: 'no-store',
              credentials: 'omit'
            });
            
            if (response.ok) {
              const text = await response.text();
              
              if (!text || text.length < 100 || 
                  text.includes('pas encore disponible') || 
                  text.includes('non publié') || 
                  text.includes('fichier manquant')) {
                warn('Contenu invalide - Continuation du polling');
                if (attempt < maxAttempts) {
                  await new Promise(r => setTimeout(r, delay));
                }
                continue;
              }
              
              const newHash = getContentHash(text);
              
              log('Nouveau compte-rendu récupéré:', {
                contentLength: text.length,
                hashChanged: !oldHash || newHash !== oldHash
              });
              
              if (!oldHash || newHash !== oldHash) {
                log('✅ Hash différent - Nouveau compte-rendu confirmé !');
                return { ready: true, hash: newHash, content: text };
              } else {
                log('✅ READY_SUMMARY_READY confirmé');
                return { ready: true, hash: newHash, content: text };
              }
            } else {
              warn('receiveSummary HTTP error:', response.status);
              if (attempt < maxAttempts) {
                await new Promise(r => setTimeout(r, delay));
              }
              continue;
            }
          } catch (error) {
            error('Erreur récupération CR:', error);
            return { ready: true, hash: null, content: null };
          }
        }
        
        if (status === 'READY_SUMMARY_PENDING') {
          log(`⏳ READY_SUMMARY_PENDING (${attempt}/${maxAttempts})`);
        }
        
        if (status === 'READY_SUMMARY_ON_ERROR' || status === 'ON_ERROR') {
          error('❌ Erreur génération:', status);
          return { ready: false, error: status };
        }
        
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, delay));
        }
      } catch (error) {
        error(`Erreur polling (${attempt}/${maxAttempts}):`, error);
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    
    warn('⚠️ Timeout après', maxAttempts, 'tentatives');
    return { ready: false, error: 'TIMEOUT' };
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
        animation: slideInRight 0.3s ease-out;
        max-width: 400px;
      `;
      document.body.appendChild(toast);
      
      setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
      }, 4000);
    }
  }
  
  // ============================================
  // FONCTION PRINCIPALE
  // ============================================
  
  async function relancerCompteRendu() {
    log('========================================');
    log('🚀 Début régénération compte-rendu');
    log('========================================');
    
    if (isGenerating) {
      warn('Régénération déjà en cours');
      return;
    }
    
    const now = Date.now();
    if (relancerCompteRendu._lastClick && (now - relancerCompteRendu._lastClick) < 500) {
      warn('Clic trop rapide, ignoré');
      return;
    }
    relancerCompteRendu._lastClick = now;
    
    let creds;
    try {
      creds = await ensureCreds();
      log('Credentials:', {
        email: creds.email ? '✓' : '✗',
        token: creds.token ? '✓' : '✗',
        edition: creds.edition,
        jobId: creds.jobId
      });
    } catch (err) {
      error('Erreur credentials:', err);
      alert('❌ Erreur : Impossible de récupérer les informations de connexion.');
      return;
    }
    
    const { email, token, edition, jobId } = creds;
    
    if (!email || !token || !jobId) {
      error('Informations incomplètes');
      alert('❌ Erreur : Informations incomplètes.');
      return;
    }
    
    const canRegen = canRegenerate(jobId, edition);
    log('Vérification limites:', canRegen);
    
    if (!canRegen.allowed) {
      if (canRegen.reason === 'free') {
        if (typeof window.AgiloGate !== 'undefined' && window.AgiloGate.showUpgrade) {
          window.AgiloGate.showUpgrade('pro', 'Régénération de compte-rendu');
        } else {
          alert('🔒 Fonctionnalité Premium\n\nDisponible en Pro/Business.');
        }
      } else if (canRegen.reason === 'limit') {
        const planName = edition === 'ent' || edition === 'business' ? 'Business' : 'Pro';
        alert(`⚠️ Limite atteinte\n\n${canRegen.count}/${canRegen.limit} régénérations utilisées (${planName}).`);
      }
      return;
    }
    
    const confirmed = confirm(
      `Remplacer le compte-rendu actuel ?\n\n` +
      `${canRegen.remaining}/${canRegen.limit} régénération${canRegen.remaining > 1 ? 's' : ''} restante${canRegen.remaining > 1 ? 's' : ''}.\n\n` +
      `La génération peut prendre plusieurs minutes.`
    );
    
    if (!confirmed) return;
    
    log('Vérification existence compte-rendu...');
    const summaryExists = await checkSummaryExists(jobId, email, token, edition);
    
    if (!summaryExists) {
      warn('Aucun compte-rendu existant');
      const proceed = confirm(
        '⚠️ Aucun compte-rendu existant détecté.\n\n' +
        'Voulez-vous quand même essayer ?'
      );
      
      if (!proceed) return;
    }
    
    // Récupérer hash ancien CR
    let oldHash = '';
    try {
      const url = `https://api.agilotext.com/api/v1/receiveSummary?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}&format=html`;
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit'
      });
      
      if (response.ok) {
        const text = await response.text();
        if (text && !text.includes('pas encore disponible')) {
          oldHash = getContentHash(text);
          log('Hash ancien CR:', oldHash.substring(0, 30) + '...');
        }
      }
    } catch (e) {
      warn('Erreur récupération hash:', e);
    }
    
    isGenerating = true;
    const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
    const btnText = btn?.querySelector('div');
    
    if (btn) {
      btn.disabled = true;
      if (btnText) btnText.textContent = 'Génération...';
    }
    
    try {
      // ✅ APPEL API redoSummary (GET)
      const url = `https://api.agilotext.com/api/v1/redoSummary?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}`;
      
      log('🚀 Appel redoSummary (GET)');
      
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit'
      });
      
      log('Réponse HTTP:', {
        status: response.status,
        ok: response.ok
      });
      
      const result = await response.json();
      log('Réponse API:', result);
      
      if (result.status === 'OK' || response.ok) {
        const currentJobId = pickJobId();
        if (currentJobId !== jobId) {
          warn('JobId a changé pendant génération');
          isGenerating = false;
          alert('⚠️ Le transcript a changé.');
          return;
        }
        
        log('✅ Succès - Incrémentation compteur');
        incrementRegenerationCount(jobId, edition);
        
        showSuccessMessage('Régénération lancée...');
        
        // ✅ AFFICHER LE LOADER
        showSummaryLoading();
        openSummaryTab();
        
        // ✅ AJOUTER BOUTON "ANNULER"
        let pollingCancelled = false;
        const loaderContainer = document.querySelector('.summary-loading-indicator');
        
        if (loaderContainer && !loaderContainer.querySelector('.cancel-polling-btn')) {
          const cancelBtn = document.createElement('button');
          cancelBtn.className = 'button cancel-polling-btn';
          cancelBtn.textContent = 'Annuler et recharger plus tard';
          cancelBtn.style.cssText = 'margin-top: 20px; opacity: 0.8; cursor: pointer;';
          cancelBtn.onclick = () => {
            pollingCancelled = true;
            hideSummaryLoading();
            isGenerating = false;
            if (btn) {
              btn.disabled = false;
              if (btnText) btnText.textContent = 'Relancer';
            }
            disableEditorActions(false);
            showSuccessMessage('Génération en cours - Rechargez dans quelques minutes');
          };
          loaderContainer.appendChild(cancelBtn);
        }
        
        // ⏳ POLLING (180 tentatives x 3 secondes = 9 minutes max)
        log('========================================');
        log('⏳ Début polling (9 minutes max)...');
        log('========================================');
        
        const waitResult = await waitForSummaryReady(jobId, email, token, edition, 180, 3000, oldHash);
        
        log('========================================');
        log('📊 Résultat polling:', waitResult);
        log('========================================');
        
        if (pollingCancelled) {
          log('Polling annulé par utilisateur');
          return;
        }
        
        if (waitResult.ready && waitResult.content) {
          // ✅ AFFICHER LE NOUVEAU CR DIRECTEMENT
          log('✅ Nouveau CR prêt ! Affichage direct...');
          
          const summaryEditor = document.querySelector('#summaryEditor');
          if (summaryEditor) {
            // Nettoyer HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = waitResult.content;
            
            // Supprimer scripts/styles dangereux
            tempDiv.querySelectorAll('script, style, link[rel="stylesheet"], iframe, object, embed').forEach(n => n.remove());
            
            // Nettoyer attributs dangereux
            tempDiv.querySelectorAll('*').forEach(n => {
              [...n.attributes].forEach(a => {
                const name = a.name.toLowerCase();
                const val = String(a.value || '');
                if (name.startsWith('on') || /^javascript:/i.test(val)) {
                  n.removeAttribute(a.name);
                }
              });
            });
            
            summaryEditor.innerHTML = tempDiv.innerHTML;
            
            // MAJ summaryEmpty
            const root = document.querySelector('#editorRoot');
            if (root) root.dataset.summaryEmpty = '0';
            
            hideSummaryLoading();
            isGenerating = false;
            if (btn) {
              btn.disabled = false;
              if (btnText) btnText.textContent = 'Relancer';
            }
            disableEditorActions(false);
            
            showSuccessMessage('Compte-rendu régénéré avec succès !');
            
            log('✅ CR affiché directement');
          } else {
            // Fallback : recharger
            warn('summaryEditor non trouvé - Rechargement');
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('tab', 'summary');
            newUrl.searchParams.set('_t', Date.now());
            window.location.href = newUrl.toString();
          }
        } else if (waitResult.ready) {
          // READY mais pas de contenu → recharger
          log('⚠️ READY mais pas de contenu - Rechargement');
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('tab', 'summary');
          newUrl.searchParams.set('_t', Date.now());
          window.location.href = newUrl.toString();
        } else {
          // Timeout ou erreur
          warn('⚠️ Polling timeout/erreur:', waitResult.error);
          hideSummaryLoading();
          isGenerating = false;
          if (btn) {
            btn.disabled = false;
            if (btnText) btnText.textContent = 'Relancer';
          }
          disableEditorActions(false);
          
          if (waitResult.error === 'TIMEOUT') {
            alert('⚠️ La génération prend plus de temps que prévu (max 9 minutes atteint).\n\nLe compte-rendu sera disponible dans quelques instants.\n\nVous pouvez recharger la page plus tard.');
          } else {
            alert('⚠️ Erreur lors de la génération.\n\nVeuillez réessayer.');
          }
        }
        
      } else {
        error('Erreur API:', result);
        alert('❌ Erreur lors de la régénération.\n\n' + (result.message || result.error || 'Erreur inconnue'));
        isGenerating = false;
        if (btn) {
          btn.disabled = false;
          if (btnText) btnText.textContent = 'Relancer';
        }
      }
      
    } catch (err) {
      error('Erreur:', err);
      alert('❌ Erreur réseau.');
      isGenerating = false;
      if (btn) {
        btn.disabled = false;
        if (btnText) btnText.textContent = 'Relancer';
      }
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
    if (!activeTab) return;
    
    const isSummaryTab = activeTab.id === 'tab-summary';
    const isTranscriptTab = activeTab.id === 'tab-transcript';
    
    const textDiv = btn.querySelector('div');
    if (textDiv) textDiv.textContent = getButtonText();
    
    const counter = btn.parentElement.querySelector('.regeneration-counter, .regeneration-limit-message, .regeneration-premium-message');
    
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
  
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
        const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
        if (btn && btn.style.display !== 'none' && !btn.disabled) {
          e.preventDefault();
          relancerCompteRendu();
        }
      }
    });
    
    const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
    if (btn) {
      btn.title = 'Régénérer le compte-rendu (Ctrl+Shift+R)';
      btn.setAttribute('aria-label', 'Régénérer le compte-rendu');
      btn.setAttribute('aria-describedby', 'regeneration-info');
    }
  }
  
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
      return { possible: false, reason: 'error' };
    }
  }
  
  // ============================================
  // INITIALISATION
  // ============================================
  
  function init() {
    if (window.__agiloRelanceInitialized) {
      log('Script déjà initialisé');
      return;
    }
    window.__agiloRelanceInitialized = true;
    
    log('🚀 Initialisation script relance');
    
    document.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-action="relancer-compte-rendu"]');
      if (btn && !btn.disabled) {
        e.preventDefault();
        e.stopPropagation();
        relancerCompteRendu();
      }
    }, { passive: false });
    
    const saveBtn = document.querySelector('[data-action="save-transcript"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        transcriptModified = true;
        try {
          const jobId = pickJobId();
          if (jobId) {
            localStorage.setItem(`agilo:transcript-saved:${jobId}`, 'true');
          }
        } catch (e) {}
        
        if (typeof window.toast === 'function') {
          window.toast('✅ Transcript sauvegardé');
        }
        
        updateButtonVisibility();
        setTimeout(async () => {
          try {
            const creds = await ensureCreds();
            if (creds.jobId && creds.edition) {
              updateRegenerationCounter(creds.jobId, creds.edition);
              updateButtonState(creds.jobId, creds.edition);
            }
          } catch (e) {}
        }, 500);
      });
    }
    
    const currentJobId = pickJobId();
    if (currentJobId) {
      try {
        const wasSaved = localStorage.getItem(`agilo:transcript-saved:${currentJobId}`);
        if (wasSaved === 'true') {
          transcriptModified = true;
        }
      } catch (e) {}
    }
    
    const tabs = document.querySelectorAll('[role="tab"]');
    tabs.forEach(tab => {
      tab.addEventListener('click', function() {
        setTimeout(updateButtonVisibility, 100);
      });
    });
    
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'aria-selected') {
          updateButtonVisibility();
        }
      });
    });
    
    tabs.forEach(tab => {
      observer.observe(tab, { attributes: true });
    });
    
    updateButtonVisibility();
    
    const initLimits = async () => {
      try {
        const creds = await ensureCreds();
        const { edition, jobId } = creds;
        if (jobId && edition) {
          updateRegenerationCounter(jobId, edition);
          updateButtonState(jobId, edition);
          
          const canRegen = await checkIfRegenerationPossible(jobId, edition);
          if (!canRegen.possible && canRegen.reason === 'no-summary') {
            const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
            if (btn) {
              btn.disabled = true;
              btn.setAttribute('aria-disabled', 'true');
              btn.title = 'Générez d\'abord un compte-rendu';
            }
          }
          
          updateButtonVisibility();
        }
      } catch (e) {}
    };
    
    setTimeout(initLimits, 500);
    
    let lastJobId = pickJobId();
    
    window.addEventListener('popstate', () => {
      const currentJobId = pickJobId();
      if (currentJobId && currentJobId !== lastJobId) {
        lastJobId = currentJobId;
        setTimeout(initLimits, 300);
      }
    });
    
    window.addEventListener('hashchange', () => {
      const currentJobId = pickJobId();
      if (currentJobId && currentJobId !== lastJobId) {
        lastJobId = currentJobId;
        setTimeout(initLimits, 300);
      }
    });
    
    const editorRoot = document.querySelector('#editorRoot');
    if (editorRoot) {
      const observer = new MutationObserver(() => {
        const currentJobId = pickJobId();
        if (currentJobId && currentJobId !== lastJobId) {
          lastJobId = currentJobId;
          setTimeout(initLimits, 300);
        }
      });
      observer.observe(editorRoot, { attributes: true, attributeFilter: ['data-job-id'] });
    }
    
    tabs.forEach(tab => {
      tab.addEventListener('click', function() {
        setTimeout(() => initLimits(), 200);
      });
    });
    
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tab') === 'summary') {
      setTimeout(() => {
        openSummaryTab();
        urlParams.delete('tab');
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.history.replaceState({}, '', newUrl);
      }, 300);
    }
    
    setupKeyboardShortcuts();
  }
  
  // ============================================
  // STYLES CSS
  // ============================================
  
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
        background: var(--agilo-surface, #ffffff);
        color: var(--agilo-text, #020202);
      }
      
      .summary-loading-indicator #loading-summary,
      .summary-loading-indicator #loading-summary-clone {
        width: 88px;
        height: 88px;
        margin: 0 auto 24px;
        display: block;
      }
      
      .summary-loading-indicator .lottie-fallback {
        width: 88px;
        height: 88px;
        margin: 0 auto 24px;
        border: 4px solid rgba(0,0,0,0.12);
        border-top: 4px solid #174a96;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .summary-loading-indicator .loading-text {
        font: 500 16px/1.35 system-ui, -apple-system, Segoe UI, Roboto, Arial;
        color: var(--agilo-text, #020202);
        margin-top: 8px;
        margin-bottom: 4px;
      }
      
      .summary-loading-indicator .loading-subtitle {
        font: 400 14px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial;
        color: var(--agilo-dim, #525252);
        margin-top: 8px;
      }
      
      .summary-loading-indicator {
        animation: fadeIn 0.3s ease-out;
      }
      
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .regeneration-counter {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        font-size: 12px;
        font-weight: 500;
        color: var(--agilo-dim, #525252);
        margin-top: 6px;
        padding: 4px 8px;
        border-radius: 4px;
        background: var(--agilo-surface-2, #f8f9fa);
        transition: all 0.2s ease;
      }
      
      .regeneration-counter.has-warning {
        color: #fd7e14;
        background: color-mix(in srgb, #fd7e14 10%, #ffffff 90%);
      }
      
      .regeneration-limit-message,
      .regeneration-premium-message {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 10px 12px;
        margin-top: 8px;
        border-radius: 4px;
        font-size: 13px;
        line-height: 1.4;
        color: var(--agilo-text, #020202);
      }
      
      .regeneration-limit-message {
        background: color-mix(in srgb, #fd7e14 10%, #ffffff 90%);
        border: 1px solid color-mix(in srgb, #fd7e14 35%, transparent);
      }
      
      .regeneration-premium-message {
        background: color-mix(in srgb, #174a96 8%, #ffffff 92%);
        border: 1px solid color-mix(in srgb, #174a96 25%, transparent);
      }
      
      .regeneration-limit-message strong,
      .regeneration-premium-message strong {
        display: block;
        margin-bottom: 2px;
        font-weight: 600;
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
      
      .agilo-toast-success {
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
        font-size: 14px;
        line-height: 1.4;
      }
      
      @media (max-width: 560px) {
        .regeneration-counter {
          font-size: 11px;
          padding: 3px 6px;
          margin-top: 4px;
        }
        
        .regeneration-limit-message,
        .regeneration-premium-message {
          padding: 8px 10px;
          font-size: 12px;
        }
        
        .agilo-toast-success {
          right: 10px;
          left: 10px;
          max-width: none;
        }
      }
      
      [data-action="relancer-compte-rendu"]:focus-visible {
        outline: 2px solid #174a96;
        outline-offset: 2px;
      }
      
      @media (prefers-reduced-motion: reduce) {
        .summary-loading-indicator,
        .agilo-toast-success {
          animation: none;
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
  window.openSummaryTab = openSummaryTab;
  
  log('✅ Script chargé avec succès !');
})();

