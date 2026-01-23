// Agilotext – Anonymisation Transcript/Compte-rendu
// ⚠️ Ce script permet d'anonymiser le transcript ou le compte-rendu selon l'onglet actif
(function() {
  'use strict';

  const DEBUG = false;
  const log = (...args) => { if (DEBUG) console.log('[AGILO:ANON]', ...args); };
  const logError = (...args) => { console.error('[AGILO:ANON]', ...args); };

  const API_BASE = 'https://api.agilotext.com/api/v1';

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

  async function ensureCreds() {
    const edition = pickEdition();
    const email = pickEmail();
    const token = pickToken(edition, email);
    
    if (!email || !token) {
      logError('Credentials manquants:', { email: !!email, token: !!token });
      return null;
    }
    
    return { username: email, token, edition };
  }

  // ============================================
  // DÉTECTION DE L'ONGLET ACTIF
  // ============================================
  function getActiveTab() {
    const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
    if (!activeTab) return null;
    
    const tabId = activeTab.id || '';
    if (tabId === 'tab-transcript') return 'transcript';
    if (tabId === 'tab-summary') return 'summary';
    if (tabId === 'tab-chat') return 'chat';
    
    return null;
  }

  // ============================================
  // EXTRACTION DU CONTENU
  // ============================================
  function getTranscriptContent() {
    // Méthode 1: Utiliser window._segments si disponible (format structuré)
    if (window._segments && Array.isArray(window._segments) && window._segments.length > 0) {
      return window._segments
        .map(seg => {
          const speaker = (seg.speaker || '').trim();
          const text = (seg.text || '').trim();
          return speaker ? `${speaker}: ${text}` : text;
        })
        .join('\n\n');
    }
    
    // Méthode 2: Extraire depuis l'éditeur DOM
    const transcriptEditor = document.getElementById('transcriptEditor') || 
                            document.querySelector('[data-editor="transcript"]');
    
    if (!transcriptEditor) {
      logError('Éditeur transcript introuvable');
      return null;
    }
    
    // Extraire le texte visible
    if (typeof window.visibleTextFromBox === 'function') {
      return window.visibleTextFromBox(transcriptEditor);
    }
    
    // Fallback: textContent simple
    return transcriptEditor.textContent || transcriptEditor.innerText || '';
  }

  function getSummaryContent() {
    const summaryEditor = document.getElementById('summaryEditor') || 
                         document.getElementById('pane-summary') ||
                         document.querySelector('[data-editor="summary"]');
    
    if (!summaryEditor) {
      logError('Éditeur compte-rendu introuvable');
      return null;
    }
    
    // Pour le compte-rendu, on peut avoir du HTML
    // On extrait le texte mais on peut aussi garder le HTML si nécessaire
    const html = summaryEditor.innerHTML || '';
    
    // Si c'est du HTML, on peut le garder tel quel ou extraire le texte
    // Pour l'anonymisation, on envoie généralement le texte brut
    const textContent = summaryEditor.textContent || summaryEditor.innerText || '';
    
    // Si le HTML est significatif (contient des balises), on peut l'envoyer
    // Sinon, on envoie le texte brut
    if (html && html.trim() && html !== textContent.trim() && html.includes('<')) {
      // On a du HTML, on peut l'envoyer tel quel ou convertir en texte
      // Pour l'API, on va envoyer le texte brut pour simplifier
      return textContent;
    }
    
    return textContent;
  }

  // ============================================
  // FONCTION D'ANONYMISATION
  // ============================================
  async function anonymiser() {
    const activeTab = getActiveTab();
    
    if (!activeTab || activeTab === 'chat') {
      if (window.toast) {
        window.toast('Attention: L\'anonymisation n\'est disponible que sur les onglets Transcription et Compte-rendu');
      } else {
        alert('Attention: L\'anonymisation n\'est disponible que sur les onglets Transcription et Compte-rendu');
      }
      return;
    }
    
    const creds = await ensureCreds();
    if (!creds) {
      if (window.toast) {
        window.toast('Erreur: Authentification manquante');
      } else {
        alert('Erreur: Authentification manquante');
      }
      return;
    }
    
    // Extraire le contenu selon l'onglet
    let content = null;
    let fileName = '';
    
    if (activeTab === 'transcript') {
      content = getTranscriptContent();
      fileName = 'Transcript_anonymise.txt';
    } else if (activeTab === 'summary') {
      content = getSummaryContent();
      fileName = 'Compte-rendu_anonymise.txt';
    }
    
    if (!content || !content.trim()) {
      if (window.toast) {
        window.toast('Attention: Aucun contenu a anonymiser');
      } else {
        alert('Attention: Aucun contenu a anonymiser');
      }
      return;
    }
    
    // Désactiver le bouton pendant le traitement
    const btn = document.querySelector('[data-action="anonymiser"]');
    // Préserver le contenu HTML original (icône + texte)
    const originalHTML = btn?.innerHTML || '';
    const originalTextElement = btn?.querySelector('div, span') || null;
    const originalText = originalTextElement?.textContent || btn?.textContent || '';
    
    if (btn) {
      btn.disabled = true;
      btn.classList.add('is-anonymizing');
      
      // Modifier uniquement le texte, pas l'icône
      if (originalTextElement) {
        originalTextElement.textContent = 'Anonymisation...';
      } else {
        // Fallback si pas de structure HTML : créer un span temporaire
        const tempSpan = document.createElement('span');
        tempSpan.textContent = 'Anonymisation...';
        btn.innerHTML = '';
        btn.appendChild(tempSpan);
      }
    }
    
    try {
      // Préparer FormData
      const formData = new FormData();
      
      // Ajouter le texte en tant que fichier
      const textBlob = new Blob([content], { type: 'text/plain' });
      formData.append('fileUpload1', textBlob, 'content.txt');
      
      // Ajouter les credentials
      formData.append('username', creds.username);
      formData.append('token', creds.token);
      formData.append('edition', creds.edition);
      formData.append('forceTextFormat', 'true');
      
      // Appel API pour récupérer le fichier anonymisé
      const response = await fetch(`${API_BASE}/anonText`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.errorMessage || `Erreur HTTP ${response.status}`;
        throw new Error(errorMsg);
      }
      
      // Récupérer le blob (l'API retourne toujours du .txt)
      const responseBlob = await response.blob();
      
      // Télécharger le fichier avec un nom propre
      const url = window.URL.createObjectURL(responseBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      // Message de succès
      if (window.toast) {
        window.toast(`Fichier anonymise telecharge: ${fileName}`);
      } else {
        console.log(`Fichier anonymise telecharge: ${fileName}`);
      }
      
    } catch (error) {
      logError('Erreur anonymisation:', error);
      const errorMsg = error.message || 'Une erreur est survenue lors de l\'anonymisation';
      
      if (window.toast) {
        window.toast(`Erreur: ${errorMsg}`);
      } else {
        alert(`Erreur: ${errorMsg}`);
      }
    } finally {
      // Réactiver le bouton et restaurer le contenu HTML original
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('is-anonymizing');
        
        // Restaurer le HTML original (icône + texte)
        if (originalHTML) {
          btn.innerHTML = originalHTML;
        } else if (originalTextElement) {
          originalTextElement.textContent = originalText || 'Anonymiser';
        } else {
          btn.textContent = originalText || 'Anonymiser';
        }
      }
    }
  }

  // ============================================
  // RÉCUPÉRATION DU BOUTON EXISTANT (Webflow)
  // ============================================
  function findAnonymizeButton() {
    // Le bouton est créé dans Webflow, on le trouve via data-action
    return document.querySelector('[data-action="anonymiser"]');
  }
  
  function setupAnonymizeButton() {
    const btn = findAnonymizeButton();
    if (!btn) {
      log('Bouton anonymiser non trouvé dans le DOM');
      return null;
    }
    
    // Vérifier si l'event listener est déjà attaché
    if (btn.__anonymiserListenerAttached) {
      log('Event listener déjà attaché');
      return btn;
    }
    
    // Écouter les clics
    const clickHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      log('Clic détecté sur le bouton anonymiser');
      anonymiser();
    };
    
    btn.addEventListener('click', clickHandler);
    btn.__anonymiserListenerAttached = true;
    btn.__anonymiserClickHandler = clickHandler;
    
    log('Bouton anonymiser configure');
    return btn;
  }

  // ============================================
  // GESTION DE LA VISIBILITÉ
  // ============================================
  function updateButtonVisibility() {
    const btn = document.querySelector('[data-action="anonymiser"]');
    if (!btn) return;
    
    const activeTab = getActiveTab();
    
    // Afficher uniquement sur Transcription et Compte-rendu
    if (activeTab === 'transcript' || activeTab === 'summary') {
      btn.style.display = '';
      btn.style.visibility = '';
      btn.style.opacity = '';
      btn.removeAttribute('hidden');
      btn.removeAttribute('aria-hidden');
      
      // Mettre à jour uniquement le title, pas le texte (pour préserver l'icône)
      if (activeTab === 'transcript') {
        btn.title = 'Anonymiser le transcript';
      } else {
        btn.title = 'Anonymiser le compte-rendu';
      }
    } else {
      // Cacher sur les autres onglets
      btn.style.display = 'none';
      btn.style.visibility = 'hidden';
      btn.setAttribute('aria-hidden', 'true');
    }
  }

  // ============================================
  // OBSERVATEUR DES CHANGEMENTS D'ONGLETS
  // ============================================
  function setupTabObserver() {
    // Observer les changements d'attributs aria-selected
    const tabs = document.querySelectorAll('[role="tab"]');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        setTimeout(updateButtonVisibility, 100);
      });
    });
    
    // MutationObserver pour détecter les changements même sans clic
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'aria-selected') {
          shouldUpdate = true;
        }
      });
      if (shouldUpdate) {
        setTimeout(updateButtonVisibility, 50);
      }
    });
    
    tabs.forEach(tab => {
      observer.observe(tab, { attributes: true, attributeFilter: ['aria-selected', 'class'] });
    });
    
    // Observer aussi les panneaux
    const panes = document.querySelectorAll('#pane-chat, #pane-summary, #pane-transcript');
    panes.forEach(pane => {
      observer.observe(pane, { attributes: true, attributeFilter: ['hidden', 'class'] });
    });
  }

  // ============================================
  // INITIALISATION
  // ============================================
  function init() {
    if (window.__agiloAnonymiserInitialized) {
      log('Script déjà initialisé');
      return;
    }
    window.__agiloAnonymiserInitialized = true;
    
    log('Initialisation...');
    
    // Exposer la fonction anonymiser globalement pour debug
    window.agiloAnonymiser = anonymiser;
    window.agiloAnonymiserDebug = {
      getActiveTab,
      getTranscriptContent,
      getSummaryContent,
      findAnonymizeButton,
      updateButtonVisibility
    };
    
    // Attendre que le DOM soit prêt (le bouton est créé dans Webflow)
    let attempts = 0;
    const maxAttempts = 10;
    
    const trySetup = () => {
      attempts++;
      const btn = setupAnonymizeButton();
      if (btn) {
        updateButtonVisibility();
        setupTabObserver();
        log('Bouton configure et initialise');
        return true;
      } else if (attempts < maxAttempts) {
        // Réessayer après un délai
        setTimeout(trySetup, 500);
      } else {
        logError('Impossible de trouver le bouton après', maxAttempts, 'tentatives');
        console.error('[AGILO:ANON] Bouton non trouvé. Vérifiez que data-action="anonymiser" est présent dans Webflow.');
      }
      return false;
    };
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', trySetup, { once: true });
    } else {
      // Essayer immédiatement puis avec des délais
      trySetup();
    }
  }

  // Démarrer
  init();
})();

