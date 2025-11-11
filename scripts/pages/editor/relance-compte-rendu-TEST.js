// Agilotext – Relance Compte-Rendu (TEST)
// ⚠️ Ce fichier est chargé depuis GitHub - Version de test
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
   * Appeler l'API getTranscriptStatus pour obtenir le statut du transcript
   * Retourne le statut (READY_SUMMARY_READY, READY_SUMMARY_PENDING, etc.) ou null en cas d'erreur
   */
  async function getTranscriptStatus(jobId, email, token, edition) {
    try {
      // ⚠️ Utiliser EXACTEMENT la même logique que Code-main-editor.js ligne 897
      // Ordre des paramètres : jobId, username, token, edition (sans _t pour éviter CORS)
      const url = `https://api.agilotext.com/api/v1/getTranscriptStatus?jobId=${encodeURIComponent(String(jobId))}&username=${encodeURIComponent(String(email))}&token=${encodeURIComponent(String(token))}&edition=${encodeURIComponent(String(edition))}`;
      
      console.log('[AGILO:RELANCE] 🔍 APPEL API getTranscriptStatus', {
        url: url.substring(0, 150) + '...',
        jobId: String(jobId),
        edition: String(edition),
        emailLength: email ? email.length : 0,
        tokenLength: token ? token.length : 0,
        timestamp: new Date().toISOString()
      });
      
      const startTime = Date.now();
      // ⚠️ Utiliser exactement la même logique que Code-main-editor.js (fetchWithTimeout ligne 899)
      // fetchWithTimeout ajoute automatiquement credentials:'omit', cache:'no-store'
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit'
      });
      const responseTime = Date.now() - startTime;
      
      console.log('[AGILO:RELANCE] 📡 Réponse HTTP getTranscriptStatus reçue:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        timeMs: responseTime,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (!response.ok) {
        console.error('[AGILO:RELANCE] ❌ Erreur HTTP getTranscriptStatus:', {
          status: response.status,
          statusText: response.statusText,
          url: url.substring(0, 100) + '...'
        });
        return null;
      }
      
      const data = await response.json();
      
      console.log('[AGILO:RELANCE] 📋 Réponse JSON getTranscriptStatus:', {
        status: data.status,
        transcriptStatus: data.transcriptStatus,
        javaException: data.javaException,
        errorMessage: data.errorMessage,
        fullResponse: data
      });
      
      if (data.status === 'OK' && data.transcriptStatus) {
        console.log('[AGILO:RELANCE] ✅ Statut récupéré:', data.transcriptStatus);
        return data.transcriptStatus;
      }
      
      if (data.status === 'KO') {
        console.error('[AGILO:RELANCE] ❌ Erreur API getTranscriptStatus:', data.errorMessage);
        // Vérifier si c'est l'erreur "fichier manquant"
        if (data.errorMessage && /ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS/i.test(data.errorMessage)) {
          console.log('[AGILO:RELANCE] ⚠️ ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS détecté');
          return 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS';
        }
      }
      
      console.warn('[AGILO:RELANCE] ⚠️ Statut non reconnu ou manquant');
      return null;
    } catch (error) {
      console.error('[AGILO:RELANCE] ❌ Erreur réseau getTranscriptStatus:', {
        error: error.message,
        stack: error.stack,
        name: error.name
      });
      return null;
    }
  }
  
  /**
   * Fonction de test console pour vérifier le statut manuellement
   * Usage: testGetTranscriptStatus(jobId, email, token, edition)
   */
  window.testGetTranscriptStatus = async function(jobId, email, token, edition) {
    console.log('🧪 TEST MANUEL getTranscriptStatus');
    console.log('Paramètres:', { jobId, email, token: token ? token.substring(0, 10) + '...' : '(vide)', edition });
    
    if (!jobId || !email || !token || !edition) {
      console.error('❌ Paramètres manquants !');
      console.log('Usage: testGetTranscriptStatus(jobId, email, token, edition)');
      return;
    }
    
    const status = await getTranscriptStatus(jobId, email, token, edition);
    console.log('📊 Résultat:', status);
    
    if (status === 'READY_SUMMARY_READY') {
      console.log('✅ READY_SUMMARY_READY - Le compte-rendu est prêt !');
    } else if (status === 'READY_SUMMARY_PENDING') {
      console.log('⏳ READY_SUMMARY_PENDING - Le compte-rendu est en cours de génération');
    } else if (status === 'READY_SUMMARY_ON_ERROR' || status === 'ON_ERROR') {
      console.log('❌ Erreur:', status);
    } else if (status === null) {
      console.log('⚠️ Statut null - Vérifiez les paramètres ou la connexion');
    } else {
      console.log('ℹ️ Autre statut:', status);
    }
    
    return status;
  };
  
  /**
   * Générer un hash du contenu (compatible UTF-8)
   * Utilise une méthode simple mais efficace pour détecter les changements
   */
  function getContentHash(text) {
    if (!text || text.length === 0) return '';
    
    // Utiliser une méthode compatible UTF-8 au lieu de btoa
    // Prendre les premiers 2000 caractères pour le hash
    const sample = text.substring(0, 2000);
    
    // Créer un hash simple en utilisant une fonction de hachage simple
    let hash = 0;
    for (let i = 0; i < sample.length; i++) {
      const char = sample.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    // Retourner un hash positif en hexadécimal + longueur pour plus de précision
    return Math.abs(hash).toString(16) + '-' + text.length;
  }
  
  /**
   * Vérifier si un compte-rendu existe déjà pour ce jobId
   * Utilise getTranscriptStatus pour vérifier le statut
   */
  async function checkSummaryExists(jobId, email, token, edition) {
    try {
      // D'abord vérifier via getTranscriptStatus (plus fiable)
      const status = await getTranscriptStatus(jobId, email, token, edition);
      
      console.log('[AGILO:RELANCE] Statut transcript pour vérification existence:', status);
      
      // Si le statut est READY_SUMMARY_READY ou READY_SUMMARY_PENDING, le compte-rendu existe (ou est en cours)
      if (status === 'READY_SUMMARY_READY' || status === 'READY_SUMMARY_PENDING') {
        return true;
      }
      
      // Si c'est l'erreur "fichier manquant", le compte-rendu n'existe pas
      if (status === 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS') {
        return false;
      }
      
      // Fallback : vérifier via receiveSummary (pour compatibilité)
      const url = `https://api.agilotext.com/api/v1/receiveSummary?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}&format=html`;
      
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store'
      });
      
      console.log('[AGILO:RELANCE] Vérification existence compte-rendu (fallback):', {
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
   * Attendre que le compte-rendu soit prêt (polling avec getTranscriptStatus)
   * ⚠️ IMPORTANT : Après redoSummary, il faut attendre que le statut passe par READY_SUMMARY_PENDING
   * pour s'assurer que la régénération a vraiment commencé, puis attendre qu'il redevienne READY_SUMMARY_READY
   * avec un nouveau hash (différent de l'ancien)
   * 
   * @param {string} jobId - ID du job
   * @param {string} email - Email de l'utilisateur
   * @param {string} token - Token d'authentification
   * @param {string} edition - Édition (free, pro, ent)
   * @param {number} maxAttempts - Nombre maximum de tentatives (défaut: 60)
   * @param {number} delay - Délai entre chaque tentative en ms (défaut: 2000)
   * @param {string} oldHash - Hash de l'ancien compte-rendu (pour vérifier le changement)
   * @param {boolean} waitForPending - Si true, attend que le statut passe par READY_SUMMARY_PENDING avant d'accepter READY_SUMMARY_READY (défaut: true après redoSummary)
   */
  async function waitForSummaryReady(jobId, email, token, edition, maxAttempts = 60, delay = 2000, oldHash = '', waitForPending = true) {
    console.log('[AGILO:RELANCE] ========================================');
    console.log('[AGILO:RELANCE] 🎯 FONCTION waitForSummaryReady APPELÉE');
    console.log('[AGILO:RELANCE] Début polling pour READY_SUMMARY_READY', {
      jobId,
      edition,
      maxAttempts,
      delay,
      oldHash: oldHash ? oldHash.substring(0, 30) + '...' : '(aucun)',
      waitForPending: waitForPending,
      timestamp: new Date().toISOString()
    });
    console.log('[AGILO:RELANCE] ⚠️ Cette fonction va faire des appels répétés à getTranscriptStatus');
    console.log('[AGILO:RELANCE] ⚠️ Elle ne retournera ready:true QUE si le statut est READY_SUMMARY_READY');
    if (waitForPending) {
      console.log('[AGILO:RELANCE] ⚠️ IMPORTANT: On attend d\'abord READY_SUMMARY_PENDING (régénération en cours)');
      console.log('[AGILO:RELANCE] ⚠️ Puis on attend que le statut redevienne READY_SUMMARY_READY avec un nouveau hash');
    }
    console.log('[AGILO:RELANCE] ========================================');
    
    // ⚠️ NOTE : Le délai initial de 10 secondes est déjà fait AVANT l'appel à waitForSummaryReady
    // Donc on ne le refait pas ici pour éviter d'attendre deux fois
    // Le délai initial est géré dans relancerCompteRendu() avant l'appel à waitForSummaryReady
    if (waitForPending) {
      console.log('[AGILO:RELANCE] ⚠️ waitForPending=true - On attend d\'abord READY_SUMMARY_PENDING');
      console.log('[AGILO:RELANCE] ⚠️ Puis on attend que le statut redevienne READY_SUMMARY_READY avec un nouveau hash');
      console.log('[AGILO:RELANCE] ⚠️ Nicolas dit que ça peut prendre 2-3 minutes, donc on a 120 tentatives (6 minutes max)');
    }
    
    let hasSeenPending = !waitForPending; // Si waitForPending=false, on considère qu'on a déjà vu PENDING
    let lastReadyHash = null; // Hash du dernier READY_SUMMARY_READY vu
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`[AGILO:RELANCE] 🔄 Tentative ${attempt}/${maxAttempts} - Début vérification statut...`);
        
        // ⚠️ IMPORTANT : Utiliser getTranscriptStatus pour vérifier le statut
        const statusStartTime = Date.now();
        const status = await getTranscriptStatus(jobId, email, token, edition);
        const statusTime = Date.now() - statusStartTime;
        
        console.log(`[AGILO:RELANCE] 📊 Tentative ${attempt}/${maxAttempts} - Statut obtenu:`, {
          status: status,
          timeMs: statusTime,
          timestamp: new Date().toISOString()
        });
        
        // ⚠️ NOUVEAU : Si waitForPending=true, on doit d'abord voir READY_SUMMARY_PENDING
        // Cela garantit que la régénération a vraiment commencé
        if (status === 'READY_SUMMARY_PENDING') {
          if (!hasSeenPending) {
            console.log(`[AGILO:RELANCE] ✅✅✅ READY_SUMMARY_PENDING détecté ! La régénération a commencé ! (tentative ${attempt}/${maxAttempts})`);
            hasSeenPending = true;
          } else {
            console.log(`[AGILO:RELANCE] ⏳ READY_SUMMARY_PENDING - En cours de génération (tentative ${attempt}/${maxAttempts})`);
          }
          console.log(`[AGILO:RELANCE] ⏳ Attente ${delay}ms avant prochaine tentative...`);
          // Continuer le polling pour attendre READY_SUMMARY_READY
          if (attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, delay));
          }
          continue;
        }
        
        // Si le statut est READY_SUMMARY_READY, le compte-rendu est prêt !
        if (status === 'READY_SUMMARY_READY') {
          // ⚠️ NOUVEAU : Si waitForPending=true, on doit avoir vu PENDING avant d'accepter READY
          if (waitForPending && !hasSeenPending) {
            console.log(`[AGILO:RELANCE] ⚠️ READY_SUMMARY_READY détecté MAIS on n'a pas encore vu READY_SUMMARY_PENDING`);
            console.log(`[AGILO:RELANCE] ⚠️ C'est probablement l'ANCIEN statut - On continue le polling pour attendre PENDING puis le nouveau READY`);
            if (attempt < maxAttempts) {
              await new Promise(r => setTimeout(r, delay));
            }
            continue;
          }
          
          console.log('[AGILO:RELANCE] ✅ READY_SUMMARY_READY détecté ! Compte-rendu prêt !', {
            attempt,
            status,
            hasSeenPending: hasSeenPending,
            waitForPending: waitForPending
          });
          
          // Récupérer le nouveau compte-rendu pour vérifier le hash
          try {
            // ⚠️ Utiliser EXACTEMENT la même logique que Code-main-editor.js ligne 320
            // Ordre des paramètres : jobId, username, token, edition, format
            const url = `https://api.agilotext.com/api/v1/receiveSummary?jobId=${encodeURIComponent(String(jobId))}&username=${encodeURIComponent(String(email))}&token=${encodeURIComponent(String(token))}&edition=${encodeURIComponent(String(edition))}&format=html`;
            const response = await fetch(url, {
              method: 'GET',
              cache: 'no-store',
              credentials: 'omit'
            });
            
            if (response.ok) {
              const text = await response.text();
              
              // Vérifier que le contenu n'est pas vide et n'est pas un message d'erreur
              if (!text || text.length < 100 || 
                  text.includes('pas encore disponible') || 
                  text.includes('non publié') || 
                  text.includes('fichier manquant')) {
                console.warn('[AGILO:RELANCE] ⚠️ Contenu invalide ou message d\'erreur - Continuation du polling');
                // Continuer le polling
                if (attempt < maxAttempts) {
                  await new Promise(r => setTimeout(r, delay));
                }
                continue;
              }
              
              const newHash = getContentHash(text);
              
              console.log('[AGILO:RELANCE] Compte-rendu récupéré:', {
                contentLength: text.length,
                newHash: newHash.substring(0, 50) + '...',
                oldHash: oldHash ? oldHash.substring(0, 50) + '...' : '(aucun)',
                lastReadyHash: lastReadyHash ? lastReadyHash.substring(0, 50) + '...' : '(aucun)',
                hashChanged: !oldHash || newHash !== oldHash,
                hashChangedFromLastReady: !lastReadyHash || newHash !== lastReadyHash
              });
              
              // ⚠️ NOUVEAU : Si on a un oldHash, on doit vérifier que le hash a vraiment changé
              // Si le hash est identique à l'ancien, c'est probablement l'ancien compte-rendu
              if (oldHash && newHash === oldHash) {
                console.warn('[AGILO:RELANCE] ⚠️ Hash identique à l\'ancien - C\'est probablement l\'ANCIEN compte-rendu');
                console.warn('[AGILO:RELANCE] ⚠️ On continue le polling pour attendre le NOUVEAU compte-rendu');
                lastReadyHash = newHash; // Mémoriser ce hash pour la prochaine fois
                if (attempt < maxAttempts) {
                  await new Promise(r => setTimeout(r, delay));
                }
                continue;
              }
              
              // ⚠️ NOUVEAU : Si on a déjà vu un READY avec un hash, vérifier que le nouveau hash est différent
              if (lastReadyHash && newHash === lastReadyHash) {
                console.warn('[AGILO:RELANCE] ⚠️ Hash identique au dernier READY vu - Le compte-rendu n\'a pas changé');
                console.warn('[AGILO:RELANCE] ⚠️ On continue le polling pour attendre le NOUVEAU compte-rendu');
                if (attempt < maxAttempts) {
                  await new Promise(r => setTimeout(r, delay));
                }
                continue;
              }
              
              // ⚠️ CRITIQUE : Si le hash a changé, c'est le nouveau compte-rendu
              if (!oldHash || newHash !== oldHash) {
                console.log('[AGILO:RELANCE] ✅✅✅ Hash différent détecté - NOUVEAU compte-rendu confirmé !');
                lastReadyHash = newHash; // Mémoriser pour référence
                return { ready: true, hash: newHash, content: text };
              } else {
                // ⚠️ CRITIQUE : Hash identique = ancien compte-rendu, on continue le polling
                // On ne retourne JAMAIS ready:true si le hash n'a pas changé
                console.warn('[AGILO:RELANCE] ⚠️ Hash identique - C\'est l\'ANCIEN compte-rendu');
                console.warn('[AGILO:RELANCE] ⚠️ On continue le polling pour attendre le NOUVEAU compte-rendu');
                lastReadyHash = newHash;
                if (attempt < maxAttempts) {
                  await new Promise(r => setTimeout(r, delay));
                }
                continue;
              }
            } else {
              console.warn('[AGILO:RELANCE] ⚠️ receiveSummary retourne une erreur HTTP:', response.status);
              // Continuer le polling
              if (attempt < maxAttempts) {
                await new Promise(r => setTimeout(r, delay));
              }
              continue;
            }
          } catch (error) {
            console.error('[AGILO:RELANCE] Erreur récupération nouveau compte-rendu:', error);
            // ⚠️ IMPORTANT : Ne pas retourner ready:true si on n'a pas pu récupérer le contenu
            // Continuer le polling pour réessayer
            console.warn('[AGILO:RELANCE] ⚠️ Erreur lors de la récupération - Continuation du polling');
            if (attempt < maxAttempts) {
              await new Promise(r => setTimeout(r, delay));
            }
            continue;
          }
        }
        
        // Si erreur, on arrête
        if (status === 'READY_SUMMARY_ON_ERROR' || status === 'ON_ERROR') {
          console.error('[AGILO:RELANCE] ❌ Erreur lors de la génération:', status);
          return { ready: false, error: status };
        }
        
        // Si le statut est null ou autre chose, continuer le polling
        if (status === null) {
          console.log(`[AGILO:RELANCE] ⚠️ Statut null - Continuation du polling (tentative ${attempt}/${maxAttempts})`);
          console.log(`[AGILO:RELANCE] ⏳ Attente ${delay}ms avant prochaine tentative...`);
        }
        
        // Si le statut est autre chose (non géré), continuer aussi
        if (status && status !== 'READY_SUMMARY_READY' && status !== 'READY_SUMMARY_PENDING' && 
            status !== 'READY_SUMMARY_ON_ERROR' && status !== 'ON_ERROR' && 
            status !== 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS') {
          console.log(`[AGILO:RELANCE] ℹ️ Statut non géré: "${status}" - Continuation du polling (tentative ${attempt}/${maxAttempts})`);
          console.log(`[AGILO:RELANCE] ⏳ Attente ${delay}ms avant prochaine tentative...`);
        }
        
        // Attendre avant la prochaine tentative (sauf dernière)
        if (attempt < maxAttempts) {
          console.log(`[AGILO:RELANCE] ⏳ Attente ${delay}ms avant tentative ${attempt + 1}/${maxAttempts}...`);
          await new Promise(r => setTimeout(r, delay));
          console.log(`[AGILO:RELANCE] ✅ Attente terminée, passage à la tentative ${attempt + 1}/${maxAttempts}`);
        }
      } catch (error) {
        console.error(`[AGILO:RELANCE] Erreur polling (tentative ${attempt}/${maxAttempts}):`, error);
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    
    // Si on arrive ici, le compte-rendu n'est pas prêt après toutes les tentatives
    console.warn('[AGILO:RELANCE] ⚠️ TIMEOUT: Le nouveau compte-rendu n\'est pas prêt après', maxAttempts, 'tentatives');
    console.warn('[AGILO:RELANCE] ⚠️ Le statut est resté sur READY_SUMMARY_READY (ancien) ou n\'a jamais changé');
    console.warn('[AGILO:RELANCE] ⚠️ Le backend n\'a peut-être pas commencé la régénération, ou elle prend plus de temps');
    console.warn('[AGILO:RELANCE] ⚠️ On NE RECHARGE PAS la page - L\'utilisateur peut recharger manuellement plus tard');
    return { ready: false, error: 'TIMEOUT', hasSeenPending: hasSeenPending };
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
    
    // ⚠️ IMPORTANT : Récupérer le hash de l'ancien compte-rendu avant régénération
    let oldHash = '';
    try {
      const url = `https://api.agilotext.com/api/v1/receiveSummary?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}&format=html&_t=${Date.now()}`;
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store'
      });
      
      if (response.ok) {
        const text = await response.text();
        if (text && !text.includes('pas encore disponible') && !text.includes('non publié')) {
          oldHash = getContentHash(text);
          console.log('[AGILO:RELANCE] Hash ancien compte-rendu récupéré:', {
            hash: oldHash.substring(0, 50) + '...',
            contentLength: text.length
          });
        }
      }
    } catch (error) {
      console.warn('[AGILO:RELANCE] Erreur récupération hash ancien compte-rendu:', error);
      // On continue quand même
    }
    
    setGeneratingState(true);
    
    try {
      // ⚠️ IMPORTANT : Logger tous les paramètres envoyés
      console.log('[AGILO:RELANCE] ========================================');
      console.log('[AGILO:RELANCE] Paramètres pour redoSummary:', {
        jobId: jobId,
        edition: edition,
        username: email,
        usernameLength: email ? email.length : 0,
        tokenLength: token ? token.length : 0,
        tokenPreview: token ? token.substring(0, 10) + '...' : '(vide)'
      });
      console.log('[AGILO:RELANCE] ========================================');
      
      // ⚠️ Vérifier que tous les paramètres sont valides avant de construire l'URL
      if (!jobId || !email || !token || !edition) {
        console.error('[AGILO:RELANCE] ❌ Paramètres invalides pour redoSummary:', {
          jobId: jobId || '(null/undefined)',
          email: email || '(null/undefined)',
          token: token ? '✓ (' + token.length + ' chars)' : '(null/undefined)',
          edition: edition || '(null/undefined)'
        });
        throw new Error('Paramètres invalides pour redoSummary');
      }
      
      // ⚠️ Utiliser GET avec query parameters EXACTEMENT comme Code-main-editor.js
      // Ordre des paramètres : jobId, username, token, edition (comme dans receiveSummary ligne 320)
      const url = `https://api.agilotext.com/api/v1/redoSummary?jobId=${encodeURIComponent(String(jobId))}&username=${encodeURIComponent(String(email))}&token=${encodeURIComponent(String(token))}&edition=${encodeURIComponent(String(edition))}`;
      
      console.log('[AGILO:RELANCE] Envoi requête API redoSummary', {
        url: url.substring(0, 150) + '...',
        method: 'GET',
        jobId: String(jobId),
        edition: String(edition),
        email: String(email).substring(0, 20) + '...',
        emailLength: email ? email.length : 0,
        tokenLength: token ? token.length : 0,
        tokenPreview: token ? token.substring(0, 10) + '...' : '(vide)',
        timestamp: new Date().toISOString()
      });
      
      const apiStartTime = Date.now();
      // ⚠️ Utiliser exactement la même logique que Code-main-editor.js (fetchWithTimeout)
      // Mais comme on n'a pas fetchWithTimeout, on utilise fetch avec les mêmes options
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit'
      });
      const apiTime = Date.now() - apiStartTime;
      
      console.log('[AGILO:RELANCE] ========================================');
      console.log('[AGILO:RELANCE] Réponse HTTP redoSummary reçue:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        timeMs: apiTime,
        headers: Object.fromEntries(response.headers.entries())
      });
      console.log('[AGILO:RELANCE] ========================================');
      
      const result = await response.json();
      
      // Logs détaillés pour le débogage
      console.log('[AGILO:RELANCE] ========================================');
      console.log('[AGILO:RELANCE] Réponse API redoSummary (JSON):', {
        status: result.status,
        httpStatus: response.status,
        responseOk: response.ok,
        message: result.message,
        error: result.error,
        errorMessage: result.errorMessage,
        fullResult: result
      });
      console.log('[AGILO:RELANCE] ========================================');
      
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
        
        // ⚠️ CRITIQUE : Afficher le loader IMMÉDIATEMENT après redoSummary
        // Le loader DOIT rester affiché pendant TOUTE la durée du processus
        console.log('[AGILO:RELANCE] ========================================');
        console.log('[AGILO:RELANCE] 🔄 AFFICHAGE DU LOADER - DÉBUT DU PROCESSUS');
        console.log('[AGILO:RELANCE] ⚠️ CRITIQUE: Le loader doit rester affiché pendant TOUT le processus');
        console.log('[AGILO:RELANCE] ⚠️ CRITIQUE: La page NE DOIT PAS se recharger avant que le nouveau CR soit prêt');
        console.log('[AGILO:RELANCE] ========================================');
        
        // Ouvrir l'onglet Compte-rendu AVANT d'afficher le loader
        openSummaryTab();
        
        // Afficher le loader IMMÉDIATEMENT
        showSummaryLoading();
        console.log('[AGILO:RELANCE] ✅ Loader affiché - Il doit rester visible pendant tout le processus');
        
        // Afficher un message de succès non-bloquant
        showSuccessMessage('Régénération lancée...');
        
        // ⚠️ CRITIQUE : Délai initial de 10 secondes APRÈS redoSummary
        // Nicolas dit que redoSummary est asynchrone et retourne OK pour dire que l'appel est pris en compte
        // Le backend a besoin d'un peu de temps pour démarrer la régénération
        // Mais pas besoin d'attendre 40 secondes - on peut commencer le polling plus tôt
        const initialDelay = 10000; // 10 secondes suffisent pour laisser le backend démarrer
        console.log('[AGILO:RELANCE] ========================================');
        console.log(`[AGILO:RELANCE] ⏳ DÉLAI INITIAL DE ${initialDelay/1000} SECONDES`);
        console.log('[AGILO:RELANCE] ⏳ Nicolas a besoin de temps pour traiter redoSummary');
        console.log('[AGILO:RELANCE] ⏳ On attend AVANT de commencer le polling pour éviter de récupérer l\'ancien statut');
        console.log('[AGILO:RELANCE] ⏳ Le loader reste affiché pendant cette attente');
        console.log('[AGILO:RELANCE] ========================================');
        
        // Afficher un compte à rebours toutes les 5 secondes
        for (let remaining = initialDelay; remaining > 0; remaining -= 5000) {
          const secondsLeft = Math.ceil(remaining / 1000);
          console.log(`[AGILO:RELANCE] ⏳ Attente... ${secondsLeft} secondes restantes (loader toujours affiché)`);
          await new Promise(r => setTimeout(r, Math.min(5000, remaining)));
        }
        
        console.log('[AGILO:RELANCE] ✅ Délai initial terminé - Début du polling');
        
        // Vérifier que summaryEditor existe avant de commencer le polling
        const summaryEditorCheck = document.querySelector('#summaryEditor');
        console.log('[AGILO:RELANCE] 🔍 Vérification summaryEditor:', {
          exists: !!summaryEditorCheck,
          id: summaryEditorCheck ? summaryEditorCheck.id : 'N/A',
          className: summaryEditorCheck ? summaryEditorCheck.className : 'N/A'
        });
        
        if (!summaryEditorCheck) {
          console.warn('[AGILO:RELANCE] ⚠️ summaryEditor n\'existe pas encore - Le polling va quand même démarrer');
          console.warn('[AGILO:RELANCE] ⚠️ Si summaryEditor n\'est pas trouvé à la fin, on rechargera la page');
        }
        
        // ⚠️ IMPORTANT : Vérifier que le compte-rendu est prêt avec getTranscriptStatus
        // et attendre READY_SUMMARY_READY avant d'afficher
        console.log('[AGILO:RELANCE] ========================================');
        console.log('[AGILO:RELANCE] 🚀 DÉBUT POLLING POUR READY_SUMMARY_READY');
        console.log('[AGILO:RELANCE] Paramètres pour polling:', {
          jobId,
          edition,
          emailLength: email ? email.length : 0,
          tokenLength: token ? token.length : 0,
          oldHash: oldHash ? oldHash.substring(0, 30) + '...' : '(aucun)',
          maxAttempts: 120, // ⚠️ 120 tentatives × 3s = 6 minutes max (Nicolas dit que ça peut prendre 2-3 minutes)
          delay: 3000 // ⚠️ 3 secondes entre tentatives pour réduire les appels API
        });
        console.log('[AGILO:RELANCE] ⚠️ CRITIQUE: Le loader reste affiché pendant le polling');
        console.log('[AGILO:RELANCE] ⚠️ CRITIQUE: On attend vraiment READY_SUMMARY_READY avec nouveau hash');
        console.log('[AGILO:RELANCE] ⚠️ CRITIQUE: PAS de rechargement avant la fin du polling');
        console.log('[AGILO:RELANCE] ========================================');
        
        const pollingStartTime = Date.now();
        console.log('[AGILO:RELANCE] 🎬 APPEL waitForSummaryReady() - Début du polling réel');
        console.log('[AGILO:RELANCE] ⚠️ CRITIQUE: waitForPending=true pour s\'assurer qu\'on voit PENDING puis le nouveau READY');
        console.log('[AGILO:RELANCE] ⚠️ CRITIQUE: Délai entre tentatives = 3 secondes pour réduire les appels API');
        console.log('[AGILO:RELANCE] ⚠️ CRITIQUE: Le loader reste affiché pendant TOUT le polling');
        console.log('[AGILO:RELANCE] ⚠️ CRITIQUE: PAS de rechargement avant la fin du polling');
        
        let waitResult;
        try {
          // ⚠️ CRITIQUE : waitForPending=true pour forcer l'attente de READY_SUMMARY_PENDING
          // Cela garantit qu'on ne récupère pas l'ancien compte-rendu
          // ⚠️ IMPORTANT : Nicolas dit que ça peut prendre 2-3 minutes, donc on augmente à 120 tentatives (6 minutes max)
          waitResult = await waitForSummaryReady(jobId, email, token, edition, 120, 3000, oldHash, true);
        } catch (error) {
          console.error('[AGILO:RELANCE] ❌ ERREUR dans waitForSummaryReady:', {
            error: error.message,
            stack: error.stack,
            name: error.name
          });
          waitResult = { ready: false, error: 'EXCEPTION', exception: error.message };
        }
        
        const pollingTime = Date.now() - pollingStartTime;
        
        console.log('[AGILO:RELANCE] ========================================');
        console.log('[AGILO:RELANCE] 🏁 FIN POLLING');
        console.log('[AGILO:RELANCE] Résultat détaillé:', {
          ready: waitResult.ready,
          hasContent: !!waitResult.content,
          contentLength: waitResult.content ? waitResult.content.length : 0,
          hasHash: !!waitResult.hash,
          hash: waitResult.hash ? waitResult.hash.substring(0, 50) + '...' : '(aucun)',
          error: waitResult.error,
          pollingTimeMs: pollingTime,
          pollingTimeSec: Math.round(pollingTime / 1000),
          pollingTimeMin: Math.round(pollingTime / 60000)
        });
        console.log('[AGILO:RELANCE] ========================================');
        
        console.log('[AGILO:RELANCE] 🔍 Analyse du résultat du polling...');
        console.log('[AGILO:RELANCE] waitResult.ready:', waitResult.ready);
        console.log('[AGILO:RELANCE] waitResult.content existe:', !!waitResult.content);
        console.log('[AGILO:RELANCE] waitResult.content length:', waitResult.content ? waitResult.content.length : 0);
        console.log('[AGILO:RELANCE] waitResult.error:', waitResult.error);
        
        if (waitResult.ready && waitResult.content) {
          // ⚠️ AFFICHER LE NOUVEAU COMPTE-RENDU DIRECTEMENT DANS summaryEditor (sans recharger la page)
          console.log('[AGILO:RELANCE] ✅ CAS 1: Nouveau compte-rendu prêt avec contenu ! Affichage direct...');
          console.log('[AGILO:RELANCE] 📏 Longueur du contenu:', waitResult.content.length);
          
          const summaryEditor = document.querySelector('#summaryEditor');
          console.log('[AGILO:RELANCE] 🔍 Recherche summaryEditor:', {
            found: !!summaryEditor,
            selector: '#summaryEditor'
          });
          
          if (summaryEditor) {
            console.log('[AGILO:RELANCE] ✅ summaryEditor trouvé - Affichage du nouveau compte-rendu...');
            // Nettoyer le HTML pour éviter les scripts malveillants
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = waitResult.content;
            
            // Supprimer les scripts et styles
            tempDiv.querySelectorAll('script, style, link[rel="stylesheet"], iframe, object, embed').forEach(n => n.remove());
            
            // Nettoyer les attributs dangereux
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
            
            // Mettre à jour summaryEmpty dans editorRoot si disponible
            const root = document.querySelector('#editorRoot');
            if (root) {
              root.dataset.summaryEmpty = '0';
            }
            
            hideSummaryLoading();
            setGeneratingState(false);
            
            showSuccessMessage('✅ Compte-rendu régénéré avec succès !');
            
            console.log('[AGILO:RELANCE] ✅ Nouveau compte-rendu affiché directement dans summaryEditor');
          } else {
            // ⚠️ CRITIQUE : summaryEditor non trouvé - On NE RECHARGE PAS immédiatement
            // On attend un peu et on réessaye de trouver summaryEditor
            console.warn('[AGILO:RELANCE] ⚠️ CAS 1B: summaryEditor non trouvé');
            console.warn('[AGILO:RELANCE] ⚠️ Le nouveau compte-rendu est prêt mais summaryEditor n\'est pas disponible');
            console.warn('[AGILO:RELANCE] ⚠️ On attend 2 secondes et on réessaye...');
            
            // Attendre 2 secondes et réessayer
            await new Promise(r => setTimeout(r, 2000));
            
            const summaryEditorRetry = document.querySelector('#summaryEditor');
            if (summaryEditorRetry) {
              console.log('[AGILO:RELANCE] ✅ summaryEditor trouvé après attente - Affichage du compte-rendu');
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = waitResult.content;
              tempDiv.querySelectorAll('script, style, link[rel="stylesheet"], iframe, object, embed').forEach(n => n.remove());
              tempDiv.querySelectorAll('*').forEach(n => {
                [...n.attributes].forEach(a => {
                  const name = a.name.toLowerCase();
                  const val = String(a.value || '');
                  if (name.startsWith('on') || /^javascript:/i.test(val)) {
                    n.removeAttribute(a.name);
                  }
                });
              });
              summaryEditorRetry.innerHTML = tempDiv.innerHTML;
              const root = document.querySelector('#editorRoot');
              if (root) {
                root.dataset.summaryEmpty = '0';
              }
              hideSummaryLoading();
              setGeneratingState(false);
              showSuccessMessage('✅ Compte-rendu régénéré avec succès !');
              console.log('[AGILO:RELANCE] ✅ Nouveau compte-rendu affiché après réessai');
              return; // Sortir sans recharger
            } else {
              // Si summaryEditor n'est toujours pas trouvé, on affiche un message
              console.warn('[AGILO:RELANCE] ⚠️ summaryEditor toujours non trouvé après réessai');
              hideSummaryLoading();
              setGeneratingState(false);
              alert('✅ Le compte-rendu a été régénéré avec succès !\n\nVeuillez recharger la page pour voir le nouveau compte-rendu.');
              // On NE RECHARGE PAS automatiquement - L'utilisateur peut recharger manuellement
              return;
            }
          }
        } else if (waitResult.ready && !waitResult.content) {
          // ⚠️ CRITIQUE : Le statut est READY_SUMMARY_READY mais on n'a pas de contenu
          // Cela ne devrait JAMAIS arriver car waitForSummaryReady ne retourne ready:true que si le hash a changé
          // Mais si ça arrive, c'est probablement que le hash n'a pas changé et qu'on a continué le polling
          console.log('[AGILO:RELANCE] ⚠️ CAS 2: READY_SUMMARY_READY détecté mais contenu non récupéré');
          console.log('[AGILO:RELANCE] ⚠️ Cela ne devrait pas arriver - waitForSummaryReady devrait avoir le contenu');
          console.log('[AGILO:RELANCE] ⚠️ Le hash n\'a peut-être pas changé, donc on a continué le polling jusqu\'au timeout');
          console.log('[AGILO:RELANCE] ⚠️ On NE RECHARGE PAS - Le compte-rendu n\'est probablement pas encore prêt');
          
          hideSummaryLoading();
          setGeneratingState(false);
          
          alert('⚠️ Le compte-rendu prend plus de temps que prévu.\n\nLe statut est READY mais le nouveau compte-rendu n\'est pas encore disponible.\n\nVeuillez recharger la page dans quelques instants pour voir le nouveau compte-rendu.');
          return; // Sortir sans recharger
        } else {
          // Timeout ou erreur
          console.warn('[AGILO:RELANCE] ⚠️ CAS 3: Compte-rendu pas prêt après polling');
          console.warn('[AGILO:RELANCE] ⚠️ Détails:', {
            ready: waitResult.ready,
            error: waitResult.error,
            hasContent: !!waitResult.content
          });
          hideSummaryLoading();
          setGeneratingState(false);
          
          if (waitResult.error === 'TIMEOUT') {
            console.warn('[AGILO:RELANCE] ⚠️ TIMEOUT: Le polling a atteint le maximum de tentatives sans obtenir READY_SUMMARY_READY');
            alert('⚠️ Le compte-rendu n\'est pas encore prêt. Il sera disponible dans quelques instants.\n\nVous pouvez recharger la page plus tard.');
          } else if (waitResult.error) {
            console.error('[AGILO:RELANCE] ❌ ERREUR lors du polling:', waitResult.error);
            alert('⚠️ Erreur lors de la génération du compte-rendu.\n\nErreur: ' + waitResult.error + '\n\nVeuillez réessayer.');
          } else {
            console.error('[AGILO:RELANCE] ❌ État inattendu du polling');
            alert('⚠️ État inattendu lors de la génération du compte-rendu.\n\nVeuillez réessayer.');
          }
        }
        
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
   * ⚠️ MODIFIÉ : Vérifie maintenant si un compte-rendu existe via getTranscriptStatus
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
    
    // ⚠️ PRIORITÉ 1 : Vérifier si un compte-rendu existe via getTranscriptStatus
    try {
      const creds = await ensureCreds();
      if (creds.jobId && creds.email && creds.token) {
        const status = await getTranscriptStatus(creds.jobId, creds.email, creds.token, creds.edition);
        
        console.log('[AGILO:RELANCE] Vérification statut pour visibilité:', status);
        
        // Si le statut indique qu'aucun compte-rendu n'existe, cacher le bouton
        if (status === 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS') {
          console.log('[AGILO:RELANCE] ⚠️ Aucun compte-rendu détecté (ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS) - Bouton caché');
          btn.style.display = 'none';
          if (counter) counter.style.display = 'none';
          return;
        }
        
        // Si le statut n'est pas READY_SUMMARY_READY ou READY_SUMMARY_PENDING, cacher le bouton
        if (status !== 'READY_SUMMARY_READY' && status !== 'READY_SUMMARY_PENDING') {
          console.log('[AGILO:RELANCE] ⚠️ Compte-rendu non disponible (statut:', status, ') - Bouton caché');
          btn.style.display = 'none';
          if (counter) counter.style.display = 'none';
          return;
        }
      }
    } catch (error) {
      console.error('[AGILO:RELANCE] Erreur vérification statut:', error);
      // En cas d'erreur, on continue avec la logique normale (ne pas bloquer)
    }
    
    // Gérer la visibilité (si compte-rendu existe)
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
  
  /**
   * Fonction de test console pour tester le polling complet
   * Usage: testPollingSummary(jobId, email, token, edition)
   */
  window.testPollingSummary = async function(jobId, email, token, edition) {
    console.log('🧪 TEST MANUEL - Polling complet pour READY_SUMMARY_READY');
    console.log('Paramètres:', { jobId, email, token: token ? token.substring(0, 10) + '...' : '(vide)', edition });
    
    if (!jobId || !email || !token || !edition) {
      console.error('❌ Paramètres manquants !');
      console.log('Usage: testPollingSummary(jobId, email, token, edition)');
      return;
    }
    
    console.log('⏳ Début du polling (max 10 tentatives, 2 secondes entre chaque)...');
    const result = await waitForSummaryReady(jobId, email, token, edition, 10, 2000, '');
    
    console.log('📊 Résultat final:', result);
    
    if (result.ready && result.content) {
      console.log('✅ SUCCÈS ! Compte-rendu prêt avec contenu');
      console.log('Longueur du contenu:', result.content.length);
      console.log('Hash:', result.hash);
    } else if (result.ready) {
      console.log('⚠️ Statut READY mais pas de contenu récupéré');
    } else {
      console.log('❌ Échec:', result.error);
    }
    
    return result;
  };
  
  /**
   * Fonction de test console pour tester redoSummary + polling
   * Usage: testRedoAndPoll(jobId, email, token, edition)
   */
  window.testRedoAndPoll = async function(jobId, email, token, edition) {
    console.log('🧪 TEST MANUEL - redoSummary + polling complet');
    console.log('Paramètres:', { jobId, email, token: token ? token.substring(0, 10) + '...' : '(vide)', edition });
    
    if (!jobId || !email || !token || !edition) {
      console.error('❌ Paramètres manquants !');
      console.log('Usage: testRedoAndPoll(jobId, email, token, edition)');
      return;
    }
    
    // 1. Appel redoSummary avec GET (EXACTEMENT comme Code-main-editor.js)
    console.log('📤 Étape 1: Appel redoSummary...');
    // Ordre des paramètres : jobId, username, token, edition (comme dans receiveSummary ligne 320)
    const url = `https://api.agilotext.com/api/v1/redoSummary?jobId=${encodeURIComponent(String(jobId))}&username=${encodeURIComponent(String(email))}&token=${encodeURIComponent(String(token))}&edition=${encodeURIComponent(String(edition))}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit'
      });
      
      const result = await response.json();
      console.log('📥 Réponse redoSummary:', {
        status: result.status,
        httpStatus: response.status,
        ok: response.ok,
        fullResult: result
      });
      
      if (result.status === 'OK' || response.ok) {
        console.log('✅ redoSummary OK - Début du polling...');
        
        // 2. Polling
        console.log('⏳ Étape 2: Polling pour READY_SUMMARY_READY (max 10 tentatives)...');
        const pollResult = await waitForSummaryReady(jobId, email, token, edition, 10, 2000, '');
        
        console.log('📊 Résultat polling:', pollResult);
        return { redoSuccess: true, pollResult };
      } else {
        console.error('❌ redoSummary échoué:', result);
        return { redoSuccess: false, error: result };
      }
    } catch (error) {
      console.error('❌ Erreur redoSummary:', error);
      return { redoSuccess: false, error: error.message };
    }
  };
  
  /**
   * Fonction de test console pour récupérer les credentials automatiquement
   * Usage: testGetCreds()
   */
  window.testGetCreds = async function() {
    console.log('🧪 TEST - Récupération automatique des credentials...');
    try {
      const creds = await ensureCreds();
      console.log('✅ Credentials récupérés:', {
        email: creds.email ? '✓ (' + creds.email.length + ' chars)' : '✗',
        token: creds.token ? '✓ (' + creds.token.length + ' chars)' : '✗',
        edition: creds.edition || '✗',
        jobId: creds.jobId || '✗'
      });
      return creds;
    } catch (error) {
      console.error('❌ Erreur récupération credentials:', error);
      return null;
    }
  };
  
  /**
   * Fonction de test console pour tester getTranscriptStatus avec credentials automatiques
   * Usage: testGetTranscriptStatusAuto()
   */
  window.testGetTranscriptStatusAuto = async function() {
    console.log('🧪 TEST MANUEL getTranscriptStatus (credentials automatiques)');
    
    const creds = await window.testGetCreds();
    if (!creds || !creds.email || !creds.token || !creds.jobId || !creds.edition) {
      console.error('❌ Credentials incomplets !');
      return null;
    }
    
    return await testGetTranscriptStatus(creds.jobId, creds.email, creds.token, creds.edition);
  };
  
  /**
   * Fonction de test console pour tester le polling complet avec credentials automatiques
   * Usage: testPollingSummaryAuto()
   */
  window.testPollingSummaryAuto = async function() {
    console.log('🧪 TEST MANUEL - Polling complet pour READY_SUMMARY_READY (credentials automatiques)');
    
    const creds = await window.testGetCreds();
    if (!creds || !creds.email || !creds.token || !creds.jobId || !creds.edition) {
      console.error('❌ Credentials incomplets !');
      return null;
    }
    
    console.log('⏳ Début du polling (max 10 tentatives, 2 secondes entre chaque)...');
    const result = await waitForSummaryReady(creds.jobId, creds.email, creds.token, creds.edition, 10, 2000, '');
    
    console.log('📊 Résultat final:', result);
    
    if (result.ready && result.content) {
      console.log('✅ SUCCÈS ! Compte-rendu prêt avec contenu');
      console.log('Longueur du contenu:', result.content.length);
      console.log('Hash:', result.hash);
    } else if (result.ready) {
      console.log('⚠️ Statut READY mais pas de contenu récupéré');
    } else {
      console.log('❌ Échec:', result.error);
    }
    
    return result;
  };
  
  /**
   * Fonction de test console pour tester redoSummary + polling avec credentials automatiques
   * Usage: testRedoAndPollAuto()
   */
  window.testRedoAndPollAuto = async function() {
    console.log('🧪 TEST MANUEL - redoSummary + polling complet (credentials automatiques)');
    
    const creds = await window.testGetCreds();
    if (!creds || !creds.email || !creds.token || !creds.jobId || !creds.edition) {
      console.error('❌ Credentials incomplets !');
      return null;
    }
    
    return await testRedoAndPoll(creds.jobId, creds.email, creds.token, creds.edition);
  };
  
  // Exposer toutes les fonctions dans window
  window.relancerCompteRendu = relancerCompteRendu;
  window.openSummaryTab = openSummaryTab;
  window.getTranscriptStatus = getTranscriptStatus;
  window.waitForSummaryReady = waitForSummaryReady;
  window.testGetTranscriptStatus = testGetTranscriptStatus;
  window.testPollingSummary = testPollingSummary;
  window.testRedoAndPoll = testRedoAndPoll;
  // Les fonctions testGetCreds, testGetTranscriptStatusAuto, etc. sont déjà assignées à window plus haut
  window.ensureCreds = ensureCreds;
  
  // Log de confirmation que les fonctions sont exposées
  console.log('[AGILO:RELANCE] ✅ Script relance-compte-rendu-TEST.js chargé !');
  console.log('[AGILO:RELANCE] 📋 Fonctions de test disponibles:', {
    testGetCreds: typeof window.testGetCreds !== 'undefined' ? '✓ function' : '✗ undefined',
    testGetTranscriptStatusAuto: typeof window.testGetTranscriptStatusAuto !== 'undefined' ? '✓ function' : '✗ undefined',
    testPollingSummaryAuto: typeof window.testPollingSummaryAuto !== 'undefined' ? '✓ function' : '✗ undefined',
    testRedoAndPollAuto: typeof window.testRedoAndPollAuto !== 'undefined' ? '✓ function' : '✗ undefined',
    testGetTranscriptStatus: typeof window.testGetTranscriptStatus !== 'undefined' ? '✓ function' : '✗ undefined',
    testPollingSummary: typeof window.testPollingSummary !== 'undefined' ? '✓ function' : '✗ undefined',
    testRedoAndPoll: typeof window.testRedoAndPoll !== 'undefined' ? '✓ function' : '✗ undefined',
    relancerCompteRendu: typeof window.relancerCompteRendu !== 'undefined' ? '✓ function' : '✗ undefined',
    getTranscriptStatus: typeof window.getTranscriptStatus !== 'undefined' ? '✓ function' : '✗ undefined',
    waitForSummaryReady: typeof window.waitForSummaryReady !== 'undefined' ? '✓ function' : '✗ undefined'
  });
  
  // Exposer aussi directement pour faciliter l'accès
  if (typeof window.testGetCreds === 'undefined') {
    console.error('[AGILO:RELANCE] ❌ ERREUR: testGetCreds n\'est pas défini !');
  }
})();

