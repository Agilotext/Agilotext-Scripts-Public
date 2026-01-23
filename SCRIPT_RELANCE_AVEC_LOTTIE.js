<script>
(function() {
  'use strict';
  
  // ============================================
  // RÉCUPÉRATION DES CREDENTIALS
  // ============================================
  
  function pickEdition() {
    const root = document.querySelector('#editorRoot');
    const qs = new URLSearchParams(location.search).get('edition');
    const html = document.documentElement.getAttribute('data-edition');
    const ls = localStorage.getItem('agilo:edition');
    const v = String(qs || root?.dataset.edition || html || ls || 'ent').trim().toLowerCase();
    if (/(^ent$|enterprise|entreprise|business|team|biz)/.test(v)) return 'ent';
    if (/^pro/.test(v)) return 'pro';
    if (/^free|gratuit/.test(v)) return 'free';
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
   * Vérifier si l'utilisateur peut régénérer
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
   * Mettre à jour l'état du bouton selon les limites
   * Intègre AgiloGate pour Free (désactive + badge)
   */
  function updateButtonState(jobId, edition) {
    const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
    if (!btn) return;
    
    const canRegen = canRegenerate(jobId, edition);
    
    // Pour Free : désactiver complètement et ajouter badge AgiloGate
    if (canRegen.reason === 'free') {
      btn.disabled = true;
      btn.setAttribute('aria-disabled', 'true');
      btn.setAttribute('data-plan-min', 'pro');
      btn.setAttribute('data-upgrade-reason', 'Régénération de compte-rendu');
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
      
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
   * Afficher un indicateur de chargement dans l'onglet Compte-rendu
   * Utilise l'animation Lottie existante (#loading-summary)
   */
  function showSummaryLoading() {
    const summaryPane = document.querySelector('#pane-summary');
    const summaryEditor = document.querySelector('#summaryEditor');
    
    if (!summaryPane || !summaryEditor) return;
    
    // Chercher l'élément Lottie existant (peut être ailleurs dans le DOM)
    let lottieElement = document.querySelector('#loading-summary');
    
    // Si l'élément Lottie n'existe pas, le créer avec les mêmes attributs que votre HTML
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
    }
    
    // Créer le conteneur de chargement
    let loaderContainer = summaryEditor.querySelector('.summary-loading-indicator');
    
    if (!loaderContainer) {
      loaderContainer = document.createElement('div');
      loaderContainer.className = 'summary-loading-indicator';
      
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
    } else {
      // Si le conteneur existe déjà, juste ajouter l'animation Lottie si elle n'y est pas
      if (!loaderContainer.contains(lottieElement)) {
        loaderContainer.insertBefore(lottieElement, loaderContainer.firstChild);
      }
    }
    
    // Afficher le conteneur et l'animation
    loaderContainer.style.display = 'flex';
    lottieElement.style.display = 'block';
    
    // Déclencher l'animation Lottie si Webflow l'a initialisé
    if (window.Webflow && window.Webflow.require) {
      try {
        window.Webflow.require('ix2').init();
      } catch (e) {
        // Webflow IX2 gérera automatiquement l'animation via data-attributes
      }
    }
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
    
    if (lottieElement && !document.querySelector('.summary-loading-indicator')) {
      // Si l'élément Lottie n'est plus dans le loader, le cacher
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
    
    alert(fullMessage);
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
    if (isGenerating) return;
    
    let creds;
    try {
      creds = await ensureCreds();
    } catch (error) {
      console.error('Erreur récupération credentials:', error);
      alert('❌ Erreur : Impossible de récupérer les informations de connexion.\n\nVeuillez réessayer.');
      return;
    }
    
    const { email, token, edition, jobId } = creds;
    
    if (!email || !token || !jobId) {
      alert('❌ Erreur : Informations incomplètes.\n\nEmail: ' + (email ? '✓' : '✗') + '\nToken: ' + (token ? '✓' : '✗') + '\nJobId: ' + (jobId ? '✓' : '✗'));
      return;
    }
    
    // Vérifier les limites AVANT la confirmation
    const canRegen = canRegenerate(jobId, edition);
    
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
    
    const confirmed = confirm(getConfirmationMessage());
    if (!confirmed) return;
    
    setGeneratingState(true);
    
    try {
      const formData = new FormData();
      formData.append('username', email);
      formData.append('token', token);
      formData.append('edition', edition);
      formData.append('jobId', jobId);
      
      const response = await fetch('https://api.agilotext.com/api/v1/redoSummary', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (result.status === 'OK' || response.ok) {
        // Incrémenter le compteur de régénérations
        incrementRegenerationCount(jobId, edition);
        
        // Mettre à jour l'état du bouton après régénération
        updateButtonState(jobId, edition);
        
        alert('✅ Compte-rendu régénéré avec succès !\n\nL\'onglet Compte-rendu va s\'ouvrir...');
        
        openSummaryTab();
        
        // Attendre un délai plus long pour laisser le backend finir
        setTimeout(() => {
          const url = new URL(window.location.href);
          url.searchParams.set('tab', 'summary');
          window.location.href = url.toString();
        }, 3000); // 3 secondes au lieu de 1.5
        
      } else {
        handleError(null, result);
      }
      
    } catch (error) {
      console.error('Erreur API:', error);
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
   */
  function updateButtonVisibility() {
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
    
    // Récupérer l'édition et le jobId pour vérifier les limites
    const edition = pickEdition();
    const jobId = pickJobId();
    
    // Mettre à jour l'état du bouton selon les limites
    updateButtonState(jobId, edition);
    
    if (isSummaryTab) {
      btn.style.display = 'flex';
    } else if (isTranscriptTab && transcriptModified) {
      btn.style.display = 'flex';
    } else {
      btn.style.display = 'none';
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
    
    // Ajouter tooltip sur le bouton
    const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
    if (btn) {
      btn.title = 'Régénérer le compte-rendu (Ctrl+Shift+R)';
    }
  }
  
  /**
   * Initialisation
   */
  function init() {
    document.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-action="relancer-compte-rendu"]');
      if (btn && !btn.disabled) {
        e.preventDefault();
        relancerCompteRendu();
      }
    });
    
    const saveBtn = document.querySelector('[data-action="save-transcript"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        transcriptModified = true;
        updateButtonVisibility();
      });
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
    
    // Observer les changements de jobId pour mettre à jour l'état du bouton
    let lastJobId = pickJobId();
    const jobIdObserver = new MutationObserver(function() {
      const currentJobId = pickJobId();
      if (currentJobId && currentJobId !== lastJobId) {
        lastJobId = currentJobId;
        updateButtonVisibility();
      }
    });
    
    // Observer les changements dans l'URL et le DOM
    const urlObserver = () => {
      const currentJobId = pickJobId();
      if (currentJobId && currentJobId !== lastJobId) {
        lastJobId = currentJobId;
        updateButtonVisibility();
      }
    };
    
    // Observer les changements d'URL
    let lastUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        urlObserver();
      }
    }, 500);
    
    // Observer les changements dans le DOM (pour les changements de jobId via dataset)
    const rootElement = document.querySelector('#editorRoot');
    if (rootElement) {
      jobIdObserver.observe(rootElement, { attributes: true, attributeFilter: ['data-job-id'] });
    }
    
    updateButtonVisibility();
    
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
  
  // Ajouter les styles CSS pour le loader (respectant votre design system Agilo)
  if (!document.querySelector('#relance-summary-styles')) {
    const style = document.createElement('style');
    style.id = 'relance-summary-styles';
    style.textContent = `
      /* Conteneur de chargement - utilise vos variables CSS Agilo */
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
      .summary-loading-indicator #loading-summary {
        width: 88px;
        height: 88px;
        margin: 0 auto 24px;
      }
      
      /* Texte de chargement - utilise vos styles de texte */
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
      
      /* Respecte "réduire les animations" (comme votre CSS) */
      @media (prefers-reduced-motion: reduce) {
        .summary-loading-indicator {
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
</script>

