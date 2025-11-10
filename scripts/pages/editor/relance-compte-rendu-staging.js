// Agilotext – Relance Compte-Rendu (Version Simplifiée)
// ⚠️ Ce fichier est chargé depuis GitHub
(function() {
  'use strict';
  
  const DEBUG = false; // Mettre à true pour activer les logs détaillés
  const log = (...args) => DEBUG && console.log('[AGILO:RELANCE]', ...args);
  const logError = (...args) => console.error('[AGILO:RELANCE]', ...args);
  
  // ============================================
  // HELPERS GÉNÉRIQUES
  // ============================================
  
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  
  // ============================================
  // CREDENTIALS (Simplifié)
  // ============================================
  
  function pickEdition() {
    const raw = window.AGILO_EDITION || new URLSearchParams(location.search).get('edition') 
      || $('#editorRoot')?.dataset.edition || localStorage.getItem('agilo:edition') || 'ent';
    const v = String(raw).toLowerCase().trim();
    if (['enterprise', 'entreprise', 'business', 'team', 'ent'].includes(v)) return 'ent';
    if (v.startsWith('pro')) return 'pro';
    if (v.startsWith('free') || v === 'gratuit') return 'free';
    return 'ent';
  }
  
  function pickJobId() {
    const u = new URL(location.href);
    const root = $('#editorRoot');
    return u.searchParams.get('jobId') || root?.dataset.jobId 
      || window.__agiloOrchestrator?.currentJobId || $('.rail-item.is-active')?.dataset?.jobId || '';
  }
  
  function pickEmail() {
    const root = $('#editorRoot');
    return root?.dataset.username || $('[name="memberEmail"]')?.value || window.memberEmail
      || window.__agiloOrchestrator?.credentials?.email || localStorage.getItem('agilo:username')
      || $('[data-ms-member="email"]')?.textContent || '';
  }
  
  function pickToken(edition, email) {
    const root = $('#editorRoot');
    const k = `agilo:token:${edition}:${String(email || '').toLowerCase()}`;
    return root?.dataset.token || window.__agiloOrchestrator?.credentials?.token || window.globalToken
      || localStorage.getItem(k) || localStorage.getItem(`agilo:token:${edition}`) || localStorage.getItem('agilo:token') || '';
  }
  
  async function ensureToken(email, edition) {
    if (pickToken(edition, email)) return pickToken(edition, email);
    if (typeof window.getToken === 'function' && email) {
      try { window.getToken(email, edition); } catch (_) {}
      for (let i = 0; i < 80; i++) {
        const t = pickToken(edition, email);
        if (t) return t;
        await wait(100);
      }
    }
    if (email) {
      try {
        const r = await fetch(`https://api.agilotext.com/api/v1/getToken?username=${encodeURIComponent(email)}&edition=${encodeURIComponent(edition)}`);
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
      await wait(100);
      email = pickEmail();
    }
    const token = await ensureToken(email, edition);
    let jobId = pickJobId();
    for (let i = 0; i < 10 && !jobId; i++) {
      await wait(60);
      jobId = pickJobId();
    }
    return { email: (email || '').trim(), token: (token || '').trim(), edition, jobId: String(jobId || '').trim() };
  }
  
  // ============================================
  // HELPERS BOUTON (Factorisé)
  // ============================================
  
  function hideButton(btn, reason = '') {
    if (!btn) return;
    log('Cache bouton:', reason);
    btn.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; position: absolute !important; left: -9999px !important; width: 0 !important; height: 0 !important; pointer-events: none !important;';
    btn.classList.add('agilo-force-hide');
    const counter = btn.parentElement?.querySelector('.regeneration-counter, .regeneration-limit-message, .regeneration-premium-message');
    if (counter) counter.style.setProperty('display', 'none', 'important');
  }
  
  function showButton(btn) {
    if (!btn) return;
    btn.style.display = 'flex';
    btn.style.removeProperty('visibility');
    btn.style.removeProperty('opacity');
    btn.style.removeProperty('position');
    btn.style.removeProperty('left');
    btn.style.removeProperty('width');
    btn.style.removeProperty('height');
    btn.classList.remove('agilo-force-hide');
  }
  
  // ============================================
  // VÉRIFICATION ERREUR DOM (Simplifié)
  // ============================================
  
  const ERROR_PATTERNS = [
    'error_summary_transcript_file_not_exists',
    'pas encore disponible',
    'fichier manquant',
    'non publié',
    'n\'est pas encore disponible',
    'nest pas encore disponible',
    'compte-rendu n\'est pas encore disponible',
    'compte rendu n\'est pas encore disponible'
  ];
  
  function checkSummaryErrorInDOM() {
    const checkText = (text) => {
      const lower = (text || '').toLowerCase();
      return ERROR_PATTERNS.some(pattern => lower.includes(pattern));
    };
    
    // Vérifier les alertes
    for (const alert of $$('.ag-alert, .ag-alert__title')) {
      if (checkText(alert.textContent || alert.innerHTML)) return true;
    }
    
    // Vérifier les conteneurs
    const pane = $('#pane-summary');
    const editor = $('#summaryEditor');
    if (checkText(pane?.textContent) || checkText(editor?.textContent)) return true;
    
    return false;
  }
  
  // ============================================
  // VÉRIFICATION EXISTENCE COMPTE-RENDU (Simplifié)
  // ============================================
  
  async function checkSummaryExists(jobId, email, token, edition) {
    // Vérifier d'abord le DOM (plus rapide)
    if (checkSummaryErrorInDOM()) {
      log('Erreur détectée dans DOM');
      return false;
    }
    
    try {
      const url = `https://api.agilotext.com/api/v1/receiveSummary?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}&format=html&_t=${Date.now()}`;
      const response = await fetch(url, { method: 'GET', cache: 'no-store', headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' } });
      
      const contentType = response.headers.get('content-type') || '';
      let text = '';
      
      if (contentType.includes('application/json')) {
        const json = await response.json();
        if (json.errorMessage === 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS' || (json.status === 'KO' && /ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS/i.test(json.errorMessage))) {
          return false;
        }
        text = JSON.stringify(json);
      } else {
        text = await response.text();
      }
      
      if (!response.ok) return false;
      
      // Vérifier que ce n'est pas un message d'erreur
      const lower = text.toLowerCase();
      const isError = ERROR_PATTERNS.some(p => lower.includes(p)) 
        || /ag-alert.*pas encore disponible/i.test(text)
        || (text.length < 500 && lower.includes('pas encore disponible'));
      
      return !isError && text.length > 100;
    } catch (error) {
      logError('Erreur vérification existence:', error);
      return false;
    }
  }
  
  // ============================================
  // SYSTÈME DE LIMITES
  // ============================================
  
  function getRegenerationLimit(edition) {
    const ed = String(edition || '').toLowerCase().trim();
    if (ed.startsWith('pro')) return 2;
    if (['ent', 'business', 'enterprise', 'entreprise', 'team'].includes(ed)) return 4;
    return 0;
  }
  
  function getRegenerationCount(jobId) {
    if (!jobId) return 0;
    try {
      const data = JSON.parse(localStorage.getItem('agilo:regenerations') || '{}');
      return data[jobId]?.count || 0;
    } catch { return 0; }
  }
  
  function incrementRegenerationCount(jobId, edition) {
    if (!jobId) return;
    try {
      const data = JSON.parse(localStorage.getItem('agilo:regenerations') || '{}');
      if (!data[jobId]) data[jobId] = { count: 0, max: getRegenerationLimit(edition), edition, lastReset: new Date().toISOString() };
      data[jobId].count += 1;
      data[jobId].lastUsed = new Date().toISOString();
      localStorage.setItem('agilo:regenerations', JSON.stringify(data));
    } catch (e) { logError('Erreur sauvegarde compteur:', e); }
  }
  
  function canRegenerate(jobId, edition) {
    const ed = String(edition || '').toLowerCase().trim();
    if (ed.startsWith('free') || ed === 'gratuit') return { allowed: false, reason: 'free' };
    const limit = getRegenerationLimit(edition);
    const count = getRegenerationCount(jobId);
    if (count >= limit) return { allowed: false, reason: 'limit', count, limit };
    return { allowed: true, count, limit, remaining: limit - count };
  }
  
  // ============================================
  // COMPTEUR & ÉTAT BOUTON
  // ============================================
  
  function updateRegenerationCounter(jobId, edition) {
    const btn = $('[data-action="relancer-compte-rendu"]');
    if (!btn) return;
    
    // Vérifier erreur DOM
    if (checkSummaryErrorInDOM()) {
      hideButton(btn, 'Erreur dans DOM');
      return;
    }
    
    // Supprimer anciens éléments
    $$('.regeneration-counter, .regeneration-limit-message, .regeneration-premium-message', btn.parentElement).forEach(el => el.remove());
    
    const canRegen = canRegenerate(jobId, edition);
    if (canRegen.reason === 'free') return;
    
    if (canRegen.reason === 'limit') {
      const planName = ['ent', 'business'].includes(edition) ? 'Business' : 'Pro';
      const limitMsg = document.createElement('div');
      limitMsg.className = 'regeneration-limit-message';
      let upgradeBtn = '';
      if (edition === 'pro' && window.AgiloGate?.showUpgrade) {
        upgradeBtn = `<button class="button bleu" style="margin-top: 8px; width: 100%;" data-plan-min="ent" data-upgrade-reason="Régénération de compte-rendu - Limite augmentée">Passer en Business (4 régénérations)</button>`;
      }
      limitMsg.innerHTML = `<span style="font-size: 16px;">⚠️</span><div><strong>Limite atteinte</strong><div style="font-size: 12px; margin-top: 2px; color: var(--agilo-dim, #525252);">Vous avez utilisé ${canRegen.count}/${canRegen.limit} régénération${canRegen.limit > 1 ? 's' : ''} pour ce transcript (plan ${planName})</div>${upgradeBtn}</div>`;
      btn.parentElement.appendChild(limitMsg);
      if (upgradeBtn && window.AgiloGate?.decorate) setTimeout(() => window.AgiloGate.decorate(), 100);
      return;
    }
    
    const counter = document.createElement('div');
    counter.className = `regeneration-counter ${canRegen.remaining <= canRegen.limit * 0.5 ? 'has-warning' : ''}`;
    counter.textContent = `${canRegen.remaining}/${canRegen.limit} régénérations restantes`;
    counter.title = `Il vous reste ${canRegen.remaining} régénération${canRegen.remaining > 1 ? 's' : ''} pour ce transcript`;
    btn.parentElement.appendChild(counter);
  }
  
  function updateButtonState(jobId, edition) {
    const btn = $('[data-action="relancer-compte-rendu"]');
    if (!btn) return;
    const canRegen = canRegenerate(jobId, edition);
    
    if (canRegen.reason === 'free') {
      btn.disabled = false;
      btn.removeAttribute('aria-disabled');
      btn.setAttribute('data-plan-min', 'pro');
      btn.setAttribute('data-upgrade-reason', 'Régénération de compte-rendu');
      btn.style.opacity = '0.5';
      btn.style.cursor = 'pointer';
      if (window.AgiloGate?.decorate) window.AgiloGate.decorate();
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
  // VISIBILITÉ BOUTON (Simplifié)
  // ============================================
  
  let transcriptModified = false;
  
  async function updateButtonVisibility() {
    const btn = $('[data-action="relancer-compte-rendu"]');
    if (!btn) return;
    
    const activeTab = $('[role="tab"][aria-selected="true"]');
    if (!activeTab) return;
    
    const isSummaryTab = activeTab.id === 'tab-summary';
    const isTranscriptTab = activeTab.id === 'tab-transcript';
    
    // Vérifier erreur DOM (priorité absolue)
    if (checkSummaryErrorInDOM()) {
      hideButton(btn, 'Erreur dans DOM');
      return;
    }
    
    // Sur onglet Transcription, cacher par défaut
    if (isTranscriptTab) {
      hideButton(btn, 'Onglet Transcription');
    }
    
    // Vérifier existence compte-rendu
    try {
      const creds = await ensureCreds();
      if (!creds.jobId || !creds.edition) {
        hideButton(btn, 'Credentials manquants');
        return;
      }
      
      const summaryExists = await checkSummaryExists(creds.jobId, creds.email, creds.token, creds.edition);
      
      if (!summaryExists) {
        hideButton(btn, 'Compte-rendu inexistant');
        if (isSummaryTab && !$('.regeneration-no-summary-message', btn.parentElement)) {
          const msg = document.createElement('div');
          msg.className = 'regeneration-no-summary-message';
          msg.innerHTML = `<span style="font-size: 16px;">ℹ️</span><div><strong>Générez d'abord un compte-rendu</strong><div style="font-size: 12px; margin-top: 2px; color: var(--agilo-dim, #525252);">Utilisez le formulaire d'upload avec l'option "Générer le compte-rendu" activée</div></div>`;
          btn.parentElement.appendChild(msg);
        }
        return;
      }
      
      // Vérifier encore le DOM après l'API
      if (checkSummaryErrorInDOM()) {
        hideButton(btn, 'Erreur détectée après API');
        return;
      }
      
      // Afficher selon l'onglet
      if (isSummaryTab) {
        showButton(btn);
        if (!transcriptModified) {
          btn.disabled = true;
          btn.setAttribute('aria-disabled', 'true');
          btn.style.opacity = '0.5';
          btn.style.cursor = 'not-allowed';
          btn.title = 'Sauvegardez d\'abord le transcript pour régénérer le compte-rendu';
        }
      } else if (isTranscriptTab && transcriptModified) {
        // Vérifier encore une fois avant d'afficher sur onglet Transcription
        if (!checkSummaryErrorInDOM()) {
          showButton(btn);
        }
      } else {
        hideButton(btn, 'Autre onglet ou transcript non modifié');
      }
    } catch (e) {
      logError('Erreur updateButtonVisibility:', e);
      hideButton(btn, 'Erreur');
    }
  }
  
  // ============================================
  // FONCTION PRINCIPALE
  // ============================================
  
  let isGenerating = false;
  
  function getContentHash(text) {
    if (!text || text.length < 100) return '';
    const start = text.substring(0, 200).replace(/\s/g, '').substring(0, 50);
    const middle = text.length > 500 ? text.substring(Math.floor(text.length / 2), Math.floor(text.length / 2) + 200).replace(/\s/g, '').substring(0, 50) : '';
    const end = text.length > 300 ? text.substring(text.length - 200).replace(/\s/g, '').substring(0, 50) : '';
    return `${text.length}_${start}_${middle}_${end}`;
  }
  
  async function waitForSummaryReady(jobId, email, token, edition, maxAttempts = 50, baseDelay = 2000, oldContentHash = null) {
    await wait(3000); // Délai initial
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Vérifier statut
        const statusUrl = `https://api.agilotext.com/api/v1/getTranscriptStatus?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}`;
        const statusResponse = await fetch(statusUrl, { method: 'GET', cache: 'no-store' });
        let transcriptStatus = null;
        if (statusResponse.ok) {
          try {
            transcriptStatus = (await statusResponse.json()).transcriptStatus;
          } catch (_) {}
        }
        
        // Vérifier contenu
        const url = `https://api.agilotext.com/api/v1/receiveSummary?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}&format=html&_t=${Date.now()}`;
        const response = await fetch(url, { method: 'GET', cache: 'no-store', headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' } });
        
        const contentType = response.headers.get('content-type') || '';
        let text = '';
        
        if (contentType.includes('application/json')) {
          const json = await response.json();
          if (/READY_SUMMARY_PENDING|NOT_READY|PENDING/i.test(json.errorMessage || json.status || '')) {
            await wait(baseDelay * Math.pow(1.3, attempt - 1));
            continue;
          }
          text = JSON.stringify(json);
        } else {
          text = await response.text();
        }
        
        if (response.ok && !ERROR_PATTERNS.some(p => text.toLowerCase().includes(p)) && text.length > 100) {
          const newHash = getContentHash(text);
          if (oldContentHash && newHash === oldContentHash) {
            await wait(baseDelay * Math.pow(1.3, attempt - 1));
            continue;
          }
          if (!transcriptStatus || transcriptStatus === 'READY_SUMMARY_READY') {
            log('Nouveau compte-rendu disponible');
            return { ready: true, contentHash: newHash, text };
          }
        }
        
        await wait(baseDelay * Math.pow(1.3, attempt - 1));
      } catch (error) {
        logError('Erreur vérification:', error);
        await wait(baseDelay * Math.pow(1.3, attempt - 1));
      }
    }
    
    return { ready: false, contentHash: null };
  }
  
  async function relancerCompteRendu() {
    if (isGenerating) return;
    const now = Date.now();
    if (relancerCompteRendu._lastClick && (now - relancerCompteRendu._lastClick) < 500) return;
    relancerCompteRendu._lastClick = now;
    
    let creds;
    try {
      creds = await ensureCreds();
    } catch (error) {
      logError('Erreur récupération credentials:', error);
      alert('❌ Erreur : Impossible de récupérer les informations de connexion.');
      return;
    }
    
    const { email, token, edition, jobId } = creds;
    if (!email || !token || !jobId) {
      alert('❌ Erreur : Informations incomplètes.');
      return;
    }
    
    const canRegen = canRegenerate(jobId, edition);
    if (!canRegen.allowed) {
      if (canRegen.reason === 'free') {
        if (window.AgiloGate?.showUpgrade) {
          window.AgiloGate.showUpgrade('pro', 'Régénération de compte-rendu');
        } else {
          alert('🔒 Fonctionnalité Premium\n\nLa régénération de compte-rendu est disponible pour les plans Pro et Business.');
        }
      } else if (canRegen.reason === 'limit') {
        const planName = ['ent', 'business'].includes(edition) ? 'Business' : 'Pro';
        const msg = `⚠️ Limite atteinte\n\nVous avez utilisé ${canRegen.count}/${canRegen.limit} régénérations pour ce transcript.\n\nLa limite est de ${canRegen.limit} régénération${canRegen.limit > 1 ? 's' : ''} par audio (jobId).`;
        if (edition === 'pro' && window.AgiloGate?.showUpgrade) {
          if (confirm(msg + '\n\nSouhaitez-vous passer en Business pour avoir 4 régénérations ?')) {
            window.AgiloGate.showUpgrade('ent', 'Régénération de compte-rendu - Limite augmentée');
          }
        } else {
          alert(msg);
        }
      }
      return;
    }
    
    const confirmed = confirm('Le compte-rendu actuel sera remplacé par une nouvelle version.\n\nVoulez-vous continuer ?\n\nIl vous reste ' + canRegen.remaining + '/' + canRegen.limit + ' régénération' + (canRegen.remaining > 1 ? 's' : '') + ' pour ce transcript.');
    if (!confirmed) return;
    
    const summaryExists = await checkSummaryExists(jobId, email, token, edition);
    let oldContentHash = null;
    if (summaryExists) {
      try {
        const r = await fetch(`https://api.agilotext.com/api/v1/receiveSummary?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}&format=html&_t=${Date.now()}`, { method: 'GET', cache: 'no-store' });
        if (r.ok) {
          const text = await r.text();
          if (text && text.length > 100 && !text.includes('pas encore disponible')) {
            oldContentHash = getContentHash(text);
          }
        }
      } catch (_) {}
    }
    
    if (!summaryExists) {
      if (!confirm('⚠️ Aucun compte-rendu existant détecté.\n\nVoulez-vous quand même essayer de régénérer ?')) return;
    }
    
    isGenerating = true;
    const btn = $('[data-action="relancer-compte-rendu"]');
    if (btn) {
      btn.disabled = true;
      const textDiv = btn.querySelector('div');
      if (textDiv) textDiv.textContent = 'Génération...';
    }
    
    try {
      const formData = new FormData();
      formData.append('username', email);
      formData.append('token', token);
      formData.append('edition', edition);
      formData.append('jobId', jobId);
      
      const response = await fetch('https://api.agilotext.com/api/v1/redoSummary', { method: 'POST', body: formData, headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' } });
      const result = await response.json().catch(() => ({ status: 'KO' }));
      
      if (result.status === 'OK' || response.ok) {
        incrementRegenerationCount(jobId, edition);
        updateRegenerationCounter(jobId, edition);
        updateButtonState(jobId, edition);
        
        if (window.toast) window.toast('✅ Compte-rendu régénéré avec succès !');
        
        const summaryTab = $('#tab-summary');
        if (summaryTab) summaryTab.click();
        
        const waitResult = await waitForSummaryReady(jobId, email, token, edition, 60, 3000, oldContentHash);
        
        if (waitResult.ready) {
          const url = new URL(window.location.href);
          url.searchParams.set('tab', 'summary');
          url.searchParams.set('_regen', Date.now());
          window.location.replace(url.toString() + '&_nocache=' + Date.now());
        } else {
          window.location.reload();
        }
      } else {
        alert('❌ Erreur lors de la régénération.\n\n' + (result.message || result.error || 'Erreur inconnue'));
        isGenerating = false;
        if (btn) {
          btn.disabled = false;
          const textDiv = btn.querySelector('div');
          if (textDiv) textDiv.textContent = 'Relancer';
        }
      }
    } catch (error) {
      logError('Erreur API:', error);
      alert('❌ Erreur lors de la régénération.');
      isGenerating = false;
      if (btn) {
        btn.disabled = false;
        const textDiv = btn.querySelector('div');
        if (textDiv) textDiv.textContent = 'Relancer';
      }
    }
  }
  
  // ============================================
  // INITIALISATION
  // ============================================
  
  function setupErrorWatcher() {
    const checkAndHide = () => {
      if (checkSummaryErrorInDOM()) {
        $$('[data-action="relancer-compte-rendu"]').forEach(btn => hideButton(btn, 'ErrorWatcher'));
      }
    };
    
    checkAndHide();
    setInterval(checkAndHide, 300);
    
    const observer = new MutationObserver(() => {
      checkAndHide();
      setTimeout(() => updateButtonVisibility().catch(() => {}), 100);
    });
    
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'class', 'aria-selected', 'hidden'] });
    
    window.addEventListener('beforeunload', () => observer.disconnect());
  }
  
  function init() {
    if (window.__agiloRelanceInitialized) return;
    window.__agiloRelanceInitialized = true;
    
    // Exposer fonctions globalement
    window.relancerCompteRendu = relancerCompteRendu;
    window.openSummaryTab = () => $('#tab-summary')?.click();
    window.checkSummaryErrorInDOM = checkSummaryErrorInDOM;
    window.updateButtonVisibility = updateButtonVisibility;
    window.checkSummaryExists = checkSummaryExists;
    window.getContentHash = getContentHash;
    
    // Cacher bouton immédiatement si erreur
    const immediateCheck = () => {
      if (checkSummaryErrorInDOM()) {
        $$('[data-action="relancer-compte-rendu"]').forEach(btn => hideButton(btn, 'Init'));
      }
    };
    immediateCheck();
    setTimeout(immediateCheck, 100);
    setTimeout(immediateCheck, 500);
    
    setupErrorWatcher();
    
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="relancer-compte-rendu"]');
      if (btn && !btn.disabled) {
        e.preventDefault();
        e.stopPropagation();
        relancerCompteRendu();
      }
    }, { passive: false });
    
    // Détecter sauvegarde transcript
    const saveBtn = $('[data-action="save-transcript"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        transcriptModified = true;
        const jobId = pickJobId();
        if (jobId) {
          try {
            localStorage.setItem(`agilo:transcript-saved:${jobId}`, 'true');
            localStorage.setItem('agilo:last-jobId', jobId);
          } catch (_) {}
        }
        setTimeout(async () => {
          try {
            const creds = await ensureCreds();
            if (creds.jobId && creds.edition) {
              if (checkSummaryErrorInDOM()) {
                hideButton($('[data-action="relancer-compte-rendu"]'), 'Après sauvegarde');
                if (window.toast) window.toast('✅ Transcript sauvegardé');
                return;
              }
              const summaryExists = await checkSummaryExists(creds.jobId, creds.email, creds.token, creds.edition);
              if (summaryExists) {
                if (window.toast) window.toast('✅ Transcript sauvegardé - Vous pouvez régénérer le compte-rendu');
                updateRegenerationCounter(creds.jobId, creds.edition);
                updateButtonState(creds.jobId, creds.edition);
              } else {
                hideButton($('[data-action="relancer-compte-rendu"]'), 'Pas de compte-rendu');
                if (window.toast) window.toast('✅ Transcript sauvegardé');
              }
              await updateButtonVisibility();
            }
          } catch (e) {
            logError('Erreur après sauvegarde:', e);
            updateButtonVisibility().catch(() => {});
          }
        }, 500);
      });
    }
    
    // Vérifier si transcript déjà sauvegardé
    const currentJobId = pickJobId();
    if (currentJobId) {
      try {
        if (localStorage.getItem(`agilo:transcript-saved:${currentJobId}`) === 'true') {
          transcriptModified = true;
        }
      } catch (_) {}
    }
    
    // Observer changements d'onglets
    $$('[role="tab"]').forEach(tab => {
      tab.addEventListener('click', () => {
        setTimeout(() => {
          updateButtonVisibility().catch(() => {});
        }, 100);
      });
    });
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'aria-selected') {
          updateButtonVisibility().catch(() => {});
        }
      });
    });
    
    $$('[role="tab"]').forEach(tab => observer.observe(tab, { attributes: true }));
    
    // Initialiser limites
    const initLimits = async () => {
      try {
        const creds = await ensureCreds();
        const { edition, jobId } = creds;
        if (jobId && edition) {
          if (checkSummaryErrorInDOM()) {
            hideButton($('[data-action="relancer-compte-rendu"]'), 'InitLimits');
            return;
          }
          await updateButtonVisibility();
          if (checkSummaryErrorInDOM()) {
            hideButton($('[data-action="relancer-compte-rendu"]'), 'InitLimits après update');
            return;
          }
          const btn = $('[data-action="relancer-compte-rendu"]');
          if (btn && window.getComputedStyle(btn).display !== 'none') {
            updateRegenerationCounter(jobId, edition);
            updateButtonState(jobId, edition);
          }
        }
      } catch (e) {
        logError('Erreur initialisation limites:', e);
      }
    };
    
    setTimeout(initLimits, 500);
    
    // Observer changements jobId
    let lastJobId = pickJobId();
    const editorRoot = $('#editorRoot');
    if (editorRoot) {
      const jobObserver = new MutationObserver(() => {
        const currentJobId = pickJobId();
        if (currentJobId && currentJobId !== lastJobId) {
          lastJobId = currentJobId;
          setTimeout(initLimits, 300);
        }
      });
      jobObserver.observe(editorRoot, { attributes: true, attributeFilter: ['data-job-id'] });
    }
    
    // Ouvrir onglet Compte-rendu si demandé
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tab') === 'summary') {
      setTimeout(() => {
        $('#tab-summary')?.click();
        urlParams.delete('tab');
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.history.replaceState({}, '', newUrl);
      }, 300);
    }
  }
  
  // ============================================
  // CSS (Simplifié)
  // ============================================
  
  (function injectStylesImmediately() {
    if ($('#relance-summary-styles')) return;
    const style = document.createElement('style');
    style.id = 'relance-summary-styles';
    style.textContent = `
      [data-action="relancer-compte-rendu"].agilo-force-hide,
      [data-action="relancer-compte-rendu"].agilo-force-hide * {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        position: absolute !important;
        left: -9999px !important;
        width: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      body:has(#pane-summary .ag-alert--warn) [data-action="relancer-compte-rendu"],
      body:has(#summaryEditor .ag-alert--warn) [data-action="relancer-compte-rendu"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        position: absolute !important;
        left: -9999px !important;
        width: 0 !important;
        height: 0 !important;
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
      }
      .regeneration-counter.has-warning {
        color: #fd7e14;
        background: color-mix(in srgb, #fd7e14 10%, #ffffff 90%);
      }
      .regeneration-counter.is-limit {
        color: #dc3545;
        background: color-mix(in srgb, #dc3545 10%, #ffffff 90%);
      }
      .regeneration-limit-message,
      .regeneration-premium-message,
      .regeneration-no-summary-message {
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
      .regeneration-premium-message,
      .regeneration-no-summary-message {
        background: color-mix(in srgb, #174a96 8%, #ffffff 92%);
        border: 1px solid color-mix(in srgb, #174a96 25%, transparent);
      }
      .regeneration-limit-message strong,
      .regeneration-premium-message strong,
      .regeneration-no-summary-message strong {
        display: block;
        margin-bottom: 2px;
        font-weight: 600;
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
      }
    `;
    document.head.appendChild(style);
  })();
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

