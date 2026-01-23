// Agilotext - Save Transcript (VERSION SIMPLE, SAUVEGARDE MANUELLE UNIQUEMENT)
// ⚠️ Ce fichier est chargé depuis GitHub
// Correspond à: code-save-transcript dans Webflow
// ✅ STAGING : Version simplifiée - Sauvegarde manuelle uniquement (pas d'auto-save, pas de brouillon)

(function(){

  'use strict';

  // Empêcher les doubles imports
  if (window.__agiloSave_MANUAL_SIMPLE_STAGING) {
    console.warn('[agilo:save:SIMPLE-STAGING] ⚠️ Script déjà chargé (identifiant présent)');
    return;
  }
  console.log('[agilo:save:SIMPLE-STAGING] 🚀 Initialisation du script SIMPLE STAGING...');
  window.__agiloSave_MANUAL_SIMPLE_STAGING = true;

  const API_BASE = 'https://api.agilotext.com/api/v1';
  const ENDPOINT = API_BASE + '/updateTranscriptFile';
  const TOKEN_GET = API_BASE + '/getToken';
  const VERSION   = 'save-manual-simple-staging-v1';

  const MIN_CONTENT_LENGTH = 10;  // min caractères pour considérer qu'il y a un transcript
  const MIN_SEGMENTS_COUNT = 1;   // min segments

  // ========= Petits helpers =========

  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const sleep = (ms)=> new Promise(r => setTimeout(r, ms));

  function log(){
    if (window.agiloSaveDebug) {
      try { console.debug('[agilo:save:SIMPLE-STAGING]', ...arguments); } catch(e){}
    }
  }

  // visibleTextFromBox (fallback si non présent dans main-editor)
  const visibleTextFromBox = window.visibleTextFromBox || function(box){
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

  // ========= Time helpers =========

  function toSec(x){
    if (x == null) return 0;
    if (typeof x === 'number' && Number.isFinite(x)) return x|0;
    const s = String(x).trim();
    if (/^\d+$/.test(s)) return parseInt(s,10);
    const m = s.replace(/^\[|\]$/g,'').split(':').map(n => parseInt(n,10));
    if (m.some(Number.isNaN)) return 0;
    return m.length === 3 ? m[0]*3600 + m[1]*60 + m[2] : (m[0]*60 + m[1]);
  }

  function fmtTime(sec){
    sec = Math.max(0, Math.floor(Number(sec)||0));
    const h = Math.floor(sec/3600);
    const m = Math.floor((sec%3600)/60);
    const s = sec%60;
    const HH = String(h).padStart(2,'0');
    const MM = String(m).padStart(2,'0');
    const SS = String(s).padStart(2,'0');
    return h ? `${HH}:${MM}:${SS}` : `${MM}:${SS}`;
  }

  // ========= Récupération du transcript =========

  function getTranscriptRoot(){
    return document.getElementById('transcriptEditor')
        || document.getElementById('ag-transcript')
        || document.querySelector('[data-editor="transcript"]')
        || null;
  }

  async function waitTranscriptReady(maxWaitMs = 2000){
    const root = getTranscriptRoot();
    if (!root) {
      log('transcriptEditor non trouvé');
      return { ready:false, reason:'no_root' };
    }

    const step = 200;
    const maxTries = Math.ceil(maxWaitMs / step);

    for (let i=0;i<maxTries;i++){
      const segs = $$('.ag-seg', root);
      const text = (root.innerText || root.textContent || '').trim();
      const hasLoader = root.querySelector('.ag-loader,[data-loading="true"]');

      if ((segs.length >= MIN_SEGMENTS_COUNT || text.length >= MIN_CONTENT_LENGTH) && !hasLoader){
        return { ready:true };
      }

      if (i < maxTries-1) await sleep(step);
    }

    return { ready:false, reason:'empty_or_loading' };
  }

  function getSegmentsFromModel(){
    const src =
      (Array.isArray(window._segments) && window._segments.length && window._segments) ||
      (window.AgiloEditors && Array.isArray(window.AgiloEditors.segments) && window.AgiloEditors.segments.length && window.AgiloEditors.segments) ||
      null;

    if (!src) return null;

    return src.map((s, i) => {
      const startSec = toSec(s.start ?? s.startSec ?? 0);
      const endSec   = (s.end != null) ? toSec(s.end) : (s.endSec != null ? toSec(s.endSec) : 0);
      return {
        id: s.id || `s${i}`,
        startSec: startSec,
        endSec:   endSec || 0,
        speaker:  String(s.speaker || '').trim(),
        text:     String(s.text || '').replace(/\r\n?/g,'\n').replace(/\u00A0/g,' '),
        lang:     s.lang || ''
      };
    });
  }

  function getSegmentsFromDom(root){
    const rows = $$('.ag-seg,[data-seg],.segment,.ag-segment', root);
    if (!rows.length){
      const txt = (root.innerText || root.textContent || '').trim();
      if (!txt) return [];
      return [{
        id: 's0',
        startSec: 0,
        endSec: 0,
        speaker: '',
        text: txt,
        lang: document.documentElement.lang || ''
      }];
    }

    const out = [];
    rows.forEach((seg,i)=>{
      const tBtn   = seg.querySelector('header .time,.time,[data-t]');
      const stAttr = seg.dataset.start ?? seg.getAttribute('data-start') ?? (tBtn && (tBtn.dataset.t || tBtn.textContent)) || '0';
      const enAttr = seg.dataset.end   ?? seg.getAttribute('data-end')   ?? '';
      const startSec = toSec(stAttr);
      const endSec   = toSec(enAttr);
      const spk = (seg.dataset.speaker || (seg.querySelector('header .speaker,.speaker') || {}).textContent || '').trim();
      const box = seg.querySelector('.ag-seg__text,.text,[data-text]') || seg;
      const text = visibleTextFromBox(box);

      out.push({
        id: `s${i}`,
        startSec,
        endSec,
        speaker: spk,
        text,
        lang: seg.getAttribute('lang') || ''
      });
    });

    // Compléter les endSec manquants
    for (let i=0;i<out.length;i++){
      if (!out[i].endSec){
        if (out[i+1]) out[i].endSec = Math.max(out[i].startSec || 0, out[i+1].startSec || 0);
        else out[i].endSec = (out[i].startSec || 0) + Math.max(1, Math.round((out[i].text||'').length/15));
      }
    }

    return out;
  }

  function buildSegments(){
    const root = getTranscriptRoot();
    if (!root) return [];

    const fromModel = getSegmentsFromModel();
    const segs = (fromModel && fromModel.length) ? fromModel : getSegmentsFromDom(root);

    return segs.filter(s => s && String(s.text||'').trim().length);
  }

  // ========= Credentials =========

  function normalizeEdition(v){
    v = String(v||'').trim().toLowerCase();
    if (/(^ent$|enterprise|entreprise|business|team|biz)/.test(v)) return 'ent';
    if (/^pro/.test(v)) return 'pro';
    if (/^free|gratuit/.test(v)) return 'free';
    return 'ent';
  }

  function pickEdition(){
    const root = document.getElementById('editorRoot');
    const qs   = new URLSearchParams(location.search).get('edition');
    const html = document.documentElement.getAttribute('data-edition');
    const ls   = localStorage.getItem('agilo:edition');
    return normalizeEdition(qs || (root && root.dataset.edition) || html || ls || 'ent');
  }

  function pickJobId(){
    const u    = new URL(location.href);
    const root = document.getElementById('editorRoot');
    return (u.searchParams.get('jobId')
         || (root && root.dataset.jobId)
         || (window.__agiloOrchestrator && window.__agiloOrchestrator.currentJobId)
         || (document.querySelector('.rail-item.is-active') && document.querySelector('.rail-item.is-active').dataset.jobId)
         || '');
  }

  function pickEmail(){
    const root = document.getElementById('editorRoot');
    return (root && root.dataset.username)
        || (document.querySelector('[name="memberEmail"]') && document.querySelector('[name="memberEmail"]').value)
        || window.memberEmail
        || (window.__agiloOrchestrator && window.__agiloOrchestrator.credentials && window.__agiloOrchestrator.credentials.email)
        || localStorage.getItem('agilo:username')
        || (document.querySelector('[data-ms-member="email"]') && document.querySelector('[data-ms-member="email"]').textContent)
        || '';
  }

  function pickToken(edition,email){
    const root = document.getElementById('editorRoot');
    const k    = `agilo:token:${edition}:${String(email||'').toLowerCase()}`;
    return (root && root.dataset.token)
        || (window.__agiloOrchestrator && window.__agiloOrchestrator.credentials && window.__agiloOrchestrator.credentials.token)
        || window.globalToken
        || localStorage.getItem(k)
        || localStorage.getItem(`agilo:token:${edition}`)
        || localStorage.getItem('agilo:token')
        || '';
  }

  async function ensureToken(email, edition){
    const have = pickToken(edition, email);
    if (have) return have;

    if (typeof window.getToken === 'function' && email){
      try{ window.getToken(email, edition); }catch(e){}
      for (let i=0;i<80;i++){
        const t = pickToken(edition, email);
        if (t) return t;
        await sleep(100);
      }
    }

    if (email){
      try{
        const url = `${TOKEN_GET}?username=${encodeURIComponent(email)}&edition=${encodeURIComponent(edition)}`;
        const r   = await fetch(url, { method:'GET', credentials:'omit', cache:'no-store' });
        const j   = await r.json().catch(()=>null);
        if (r.ok && j && j.status === 'OK' && j.token){
          try{
            localStorage.setItem(`agilo:token:${edition}:${email.toLowerCase()}`, j.token);
            localStorage.setItem('agilo:username', email);
            localStorage.setItem('agilo:edition', edition);
          }catch(e){}
          window.globalToken = j.token;
          return j.token;
        }
      }catch(e){}
    }

    return '';
  }

  async function ensureCreds(){
    const edition = pickEdition();
    let email     = pickEmail();
    for (let i=0;i<20 && !email;i++){ await sleep(100); email = pickEmail(); }
    const token   = await ensureToken(email, edition);
    let jobId     = pickJobId();
    for (let i=0;i<10 && !jobId;i++){ await sleep(60); jobId = pickJobId(); }

    const creds = {
      email: (email||'').trim(),
      token: (token||'').trim(),
      edition,
      jobId: String(jobId||'').trim()
    };

    log('creds', { email:creds.email, edition:creds.edition, jobId:creds.jobId, hasToken:!!creds.token });
    return creds;
  }

  // ========= Construction du JSON transcript_status =========

  function buildTranscriptStatusJson(segments, jobId){
    const segMs = segments.map((s, i) => {
      const startSec = Math.max(0, s.startSec|0);
      const endSec   = Math.max(startSec, s.endSec|0);
      return {
        id: String(s.id || `s${i}`),
        milli_start: startSec * 1000,
        milli_end:   endSec   * 1000,
        speaker: String(s.speaker || ''),
        text: String(s.text || '')
      };
    });

    const milli_duration = segMs.reduce((m, s) => {
      const end = s.milli_end || s.milli_start || 0;
      return Math.max(m, end);
    }, 0);

    const speakerLabels = segMs.some(s => {
      const sp = String(s.speaker || '').trim();
      return sp && sp !== 'Speaker_A';
    });

    const jobIdNum = /^\d+$/.test(String(jobId||'')) ? parseInt(String(jobId),10) : 0;

    return {
      job_meta: {
        jobId: jobIdNum,
        milli_duration: Math.max(0, milli_duration),
        speakerLabels: Boolean(speakerLabels)
      },
      segments: segMs
    };
  }

  async function postTranscript(creds, segments){
    const tsJson = buildTranscriptStatusJson(segments, creds.jobId);

    if (window.agiloSaveDebug){
      console.log('✅ JSON transcript_status:', JSON.stringify(tsJson, null, 2));
    } else {
      console.log('✅ JSON transcript_status:', `{jobId: ${tsJson.job_meta.jobId}, segments: ${tsJson.segments.length}, duration: ${tsJson.job_meta.milli_duration}ms}`);
    }

    const body = new URLSearchParams();
    body.append('username', creds.email);
    body.append('token',    creds.token);
    body.append('jobId',    String(creds.jobId));
    body.append('edition',  creds.edition);
    body.append('transcriptContent', JSON.stringify(tsJson));

    const url = `${ENDPOINT}?username=${encodeURIComponent(creds.email)}&token=${encodeURIComponent(creds.token)}&jobId=${encodeURIComponent(creds.jobId)}&edition=${encodeURIComponent(creds.edition)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: body.toString(),
      credentials: 'omit',
      cache: 'no-store'
    });

    const raw = await res.text();
    let j = null;
    try { j = JSON.parse(raw); } catch(e){}

    console.log('📥 Réponse API:', res.status, j || raw);

    if (!res.ok || !j || j.status !== 'OK'){
      throw new Error(j && j.errorMessage ? j.errorMessage : 'Erreur HTTP '+res.status);
    }

    return { res, j };
  }

  // ========= Sauvegarde manuelle uniquement =========

  let isSaving = false;

  function getActiveTabId(){
    const tab = document.querySelector('[role="tab"][aria-selected="true"]');
    return tab ? tab.id || '' : '';
  }

  async function doSave(btn){
    if (isSaving) {
      log('save déjà en cours, ignoré');
      return { ok:false, reason:'already_saving' };
    }

    isSaving = true;

    const originalText = btn ? (btn.textContent || '').trim() : '';
    if (btn && !btn.__idleText) btn.__idleText = originalText || 'Sauvegarder';
    if (btn) btn.textContent = 'Sauvegarde…';

    try{
      // 1) Vérifier qu'on est bien sur l'onglet Transcription (si tablist présente)
      const activeTabId = getActiveTabId();
      if (activeTabId && activeTabId !== 'tab-transcript'){
        const tabName =
          activeTabId === 'tab-summary' ? 'Compte-rendu' :
          activeTabId === 'tab-chat'    ? 'Conversation' :
          activeTabId;
        const msg = `La sauvegarde ne peut se faire que depuis l'onglet "Transcription". Onglet actuel : "${tabName}".`;
        console.warn('[agilo:save:SIMPLE-STAGING] tentative de sauvegarde hors onglet transcript', activeTabId);
        if (btn) btn.textContent = btn.__idleText;
        if (window.toast) window.toast(msg);
        else alert(msg);
        return { ok:false, reason:'wrong_tab', error:msg };
      }

      // 2) Vérifier que le transcript est chargé
      const ready = await waitTranscriptReady();
      if (!ready.ready){
        const msg = 'Transcript non prêt ou vide. Attendez la fin du chargement avant de sauvegarder.';
        console.warn('[agilo:save:SIMPLE-STAGING] transcript pas prêt', ready);
        if (btn) btn.textContent = btn.__idleText;
        if (window.toast) window.toast(msg);
        else alert(msg);
        return { ok:false, reason:ready.reason || 'not_ready', error:msg };
      }

      // 3) Construire les segments
      const segments = buildSegments();
      const totalText = segments.map(s=>s.text).join('\n').trim();

      if (!segments.length || totalText.length < MIN_CONTENT_LENGTH){
        const msg = 'Rien à sauvegarder (transcript vide ou trop court).';
        console.warn('[agilo:save:SIMPLE-STAGING] transcript vide', { segments:segments.length, len: totalText.length });
        if (btn) btn.textContent = btn.__idleText;
        if (window.toast) window.toast(msg);
        else alert(msg);
        return { ok:false, reason:'empty', error:msg };
      }

      // 4) Credentials
      const creds = await ensureCreds();
      if (!creds.email || !creds.token || !creds.jobId){
        const msg = 'Contexte incomplet (email/token/jobId manquants).';
        console.error('[agilo:save:SIMPLE-STAGING] credentials manquants', creds);
        if (btn) btn.textContent = btn.__idleText;
        if (window.toast) window.toast(msg);
        else alert(msg);
        return { ok:false, reason:'no_creds', error:msg };
      }

      // 5) Envoi
      const { res, j } = await postTranscript(creds, segments);

      console.log('[agilo:save:SIMPLE-STAGING] ✅ sauvegarde OK', res.status, j);

      if (btn) {
        btn.textContent = 'Sauvegardé ✓';
        setTimeout(() => {
          btn.textContent = btn.__idleText;
        }, 2000);
      }

      if (window.toast) window.toast('Modification sauvegardée.');
      return { ok:true, status:res.status, data:j };

    }catch(e){
      console.error('[agilo:save:SIMPLE-STAGING] ❌ erreur sauvegarde', e);
      if (btn) btn.textContent = btn.__idleText || 'Sauvegarder';
      const msg = 'Erreur pendant la sauvegarde: ' + (e && e.message ? e.message : e);
      if (window.toast) window.toast(msg);
      else alert(msg);
      return { ok:false, error:e && e.message ? e.message : String(e) };
    } finally{
      isSaving = false;
    }
  }

  // ========= Wiring UI =========

  function findSaveButton(){
    return document.querySelector('[data-action="save-transcript"]')
        || document.querySelector('button.button.save[data-opentech-ux-zone-id]')
        || document.querySelector('button.button.save');
  }

  function init(){
    const btn = findSaveButton();

    if (btn){
      btn.addEventListener('click', (e)=>{
        e.preventDefault();
        doSave(btn);
      });
    } else {
      console.warn('[agilo:save:SIMPLE-STAGING] bouton "Sauvegarder" introuvable');
    }

    // Raccourci clavier Cmd/Ctrl + S
    window.addEventListener('keydown', (e)=>{
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && String(e.key).toLowerCase() === 's'){
        e.preventDefault();
        const b = findSaveButton();
        doSave(b || null);
      }
    });

    // Exposer quelques helpers globaux pour debug / intégration
    window.agiloSaveNow = function(){
      const b = findSaveButton();
      return doSave(b || null);
    };

    window.agiloGetPayload = async function(){
      const creds    = await ensureCreds();
      const segments = buildSegments();
      const tsJson   = buildTranscriptStatusJson(segments, creds.jobId);
      return { creds, segments, transcript_status: tsJson };
    };

    window.agiloGetState = function(){
      const edition = pickEdition();
      const email   = pickEmail();
      const token   = pickToken(edition, email);
      const jobId   = pickJobId();
      return { edition, jobId, email, hasToken: !!token };
    };

    console.info('[agilo:save:SIMPLE-STAGING] ✅ init OK ('+VERSION+') — sauvegarde MANUELLE UNIQUEMENT (bouton ou Cmd/Ctrl+S, aucun auto-save, aucun beforeunload, aucun brouillon local).');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }

})();




