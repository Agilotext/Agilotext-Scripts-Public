/* AGILO — Script SIMPLE pour cacher/afficher le bouton Régénérer + Régénération
   APPROCHE SIMPLE : 
   1. Si summaryEmpty='1' → CACHER
   2. Si message d'erreur dans summaryEditor → CACHER
   3. Sinon → AFFICHER
   4. Régénération avec polling jusqu'au NOUVEAU compte-rendu (hash différent)
*/

(function () {
  'use strict';
  
  console.log('[AGILO:RELANCE-SIMPLE] Script chargé');
  
  const DEBUG = false; // Désactivé par défaut pour moins de lag (mettre à true pour debug)
  const log = (...a) => { if (DEBUG) console.log('[AGILO:RELANCE-SIMPLE]', ...a); };
  
  // Helpers
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const byId = (id) => document.getElementById(id);
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  
  // Constantes API (définies en premier)
  const API_BASE = 'https://api.agilotext.com/api/v1';
  const MAX_POLL = 60; // Max 60 tentatives
  const BASE_DELAY = 1500; // 1.5s entre chaque tentative
  
  // Message d'erreur exact
  const ERROR_MSG = "Le compte-rendu n'est pas encore disponible (fichier manquant/non publié).";
  
  // Fonction SIMPLE pour vérifier si on doit cacher le bouton
  function shouldHideButton() {
    const root = byId('editorRoot');
    const summaryEl = byId('summaryEditor') || byId('ag-summary') || $('[data-editor="summary"]');
    
    // PRIORITÉ 1 : summaryEmpty='1'
    if (root?.dataset.summaryEmpty === '1') {
      log('✅ CACHER : summaryEmpty=1');
      return true;
    }
    
    // PRIORITÉ 2 : Message d'erreur dans summaryEditor
    if (summaryEl) {
      const text = (summaryEl.textContent || summaryEl.innerText || '').toLowerCase();
      const html = (summaryEl.innerHTML || '').toLowerCase();
      const errorLower = ERROR_MSG.toLowerCase();
      
      // Vérifier le message exact
      if (text.includes(errorLower) || html.includes(errorLower)) {
        log('✅ CACHER : Message erreur détecté dans summaryEditor');
        return true;
      }
      
      // Vérifier les patterns (seulement si contenu court)
      if (text.length < 300 && (
          text.includes('pas encore disponible') && 
          (text.includes('fichier manquant') || text.includes('non publié'))
        )) {
        log('✅ CACHER : Pattern erreur détecté dans summaryEditor');
        return true;
      }
      
      // Vérifier dans les alertes
      const alerts = summaryEl.querySelectorAll('.ag-alert, .ag-alert--warn, .ag-alert__title');
      for (const alert of alerts) {
        const alertText = (alert.textContent || alert.innerText || '').toLowerCase();
        if (alertText.includes(errorLower) || 
            (alertText.includes('pas encore disponible') && alertText.includes('fichier manquant'))) {
          log('✅ CACHER : Message erreur dans alerte');
          return true;
        }
      }
    }
    
    log('❌ AFFICHER : Aucune raison de cacher');
    return false;
  }
  
  // Fonction SIMPLE pour cacher le bouton
  function hideButton(btn) {
    if (!btn) return;
    log('🔒 Cache bouton');
    btn.style.cssText = 'display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;';
    btn.classList.add('agilo-force-hide');
    btn.setAttribute('hidden', '');
    btn.setAttribute('aria-hidden', 'true');
    btn.disabled = true;
  }
  
  // Fonction SIMPLE pour afficher le bouton
  function showButton(btn) {
    if (!btn) return;
    log('🔓 Affiche bouton');
    btn.style.removeProperty('display');
    btn.style.removeProperty('visibility');
    btn.style.removeProperty('opacity');
    btn.style.removeProperty('pointer-events');
    btn.classList.remove('agilo-force-hide');
    btn.removeAttribute('hidden');
    btn.removeAttribute('aria-hidden');
    btn.disabled = false;
  }
  
  // Fonction SIMPLE pour mettre à jour la visibilité (avec cache pour éviter appels inutiles)
  let lastState = null; // 'hidden' ou 'visible'
  function updateVisibility() {
    const btn = $('[data-action="relancer-compte-rendu"]');
    if (!btn) {
      log('⚠️ Bouton non trouvé');
      return;
    }
    
    const shouldHide = shouldHideButton();
    const currentState = shouldHide ? 'hidden' : 'visible';
    
    // Ne rien faire si l'état n'a pas changé
    if (lastState === currentState) {
      return; // État identique, pas besoin de modifier
    }
    
    lastState = currentState;
    
    if (shouldHide) {
      hideButton(btn);
    } else {
      showButton(btn);
    }
  }
  
  // Initialisation SIMPLE
  function init() {
    if (window.__agiloRelanceSimpleInit) {
      log('⚠️ Déjà initialisé');
      return;
    }
    window.__agiloRelanceSimpleInit = true;
    log('✅ Initialisation');
    
    // ⚠️ ATTACHER LE GESTIONNAIRE DE CLIC (comme dans staging)
    bindRelanceClick();
    
    // Exposer la fonction pour debug
    window.relancerCompteRendu = relancerCompteRendu;
    
    // Vérifier immédiatement
    updateVisibility();
    
    // Vérifier périodiquement (toutes les 1000ms pour moins de lag)
    setInterval(updateVisibility, 1000);
    
    // Écouter les changements de summaryEmpty (avec reset du cache)
    const root = byId('editorRoot');
    if (root) {
      const observer = new MutationObserver(() => {
        log('📊 summaryEmpty changé:', root.dataset.summaryEmpty);
        lastState = null; // Reset cache pour forcer la vérification
        updateVisibility();
      });
      observer.observe(root, { attributes: true, attributeFilter: ['data-summary-empty'] });
    }
    
    // Écouter agilo:load (avec reset du cache)
    window.addEventListener('agilo:load', () => {
      log('📡 agilo:load détecté');
      lastState = null; // Reset cache pour forcer la vérification
      setTimeout(updateVisibility, 100);
      setTimeout(updateVisibility, 500);
      setTimeout(updateVisibility, 1500);
    });
  }
  
  /************* FONCTIONS DE RÉGÉNÉRATION *************/
  
  // Hash du contenu pour détecter les changements
  function getContentHash(text) {
    const s = String(text || '');
    if (s.length < 60) return `len:${s.length}`;
    // Prendre le début et la fin (plus robuste que juste le début)
    const head = s.slice(0, 300).replace(/\s+/g, '');
    const tail = s.slice(-300).replace(/\s+/g, '');
    // Inclure aussi quelques mots du milieu pour détecter les changements de noms
    const mid = s.length > 1000 ? s.slice(Math.floor(s.length/2) - 100, Math.floor(s.length/2) + 100).replace(/\s+/g, '') : '';
    return `${s.length}:${head.slice(0, 60)}:${mid.slice(0, 40)}:${tail.slice(-60)}`;
  }
  
  // Récupérer l'auth (comme dans staging)
  function pickEdition() {
    const raw = window.AGILO_EDITION
      || new URLSearchParams(location.search).get('edition')
      || byId('editorRoot')?.dataset.edition
      || localStorage.getItem('agilo:edition')
      || 'free';
    const v = String(raw||'').toLowerCase().trim();
    if (['enterprise','entreprise','business','team','ent'].includes(v)) return 'ent';
    if (v.startsWith('pro')) return 'pro';
    if (v.startsWith('free') || v==='gratuit') return 'free';
    return 'free';
  }
  
  function pickJobId() {
    const u = new URL(location.href);
    const root = byId('editorRoot');
    return u.searchParams.get('jobId')
      || root?.dataset.jobId
      || $('.rail-item.is-active')?.dataset?.jobId
      || window.__agiloOrchestrator?.currentJobId
      || '';
  }
  
  async function ensureAuth() {
    const edition = pickEdition();
    const root = byId('editorRoot');
    let email = root?.dataset.username
      || byId('memberEmail')?.value
      || $('[name="memberEmail"]')?.value
      || localStorage.getItem('agilo:username')
      || window.memberEmail
      || '';
    
    // Essayer de résoudre l'email si manquant
    if (!email && window.$memberstackDom?.getMember) {
      try {
        const r = await window.$memberstackDom.getMember();
        if (r?.data?.email) email = r.data.email.trim();
      } catch {}
    }
    
    const key = `agilo:token:${edition}:${String(email||'').toLowerCase()}`;
    let token = root?.dataset.token
      || window.globalToken
      || localStorage.getItem(key)
      || localStorage.getItem('agilo:token')
      || '';
    
    // Essayer de récupérer le token via getToken si manquant
    if (!token && email && typeof window.getToken === 'function') {
      try {
        window.getToken(email, edition);
        // Attendre un peu pour que le token arrive
        for (let i = 0; i < 50; i++) {
          await wait(100);
          token = root?.dataset.token || window.globalToken || localStorage.getItem(key) || '';
          if (token) break;
        }
      } catch {}
    }
    
    if (email) {
      try { localStorage.setItem('agilo:username', email); } catch {}
    }
    try { localStorage.setItem('agilo:edition', edition); } catch {}
    
    return { username: (email||'').trim(), token: token||'', edition };
  }
  
  // Fetch avec timeout et cache-busting
  async function fetchWithTimeout(url, opts = {}) {
    const { timeout = 20000, signal } = opts;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    const composite = new AbortController();
    
    if (signal) {
      if (signal.aborted) composite.abort();
      signal.addEventListener('abort', () => composite.abort(), { once: true });
    }
    if (ctrl.signal) {
      if (ctrl.signal.aborted) composite.abort();
      ctrl.signal.addEventListener('abort', () => composite.abort(), { once: true });
    }
    
    try {
      // Cache-busting FORCÉ
      const urlObj = new URL(url);
      urlObj.searchParams.set('_t', Date.now().toString());
      urlObj.searchParams.set('_nocache', Math.random().toString(36).slice(2));
      
      return await fetch(urlObj.toString(), {
        ...opts,
        signal: composite.signal,
        credentials: 'omit',
        cache: 'no-store',
        headers: {
          ...(opts.headers || {}),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    } finally {
      clearTimeout(t);
    }
  }
  
  // ⚠️ FONCTIONS API (comme dans staging)
  function parseMaybeJson(raw, contentType=''){
    const looksJson = (contentType||'').includes('application/json') || /^\s*\{/.test(raw||'');
    if (!looksJson) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
  
  async function apiGetWithRetry(kind, jobId, auth, retryCount=0, signal){
    const ts = Date.now();
    const baseQ = `jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(auth.username)}&token=${encodeURIComponent(auth.token)}&edition=${encodeURIComponent(auth.edition)}&_ts=${ts}`;
    const url =
      (kind === 'summary')
        ? `${API_BASE}/receiveSummary?${baseQ}&format=html`
        : (kind === 'status')
          ? `${API_BASE}/getTranscriptStatus?${baseQ}`
          : `${API_BASE}/${kind}?${baseQ}`;
    let r, raw;
    try{ r = await fetchWithTimeout(url, { signal, timeout: 15000 }); raw = await r.text(); }
    catch(e){
      if (e?.name === 'AbortError') return { ok:false, code:'CANCELLED', httpStatus:0, json:null, raw:'' };
      return { ok:false, code:'NETWORK_ERROR', httpStatus:0, json:null, raw:'' };
    }
    if (!r.ok){
      const json = parseMaybeJson(raw, r.headers.get('content-type')||'');
      return { ok:false, code:'HTTP_ERROR', httpStatus:r.status, json, raw, headers:r.headers };
    }
    const ct = r.headers.get('content-type') || '';
    const json = parseMaybeJson(raw, ct);
    if (json && (json.status==='KO' || json.errorMessage)){
      return { ok:false, code: json.errorMessage || json.status || 'ON_ERROR', json, raw, headers:r.headers };
    }
    return { ok:true, payload: raw, contentType: ct, headers: r.headers };
  }
  
  function isBlankHtml(html){
    const s = String(html||'').replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]+>/g,'').replace(/\s+/g,'').trim();
    return s.length === 0;
  }
  
  function looksLikeNotReady(text){
    const lower = String(text||'').toLowerCase();
    return ERROR_PATTERNS.some(p => lower.includes(p)) || /ready_summary_pending|not_ready|pending/.test(lower);
  }
  
  // ⚠️ FONCTIONS LIMITES (comme dans staging)
  function getRegenerationLimit(edition){
    const ed = String(edition||'').toLowerCase().trim();
    if (ed.startsWith('pro')) return 2;
    if (['ent','business','enterprise','entreprise','team'].includes(ed)) return 4;
    return 0;
  }
  
  function getRegenerationCount(jobId){
    try { return (JSON.parse(localStorage.getItem('agilo:regenerations')||'{}')[jobId]?.count) || 0; } catch { return 0; }
  }
  
  function incrementRegenerationCount(jobId, edition){
    try {
      const data = JSON.parse(localStorage.getItem('agilo:regenerations')||'{}');
      const row = data[jobId] || { count:0 };
      data[jobId] = { ...row, count:(row.count||0)+1, max:getRegenerationLimit(edition), edition, lastUsed:new Date().toISOString() };
      localStorage.setItem('agilo:regenerations', JSON.stringify(data));
    } catch {}
  }
  
  // ⚠️ Vérifier si le summary a été demandé (comme dans staging)
  async function wasSummaryEverRequested(jobId, auth, signal){
    // Vérifier d'abord via getTranscriptStatus
    const st = await getTranscriptStatus(jobId, auth, signal);
    if (st === 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS') {
      log('❌ Summary jamais demandé (ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS)');
      return false;
    }
    if (st === 'READY_SUMMARY_READY' || st === 'READY_SUMMARY_PENDING' || st === 'READY_SUMMARY_ON_ERROR') {
      log('✅ Summary demandé (statut:', st, ')');
      return true;
    }
    
    // Fallback : vérifier dans le DOM
    const summaryEl = byId('summaryEditor') || $('[data-editor="summary"]');
    if (summaryEl) {
      const text = (summaryEl.textContent || summaryEl.innerText || '').trim();
      const exactMsg = "Le compte-rendu n'est pas encore disponible (fichier manquant/non publié).";
      if (text && !text.includes(exactMsg) && text.length > 50) {
        log('✅ Summary détecté dans le DOM (contenu présent)');
        return true;
      }
    }
    
    log('❌ Summary jamais demandé (aucune preuve)');
    return false;
  }
  
  // Patterns d'erreur
  const ERROR_PATTERNS = [
    'error_summary_transcript_file_not_exists',
    'pas encore disponible',
    'fichier manquant',
    'non publié'
  ];
  
  // Vérifier le statut du transcript
  async function getTranscriptStatus(jobId, auth, signal) {
    const url = `${API_BASE}/getTranscriptStatus?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(auth.username)}&token=${encodeURIComponent(auth.token)}&edition=${encodeURIComponent(auth.edition)}`;
    
    try {
      const r = await fetchWithTimeout(url, { signal, timeout: 10000 });
      if (!r.ok) return null;
      const json = await r.json().catch(() => null);
      return json?.transcriptStatus || null;
    } catch {
      return null;
    }
  }
  
  // Poller jusqu'à ce que le nouveau compte-rendu soit prêt (hash différent) - COMME DANS STAGING
  async function pollSummaryUntilReady(jobId, auth, { oldHash = '', max = MAX_POLL, baseDelay = BASE_DELAY, signal } = {}) {
    log('⏳ Début poll pour nouveau compte-rendu', { jobId, oldHash: oldHash.substring(0, 30) + '...', max });
    
    for (let i = 0; i < max; i++) {
      if (signal?.aborted) {
        log('⚠️ Polling annulé');
        return { ok: false, code: 'CANCELLED' };
      }
      
      // Vérifier le statut
      const st = await getTranscriptStatus(jobId, auth, signal);
      
      if (st === 'READY_SUMMARY_READY') {
        // Récupérer le compte-rendu via apiGetWithRetry (comme dans staging)
        const r = await apiGetWithRetry('summary', jobId, {...auth}, 0, signal);
        if (r.ok) {
          const html = String(r.payload||'');
          if (!looksLikeNotReady(html) && !isBlankHtml(html)) {
            const newHash = getContentHash(html);
            log(`Tentative ${i+1}/${max} - Hash: ${newHash.substring(0, 30)}...`);
            
            // ⚠️ VÉRIFIER QUE LE HASH EST DIFFÉRENT (nouveau compte-rendu)
            if (!oldHash || newHash !== oldHash) {
              log('✅ NOUVEAU compte-rendu détecté !', {
                oldHash: oldHash.substring(0, 30) + '...',
                newHash: newHash.substring(0, 30) + '...',
                htmlLength: html.length
              });
              return { ok: true, html, hash: newHash };
            } else {
              log(`⚠️ Hash identique (${newHash.substring(0, 30)}...) - Attente continue...`);
            }
          }
        }
      }
      
      // Attendre avant la prochaine tentative (délai progressif comme dans staging)
      await wait(baseDelay * Math.pow(1.25, i));
    }
    
    log('⚠️ Timeout - Compte-rendu pas prêt après', max, 'tentatives');
    return { ok: false, code: 'TIMEOUT' };
  }
  
  // Afficher le loader Lottie
  function showSummaryLoading() {
    const summaryEditor = byId('summaryEditor') || byId('ag-summary') || $('[data-editor="summary"]');
    if (!summaryEditor) return;
    
    // Créer le loader si nécessaire
    let loaderContainer = summaryEditor.querySelector('.summary-loading-indicator');
    if (!loaderContainer) {
      loaderContainer = document.createElement('div');
      loaderContainer.className = 'summary-loading-indicator';
      loaderContainer.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;min-height:200px;';
      
      // Lottie
      const lottieElement = document.createElement('div');
      lottieElement.id = 'loading-summary-regen';
      lottieElement.className = 'lottie-check-statut';
      lottieElement.setAttribute('data-w-id', '3f0ed4f9-0ff3-907d-5d6d-28f23fb3783f');
      lottieElement.setAttribute('data-animation-type', 'lottie');
      lottieElement.setAttribute('data-src', 'https://cdn.prod.website-files.com/6815bee5a9c0b57da18354fb/6815bee5a9c0b57da18355b3_Animation%20-%201705419825493.json');
      lottieElement.setAttribute('data-loop', '1');
      lottieElement.setAttribute('data-direction', '1');
      lottieElement.setAttribute('data-autoplay', '1');
      lottieElement.setAttribute('data-is-ix2-target', '0');
      lottieElement.setAttribute('data-renderer', 'svg');
      lottieElement.style.cssText = 'width:120px;height:120px;';
      
      const loadingText = document.createElement('p');
      loadingText.style.cssText = 'font-size:18px;font-weight:600;margin-top:20px;color:var(--agilo-text,#020202);';
      loadingText.textContent = 'Régénération du compte-rendu en cours...';
      
      const loadingSubtitle = document.createElement('p');
      loadingSubtitle.style.cssText = 'font-size:14px;margin-top:8px;color:var(--agilo-dim,#525252);';
      loadingSubtitle.textContent = 'Cela peut prendre quelques instants';
      
      summaryEditor.innerHTML = '';
      summaryEditor.appendChild(loaderContainer);
      loaderContainer.appendChild(lottieElement);
      loaderContainer.appendChild(loadingText);
      loaderContainer.appendChild(loadingSubtitle);
      
      // Initialiser Lottie
      setTimeout(() => {
        if (window.Webflow && window.Webflow.require) {
          try {
            window.Webflow.require('ix2').init();
          } catch (e) {
            // Fallback spinner CSS
            setTimeout(() => {
              if (!lottieElement.querySelector('svg, canvas') && !lottieElement._lottie) {
                const fallback = document.createElement('div');
                fallback.style.cssText = 'width:60px;height:60px;border:4px solid #f3f3f3;border-top:4px solid #174a96;border-radius:50%;animation:spin 1s linear infinite;';
                lottieElement.style.display = 'none';
                loaderContainer.insertBefore(fallback, lottieElement);
                if (!document.getElementById('spin-animation')) {
                  const style = document.createElement('style');
                  style.id = 'spin-animation';
                  style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
                  document.head.appendChild(style);
                }
              }
            }, 1000);
          }
        }
      }, 100);
    } else {
      loaderContainer.style.display = 'flex';
    }
  }
  
  function hideSummaryLoading() {
    const loader = $('.summary-loading-indicator');
    if (loader) loader.style.display = 'none';
  }
  
  // Fonction principale de régénération (REPRISE DU STAGING qui fonctionne)
  let __isGenerating = false;
  async function relancerCompteRendu() {
    if (__isGenerating) {
      console.log('[AGILO:RELANCE-SIMPLE] ⚠️ Régénération déjà en cours');
      return;
    }
    
    const now = Date.now();
    if (relancerCompteRendu._last && (now - relancerCompteRendu._last) < 500) return;
    relancerCompteRendu._last = now;
    
    // Récupérer auth et jobId (comme dans staging)
    const auth = await ensureAuth();
    const jobId = pickJobId();
    
    if (!auth.username || !auth.token || !jobId) {
      alert('❌ Informations incomplètes.');
      return;
    }
    
    // ⚠️ Vérifier les limites (comme dans staging)
    const limit = getRegenerationLimit(auth.edition);
    const count = getRegenerationCount(jobId);
    const remaining = limit - count;
    
    if (auth.edition === 'free' || auth.edition.startsWith('free')) {
      // Free : afficher AgiloGate
      if (typeof window.AgiloGate !== 'undefined' && window.AgiloGate.showUpgrade) {
        window.AgiloGate.showUpgrade('pro', 'Régénération de compte-rendu');
      } else {
        alert('🔒 Fonctionnalité Premium — disponible en Pro/Business.');
      }
      return;
    }
    
    if (count >= limit) {
      alert(`⚠️ Limite atteinte\n\n${count}/${limit} régénérations utilisées.`);
      return;
    }
    
    // ⚠️ Vérifier que le summary a été demandé (comme dans staging)
    const requested = await wasSummaryEverRequested(jobId, auth);
    if (!requested) {
      alert('⚠️ Aucun compte-rendu initial demandé pour cet audio.');
      return;
    }
    
    // ⚠️ CONFIRMATION (comme dans staging)
    const ok = confirm(`Remplacer le compte-rendu actuel ?\n\n${remaining}/${limit} régénération${remaining>1?'s':''} restante${remaining>1?'s':''}.`);
    if (!ok) return;
    
    // Hash avant régénération (comme dans staging)
    let oldHash = '';
    try {
      const r = await apiGetWithRetry('summary', jobId, {...auth}, 0, null);
      if (r.ok) {
        const html = String(r.payload||'');
        if (!isBlankHtml(html) && !looksLikeNotReady(html)) {
          oldHash = getContentHash(html);
          log('Hash ancien compte-rendu:', oldHash.substring(0, 50) + '...');
        }
      }
    } catch (e) {
      log('Pas d\'ancien compte-rendu ou erreur:', e);
    }
    
    __isGenerating = true;
    const btn = $('[data-action="relancer-compte-rendu"]');
    const btnText = btn?.querySelector('div') || btn;
    const originalText = btnText?.textContent || 'Régénérer';
    
    try {
      // Désactiver le bouton
      if (btn) {
        btn.disabled = true;
        if (btnText) btnText.textContent = 'Génération…';
      }
      
      // Afficher le loader IMMÉDIATEMENT (comme dans staging)
      showSummaryLoading();
      
      // Appel API redoSummary (comme dans staging)
      log('🚀 Appel API redoSummary', { jobId, edition: auth.edition });
      const fd = new FormData();
      fd.append('username', auth.username);
      fd.append('token', auth.token);
      fd.append('edition', auth.edition);
      fd.append('jobId', jobId);
      
      const redo = await fetchWithTimeout(`${API_BASE}/redoSummary`, {
        method: 'POST',
        body: fd,
        timeout: 20000
      });
      
      const j = await redo.json().catch(() => ({ status: 'KO' }));
      
      if (!redo.ok || !(j.status === 'OK' || j.ok === true)) {
        hideSummaryLoading();
        alert('❌ Erreur lors de la régénération.\n\n' + (j.message || j.error || j.errorMessage || 'Erreur inconnue'));
        return;
      }
      
      log('✅ API redoSummary OK - Incrémentation compteur');
      incrementRegenerationCount(jobId, auth.edition);
      if (window.toast) window.toast('✅ Régénération lancée');
      
      // ⚠️ POLLER jusqu'à READY + nouveau hash (comme dans staging)
      log('⏳ Attente génération nouveau compte-rendu...');
      const signal = new AbortController();
      
      const result = await pollSummaryUntilReady(jobId, auth, {
        oldHash,
        max: MAX_POLL,
        signal: signal.signal
      });
      
      if (result.ok && result.html) {
        log('✅ NOUVEAU compte-rendu prêt !', {
          hash: result.hash?.substring(0, 50) + '...',
          htmlLength: result.html.length
        });
        
        // ⚠️ AFFICHER LE NOUVEAU COMPTE-RENDU DIRECTEMENT (comme dans staging)
        const summaryEditor = byId('summaryEditor') || byId('ag-summary') || $('[data-editor="summary"]');
        if (summaryEditor && result.html) {
          hideSummaryLoading();
          
          // Nettoyer le HTML (sécurité)
          const div = document.createElement('div');
          div.innerHTML = result.html;
          div.querySelectorAll('script, style, link[rel="stylesheet"], iframe, object, embed').forEach(n => n.remove());
          div.querySelectorAll('*').forEach(n => {
            [...n.attributes].forEach(a => {
              const name = a.name.toLowerCase();
              const val = String(a.value || '');
              if (name.startsWith('on') || /^javascript:/i.test(val)) n.removeAttribute(a.name);
            });
          });
          
          summaryEditor.innerHTML = div.innerHTML;
          
          // Mettre à jour summaryEmpty
          const root = byId('editorRoot');
          if (root) {
            root.dataset.summaryEmpty = '0';
          }
          
          // Mettre à jour la visibilité du bouton
          lastState = null;
          updateVisibility();
          
          if (window.toast) window.toast('✅ Compte-rendu régénéré avec succès');
        } else {
          // Fallback: recharger la page avec cache-buster
          const url = new URL(location.href);
          url.searchParams.set('tab', 'summary');
          url.searchParams.set('_regen', Date.now().toString());
          url.searchParams.set('_nocache', Math.random().toString(36).slice(2));
          window.location.replace(url.toString());
        }
      } else {
        hideSummaryLoading();
        if (result.code === 'CANCELLED') {
          log('⚠️ Polling annulé');
        } else {
          alert('⚠️ Le compte-rendu n\'est pas encore prêt. Il sera disponible dans quelques instants.');
        }
      }
    } catch (e) {
      log('❌ Erreur régénération:', e);
      hideSummaryLoading();
      alert('❌ Erreur réseau lors de la régénération.');
    } finally {
      __isGenerating = false;
      if (btn) {
        btn.disabled = false;
        if (btnText) btnText.textContent = originalText;
      }
    }
  }
  
  // ⚠️ ATTACHER LE GESTIONNAIRE DE CLIC (EXACTEMENT COMME DANS STAGING)
  function bindRelanceClick() {
    if (window.__agiloRelanceSimpleClickBound) return;
    window.__agiloRelanceSimpleClickBound = true;
    console.log('[AGILO:RELANCE-SIMPLE] ⚡ Attachement gestionnaire de clic (comme staging)');
    
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="relancer-compte-rendu"]');
      if (!btn) return;
      
      console.log('[AGILO:RELANCE-SIMPLE] 🖱️ Clic détecté sur bouton Régénérer');
      
      // Vérifier que le bouton n'est pas caché
      if (btn.classList.contains('agilo-force-hide')) {
        console.log('[AGILO:RELANCE-SIMPLE] Bouton caché - Clic ignoré');
        return;
      }
      
      // Vérifier que le bouton n'est pas désactivé
      if (btn.disabled) {
        console.log('[AGILO:RELANCE-SIMPLE] Bouton désactivé - Clic ignoré');
        return;
      }
      
      // Vérifier une dernière fois si le message d'erreur est présent
      if (shouldHideButton()) {
        console.log('[AGILO:RELANCE-SIMPLE] Message d\'erreur détecté au clic - Action annulée');
        if (window.toast) window.toast('Aucun compte-rendu disponible pour régénérer');
        return;
      }
      
      e.preventDefault();
      e.stopPropagation();
      console.log('[AGILO:RELANCE-SIMPLE] ✅ Clic validé - Lancement régénération...');
      
      // ⚠️ APPELER DIRECTEMENT relancerCompteRendu() SANS PARAMÈTRES (comme dans staging)
      relancerCompteRendu();
    }, { passive: false }); // Exactement comme dans staging
    
    console.log('[AGILO:RELANCE-SIMPLE] ✅ Gestionnaire de clic attaché');
  }
  
  // Démarrer
  if (document.readyState !== 'loading') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  }
  
  // Fallback si DOMContentLoaded n'a pas été déclenché
  setTimeout(init, 1000);
})();

