// Agilotext – Relance Compte-Rendu (STAGING SIMPLE)
// ⚠️ Ce fichier est chargé depuis GitHub
// Version avec détection du compte-rendu par défaut
(function() {
  'use strict';
  
  // ============================================
  // RÉCUPÉRATION DES CREDENTIALS
  // ============================================
  
  /**
   * Récupérer l'édition (même logique que votre script principal)
   * Compatible avec toutes les éditions via URL, dataset, localStorage, etc.
   */
  function pickEdition() {
    const root = document.querySelector('#editorRoot');
    
    // Ordre de priorité (identique au script principal) :
    // 1. window.AGILO_EDITION (variable globale)
    // 2. URL parameter ?edition=
    // 3. editorRoot dataset
    // 4. localStorage
    // 5. Par défaut 'ent'
    const raw = window.AGILO_EDITION
      || new URLSearchParams(location.search).get('edition')
      || root?.dataset.edition
      || localStorage.getItem('agilo:edition')
      || 'ent';
    
    const v = String(raw || '').toLowerCase().trim();
    
    // Normalisation (identique au script principal)
    if (['enterprise', 'entreprise', 'business', 'team', 'ent'].includes(v)) return 'ent';
    if (v.startsWith('pro')) return 'pro';
    if (v.startsWith('free') || v === 'gratuit') return 'free';
    
    // Par défaut 'ent' (Business/Enterprise)
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
  
  /**
   * Obtenir la limite de régénérations selon l'édition
   * Compatible avec toutes les variantes d'édition
   */
  function getRegenerationLimit(edition) {
    const ed = String(edition || '').toLowerCase().trim();
    
    // Pro (toutes variantes : 'pro', 'pro+', etc.)
    if (ed.startsWith('pro')) return 2;
    
    // Business/Enterprise (ent, business, enterprise, entreprise, team)
    if (ed === 'ent' || 
        ed === 'business' || 
        ed === 'enterprise' || 
        ed === 'entreprise' || 
        ed === 'team') {
      return 4;
    }
    
    // Free (toutes variantes : 'free', 'gratuit', etc.)
    return 0; // Free = pas de régénération
  }
  
  /**
   * Obtenir le compteur de régénérations pour un jobId
   */
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
  
  /**
   * Incrémenter le compteur de régénérations
   */
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
      console.error('Erreur sauvegarde compteur:', e);
    }
  }
  
  /**
   * Réinitialiser le compteur (UNIQUEMENT lors du changement de jobId)
   * ⚠️ IMPORTANT : On ne réinitialise PAS quand on modifie le transcript
   * Le compteur est lié au jobId/audio, pas aux modifications du transcript
   */
  function resetRegenerationCount(jobId) {
    if (!jobId) return;
    
    try {
      const storage = localStorage.getItem('agilo:regenerations');
      if (!storage) return;
      
      const data = JSON.parse(storage);
      if (data[jobId]) {
        data[jobId].count = 0;
        data[jobId].lastReset = new Date().toISOString();
        localStorage.setItem('agilo:regenerations', JSON.stringify(data));
      }
    } catch (e) {
      console.error('Erreur réinitialisation compteur:', e);
    }
  }
  
  /**
   * Vérifier si l'utilisateur peut régénérer
   * Compatible avec toutes les variantes d'édition
   */
  function canRegenerate(jobId, edition) {
    const ed = String(edition || '').toLowerCase().trim();
    
    // Free (toutes variantes)
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
   * Obtenir la classe CSS pour le compteur selon l'état
   */
  function getCounterClass(canRegen) {
    if (!canRegen.allowed) return 'is-limit';
    if (canRegen.remaining <= canRegen.limit * 0.5) return 'has-warning';
    return '';
  }
  
  /**
   * Créer ou mettre à jour le badge de compteur
   */
  function updateRegenerationCounter(jobId, edition) {
    const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
    if (!btn) return;
    
    // Supprimer l'ancien compteur s'il existe
    const oldCounter = btn.parentElement.querySelector('.regeneration-counter');
    if (oldCounter) {
      oldCounter.remove();
    }
    
    const oldMessage = btn.parentElement.querySelector('.regeneration-limit-message, .regeneration-premium-message');
    if (oldMessage) {
      oldMessage.remove();
    }
    
    const canRegen = canRegenerate(jobId, edition);
    
    // Utilisateur Free : Garder le bouton visible mais avec apparence désactivée
    // Le message premium est caché, le bouton affichera directement la pop-up au clic
    if (canRegen.reason === 'free') {
      // Ne pas créer le message premium (on le cache)
      // Le bouton reste visible et cliquable
      btn.style.display = 'flex';
      return;
    }
    
    // Afficher le bouton pour Pro/Business
    btn.style.display = 'flex';
    
      // Limite atteinte : Afficher message avec option d'upgrade si Pro
      if (canRegen.reason === 'limit') {
        const planName = edition === 'ent' || edition === 'business' ? 'Business' : 'Pro';
        const limitMsg = document.createElement('div');
        limitMsg.className = 'regeneration-limit-message';
        
        let upgradeButton = '';
        // Si c'est Pro et qu'AgiloGate est disponible, proposer Business
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
            <div style="font-size: 11px; margin-top: 4px; color: var(--agilo-dim, #525252); font-style: italic;">
              La limite est par audio/jobId, même si vous modifiez le transcript.
            </div>
            ${upgradeButton}
          </div>
        `;
        btn.parentElement.appendChild(limitMsg);
        
        // S'assurer que le bouton d'upgrade fonctionne avec AgiloGate
        if (upgradeButton && typeof window.AgiloGate !== 'undefined' && window.AgiloGate.decorate) {
          setTimeout(() => window.AgiloGate.decorate(), 100);
        }
        
        return;
      }
    
    // Afficher le compteur
    const counter = document.createElement('div');
    counter.id = 'regeneration-info';
    counter.className = `regeneration-counter ${getCounterClass(canRegen)}`;
    counter.textContent = `${canRegen.remaining}/${canRegen.limit} régénérations restantes`;
    counter.title = `Il vous reste ${canRegen.remaining} régénération${canRegen.remaining > 1 ? 's' : ''} pour ce transcript`;
    counter.setAttribute('aria-live', 'polite');
    counter.setAttribute('aria-atomic', 'true');
    btn.parentElement.appendChild(counter);
  }
  
  /**
   * Mettre à jour l'état du bouton selon les limites
   * Intègre AgiloGate pour Free (désactive + badge)
   */
  function updateButtonState(jobId, edition) {
    const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
    if (!btn) return;
    
    const canRegen = canRegenerate(jobId, edition);
    
    // Pour Free : garder le bouton cliquable mais avec apparence désactivée + badge AgiloGate
    if (canRegen.reason === 'free') {
      // Ne PAS désactiver le bouton (disabled = false) pour qu'il reste cliquable
      btn.disabled = false;
      btn.removeAttribute('aria-disabled');
      btn.setAttribute('data-plan-min', 'pro');
      btn.setAttribute('data-upgrade-reason', 'Régénération de compte-rendu');
      // Apparence désactivée visuellement mais reste cliquable
      btn.style.opacity = '0.5';
      btn.style.cursor = 'pointer'; // Pointer au lieu de not-allowed
      
      // S'assurer que AgiloGate décore ce bouton (badge Pro)
      if (typeof window.AgiloGate !== 'undefined' && window.AgiloGate.decorate) {
        window.AgiloGate.decorate();
      }
      
      return;
    }
    
    // Pour Pro/Business : gérer selon la limite
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
  
  /**
   * Ouvrir l'onglet Compte-rendu
   */
  function openSummaryTab() {
    const summaryTab = document.querySelector('#tab-summary');
    if (summaryTab) {
      summaryTab.click();
    }
  }
  
  /**
   * Initialiser l'animation Lottie avec Webflow
   */
  function initLottieAnimation(element) {
    // Méthode 1: Utiliser Webflow IX2 si disponible
    if (window.Webflow && window.Webflow.require) {
      try {
        const ix2 = window.Webflow.require('ix2');
        if (ix2 && typeof ix2.init === 'function') {
          // Réinitialiser IX2 pour prendre en compte le nouvel élément
          setTimeout(() => {
            ix2.init();
          }, 100);
        }
      } catch (e) {
        console.log('Webflow IX2 non disponible');
      }
    }
    
    // Méthode 2: Utiliser directement la bibliothèque Lottie si disponible
    if (window.lottie && typeof window.lottie.loadAnimation === 'function') {
      try {
        const animationData = {
          container: element,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path: 'https://cdn.prod.website-files.com/6815bee5a9c0b57da18354fb/6815bee5a9c0b57da18355b3_Animation%20-%201705419825493.json'
        };
        
        // Vérifier si l'animation n'est pas déjà chargée
        if (!element._lottie) {
          element._lottie = window.lottie.loadAnimation(animationData);
        }
      } catch (e) {
        console.log('Lottie direct non disponible:', e);
      }
    }
    
    // Méthode 3: Attendre que Webflow charge l'animation
    // Webflow charge automatiquement les éléments avec data-animation-type="lottie"
    // On attend un peu pour que le DOM soit prêt
    setTimeout(() => {
      // Déclencher un événement personnalisé pour forcer le rechargement
      if (window.Webflow && window.Webflow.require) {
        try {
          window.Webflow.require('ix2').init();
        } catch (e) {}
      }
    }, 200);
  }
  
  /**
   * Afficher un indicateur de chargement dans l'onglet Compte-rendu
   * Utilise l'animation Lottie existante
   */
  function showSummaryLoading() {
    const summaryPane = document.querySelector('#pane-summary');
    const summaryEditor = document.querySelector('#summaryEditor');
    
    if (!summaryPane || !summaryEditor) return;
    
    // Créer le conteneur de chargement
    let loaderContainer = summaryEditor.querySelector('.summary-loading-indicator');
    
    if (!loaderContainer) {
      loaderContainer = document.createElement('div');
      loaderContainer.className = 'summary-loading-indicator';
      
      // Chercher l'élément Lottie existant dans le DOM (peut être ailleurs)
      let lottieElement = document.querySelector('#loading-summary');
      
      // Si l'élément Lottie n'existe pas, le créer
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
        // Si l'élément existe ailleurs, le cloner ou le déplacer
        // On préfère le cloner pour ne pas casser l'original
        const clonedLottie = lottieElement.cloneNode(true);
        clonedLottie.id = 'loading-summary-clone';
        lottieElement = clonedLottie;
      }
      
      // Ajouter les textes
      const loadingText = document.createElement('p');
      loadingText.className = 'loading-text';
      loadingText.textContent = 'Génération du compte-rendu en cours...';
      
      const loadingSubtitle = document.createElement('p');
      loadingSubtitle.className = 'loading-subtitle';
      loadingSubtitle.textContent = 'Cela peut prendre quelques instants';
      
      summaryEditor.innerHTML = '';
      summaryEditor.appendChild(loaderContainer);
      loaderContainer.appendChild(lottieElement);
      loaderContainer.appendChild(loadingText);
      loaderContainer.appendChild(loadingSubtitle);
      
      // Initialiser l'animation Lottie après l'ajout au DOM
      setTimeout(() => {
        initLottieAnimation(lottieElement);
        
        // Fallback: Si après 1 seconde l'animation ne s'affiche pas, afficher un spinner CSS
        setTimeout(() => {
          const hasLottieContent = lottieElement.querySelector('svg, canvas') || lottieElement._lottie;
          if (!hasLottieContent) {
            console.log('Lottie ne s\'est pas chargé, utilisation du fallback');
            const fallback = document.createElement('div');
            fallback.className = 'lottie-fallback';
            lottieElement.style.display = 'none';
            loaderContainer.insertBefore(fallback, lottieElement);
          }
        }, 1000);
      }, 100);
      
    } else {
      // Si le conteneur existe déjà, juste l'afficher
      loaderContainer.style.display = 'flex';
      
      // Réinitialiser l'animation Lottie
      const lottieElement = loaderContainer.querySelector('#loading-summary, #loading-summary-clone');
      if (lottieElement) {
        setTimeout(() => {
          initLottieAnimation(lottieElement);
        }, 100);
      }
    }
    
    // Afficher le conteneur
    loaderContainer.style.display = 'flex';
  }
  
  /**
   * Masquer l'indicateur de chargement
   */
  function hideSummaryLoading() {
    const loader = document.querySelector('.summary-loading-indicator');
    const lottieElement = document.querySelector('#loading-summary');
    
    if (loader) {
      loader.style.display = 'none';
    }
    
    if (lottieElement) {
      lottieElement.style.display = 'none';
    }
  }
  
  /**
   * Désactiver les actions pendant la génération
   */
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
  
  /**
   * Vérifier si un compte-rendu existe déjà pour ce jobId
   */
  async function checkSummaryExists(jobId, email, token, edition) {
    try {
      const url = `https://api.agilotext.com/api/v1/receiveSummary?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}&format=html`;
      
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store'
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
   * Attendre que le compte-rendu soit prêt (polling)
   */
  async function waitForSummaryReady(jobId, email, token, edition, maxAttempts = 30, delay = 2000) {
    console.log('[AGILO:RELANCE] Début vérification disponibilité compte-rendu', {
      jobId,
      maxAttempts,
      delay
    });
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const url = `https://api.agilotext.com/api/v1/receiveSummary?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}&format=html`;
        
        const response = await fetch(url, {
          method: 'GET',
          cache: 'no-store'
        });
        
        console.log(`[AGILO:RELANCE] Tentative ${attempt}/${maxAttempts} - Status:`, response.status);
        
        // Si 200 OK, le compte-rendu est prêt
        if (response.ok) {
          const text = await response.text();
          // Vérifier que ce n'est pas un message d'erreur
          if (text && !text.includes('pas encore disponible') && !text.includes('non publié')) {
            console.log('[AGILO:RELANCE] ✅ Compte-rendu disponible !', {
              attempt,
              contentLength: text.length
            });
            return true;
          } else {
            console.log(`[AGILO:RELANCE] Compte-rendu pas encore prêt (tentative ${attempt}/${maxAttempts})`);
          }
        } else if (response.status === 404 || response.status === 204) {
          // 404 ou 204 = pas encore disponible
          console.log(`[AGILO:RELANCE] Compte-rendu pas encore disponible (${response.status}) - tentative ${attempt}/${maxAttempts}`);
        } else {
          console.warn(`[AGILO:RELANCE] Erreur HTTP ${response.status} - tentative ${attempt}/${maxAttempts}`);
        }
        
        // Attendre avant la prochaine tentative (sauf dernière)
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, delay));
        }
      } catch (error) {
        console.error(`[AGILO:RELANCE] Erreur vérification (tentative ${attempt}/${maxAttempts}):`, error);
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    
    // Si on arrive ici, le compte-rendu n'est pas prêt après toutes les tentatives
    console.warn('[AGILO:RELANCE] ⚠️ Compte-rendu pas prêt après', maxAttempts, 'tentatives');
    console.log('[AGILO:RELANCE] Rechargement quand même - le compte-rendu apparaîtra quand il sera prêt');
    return false;
  }
  
  /**
   * Afficher un message de succès (non-bloquant)
   */
  function showSuccessMessage(message) {
    // Utiliser toast si disponible, sinon alert
    if (typeof window.toast === 'function') {
      window.toast('✅ ' + message);
    } else {
      // Créer un toast simple
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
  
  /**
   * Gérer les erreurs avec messages contextuels
   */
  function handleError(error, result) {
    let errorMessage = '❌ Erreur lors de la régénération.';
    let suggestion = '';
    
    if (error && error.type === 'offline') {
      errorMessage = '❌ Pas de connexion Internet.';
      suggestion = 'Vérifiez votre connexion et réessayez.';
    } else if (error && error.type === 'timeout') {
      errorMessage = '⏱️ La requête a pris trop de temps.';
      suggestion = 'Le serveur peut être surchargé. Réessayez dans quelques instants.';
    } else if (result && result.error) {
      const errorCode = result.error.toLowerCase();
      if (errorCode.includes('token') || errorCode.includes('auth')) {
        errorMessage = '❌ Erreur d\'authentification.';
        suggestion = 'Veuillez vous reconnecter.';
      } else if (errorCode.includes('job') || errorCode.includes('not found')) {
        errorMessage = '❌ Transcript introuvable.';
        suggestion = 'Le transcript sélectionné n\'existe plus ou a été supprimé.';
      } else if (errorCode.includes('limit') || errorCode.includes('quota')) {
        errorMessage = '⚠️ Limite atteinte.';
        suggestion = 'Vous avez atteint votre limite de générations. Vérifiez votre abonnement.';
      } else {
        errorMessage = '❌ ' + (result.message || result.error || 'Erreur inconnue');
      }
    }
    
    const fullMessage = suggestion 
      ? `${errorMessage}\n\n${suggestion}`
      : errorMessage;
    
    // Utiliser toast si disponible pour les erreurs non-critiques
    if (error && (error.type === 'timeout' || error.type === 'offline')) {
      if (typeof window.toast === 'function') {
        window.toast('❌ ' + errorMessage + (suggestion ? '\n' + suggestion : ''));
      } else {
        alert(fullMessage);
      }
    } else {
      // Erreurs critiques : toujours utiliser alert
      alert(fullMessage);
    }
    
    setGeneratingState(false);
  }
  
  /**
   * Obtenir le message de confirmation selon le contexte
   */
  function getConfirmationMessage() {
    const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
    const isSummaryTab = activeTab?.id === 'tab-summary';
    
    if (transcriptModified) {
      return 'Le transcript a été modifié.\n\n' +
             'Le compte-rendu actuel sera remplacé par une nouvelle version basée sur les modifications.\n\n' +
             'Voulez-vous continuer ?';
    } else if (isSummaryTab) {
      return 'Le compte-rendu actuel sera remplacé par une nouvelle version.\n\n' +
             'Voulez-vous continuer ?';
    } else {
      return 'Le compte-rendu actuel sera remplacé par une nouvelle version.\n\n' +
             'Voulez-vous continuer ?';
    }
  }
  
  /**
   * Fonction principale pour relancer le compte-rendu
   */
  async function relancerCompteRendu() {
    console.log('[AGILO:RELANCE] ========================================');
    console.log('[AGILO:RELANCE] Début régénération compte-rendu');
    console.log('[AGILO:RELANCE] ========================================');
    
    // Protection contre les double-clics
    if (isGenerating) {
      console.warn('[AGILO:RELANCE] ⚠️ Régénération déjà en cours, ignore le clic');
      return;
    }
    
    // Debounce : éviter les clics trop rapides
    const now = Date.now();
    if (relancerCompteRendu._lastClick && (now - relancerCompteRendu._lastClick) < 500) {
      console.warn('[AGILO:RELANCE] ⚠️ Clic trop rapide, ignoré');
      return;
    }
    relancerCompteRendu._lastClick = now;
    
    // Vérifier les limites avant de continuer
    let creds;
    try {
      creds = await ensureCreds();
      console.log('[AGILO:RELANCE] Credentials récupérées:', {
        email: creds.email ? '✓' : '✗',
        token: creds.token ? '✓ (' + creds.token.length + ' chars)' : '✗',
        edition: creds.edition,
        jobId: creds.jobId
      });
    } catch (error) {
      console.error('[AGILO:RELANCE] ❌ Erreur récupération credentials:', error);
      alert('❌ Erreur : Impossible de récupérer les informations de connexion.\n\nVeuillez réessayer.');
      return;
    }
    
    const { email, token, edition, jobId } = creds;
    
    if (!email || !token || !jobId) {
      console.error('[AGILO:RELANCE] ❌ Informations incomplètes:', {
        email: !!email,
        token: !!token,
        jobId: !!jobId
      });
      alert('❌ Erreur : Informations incomplètes.\n\nEmail: ' + (email ? '✓' : '✗') + '\nToken: ' + (token ? '✓' : '✗') + '\nJobId: ' + (jobId ? '✓' : '✗'));
      return;
    }
    
    // Vérifier les limites
    const canRegen = canRegenerate(jobId, edition);
    console.log('[AGILO:RELANCE] Vérification limites:', {
      allowed: canRegen.allowed,
      reason: canRegen.reason,
      count: canRegen.count,
      limit: canRegen.limit,
      remaining: canRegen.remaining
    });
    
    if (!canRegen.allowed) {
      if (canRegen.reason === 'free') {
        // Utiliser AgiloGate pour afficher la pop-up d'upgrade
        if (typeof window.AgiloGate !== 'undefined' && window.AgiloGate.showUpgrade) {
          window.AgiloGate.showUpgrade('pro', 'Régénération de compte-rendu');
        } else {
          // Fallback si AgiloGate n'est pas disponible
          alert('🔒 Fonctionnalité Premium\n\nLa régénération de compte-rendu est disponible pour les plans Pro et Business.\n\nUpgradez votre compte pour accéder à cette fonctionnalité.');
        }
      } else if (canRegen.reason === 'limit') {
        // Message pour limite atteinte (Pro ou Business)
        const planName = edition === 'ent' || edition === 'business' ? 'Business' : 'Pro';
        const message = `⚠️ Limite atteinte\n\nVous avez utilisé ${canRegen.count}/${canRegen.limit} régénérations pour ce transcript.\n\nLa limite est de ${canRegen.limit} régénération${canRegen.limit > 1 ? 's' : ''} par audio (jobId), même si vous modifiez le transcript.`;
        
        // Si c'est Pro et qu'il veut plus, proposer Business
        if (edition === 'pro' && typeof window.AgiloGate !== 'undefined' && window.AgiloGate.showUpgrade) {
          const upgrade = confirm(message + '\n\nSouhaitez-vous passer en Business pour avoir 4 régénérations ?');
          if (upgrade) {
            window.AgiloGate.showUpgrade('ent', 'Régénération de compte-rendu - Limite augmentée');
          }
        } else {
          alert(message);
        }
      }
      return;
    }
    
    // Afficher le compteur dans la confirmation
    const confirmationMsg = getConfirmationMessage() + 
      `\n\nIl vous reste ${canRegen.remaining}/${canRegen.limit} régénération${canRegen.remaining > 1 ? 's' : ''} pour ce transcript.`;
    
    const confirmed = confirm(confirmationMsg);
    if (!confirmed) return;
    
    // ⚠️ IMPORTANT : Vérifier si un compte-rendu existe déjà
    // Si aucun compte-rendu n'existe, redoSummary ne peut pas fonctionner
    console.log('[AGILO:RELANCE] Vérification existence compte-rendu avant régénération...');
    const summaryExists = await checkSummaryExists(jobId, email, token, edition);
    
    if (!summaryExists) {
      console.warn('[AGILO:RELANCE] ⚠️ Aucun compte-rendu existant détecté');
      const proceed = confirm(
        '⚠️ Aucun compte-rendu existant détecté pour ce transcript.\n\n' +
        'Le bouton "Régénérer" nécessite qu\'un compte-rendu ait déjà été généré.\n\n' +
        'Si c\'est la première fois, vous devez d\'abord générer un compte-rendu via le formulaire d\'upload avec l\'option "Générer le compte-rendu" activée.\n\n' +
        'Voulez-vous quand même essayer de régénérer ?'
      );
      
      if (!proceed) {
        console.log('[AGILO:RELANCE] Utilisateur a annulé - pas de compte-rendu existant');
        return;
      }
      
      console.log('[AGILO:RELANCE] Utilisateur a choisi de continuer malgré l\'absence de compte-rendu');
    } else {
      console.log('[AGILO:RELANCE] ✅ Compte-rendu existant détecté, régénération possible');
    }
    
    setGeneratingState(true);
    
    try {
      const formData = new FormData();
      formData.append('username', email);
      formData.append('token', token);
      formData.append('edition', edition);
      formData.append('jobId', jobId);
      
      console.log('[AGILO:RELANCE] Envoi requête API redoSummary', {
        url: 'https://api.agilotext.com/api/v1/redoSummary',
        method: 'POST',
        jobId,
        edition,
        emailLength: email.length
      });
      
      const response = await fetch('https://api.agilotext.com/api/v1/redoSummary', {
        method: 'POST',
        body: formData
      });
      
      console.log('[AGILO:RELANCE] Réponse HTTP reçue:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      const result = await response.json();
      
      // Logs détaillés pour le débogage
      console.log('[AGILO:RELANCE] Réponse API reçue:', {
        status: result.status,
        httpStatus: response.status,
        responseOk: response.ok,
        result: result
      });
      
      if (result.status === 'OK' || response.ok) {
        // Vérifier que le jobId n'a pas changé pendant la requête
        const currentJobId = pickJobId();
        if (currentJobId !== jobId) {
          console.warn('[AGILO:RELANCE] ⚠️ JobId a changé pendant la génération', {
            initialJobId: jobId,
            currentJobId: currentJobId
          });
          setGeneratingState(false);
          alert('⚠️ Le transcript a changé pendant la génération.\n\nLe compteur n\'a pas été incrémenté.');
          return;
        }
        
        console.log('[AGILO:RELANCE] ✅ Succès - Incrémentation du compteur', {
          jobId,
          edition,
          countBefore: getRegenerationCount(jobId)
        });
        
        // Incrémenter le compteur seulement après vérification
        incrementRegenerationCount(jobId, edition);
        
        console.log('[AGILO:RELANCE] Compteur incrémenté', {
          countAfter: getRegenerationCount(jobId)
        });
        
        // Afficher un message de succès non-bloquant
        showSuccessMessage('Compte-rendu régénéré avec succès !');
        
        // Ouvrir l'onglet Compte-rendu
        openSummaryTab();
        
        // Vérifier que le compte-rendu est prêt avant de recharger
        console.log('[AGILO:RELANCE] Vérification disponibilité compte-rendu...');
        await waitForSummaryReady(jobId, email, token, edition);
        
        // Recharger la page après confirmation que le compte-rendu est prêt
        console.log('[AGILO:RELANCE] Compte-rendu prêt, rechargement de la page...');
        const url = new URL(window.location.href);
        url.searchParams.set('tab', 'summary');
        window.location.href = url.toString();
        
      } else {
        // Vérifier si l'erreur est due à l'absence de compte-rendu initial
        const errorMsg = result?.message || result?.error || '';
        const isNoSummaryError = errorMsg.includes('pas encore disponible') ||
                                 errorMsg.includes('non publié') ||
                                 errorMsg.includes('fichier manquant') ||
                                 response.status === 404;
        
        if (isNoSummaryError) {
          console.error('[AGILO:RELANCE] ❌ Erreur : Aucun compte-rendu initial pour régénérer', {
            status: response.status,
            message: errorMsg
          });
          
          alert(
            '⚠️ Impossible de régénérer le compte-rendu\n\n' +
            'Aucun compte-rendu n\'a été généré initialement pour ce transcript.\n\n' +
            'Le bouton "Régénérer" nécessite qu\'un compte-rendu existe déjà.\n\n' +
            'Pour générer un compte-rendu pour la première fois, utilisez le formulaire d\'upload avec l\'option "Générer le compte-rendu" activée.'
          );
          
          setGeneratingState(false);
          return;
        }
        
        handleError(null, result);
      }
      
    } catch (error) {
      console.error('[AGILO:RELANCE] ❌ Erreur API:', {
        error,
        message: error.message,
        stack: error.stack,
        jobId,
        edition
      });
      handleError(error, null);
    }
  }
  
  /**
   * Gérer l'état "génération en cours"
   */
  function setGeneratingState(generating) {
    isGenerating = generating;
    
    const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
    if (!btn) return;
    
    const textDiv = btn.querySelector('div');
    
    if (generating) {
      btn.disabled = true;
      btn.setAttribute('aria-disabled', 'true');
      if (textDiv) {
        textDiv.textContent = 'Génération...';
      }
      btn.style.opacity = '0.6';
      btn.style.cursor = 'not-allowed';
      
      // Désactiver les actions
      disableEditorActions(true);
      
      // Afficher le loader dans l'onglet Compte-rendu
      showSummaryLoading();
      openSummaryTab();
      
    } else {
      btn.disabled = false;
      btn.setAttribute('aria-disabled', 'false');
      if (textDiv) {
        textDiv.textContent = getButtonText();
      }
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      
      // Réactiver les actions
      disableEditorActions(false);
      hideSummaryLoading();
    }
  }
  
  /**
   * Obtenir le texte du bouton selon le contexte
   */
  function getButtonText() {
    const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
    if (activeTab?.id === 'tab-summary') {
      return 'Régénérer';
    }
    if (activeTab?.id === 'tab-transcript' && transcriptModified) {
      return 'Régénérer compte-rendu';
    }
    return 'Relancer';
  }
  
  /**
   * Mettre à jour la visibilité du bouton selon l'onglet actif
   * ⚠️ MODIFIÉ : Vérifie maintenant si un compte-rendu existe avant d'afficher le bouton
   */
  async function updateButtonVisibility() {
    const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
    if (!btn) return;
    
    const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
    if (!activeTab) return;
    
    const isSummaryTab = activeTab.id === 'tab-summary';
    const isTranscriptTab = activeTab.id === 'tab-transcript';
    
    const textDiv = btn.querySelector('div');
    if (textDiv) {
      textDiv.textContent = getButtonText();
    }
    
    // Cacher aussi le compteur/message si le bouton est caché
    const counter = btn.parentElement.querySelector('.regeneration-counter, .regeneration-limit-message, .regeneration-premium-message');
    
    // ⚠️ NOUVEAU : Vérifier si un compte-rendu existe avant d'afficher le bouton
    try {
      const creds = await ensureCreds();
      if (creds.jobId && creds.email && creds.token) {
        const summaryExists = await checkSummaryExists(creds.jobId, creds.email, creds.token, creds.edition);
        
        // Si aucun compte-rendu n'existe, cacher le bouton
        if (!summaryExists) {
          console.log('[AGILO:RELANCE] ⚠️ Aucun compte-rendu détecté - Bouton caché');
          btn.style.display = 'none';
          if (counter) counter.style.display = 'none';
          return;
        }
      }
    } catch (error) {
      console.error('[AGILO:RELANCE] Erreur vérification compte-rendu:', error);
      // En cas d'erreur, on continue avec la logique normale
    }
    
    // Gérer la visibilité
    if (isSummaryTab) {
      // Toujours visible sur l'onglet Compte-rendu (même si transcript non sauvegardé)
      btn.style.display = 'flex';
      if (counter) counter.style.display = '';
      // Désactiver le bouton si transcript non sauvegardé
      if (!transcriptModified) {
        btn.disabled = true;
        btn.setAttribute('aria-disabled', 'true');
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
        btn.title = 'Sauvegardez d\'abord le transcript pour régénérer le compte-rendu';
      }
    } else if (isTranscriptTab && transcriptModified) {
      // Visible sur Transcription uniquement si transcript modifié ET sauvegardé
      btn.style.display = 'flex';
      if (counter) counter.style.display = '';
    } else {
      // Caché sur les autres onglets ou si transcript non sauvegardé
      btn.style.display = 'none';
      if (counter) counter.style.display = 'none';
    }
  }
  
  /**
   * Gérer les raccourcis clavier
   */
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
    
    // Ajouter tooltip et ARIA labels sur le bouton
    const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
    if (btn) {
      btn.title = 'Régénérer le compte-rendu (Ctrl+Shift+R)';
      btn.setAttribute('aria-label', 'Régénérer le compte-rendu');
      btn.setAttribute('aria-describedby', 'regeneration-info');
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
  
  /**
   * Initialisation
   */
  function init() {
    // Vérifier si déjà initialisé (éviter les doublons)
    if (window.__agiloRelanceInitialized) {
      console.log('Script de relance déjà initialisé, skip');
      return;
    }
    window.__agiloRelanceInitialized = true;
    
    document.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-action="relancer-compte-rendu"]');
      if (btn && !btn.disabled) {
        e.preventDefault();
        e.stopPropagation();
        relancerCompteRendu();
      }
    }, { passive: false });
    
    // Détecter la sauvegarde du transcript
    const saveBtn = document.querySelector('[data-action="save-transcript"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        transcriptModified = true;
        // Sauvegarder l'état dans localStorage pour persister après rechargement
        try {
          const jobId = pickJobId();
          if (jobId) {
            localStorage.setItem(`agilo:transcript-saved:${jobId}`, 'true');
            localStorage.setItem('agilo:last-jobId', jobId);
          }
        } catch (e) {}
        
        // Feedback visuel après sauvegarde
        if (typeof window.toast === 'function') {
          window.toast('✅ Transcript sauvegardé - Vous pouvez régénérer le compte-rendu');
        }
        
        updateButtonVisibility();
        // Mettre à jour les compteurs après sauvegarde
        setTimeout(async () => {
          try {
            const creds = await ensureCreds();
            if (creds.jobId && creds.edition) {
              updateRegenerationCounter(creds.jobId, creds.edition);
              updateButtonState(creds.jobId, creds.edition);
            }
          } catch (e) {
            console.log('Erreur mise à jour compteurs:', e);
          }
        }, 500);
        // ⚠️ IMPORTANT : On ne réinitialise PAS le compteur lors de la sauvegarde
        // Le compteur est lié au jobId/audio, pas aux modifications du transcript
        // Même si l'utilisateur modifie le transcript plusieurs fois, il ne peut régénérer
        // que 2 fois (Pro) ou 4 fois (Business) par audio/jobId
      });
    }
    
    // Vérifier si le transcript a déjà été sauvegardé (au chargement)
    // Utiliser le jobId pour un état par transcript
    const currentJobId = pickJobId();
    if (currentJobId) {
      try {
        const wasSaved = localStorage.getItem(`agilo:transcript-saved:${currentJobId}`);
        if (wasSaved === 'true') {
          transcriptModified = true;
        }
        
        // Nettoyer les anciens états (garder seulement les 10 derniers jobIds)
        const allKeys = Object.keys(localStorage).filter(k => k.startsWith('agilo:transcript-saved:'));
        if (allKeys.length > 10) {
          // Supprimer les plus anciens (garder les 10 plus récents)
          allKeys.sort().slice(0, allKeys.length - 10).forEach(k => {
            localStorage.removeItem(k);
          });
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
    
    // Initialiser la visibilité (caché par défaut sauf si transcript sauvegardé)
    updateButtonVisibility();
    
    // Initialiser les compteurs et limites
    const initLimits = async () => {
      try {
        const creds = await ensureCreds();
        const { edition, jobId } = creds;
        if (jobId && edition) {
          updateRegenerationCounter(jobId, edition);
          updateButtonState(jobId, edition);
          
          // Vérifier si un compte-rendu existe (pour désactiver le bouton si nécessaire)
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
    
    // Réinitialiser les compteurs quand on change de transcript
    // Utiliser MutationObserver au lieu de setInterval pour meilleure performance
    let lastJobId = pickJobId();
    let jobIdCheckInterval = null;
    
    // Observer les changements dans l'URL ou le DOM qui indiquent un changement de transcript
    if (window.location) {
      // Observer les changements d'URL (popstate, hashchange)
      window.addEventListener('popstate', () => {
        const currentJobId = pickJobId();
        if (currentJobId && currentJobId !== lastJobId) {
          lastJobId = currentJobId;
          setTimeout(initLimits, 300);
        }
      });
      
      // Observer les changements de hash
      window.addEventListener('hashchange', () => {
        const currentJobId = pickJobId();
        if (currentJobId && currentJobId !== lastJobId) {
          lastJobId = currentJobId;
          setTimeout(initLimits, 300);
        }
      });
      
      // Observer les changements de #editorRoot dataset
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
      
      // Fallback : vérification périodique (mais moins fréquente et nettoyable)
      jobIdCheckInterval = setInterval(() => {
        const currentJobId = pickJobId();
        if (currentJobId && currentJobId !== lastJobId) {
          lastJobId = currentJobId;
          setTimeout(initLimits, 300);
        }
      }, 2000); // 2 secondes au lieu de 1
      
      // Nettoyer l'interval au démontage
      window.addEventListener('beforeunload', () => {
        if (jobIdCheckInterval) {
          clearInterval(jobIdCheckInterval);
          jobIdCheckInterval = null;
        }
      });
    }
    
    // Mettre à jour les compteurs quand on change d'onglet
    tabs.forEach(tab => {
      tab.addEventListener('click', function() {
        setTimeout(() => {
          initLimits();
        }, 200);
      });
    });
    
    // Ouvrir l'onglet Compte-rendu si demandé dans l'URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tab') === 'summary') {
      setTimeout(() => {
        openSummaryTab();
        urlParams.delete('tab');
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.history.replaceState({}, '', newUrl);
      }, 300);
    }
    
    // Raccourcis clavier
    setupKeyboardShortcuts();
  }
  
  // Ajouter les styles CSS pour le loader (respectant votre design system)
  if (!document.querySelector('#relance-summary-styles')) {
    const style = document.createElement('style');
    style.id = 'relance-summary-styles';
    style.textContent = `
      /* Conteneur de chargement - utilise vos variables CSS */
      .summary-loading-indicator {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        text-align: center;
        min-height: 300px;
        background: var(--agilo-surface, var(--color--white, #ffffff));
        color: var(--agilo-text, var(--color--gris_foncé, #020202));
      }
      
      /* Animation Lottie centrée */
      .summary-loading-indicator #loading-summary,
      .summary-loading-indicator #loading-summary-clone {
        width: 88px;
        height: 88px;
        margin: 0 auto 24px;
        display: block;
      }
      
      /* Fallback si Lottie ne charge pas - spinner CSS */
      .summary-loading-indicator .lottie-fallback {
        width: 88px;
        height: 88px;
        margin: 0 auto 24px;
        border: 4px solid var(--agilo-border, rgba(0,0,0,0.12));
        border-top: 4px solid var(--agilo-primary, var(--color--blue, #174a96));
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      /* Texte de chargement */
      .summary-loading-indicator .loading-text {
        font: 500 16px/1.35 system-ui, -apple-system, Segoe UI, Roboto, Arial;
        color: var(--agilo-text, var(--color--gris_foncé, #020202));
        margin-top: 8px;
        margin-bottom: 4px;
      }
      
      .summary-loading-indicator .loading-subtitle {
        font: 400 14px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial;
        color: var(--agilo-dim, var(--color--gris, #525252));
        margin-top: 8px;
      }
      
      /* Animation d'apparition douce */
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
      
      /* Respecte "réduire les animations" */
      @media (prefers-reduced-motion: reduce) {
        .summary-loading-indicator {
          animation: none;
        }
      }
      
      /* =====================================================================
         COMPTEUR DE RÉGÉNÉRATIONS
         ===================================================================== */
      
      .regeneration-counter {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        font-size: 12px;
        font-weight: 500;
        color: var(--agilo-dim, var(--color--gris, #525252));
        margin-top: 6px;
        padding: 4px 8px;
        border-radius: 4px;
        background: var(--agilo-surface-2, var(--color--blanc_gris, #f8f9fa));
        transition: all 0.2s ease;
      }
      
      .regeneration-counter.has-warning {
        color: var(--color--orange, #fd7e14);
        background: color-mix(in srgb, var(--color--orange, #fd7e14) 10%, var(--agilo-surface, #ffffff) 90%);
      }
      
      .regeneration-counter.is-limit {
        color: var(--color--red, #dc3545);
        background: color-mix(in srgb, var(--color--red, #dc3545) 10%, var(--agilo-surface, #ffffff) 90%);
      }
      
      /* Messages d'information */
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
        color: var(--agilo-text, var(--color--gris_foncé, #020202));
      }
      
      .regeneration-limit-message {
        background: color-mix(in srgb, var(--color--orange, #fd7e14) 10%, var(--agilo-surface, #ffffff) 90%);
        border: 1px solid color-mix(in srgb, var(--color--orange, #fd7e14) 35%, transparent);
      }
      
      .regeneration-premium-message {
        background: color-mix(in srgb, var(--agilo-primary, var(--color--blue, #174a96)) 8%, var(--agilo-surface, #ffffff) 92%);
        border: 1px solid color-mix(in srgb, var(--agilo-primary, var(--color--blue, #174a96)) 25%, transparent);
      }
      
      .regeneration-limit-message strong,
      .regeneration-premium-message strong {
        display: block;
        margin-bottom: 2px;
        font-weight: 600;
      }
      
      /* Message : Aucun compte-rendu initial */
      .regeneration-no-summary-message {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 10px 12px;
        margin-top: 8px;
        border-radius: 4px;
        font-size: 13px;
        line-height: 1.4;
        color: var(--agilo-text, var(--color--gris_foncé, #020202));
        background: color-mix(in srgb, var(--color--blue, #174a96) 8%, var(--agilo-surface, #ffffff) 92%);
        border: 1px solid color-mix(in srgb, var(--color--blue, #174a96) 25%, transparent);
      }
      
      .regeneration-no-summary-message strong {
        display: block;
        margin-bottom: 2px;
        font-weight: 600;
      }
      
      /* Toast de succès */
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
      
      /* Responsive mobile */
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
      
      /* Accessibilité : Focus visible */
      [data-action="relancer-compte-rendu"]:focus-visible {
        outline: 2px solid var(--agilo-primary, var(--color--blue, #174a96));
        outline-offset: 2px;
      }
      
      /* Respecte "réduire les animations" */
      @media (prefers-reduced-motion: reduce) {
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
})();
