<script>
(function() {
  'use strict';
  
  // ============================================
  // RÉCUPÉRATION DES CREDENTIALS
  // Utilise exactement les mêmes fonctions que votre script de sauvegarde
  // ============================================
  
  /**
   * Récupérer l'édition (même logique que votre script)
   */
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
  
  /**
   * Récupérer le jobId (même logique que votre script)
   */
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
  
  /**
   * Récupérer l'email (même logique que votre script)
   */
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
  
  /**
   * Récupérer le token (même logique que votre script)
   */
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
  
  /**
   * S'assurer d'avoir un token (même logique que votre script)
   */
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
  
  /**
   * Récupérer toutes les credentials (même logique que votre script)
   */
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
  
  /**
   * Ouvrir l'onglet Compte-rendu
   */
  function openSummaryTab() {
    const summaryTab = document.querySelector('#tab-summary');
    if (summaryTab) {
      // Cliquer sur l'onglet pour l'activer
      summaryTab.click();
      
      // Alternative : activation programmatique si le click ne fonctionne pas
      // Décommenter si le click() ne fonctionne pas
      /*
      summaryTab.setAttribute('aria-selected', 'true');
      summaryTab.setAttribute('tabindex', '0');
      summaryTab.classList.add('is-active');
      
      const transcriptTab = document.querySelector('#tab-transcript');
      if (transcriptTab) {
        transcriptTab.setAttribute('aria-selected', 'false');
        transcriptTab.setAttribute('tabindex', '-1');
        transcriptTab.classList.remove('is-active');
      }
      
      const summaryPane = document.querySelector('#pane-summary');
      const transcriptPane = document.querySelector('#pane-transcript');
      if (summaryPane) {
        summaryPane.removeAttribute('hidden');
        summaryPane.classList.add('is-active');
      }
      if (transcriptPane) {
        transcriptPane.setAttribute('hidden', '');
        transcriptPane.classList.remove('is-active');
      }
      */
    }
  }
  
  /**
   * Fonction principale pour relancer le compte-rendu
   */
  async function relancerCompteRendu() {
    // Vérifier qu'on n'est pas déjà en train de générer
    if (isGenerating) {
      return;
    }
    
    // Confirmation avec pop-up navigateur
    const confirmed = confirm(
      'Le compte-rendu actuel sera remplacé par une nouvelle version.\n\n' +
      'Voulez-vous continuer ?'
    );
    
    if (!confirmed) {
      return;
    }
    
    // Récupérer les credentials (même méthode que votre script de sauvegarde)
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
    
    // Désactiver le bouton
    setGeneratingState(true);
    
    try {
      // Préparer les données
      const formData = new FormData();
      formData.append('username', email);
      formData.append('token', token);
      formData.append('edition', edition);
      formData.append('jobId', jobId);
      
      // Appel API
      const response = await fetch('https://api.agilotext.com/api/v1/redoSummary', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      // Vérifier le résultat
      if (result.status === 'OK' || response.ok) {
        // Succès - ouvrir l'onglet Compte-rendu puis recharger
        alert('✅ Compte-rendu régénéré avec succès !\n\nL\'onglet Compte-rendu va s\'ouvrir...');
        
        // Ouvrir l'onglet Compte-rendu immédiatement
        openSummaryTab();
        
        // Recharger la page après 1.5 secondes (pour laisser le temps au backend)
        setTimeout(() => {
          // Sauvegarder dans l'URL que l'onglet Compte-rendu doit être ouvert
          const url = new URL(window.location.href);
          url.searchParams.set('tab', 'summary');
          window.location.href = url.toString();
        }, 1500);
        
      } else {
        // Erreur
        const errorMsg = result.message || result.errorMessage || result.error || 'Impossible de régénérer le compte-rendu';
        alert('❌ Erreur : ' + errorMsg);
        setGeneratingState(false);
      }
      
    } catch (error) {
      console.error('Erreur API:', error);
      alert('❌ Erreur lors de la régénération.\n\nVeuillez réessayer plus tard.');
      setGeneratingState(false);
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
    } else {
      btn.disabled = false;
      btn.setAttribute('aria-disabled', 'false');
      if (textDiv) {
        textDiv.textContent = getButtonText();
      }
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
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
    
    // Mettre à jour le texte
    const textDiv = btn.querySelector('div');
    if (textDiv) {
      textDiv.textContent = getButtonText();
    }
    
    // Gérer la visibilité
    if (isSummaryTab) {
      // Toujours visible sur l'onglet Compte-rendu
      btn.style.display = 'flex';
    } else if (isTranscriptTab && transcriptModified) {
      // Visible sur Transcription uniquement si transcript modifié
      btn.style.display = 'flex';
    } else {
      // Caché sur les autres onglets
      btn.style.display = 'none';
    }
  }
  
  /**
   * Initialisation
   */
  function init() {
    // Écouter les clics sur le bouton "Relancer"
    document.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-action="relancer-compte-rendu"]');
      if (btn && !btn.disabled) {
        e.preventDefault();
        relancerCompteRendu();
      }
    });
    
    // Écouter la sauvegarde du transcript
    const saveBtn = document.querySelector('[data-action="save-transcript"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        transcriptModified = true;
        updateButtonVisibility();
        // Le bouton "Régénérer" sera visible, l'utilisateur peut cliquer s'il le souhaite
      });
    }
    
    // Écouter les changements d'onglets
    const tabs = document.querySelectorAll('[role="tab"]');
    tabs.forEach(tab => {
      tab.addEventListener('click', function() {
        // Attendre que l'onglet soit activé
        setTimeout(updateButtonVisibility, 100);
      });
    });
    
    // Observer les changements d'attribut aria-selected (pour les changements programmatiques)
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
    
    // Initialiser la visibilité au chargement
    updateButtonVisibility();
    
    // Ouvrir l'onglet Compte-rendu si demandé dans l'URL (après régénération)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tab') === 'summary') {
      setTimeout(() => {
        openSummaryTab();
        // Nettoyer l'URL après ouverture
        urlParams.delete('tab');
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.history.replaceState({}, '', newUrl);
      }, 300);
    }
  }
  
  // Démarrer quand le DOM est prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Exposer la fonction globalement si besoin
  window.relancerCompteRendu = relancerCompteRendu;
  window.openSummaryTab = openSummaryTab;
})();
</script>

