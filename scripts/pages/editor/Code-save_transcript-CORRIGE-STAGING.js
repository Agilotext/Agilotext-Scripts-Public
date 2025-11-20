// Agilotext - Save Transcript (VERSION STAGING - Tests)
// ⚠️ Ce fichier est chargé depuis GitHub
// Correspond à: code-save-transcript dans Webflow
// ✅ VERSION STAGING : Protection suppression segments + Undo/Redo + Restauration brouillon
// ✅ CORRECTIONS APPLIQUÉES :
//   - Bug getAllPanes() : Force transcriptEditor (ne peut plus retourner summaryEditor)
//   - Vérification onglet actif avant sauvegarde
//   - Vérification que le transcript est chargé
//   - Protection contre sauvegarde de transcript vide
//   - ✅ Auto-save DÉSACTIVÉ (sauvegarde manuelle uniquement)

(function(){

  if (window.__agiloSave_FULL_12_JSON_CONTENT) return; 

  window.__agiloSave_FULL_12_JSON_CONTENT = true;

  const API_BASE = 'https://api.agilotext.com/api/v1';
  const ENDPOINT = API_BASE + '/updateTranscriptFile';
  const TOKEN_GET = API_BASE + '/getToken';
  const CHECK_GET_JSON = API_BASE + '/receiveTextJson';
  const CHECK_GET_TXT = API_BASE + '/receiveText';
  const VERSION = 'save-full-14-manual-only (sauvegarde manuelle uniquement + protection messages erreur + améliorations UX)';

  const MIN_SPINNER_MS = 400;
  const MAX_HTML_SNAPSHOT_CHARS = 1_000_000;

  // ---- timeouts & payload sizing ----
  const FETCH_TIMEOUT_MS = 20000;
  const RETRIES = 2;
  const MS_TOLERANCE = 1000;

  // ✅ CORRECTIONS : Auto-save moins fréquent et debounce
  const AUTO_SAVE_INTERVAL = 5 * 60 * 1000; // ✅ CORRECTION : 5 minutes au lieu de 2
  const TOAST_DURATION = 3000; // 3 secondes
  const STATUS_CHECK_INTERVAL = 60 * 1000; // ✅ CORRECTION : 60 secondes au lieu de 30
  const SAVE_DEBOUNCE_MS = 5000; // ✅ NOUVEAU : Debounce de 5 secondes pour éviter sauvegardes multiples

  // ✅ NOUVEAU : Délai d'attente pour vérifier que le transcript est chargé
  const TRANSCRIPT_LOAD_WAIT_MS = 2000; // Attendre 2 secondes max pour le chargement
  const MIN_CONTENT_LENGTH = 10; // Minimum 10 caractères pour considérer qu'il y a du contenu
  const MIN_SEGMENTS_COUNT = 1; // Minimum 1 segment pour considérer qu'il y a du contenu

  const MAX_URLENCODED_BYTES = 800_000;
  function utf8Bytes(s){ return new TextEncoder().encode(String(s||'')).length; }
  function estimateBytes(pick){
    let total = 0;
    total += utf8Bytes(pick.text||'');
    total += utf8Bytes(JSON.stringify({schema:'agilo-v2',segments:pick.segments,segmentsMs:pick.segmentsMs,from:pick.from}));
    total += utf8Bytes(pick.html||'') + utf8Bytes(pick.paneHTML||'');
    total += utf8Bytes(pick.plainText||'');
    total += utf8Bytes(JSON.stringify(pick.allPanes||[]));
    return total;
  }

  // --- assure visibleTextFromBox dans ce fichier aussi ---
  const visibleTextFromBox = (window.visibleTextFromBox) || function(box){
    if (!box) return '';
    const clone = box.cloneNode(true);
    // <br> => \n
    clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    // blocs ouvrent une nouvelle ligne
    const BLOCKS = 'div,p,li,blockquote,pre,section,article,header,footer,h1,h2,h3,h4,h5,h6,ul,ol';
    clone.querySelectorAll(BLOCKS).forEach((el, i) => {
      if (i > 0 || el.previousSibling) el.before('\n');
    });
    return (clone.textContent || '')
      .replace(/\r\n?/g,'\n')
      .replace(/\u00A0/g,' '); // NBSP -> espace normal
  };

  /* ===== ⚠️ NOUVELLE FONCTION : Vérification que le transcript est chargé ===== */
  
  /**
   * Vérifie que le transcript est bien chargé et contient du contenu
   * @returns {Promise<{isReady: boolean, reason?: string, content?: any}>}
   */
  async function verifyTranscriptReady() {
    // 1. Vérifier que transcriptEditor existe
    const transcriptEditor = document.querySelector('#transcriptEditor');
    if (!transcriptEditor) {
      console.warn('[agilo:save:security] ❌ transcriptEditor non trouvé');
      return { isReady: false, reason: 'transcriptEditor_not_found' };
    }

    // 2. Attendre un peu pour que le contenu se charge (si nécessaire)
    let attempts = 0;
    const maxAttempts = Math.ceil(TRANSCRIPT_LOAD_WAIT_MS / 200); // Vérifier toutes les 200ms
    
    while (attempts < maxAttempts) {
      // 3. Vérifier qu'il y a des segments
      const segments = transcriptEditor.querySelectorAll('.ag-seg');
      const segmentsCount = segments.length;
      
      // 4. Vérifier qu'il y a du texte
      const textContent = (transcriptEditor.innerText || transcriptEditor.textContent || '').trim();
      const textLength = textContent.length;
      
      // 5. Vérifier qu'il n'est pas vide (loader, placeholder, etc.)
      const hasLoader = transcriptEditor.querySelector('.ag-loader, .loading, [data-loading="true"]');
      const hasPlaceholder = transcriptEditor.querySelector('[data-placeholder], .placeholder');
      
      // ✅ Logs détaillés seulement en mode debug
      if (window.agiloSaveDebug) {
        console.log('[agilo:save:security] Vérification tentative', attempts + 1, {
          segmentsCount,
          textLength,
          hasLoader: !!hasLoader,
          hasPlaceholder: !!hasPlaceholder,
          transcriptEditorExists: !!transcriptEditor
        });
      }
      
      // ✅ Si on a du contenu valide, on peut sauvegarder
      if (segmentsCount >= MIN_SEGMENTS_COUNT || textLength >= MIN_CONTENT_LENGTH) {
        // Vérifier qu'il n'y a pas de loader actif
        if (!hasLoader && !hasPlaceholder) {
          // ✅ Log détaillé seulement en mode debug
          if (window.agiloSaveDebug) {
            console.log('[agilo:save:security] ✅ Transcript prêt:', {
              segmentsCount,
              textLength,
              preview: textContent.substring(0, 100)
            });
          } else {
            console.log('[agilo:save:security] ✅ Transcript prêt:', `${segmentsCount} segments, ${textLength} caractères`);
          }
          return { 
            isReady: true, 
            content: {
              segmentsCount,
              textLength,
              textContent: textContent.substring(0, 200) // Preview pour debug
            }
          };
        }
      }
      
      // Si pas encore prêt, attendre un peu
      if (attempts < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, 200));
      }
      attempts++;
    }
    
    // Si après toutes les tentatives, toujours pas de contenu
    const finalSegments = transcriptEditor.querySelectorAll('.ag-seg');
    const finalText = (transcriptEditor.innerText || transcriptEditor.textContent || '').trim();
    
    if (finalSegments.length === 0 && finalText.length < MIN_CONTENT_LENGTH) {
      console.error('[agilo:save:security] ❌ Transcript vide après attente:', {
        segmentsCount: finalSegments.length,
        textLength: finalText.length,
        hasLoader: !!transcriptEditor.querySelector('.ag-loader, .loading'),
        transcriptEditorHTML: transcriptEditor.innerHTML.substring(0, 200)
      });
      return { 
        isReady: false, 
        reason: 'transcript_empty',
        details: {
          segmentsCount: finalSegments.length,
          textLength: finalText.length
        }
      };
    }
    
    // Si on arrive ici, on a du contenu mais peut-être pas optimal
    console.warn('[agilo:save:security] ⚠️ Transcript partiellement chargé:', {
      segmentsCount: finalSegments.length,
      textLength: finalText.length
    });
    return { 
      isReady: true, 
      content: {
        segmentsCount: finalSegments.length,
        textLength: finalText.length
      }
    };
  }

  /* ===== autosave brouillon local ===== */
  let __draftTimer=null;
  function startAutosaveDraft(jobId, main){
    const key = `agilo:draft:${jobId}`;
    const save = ()=>{
      clearTimeout(__draftTimer);
      __draftTimer = setTimeout(()=>{
        try{
          if (!main) return;
          const text = (main.innerText ?? main.textContent ?? '').replace(/\r\n?/g,'\n');
          localStorage.setItem(key, JSON.stringify({ts:Date.now(), text}));
        }catch{}
      }, 1200);
    };
    main?.addEventListener('input', save, true);
    window.addEventListener('beforeunload', save);
  }
  function restoreDraftIfAny(jobId, main){
    try{
      const raw = localStorage.getItem(`agilo:draft:${jobId}`); if (!raw) return;
      const j = JSON.parse(raw);
      if (!j?.text || !main) return;
      
      // ✅ PROTECTION : Ne pas restaurer si le brouillon est vide ou suspect
      const draftText = String(j.text || '').trim();
      if (!draftText || draftText.length < 10) {
        console.warn('[agilo:save] ⚠️ Brouillon local ignoré (trop court ou vide)');
        return;
      }
      
      const cur = (main.innerText ?? main.textContent ?? '').trim();
      if (!cur){
        // ✅ CORRECTION : Utiliser execCommand pour préserver l'historique undo/redo
        main.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(main);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
        
        // Utiliser execCommand pour insérer le texte (préserve undo/redo)
        if (document.execCommand && document.execCommand('insertText', false, draftText)) {
          main.dispatchEvent(new Event('input', {bubbles:true}));
          console.info('[agilo:save] ✅ Brouillon local restauré (undo/redo préservé)');
        } else {
          // Fallback si execCommand n'est pas disponible
          if (main.innerText!==undefined) main.innerText = draftText;
          else main.textContent = draftText;
          main.dispatchEvent(new Event('input', {bubbles:true}));
          console.info('[agilo:save] ⚠️ Brouillon local restauré (fallback, undo/redo non préservé)');
        }
      }
    }catch(e){
      console.warn('[agilo:save] ⚠️ Erreur restauration brouillon:', e);
    }
  }

  const NBSP=/\u00A0/g;
  const $  =(s,r=document)=>r.querySelector(s);
  const $$ =(s,r=document)=>Array.from(r.querySelectorAll(s));
  function log(){ if (window.agiloSaveDebug) try{ console.debug('[agilo:save]', ...arguments); }catch(_){} }
  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

  async function fetchWithTimeout(url, opts={}){
    const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(new Error('timeout')), FETCH_TIMEOUT_MS);
    try{ return await fetch(url,{...opts,signal:ctrl.signal,mode:'cors',credentials:'omit',cache:'no-store'}); }
    finally{ clearTimeout(t); }
  }
  async function fetchRetry(url, opts={}, {retries=RETRIES, backoff=400}={}){
    let last=null;
    for (let i=0;i<=retries;i++){
      try{
        const res=await fetchWithTimeout(url,opts);
        if (!res.ok && res.status>=500 && i<retries){ await sleep(backoff*(i+1)); continue; }
        return res;
      }catch(e){ last=e; if (i<retries) await sleep(backoff*(i+1)); }
    }
    throw last||new Error('network');
  }

  /* ===== ROOTS / PANES ===== */
  const PANE_SELECTORS = [
    '#transcriptEditor','#pane-transcript','#ag-transcript',
    '[role="tabpanel"].edtr-pane','#pane-mail','#pane-notes',
    '[data-editor="transcript"]','#editorRoot'
  ];
  function normalize(v){
    return String(v||'')
      .replace(/\r\n?/g,'\n')
      .replace(/\u00A0/g,' ')
      .trim();
  }
  function uniq(arr){ const seen=new Set(); return arr.filter(x=>x && !seen.has(x) && seen.add(x)); }
  
  // ✅ CORRECTION CRITIQUE : getAllPanes() - Force transcriptEditor comme main
  function getAllPanes(){
    const found = uniq(PANE_SELECTORS.flatMap(sel=> $$(sel)));
    const extras = $$('[role="tabpanel"]');
    const panes = uniq(found.concat(extras));
    
    // ✅ CORRECTION CRITIQUE : Toujours forcer transcriptEditor comme main
    // ⚠️ NE JAMAIS utiliser panes.find() car il pourrait retourner summaryEditor si on est sur l'onglet Compte-rendu !
    const transcriptEditor = $('#transcriptEditor');
    const paneTranscript = $('#pane-transcript');
    const main = transcriptEditor || paneTranscript || null;
    
    // ⚠️ Vérification de sécurité : Si main n'est pas transcriptEditor, c'est un problème
    if (main && main.id !== 'transcriptEditor' && main.id !== 'pane-transcript') {
      console.error('[agilo:save] ⚠️ ERREUR CRITIQUE : main n\'est pas transcriptEditor !', {
        mainId: main.id,
        mainClass: main.className,
        activeTab: document.querySelector('[role="tab"][aria-selected="true"]')?.id,
        transcriptEditorExists: !!transcriptEditor
      });
      
      // Forcer transcriptEditor si possible
      if (transcriptEditor) {
        console.warn('[agilo:save] ✅ Correction : utilisation forcée de transcriptEditor');
        return { main: transcriptEditor, panes };
      } else {
        console.error('[agilo:save] ❌ transcriptEditor non trouvé dans le DOM !');
      }
    }
    
    return { main, panes };
  }
  
  function paneTitle(el){
    const byId = (id)=> (document.getElementById(id)?.innerText || document.getElementById(id)?.textContent || '').trim();
    const labelled = (el.getAttribute('aria-labelledby')||'').trim().split(/\s+/).map(byId).filter(Boolean).join(' ');
    if (labelled) return labelled;
    const ctl = el.id ? document.querySelector(`[aria-controls="${el.id}"]`) : null;
    if (ctl && (ctl.innerText||ctl.textContent)) return (ctl.innerText||ctl.textContent).trim();
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
    if (el.id) return '#'+el.id;
    return el.className||'pane';
  }

  /* ===== CREDENTIALS ===== */
  function normalizeEdition(v){ v=String(v||'').trim().toLowerCase(); if (/(^ent$|enterprise|entreprise|business|team|biz)/.test(v)) return 'ent'; if (/^pro/.test(v)) return 'pro'; if (/^free|gratuit/.test(v)) return 'free'; return 'ent'; }
  function pickEdition(){ const root=$('#editorRoot'); const qs=new URLSearchParams(location.search).get('edition'); const html=document.documentElement.getAttribute('data-edition'); const ls=localStorage.getItem('agilo:edition'); return normalizeEdition(qs || root?.dataset.edition || html || ls || 'ent'); }
  function pickJobId(){ const u=new URL(location.href); const root=$('#editorRoot'); return (u.searchParams.get('jobId')||root?.dataset.jobId||window.__agiloOrchestrator?.currentJobId||$('.rail-item.is-active')?.dataset?.jobId||''); }
  function pickEmail(){ const root=$('#editorRoot'); return (root?.dataset.username || $('[name="memberEmail"]')?.value || window.memberEmail || window.__agiloOrchestrator?.credentials?.email || localStorage.getItem('agilo:username') || $('[data-ms-member="email"]')?.textContent || ''); }
  function pickToken(edition,email){
    const root=$('#editorRoot'); const k=`agilo:token:${edition}:${String(email||'').toLowerCase()}`;
    return (root?.dataset.token || window.__agiloOrchestrator?.credentials?.token || window.globalToken || localStorage.getItem(k) || localStorage.getItem(`agilo:token:${edition}`) || localStorage.getItem('agilo:token') || '');
  }
  async function ensureToken(email, edition){
    const have=pickToken(edition,email); if (have) return have;
    if (typeof window.getToken==='function' && email){
      try{ window.getToken(email,edition); }catch(_){}
      for (let i=0;i<80;i++){ const t=pickToken(edition,email); if (t) return t; await sleep(100); }
    }
    if (email){
      try{
        const url=`${TOKEN_GET}?username=${encodeURIComponent(email)}&edition=${encodeURIComponent(edition)}`;
        const r=await fetchRetry(url,{method:'GET'}); const j=await r.json().catch(()=>null);
        if (r.ok && j?.status==='OK' && j.token){
          try{ localStorage.setItem(`agilo:token:${edition}:${email.toLowerCase()}`, j.token);
               localStorage.setItem('agilo:username', email);
               localStorage.setItem('agilo:edition', edition); }catch(_){}
          window.globalToken=j.token; return j.token;
        }
      }catch(_){}
    }
    return '';
  }
  async function ensureCreds(){
    const edition=pickEdition();
    let email=pickEmail(); for (let i=0;i<20 && !email;i++){ await sleep(100); email=pickEmail(); }
    const token=await ensureToken(email, edition);
    let jobId=pickJobId(); for (let i=0;i<10 && !jobId;i++){ await sleep(60); jobId=pickJobId(); }
    log('creds',{email,edition,jobId,hasToken:!!token});
    return { email:(email||'').trim(), token:(token||'').trim(), edition, jobId:String(jobId||'').trim() };
  }

  /* ===== TIME/SEG HELPERS ===== */
  function toSec(x){
    if (x==null) return 0;
    if (typeof x==='number'&&Number.isFinite(x)) return x|0;
    const s=String(x).trim();
    if (/^\d+$/.test(s)) return parseInt(s,10);
    const m=s.replace(/^\[|\]$/g,'').split(':').map(n=>parseInt(n,10));
    if (m.some(Number.isNaN)) return 0;
    return m.length===3? m[0]*3600+m[1]*60+m[2] : (m[0]*60+m[1]);
  }
  function fmtTime(sec){
    sec=Math.max(0,Math.floor(Number(sec)||0));
    const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
    const HH=String(h).padStart(2,'0'),MM=String(m).padStart(2,'0'),SS=String(s).padStart(2,'0');
    return h?`${HH}:${MM}:${SS}`:`${MM}:${SS}`;
  }
  function looksLikeTimedTranscript(s){
    const str = String(s||'');
    const byLines = (str.match(/^\s*\[\d{1,2}:\d{2}(?::\d{2})?\]\s+[^\n:]+?:/gm)||[]).length;
    const byScan  = (str.match(/\[\d{1,2}:\d{2}(?::\d{2})?\]\s+[^:\]\n]+?:/g)||[]).length;
    return (byLines + byScan) >= 2;
  }
  function parseSegmentsFromAny(txt){
    const t = String(txt||'');
    const re = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^:\]\n]+?)\s*:\s*/g;
    const out = [];
    let m, lastIdx = 0, cur = null;
    while ((m = re.exec(t))){
      const startSec = toSec(m[1]);
      const speaker  = (m[2]||'').trim();
      if (cur){
        cur.text = t.slice(lastIdx, m.index).replace(/\s+/g,' ').trim();
        if (cur.text) out.push(cur);
      }
      cur = { start: startSec, end: null, speaker, text: '' };
      lastIdx = re.lastIndex;
    }
    if (cur){
      cur.text = t.slice(lastIdx).replace(/\s+/g,' ').trim();
      out.push(cur);
    }
    for (let i=0;i<out.length;i++){
      const n = out[i+1]?.start;
      out[i].end = Number.isFinite(n) ? Math.max(out[i].start||0, n)
                                      : ((out[i].start||0) + Math.max(1, Math.round((out[i].text||'').length/15)));
    }
    return out;
  }

  /* ===== MODEL / DOM ===== */
  function modelSegments(){
    const segs =
      (Array.isArray(window._segments)&&window._segments.length&&window._segments) ||
      (window.AgiloEditors&&Array.isArray(window.AgiloEditors.segments)&&window.AgiloEditors.segments.length&&window.AgiloEditors.segments) ||
      (window.AG&&window.AG.model&&Array.isArray(window.AG.model.segments)&&window.AG.model.segments) || null;
    if (!segs||!segs.length) return null;
    return segs
      .filter(Boolean)
      .map((s,i)=>{
        const startSec=toSec(s.start);
        const endSec=(s.end!=null)?toSec(s.end):(startSec+(toSec(s.dur)||0));
        const speaker=(s.speaker||'').trim();
        const text = String(s.text || '').replace(/\r\n?/g,'\n').replace(/\u00A0/g,' ');
        const lang=(s.lang||'').trim();
        return { id:(s.id||`s${i}`), startSec,endSec,start:fmtTime(startSec),end:endSec?fmtTime(endSec):'',speaker,text,lang };
      });
  }
  function domSegments(root){
    const rows = $$('.ag-seg,[data-seg],.segment,.ag-segment', root);
    if (!rows.length){
      const txt = normalize(root.innerText || root.textContent || '');
      if (!txt) return [];
      return [{ id:'s0', startSec:0, endSec:0, start:'00:00', end:'', speaker:'', text:txt, lang:document.documentElement.lang||'' }];
    }
    const out = [];
    rows.forEach((seg, idx)=>{
      const tBtn   = seg.querySelector('header .time,.time,[data-t]');
      const stAttr = seg.dataset.start ?? seg.getAttribute('data-start') ?? tBtn?.dataset?.t ?? tBtn?.textContent ?? '0';
      const enAttr = seg.dataset.end   ?? seg.getAttribute('data-end')   ?? '';
      const startSecDefault = toSec(stAttr);
      const endSecDefault   = toSec(enAttr);
      const spkDefault = (seg.dataset.speaker || seg.querySelector('header .speaker,.speaker')?.textContent || '').trim();
      const box = seg.querySelector('.ag-seg__text,.text,[data-text]');
      const rawNorm = visibleTextFromBox(box);
      const lang = seg.getAttribute('lang') || '';
      const text = rawNorm;
      out.push({
        id:`s${idx}`,
        startSec: startSecDefault,
        endSec: endSecDefault,
        start: fmtTime(startSecDefault),
        end: endSecDefault ? fmtTime(endSecDefault) : '',
        speaker: spkDefault,
        text,
        lang
      });
    });
    for (let i=0;i<out.length;i++){
      if (!out[i].endSec){
        if (out[i+1]) out[i].endSec = Math.max(out[i].startSec || 0, out[i+1].startSec || 0);
        else          out[i].endSec = (out[i].startSec||0) + Math.max(1, Math.round((out[i].text||'').length/15));
        out[i].end = out[i].endSec ? fmtTime(out[i].endSec) : '';
      }
    }
    return out;
  }
  function explodeIfMonoblock(segments){
    try{
      if (!Array.isArray(segments) || segments.length !== 1) return segments;
      const only = segments[0];
      const raw  = String(only.text||'');
      if (!looksLikeTimedTranscript(raw)) return segments;
      const ex = (window.parseRawTranscript||parseSegmentsFromAny)(raw);
      if (!ex || ex.length < 2) return segments;
      return ex.filter(Boolean).map((s,i)=>({
        id:`s0_${i}`,
        startSec: s.start|0,
        endSec:   s.end|0,
        start:    fmtTime(s.start),
        end:      s.end ? fmtTime(s.end) : '',
        speaker:  s.speaker||'',
        text:     s.text||'',
        lang:     only.lang||''
      }));
    }catch{ return segments; }
  }
  function reconcileSegments({main}){
    try{ typeof window.syncDomToModel==='function' && window.syncDomToModel(); }catch{}
    let fromModel = null;
    try { fromModel = modelSegments(); } catch(e){ console.warn('[agilo:save] modelSegments failed', e); }
    const fromDom   = main ? domSegments(main) : [];
    if (!fromModel || !fromModel.length) return fromDom;
    const canon = str => String(str||'').replace(/\r\n?/g,'\n'); // pas de compression
    const H = s => [s.speaker, canon(s.text)].join('|').slice(0,256);
    const sameLen = fromModel.length === fromDom.length;
    const sameSig = sameLen && fromModel.every((s,i)=> H(s) === H(fromDom[i]));
    if (sameSig) return fromModel;
    try{ window._segments = fromDom.map((s,i)=>({ id:s.id||`s${i}`, start:s.startSec, end:s.endSec, speaker:s.speaker, text:s.text, lang:s.lang||'' })); }catch{}
    return fromDom;
  }

  function encodeNL(s){
    return String(s||'').replace(/\r\n?/g,'\n');
  }
  function segmentsToPlain(segments){
    return (Array.isArray(segments)?segments:[])
      .filter(Boolean)
      .map(s => {
        const t   = (s.start ?? fmtTime(s.startSec ?? 0));
        const who = s.speaker ? s.speaker + ': ' : '';
        const lines = String(s.text||'').replace(/\r\n?/g,'\n').split('\n');
        const first = lines.shift() || '';
        const body  = lines.length ? '\n' + lines.join('\n') : '';
        return `[${t}] ${who}${first}${body}`;
      })
      .join('\n');
  }

  /* ===== ACCESSIBLE TEXT ===== */
  function textWithAria(el){
    const visible = normalize(el.innerText || el.textContent || '');
    let aria = '';
    const label = el.getAttribute('aria-label'); if (label) aria += ' '+label;
    const ids = (el.getAttribute('aria-labelledby')||'').trim().split(/\s+/).filter(Boolean);
    if (ids.length){
      aria += ' '+ ids.map(id=> (document.getElementById(id)?.innerText || document.getElementById(id)?.textContent || '') ).join(' ');
    }
    return normalize((visible + ' ' + aria).trim());
  }
  function snapshotFor(el){
    const html = (el ? el.outerHTML : '') || '';
    const plainText = textWithAria(el||document.body);
    return { html: html.slice(0, MAX_HTML_SNAPSHOT_CHARS), plainText };
  }

  /* ===== SERIALISATION MULTIPANE ===== */
  // ✅ CORRECTION CRITIQUE : serializeAll() - Vérifier que main est bien transcriptEditor
  async function serializeAll(){
    const { main, panes } = getAllPanes();
    
    // ✅ CORRECTION CRITIQUE : Vérifier que main est bien transcriptEditor
    if (main && main.id !== 'transcriptEditor' && main.id !== 'pane-transcript') {
      console.error('[agilo:save] ❌ ERREUR : serializeAll() reçoit un main qui n\'est pas transcriptEditor !', {
        mainId: main.id,
        mainClass: main.className,
        activeTab: document.querySelector('[role="tab"][aria-selected="true"]')?.id
      });
      
      // Forcer transcriptEditor
      const transcriptEditor = document.querySelector('#transcriptEditor');
      if (!transcriptEditor) {
        console.error('[agilo:save] ❌ transcriptEditor non trouvé - Impossible de sauvegarder');
        throw new Error('L\'éditeur de transcript n\'est pas disponible. Veuillez recharger la page.');
      }
      
      // Utiliser transcriptEditor au lieu de main
      const correctedMain = transcriptEditor;
      let seg = reconcileSegments({main: correctedMain}); let from = 'dom';
      
      if (!seg || !seg.length){ seg = modelSegments() || []; from = 'model'; }
      seg = explodeIfMonoblock(seg);
      const text = segmentsToPlain(seg);
      
      // Continuer avec correctedMain au lieu de main
      const parts = (panes||[]).map(p=>{
        const snap = snapshotFor(p);
        return { id: p.id||'', role: p.getAttribute('role')||'', title: paneTitle(p), plainText: snap.plainText, html: snap.html };
      });
      const joined = parts.map(pt=>`### ${pt.title||pt.id||pt.role||'pane'}\n${pt.plainText}`).join('\n\n---\n\n');
      const mainSnap = snapshotFor(correctedMain||document.body);
      
      const segments = seg
        .filter(Boolean)
        .map((s,i)=>({
          id: s.id || `s${i}`,
          startSec: s.startSec|0,
          endSec:   s.endSec|0,
          start:    s.start ?? fmtTime(s.startSec|0),
          end:      s.end ?? (s.endSec ? fmtTime(s.endSec) : ''),
          speaker:  s.speaker||'',
          text:     encodeNL(s.text||''),
          lang:     s.lang||''
        }));

      const segmentsMs = segments.map(s=>({
        id: s.id,
        milli_start: (s.startSec|0)*1000,
        milli_end:   (s.endSec|0)*1000,
        speaker: s.speaker,
        text: encodeNL(s.text)
      }));

      return {
        text,
        segments,
        segmentsMs,
        from:'multi-'+from,
        html: mainSnap.html,
        paneHTML: mainSnap.html,
        plainText: joined,
        allPanes: parts
      };
    }
    
    if (!main && !panes.length) return { text:'', segments:[], segmentsMs:[], from:'none', html:'', paneHTML:'', plainText:'', allPanes:[] };

    let seg = reconcileSegments({main}); let from = 'dom';
    if (!seg || !seg.length){ seg = modelSegments() || []; from = 'model'; }
    seg = explodeIfMonoblock(seg);

    const text = segmentsToPlain(seg);

    const parts = (panes||[]).map(p=>{
      const snap = snapshotFor(p);
      return { id: p.id||'', role: p.getAttribute('role')||'', title: paneTitle(p), plainText: snap.plainText, html: snap.html };
    });
    const joined = parts.map(pt=>`### ${pt.title||pt.id||pt.role||'pane'}\n${pt.plainText}`).join('\n\n---\n\n');
    const mainSnap = snapshotFor(main||document.body);

    const segments = seg
      .filter(Boolean)
      .map((s,i)=>({
        id: s.id || `s${i}`,
        startSec: s.startSec|0,
        endSec:   s.endSec|0,
        start:    s.start ?? fmtTime(s.startSec|0),
        end:      s.end ?? (s.endSec ? fmtTime(s.endSec) : ''),
        speaker:  s.speaker||'',
        text:     encodeNL(s.text||''),
        lang:     s.lang||''
      }));

    const segmentsMs = segments.map(s=>({
      id: s.id,
      milli_start: (s.startSec|0)*1000,
      milli_end:   (s.endSec|0)*1000,
      speaker: s.speaker,
      text: encodeNL(s.text)
    }));

    return {
      text,
      segments,
      segmentsMs,
      from:'multi-'+from,
      html: mainSnap.html,
      paneHTML: mainSnap.html,   // intentionnel: snapshot principal
      plainText: joined,
      allPanes: parts
    };
  }

  /* ===== BACKUP / META ===== */
  function backupKey(jobId){ return `agilo:backup:${String(jobId||'')}`; }
  function saveBackup(jobId, text){ try{ localStorage.setItem(backupKey(jobId), JSON.stringify({ ts:Date.now(), content:text })) }catch{} }
  function readBackup(jobId){ try{ const j=JSON.parse(localStorage.getItem(backupKey(jobId))||'null'); return j&&j.content?j.content:''; }catch{ return ''; } }
  function djb2h(s){ s=String(s||''); let h=5381,i=s.length; while(i) h=(h*33)^s.charCodeAt(--i); return (h>>>0).toString(36); }
  function buildMeta(segments, from){
    const speakers = Array.from(new Set(segments.map(s=>s.speaker).filter(Boolean))).slice(0,64);
    const duration = Math.max(0, ...segments.map(s=>s.endSec||s.startSec||0));
    const t = segmentsToPlain(segments);
    return {
      version: VERSION, from,
      url: location.href, title: document.title||'',
      userAgent: navigator.userAgent||'',
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone||'',
      locale: navigator.language||'',
      speakers, durationSec: duration,
      wordCount: t? t.split(/\s+/).filter(Boolean).length : 0,
      charCount: t.length,
      contentHash: djb2h(t),
      savedAt: new Date().toISOString()
    };
  }

  /* ===== ROUND-TRIP ===== */
  function normStr(s){ return String(s||'').replace(/\s+/g,' ').trim(); }
  function near(a,b){ return Math.abs((+a||0) - (+b||0)) <= MS_TOLERANCE; }

  async function fetchServerJson({ email, token, edition, jobId }){
    const u = `${CHECK_GET_JSON}?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}`;
    const r = await fetchRetry(u,{method:'GET'}); if (!r.ok) throw new Error('HTTP '+r.status);
    const j = await r.json(); if (!j || !Array.isArray(j.segments)) throw new Error('invalid_json');
    return j;
  }
  function eqSegmentsMs(local, remoteSegments){
    if (!Array.isArray(local) || !Array.isArray(remoteSegments)) return false;
    const L = local.slice().sort((a,b)=>(a.milli_start||0)-(b.milli_start||0));
    const R = remoteSegments.slice().sort((a,b)=>(a.milli_start||0)-(b.milli_start||0));
    if (L.length !== R.length) return false;
    for (let i=0;i<L.length;i++){
      const a=L[i], b=R[i];
      if (!near(a.milli_start, b.milli_start)) return false;
      if (!near(a.milli_end,   b.milli_end))   return false;
      if (normStr(a.speaker)!==normStr(b.speaker)) return false;
      if (normStr(a.text)!==normStr(b.text))       return false;
    }
    return true;
  }
  async function roundTripConfirmJSON(creds, localSegmentsMs){
    try{
      const srv = await fetchServerJson(creds);
      const ok = eqSegmentsMs(localSegmentsMs, srv.segments||[]);
      if (!ok) console.warn('[agilo:save] round-trip JSON mismatch', {local:localSegmentsMs, remote:srv.segments});
      return ok;
    }catch(e){
      console.warn('[agilo:save] round-trip JSON failed →', e);
      return false;
    }
  }
  async function roundTripConfirmTXT({ email, token, edition, jobId }, localText, { tries=4, delay=500 } = {}){
    const want=djb2h(localText);
    for (let i=0;i<tries;i++){
      try{
        const u = `${CHECK_GET_TXT}?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}&format=txt&_=${Date.now()}`;
        const r = await fetchRetry(u,{method:'GET'}); if (!r.ok) throw new Error('HTTP '+r.status);
        const txt = await r.text(); if (djb2h(txt)===want) return true;
      }catch(_){}
      await sleep(delay);
    }
    return false;
  }

  /* ===== ENVOI ===== */
  let isSaving=false;
  let saveDebounceTimer = null; // ✅ NOUVEAU : Timer pour debounce
  let lastSavedContent = ''; // ✅ NOUVEAU : Mémoriser le dernier contenu sauvegardé

  // helper : ajoute les 4 paramètres dans l'URL (QS)
  function endpointWithQS(params){
    const {username, token, jobId, edition} = params;
    const qs = new URLSearchParams({
      username: username,
      token: token,
      jobId: String(jobId),
      edition: edition
    }).toString();
    return `${ENDPOINT}?${qs}`;
  }

  // ✅ CORRECTION DÉFINITIVE : transcriptContent = JSON complet
  async function postCorrectAPI(params, pick, meta){
    // ✅ Construction du JSON exact selon le format de Nicolas
    const segMs = Array.isArray(pick.segmentsMs) ? pick.segmentsMs : [];
    
    // Calcul de la durée en millisecondes
    const milli_duration = segMs.reduce((m, s) => {
      const end = +s.milli_end || +s.milli_start || 0;
      return Math.max(m, end);
    }, 0);
    
    // Détection des speakers
    const speakerLabels = segMs.some(s => {
      const speaker = String(s.speaker || '').trim();
      return speaker.length > 0 && speaker !== 'Speaker_A';
    });
    
    // Gestion du jobId (doit être un nombre)
    const rawJobId = String(params.jobId ?? '').trim();
    const jobIdNum = /^\d+$/.test(rawJobId) ? parseInt(rawJobId, 10) : 0;
    
    const transcriptStatusJson = {
      job_meta: {
        jobId: jobIdNum,
        milli_duration: Math.max(0, milli_duration),
        speakerLabels: Boolean(speakerLabels)
      },
      segments: segMs.map(s => ({
        id: String(s.id || ''),
        milli_start: Math.max(0, +s.milli_start || 0),
        milli_end: Math.max(0, +s.milli_end || 0),
        speaker: String(s.speaker || ''),
        text: String(s.text || '')
      }))
    };
    
    // ✅ Log JSON seulement en mode debug (réduit la pollution de la console)
    if (window.agiloSaveDebug) {
      console.log('✅ JSON transcript_status:', JSON.stringify(transcriptStatusJson, null, 2));
    } else {
      console.log('✅ JSON transcript_status:', `{jobId: ${transcriptStatusJson.job_meta.jobId}, segments: ${transcriptStatusJson.segments.length}, duration: ${transcriptStatusJson.job_meta.milli_duration}ms}`);
    }
    
    const body = new URLSearchParams();
    body.append('username', params.username);
    body.append('token', params.token);
    body.append('jobId', String(params.jobId));
    body.append('edition', params.edition);
    
    // ✅ CORRECTION : transcriptContent = JSON complet (pas le texte brut)
    body.append('transcriptContent', JSON.stringify(transcriptStatusJson));
    
    const url = `${ENDPOINT}?username=${encodeURIComponent(params.username)}&token=${encodeURIComponent(params.token)}&jobId=${encodeURIComponent(params.jobId)}&edition=${encodeURIComponent(params.edition)}`;
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
      
      xhr.onload = () => {
        try {
          const response = JSON.parse(xhr.responseText);
          console.log('📥 Réponse API:', xhr.status, response);
          resolve({ res: { status: xhr.status, ok: xhr.status === 200 }, raw: xhr.responseText, j: response });
        } catch (e) {
          console.error('❌ Erreur parsing réponse:', e);
          reject(new Error('Erreur de format de réponse'));
        }
      };
      
      xhr.onerror = () => {
        console.error('❌ Erreur réseau');
        reject(new Error('Erreur de connexion réseau'));
      };
      
      xhr.send(body.toString());
    });
  }

  // ✅ CORRECTION DÉFINITIVE : doSave avec debounce, vérification de contenu ET vérification que le transcript est chargé
  async function doSave(btn){
    // ✅ NOUVEAU : Bloquer si la page est en cours de déchargement
    if (document.visibilityState === 'hidden' || 
        document.readyState === 'unloading') {
      console.warn('[agilo:save:security] ❌ Sauvegarde bloquée : page en cours de déchargement');
      return {ok:false, reason:'page_unloading'};
    }
    
    // ✅ NOUVEAU : Bloquer si un chargement est en cours
    const transcriptEditor = document.querySelector('#transcriptEditor');
    const isLoading = transcriptEditor?.getAttribute('aria-busy') === 'true' ||
                      document.querySelector('#pane-summary')?.getAttribute('aria-busy') === 'true';
    
    if (isLoading) {
      console.warn('[agilo:save:security] ❌ Sauvegarde bloquée : chargement en cours');
      if (btn) {
        showToast('⚠️ Veuillez attendre la fin du chargement avant de sauvegarder', 'warning');
      }
      return {ok:false, reason:'loading_in_progress'};
    }
    
    // ✅ NOUVEAU : Debounce pour éviter les sauvegardes multiples
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer);
    }
    
    return new Promise((resolve) => {
      saveDebounceTimer = setTimeout(async () => {
        if (isSaving) {
          resolve({ok:false,reason:'already_saving'});
          return;
        }
        isSaving=true;

        if (btn && !btn.__idleText){ 
          btn.__idleText=(btn.textContent||'Sauvegarder').trim(); 
          btn.textContent='Sauvegarde…'; 
        }

        try{
          // ✅ NOUVEAU : Vérifier qu'on est sur l'onglet Transcript AVANT toute autre vérification
          const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
          if (activeTab && activeTab.id !== 'tab-transcript') {
            const tabName = activeTab.id === 'tab-summary' ? 'Compte-rendu' : activeTab.id === 'tab-chat' ? 'Conversation' : activeTab.id;
            const errorMessage = `⚠️ Erreur : La sauvegarde ne peut se faire que sur l'onglet "Transcription".\n\nVous êtes actuellement sur l'onglet "${tabName}".\n\nVeuillez d'abord cliquer sur l'onglet "Transcription".`;
            console.error('[agilo:save:security] ❌ BLOQUÉ : Tentative de sauvegarde sur l\'onglet', activeTab.id);
            
            if (btn){ 
              btn.textContent=btn.__idleText; 
            }
            
            updateStatusIndicator('error');
            showToast(errorMessage, 'error');
            
            isSaving = false;
            resolve({ok:false, reason: 'wrong_tab', error: errorMessage});
            return;
          }
          
          // ✅ NOUVEAU : Vérifier que le transcript est bien chargé AVANT de continuer
          console.log('[agilo:save:security] 🔍 Vérification que le transcript est chargé...');
          const transcriptCheck = await verifyTranscriptReady();
          
          if (!transcriptCheck.isReady) {
            const reason = transcriptCheck.reason;
            let errorMessage = '⚠️ Impossible de sauvegarder : ';
            
            if (reason === 'transcriptEditor_not_found') {
              errorMessage += 'L\'éditeur de transcript n\'est pas disponible.\n\nVeuillez recharger la page.';
            } else if (reason === 'transcript_empty') {
              errorMessage += 'Le transcript est vide ou n\'est pas encore chargé.\n\n';
              errorMessage += 'Veuillez attendre que le transcript se charge complètement avant de sauvegarder.\n\n';
              errorMessage += 'Si le problème persiste, rechargez la page.';
            } else {
              errorMessage += 'Le transcript n\'est pas prêt.\n\nVeuillez attendre quelques instants et réessayer.';
            }
            
            console.error('[agilo:save:security] ❌ Transcript non prêt:', transcriptCheck);
            
            if (btn){ 
              btn.textContent=btn.__idleText; 
            }
            
            updateStatusIndicator('error');
            showToast(errorMessage, 'error');
            
            isSaving = false;
            resolve({ok:false, reason: reason, error: errorMessage});
            return;
          }
          
          // ✅ Log détaillé seulement en mode debug
          if (window.agiloSaveDebug) {
            console.log('[agilo:save:security] ✅ Transcript vérifié et prêt:', transcriptCheck.content);
          } else {
            const { segmentsCount = 0, textLength = 0 } = transcriptCheck.content || {};
            console.log('[agilo:save:security] ✅ Transcript vérifié et prêt');
          }

          const creds=await ensureCreds();
          const { email, token, edition, jobId } = creds;
          if (!email || !token || !jobId){ 
            throw new Error('Contexte incomplet (username/token/jobId)'); 
          }

          try{ typeof window.syncDomToModel==='function' && window.syncDomToModel(); }catch{}
          const pick=await serializeAll();

          // ✅ Vérification supplémentaire : le texte ne doit pas être vide après sérialisation
          if (!pick.text || pick.text.trim().length < MIN_CONTENT_LENGTH){ 
            throw new Error('Rien à sauvegarder (transcript vide ou trop court)'); 
          }
          
          // ✅ Vérification supplémentaire : il doit y avoir au moins un segment
          if (!pick.segments || pick.segments.length < MIN_SEGMENTS_COUNT) {
            // Si on a du texte mais pas de segments, c'est suspect mais on peut continuer
            console.warn('[agilo:save:security] ⚠️ Pas de segments détectés mais texte présent:', pick.text.length, 'caractères');
          }

          // ✅ NOUVEAU : Vérifier si le contenu a réellement changé (sauf si sauvegarde manuelle)
          const currentContent = pick.text.trim();
          if (!btn && currentContent === lastSavedContent) {
            console.log('⏭️ Pas de modification, sauvegarde ignorée');
            isSaving = false;
            resolve({ok:false,reason:'no_changes'});
            return;
          }

          console.log('🔄 Sauvegarde avec JSON complet...');
          if (btn) updateStatusIndicator('saving');
          
          const {res, raw, j} = await postCorrectAPI({username:email,token,jobId,edition}, pick, {});

          if (res.ok && j?.status==='OK'){
            console.log('✅ Sauvegarde réussie !');
            lastSavedContent = currentContent; // ✅ Mémoriser le contenu sauvegardé
            lastSaveTime = new Date();
            
            if (btn){ 
              btn.textContent='Sauvegardé ✓'; 
              setTimeout(() => { btn.textContent=btn.__idleText; }, 2000);
            }
            updateStatusIndicator('saved');
            
            // ✅ CORRECTION : Toast seulement pour sauvegarde manuelle (pas auto-save)
            if (btn) {
              showToast('✅ Modification sauvegardée', 'success');
            }
            
            resolve({ok:true, status:res.status, data:j});
          } else {
            throw new Error(j?.errorMessage || 'Erreur serveur');
          }

        }catch(e){
          console.error('[agilo:save] erreur:', e);
          if (btn){ btn.textContent=btn.__idleText; }
          updateStatusIndicator('error');
          if (btn) {
            showToast('❌ Erreur de sauvegarde: ' + e.message, 'error');
          }
          resolve({ok:false, error: e.message});
        } finally{
          isSaving=false;
        }
      }, btn ? 0 : SAVE_DEBOUNCE_MS); // ✅ Pas de debounce pour sauvegarde manuelle
    });
  }

  /* ===== NOUVELLES FONCTIONNALITÉS ===== */
  
  // ✅ 1. INDICATEUR VISUEL DE STATUT
  function createStatusIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'agilo-status-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #28a745;
      box-shadow: 0 0 10px rgba(40, 167, 69, 0.5);
      z-index: 10000;
      transition: all 0.3s ease;
      cursor: pointer;
    `;
    indicator.title = 'Dernière sauvegarde: Maintenant';
    document.body.appendChild(indicator);
    return indicator;
  }

  // ✅ 2. NOTIFICATIONS TOAST (avec anti-doublon)
  const lastToast = { message: '', time: 0 }; // ✅ NOUVEAU : Mémoriser le dernier toast
  function showToast(message, type = 'success') {
    // ✅ NOUVEAU : Éviter les toasts dupliqués (moins de 2 secondes entre les mêmes messages)
    const now = Date.now();
    if (lastToast.message === message && (now - lastToast.time) < 2000) {
      return; // Ignorer le toast dupliqué
    }
    lastToast.message = message;
    lastToast.time = now;

    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 50px;
      background: ${type === 'success' ? '#28a745' : type === 'warning' ? '#ffc107' : '#dc3545'};
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10001;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Animation d'entrée
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    }, 10);
    
    // Suppression automatique
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, TOAST_DURATION);
  }

  // ✅ 3. AUTO-SAVE PÉRIODIQUE (avec vérification de modifications réelles)
  let autoSaveTimer = null;
  let statusIndicator = null;
  let lastSaveTime = null;

  function startAutoSave() {
    if (autoSaveTimer) return;
    
    autoSaveTimer = setInterval(async () => {
      try {
        // ✅ NOUVEAU : Vérifier que le transcript est chargé avant auto-save
        const transcriptCheck = await verifyTranscriptReady();
        if (!transcriptCheck.isReady) {
          console.log('[agilo:save:security] ⏭️ Auto-save ignoré : transcript non prêt');
          return;
        }
        
        const creds = await ensureCreds();
        if (!creds.email || !creds.token || !creds.jobId) return;
        
        const pick = await serializeAll();
        if (!pick.text || pick.text.trim().length < MIN_CONTENT_LENGTH) return;
        
        const currentContent = pick.text.trim();
        if (currentContent === lastSavedContent) {
          console.log('⏭️ Pas de modification, auto-save ignoré');
          return;
        }
        
        console.log('🔄 Auto-save périodique...');
        updateStatusIndicator('saving');
        
        const {res, j} = await postCorrectAPI({
          username: creds.email,
          token: creds.token,
          jobId: creds.jobId,
          edition: creds.edition
        }, pick, {});
        
        if (res.ok && j?.status === 'OK') {
          lastSaveTime = new Date();
          lastSavedContent = currentContent;
          updateStatusIndicator('saved');
          console.log('✅ Auto-save réussi');
          // ✅ SUPPRIMÉ : Pas de toast pour l'auto-save automatique
        } else {
          updateStatusIndicator('error');
          console.warn('⚠️ Auto-save échoué:', j);
        }
      } catch (e) {
        console.warn('⚠️ Auto-save échoué:', e);
        updateStatusIndicator('error');
      }
    }, AUTO_SAVE_INTERVAL);
  }

  function stopAutoSave() {
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
      autoSaveTimer = null;
    }
  }

  // ✅ 4. MISE À JOUR DE L'INDICATEUR
  function updateStatusIndicator(status) {
    if (!statusIndicator) return;
    
    switch (status) {
      case 'saving':
        statusIndicator.style.background = '#ffc107';
        statusIndicator.style.boxShadow = '0 0 10px rgba(255, 193, 7, 0.5)';
        statusIndicator.title = 'Sauvegarde en cours...';
        break;
      case 'saved':
        statusIndicator.style.background = '#28a745';
        statusIndicator.style.boxShadow = '0 0 10px rgba(40, 167, 69, 0.5)';
        statusIndicator.title = `Dernière sauvegarde: ${lastSaveTime ? lastSaveTime.toLocaleTimeString() : new Date().toLocaleTimeString()}`;
        break;
      case 'error':
        statusIndicator.style.background = '#dc3545';
        statusIndicator.style.boxShadow = '0 0 10px rgba(220, 53, 69, 0.5)';
        statusIndicator.title = 'Erreur de sauvegarde';
        break;
    }
  }

  // ✅ 5. SAUVEGARDE AVANT FERMETURE - DÉSACTIVÉE EN STAGING
  function setupBeforeUnload() {
    // ✅ STAGING : DÉSACTIVÉ car cause des sauvegardes involontaires au rechargement
    console.warn('[agilo:save:STAGING] ⚠️ beforeunload DÉSACTIVÉ (sauvegarde manuelle uniquement)');
    return; // ⚠️ NE JAMAIS sauvegarder automatiquement au rechargement
    
    // Code original commenté pour référence :
    /*
    window.addEventListener('beforeunload', async (e) => {
      if (isSaving) {
        e.preventDefault();
        e.returnValue = 'Sauvegarde en cours, veuillez patienter...';
        return e.returnValue;
      }
      
      try {
        // ✅ PROTECTION CRITIQUE : Vérifier que le transcript est chargé ET contient du contenu
        const transcriptCheck = await verifyTranscriptReady();
        if (!transcriptCheck.isReady) {
          console.warn('[agilo:save:security] ⏭️ Sauvegarde avant fermeture IGNORÉE : transcript non prêt');
          return; // NE PAS sauvegarder si le transcript n'est pas prêt
        }
        
        // ✅ PROTECTION CRITIQUE : Vérifier le contenu AVANT de récupérer les credentials
        const transcriptEditor = document.querySelector('#transcriptEditor');
        if (transcriptEditor) {
          const currentText = (transcriptEditor.innerText || transcriptEditor.textContent || '').trim();
          const segmentsCount = transcriptEditor.querySelectorAll('.ag-seg').length;
          
          // ✅ PROTECTION RENFORCÉE : Ne JAMAIS sauvegarder un transcript vide
          if (currentText.length < MIN_CONTENT_LENGTH || segmentsCount < MIN_SEGMENTS_COUNT) {
            console.error('[agilo:save:security] 🚨 BLOQUÉ : Sauvegarde avant fermeture IGNORÉE - transcript vide ou invalide', {
              textLength: currentText.length,
              segmentsCount: segmentsCount,
              minLength: MIN_CONTENT_LENGTH,
              minSegments: MIN_SEGMENTS_COUNT
            });
            return; // NE JAMAIS sauvegarder un transcript vide
          }
        }
        
        const creds = await ensureCreds();
        if (creds.email && creds.token && creds.jobId) {
          const pick = await serializeAll();
          
          // ✅ PROTECTION TRIPLE : Vérifier à nouveau après sérialisation
          if (!pick.text || pick.text.trim().length < MIN_CONTENT_LENGTH) {
            console.error('[agilo:save:security] 🚨 BLOQUÉ : Sauvegarde avant fermeture IGNORÉE - texte vide après sérialisation');
            return; // NE JAMAIS sauvegarder un transcript vide
          }
          
          if (!pick.segments || pick.segments.length < MIN_SEGMENTS_COUNT) {
            console.error('[agilo:save:security] 🚨 BLOQUÉ : Sauvegarde avant fermeture IGNORÉE - pas de segments');
            return; // NE JAMAIS sauvegarder sans segments
          }
          
          const currentContent = pick.text.trim();
          
          // ✅ PROTECTION : Ne sauvegarder que si le contenu a changé ET est valide
          if (currentContent !== lastSavedContent && currentContent.length >= MIN_CONTENT_LENGTH) {
            console.log('[agilo:save:security] ✅ Sauvegarde avant fermeture autorisée - contenu valide');
            updateStatusIndicator('saving');
            await postCorrectAPI({
              username: creds.email,
              token: creds.token,
              jobId: creds.jobId,
              edition: creds.edition
            }, pick, {});
          } else {
            console.log('[agilo:save:security] ⏭️ Sauvegarde avant fermeture ignorée - pas de changement ou contenu invalide');
          }
        }
      } catch (error) {
        console.error('[agilo:save:security] 🚨 ERREUR sauvegarde avant fermeture:', error);
        // En cas d'erreur, NE PAS sauvegarder (mieux vaut ne pas écraser avec du vide)
      }
    });
    */
  }

  // ✅ 6. GESTION DES CONFLITS (multi-onglets) - moins agressive
  function setupConflictDetection() {
    const conflictKey = `agilo:conflict:${pickJobId()}`;
    let lastConflictCheck = 0; // ✅ NOUVEAU : Timer pour éviter vérifications trop fréquentes
    
    // ✅ CORRECTION : Vérifier moins souvent (toutes les 60 secondes au lieu de 30)
    setInterval(() => {
      try {
        const now = Date.now();
        // ✅ Éviter les vérifications trop fréquentes
        if (now - lastConflictCheck < STATUS_CHECK_INTERVAL) return;
        lastConflictCheck = now;
        
        const lastUpdate = localStorage.getItem(conflictKey);
        if (lastUpdate) {
          const updateTime = parseInt(lastUpdate);
          const timeDiff = now - updateTime;
          
          // ✅ CORRECTION : Ne notifier que si modification récente (< 5 secondes) ET seulement une fois
          if (timeDiff < 5000 && timeDiff > 1000) {
            // ✅ SUPPRIMÉ : Pas de toast automatique pour les conflits (trop intempestif)
            console.info('⚠️ Modification détectée dans un autre onglet');
          }
        }
      } catch (e) {
        console.warn('⚠️ Erreur détection conflit:', e);
      }
    }, STATUS_CHECK_INTERVAL);
    
    // ✅ CORRECTION : Marquer les modifications avec debounce
    const { main } = getAllPanes();
    if (main) {
      let conflictDebounce = null;
      main.addEventListener('input', () => {
        clearTimeout(conflictDebounce);
        conflictDebounce = setTimeout(() => {
          localStorage.setItem(conflictKey, Date.now().toString());
        }, 2000); // Debounce de 2 secondes
      });
    }
  }

  /* ===== GESTION VISIBILITÉ BOUTON SAUVEGARDER ===== */
  // ✅ NOUVEAU : Créer le style CSS avec !important pour forcer le masquage
  if (!document.querySelector('#agilo-save-button-hide-style')) {
    const style = document.createElement('style');
    style.id = 'agilo-save-button-hide-style';
    style.textContent = `
      button[data-action="save-transcript"].agilo-hide-save {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
  }
  
  // ✅ NOUVEAU : Fonction pour gérer la visibilité du bouton selon l'onglet actif
  function updateSaveButtonVisibility() {
    const saveBtn = document.querySelector('[data-action="save-transcript"]') || 
                    document.querySelector('button.button.save[data-opentech-ux-zone-id]') || 
                    document.querySelector('button.button.save');
    
    if (!saveBtn) {
      console.warn('[agilo:save] Bouton Sauvegarder non trouvé');
      return;
    }
    
    // ✅ AMÉLIORATION : Vérifier à la fois les onglets ET les panneaux
    // (car Code-main-editor.js modifie directement les panneaux)
    
    // 1. Vérifier l'onglet actif via aria-selected
    const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
    const isSummaryTab = activeTab && activeTab.id === 'tab-summary';
    const isChatTab = activeTab && activeTab.id === 'tab-chat';
    const isTranscriptTab = activeTab && activeTab.id === 'tab-transcript';
    
    // 2. Vérifier l'état des panneaux (Code-main-editor.js modifie directement les panneaux)
    const paneChat = document.querySelector('#pane-chat');
    const paneSummary = document.querySelector('#pane-summary');
    const paneTranscript = document.querySelector('#pane-transcript');
    
    // Vérifier si un panneau est visible (pas hidden et is-active)
    const isChatPaneActive = paneChat && 
                             !paneChat.hasAttribute('hidden') && 
                             (paneChat.classList.contains('is-active') || 
                              window.getComputedStyle(paneChat).display !== 'none');
    
    const isSummaryPaneActive = paneSummary && 
                                !paneSummary.hasAttribute('hidden') && 
                                (paneSummary.classList.contains('is-active') || 
                                 window.getComputedStyle(paneSummary).display !== 'none');
    
    const isTranscriptPaneActive = paneTranscript && 
                                   !paneTranscript.hasAttribute('hidden') && 
                                   (paneTranscript.classList.contains('is-active') || 
                                    window.getComputedStyle(paneTranscript).display !== 'none');
    
    // ✅ Décision finale : Combiner l'état des onglets ET des panneaux
    // Si un panneau est actif, cela prime sur l'onglet (car Code-main-editor.js peut modifier les panneaux directement)
    const finalIsChat = isChatTab || isChatPaneActive;
    const finalIsSummary = isSummaryTab || isSummaryPaneActive;
    const finalIsTranscript = isTranscriptTab || isTranscriptPaneActive;
    
    // ✅ Logs réduits (seulement si changement d'état)
    const wasVisible = !saveBtn.classList.contains('agilo-hide-save') && 
                      window.getComputedStyle(saveBtn).display !== 'none';
    
    if (finalIsTranscript && !finalIsChat && !finalIsSummary) {
      // Afficher le bouton UNIQUEMENT si on est sur l'onglet Transcription
      if (!wasVisible) {
        console.log('[agilo:save] ✅ Bouton Sauvegarder affiché (onglet Transcription actif)');
      }
      saveBtn.classList.remove('agilo-hide-save');
      saveBtn.style.setProperty('display', '', 'important');
      saveBtn.style.setProperty('visibility', '', 'important');
      saveBtn.style.setProperty('opacity', '', 'important');
      saveBtn.style.setProperty('pointer-events', '', 'important');
    } else if (finalIsSummary || finalIsChat) {
      // Cacher le bouton si on est sur l'onglet Compte-rendu OU Conversation
      // ✅ Double protection : classe CSS + style inline avec !important
      if (wasVisible) {
        const tabName = finalIsSummary ? 'Compte-rendu' : 'Conversation';
        console.log(`[agilo:save] ✅ Bouton Sauvegarder caché (onglet ${tabName} actif)`);
      }
      saveBtn.classList.add('agilo-hide-save');
      saveBtn.style.setProperty('display', 'none', 'important');
      saveBtn.style.setProperty('visibility', 'hidden', 'important');
      saveBtn.style.setProperty('opacity', '0', 'important');
      saveBtn.style.setProperty('pointer-events', 'none', 'important');
    } else {
      // Par défaut, cacher le bouton si on ne sait pas quel onglet est actif (sécurité)
      saveBtn.classList.add('agilo-hide-save');
      saveBtn.style.setProperty('display', 'none', 'important');
      saveBtn.style.setProperty('visibility', 'hidden', 'important');
      saveBtn.style.setProperty('opacity', '0', 'important');
      saveBtn.style.setProperty('pointer-events', 'none', 'important');
      console.log('[agilo:save] ✅ Bouton Sauvegarder caché par défaut (onglet inconnu)');
    }
  }
  
  // ✅ Exposer la fonction globalement pour pouvoir l'appeler manuellement
  window.updateSaveButtonVisibility = updateSaveButtonVisibility;
  
  // ✅ NOUVEAU : Observer les changements d'onglets ET des panneaux
  function setupTabObserver() {
    // Observer les changements d'attributs aria-selected sur les onglets
    const tabs = document.querySelectorAll('[role="tab"]');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Attendre un peu que le DOM se mette à jour (Code-main-editor.js utilise setTimeout(20ms))
        setTimeout(updateSaveButtonVisibility, 100);
        setTimeout(updateSaveButtonVisibility, 200); // Double vérification pour Code-main-editor.js
      });
    });
    
    // Observer les changements d'attributs avec MutationObserver
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      mutations.forEach((mutation) => {
        // Observer les changements d'onglets
        if (mutation.type === 'attributes' && mutation.attributeName === 'aria-selected') {
          shouldUpdate = true;
        }
        // ✅ NOUVEAU : Observer les changements sur les panneaux (hidden, class)
        if (mutation.target.id === 'pane-chat' || 
            mutation.target.id === 'pane-summary' || 
            mutation.target.id === 'pane-transcript') {
          if (mutation.type === 'attributes' && 
              (mutation.attributeName === 'hidden' || mutation.attributeName === 'class')) {
            shouldUpdate = true;
          }
        }
      });
      if (shouldUpdate) {
        setTimeout(updateSaveButtonVisibility, 50);
      }
    });
    
    // Observer tous les onglets
    tabs.forEach(tab => {
      observer.observe(tab, { attributes: true, attributeFilter: ['aria-selected', 'class'] });
    });
    
    // ✅ NOUVEAU : Observer aussi les panneaux (Code-main-editor.js les modifie directement)
    const panes = document.querySelectorAll('#pane-chat, #pane-summary, #pane-transcript');
    panes.forEach(pane => {
      observer.observe(pane, { 
        attributes: true, 
        attributeFilter: ['hidden', 'class'],
        attributeOldValue: false
      });
    });
    
    // Observer aussi les changements dans le conteneur d'onglets
    const tabList = document.querySelector('[role="tablist"]');
    if (tabList) {
      observer.observe(tabList, { childList: true, subtree: true });
    }
  }

  /* ===== EXPOSE ===== */
  function findSaveButton(){ return document.querySelector('[data-action="save-transcript"]') || document.querySelector('button.button.save[data-opentech-ux-zone-id]') || document.querySelector('button.button.save'); }
  window.restoreTranscriptBackup = function(){
    const jobId=pickJobId(); const b=readBackup(jobId); const {main}=getAllPanes();
    if(!b||!main){ alert('Aucune sauvegarde locale disponible'); return; }
    if (main.innerText!==undefined) main.innerText=b; else main.textContent=b;
    main.dispatchEvent(new Event('input',{bubbles:true}));
    document.dispatchEvent(new CustomEvent('agilo:restored',{detail:{jobId}}));
    alert('Version restaurée depuis le stockage local.');
  };
  window.agiloSaveNow = function(){ const btn=findSaveButton(); return doSave(btn||null); };
  window.serializeAll = serializeAll; window.ensureCreds = ensureCreds;
  window.agiloGetPayload = async()=>{ const creds=await ensureCreds(); const pick=await serializeAll(); const meta=buildMeta(pick.segments,pick.from); return {creds,pick,meta}; };
  window.agiloGetState = ()=>({ edition: pickEdition(), jobId: pickJobId(), email: pickEmail(), hasToken: !!pickToken(pickEdition(), pickEmail()) });
  window.verifyTranscriptReady = verifyTranscriptReady; // ✅ Exposer pour debug

  // ✅ Script de diagnostic complet
  window.agiloDebugSave = async function() {
    console.group('🔍 Diagnostic Agilo Save');
    
    try {
      const transcriptCheck = await verifyTranscriptReady();
      console.log('📊 Vérification transcript:', transcriptCheck);
      
      const {creds, pick, meta} = await window.agiloGetPayload();
      console.log('📊 Credentials:', creds);
      console.log('📊 Pick data:', pick);
      console.log('📊 Text content:', pick.text);
      console.log('📊 Text length:', pick.text?.length || 0);
      console.log('📊 Segments count:', pick.segments?.length || 0);
      console.log('📊 Last saved content:', lastSavedContent);
      console.log('📊 Content changed:', pick.text.trim() !== lastSavedContent);
      
      const { main } = getAllPanes();
      console.log('📊 Main editor:', main?.id, main?.className);
      
      console.groupEnd();
      return { creds, pick, transcriptCheck, main };
      
    } catch (e) {
      console.error('❌ Erreur diagnostic:', e);
      console.groupEnd();
      throw e;
    }
  };

  /* ===== BOOT ===== */
  function init(){
    const btn = findSaveButton();
    if (btn){ 
      btn.addEventListener('click', (e)=>{ 
        e.preventDefault(); 
        doSave(btn).catch(err => console.error('[agilo:save] ❌ Erreur:', err));
      }); 
    }
    else { 
      console.warn('[agilo:save] ⚠️ bouton .button.save introuvable');
    }

    window.addEventListener('keydown', (e)=>{ if ((e.ctrlKey||e.metaKey)&&!e.altKey&&!e.shiftKey&&String(e.key).toLowerCase()==='s'){ e.preventDefault(); const b=findSaveButton(); doSave(b||null); } });
    document.addEventListener('agilo:save', ()=>{ const b=findSaveButton(); doSave(b||null); });

    const { main } = getAllPanes();
    const jobId = pickJobId();
    if (jobId && main){
      restoreDraftIfAny(jobId, main);
      startAutosaveDraft(jobId, main);
    }

    // ✅ NOUVELLES FONCTIONNALITÉS
    statusIndicator = createStatusIndicator();
    // ✅ Auto-save DÉSACTIVÉ (sauvegarde manuelle uniquement)
    // startAutoSave(); // Commenté : sauvegarde manuelle uniquement
    setupBeforeUnload();
    setupConflictDetection();
    
    // ✅ NOUVEAU : Gérer la visibilité du bouton selon l'onglet actif
    // Vérifier immédiatement au chargement
    updateSaveButtonVisibility();
    
    // Vérifier plusieurs fois au cas où les onglets ne sont pas encore initialisés
    setTimeout(updateSaveButtonVisibility, 100);
    setTimeout(updateSaveButtonVisibility, 300);
    setTimeout(updateSaveButtonVisibility, 500);
    setTimeout(updateSaveButtonVisibility, 1000);
    setTimeout(updateSaveButtonVisibility, 2000);
    
    // Observer les changements d'onglets
    setupTabObserver();
    
    // Observer aussi les changements dans le DOM au cas où les onglets changent sans clic
    const domObserver = new MutationObserver(() => {
      updateSaveButtonVisibility();
    });
    
    // Observer les changements d'attributs sur les onglets
    const tabs = document.querySelectorAll('[role="tab"]');
    tabs.forEach(tab => {
      domObserver.observe(tab, { attributes: true, attributeFilter: ['aria-selected', 'class'] });
    });
    
    // ✅ NOUVEAU : Observer aussi les panneaux (Code-main-editor.js les modifie directement)
    const panes = document.querySelectorAll('#pane-chat, #pane-summary, #pane-transcript');
    panes.forEach(pane => {
      domObserver.observe(pane, { 
        attributes: true, 
        attributeFilter: ['hidden', 'class'],
        attributeOldValue: false
      });
    });
    
    // Observer aussi le conteneur d'onglets
    const tabList = document.querySelector('[role="tablist"]');
    if (tabList) {
      domObserver.observe(tabList, { childList: true, subtree: true, attributes: true });
    }

    console.info('[agilo:save] ✅ init OK ('+VERSION+') — transcriptContent = JSON complet + sauvegarde manuelle uniquement + notifications + protections critiques.');
  }

  if (document.readyState==='loading') {
    document.addEventListener('DOMContentLoaded', init, {once:true});
  } else {
    init();
  }
})();

