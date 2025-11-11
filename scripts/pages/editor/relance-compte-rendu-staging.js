/* AGILO — Editor + Relance Résumé (tout-en-un, 2025-11) — VERSION STAGING

   - Garde "Régénérer invisible si CR jamais demandé"
   - Poll jusqu'à READY_SUMMARY_READY, puis recharge forcée (cache-buster)
   - Affiche TOUJOURS le bon CR (hash vérifié)
   - Détecte le message d'erreur dans le DOM pour cacher le bouton
   - Messages raccourcis
   - Compatible avec autres scripts (pas de conflit)
*/

(function () {
  'use strict';
  
  /************* Réglages *************/
  const DEBUG = false; // Désactivé par défaut pour moins de lag (mettre à true pour debug)
  const API_BASE = 'https://api.agilotext.com/api/v1';
  const SOFT_CANCEL = true;
  const MAX_POLL = 70;
  const BASE_DELAY = 1400;

  const log = (...a) => { if (DEBUG) console.log('[AGILO:RELANCE]', ...a); };
  const warn = (...a) => console.warn('[AGILO:RELANCE]', ...a);
  const err  = (...a) => console.error('[AGILO:RELANCE]', ...a);
  
  // Log d'initialisation (toujours affiché)
  console.log('[AGILO:RELANCE] Script staging chargé');

  /************* Helpers DOM *************/
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const byId = (id) => document.getElementById(id);
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const waitFrames = (n=1)=>new Promise(res=>{
    const step=i=> i?requestAnimationFrame(()=>step(i-1)):res();
    step(Math.max(1,n));
  });

  /************* Sélecteurs principaux *************/
  const editorRoot = byId('editorRoot');

  function pickEdition () {
    const raw = window.AGILO_EDITION
      || new URLSearchParams(location.search).get('edition')
      || editorRoot?.dataset.edition
      || localStorage.getItem('agilo:edition')
      || 'free';
    const v = String(raw||'').toLowerCase().trim();
    if (['enterprise','entreprise','business','team','ent'].includes(v)) return 'ent';
    if (v.startsWith('pro')) return 'pro';
    if (v.startsWith('free') || v==='gratuit') return 'free';
    return 'free';
  }
  
  function pickJobId () {
    const u = new URL(location.href);
    return u.searchParams.get('jobId')
      || editorRoot?.dataset.jobId
      || $('.rail-item.is-active')?.dataset?.jobId
      || window.__agiloOrchestrator?.currentJobId
      || '';
  }

  /************* Auth *************/
  function tokenKey(email, edition){
    return `agilo:token:${String(edition||'free').toLowerCase()}:${String(email||'').toLowerCase()}`;
  }
  
  async function resolveEmail(){
    const attr = $('[name="memberEmail"]')?.getAttribute('value') || '';
    const ms   = $('[data-ms-member="email"]')?.textContent || '';
    const val  = (byId('memberEmail')?.value || attr || ms || window.memberEmail || '').trim();
    if (val) return val;
    if (window.$memberstackDom?.getMember){
      try { const r = await window.$memberstackDom.getMember(); if (r?.data?.email) return r.data.email.trim(); } catch {}
    }
    return '';
  }
  
  function readAuthSnapshot() {
    const edition = pickEdition();
    const email = editorRoot?.dataset.username
      || byId('memberEmail')?.value
      || $('[name="memberEmail"]')?.value
      || localStorage.getItem('agilo:username')
      || window.memberEmail
      || '';
    const key = tokenKey(email, edition);
    const token = editorRoot?.dataset.token
      || window.globalToken
      || localStorage.getItem(key)
      || localStorage.getItem('agilo:token')
      || '';
    return { username: (email||'').trim(), token: token||'', edition, KEY:key };
  }
  
  function waitForTokenEvent(ms=8000, email='', edition=''){
    return new Promise(res=>{
      let done=false;
      const timer = setTimeout(()=>{ if(!done){ done=true; res(null); } }, ms);
      function h(e){
        if (done) return;
        const d = e?.detail||{};
        const okEmail = email ? (String(d.email||'').toLowerCase()===String(email).toLowerCase()) : true;
        const okEd    = edition ? (String(d.edition||'').toLowerCase()===String(edition).toLowerCase()) : true;
        if (d.token && okEmail && okEd){
          done = true; clearTimeout(timer);
          res({ username: d.email, token: d.token, edition: String(d.edition||edition) });
        }
      }
      window.addEventListener('agilo:token', h, { once:true, passive:true });
    });
  }
  
  async function ensureAuth(){
    let auth = readAuthSnapshot();
    if (!auth.username) auth.username = await resolveEmail();
    if (!auth.token && auth.username){
      if (typeof window.getToken === 'function'){
        try{ window.getToken(auth.username, auth.edition); }catch{}
      }
      const evt = await waitForTokenEvent(8000, auth.username, auth.edition);
      if (evt?.token){
        auth.token = evt.token;
        try{ localStorage.setItem(auth.KEY, evt.token); }catch{}
        window.globalToken = evt.token;
      } else {
        const snap = readAuthSnapshot();
        if (snap.token) auth = snap;
      }
    }
    if (auth.username) { try{ localStorage.setItem('agilo:username', auth.username); }catch{} }
    try{ localStorage.setItem('agilo:edition', auth.edition); }catch{}
    return auth;
  }

  /************* Réseau *************/
  function parseMaybeJson(raw, contentType=''){
    const looksJson = (contentType||'').includes('application/json') || /^\s*\{/.test(raw||'');
    if (!looksJson) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
  
  async function fetchWithTimeout(url, opts={}){
    const { timeout=20000, signal } = opts;
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), timeout);
    const composite = new AbortController();
    const link = (src)=>{ if (!src) return; if (src.aborted) composite.abort(); src.addEventListener('abort',()=>composite.abort(),{once:true}); };
    link(signal); link(ctrl.signal);
    try{
      return await fetch(url, {
        ...opts,
        signal: composite.signal,
        credentials: 'omit',
        cache: 'no-store',
        headers: {
          ...(opts.headers||{}),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
    } finally { clearTimeout(t); }
  }
  
  async function apiGetWithRetry(kind, jobId, auth, retryCount=0, signal){
    const ts = Date.now();
    const baseQ = `jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(auth.username)}&token=${encodeURIComponent(auth.token)}&edition=${encodeURIComponent(auth.edition)}&_ts=${ts}`;
    const url =
      (kind === 'summary')
        ? `${API_BASE}/receiveSummary?${baseQ}&format=html`
        : (kind === 'summary-json')
          ? `${API_BASE}/receiveSummary?${baseQ}`
          : (kind === 'transcript')
            ? `${API_BASE}/receiveTextJson?${baseQ}`
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
      if ((r.status===401 || r.status===403) && retryCount < 3) {
        // Refresh token logic would go here if needed
      }
      const json = parseMaybeJson(raw, r.headers.get('content-type')||'');
      const errorCode = json?.errorMessage || 'HTTP_ERROR';
      
      // ⚠️ IMPORTANT : Détecter ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS
      if (kind === 'summary' && (r.status === 404 || r.status === 204 || /ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS/i.test(errorCode))) {
        log('⚠️ Erreur API détectée (summary non disponible):', errorCode);
        saveSummaryErrorState(jobId, true, errorCode);
      }
      
      return { ok:false, code:'HTTP_ERROR', httpStatus:r.status, json, raw, headers:r.headers };
    }
    const ct = r.headers.get('content-type') || '';
    const json = parseMaybeJson(raw, ct);
    if (json && (json.status==='KO' || json.errorMessage)){
      const code = String(json.errorMessage || json.status || 'ON_ERROR');
      
      // ⚠️ IMPORTANT : Détecter ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS dans la réponse JSON
      if (kind === 'summary' && /ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS/i.test(code)) {
        log('⚠️ Erreur API détectée (ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS):', code);
        saveSummaryErrorState(jobId, true, code);
      } else if (kind === 'summary' && r.ok) {
        // Si on reçoit un summary valide, on nettoie l'état d'erreur
        saveSummaryErrorState(jobId, false);
      }
      
      return { ok:false, code, json, raw, headers:r.headers };
    }
    
    // Si on reçoit un summary valide, on nettoie l'état d'erreur
    if (kind === 'summary' && r.ok) {
      saveSummaryErrorState(jobId, false);
    }
    
    return { ok:true, payload: raw, contentType: ct, headers: r.headers };
  }

  /************* Hash de contenu pour éviter l'ancien CR *************/
  function getContentHash(text){
    const s = String(text||'');
    if (s.length < 60) return `len:${s.length}`;
    const head = s.slice(0,180).replace(/\s+/g,'');
    const tail = s.slice(-180).replace(/\s+/g,'');
    return `${s.length}:${head.slice(0,40)}:${tail.slice(-40)}`;
  }
  
  function saveSummaryHash(jobId, hash){
    try { localStorage.setItem(`agilo:summary-hash:${jobId}`, String(hash||'')); } catch {}
  }
  
  function readSummaryHash(jobId){
    try { return localStorage.getItem(`agilo:summary-hash:${jobId}`) || ''; } catch { return ''; }
  }

  /************* Détection d'erreur "pas encore dispo" *************/
  const ERROR_PATTERNS = [
    'error_summary_transcript_file_not_exists',
    'pas encore disponible',
    'fichier manquant',
    'non publié',
    'n\'est pas encore disponible',
    'nest pas encore disponible',
    'compte-rendu n\'est pas encore disponible',
    'compte rendu n\'est pas encore disponible',
    'le compte-rendu n\'est pas encore disponible',
    'le compte rendu n\'est pas encore disponible'
  ];
  
  // Message exact du script principal
  const EXACT_ERROR_MESSAGE = "Le compte-rendu n'est pas encore disponible (fichier manquant/non publié).";
  
  function looksLikeNotReady(text){
    const lower = String(text||'').toLowerCase();
    return ERROR_PATTERNS.some(p => lower.includes(p)) || /ready_summary_pending|not_ready|pending/.test(lower);
  }
  
  function isBlankHtml(html){
    const s = String(html||'').replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]+>/g,'').replace(/\s+/g,'').trim();
    return s.length === 0;
  }

  /************* Stockage de l'état d'erreur API *************/
  function saveSummaryErrorState(jobId, hasError, errorCode = ''){
    try {
      const key = `agilo:summary-error:${jobId}`;
      if (hasError) {
        localStorage.setItem(key, JSON.stringify({ 
          hasError: true, 
          errorCode, 
          timestamp: Date.now() 
        }));
      } else {
        localStorage.removeItem(key);
      }
    } catch {}
  }
  
  function readSummaryErrorState(jobId){
    try {
      const key = `agilo:summary-error:${jobId}`;
      const data = localStorage.getItem(key);
      if (!data) return null;
      const parsed = JSON.parse(data);
      // Vérifier que l'état n'est pas trop vieux (max 5 minutes)
      if (Date.now() - parsed.timestamp > 5 * 60 * 1000) {
        localStorage.removeItem(key);
        return null;
      }
      return parsed;
    } catch { return null; }
  }

  /************* Détection du message d'erreur dans le DOM *************/
  function hasErrorMessageInDOM(){
    // ⚠️ IMPORTANT : Vérifier d'abord le dataset du script principal
    if (editorRoot?.dataset.summaryEmpty === '1') {
      log('summaryEmpty=1 détecté (script principal)');
      // Stocker l'état d'erreur pour référence future
      const jobId = pickJobId();
      if (jobId) saveSummaryErrorState(jobId, true, 'summaryEmpty=1');
      return true;
    }
    
    // ⚠️ Vérifier aussi l'état d'erreur stocké (au cas où le DOM n'est pas encore mis à jour)
    const jobId = pickJobId();
    if (jobId) {
      const errorState = readSummaryErrorState(jobId);
      if (errorState?.hasError) {
        log('État d\'erreur API détecté (stocké):', errorState.errorCode);
        return true;
      }
    }
    
    const summaryEl = byId('summaryEditor') || byId('ag-summary') || $('[data-editor="summary"]');
    if (!summaryEl) {
      log('summaryEl non trouvé');
      // Si summaryEl n'existe pas, on vérifie quand même summaryEmpty au cas où
      return editorRoot?.dataset.summaryEmpty === '1';
    }
    
    const text = summaryEl.textContent || summaryEl.innerText || '';
    const html = summaryEl.innerHTML || '';
    
    log('Vérification message erreur:', {
      textLength: text.length,
      htmlLength: html.length,
      hasAgAlert: html.includes('ag-alert'),
      summaryEmpty: editorRoot?.dataset.summaryEmpty,
      textPreview: text.substring(0, 150)
    });
    
    // ⚠️ Vérifier d'abord le message exact (plus rapide et fiable)
    const lowerText = text.toLowerCase();
    const lowerHtml = html.toLowerCase();
    const exactLower = EXACT_ERROR_MESSAGE.toLowerCase();
    if (lowerText.includes(exactLower) || lowerHtml.includes(exactLower)) {
      log('✅ Message exact détecté:', EXACT_ERROR_MESSAGE);
      return true;
    }
    
    // Vérifier les patterns d'erreur dans le texte
    const hasError = ERROR_PATTERNS.some(pattern => {
      const patternLower = pattern.toLowerCase();
      const found = lowerText.includes(patternLower) || lowerHtml.includes(patternLower);
      if (found) {
        log('Pattern trouvé:', pattern);
      }
      return found;
    });
    
    if (hasError) {
      log('✅ Message d\'erreur détecté dans le DOM:', text.substring(0, 100));
      // Stocker l'état d'erreur pour référence future
      const currentJobId = pickJobId();
      if (currentJobId) saveSummaryErrorState(currentJobId, true, 'dom-message-detected');
      return true;
    }
    
    // ⚠️ Vérifier aussi les classes d'alerte (ag-alert du script principal) - PRIORITAIRE
    const alerts = $$('.ag-alert, .ag-alert--warn, .ag-alert__title', summaryEl);
    log('Alertes trouvées:', alerts.length);
    for (const alert of alerts) {
      const alertText = (alert.textContent || alert.innerText || '').toLowerCase();
      log('Texte alerte:', alertText.substring(0, 150));
      
      // Vérifier le message exact d'abord
      if (alertText.includes(exactLower)) {
        log('✅ Message exact détecté dans alerte:', EXACT_ERROR_MESSAGE);
        const currentJobId = pickJobId();
        if (currentJobId) saveSummaryErrorState(currentJobId, true, 'exact-message-in-alert');
        return true;
      }
      
      // Puis les patterns
      if (ERROR_PATTERNS.some(p => alertText.includes(p.toLowerCase()))) {
        log('✅ Message d\'erreur détecté dans une alerte:', alertText.substring(0, 100));
        const currentJobId = pickJobId();
        if (currentJobId) saveSummaryErrorState(currentJobId, true, 'pattern-in-alert');
        return true;
      }
    }
    
    // Vérifier aussi dans tout le document (au cas où l'alerte serait ailleurs)
    const allAlerts = $$('.ag-alert, .ag-alert--warn');
    for (const alert of allAlerts) {
      const alertText = (alert.textContent || alert.innerText || '').toLowerCase();
      if (alertText.includes(exactLower) || ERROR_PATTERNS.some(p => alertText.includes(p.toLowerCase()))) {
        log('✅ Message d\'erreur détecté dans alerte globale:', alertText.substring(0, 100));
        return true;
      }
    }
    
    // Vérifier si le contenu est vide ou juste un message d'erreur
    const cleanText = text.replace(/\s+/g, ' ').trim();
    if (cleanText.length < 100 && (cleanText.toLowerCase().includes(exactLower) || ERROR_PATTERNS.some(p => cleanText.toLowerCase().includes(p.toLowerCase())))) {
      log('✅ Message d\'erreur détecté (texte court):', cleanText);
      return true;
    }
    
    log('❌ Aucun message d\'erreur détecté');
    return false;
  }

  /************* Jobs info & statut *************/
  async function getTranscriptStatus(jobId, auth, signal){
    const r = await apiGetWithRetry('status', jobId, {...auth}, 0, signal);
    if (!r.ok) {
      // Si l'API retourne une erreur avec ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS
      if (r.json && /ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS/i.test(r.json.errorMessage || '')) {
        log('⚠️ ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS détecté dans getTranscriptStatus');
        saveSummaryErrorState(jobId, true, 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS');
        return 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS';
      }
      return null;
    }
    try {
      const data = JSON.parse(r.payload) || {};
      const status = data.transcriptStatus || null;
      // Vérifier aussi dans javaException
      if (data.javaException && /ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS/i.test(data.javaException)) {
        log('⚠️ ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS détecté dans javaException');
        saveSummaryErrorState(jobId, true, 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS');
        return 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS';
      }
      return status;
    } catch { return null; }
  }
  
  async function getJobsInfo(jobId, auth, signal){
    const r = await apiGetWithRetry('getJobsInfo', jobId, {...auth}, 0, signal);
    if (!r.ok) return null;
    try { return JSON.parse(r.payload) || null; } catch { return null; }
  }
  
  async function wasSummaryEverRequested(jobId, auth, signal){
    // Vérifier d'abord via getTranscriptStatus (plus fiable)
    const st = await getTranscriptStatus(jobId, auth, signal);
    if (st === 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS') {
      log('❌ Summary jamais demandé (ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS)');
      return false;
    }
    if (st === 'READY_SUMMARY_READY' || st === 'READY_SUMMARY_PENDING' || st === 'READY_SUMMARY_ON_ERROR') {
      log('✅ Summary demandé (statut:', st, ')');
      return true;
    }
    
    // Fallback sur getJobsInfo
    const info = await getJobsInfo(jobId, auth, signal);
    if (info && typeof info.doSummary !== 'undefined') {
      log('✅ Summary demandé (doSummary:', info.doSummary, ')');
      return !!info.doSummary;
    }
    
    // Si on n'a pas de statut clair, on considère que c'est demandé si on a un summary dans le DOM
    const summaryEl = byId('summaryEditor') || $('[data-editor="summary"]');
    if (summaryEl) {
      const text = (summaryEl.textContent || summaryEl.innerText || '').trim();
      // Si le contenu n'est pas un message d'erreur, on considère qu'un summary existe
      const exactMsg = "Le compte-rendu n'est pas encore disponible (fichier manquant/non publié).";
      if (text && !text.includes(exactMsg) && text.length > 50) {
        log('✅ Summary détecté dans le DOM (contenu présent)');
        return true;
      }
    }
    
    log('❌ Summary jamais demandé (aucune preuve)');
    return false;
  }

  /************* Bouton Régénérer — limites *************/
  function getRegenerationLimit(edition){
    const ed = String(edition||'').toLowerCase().trim();
    if (ed.startsWith('pro')) return 2;
    if (['ent','business','enterprise','entreprise','team'].includes(ed)) return 4;
    return 0;
  }
  
  function getRegenerationCount(jobId){
    try { return (JSON.parse(localStorage.getItem('agilo:regenerations')||'{}')[jobId]?.count) || 0; } catch { return 0; }
  }
  
  function setRegen(jobId, fn){
    try {
      const data = JSON.parse(localStorage.getItem('agilo:regenerations')||'{}');
      const row = data[jobId] || { count:0 };
      const out = fn(row) || row;
      data[jobId] = out;
      localStorage.setItem('agilo:regenerations', JSON.stringify(data));
    } catch {}
  }
  
  function incrementRegenerationCount(jobId, edition){
    setRegen(jobId, row => ({ ...row, count:(row.count||0)+1, max:getRegenerationLimit(edition), edition, lastUsed:new Date().toISOString() }));
  }
  
  function canRegenerate(jobId, edition){
    const ed = String(edition||'').toLowerCase().trim();
    if (ed.startsWith('free') || ed==='gratuit') return { allowed:false, reason:'free' };
    const limit = getRegenerationLimit(edition);
    const count = getRegenerationCount(jobId);
    if (count >= limit) return { allowed:false, reason:'limit', count, limit };
    return { allowed:true, count, limit, remaining: limit - count };
  }

  /************* UI helpers *************/
  function toast(msg){
    if (typeof window.toast === 'function') {
      window.toast(msg);
      return;
    }
    let t = byId('toaster') || byId('ag-toasts');
    if (!t) { t = document.createElement('div'); t.id='toaster'; t.className='toaster ag-toasts'; document.body.appendChild(t); }
    const div = document.createElement('div'); div.className = 'toast'; div.textContent = msg; t.appendChild(div);
    setTimeout(()=>{ div.style.opacity=0; setTimeout(()=>div.remove(),220); }, 2200);
  }
  
  function hideButton(btn, reason=''){
    if (!btn) return;
    if (DEBUG) log('hideButton', reason);
    
    // ⚠️ FORCER le masquage avec plusieurs méthodes
    btn.style.cssText = 'display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;position:absolute!important;left:-9999px!important;width:0!important;height:0!important;overflow:hidden!important;margin:0!important;padding:0!important;';
    btn.classList.add('agilo-force-hide');
    btn.setAttribute('hidden', '');
    btn.setAttribute('aria-hidden', 'true');
    btn.disabled = true;
    
    // Cacher aussi tous les enfants
    $$('*', btn).forEach(child => {
      child.style.setProperty('display', 'none', 'important');
    });
    
    // Cacher le compteur et messages
    const counter = btn.parentElement?.querySelector('.regeneration-counter, .regeneration-limit-message, .regeneration-premium-message, .regeneration-no-summary-message');
    if (counter) {
      counter.style.setProperty('display','none','important');
      counter.style.setProperty('visibility','hidden','important');
    }
    
    log('Bouton caché avec toutes les méthodes', reason);
  }
  
  function showButton(btn){
    if (!btn) return;
    
    // ⚠️ SÉCURITÉ : Ne PAS réafficher si le message d'erreur est présent
    const root = byId('editorRoot');
    if (root?.dataset.summaryEmpty === '1') {
      log('showButton: summaryEmpty=1 détecté - NE PAS réafficher');
      return; // Ne pas réafficher si summaryEmpty=1
    }
    
    // Vérifier aussi le message d'erreur dans le DOM
    if (hasErrorMessageInDOM()) {
      log('showButton: Message d\'erreur détecté - NE PAS réafficher');
      return; // Ne pas réafficher si message d'erreur présent
    }
    
    // Vérifier l'état d'erreur stocké
    const jobId = pickJobId();
    if (jobId) {
      const errorState = readSummaryErrorState(jobId);
      if (errorState?.hasError) {
        log('showButton: État erreur stocké - NE PAS réafficher');
        return; // Ne pas réafficher si erreur stockée
      }
    }
    
    // ✅ Si on arrive ici, on peut réafficher
    btn.removeAttribute('hidden');
    btn.removeAttribute('aria-hidden');
    btn.style.removeProperty('display');
    btn.style.removeProperty('visibility');
    btn.style.removeProperty('opacity');
    btn.style.removeProperty('position');
    btn.style.removeProperty('left');
    btn.style.removeProperty('width');
    btn.style.removeProperty('height');
    btn.style.removeProperty('overflow');
    btn.style.removeProperty('margin');
    btn.style.removeProperty('padding');
    btn.classList.remove('agilo-force-hide');
    
    // Réafficher les enfants
    $$('*', btn).forEach(child => {
      child.style.removeProperty('display');
    });
    
    log('showButton: Bouton réaffiché (aucune erreur détectée)');
  }
  
  function updateRegenerationCounter(jobId, edition){
    const btn = $('[data-action="relancer-compte-rendu"]');
    if (!btn) return;
    $$('.regeneration-counter, .regeneration-limit-message, .regeneration-premium-message, .regeneration-no-summary-message', btn.parentElement).forEach(el=>el.remove());
    const gate = canRegenerate(jobId, edition);
    if (gate.reason === 'free') return;
    if (gate.reason === 'limit') {
      const planName = ['ent','business'].includes(edition) ? 'Business' : 'Pro';
      const wrap = document.createElement('div');
      wrap.className = 'regeneration-limit-message';
      wrap.innerHTML = `<span style="font-size:16px;">⚠️</span><div><strong>Limite atteinte</strong><div style="font-size:12px;margin-top:2px;color:var(--agilo-dim,#525252);">${gate.count}/${gate.limit} régénérations utilisées (plan ${planName}).</div></div>`;
      btn.parentElement.appendChild(wrap);
      return;
    }
    const c = document.createElement('div');
    c.className = `regeneration-counter ${gate.remaining <= gate.limit*0.5 ? 'has-warning' : ''}`;
    c.textContent = `${gate.remaining}/${gate.limit} régénérations restantes`;
    c.title = `Il vous reste ${gate.remaining} régénération${gate.remaining>1?'s':''} pour ce transcript`;
    btn.parentElement.appendChild(c);
  }
  
  async function updateButtonState(jobId, edition){
    const btn = $('[data-action="relancer-compte-rendu"]'); 
    if (!btn) return;
    
    // ⚠️ IMPORTANT : Vérifier d'abord si un summary existe vraiment (via API)
    // Ne pas se fier uniquement au DOM qui peut être en transition
    const auth = await ensureAuth();
    const requested = await wasSummaryEverRequested(jobId, auth);
    
    if (!requested) {
      log('Summary jamais demandé - Bouton désactivé');
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
      btn.title = 'Aucun compte-rendu disponible pour régénérer';
      return;
    }
    
    // Si un summary existe, vérifier aussi le DOM pour les cas de transition
    // Mais ne pas bloquer si le summary existe vraiment
    const hasErrorInDOM = hasErrorMessageInDOM();
    if (hasErrorInDOM) {
      // Double vérification : si le statut API dit qu'un summary existe, on fait confiance à l'API
      const st = await getTranscriptStatus(jobId, auth);
      if (st === 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS') {
        log('Message d\'erreur confirmé par API - Bouton désactivé');
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
        btn.title = 'Aucun compte-rendu disponible pour régénérer';
        return;
      }
      // Si l'API dit qu'un summary existe, on ignore le message DOM (probablement une transition)
      log('Message d\'erreur dans DOM mais summary existe selon API - Bouton activé');
    }
    
    const gate = canRegenerate(jobId, edition);
    if (gate.reason === 'free'){
      btn.disabled = false; // Cliquable pour afficher la pop-up AgiloGate
      btn.style.opacity = '0.6';
      btn.style.cursor = 'pointer';
      btn.setAttribute('data-plan-min','pro');
      btn.setAttribute('data-upgrade-reason','Régénération de compte-rendu');
      if (typeof window.AgiloGate !== 'undefined' && window.AgiloGate.decorate) {
        setTimeout(() => window.AgiloGate.decorate(), 100);
      }
      return;
    }
    if (!gate.allowed){
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor  = 'not-allowed';
    } else {
      // ⚠️ IMPORTANT : S'assurer que le bouton est cliquable quand le compte-rendu est prêt
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.removeAttribute('data-plan-min');
      btn.removeAttribute('data-upgrade-reason');
      btn.removeAttribute('title');
      log('✅ Bouton activé et cliquable (summary existe)');
    }
  }

  /************* Visibilité du bouton (garde CR jamais demandé + détection DOM) *************/
  async function updateButtonVisibility(){
    // ⚠️ SUPPRIMER LES DOUBLONS D'ABORD
    removeDuplicateButtons();
    
    // ⚠️ TRAITER TOUS LES BOUTONS (au cas où il y en aurait plusieurs)
    const allButtons = $$('[data-action="relancer-compte-rendu"]');
    if (allButtons.length === 0) return;
    
    // Traiter chaque bouton
    for (const btn of allButtons) {
      await updateSingleButtonVisibility(btn);
    }
  }
  
  async function updateSingleButtonVisibility(btn){
    if (!btn) return;
    
    const auth = await ensureAuth();
    const jobId = pickJobId();
    if (!jobId || !auth.edition) {
      hideButton(btn, 'missing-creds');
      return;
    }

    // ⚠️ PRIORITÉ ABSOLUE 1 : Vérifier summaryEmpty du script principal
    const root = byId('editorRoot');
    if (root?.dataset.summaryEmpty === '1') {
      if (DEBUG) log('⚠️ PRIORITÉ ABSOLUE: summaryEmpty=1 - Cache bouton immédiatement');
      hideButton(btn, 'summary-empty-absolute');
      hideCounter(btn); // Cacher aussi le compteur
      if (!$('.regeneration-no-summary-message', btn.parentElement)) {
        const msg = document.createElement('div');
        msg.className = 'regeneration-no-summary-message';
        msg.innerHTML = `<span style="font-size:16px;">ℹ️</span><div><strong>Aucun compte-rendu demandé</strong><div style="font-size:12px;margin-top:2px;color:var(--agilo-dim,#525252);">Envoyez un audio avec l'option "Générer le compte-rendu".</div></div>`;
        btn.parentElement.appendChild(msg);
      }
      return; // ⚠️ ARRÊT IMMÉDIAT - Ne pas continuer
    }

    // ⚠️ PRIORITÉ 2 : Vérifier via API si le compte-rendu a été demandé (AVANT de vérifier le DOM)
    // Cette vérification est plus fiable que le DOM qui peut être en transition
    const requested = await wasSummaryEverRequested(jobId, auth);
    if (!requested){
      if (DEBUG) log('⚠️ PRIORITÉ 2: Summary jamais demandé (API) - Cache bouton');
      hideButton(btn, 'never-requested-api');
      hideCounter(btn); // Cacher aussi le compteur
      if (!$('.regeneration-no-summary-message', btn.parentElement)) {
        const msg = document.createElement('div');
        msg.className = 'regeneration-no-summary-message';
        msg.innerHTML = `<span style="font-size:16px;">ℹ️</span><div><strong>Aucun compte-rendu demandé</strong><div style="font-size:12px;margin-top:2px;color:var(--agilo-dim,#525252);">Envoyez un audio avec l'option "Générer le compte-rendu".</div></div>`;
        btn.parentElement.appendChild(msg);
      }
      return; // ⚠️ ARRÊT - Ne pas continuer
    }

    // ⚠️ PRIORITÉ 3 : Vérifier le message d'erreur dans le DOM (double vérification)
    const hasError = hasErrorMessageInDOM();
    if (hasError) {
      // Double vérification : si l'API dit qu'un summary existe, on fait confiance à l'API
      const st = await getTranscriptStatus(jobId, auth);
      if (st === 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS') {
        if (DEBUG) log('⚠️ PRIORITÉ 3: Message d\'erreur confirmé par API - Cache bouton');
        hideButton(btn, 'error-confirmed-by-api');
        hideCounter(btn);
        if (!$('.regeneration-no-summary-message', btn.parentElement)) {
          const msg = document.createElement('div');
          msg.className = 'regeneration-no-summary-message';
          msg.innerHTML = `<span style="font-size:16px;">ℹ️</span><div><strong>Aucun compte-rendu demandé</strong><div style="font-size:12px;margin-top:2px;color:var(--agilo-dim,#525252);">Envoyez un audio avec l'option "Générer le compte-rendu".</div></div>`;
          btn.parentElement.appendChild(msg);
        }
        return; // ⚠️ ARRÊT - Ne pas continuer
      }
      // Si l'API dit qu'un summary existe, on ignore le message DOM (probablement une transition)
      if (DEBUG) log('⚠️ Message d\'erreur dans DOM mais summary existe selon API - Bouton activé');
    }

    // ⚠️ PRIORITÉ 4 : Vérifier l'état d'erreur stocké (au cas où le DOM n'est pas encore mis à jour)
    const errorState = readSummaryErrorState(jobId);
    if (errorState?.hasError) {
      // Double vérification avec l'API
      const st = await getTranscriptStatus(jobId, auth);
      if (st === 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS') {
        if (DEBUG) log('⚠️ PRIORITÉ 4: État d\'erreur stocké confirmé par API - Cache bouton');
        hideButton(btn, 'error-state-confirmed');
        hideCounter(btn);
        if (!$('.regeneration-no-summary-message', btn.parentElement)) {
          const msg = document.createElement('div');
          msg.className = 'regeneration-no-summary-message';
          msg.innerHTML = `<span style="font-size:16px;">ℹ️</span><div><strong>Aucun compte-rendu demandé</strong><div style="font-size:12px;margin-top:2px;color:var(--agilo-dim,#525252);">Envoyez un audio avec l'option "Générer le compte-rendu".</div></div>`;
          btn.parentElement.appendChild(msg);
        }
        return; // ⚠️ ARRÊT - Ne pas continuer
      }
      // Si l'API dit qu'un summary existe, on ignore l'état stocké (peut être obsolète)
      if (DEBUG) log('⚠️ État d\'erreur stocké mais summary existe selon API - Bouton activé');
    }

    // ✅ Si on arrive ici, le compte-rendu existe vraiment → bouton visible
    if (DEBUG) log('✅ Compte-rendu existe - Affiche bouton');
    showButton(btn);
    showCounter(btn); // Réafficher le compteur
    updateRegenerationCounter(jobId, auth.edition);
    // updateButtonState est maintenant async, on doit attendre
    updateButtonState(jobId, auth.edition).catch(e => {
      warn('Erreur updateButtonState:', e);
    });
  }
  
  function hideCounter(btn) {
    if (!btn) return;
    const counters = $$('.regeneration-counter, #regeneration-info', btn.parentElement || document);
    counters.forEach(c => {
      c.style.display = 'none';
      c.style.visibility = 'hidden';
    });
  }
  
  function showCounter(btn) {
    if (!btn) return;
    const counters = $$('.regeneration-counter, #regeneration-info', btn.parentElement || document);
    counters.forEach(c => {
      c.style.removeProperty('display');
      c.style.removeProperty('visibility');
    });
  }

  /************* Poll du résumé jusqu'à READY + hash différent *************/
  async function pollSummaryUntilReady(jobId, auth, { oldHash='', max=MAX_POLL, baseDelay=BASE_DELAY, signal } = {}){
    log('⏳ Début poll pour nouveau compte-rendu', { jobId, oldHash: oldHash.substring(0, 30) + '...', max });
    
    for (let i=0; i<max; i++){
      if (signal?.aborted) return { ok:false, code:'CANCELLED' };
      const st = await getTranscriptStatus(jobId, auth, signal);
      
      if (st === 'READY_SUMMARY_READY'){
        const r = await apiGetWithRetry('summary', jobId, {...auth}, 0, signal);
        if (r.ok){
          const html = String(r.payload||'');
          if (!looksLikeNotReady(html) && !isBlankHtml(html)){
            const newHash = getContentHash(html);
            log(`Tentative ${i+1}/${max} - Hash: ${newHash.substring(0, 30)}...`);
            
            if (!oldHash || newHash !== oldHash){
              log('✅ NOUVEAU compte-rendu détecté !', {
                oldHash: oldHash.substring(0, 30) + '...',
                newHash: newHash.substring(0, 30) + '...',
                htmlLength: html.length
              });
              saveSummaryHash(jobId, newHash);
              return { ok:true, html, hash:newHash };
        } else {
              log(`⚠️ Hash identique (${newHash.substring(0, 30)}...) - Attente continue...`);
            }
          }
        }
      }
      await wait(baseDelay * Math.pow(1.25, i));
    }
    return { ok:false, code:'TIMEOUT' };
  }

  /************* Helpers HTML et liens *************/
  function sanitizeHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    div.querySelectorAll('script, style, link[rel="stylesheet"], iframe, object, embed').forEach(n => n.remove());
    div.querySelectorAll('*').forEach(n => {
      [...n.attributes].forEach(a => {
        const name = a.name.toLowerCase();
        const val = String(a.value || '');
        if (name.startsWith('on') || /^javascript:/i.test(val)) n.removeAttribute(a.name);
      });
    });
    return div.innerHTML;
  }
  
  function enableLink(el, href){
    if (!el) return;
    if (el.__agiloBlocker) {
      el.removeEventListener('click', el.__agiloBlocker);
      el.__agiloBlocker=null;
    }
    el.classList.remove('is-disabled');
    el.removeAttribute('aria-disabled');
    el.removeAttribute('title');
    el.setAttribute('href', href);
    el.setAttribute('target','_blank');
  }
  
  function disableLink(el, msg='Indisponible'){
    if (!el) return;
    if (el.__agiloBlocker) el.removeEventListener('click', el.__agiloBlocker);
    el.__agiloBlocker = (e)=>{ e.preventDefault(); if (window.toast) window.toast(msg); };
    el.addEventListener('click', el.__agiloBlocker);
    el.classList.add('is-disabled');
    el.setAttribute('aria-disabled','true');
    el.setAttribute('title', msg);
    el.removeAttribute('target');
    el.setAttribute('href', 'javascript:void(0)');
  }
  
  function updateDownloadLinks(jobId, auth, {summaryEmpty=false} = {}) {
    const dl = {
      t_txt: $('.download_wrapper-link_transcript_txt'),
      t_rtf: $('.download_wrapper-link_transcript_rtf'),
      t_doc: $('.download_wrapper-link_transcript_doc'),
      t_docx: $('.download_wrapper-link_transcript_docx'),
      t_pdf: $('.download_wrapper-link_transcript_pdf'),
      s_txt: $('.download_wrapper-link_summary_txt'),
      s_rtf: $('.download_wrapper-link_summary_rtf'),
      s_doc: $('.download_wrapper-link_summary_doc'),
      s_docx: $('.download_wrapper-link_summary_docx'),
      s_pdf: $('.download_wrapper-link_summary_pdf')
    };
    if (!jobId || !auth?.username || !auth?.token) return;
    const baseQ = `jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(auth.username)}&token=${encodeURIComponent(auth.token)}&edition=${encodeURIComponent(auth.edition)}`;
    enableLink(dl.t_txt, `${API_BASE}/receiveText?${baseQ}&format=txt`);
    enableLink(dl.t_rtf, `${API_BASE}/receiveText?${baseQ}&format=rtf`);
    enableLink(dl.t_doc, `${API_BASE}/receiveText?${baseQ}&format=doc`);
    enableLink(dl.t_docx, `${API_BASE}/receiveText?${baseQ}&format=docx`);
    enableLink(dl.t_pdf, `${API_BASE}/receiveText?${baseQ}&format=pdf`);
    if (summaryEmpty) {
      ['s_txt','s_rtf','s_doc','s_docx','s_pdf'].forEach(k=> disableLink(dl[k], 'Résumé non disponible pour le moment'));
    } else {
      enableLink(dl.s_txt, `${API_BASE}/receiveSummary?${baseQ}&format=html`);
      enableLink(dl.s_rtf, `${API_BASE}/receiveSummary?${baseQ}&format=rtf`);
      enableLink(dl.s_doc, `${API_BASE}/receiveSummary?${baseQ}&format=doc`);
      enableLink(dl.s_docx, `${API_BASE}/receiveSummary?${baseQ}&format=docx`);
      enableLink(dl.s_pdf, `${API_BASE}/receiveSummary?${baseQ}&format=pdf`);
    }
    const share = byId('shareLink');
    if (share) {
      const u = new URL(share.href || location.href);
      u.searchParams.set('jobId', jobId);
      u.searchParams.set('edition', auth.edition);
      share.href = u.toString();
    }
  }

  /************* Loader Lottie pour régénération *************/
  function showSummaryLoading(){
    const summaryEditor = byId('summaryEditor') || byId('ag-summary') || $('[data-editor="summary"]');
    if (!summaryEditor) return;
    
    // Créer le conteneur de chargement
    let loaderContainer = summaryEditor.querySelector('.summary-loading-indicator');
    
    if (!loaderContainer) {
      loaderContainer = document.createElement('div');
      loaderContainer.className = 'summary-loading-indicator';
      loaderContainer.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;min-height:200px;';
      
      // Créer l'élément Lottie
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
      
      // Ajouter les textes
      const loadingText = document.createElement('p');
      loadingText.className = 'loading-text';
      loadingText.style.cssText = 'font-size:18px;font-weight:600;margin-top:20px;color:var(--agilo-text,#020202);';
      loadingText.textContent = 'Régénération du compte-rendu en cours...';
      
      const loadingSubtitle = document.createElement('p');
      loadingSubtitle.className = 'loading-subtitle';
      loadingSubtitle.style.cssText = 'font-size:14px;margin-top:8px;color:var(--agilo-dim,#525252);';
      loadingSubtitle.textContent = 'Cela peut prendre quelques instants';
      
      summaryEditor.innerHTML = '';
      summaryEditor.appendChild(loaderContainer);
      loaderContainer.appendChild(lottieElement);
      loaderContainer.appendChild(loadingText);
      loaderContainer.appendChild(loadingSubtitle);
      
      // Initialiser l'animation Lottie si Webflow est disponible
      setTimeout(() => {
        if (window.Webflow && window.Webflow.require) {
          try {
            window.Webflow.require('ix2').init();
          } catch (e) {
            // Fallback: spinner CSS si Lottie ne charge pas
            setTimeout(() => {
              const hasLottieContent = lottieElement.querySelector('svg, canvas') || lottieElement._lottie;
              if (!hasLottieContent) {
                const fallback = document.createElement('div');
                fallback.className = 'lottie-fallback';
                fallback.style.cssText = 'width:60px;height:60px;border:4px solid #f3f3f3;border-top:4px solid #174a96;border-radius:50%;animation:spin 1s linear infinite;';
                lottieElement.style.display = 'none';
                loaderContainer.insertBefore(fallback, lottieElement);
                // Ajouter l'animation CSS si elle n'existe pas
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
  
  function hideSummaryLoading(){
    const loader = $('.summary-loading-indicator');
    if (loader) {
      loader.style.display = 'none';
    }
  }

  /************* Relancer le résumé *************/
  let __isGenerating = false;
  let __activePollingJobId = null; // Pour gérer le changement de job pendant le polling
  async function relancerCompteRendu(){
    if (__isGenerating) return;
    const now = Date.now();
    if (relancerCompteRendu._last && (now - relancerCompteRendu._last) < 500) return;
    relancerCompteRendu._last = now;

    const auth = await ensureAuth();
    const jobId = pickJobId();
    if (!auth.username || !auth.token || !jobId){
      alert('❌ Informations incomplètes.');
        return;
      }
      
    // limites
    const gate = canRegenerate(jobId, auth.edition);
    if (!gate.allowed){
      if (gate.reason === 'free'){
        if (typeof window.AgiloGate !== 'undefined' && window.AgiloGate.showUpgrade) {
          window.AgiloGate.showUpgrade('pro', 'Régénération de compte-rendu');
    } else {
          alert('🔒 Fonctionnalité Premium — disponible en Pro/Business.');
          }
        } else {
        alert(`⚠️ Limite atteinte\n\n${gate.count}/${gate.limit} régénérations utilisées.`);
      }
      return;
    }
    
    // garde "jamais demandé"
    const requested = await wasSummaryEverRequested(jobId, auth);
    if (!requested){
      alert('⚠️ Aucun compte-rendu initial demandé pour cet audio.');
          return;
        }
        
    const ok = confirm(`Remplacer le compte-rendu actuel ?\n\n${gate.remaining}/${gate.limit} régénération${gate.remaining>1?'s':''} restante${gate.remaining>1?'s':''}.`);
    if (!ok) return;

    // hash avant régénération
    let oldHash = '';
    try {
      const r = await apiGetWithRetry('summary', jobId, {...auth}, 0, null);
      if (r.ok) {
        const html = String(r.payload||'');
        if (!isBlankHtml(html) && !looksLikeNotReady(html)) oldHash = getContentHash(html);
      }
    } catch {}

    __isGenerating = true;
    __activePollingJobId = jobId; // Mémoriser le jobId actif pour le polling
    const btn = $('[data-action="relancer-compte-rendu"]');
    const btnText = btn?.querySelector('div');
    if (btn) { btn.disabled = true; if (btnText) btnText.textContent = 'Génération…'; }

    // ⚠️ AFFICHER LE LOADER IMMÉDIATEMENT
    showSummaryLoading();

    try{
      if (DEBUG) log('🚀 APPEL API redoSummary', { jobId, edition: auth.edition, timestamp: new Date().toISOString() });
      
      const fd = new FormData();
      fd.append('username', auth.username);
      fd.append('token', auth.token);
      fd.append('edition', auth.edition);
      fd.append('jobId', jobId);

      const apiStartTime = Date.now();
      const redo = await fetchWithTimeout(`${API_BASE}/redoSummary`, { method:'POST', body: fd, timeout: 20000 });
      const apiTime = Date.now() - apiStartTime;
      
      if (DEBUG) log('⏱️ Temps réponse API:', apiTime + 'ms');
      
      const j = await redo.json().catch(()=>({ status:'KO' }));
      
      if (DEBUG) log('Réponse API:', { status: j.status, httpStatus: redo.status, ok: redo.ok });
      
      if (!redo.ok || !(j.status==='OK' || j.ok === true)) {
        hideSummaryLoading();
        alert('❌ Erreur lors de la régénération.\n\n' + (j.message || j.error || j.errorMessage || 'Erreur inconnue'));
        return;
      }
        
      if (DEBUG) log('✅ API redoSummary OK - Incrémentation compteur');
      incrementRegenerationCount(jobId, auth.edition);
      updateRegenerationCounter(jobId, auth.edition);
      updateButtonState(jobId, auth.edition);
      if (window.toast) window.toast('✅ Régénération lancée');

      // ⚠️ POLLER jusqu'à READY + nouveau hash (avec gestion du changement de job)
      if (DEBUG) log('⏳ Attente génération nouveau compte-rendu...');
      const signal = new AbortController();
      
      // Vérifier périodiquement si le job a changé pendant le polling
      const checkJobChange = setInterval(() => {
        const currentJobId = pickJobId();
        if (currentJobId !== jobId) {
          if (DEBUG) log('⚠️ Job changé pendant le polling - Annulation');
          signal.abort();
          clearInterval(checkJobChange);
          __activePollingJobId = null;
        }
      }, 1000);
      
      const result = await pollSummaryUntilReady(jobId, {...auth}, { oldHash, max: MAX_POLL + 10, baseDelay: BASE_DELAY, signal: signal.signal });
      
      clearInterval(checkJobChange);
      
      // ⚠️ Vérifier si le job est toujours actif avant d'afficher le résultat
      const currentJobId = pickJobId();
      if (currentJobId !== jobId) {
        if (DEBUG) log('⚠️ Job changé - Ne pas afficher le résultat');
        __activePollingJobId = null;
        return;
      }
      
      if (result.ok) {
        if (DEBUG) log('✅ NOUVEAU compte-rendu prêt !', {
          hash: result.hash?.substring(0, 30) + '...',
          htmlLength: result.html?.length
        });
        
        // ⚠️ AFFICHER LE NOUVEAU COMPTE-RENDU DIRECTEMENT DANS summaryEditor (sans recharger la page)
        const summaryEditor = byId('summaryEditor') || byId('ag-summary') || $('[data-editor="summary"]');
        if (summaryEditor && result.html) {
          hideSummaryLoading();
          summaryEditor.innerHTML = sanitizeHtml(result.html);
          
          // Mettre à jour summaryEmpty dans editorRoot
          const root = byId('editorRoot');
          if (root) {
            root.dataset.summaryEmpty = '0';
          }
          
          // Mettre à jour les liens de téléchargement
          updateDownloadLinks(jobId, auth, { summaryEmpty: false });
          
          // Sauvegarder le hash
          if (result.hash) saveSummaryHash(jobId, result.hash);
          
          // Mettre à jour la visibilité du bouton
          updateButtonVisibility().catch(() => {});
          
          if (window.toast) window.toast('✅ Compte-rendu régénéré avec succès');
        } else {
          // Fallback: recharger la page si summaryEditor n'est pas trouvé
          const url = new URL(location.href);
          url.searchParams.set('tab','summary');
          url.searchParams.set('_regen', Date.now().toString());
          url.searchParams.set('_nocache', Math.random().toString(36).slice(2));
          if (result.hash) saveSummaryHash(jobId, result.hash);
          window.location.replace(url.toString());
        }
      } else {
        hideSummaryLoading();
        if (result.code === 'CANCELLED') {
          if (DEBUG) log('⚠️ Polling annulé (job changé)');
        } else {
          warn('⚠️ Compte-rendu pas prêt après toutes les tentatives');
          alert('⚠️ Le compte-rendu n\'est pas encore prêt. Il sera disponible dans quelques instants.');
        }
      }
    } catch (e){
      err('redo error', e);
      hideSummaryLoading();
      alert('❌ Erreur réseau lors de la régénération.');
    } finally {
      __isGenerating = false;
      __activePollingJobId = null;
      if (btn) { btn.disabled = false; if (btnText) btnText.textContent = 'Régénérer'; }
    }
  }

  /************* Init, évènements, décorations *************/
  function injectStyles(){
    if ($('#agilo-relance-styles')) return;
    const s = document.createElement('style');
    s.id = 'agilo-relance-styles';
    s.textContent = `
      [data-action="relancer-compte-rendu"].agilo-force-hide,
      [data-action="relancer-compte-rendu"].agilo-force-hide *,
      [data-action="relancer-compte-rendu"][hidden],
      [data-action="relancer-compte-rendu"][aria-hidden="true"] {
        display:none!important; visibility:hidden!important; opacity:0!important; pointer-events:none!important; position:absolute!important; left:-9999px!important; width:0!important; height:0!important; overflow:hidden!important; margin:0!important; padding:0!important;
      }
      .regeneration-counter{display:flex;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:500;color:var(--agilo-dim,#525252);margin-top:6px;padding:4px 8px;border-radius:4px;background:var(--agilo-surface-2,#f8f9fa);}
      .regeneration-counter.has-warning{color:#fd7e14;background:color-mix(in srgb, #fd7e14 10%, #ffffff 90%);}
      .regeneration-limit-message,.regeneration-no-summary-message{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;margin-top:8px;border-radius:4px;font-size:13px;line-height:1.4;color:var(--agilo-text,#020202);background:color-mix(in srgb, #174a96 8%, #ffffff 92%);border:1px solid color-mix(in srgb, #174a96 25%, transparent);}
      .regeneration-limit-message strong,.regeneration-no-summary-message strong{display:block;margin-bottom:2px;font-weight:600;}
    `;
    document.head.appendChild(s);
  }

  function bindRelanceClick(){
    document.addEventListener('click', (e)=>{
      const btn = e.target.closest('[data-action="relancer-compte-rendu"]');
    if (!btn) return;
    
      // Vérifier que le bouton n'est pas caché
      if (btn.classList.contains('agilo-force-hide')) {
        log('Bouton caché - Clic ignoré');
        return;
      }
      
      // Vérifier que le bouton n'est pas désactivé
      if (btn.disabled) {
        log('Bouton désactivé - Clic ignoré');
        return;
      }
      
      // Vérifier une dernière fois si le message d'erreur est présent
      if (hasErrorMessageInDOM()) {
        log('Message d\'erreur détecté au clic - Action annulée');
        toast('Aucun compte-rendu disponible pour régénérer');
      return;
    }
    
          e.preventDefault();
        e.stopPropagation();
      log('Clic sur bouton régénérer - Lancement...');
          relancerCompteRendu();
    }, { passive:false });
  }

  // Observer les changements du summaryEditor pour détecter les messages d'erreur
  function setupSummaryObserver(){
    const summaryEl = byId('summaryEditor') || byId('ag-summary') || $('[data-editor="summary"]');
    if (!summaryEl) {
      log('summaryEl non trouvé pour observer');
      // Réessayer après un délai
      setTimeout(() => setupSummaryObserver(), 1000);
      return;
    }
    
    log('Observer configuré pour summaryEl');
    
    let debounceTimer = null;
    const debouncedUpdate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        log('Mutation détectée dans summaryEl - Mise à jour visibilité');
        updateButtonVisibility().catch((e) => {
          log('Erreur updateButtonVisibility:', e);
        });
      }, 50); // Délai réduit pour réaction plus rapide
    };
    
    const observer = new MutationObserver((mutations) => {
      // Vérifier immédiatement si un message d'erreur apparaît
      const hasError = hasErrorMessageInDOM();
      if (hasError) {
        log('⚠️ Message d\'erreur détecté immédiatement - Cache bouton');
        const btn = $('[data-action="relancer-compte-rendu"]');
        if (btn && !btn.classList.contains('agilo-force-hide')) {
          hideButton(btn, 'immediate-error-detection');
        }
      }
      debouncedUpdate();
    });
    
    observer.observe(summaryEl, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: false // On observe déjà editorRoot pour les attributs
    });
    
    // Observer aussi les changements du dataset summaryEmpty sur editorRoot
    if (editorRoot) {
      log('Observer configuré pour editorRoot dataset');
      const rootObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'data-summary-empty') {
            const newValue = editorRoot.dataset.summaryEmpty;
            log('data-summary-empty changé:', newValue);
            
            // Réaction immédiate si summaryEmpty devient '1'
            if (newValue === '1') {
              const btn = $('[data-action="relancer-compte-rendu"]');
              if (btn && !btn.classList.contains('agilo-force-hide')) {
                log('⚠️ summaryEmpty=1 détecté - Cache bouton immédiatement');
                hideButton(btn, 'summary-empty-changed');
              }
            }
            
            setTimeout(() => {
              updateButtonVisibility().catch((e) => {
                log('Erreur updateButtonVisibility:', e);
              });
            }, 50);
          }
        });
      });
      
      rootObserver.observe(editorRoot, {
        attributes: true,
        attributeFilter: ['data-summary-empty']
      });
    } else {
      log('editorRoot non trouvé');
      // Réessayer après un délai
      setTimeout(() => {
        if (byId('editorRoot')) setupSummaryObserver();
      }, 1000);
    }
  }

  // Observer la sauvegarde du transcript
  function setupSaveObserver(){
    const saveBtn = $('[data-action="save-transcript"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        setTimeout(() => {
          updateButtonVisibility().catch(() => {});
        }, 500);
      });
    }
  }

  // ⚠️ VÉRIFICATION IMMÉDIATE SYNCHRONE (avant même l'init async)
  function immediateCheck(){
    // ⚠️ SUPPRIMER LES DOUBLONS D'ABORD
    removeDuplicateButtons();
    
    // ⚠️ TRAITER TOUS LES BOUTONS
    const allButtons = $$('[data-action="relancer-compte-rendu"]');
    if (allButtons.length === 0) {
      log('immediateCheck: Aucun bouton trouvé');
      return;
    }
    
    // Traiter chaque bouton
    for (const btn of allButtons) {
      // Récupérer editorRoot à chaque fois (au cas où il n'était pas là au début)
      const root = byId('editorRoot');
      
      log('immediateCheck: Début', {
        btnExists: !!btn,
        rootExists: !!root,
        summaryEmpty: root?.dataset.summaryEmpty,
        btnVisible: window.getComputedStyle(btn).display !== 'none',
        hasForceHide: btn.classList.contains('agilo-force-hide')
      });
      
      // Vérifier summaryEmpty immédiatement
      if (root?.dataset.summaryEmpty === '1') {
        log('⚠️ VÉRIFICATION IMMÉDIATE: summaryEmpty=1 détecté - Cache bouton');
        hideButton(btn, 'immediate-check-summary-empty');
        continue;
      }
      
      // ⚠️ PRIORITÉ ABSOLUE : Vérifier le message d'erreur dans le DOM (même si summaryEmpty='0')
      // Car le script principal peut avoir mis summaryEmpty='0' par erreur
      const summaryEl = byId('summaryEditor') || byId('ag-summary') || $('[data-editor="summary"]');
      if (summaryEl) {
        const text = (summaryEl.textContent || summaryEl.innerText || '').toLowerCase();
        const html = (summaryEl.innerHTML || '').toLowerCase();
        const exactMsg = "Le compte-rendu n'est pas encore disponible (fichier manquant/non publié).".toLowerCase();
        
        // Vérifier le message exact (plus fiable) - PRIORITÉ ABSOLUE
        if (text.includes(exactMsg) || html.includes(exactMsg)) {
          console.log('[AGILO:RELANCE] ⚠️ VÉRIFICATION IMMÉDIATE: Message exact détecté - Cache bouton (même si summaryEmpty=0)');
          hideButton(btn, 'immediate-check-exact-message');
          hideCounter(btn);
          continue;
        }
        
        // Vérifier les patterns - PRIORITÉ ABSOLUE
        if (text.includes('pas encore disponible') || text.includes('fichier manquant') || text.includes('non publié')) {
          console.log('[AGILO:RELANCE] ⚠️ VÉRIFICATION IMMÉDIATE: Pattern erreur détecté - Cache bouton (même si summaryEmpty=0)');
          hideButton(btn, 'immediate-check-error-pattern');
          hideCounter(btn);
          continue;
        }
        
        // Vérifier aussi dans les alertes - PRIORITÉ ABSOLUE
        const alerts = summaryEl.querySelectorAll('.ag-alert, .ag-alert--warn, .ag-alert__title, [class*="alert"]');
        for (const alert of alerts) {
          const alertText = (alert.textContent || alert.innerText || '').toLowerCase();
          if (alertText.includes(exactMsg) || alertText.includes('pas encore disponible') || alertText.includes('fichier manquant')) {
            console.log('[AGILO:RELANCE] ⚠️ VÉRIFICATION IMMÉDIATE: Message erreur dans alerte - Cache bouton (même si summaryEmpty=0)');
            hideButton(btn, 'immediate-check-alert-message');
            hideCounter(btn);
            break; // Sortir de la boucle alertes
          }
        }
      }
    }
    
    log('immediateCheck: Vérification terminée pour tous les boutons');
  }

  // ⚠️ SUPPRIMER LES DOUBLONS DE BOUTONS
  function removeDuplicateButtons(){
    const allButtons = $$('[data-action="relancer-compte-rendu"]');
    if (allButtons.length > 1) {
      warn(`⚠️ ${allButtons.length} boutons "relancer-compte-rendu" détectés ! Suppression des doublons...`);
      // Garder le premier, supprimer les autres
      for (let i = 1; i < allButtons.length; i++) {
        log(`Suppression bouton dupliqué ${i+1}/${allButtons.length}`);
        allButtons[i].remove();
      }
      // Supprimer aussi les compteurs en double
      const counters = $$('#regeneration-info');
      if (counters.length > 1) {
        warn(`⚠️ ${counters.length} compteurs "regeneration-info" détectés ! Suppression des doublons...`);
        for (let i = 1; i < counters.length; i++) {
          counters[i].remove();
        }
      }
      log('✅ Doublons supprimés');
    }
  }

  async function init(){
    if (window.__agiloEditorRelanceInit) return;
    window.__agiloEditorRelanceInit = true;

    // ⚠️ SUPPRIMER LES DOUBLONS EN PREMIER
    removeDuplicateButtons();

    // ⚠️ VÉRIFICATION IMMÉDIATE AVANT TOUT
    immediateCheck();

    injectStyles();
    bindRelanceClick();
    window.relancerCompteRendu = relancerCompteRendu;
    
    // ⚠️ EXPOSER LES FONCTIONS POUR DEBUG
    window.updateButtonVisibility = updateButtonVisibility;
    window.hasErrorMessageInDOM = hasErrorMessageInDOM;
    window.hideButton = hideButton;
    window.showButton = showButton;

    // Observer les changements du summaryEditor
    setupSummaryObserver();
    setupSaveObserver();

    // MAJ bouton à l'ouverture (plusieurs fois pour être sûr)
          await updateButtonVisibility();
    setTimeout(() => updateButtonVisibility().catch(() => {}), 500);
    setTimeout(() => updateButtonVisibility().catch(() => {}), 1500);
    setTimeout(() => updateButtonVisibility().catch(() => {}), 3000);
    
    // Vérifier périodiquement (au cas où un autre script réaffiche le bouton)
    setInterval(() => {
      const btn = $('[data-action="relancer-compte-rendu"]');
      if (btn && hasErrorMessageInDOM() && !btn.classList.contains('agilo-force-hide')) {
        log('⚠️ Bouton réaffiché alors que message erreur présent - Re-cache');
        hideButton(btn, 'periodic-check');
      }
    }, 2000);
          
    // ⚠️ IMPORTANT : Écouter agilo:beforeload pour cacher immédiatement le bouton (état de transition)
    window.addEventListener('agilo:beforeload', (e)=>{
      const raw = e?.detail?.jobId ?? e?.detail ?? '';
      const id = String(raw||'').trim();
      if (!id) return;
      
      log('agilo:beforeload détecté - Cache bouton en transition pour jobId:', id);
      
      // ⚠️ Nettoyer l'état d'erreur de l'ancien jobId (si différent)
      const oldJobId = pickJobId();
      if (oldJobId && oldJobId !== id) {
        log('Nettoyage état erreur ancien jobId:', oldJobId);
        saveSummaryErrorState(oldJobId, false);
      }
      
      const btn = $('[data-action="relancer-compte-rendu"]');
      if (btn) {
        // Cacher temporairement pendant le chargement
        btn.style.opacity = '0.5';
        btn.style.pointerEvents = 'none';
        btn.setAttribute('data-loading', 'true');
      }
    });
    
    // ⚠️ IMPORTANT : Écouter agilo:load avec vérifications progressives (le script principal met du temps à charger)
    window.addEventListener('agilo:load', async (e)=>{
      const raw = e?.detail?.jobId ?? e?.detail ?? '';
      const id = String(raw||'').trim();
      if (!id) return;
      
      if (DEBUG) log('agilo:load détecté - Vérifications progressives de la visibilité pour jobId:', id);
      
      // Retirer l'état de chargement
      const btn = $('[data-action="relancer-compte-rendu"]');
      if (btn) {
        btn.removeAttribute('data-loading');
        btn.style.removeProperty('opacity');
        btn.style.removeProperty('pointer-events');
      }
      
      // ⚠️ Vérifications progressives : le script principal met 1-3 secondes à charger le summary
      // Vérification immédiate (au cas où le DOM est déjà prêt)
      try {
        await updateButtonVisibility();
      } catch (e) {
        console.error('[AGILO:RELANCE] Erreur updateButtonVisibility (agilo:load immédiat):', e);
      }
    
      // Vérifications avec délais progressifs pour laisser le temps au script principal
      setTimeout(() => {
        if (DEBUG) log('Vérification 1 (500ms après agilo:load)');
        updateButtonVisibility().catch(e => {
          console.error('[AGILO:RELANCE] Erreur updateButtonVisibility (agilo:load 500ms):', e);
        });
      }, 500);
      
      setTimeout(() => {
        log('Vérification 2 (1500ms après agilo:load)');
        updateButtonVisibility().catch(() => {});
      }, 1500);
      
      setTimeout(() => {
        log('Vérification 3 (3000ms après agilo:load)');
        updateButtonVisibility().catch(() => {});
      }, 3000);
      
      setTimeout(() => {
        log('Vérification 4 (5000ms après agilo:load)');
        updateButtonVisibility().catch(() => {});
      }, 5000);
    });
    
    window.addEventListener('agilo:token', async ()=>{
      await updateButtonVisibility();
    });
    
    // Observer les changements d'onglet
    const tabs = $$('[role="tab"]');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        setTimeout(() => {
          updateButtonVisibility().catch(() => {});
        }, 200);
      });
    });
    
    // Si l'URL forçait l'onglet summary, on nettoie le param
    const url = new URL(location.href);
    if (url.searchParams.get('tab') === 'summary'){
      setTimeout(()=>{ url.searchParams.delete('tab'); history.replaceState({},'',url); }, 400);
    }
  }

  // ⚠️ INITIALISATION ROBUSTE avec try/catch global
  function safeInit() {
    try {
      if (window.__agiloEditorRelanceInit) {
        if (DEBUG) log('init() déjà exécuté, skip');
        return;
      }
      
      console.log('[AGILO:RELANCE] Début initialisation...');
      init();
      console.log('[AGILO:RELANCE] Initialisation terminée, __agiloEditorRelanceInit:', window.__agiloEditorRelanceInit);
      
      // ⚠️ Vérification de sécurité : si init() n'a pas défini __agiloEditorRelanceInit, c'est qu'il y a un problème
      if (!window.__agiloEditorRelanceInit) {
        console.error('[AGILO:RELANCE] ⚠️ init() exécuté mais __agiloEditorRelanceInit toujours undefined - Réessai...');
        setTimeout(() => {
          if (!window.__agiloEditorRelanceInit) {
            console.log('[AGILO:RELANCE] Nouvelle tentative d\'initialisation...');
            try {
              init();
            } catch (e2) {
              console.error('[AGILO:RELANCE] ❌ ERREUR lors de la 2ème tentative:', e2);
            }
          }
        }, 500);
      }
    } catch (e) {
      console.error('[AGILO:RELANCE] ❌ ERREUR lors de l\'initialisation:', e);
      console.error('[AGILO:RELANCE] Stack:', e.stack);
      // Réessayer après un délai
      setTimeout(() => {
        if (!window.__agiloEditorRelanceInit) {
          console.log('[AGILO:RELANCE] Nouvelle tentative d\'initialisation...');
          try {
            init();
          } catch (e2) {
            console.error('[AGILO:RELANCE] ❌ ERREUR lors de la 2ème tentative:', e2);
            console.error('[AGILO:RELANCE] Stack 2:', e2.stack);
          }
        }
      }, 1000);
    }
  }
  
  // ⚠️ VÉRIFICATION IMMÉDIATE même si le DOM n'est pas prêt
  try {
    immediateCheck();
  } catch (e) {
    console.error('[AGILO:RELANCE] Erreur immediateCheck:', e);
  }
  
  // Initialisation immédiate si DOM prêt, sinon attendre
  if (document.readyState !== 'loading') {
    // DOM déjà prêt
    setTimeout(() => {
      try { immediateCheck(); } catch (e) { console.error('[AGILO:RELANCE] Erreur immediateCheck (100ms):', e); }
    }, 100);
    setTimeout(() => {
      try { immediateCheck(); } catch (e) { console.error('[AGILO:RELANCE] Erreur immediateCheck (500ms):', e); }
    }, 500);
    safeInit();
  } else {
    // Attendre DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
      try { immediateCheck(); } catch (e) { console.error('[AGILO:RELANCE] Erreur immediateCheck (DOMContentLoaded):', e); }
      setTimeout(() => {
        try { immediateCheck(); } catch (e) { console.error('[AGILO:RELANCE] Erreur immediateCheck (DOMContentLoaded+100ms):', e); }
      }, 100);
      setTimeout(() => {
        try { immediateCheck(); } catch (e) { console.error('[AGILO:RELANCE] Erreur immediateCheck (DOMContentLoaded+500ms):', e); }
      }, 500);
      safeInit();
    }, { once:true });
    
    // Vérifications multiples (au cas où le DOM est déjà là)
    setTimeout(() => {
      try { immediateCheck(); } catch (e) { console.error('[AGILO:RELANCE] Erreur immediateCheck (timeout 100ms):', e); }
    }, 100);
    setTimeout(() => {
      try { immediateCheck(); } catch (e) { console.error('[AGILO:RELANCE] Erreur immediateCheck (timeout 300ms):', e); }
    }, 300);
    setTimeout(() => {
      try { immediateCheck(); } catch (e) { console.error('[AGILO:RELANCE] Erreur immediateCheck (timeout 500ms):', e); }
    }, 500);
    setTimeout(() => {
      try { immediateCheck(); } catch (e) { console.error('[AGILO:RELANCE] Erreur immediateCheck (timeout 1000ms):', e); }
    }, 1000);
    setTimeout(() => {
      if (!window.__agiloEditorRelanceInit) {
        console.log('[AGILO:RELANCE] Initialisation différée (2000ms) - __agiloEditorRelanceInit toujours undefined');
        try { immediateCheck(); } catch (e) { console.error('[AGILO:RELANCE] Erreur immediateCheck (timeout 2000ms):', e); }
        safeInit();
      }
    }, 2000);
  }
  
  // ⚠️ Vérification périodique de sécurité (même si init n'a pas encore tourné) - OPTIMISÉE
  setInterval(() => {
    try {
      // ⚠️ SUPPRIMER LES DOUBLONS D'ABORD
      removeDuplicateButtons();
      
      // ⚠️ TRAITER TOUS LES BOUTONS (au cas où il y en aurait plusieurs)
      const allButtons = $$('[data-action="relancer-compte-rendu"]');
      if (allButtons.length === 0) return;
      
      // Traiter chaque bouton
      for (const btn of allButtons) {
        // Récupérer editorRoot à chaque fois
        const root = byId('editorRoot');
        const styles = window.getComputedStyle(btn);
        const isVisible = styles.display !== 'none' && 
                          styles.visibility !== 'hidden' &&
                          !btn.classList.contains('agilo-force-hide') &&
                          styles.opacity !== '0';
        
        // ⚠️ Si le bouton est visible, on vérifie TOUJOURS s'il devrait être caché
        if (isVisible) {
          // PRIORITÉ 1 : Message d'erreur dans le DOM (AVANT summaryEmpty car plus fiable)
          const summaryEl = byId('summaryEditor') || byId('ag-summary') || $('[data-editor="summary"]');
          if (summaryEl) {
            const text = (summaryEl.textContent || summaryEl.innerText || '').toLowerCase();
            const html = (summaryEl.innerHTML || '').toLowerCase();
            const exactMsg = "Le compte-rendu n'est pas encore disponible (fichier manquant/non publié).".toLowerCase();
            
            // Vérifier le message exact
            if (text.includes(exactMsg) || html.includes(exactMsg)) {
              console.log('[AGILO:RELANCE] ⚠️ VÉRIFICATION PÉRIODIQUE: Message exact détecté - Cache bouton FORCÉ (même si summaryEmpty=0)');
              hideButton(btn, 'periodic-check-exact-message');
              hideCounter(btn);
              continue;
            }
            
            // Vérifier les patterns
            if (text.includes('pas encore disponible') || text.includes('fichier manquant') || text.includes('non publié')) {
              console.log('[AGILO:RELANCE] ⚠️ VÉRIFICATION PÉRIODIQUE: Pattern erreur détecté - Cache bouton FORCÉ (même si summaryEmpty=0)');
              hideButton(btn, 'periodic-check-error-message');
              hideCounter(btn);
              continue;
            }
            
            // Vérifier aussi dans les alertes
            const alerts = summaryEl.querySelectorAll('.ag-alert, .ag-alert--warn, .ag-alert__title, [class*="alert"]');
            for (const alert of alerts) {
              const alertText = (alert.textContent || alert.innerText || '').toLowerCase();
              if (alertText.includes(exactMsg) || alertText.includes('pas encore disponible') || alertText.includes('fichier manquant')) {
                console.log('[AGILO:RELANCE] ⚠️ VÉRIFICATION PÉRIODIQUE: Message erreur dans alerte - Cache bouton FORCÉ');
                hideButton(btn, 'periodic-check-alert-message');
                hideCounter(btn);
                continue;
              }
            }
          }
          
          // PRIORITÉ 2 : summaryEmpty
          if (root?.dataset.summaryEmpty === '1') {
            if (DEBUG) log('⚠️ VÉRIFICATION PÉRIODIQUE: summaryEmpty=1 - Cache bouton FORCÉ');
            hideButton(btn, 'periodic-check-summary-empty');
            hideCounter(btn);
            continue;
          }
          
          // PRIORITÉ 3 : État d'erreur stocké
          const jobId = pickJobId();
          if (jobId) {
            const errorState = readSummaryErrorState(jobId);
            if (errorState?.hasError) {
              if (DEBUG) log('⚠️ VÉRIFICATION PÉRIODIQUE: État erreur stocké - Cache bouton FORCÉ');
              hideButton(btn, 'periodic-check-error-state');
              continue;
            }
          }
        }
      }
    } catch (e) {
      console.error('[AGILO:RELANCE] Erreur vérification périodique:', e);
    }
  }, 500); // Checks every 500ms (optimisé pour moins de lag)
  
  // ⚠️ S'assurer que init() s'exécute même en cas d'erreur
  setTimeout(() => {
    if (!window.__agiloEditorRelanceInit) {
      console.warn('[AGILO:RELANCE] ⚠️ init() n\'a pas été exécuté après 3 secondes - Forçage...');
      safeInit();
    }
  }, 3000);
  
  // ⚠️ VÉRIFICATION ULTRA-AGRESSIVE : Cacher le bouton si message d'erreur présent (même si init() n'a pas tourné)
  // Cette vérification s'exécute indépendamment de init() pour garantir que le bouton est caché
  setInterval(() => {
    try {
      const btn = $('[data-action="relancer-compte-rendu"]');
      if (!btn) return;
      
      const styles = window.getComputedStyle(btn);
      const isVisible = styles.display !== 'none' && 
                        styles.visibility !== 'hidden' &&
                        !btn.classList.contains('agilo-force-hide') &&
                        styles.opacity !== '0';
      
      if (!isVisible) return; // Déjà caché, pas besoin de vérifier
      
      // Vérifier le message d'erreur dans le DOM (PRIORITÉ ABSOLUE)
      const summaryEl = byId('summaryEditor') || byId('ag-summary') || $('[data-editor="summary"]');
      if (summaryEl) {
        const text = (summaryEl.textContent || summaryEl.innerText || '').toLowerCase();
        const html = (summaryEl.innerHTML || '').toLowerCase();
        const exactMsg = "Le compte-rendu n'est pas encore disponible (fichier manquant/non publié).".toLowerCase();
        
        // Vérifier le message exact
        if (text.includes(exactMsg) || html.includes(exactMsg)) {
          console.log('[AGILO:RELANCE] ⚠️ VÉRIFICATION ULTRA-AGRESSIVE: Message exact détecté - Cache bouton (init() peut ne pas avoir tourné)');
          hideButton(btn, 'ultra-aggressive-exact-message');
          hideCounter(btn);
          return;
        }
        
        // Vérifier les patterns
        if (text.includes('pas encore disponible') || text.includes('fichier manquant') || text.includes('non publié')) {
          console.log('[AGILO:RELANCE] ⚠️ VÉRIFICATION ULTRA-AGRESSIVE: Pattern erreur détecté - Cache bouton (init() peut ne pas avoir tourné)');
          hideButton(btn, 'ultra-aggressive-error-pattern');
          hideCounter(btn);
          return;
        }
        
        // Vérifier aussi dans les alertes
        const alerts = summaryEl.querySelectorAll('.ag-alert, .ag-alert--warn, .ag-alert__title, [class*="alert"]');
        for (const alert of alerts) {
          const alertText = (alert.textContent || alert.innerText || '').toLowerCase();
          if (alertText.includes(exactMsg) || alertText.includes('pas encore disponible') || alertText.includes('fichier manquant')) {
            console.log('[AGILO:RELANCE] ⚠️ VÉRIFICATION ULTRA-AGRESSIVE: Message erreur dans alerte - Cache bouton (init() peut ne pas avoir tourné)');
            hideButton(btn, 'ultra-aggressive-alert-message');
            hideCounter(btn);
            return;
          }
        }
      }
    } catch (e) {
      console.error('[AGILO:RELANCE] Erreur vérification ultra-agressive:', e);
    }
  }, 300); // Vérifie toutes les 300ms (très fréquent pour garantir la détection)
})();

