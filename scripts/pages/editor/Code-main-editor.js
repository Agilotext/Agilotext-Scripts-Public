// Agilotext - Main Editor (Transcript Editor Principal)
// ⚠️ Ce fichier est chargé depuis GitHub
// Correspond à: code-main-editor dans Webflow

(function ready(fn){
  if (document.readyState !== 'loading') fn();
  else document.addEventListener('DOMContentLoaded', fn, { once:true });
})(() => {
  'use strict';

  const API_BASE   = 'https://api.agilotext.com/api/v1';
  const editorRoot = document.getElementById('editorRoot');
  const SOFT_CANCEL = true;

  const EDITION = (function(){
    const raw = window.AGILO_EDITION
      || new URLSearchParams(location.search).get('edition')
      || editorRoot?.dataset.edition
      || localStorage.getItem('agilo:edition')
      || 'ent';
    const v = String(raw||'').toLowerCase().trim();
    if (['enterprise','entreprise','business','team','ent'].includes(v)) return 'ent';
    if (v.startsWith('pro')) return 'pro';
    if (v.startsWith('free') || v==='gratuit') return 'free';
    return 'ent';
  })();

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const byId = (id) => document.getElementById(id);
  const wait = (ms)=> new Promise(r=>setTimeout(r,ms));
  const waitFrames = (n=1)=> new Promise(res=>{
    const step=i=> i?requestAnimationFrame(()=>step(i-1)):res();
    step(Math.max(1,n));
  });
  
  // JSON Nico -> UI
const msToSec = ms => Math.max(0, Math.floor((+ms || 0) / 1000));
const decodeNL = s => String(s||'')
  .replace(/\\n/g, '\n')
  .replace(/<br\s*\/?>/gi, '\n');
function mapNicoJsonToSegments(j){
  const arr = Array.isArray(j?.segments) ? j.segments : [];
  return arr.map((r,i)=>({
    id: r.id || `s${i}`,
    start: msToSec(r.milli_start),
    end: Number.isFinite(r.milli_end) ? msToSec(r.milli_end) : null,
    speaker: String(r.speaker||'').trim(),
    text: decodeNL(r.text)
  }));
}


  function isVisible(el){
    if (!el) return false;
    const cs = getComputedStyle(el);
    return !el.hasAttribute('hidden') && cs.display!=='none' && cs.visibility!=='hidden';
  }
  function tokenKey(email, edition){
    return `agilo:token:${String(edition||'ent').toLowerCase()}:${String(email||'').toLowerCase()}`;
  }

  function pickTranscriptEl(){
    return byId('transcriptEditor') || byId('ag-transcript') || document.querySelector('[data-editor="transcript"]') || null;
  }
  function pickSummaryEl(){
    return byId('summaryEditor') || byId('ag-summary') || document.querySelector('[data-editor="summary"]') || null;
  }
  const editors = {
    transcript: pickTranscriptEl(),
    summary:    pickSummaryEl(),
    conversation: byId('conversationEditor') || byId('ag-conversation') || null
  };

  function toast(msg) {
    let tRoot = byId('toaster') || byId('ag-toasts');
    if (!tRoot) { tRoot = document.createElement('div'); tRoot.id='toaster'; tRoot.className='toaster ag-toasts'; document.body.appendChild(tRoot); }
    const div = document.createElement('div'); div.className = 'toast'; div.textContent = msg; tRoot.appendChild(div);
    setTimeout(() => { div.style.opacity=0; setTimeout(()=>div.remove(), 220); }, 2200);
  }
window.toast = window.toast || toast;


  const fmtHMS = (s)=>{
    s = Math.max(0, Math.floor(Number(s)||0));
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
    const HH = String(h).padStart(2,'0'), MM=String(m).padStart(2,'0'), SS=String(sec).padStart(2,'0');
    return h ? `${HH}:${MM}:${SS}` : `${MM}:${SS}`;
  };

 

  
/* ====================== Errors / Alerts ====================== */
function parseMaybeJson(raw, contentType = '') {
  const looksJson =
    (contentType || '').includes('application/json') ||
    /^\s*\{/.test(raw || '');
  if (!looksJson) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function normCode(code = '') {
  const s = String(code || '')
    .replace(/\s+/g, '_')
    .replace(/[^\w\-.]/g, '_')
    .toUpperCase();
  return s || 'UNKNOWN_ERROR';
}

function humanizeError({ where = 'summary', code = '', json = null, httpStatus = 0 }) {
  const C = normCode(code);
  const isSummary = where === 'summary';

  const tech = `${json?.exceptionName || json?.javaException || ''} ${json?.exceptionStackTrace || ''}`;

  if (/CLIENTABORTEXCEPTION|BROKEN PIPE/i.test(tech)) {
    return "La connexion a été interrompue pendant le téléchargement. Réessayez.";
  }
  if (/CONNEXION.*RE-?INITIALIS[ÉE]E/i.test(tech)) {
    return "Connexion ré-initialisée par le correspondant. Réessayez.";
  }

  if (C === 'HTTP_ERROR' && isSummary && (httpStatus === 404 || httpStatus === 204)) {
    return "Aucun compte-rendu disponible pour ce transcript (pas encore généré).";
  }

  const M = {
    ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS: "Vous n'avez pas demandé de compte-rendu pour cette transcription.",
    READY_SUMMARY_PENDING:                   "Résumé en préparation…",
    NOT_READY:                               "Résumé en préparation…",
    READY_SUMMARY_ON_ERROR:                  "La génération du compte-rendu a échoué.",
    ERROR_TRANSCRIPT_NOT_READY:              "Le transcript n'est pas encore prêt.",
    ON_ERROR:                                "Le serveur a signalé une erreur.",
    ERROR_INVALID_TOKEN:                     "Session expirée ou invalide. Veuillez vous reconnecter.",
    NETWORK_ERROR:                           "Problème réseau lors de la récupération des données.",
    HTTP_ERROR:                              `Réponse serveur inattendue (HTTP ${httpStatus || '???'})`,
    CANCELLED:                               "Chargement interrompu (changement de transcript).",
    UNKNOWN_ERROR:                           "Une erreur est survenue."
  };

  return M[C] || M.UNKNOWN_ERROR;
}

// Toujours afficher les sauts de ligne dans le contenteditable
(function ensurePrewrap(){
  if (!document.getElementById('ag-prewrap')) {
    const s=document.createElement('style'); s.id='ag-prewrap';
    s.textContent='.ag-seg__text{white-space:pre-wrap}';
    document.head.appendChild(s);
  }
})();
// Canon CE -> texte visible (div/br -> \n), NBSP -> espace
window.visibleTextFromBox = window.visibleTextFromBox || function(box){
  if (!box) return '';
  const clone = box.cloneNode(true);
  clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
  const BLOCKS = 'div,p,li,blockquote,pre,section,article,header,footer,h1,h2,h3,h4,h5,h6,ul,ol';
  clone.querySelectorAll(BLOCKS).forEach((el, i) => {
    if (i > 0 || el.previousSibling) el.before('\n');
  });
  return (clone.textContent || '')
    .replace(/\r\n?/g,'\n')
    .replace(/\u00A0/g,' ');
};


function renderAlert(htmlMsg, details = '') {
  const safe = document.createElement('div');
  safe.className = 'ag-alert ag-alert--warn';
  const esc = s => String(s).replace(/[<>&]/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m]));
  safe.innerHTML = `
    <div class="ag-alert__title">${esc(htmlMsg)}</div>
    ${details ? `<details class="ag-alert__details"><summary>Détails techniques</summary><pre>${esc(details)}</pre></details>` : ''}
  `;
  return safe;
}


  async function resolveEmail(){
    // 1. Essayer d'abord les sources directes
    const fromAttr = document.querySelector('[name="memberEmail"]')?.getAttribute('value') || '';
    const fromText = document.querySelector('[data-ms-member="email"]')?.textContent || '';
    let now = (byId('memberEmail')?.value || fromAttr || fromText || window.memberEmail || localStorage.getItem('agilo:username') || '').trim();
    if (now) return now;
    
    // 2. Essayer Memberstack avec timeout et gestion d'erreur améliorée
    if (window.$memberstackDom?.getMember){
      try { 
        // Timeout pour éviter d'attendre trop longtemps en cas de connexion instable
        const memberstackPromise = window.$memberstackDom.getMember();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Memberstack timeout')), 5000)
        );
        
        const r = await Promise.race([memberstackPromise, timeoutPromise]);
        now = (r?.data?.email||'').trim();
        if (now) {
          // Sauvegarder dans localStorage pour les prochaines fois
          try {
            localStorage.setItem('agilo:username', now);
          } catch (e) {}
          return now;
        }
      } catch (err) {
        // Détecter les erreurs réseau spécifiques
        const isNetworkError = err?.code === 'ERR_NETWORK' 
          || err?.message?.includes('Network Error')
          || err?.message?.includes('ERR_ADDRESS_UNREACHABLE')
          || err?.message?.includes('timeout')
          || err?.name === 'NetworkError';
        
        if (window.AGILO_DEBUG || isNetworkError) {
          console.warn('[agilo] getMember error (Memberstack non accessible):', err);
        }
        // En cas d'erreur réseau, on continue avec les fallbacks
      }
    }
    
    // 3. Dernier recours : vérifier localStorage
    const lastChance = localStorage.getItem('agilo:username');
    if (lastChance) return lastChance.trim();
    
    return '';
  }
  function readAuthSnapshot(){
    const edition = (editorRoot?.dataset.edition || EDITION || 'ent').trim();
    const email = editorRoot?.dataset.username
               || byId('memberEmail')?.value
               || document.querySelector('[name="memberEmail"]')?.value
               || localStorage.getItem('agilo:username')
               || window.memberEmail
               || '';
    const key = tokenKey(email, edition);
    const token = editorRoot?.dataset.token
               || window.globalToken
               || localStorage.getItem(key)
               || localStorage.getItem('agilo:token')
               || '';
    return { username: (email||'').trim(), token: token||'', edition, KEY: key };
  }
  function waitForTokenEvent(ms=8000, email='', edition=''){
    return new Promise(res=>{
      let done=false;
      const timer = setTimeout(()=>{ if(!done){ done=true; res(null); } }, ms);
      const h = (e)=>{
        if (done) return;
        const d = e?.detail||{};
        const okEmail = email ? (String(d.email||'').toLowerCase()===String(email).toLowerCase()) : true;
        const okEd    = edition ? (String(d.edition||'').toLowerCase()===String(edition).toLowerCase()) : true;
        if (d.token && okEmail && okEd){
          done = true; clearTimeout(timer);
          res({ username: d.email, token: d.token, edition: String(d.edition||edition) });
        }
      };
      window.addEventListener('agilo:token', h, { once:true, passive:true });
    });
  }
  async function ensureAuth(){
    let auth = readAuthSnapshot();
    if (!auth.username) auth.username = await resolveEmail();

    if (!auth.token && auth.username){
      if (typeof window.getToken === 'function'){
        try { window.getToken(auth.username, auth.edition); } catch {}
      }
      const fromEvt = await waitForTokenEvent(8000, auth.username, auth.edition);
      if (fromEvt?.token){
        auth.token = fromEvt.token;
        try{ localStorage.setItem(auth.KEY, auth.token); }catch{}
        window.globalToken = auth.token;
      } else {
        const snap = readAuthSnapshot();
        if (snap.token) auth = snap;
      }
    }

    if (auth.username) { try{ localStorage.setItem('agilo:username', auth.username); }catch{} }
    try{ localStorage.setItem('agilo:edition', auth.edition); }catch{}
    return auth;
  }
  async function refreshToken(auth){
    if (!auth?.username) return '';
    try{ localStorage.removeItem(auth.KEY); }catch{}
    if (typeof window.getToken === 'function'){
      try { window.getToken(auth.username, auth.edition); } catch {}
    }
    const evt = await waitForTokenEvent(8000, auth.username, auth.edition);
    const tok = evt?.token || window.globalToken || '';
    if (tok){
      try{ localStorage.setItem(auth.KEY, tok); }catch{}
      window.globalToken = tok;
    }
    return tok || '';
  }

  async function fetchWithTimeout(url, opts={}) {
    const { timeout = 20000, signal } = opts;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    const composite = new AbortController();
    function linkAbort(src){
      if (!src) return;
      if (src.aborted) composite.abort();
      src.addEventListener('abort', () => composite.abort(), { once:true });
    }
    linkAbort(signal);
    linkAbort(ctrl.signal);
    try{
      return await fetch(url, { ...opts, signal: composite.signal, credentials:'omit', cache:'no-store' });
    } finally { clearTimeout(t); }
  }

  let lastNetToast = 0;
  const netToast = msg => { const now=Date.now(); if (now - lastNetToast > 15000) { lastNetToast=now; toast(msg); } };

async function apiGetWithRetry(kind, jobId, auth, retryCount=0, signal){
  const base =
    (kind === 'summary')
      ? `${API_BASE}/receiveSummary?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(auth.username)}&token=${encodeURIComponent(auth.token)}&edition=${encodeURIComponent(auth.edition)}`
      : `${API_BASE}/receiveTextJson?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(auth.username)}&token=${encodeURIComponent(auth.token)}&edition=${encodeURIComponent(auth.edition)}`;

  const url = (kind === 'summary') ? (base + '&format=html') : base;

  let r, raw;
  try{
    r = await fetchWithTimeout(url, { signal, timeout: 12000 });
    raw = await r.text();
  }catch(e){
    if (e?.name === 'AbortError') return { ok:false, code:'CANCELLED', httpStatus:0, json:null, raw:'' };
    return { ok:false, code:'NETWORK_ERROR', httpStatus:0, json:null, raw:'' };
  }

  if (!r.ok) {
    if ((r.status===401 || r.status===403) && retryCount < 3) {
      const nt = await refreshToken(auth);
      if (nt) {
        auth.token = nt;
        await wait(400*Math.pow(1.5,retryCount));
        return apiGetWithRetry(kind, jobId, auth, retryCount+1, signal);
      }
    }
    return { ok:false, code:'HTTP_ERROR', httpStatus:r.status, json:parseMaybeJson(raw, r.headers.get('content-type')||''), raw };
  }

  const ct   = r.headers.get('content-type') || '';
  const json = parseMaybeJson(raw, ct);

  if (json && (json.status === 'KO' || json.errorMessage)) {
    const code = String(json.errorMessage || json.status || '').toLowerCase();
    const tech = (json?.exceptionName || json?.javaException || '') + ' ' + (json?.exceptionStackTrace || '');
    if (retryCount < 3) {
      if (/invalid[_-]?token/.test(code)) {
        const nt = await refreshToken(auth);
        if (nt) {
          auth.token = nt;
          await wait(500 * Math.pow(1.5, retryCount));
          return apiGetWithRetry(kind, jobId, auth, retryCount + 1, signal);
        }
      } else if (/CLIENTABORTEXCEPTION|BROKEN PIPE/i.test(tech) || /CONNEXION.*RE-?INITIALIS[ÉE]E/i.test(tech)) {
        netToast('Connexion interrompue détectée. Réessai automatique...');
        await wait(1000 * Math.pow(2, retryCount));
        return apiGetWithRetry(kind, jobId, auth, retryCount + 1, signal);
      }
    }
    return { ok:false, code: json.errorMessage || json.status || 'UNKNOWN_ERROR', json, raw };
  }

  return { ok:true, payload: raw, contentType: ct };
}


  function sanitizeHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    div.querySelectorAll('script, style, link[rel="stylesheet"], iframe, object, embed').forEach(n => n.remove());
    div.querySelectorAll('*').forEach(n => {
      [...n.attributes].forEach(a => {
        const name = a.name.toLowerCase();
        const val  = String(a.value || '');
        if (name.startsWith('on') || /^javascript:/i.test(val)) n.removeAttribute(a.name);
      });
    });
    return div.innerHTML;
  }
  function isBlankHtml(html){
    const s = String(html||'').replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]+>/g,'').replace(/\s+/g,'').trim();
    return s.length === 0;
  }

  function enableLink(el, href){
    if (!el) return;
    if (el.__agiloBlocker) { el.removeEventListener('click', el.__agiloBlocker); el.__agiloBlocker=null; }
    el.classList.remove('is-disabled');
    el.removeAttribute('aria-disabled');
    el.removeAttribute('title');
    el.setAttribute('href', href);
    el.setAttribute('target','_blank');
  }
  function disableLink(el, msg='Indisponible'){
    if (!el) return;
    if (el.__agiloBlocker) el.removeEventListener('click', el.__agiloBlocker);
    el.__agiloBlocker = (e)=>{ e.preventDefault(); toast(msg); };
    el.addEventListener('click', el.__agiloBlocker);
    el.classList.add('is-disabled');
    el.setAttribute('aria-disabled','true');
    el.setAttribute('title', msg);
    el.removeAttribute('target');
    el.setAttribute('href', 'javascript:void(0)');
  }
  function updateDownloadLinks(jobId, auth, {summaryEmpty=false} = {}) {
    const dl = {
      t_txt:  $('.download_wrapper-link_transcript_txt'),
      t_rtf:  $('.download_wrapper-link_transcript_rtf'),
      t_doc:  $('.download_wrapper-link_transcript_doc'),
      t_docx: $('.download_wrapper-link_transcript_docx'),
      t_pdf:  $('.download_wrapper-link_transcript_pdf'),
      s_txt:  $('.download_wrapper-link_summary_txt'),
      s_rtf:  $('.download_wrapper-link_summary_rtf'),
      s_doc:  $('.download_wrapper-link_summary_doc'),
      s_docx: $('.download_wrapper-link_summary_docx'),
      s_pdf:  $('.download_wrapper-link_summary_pdf')
    };
    if (!jobId || !auth?.username || !auth?.token) return;

    const baseQ = `jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(auth.username)}&token=${encodeURIComponent(auth.token)}&edition=${encodeURIComponent(auth.edition)}`;

    enableLink(dl.t_txt,  `${API_BASE}/receiveText?${baseQ}&format=txt`);
    enableLink(dl.t_rtf,  `${API_BASE}/receiveText?${baseQ}&format=rtf`);
    enableLink(dl.t_doc,  `${API_BASE}/receiveText?${baseQ}&format=doc`);
    enableLink(dl.t_docx, `${API_BASE}/receiveText?${baseQ}&format=docx`);
    enableLink(dl.t_pdf,  `${API_BASE}/receiveText?${baseQ}&format=pdf`);

    if (summaryEmpty) {
      ['s_txt','s_rtf','s_doc','s_docx','s_pdf'].forEach(k=> disableLink(dl[k], 'Résumé non disponible pour le moment'));
    } else {
      enableLink(dl.s_txt,  `${API_BASE}/receiveSummary?${baseQ}&format=html`); 
      enableLink(dl.s_rtf,  `${API_BASE}/receiveSummary?${baseQ}&format=rtf`);
      enableLink(dl.s_doc,  `${API_BASE}/receiveSummary?${baseQ}&format=doc`);
      enableLink(dl.s_docx, `${API_BASE}/receiveSummary?${baseQ}&format=docx`);
      enableLink(dl.s_pdf,  `${API_BASE}/receiveSummary?${baseQ}&format=pdf`);
    }

    const share = byId('shareLink');
    if (share) {
      const u = new URL(share.href || location.href);
      u.searchParams.set('jobId', jobId);
      u.searchParams.set('edition', auth.edition);
      share.href = u.toString();
    }
  }

window._segments = Array.isArray(window._segments) ? window._segments : [];
  let _activeSeg = -1;
  let __mode = 'plain';


  function buildRenameBtn(){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label','Renommer');
    btn.className = 'rename-btn absolute';
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="icon-1x1-small-5"><path d="M0 0h24v24H0z" fill="none"></path><path d="M18.41 5.8L17.2 4.59c-.78-.78-2.05-.78-2.83 0l-2.68 2.68L3 15.96V20h4.04l8.74-8.74 2.63-2.63c.79-.78.79-2.05 0-2.83zM6.21 18H5v-1.21l8.66-8.66 1.21 1.21L6.21 18zM11 20l4-4h6v4H11z" fill="currentColor"></path></svg>';
    return btn;
  }

  function renderSegments(segments){
  const root = editors.transcript; if (!root) return;

  root.innerHTML = '';
  root.dataset.mode = __mode;

  if (!segments || !segments.length) {
    const box = document.createElement('div');
    box.className = 'ag-plain';
    box.contentEditable = 'true';
    box.spellcheck = false;
    box.textContent = '';
    root.appendChild(box);
    root.setAttribute('contenteditable','false');
    return;
  }

  const frag = document.createDocumentFragment();

  segments.forEach((s, i)=>{
    const art = document.createElement('article');
    art.className = 'ag-seg';

    art.dataset.id = s.id || `s${i}`;
    if (Number.isFinite(s.start)) art.dataset.start = String(s.start);
    if (Number.isFinite(s.end))   art.dataset.end   = String(s.end);
    art.dataset.speaker = s.speaker || '';

    if (__mode === 'structured'){
      const header = document.createElement('header');
      header.className = 'ag-seg__head';

      const btnTime = document.createElement('button');
      btnTime.className = 'time';
      btnTime.type = 'button';
      const hasStart = Number.isFinite(s.start);
      const tText = hasStart ? fmtHMS(s.start) : '00:00';
      btnTime.textContent = tText;
      btnTime.dataset.action = 'seek';
      btnTime.dataset.t = hasStart ? String(s.start) : '0';
      btnTime.title = hasStart ? `Aller à ${tText}` : 'Aller au début (00:00)';
      header.appendChild(btnTime);

      const spanSpk = document.createElement('span');
      spanSpk.className = 'speaker';
      spanSpk.textContent = (s.speaker||'').trim();
      header.appendChild(spanSpk);

      const rename = buildRenameBtn();
      header.appendChild(rename);
      art.appendChild(header);
    }

    const body = document.createElement('div');
    body.className = 'ag-seg__text';
    body.contentEditable = 'true';
    body.spellcheck = false;
    body.textContent = s.text || '';
    art.appendChild(body);

    frag.appendChild(art);
  });

  root.appendChild(frag);
  root.setAttribute('contenteditable','false');

  if (!root.__bound) {
    root.addEventListener('click', (e)=>{
      const btn = e.target.closest('button.time[data-action="seek"]');
      if (!btn || __mode !== 'structured') return;
      const t = parseFloat(btn.dataset.t || '0');
      const audio = byId('agilo-audio');
      if (!audio) { toast('Lecteur audio introuvable.'); return; }
      try{ audio.currentTime = t; if (audio.paused) audio.play().catch(()=>{}); }catch{}
    });

    root.addEventListener('click', (e)=>{
      if (__mode !== 'structured') return;
      const btn = e.target.closest('.rename-btn');
      if (!btn) return;
      e.preventDefault(); e.stopPropagation();
      try { window.getSelection()?.removeAllRanges(); } catch {}
      try { document.activeElement?.blur?.(); } catch {}
      const segEl = btn.closest('.ag-seg');
      if (!segEl) return;
      doRenameFor(segEl, {
        triggerEl: btn,
        renameAllEmpty: !!(e.shiftKey || e.altKey),
        keyState: { shift: e.shiftKey, alt: e.altKey }
      });
    });

    root.addEventListener('dblclick', (e)=>{
      if (__mode !== 'structured') return;
      const sp = e.target.closest('.speaker'); if (!sp) return;
      e.preventDefault(); e.stopPropagation();
      try{ window.getSelection()?.removeAllRanges(); }catch{}
      doRenameFor(sp.closest('.ag-seg'), { triggerEl: sp });
    });

    root.addEventListener('input', (e)=>{
      const node = e.target.closest('.ag-seg__text'); if (!node) return;
      const segEl = node.closest('.ag-seg');
      const idx = Array.prototype.indexOf.call(root.children, segEl);
      if (idx>-1 && window._segments[idx]) {
        window._segments[idx].text = window.visibleTextFromBox(node);
      }
    });

    root.__bound = true;
  }
}
window.renderSegments = renderSegments;


  function normalizeName(name){
    let s = String(name||'').trim();
    s = s.replace(/^\d{1,2}:\d{2}(?::\d{2})?\s*/,'').replace(/[,;:—-]+$/,'').replace(/\s+/g,' ');
    if (s.length%2===0) {
      const a=s.slice(0,s.length/2), b=s.slice(s.length/2);
      if (a.localeCompare(b,undefined,{sensitivity:'accent'})===0) s=a;
    }
    return s;
  }

  const toolbar = {
    srch: byId('srchQuery') || byId('ag-search'),
    prev: byId('srchPrev')  || document.querySelector('[data-action="search-prev"]'),
    next: byId('srchNext')  || document.querySelector('[data-action="search-next"]'),
    repl: byId('replText')  || byId('ag-replace'),
    btnRepl: byId('btnReplace')   || document.querySelector('[data-action="replace-one"]'),
    btnReplAll: byId('btnReplaceAll') || document.querySelector('[data-action="replace-all"]')
  };

  let HITS=[], CUR=-1, chip=null;
  if (toolbar.srch && !byId('srchCountChip')) {
    chip = document.createElement('span'); chip.id='srchCountChip'; chip.className='srch-count-chip'; chip.textContent='0';
    toolbar.srch.insertAdjacentElement('afterend', chip);
  } else { chip = byId('srchCountChip'); }
  const updChip=()=>{ if (chip) chip.textContent = HITS.length ? `${CUR+1}/${HITS.length}` : '0'; };

  function getActivePaneRoot() {
    const chatPane  = byId('pane-chat');
    const chatViewEl = byId('chatView');
    if (isVisible(chatPane) && chatViewEl) return chatViewEl;
    const active = document.querySelector('.edtr-pane.is-active') || document.querySelector('.ag-panel.is-active')
                || document.querySelector('.edtr-pane:not([hidden])') || document.querySelector('.ag-panel:not([hidden])');
    if (!active) return editors.transcript || editors.summary || editors.conversation;
    if (/(^|-)summary$/.test(active.id)) return editors.summary || active;
    if (/(^|-)conversation$/.test(active.id)) return editors.conversation || active;
    return editors.transcript || active;
  }
  function getScopes() {
    const pane = getActivePaneRoot(); if (!pane) return [];
    if (pane.id === 'chatView') {
      const bubbles = Array.from(pane.querySelectorAll('.msg-bubble'));
      return bubbles.length ? bubbles : [pane];
    }
    const inTranscript = $$('.ag-seg__text', pane);
    return inTranscript.length ? inTranscript : [pane];
  }
  function clearScope(scope){
    scope.querySelectorAll('.search-hit').forEach(span => span.replaceWith(document.createTextNode(span.textContent||'')));
    scope.normalize();
  }
  function clearAll(){ getScopes().forEach(clearScope); HITS=[]; CUR=-1; updChip(); }

  function buildRx(q){
    if (!q) return null;
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(esc, 'gi');
  }

  function highlight(){
    const q = (toolbar.srch?.value||'').trim();
    const rx = buildRx(q);
    clearAll();
    if (!rx) return;

    const scopes = getScopes(); const collector=[];
    scopes.forEach(scope=>{
      scope.normalize();
      const w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
        acceptNode(n){
          if (!n?.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
          if (n.parentNode?.closest('.search-hit,script,style,iframe')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      let nodes=[], n; while(n=w.nextNode()) nodes.push(n);
      nodes.forEach(node=>{
        const text=node.textContent||''; if (!text) return;
        rx.lastIndex=0; let last=0, m=null; const frag=document.createDocumentFragment();
        while((m=rx.exec(text))!==null){
          const i=m.index, j=i+m[0].length;
          if (i>last) frag.appendChild(document.createTextNode(text.slice(last,i)));
          const span=document.createElement('span'); span.className='search-hit'; span.textContent=text.slice(i,j);
          frag.appendChild(span); collector.push(span); last=j; if (!m[0].length) break;
        }
        if (last<text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        node.replaceWith(frag);
      });
    });
    HITS=collector; CUR = HITS.length?0:-1;
    if (CUR>=0){
      HITS[CUR].classList.add('is-current');
      HITS[CUR].scrollIntoView({behavior:'smooth',block:'center'});
    }
    updChip();
  }

  function goto(delta){
    if (!HITS.length) return;
    HITS.forEach(h=>h.classList.remove('is-current'));
    CUR = (CUR + delta + HITS.length) % HITS.length;
    const el = HITS[CUR];
    el.classList.add('is-current');
    el.scrollIntoView({behavior:'smooth',block:'center'});
    updChip();
    const pos = toolbar.srch?.value.length||0;
    toolbar.srch?.focus({preventScroll:true});
    try{ toolbar.srch?.setSelectionRange(pos,pos);}catch{}
  }

  function replaceOne(){
    if (getActivePaneRoot()?.id === 'chatView'){ toast('Remplacement désactivé dans Conversation'); return; }
    if (CUR<0||!HITS[CUR]) return;
    const repl = toolbar.repl?.value ?? '';
    const el = HITS[CUR];
    el.textContent = repl;
    el.parentNode?.normalize?.();
    const keep=CUR; highlight();
    if (HITS.length){ CUR = Math.min(keep,HITS.length-1); HITS[CUR]?.classList.add('is-current'); updChip(); }
  }

  function replaceAll(){
    if (getActivePaneRoot()?.id === 'chatView'){ toast('Remplacement désactivé dans Conversation'); return; }
    const q=(toolbar.srch?.value||'').trim(); if (!q) return;
    const rx=buildRx(q); if (!rx) return;
    const repl = toolbar.repl?.value ?? '';
    getScopes().forEach(scope=>{
      const w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
        acceptNode(n){
          if (!n?.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
          if (n.parentNode?.closest('script,style,iframe')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      let n, nodes=[]; while(n=w.nextNode()) nodes.push(n);
      nodes.forEach(node=>{ node.textContent = node.textContent.replace(rx,repl); });
      scope.normalize();
    });
    highlight(); toast('Remplacements effectués');
  }

  let tDeb=null; const deb=(fn,d=110)=>{ clearTimeout(tDeb); tDeb=setTimeout(fn,d); };
  toolbar.srch?.addEventListener('input', ()=>deb(highlight));
  toolbar.next?.addEventListener('click', ()=>goto(+1));
  toolbar.prev?.addEventListener('click', ()=>goto(-1));
  toolbar.btnRepl?.addEventListener('click', replaceOne);
  toolbar.btnReplAll?.addEventListener('click', replaceAll);
  toolbar.srch?.addEventListener('keydown', (e)=>{ if (e.key==='Enter'){ e.preventDefault(); e.shiftKey?goto(-1):goto(+1); } });

  function ag_countOccurrencesByName(name){
    const target = String(name||'').trim();
   return window._segments.reduce((n, s)=> n + (+((s.speaker||'').trim() === target)), 0);
  }
  function ag_contiguousRangeFrom(idx, name){
    const target = String(name||'').trim();
    let start = idx, end = idx;
   while (start-1 >= 0 && (String(window._segments[start-1].speaker||'').trim() === target)) start--;
   while (end+1 < window._segments.length && (String(window._segments[end+1].speaker||'').trim() === target)) end++;
   return { start, end, count: Math.max(0, end-start+1) };
  }
  function ag_applyRenameScope({ scope, oldName, newName, idx }){
   const root = editors.transcript; if (!root) return 0;
    const targets = [];
    if (scope === 'one') targets.push(idx);
    else if (scope === 'contiguous') {
      const { start, end } = ag_contiguousRangeFrom(idx, oldName);
      for (let i=start;i<=end;i++) targets.push(i);
    } else if (scope === 'all') {
  window._segments.forEach((s, i) => { if ((s.speaker||'').trim() === String(oldName||'').trim()) targets.push(i); });
    } else if (scope === 'empty') {
 window._segments.forEach((s, i) => { if (!String(s.speaker||'').trim()) targets.push(i); });
    }
    const max = root.children.length;
  const unique = Array.from(new Set(targets)).filter(i => i>=0 && i < max);
  unique.forEach(i => {
    (window._segments || (window._segments=[]))[i] = (window._segments[i] || {});
    window._segments[i].speaker = newName;
      const el = root.children[i];
      if (!el) return;
      el.dataset.speaker = newName;
      const sp = el.querySelector('.speaker');
      if (sp) { sp.textContent = newName; sp.classList.remove('is-placeholder'); }
    });
    return unique.length;
  }
  function ag_showRenameMenu(anchor, { oldName, counts, onSelect, forEmpty=false }){
    document.querySelectorAll('.ag-rename-menu, .ag-rename-backdrop').forEach(n => n.remove());
    const menu = document.createElement('div'); menu.className = 'ag-rename-menu'; menu.setAttribute('role','dialog'); menu.setAttribute('aria-modal','true');
    const hd = document.createElement('div'); hd.className = 'ag-rename-menu__hd'; hd.textContent = 'Appliquer le renommage à…';
    const mk = (label, scope, suffix='')=>{
      const b = document.createElement('button'); b.type='button'; b.className='ag-rename-menu__row';
      b.innerHTML = `${label}${suffix ? ` <span class="ag-rename-menu__muted">${suffix}</span>` : ''}`;
      b.addEventListener('click', ()=>{ onSelect(scope); close(); }); return b;
    };
    const rows = [];
    rows.push(mk('Ce segment uniquement', 'one'));
    if (!forEmpty && counts.contig > 1) rows.push(mk('Ce groupe continu', 'contiguous', `${counts.contig} seg.`));
    if (!forEmpty && counts.total  > 1) rows.push(mk(`Toutes les occurrences de "${oldName}"`, 'all', `${counts.total} seg.`));
    if (forEmpty   && counts.empty  > 1) rows.push(mk('Tous les segments sans nom', 'empty', `${counts.empty} seg.`));
    if (rows.length === 1) rows.push(mk(forEmpty ? 'Tous les segments sans nom' : 'Toutes les occurrences', forEmpty ? 'empty' : 'all'));
    const backdrop = document.createElement('div'); backdrop.className = 'ag-rename-backdrop';
    const off=[]; const on=(t,ev,fn,opt)=>{ t.addEventListener(ev,fn,opt||false); off.push(()=>t.removeEventListener(ev,fn,opt||false)); };
    function close(){ off.forEach(fn=>fn()); menu.remove(); backdrop.remove(); }
    on(backdrop,'click',close); on(document,'keydown',e=>{ if(e.key==='Escape') close(); });
    menu.style.visibility='hidden'; menu.appendChild(hd); rows.forEach(r=>menu.appendChild(r));
    document.body.appendChild(backdrop); document.body.appendChild(menu);
    function place(){
      const r = (anchor?.getBoundingClientRect?.() || {top:innerHeight/2,left:innerWidth/2,bottom:innerHeight/2});
      const mw = menu.offsetWidth, mh = menu.offsetHeight;
      let top = r.bottom + 8, left = r.left;
      left = Math.max(8, Math.min(left, innerWidth - mw - 8));
      if (top + mh > innerHeight - 8) top = r.top - mh - 8;
      top = Math.max(8, Math.min(top, innerHeight - mh - 8));
      menu.style.top = top+'px'; menu.style.left = left+'px';
    }
    place(); menu.style.visibility=''; try{ menu.querySelector('.ag-rename-menu__row')?.focus({preventScroll:true}); }catch{}
  }
 function doRenameFor(segEl, { triggerEl=null, renameAllEmpty=false, keyState={} } = {}){
   const root = editors.transcript; if (!root) return;
  try{ if (typeof window.syncDomToModel==='function') window.syncDomToModel(); }catch{}
   const idx = Array.prototype.indexOf.call(root.children, segEl); if (idx < 0) return;

  const oldName   = String(segEl.dataset.speaker || '').trim();
  const proposed  = oldName || 'Intervenant';
  const rawName   = (prompt('Renommer le locuteur :', proposed) || '');
  const newName   = normalizeName(rawName);
  if (!newName || newName === oldName) return;

 const emptyCount = window._segments.reduce((n, s)=> n + (+(!String(s.speaker||'').trim())), 0);
  const counts = {
    total:  oldName ? ag_countOccurrencesByName(oldName)         : 0,
    contig: oldName ? ag_contiguousRangeFrom(idx, oldName).count : 0,
    empty:  emptyCount
  };

  const shift = !!keyState.shift;
  const alt   = !!keyState.alt;

  if (oldName) {
    if (shift) { const n=ag_applyRenameScope({scope:'all',        oldName,newName,idx}); toast(`Renommé "${oldName}" → "${newName}" (${n} seg.)`); return; }
    if (alt)   { const n=ag_applyRenameScope({scope:'contiguous',  oldName,newName,idx}); toast(`Groupe renommé (${n} seg.)`); return; }
  } else if (renameAllEmpty) {
    const n = ag_applyRenameScope({ scope:'empty', oldName:'', newName, idx });
    toast(`Segments sans nom → "${newName}" (${n} seg.)`);
    return;
  }

  const anchor = triggerEl || segEl;
  const forEmpty = !oldName;

  ag_showRenameMenu(anchor, {
    oldName, counts, forEmpty,
    onSelect(scope){
      const n = ag_applyRenameScope({ scope, oldName, newName, idx });
      toast(
        scope==='one'        ? 'Locuteur mis à jour' :
        scope==='contiguous' ? `Groupe renommé (${n} seg.)` :
        scope==='all'        ? `Toutes les occurrences → "${newName}" (${n} seg.)` :
                               `Segments sans nom → "${newName}" (${n} seg.)`
      );
    }
  });
}



  
  function attachAudioSync(){
  const root = editors.transcript; if (!root) return;
  const audio = byId('agilo-audio'); if (!audio) return;
  if (root.__syncBound) return;

  audio.addEventListener('timeupdate', ()=>{
    if (__mode !== 'structured' || !window._segments.length) return;
    const t = audio.currentTime || 0;
    let k = _activeSeg;
    const inSeg = (s)=> Number.isFinite(s.start)&&Number.isFinite(s.end)&&t>=s.start&&t<s.end;
    if (k<0 || !inSeg(window._segments[k])) k = window._segments.findIndex(inSeg);
    if (k !== _activeSeg) {
      if (_activeSeg>=0) root.children[_activeSeg]?.classList.remove('is-active');
      _activeSeg = k;
      const el = root.children[k];
      if (el){
        el.classList.add('is-active');
        const r = el.getBoundingClientRect();
        if (r.top < 100 || r.bottom > innerHeight-120) el.scrollIntoView({behavior:'smooth', block:'center'});
      }
    }
  });

  root.__syncBound = true;
}
window.attachAudioSync = attachAudioSync;

  /* ====================== Fonctions Lottie pour le chargement du compte-rendu ====================== */
  
  /**
   * Cache simple pour getTranscriptStatus (évite les appels multiples)
   */
  const __statusCache = new Map();
  const STATUS_CACHE_TTL = 2000; // 2 secondes

  /**
   * Appeler l'API getTranscriptStatus pour obtenir le statut
   * ⚠️ AMÉLIORATION : Ajout de retry et cache
   */
  async function getTranscriptStatus(jobId, auth, retryCount = 0) {
    // Vérifier le cache
    const cacheKey = `${jobId}:${auth.username}:${auth.edition}`;
    const cached = __statusCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < STATUS_CACHE_TTL) {
      if (window.AGILO_DEBUG) console.log('[Editor] Statut depuis cache:', cached.status);
      return cached.status;
    }

    try {
      const url = `${API_BASE}/getTranscriptStatus?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(auth.username)}&token=${encodeURIComponent(auth.token)}&edition=${encodeURIComponent(auth.edition)}`;
      
      const response = await fetchWithTimeout(url, { timeout: 10000 });
      
      if (!response.ok) {
        // Retry pour les erreurs 5xx (erreurs serveur)
        if ((response.status >= 500 || response.status === 0) && retryCount < 2) {
          if (window.AGILO_DEBUG) console.log(`[Editor] Retry getTranscriptStatus (${retryCount + 1}/2) pour erreur ${response.status}`);
          await wait(500 * Math.pow(2, retryCount));
          return getTranscriptStatus(jobId, auth, retryCount + 1);
        }
        if (window.AGILO_DEBUG) console.error('[Editor] Erreur HTTP getTranscriptStatus:', response.status);
        return null;
      }
      
      const data = await response.json();
      let status = null;
      
      if (data.status === 'OK' && data.transcriptStatus) {
        status = data.transcriptStatus;
      } else if (data.status === 'KO') {
        if (window.AGILO_DEBUG) console.error('[Editor] Erreur API getTranscriptStatus:', data.errorMessage);
        // Vérifier si c'est l'erreur "fichier manquant"
        if (data.errorMessage && /ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS/i.test(data.errorMessage)) {
          status = 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS';
        }
      }
      
      // Mettre en cache
      if (status !== null) {
        __statusCache.set(cacheKey, { status, timestamp: Date.now() });
        // Nettoyer le cache après 10 secondes pour éviter la croissance infinie
        setTimeout(() => __statusCache.delete(cacheKey), 10000);
      }
      
      return status;
    } catch (error) {
      // Retry pour les erreurs réseau
      if (retryCount < 2 && (error?.name === 'AbortError' || error?.message?.includes('timeout') || error?.message?.includes('network'))) {
        if (window.AGILO_DEBUG) console.log(`[Editor] Retry getTranscriptStatus (${retryCount + 1}/2) pour erreur réseau`);
        await wait(500 * Math.pow(2, retryCount));
        return getTranscriptStatus(jobId, auth, retryCount + 1);
      }
      if (window.AGILO_DEBUG) console.error('[Editor] Erreur réseau getTranscriptStatus:', error);
      return null;
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
          setTimeout(() => {
            ix2.init();
          }, 100);
        }
      } catch (e) {
        if (window.AGILO_DEBUG) console.log('[Editor] Webflow IX2 non disponible');
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
        
        if (!element._lottie) {
          element._lottie = window.lottie.loadAnimation(animationData);
        }
      } catch (e) {
        if (window.AGILO_DEBUG) console.log('[Editor] Lottie direct non disponible:', e);
      }
    }
    
    // Méthode 3: Attendre que Webflow charge l'animation
    setTimeout(() => {
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
    const summaryEditor = editors.summary || pickSummaryEl();
    if (!summaryEditor) return;
    
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
        // Si l'élément existe ailleurs, le cloner
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
      // Réinitialiser les attributs de lecture seule pendant le chargement
      summaryEditor.removeAttribute('contenteditable');
      summaryEditor.removeAttribute('readonly');
      summaryEditor.style.userSelect = '';
      summaryEditor.style.cursor = '';
      summaryEditor.classList.remove('ag-summary-readonly');
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
            if (window.AGILO_DEBUG) console.log('[Editor] Lottie ne s\'est pas chargé, utilisation du fallback');
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
   * ⚠️ AMÉLIORATION : Cherche uniquement dans editors.summary pour éviter les conflits
   */
  function hideSummaryLoading() {
    const summaryEditor = editors.summary || pickSummaryEl();
    if (!summaryEditor) return;
    
    // Chercher uniquement dans summaryEditor, pas dans tout le document
    const loader = summaryEditor.querySelector('.summary-loading-indicator');
    const lottieElement = summaryEditor.querySelector('#loading-summary, #loading-summary-clone');
    
    if (loader) {
      loader.style.display = 'none';
    }
    
    if (lottieElement) {
      lottieElement.style.display = 'none';
    }
  }

  /* ====================== Summary repoll (annulable) ====================== */
  /**
   * ⚠️ AMÉLIORATION : Fonction pure qui ne gère plus l'UI directement
   * La gestion du loader est faite dans loadJob()
   */
	async function pollSummaryUntilReady(jobId, auth, { max=50, baseDelay=900, signal, seq } = {}) {
	  const ref = seq ?? __loadSeq;
	  for (let i = 0; i < max; i++) {
	    if (signal?.aborted || isStale(ref)) {
	      return { ok:false, code:'CANCELLED' };
	    }
      const r = await apiGetWithRetry('summary', jobId, {...auth}, 0, signal);
      if (r.ok){
        const safe = sanitizeHtml(r.payload||'');
        if (!isBlankHtml(safe)) {
          return { ok:true, html: safe };
        }
      } else if (!/READY_SUMMARY_PENDING|NOT_READY|PENDING/i.test(String(r.code||''))) {
        return r;
      }
      await wait(baseDelay*Math.pow(1.3,i));
    }
    return { ok:false, code:'READY_SUMMARY_PENDING' };
  }

  let __lastLoadJobId = null;
  let __loadSeq = 0;
  let __activeFetchCtl = null;
  function computeSeq(){ return (++__loadSeq); }
function isStale(seq){ return (seq !== __loadSeq); }


let __wdTimer;
let __wdToken = 0;

window.addEventListener('agilo:beforeload', (e) => {
  // ⚠️ AMÉLIORATION : Nettoyer immédiatement tous les états précédents
  try { __activeFetchCtl?.abort?.(); } catch {}
  clearTimeout(__wdTimer);
  __wdToken++;

  editors.transcript = pickTranscriptEl();
  editors.summary    = pickSummaryEl();

  const tr = editors.transcript, sm = editors.summary;
  
  // ⚠️ AMÉLIORATION : Toujours réinitialiser le contenu pour éviter les messages qui restent
  if (tr) { 
    tr.setAttribute('aria-busy','true'); 
    tr.innerHTML = '<div class="ag-loader">Chargement du transcript…</div>';
  }
  if (sm) { 
    sm.setAttribute('aria-busy','true'); 
    // ⚠️ AMÉLIORATION : Ne pas réinitialiser si un loader Lottie est déjà présent
    // (il sera géré par loadJob qui vérifiera le statut PENDING)
    const existingLoader = sm.querySelector('.summary-loading-indicator');
    if (!existingLoader) {
      sm.innerHTML = '<div class="ag-loader">Chargement du compte-rendu…</div>';
    }
  }

  const my = __wdToken;
  __wdTimer = setTimeout(() => {
    if (my !== __wdToken) return;
    const trL = tr?.querySelector('.ag-loader'); 
    if (tr?.getAttribute('aria-busy')==='true' && trL) trL.textContent = 'Chargement plus long que prévu…';
    const smL = sm?.querySelector('.ag-loader'); 
    if (sm?.getAttribute('aria-busy')==='true' && smL) smL.textContent = 'Chargement plus long que prévu…';
  }, 8000);
});


  async function loadJob(jobId){
    // ✅ CORRECTION : Déclarer isSummaryPending au début de la fonction pour qu'elle soit accessible dans le finally
    let isSummaryPending = false;
    const id = String(jobId||'').trim();
    if (!id) return;
    
    // ⚠️ AMÉLIORATION : Nettoyer immédiatement le timer précédent
    clearTimeout(__wdTimer);
    __wdToken++;
    
    __lastLoadJobId = id;

    if (!SOFT_CANCEL) { try { __activeFetchCtl?.abort?.(); } catch {} }
    __activeFetchCtl = new AbortController();
    
    // ⚠️ AMÉLIORATION : S'assurer que les éditeurs sont à jour
    editors.transcript = pickTranscriptEl();
    editors.summary    = pickSummaryEl();

    if (window.__agiloOrchestrator && !window.__agiloOrchestrator.__editorSubscribed){
window.__agiloOrchestrator.subscribe('editor', {
cancel() {
  try { __activeFetchCtl?.abort?.(); } catch {}
  if (window.AGILO_DEBUG) console.log('[Editor] Cancelled by orchestrator (no DOM reset)');
}
});
      window.__agiloOrchestrator.__editorSubscribed = true;
    }

    const seq = computeSeq();

    await waitFrames(1);

    editors.transcript = pickTranscriptEl();
    editors.summary    = pickSummaryEl();

    try { clearAll(); } catch {}


    const auth = await ensureAuth();
    if (isStale(seq)) {
      // ⚠️ AMÉLIORATION : Nettoyer aria-busy même si stale
      clearTimeout(__wdTimer);
      __wdToken++;
      editors.transcript?.removeAttribute('aria-busy');
      editors.summary?.removeAttribute('aria-busy');
      hideSummaryLoading();
      return;
    }

if (!auth.username || !auth.token) {
  clearTimeout(__wdTimer);
  __wdToken++;

  toast('Authentification manquante');
  editors.transcript?.removeAttribute('aria-busy');
  editors.summary?.removeAttribute('aria-busy');
  hideSummaryLoading();
  return;
}
    try{
      const [tRes, sRes] = await Promise.allSettled([
        apiGetWithRetry('transcript', id, {...auth}, 0, __activeFetchCtl.signal),
        apiGetWithRetry('summary',    id, {...auth}, 0, __activeFetchCtl.signal)
      ]);
      if (isStale(seq)) {
        // ⚠️ AMÉLIORATION : Nettoyer aria-busy même si stale
        clearTimeout(__wdTimer);
        __wdToken++;
        editors.transcript?.removeAttribute('aria-busy');
        editors.summary?.removeAttribute('aria-busy');
        hideSummaryLoading();
        return;
      }

      if (tRes.status === 'fulfilled' && tRes.value.ok) {
 
 const raw = tRes.value.payload || '';
const json = parseMaybeJson(raw, tRes.value.contentType || '');

try {
  if (json && Array.isArray(json.segments)) {
 window._segments = mapNicoJsonToSegments(json);
  } else {
    const plain = String(raw || '').replace(/\r\n?/g, '\n').trim();
 window._segments = plain ? [{ id:'s0', start:0, end:null, speaker:'', text:plain }] : [];
  }
} catch(e){
  if (window.AGILO_DEBUG) console.error('[mapJson] crash', e);
  window._segments = []
}

 _activeSeg = -1;
 __mode = (window._segments.length && window._segments.every(s => Number.isFinite(s.start)))
? 'structured'
  : 'plain';

 if (!window._segments.length && editors.transcript) {
  renderSegments([]);
  const box = editors.transcript.querySelector('.ag-plain');
  if (box) box.textContent = (json ? '' : (raw || ''));
 } else {
   renderSegments(window._segments);
   attachAudioSync();
 }
 
        if ((toolbar.srch?.value||'').trim()) highlight();
			} else {
			  const val = (tRes.status==='fulfilled'?tRes.value:null);
			  if (val?.code === 'CANCELLED') return; 
			  const msg = val ? humanizeError({ where:'transcript', code:val.code, json:val.json, httpStatus:val.httpStatus })
			                  : "Chargement du transcript annulé (veuillez recharger la page)";
			  if (editors.transcript) {
			    editors.transcript.innerHTML = '';
			    editors.transcript.appendChild(renderAlert(msg, val?.json?.exceptionStackTrace || val?.raw || ''));
			  }
			 window._segments = []
			}
let summaryEmpty = true;

// ⚠️ NOUVEAU : Vérifier le statut avec getTranscriptStatus pour savoir si le compte-rendu est en cours
// ⚠️ OPTIMISATION : Ne vérifier que si on n'a pas déjà le compte-rendu
let transcriptStatus = null;
// ✅ CORRECTION : isSummaryPending est maintenant déclaré au début de loadJob()

// Vérifier le statut seulement si nécessaire (pas de compte-rendu reçu ou vide)
const needsStatusCheck = !(sRes.status === 'fulfilled' && sRes.value.ok && !isBlankHtml(sanitizeHtml(sRes.value.payload || '')));

if (needsStatusCheck) {
  try {
    transcriptStatus = await getTranscriptStatus(id, auth);
    if (window.AGILO_DEBUG) console.log('[Editor] Statut transcript:', transcriptStatus);
    isSummaryPending = transcriptStatus === 'READY_SUMMARY_PENDING';
    
    // ⚠️ AMÉLIORATION : Si le statut est READY_SUMMARY_PENDING, afficher le loader Lottie
    // Remplacer le loader simple de beforeload par le loader Lottie
    if (isSummaryPending && editors.summary) {
      // Vérifier si on a encore le loader simple de beforeload
      const simpleLoader = editors.summary.querySelector('.ag-loader');
      if (simpleLoader) {
        // Remplacer par le loader Lottie
        editors.summary.innerHTML = '';
        // Réinitialiser les attributs de lecture seule (pendant le chargement)
        editors.summary.removeAttribute('contenteditable');
        editors.summary.removeAttribute('readonly');
        editors.summary.style.userSelect = '';
        editors.summary.style.cursor = '';
        editors.summary.classList.remove('ag-summary-readonly');
      }
      showSummaryLoading();
    }
  } catch (e) {
    if (window.AGILO_DEBUG) console.error('[Editor] Erreur getTranscriptStatus:', e);
  }
}

if (sRes.status === 'fulfilled' && sRes.value.ok) {
  let cleaned = sanitizeHtml(sRes.value.payload);
  if (isBlankHtml(cleaned)) {
    // Si le statut est PENDING, garder le loader affiché pendant le polling
    if (!isSummaryPending && editors.summary) {
      showSummaryLoading(); // Afficher le loader si pas déjà affiché
    }
    
    const polled = await pollSummaryUntilReady(id, { ...auth }, { signal: __activeFetchCtl.signal, seq });
    if (polled.ok) {
      cleaned = polled.html || '';
      hideSummaryLoading(); // Cacher le loader une fois le compte-rendu prêt
    } else if (polled.code === 'READY_SUMMARY_PENDING' || isSummaryPending) {
      // Si toujours en cours après polling, garder le loader affiché
      if (editors.summary && !editors.summary.querySelector('.summary-loading-indicator')) {
        showSummaryLoading();
      }
    } else {
      // ⚠️ AMÉLIORATION : Cacher le loader en cas d'erreur définitive
      hideSummaryLoading();
    }
  }
  if (!isBlankHtml(cleaned)) {
    summaryEmpty = false;
    hideSummaryLoading(); // S'assurer que le loader est caché
    if (editors.summary) {
      editors.summary.innerHTML = cleaned;
      // ⚠️ RENDRE LE RÉSUMÉ EN LECTURE SEULE (demandé par Nicolas)
      editors.summary.setAttribute('contenteditable', 'false');
      editors.summary.setAttribute('readonly', 'true');
      editors.summary.style.userSelect = 'text'; // Permettre la sélection pour copier
      editors.summary.style.cursor = 'default';
      editors.summary.classList.add('ag-summary-readonly');
    }
  } else if (editors.summary && !isSummaryPending) {
    // Afficher le loader seulement si pas déjà affiché (statut PENDING)
    if (!editors.summary.querySelector('.summary-loading-indicator')) {
      editors.summary.replaceChildren(
        renderAlert("Résumé en préparation…", "Le serveur n'a pas encore publié le HTML du compte-rendu.")
      );
      // Réinitialiser les attributs de lecture seule si pas de contenu
      editors.summary.removeAttribute('contenteditable');
      editors.summary.removeAttribute('readonly');
      editors.summary.style.userSelect = '';
      editors.summary.style.cursor = '';
      editors.summary.classList.remove('ag-summary-readonly');
    }
  }

} else { 
  const val = (sRes.status === 'fulfilled' ? sRes.value : null);
  if (val?.code === 'CANCELLED') return; 

  const code = String(val?.code || '');
  const looksPending = /READY_SUMMARY_PENDING|NOT_READY|PENDING|ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS/i.test(code);
  const httpLooksPending = (val?.httpStatus === 404 || val?.httpStatus === 204);

  if (looksPending || httpLooksPending) {
    // Si le statut est PENDING, afficher le loader Lottie
    if (!isSummaryPending && editors.summary) {
      // Vérifier à nouveau le statut si on ne l'a pas déjà fait
      if (!transcriptStatus) {
        try {
          transcriptStatus = await getTranscriptStatus(id, auth);
          isSummaryPending = transcriptStatus === 'READY_SUMMARY_PENDING';
        } catch (e) {
          if (window.AGILO_DEBUG) console.error('[Editor] Erreur getTranscriptStatus (retry):', e);
        }
      }
      if (isSummaryPending || looksPending) {
        showSummaryLoading();
      }
    } else if (isSummaryPending && editors.summary) {
      showSummaryLoading(); // S'assurer que le loader est affiché
    }
    
    const polled = await pollSummaryUntilReady(id, { ...auth }, { signal: __activeFetchCtl.signal, seq });
    if (polled.ok && !isBlankHtml(polled.html)) {
      summaryEmpty = false;
      hideSummaryLoading(); // Cacher le loader une fois le compte-rendu prêt
      if (editors.summary) {
        editors.summary.innerHTML = polled.html;
        // ⚠️ RENDRE LE RÉSUMÉ EN LECTURE SEULE
        editors.summary.setAttribute('contenteditable', 'false');
        editors.summary.setAttribute('readonly', 'true');
        editors.summary.style.userSelect = 'text';
        editors.summary.style.cursor = 'default';
        editors.summary.classList.add('ag-summary-readonly');
      }
    } else if (editors.summary) {
      // Si toujours en cours, garder le loader, sinon afficher l'erreur
      if (polled.code === 'READY_SUMMARY_PENDING' || isSummaryPending) {
        if (!editors.summary.querySelector('.summary-loading-indicator')) {
          showSummaryLoading();
        }
      } else {
        // ⚠️ AMÉLIORATION : Toujours cacher le loader en cas d'erreur définitive
        hideSummaryLoading();
        const msg = humanizeError({ where: 'summary', code: val?.code, json: val?.json, httpStatus: val?.httpStatus });
        editors.summary.innerHTML = '';
        // Réinitialiser les attributs de lecture seule en cas d'erreur
        editors.summary.removeAttribute('contenteditable');
        editors.summary.removeAttribute('readonly');
        editors.summary.style.userSelect = '';
        editors.summary.style.cursor = '';
        editors.summary.classList.remove('ag-summary-readonly');
        editors.summary.appendChild(renderAlert(msg, val?.json?.exceptionStackTrace || ''));
      }
    }
  } else if (editors.summary) {
    hideSummaryLoading(); // Cacher le loader en cas d'erreur
    const msg = humanizeError({ where: 'summary', code: val?.code, json: val?.json, httpStatus: val?.httpStatus });
    editors.summary.innerHTML = '';
    editors.summary.appendChild(renderAlert(msg, val?.json?.exceptionStackTrace || ''));
  }
}
      updateDownloadLinks(id, auth, { summaryEmpty });
      if (editorRoot) {
        editorRoot.dataset.jobId = id;
        editorRoot.dataset.summaryEmpty = summaryEmpty ? '1' : '0';
      }
    }catch(e){
      if (e?.name === 'AbortError') return;
      hideSummaryLoading(); // S'assurer que le loader est caché en cas d'erreur
      const errBox = renderAlert("Erreur de chargement.", e?.message || '');
      if (editors.transcript) editors.transcript.replaceChildren(errBox.cloneNode(true));
      if (editors.summary)    editors.summary.replaceChildren(errBox.cloneNode(true));
      if (window.AGILO_DEBUG) console.error(e);
		} finally {
		  // ⚠️ AMÉLIORATION : Toujours nettoyer le timer et les états, même si stale
		  clearTimeout(__wdTimer);
		  __wdToken++;
		  
		  // ⚠️ AMÉLIORATION : Toujours retirer aria-busy, même si stale (évite les états bloqués)
		  // Seule exception : si vraiment en cours de chargement d'un autre job
		  const currentJobId = String(id || '').trim();
          const editorJobId = editorRoot?.dataset?.jobId || '';
          
          // Si le jobId correspond toujours, on peut retirer aria-busy
          // Sinon, c'est qu'un autre job est en cours, on laisse le beforeload gérer
          if (!currentJobId || currentJobId === editorJobId || isStale(seq)) {
            editors.transcript?.removeAttribute('aria-busy');
            editors.summary?.removeAttribute('aria-busy');
          }
		  
		  // S'assurer que le loader est toujours caché à la fin (sauf si vraiment en cours)
		  if (!isSummaryPending) {
		    hideSummaryLoading();
		  }
		}
  }

(function init(){
  setupInsightShortcuts();

  const urlJob  = new URLSearchParams(location.search).get('jobId');
  const dataJob = editorRoot?.dataset.jobId || '';
  const seed = (urlJob || dataJob || '').trim();
  if (seed) loadJob(seed);
})();

window.addEventListener('agilo:load', (e) => {
  const raw = e?.detail?.jobId ?? e?.detail ?? '';
  const id  = String(raw || '').trim();
  if (!id) return;

  // ⚠️ AMÉLIORATION : Nettoyer le timer précédent au cas où
  clearTimeout(__wdTimer);
  __wdToken++;

  const uiReadySameJob =
    id === __lastLoadJobId &&
    editors.transcript?.getAttribute('aria-busy') !== 'true' &&
    editorRoot?.dataset.jobId === id;

  if (uiReadySameJob) {
    // ⚠️ AMÉLIORATION : S'assurer que aria-busy est bien retiré même si on skip
    editors.transcript?.removeAttribute('aria-busy');
    editors.summary?.removeAttribute('aria-busy');
    return;
  }
  loadJob(id);
});


window.addEventListener('agilo:token', () => {
  const jid =
    (editorRoot?.dataset.jobId ||
     new URLSearchParams(location.search).get('jobId') ||
     '').trim();
  if (!jid) return;

  const auth = readAuthSnapshot();
  const summaryEmpty = editorRoot?.dataset.summaryEmpty === '1';
  updateDownloadLinks(jid, auth, { summaryEmpty });
});

  // Ajouter les styles CSS pour le loader Lottie
  (function injectSummaryLoadingStyles() {
    if (document.querySelector('#agilo-summary-loading-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'agilo-summary-loading-styles';
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
        .summary-loading-indicator .lottie-fallback {
          animation: none;
        }
      }
    `;
    document.head.appendChild(style);
  })();

window.addEventListener('online', () => {
  const jid = (editorRoot?.dataset.jobId || new URLSearchParams(location.search).get('jobId') || '').trim();
  if (jid) loadJob(jid);
});
function serializeSmart(){ return ''; }
window.AgiloEditors = { ...(window.AgiloEditors||{}), loadJob, serializeSmart };

  function openChatTab(){
    if (window.AgiloChat?.openConversation) { try{ window.AgiloChat.openConversation(); }catch{} }

    const tab  = document.querySelector('#tab-chat,[data-tab="chat"][role="tab"],button[aria-controls="pane-chat"]');
    const pane = byId('pane-chat');

    if (tab) {
      tab.removeAttribute('disabled');
      if (tab.getAttribute('aria-selected') !== 'true') {
        tab.dispatchEvent(new MouseEvent('click', { bubbles:true }));
      }
    }
    setTimeout(()=>{
      if (pane && (pane.hasAttribute('hidden') || !pane.classList.contains('is-active'))) {
        document.querySelectorAll('[role="tab"]').forEach(t=>{
          const isChat = t===tab || t.getAttribute('aria-controls')==='pane-chat' || t.dataset.tab==='chat';
          t.setAttribute('aria-selected', isChat ? 'true' : 'false');
          t.tabIndex = isChat ? 0 : -1;
        });
        document.querySelectorAll('.edtr-pane, .ag-panel').forEach(p=>{
          if (p.id==='pane-chat') { p.classList.add('is-active'); p.removeAttribute('hidden'); }
          else { p.classList.remove('is-active'); p.setAttribute('hidden',''); }
        });
      }
      const view = byId('chatView'); if (view) view.scrollTop = view.scrollHeight;
    }, 20);
  }
  function setupInsightShortcuts(){
    document.addEventListener('click', (e)=>{
      const btn = e.target.closest('button, a');
      if (!btn) return;
      const label = (btn.innerText || btn.textContent || '').toLowerCase().trim();
      const wantsChat =
           btn.dataset.open === 'conversation'
        || btn.dataset.action === 'open-conversation'
        || btn.dataset.action === 'open-chat'
        || /analyse[\s-]*émotionnelle|analyse[\s-]*emotion|émotion|emotion|question\s*ia/i.test(label)
        || /insight|emotion/i.test(btn.dataset.insight || '');

      if (wantsChat) openChatTab();
    }, { passive:true });
  }
});


