// Agilotext - Save Transcript (VERSION SIMPLE, SAUVEGARDE MANUELLE UNIQUEMENT)
// ⚠️ Ce fichier est chargé depuis GitHub
// Correspond à: code-save-transcript dans Webflow

(function(){
  'use strict';

  // Empêcher les doubles imports
  if (window.__agiloSave_MANUAL_SIMPLE) return;
  window.__agiloSave_MANUAL_SIMPLE = true;

  const API_BASE = 'https://api.agilotext.com/api/v1';
  const ENDPOINT = API_BASE + '/updateTranscriptFile';
  const READ_ENDPOINT = API_BASE + '/receiveTextJson';
  const TOKEN_GET = API_BASE + '/getToken';
  const VERSION   = 'save-manual-simple-v1.2-verified';
  const REQUEST_TIMEOUT_MS = 45000;

  const MIN_CONTENT_LENGTH = 10;  // min caractères pour considérer qu'il y a un transcript
  const MIN_SEGMENTS_COUNT = 1;   // min segments

  // ========= Petits helpers =========
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const sleep = (ms)=> new Promise(r => setTimeout(r, ms));

  function log(){
    if (window.agiloSaveDebug) {
      try { console.debug('[agilo:save]', ...arguments); } catch(e){}
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
    if (root.querySelector('.ag-alert, .ag-alert--warn')) {
      log('alerte affichée dans l\'éditeur — sauvegarde bloquée');
      return { ready:false, reason:'error_message_displayed' };
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
    const rows = Array.from(root.querySelectorAll(':scope > .ag-seg'));
    if (!rows.length){
      if (root.dataset.mode === 'structured' || (Array.isArray(window._segments) && window._segments.length > 1)) {
        throw new Error('Segments affichés absents : sauvegarde annulée.');
      }
      const plain = root.querySelector('.ag-plain');
      if (!plain) throw new Error('Transcript affiché incomplet : sauvegarde annulée.');
      return [{ id:'s0', startSec:0, endSec:0, speaker:'', text:visibleTextFromBox(plain), lang:document.documentElement.lang || '' }];
    }
    const ids = new Set();
    return rows.map((seg) => {
      const id = String(seg.dataset.id || '').trim();
      const startSec = Number(seg.dataset.start);
      const endSec = Number(seg.dataset.end);
      const box = seg.querySelector('.ag-seg__text');
      const speakerEl = seg.querySelector('.speaker');
      const speaker = String(seg.dataset.speaker || '').trim();
      const shownSpeaker = String(speakerEl?.textContent || '').trim();
      if (!id || ids.has(id) || !box || (root.dataset.mode === 'structured' && !speakerEl) || seg.dataset.start == null || seg.dataset.end == null ||
          !Number.isFinite(startSec) || !Number.isFinite(endSec) || startSec < 0 || endSec < startSec ||
          (speakerEl && !speakerEl.classList.contains('is-placeholder') && speaker !== shownSpeaker)) {
        throw new Error('Segment affiché incomplet ou incohérent : sauvegarde annulée.');
      }
      ids.add(id);
      return { id, startSec, endSec, speaker, text:visibleTextFromBox(box), lang:seg.getAttribute('lang') || '' };
    });
  }

  function buildSegments(){
    const root = getTranscriptRoot();
    if (!root) throw new Error('Transcript introuvable : sauvegarde annulée.');
    const fromDom = getSegmentsFromDom(root);
    if (!fromDom.length) throw new Error('Transcript vide : sauvegarde annulée.');
    const oldById = new Map((Array.isArray(window._segments) ? window._segments : []).map(s => [String(s.id), s]));
    window._segments = fromDom.map(s => ({
      ...oldById.get(s.id), id:s.id, start:s.startSec, end:s.endSec,
      speaker:s.speaker, text:s.text, lang:s.lang || oldById.get(s.id)?.lang || ''
    }));
    return fromDom;
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
      const milliStart = Number(s.startSec) * 1000;
      const milliEnd = Number(s.endSec) * 1000;
      if (!s.id || !Number.isSafeInteger(milliStart) || !Number.isSafeInteger(milliEnd) ||
          milliStart < 0 || milliEnd < milliStart) {
        throw new Error('ID ou horodatage invalide : sauvegarde annulée.');
      }
      return {
        id: String(s.id),
        milli_start: milliStart,
        milli_end:   milliEnd,
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

  function canonicalTranscript(dto){
    return JSON.stringify({
      jobId: String(dto?.job_meta?.jobId ?? ''),
      milli_duration: Number(dto?.job_meta?.milli_duration),
      speakerLabels: Boolean(dto?.job_meta?.speakerLabels),
      segments: (Array.isArray(dto?.segments) ? dto.segments : []).map((s) => ({
        id: String(s?.id ?? ''),
        milli_start: Number(s?.milli_start),
        milli_end: Number(s?.milli_end),
        speaker: String(s?.speaker ?? ''),
        text: String(s?.text ?? '').replace(/\r\n?/g, '\n').replace(/\u00A0/g, ' ')
      }))
    });
  }

  function hashText(value){
    let hash = 0x811c9dc5;
    const input = String(value || '');
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
  }

  function transcriptHash(dto){
    return hashText(canonicalTranscript(dto));
  }

  function sameTranscriptExact(left, right){
    return canonicalTranscript(left) === canonicalTranscript(right);
  }

  async function fetchWithTimeout(url, options, timeoutMs){
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, { ...(options || {}), signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
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
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: body.toString(),
      credentials: 'omit',
      cache: 'no-store'
    }, REQUEST_TIMEOUT_MS);
    const raw = await res.text();
    let j = null;
    try { j = JSON.parse(raw); } catch(e){}
    console.log('📥 Réponse API:', res.status, j || raw);
    if (!res.ok || !j || j.status !== 'OK'){
      throw new Error(j && j.errorMessage ? j.errorMessage : 'Erreur HTTP '+res.status);
    }
    if (j.jobId != null && String(j.jobId) !== String(creds.jobId)) {
      throw Object.assign(new Error('La réponse de sauvegarde concerne un autre dossier.'), { code:'job_mismatch' });
    }
    return { res, j, dto: tsJson };
  }

  async function readServerTranscript(creds){
    const url = `${READ_ENDPOINT}?username=${encodeURIComponent(creds.email)}&token=${encodeURIComponent(creds.token)}&jobId=${encodeURIComponent(creds.jobId)}&edition=${encodeURIComponent(creds.edition)}`;
    const res = await fetchWithTimeout(url, {
      method: 'GET', credentials: 'omit', cache: 'no-store'
    }, REQUEST_TIMEOUT_MS);
    const raw = await res.text();
    let dto = null;
    try { dto = JSON.parse(raw); } catch (_) {}
    if (!res.ok || !dto || dto.status === 'KO') {
      throw new Error(dto?.errorMessage || `Lecture de contrôle impossible (HTTP ${res.status})`);
    }
    return validateBackupDto(dto, creds.jobId);
  }

  async function verifyServerTranscript(creds, expected){
    let actual = null;
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        actual = await readServerTranscript(creds);
        if (sameTranscriptExact(actual, expected)) {
          return { dto: actual, payloadHash: transcriptHash(actual) };
        }
        lastError = Object.assign(new Error('Le serveur ne contient pas exactement les modifications envoyées.'), { code:'verification_mismatch' });
      } catch (error) {
        lastError = error;
      }
      if (attempt < 2) await sleep(250 * (attempt + 1));
    }
    throw lastError || Object.assign(new Error('Vérification serveur impossible.'), { code:'verification_failed' });
  }

  function validateBackupDto(dto, jobId) {
    if (!dto || typeof dto !== 'object' || Array.isArray(dto) ||
        String(dto.job_meta && dto.job_meta.jobId) !== String(jobId) ||
        !Array.isArray(dto.segments) || dto.segments.length === 0) {
      throw new Error('Sauvegarde de transcription invalide');
    }
    for (const segment of dto.segments) {
      if (!segment || typeof segment.id !== 'string' ||
          !Number.isSafeInteger(segment.milli_start) || segment.milli_start < 0 ||
          !Number.isSafeInteger(segment.milli_end) || segment.milli_end < segment.milli_start ||
          typeof segment.speaker !== 'string' || typeof segment.text !== 'string') {
        throw new Error('Segment de sauvegarde invalide');
      }
    }
    if (!dto.segments.some((segment) => String(segment.text || '').trim())) {
      throw new Error('Sauvegarde de transcription vide');
    }
    return dto;
  }

  async function postTranscriptDto(creds, dto) {
    const body = new URLSearchParams();
    body.append('username', creds.email);
    body.append('token', creds.token);
    body.append('jobId', String(creds.jobId));
    body.append('edition', creds.edition);
    body.append('transcriptContent', JSON.stringify(dto));
    const res = await fetchWithTimeout(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: body.toString(),
      credentials: 'omit',
      cache: 'no-store'
    }, REQUEST_TIMEOUT_MS);
    const raw = await res.text();
    let j = null;
    try { j = JSON.parse(raw); } catch (e) {}
    if (!res.ok || !j || j.status !== 'OK') {
      throw new Error(j && j.errorMessage ? j.errorMessage : 'Erreur HTTP ' + res.status);
    }
    if (j.jobId != null && String(j.jobId) !== String(creds.jobId)) {
      throw Object.assign(new Error('La réponse de sauvegarde concerne un autre dossier.'), { code:'job_mismatch' });
    }
    return { res, j, dto, ok: true };
  }

  function setSaveInProgress(value) {
    isSaving = Boolean(value);
    window.__agiloSaveInProgress = isSaving;
    window.dispatchEvent(new CustomEvent('agilo:transcript-save-busy', {
      detail: { jobId: String(pickJobId()), busy: isSaving }
    }));
  }

  function notifySaved(jobId, source, transcript, payloadHash, savedAt) {
    window.dispatchEvent(new CustomEvent('agilo:transcript-saved', {
      detail: { jobId: String(jobId), source, transcript, payloadHash, savedAt, verified: true }
    }));
  }

  function payloadFromSegments(creds, segments) {
    const tsJson = buildTranscriptStatusJson(segments, creds.jobId);
    return {
      creds,
      segments,
      transcript_status: tsJson,
      pick: { segmentsMs: tsJson.segments, text: tsJson.segments.map((s) => s.text).join('\n') }
    };
  }

  // ========= Sauvegarde manuelle uniquement =========
  let isSaving = false;
  let lastVerifiedHash = '';
  let lastVerifiedJobId = '';

  function announce(message){
    if (typeof window.toast === 'function') window.toast(message);
    else if (typeof window.showSuccessMessage === 'function') window.showSuccessMessage(message);
    else console.info('[agilo:save]', message);
  }

  function setButtonBusy(btn, busy){
    if (!btn) return;
    if (busy) {
      if (btn.__agiloWasDisabled == null) btn.__agiloWasDisabled = Boolean(btn.disabled);
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
    } else {
      btn.disabled = Boolean(btn.__agiloWasDisabled);
      delete btn.__agiloWasDisabled;
      btn.removeAttribute('aria-busy');
    }
  }

  function getActiveTabId(){
    const tab = document.querySelector('[role="tab"][aria-selected="true"]');
    return tab ? tab.id || '' : '';
  }

  async function doSave(btn, options){
    options = options || {};
    if (window.__agiloTranscriptHistoryRestoring && !options.history) {
      return { ok:false, reason:'restore_in_progress' };
    }
    if (isSaving) {
      log('save déjà en cours, ignoré');
      const msg = 'Sauvegarde déjà en cours, veuillez patienter.';
      announce(msg);
      return { ok:false, reason:'already_saving', error:msg, verified:false };
    }
    setSaveInProgress(true);

    const originalText = btn ? (btn.textContent || '').trim() : '';
    if (btn && !btn.__idleText) btn.__idleText = originalText || 'Sauvegarder';
    if (btn) btn.textContent = 'Sauvegarde en cours…';
    setButtonBusy(btn, true);

    let expectedDto = null;
    let payloadHash = '';
    let verified = null;
    let recoveredAfterError = false;

    try{
      // 1) Vérifier qu'on est bien sur l'onglet Transcription (si tablist présente)
      const activeTabId = getActiveTabId();
      if (activeTabId && activeTabId !== 'tab-transcript'){
        const tabName =
          activeTabId === 'tab-summary' ? 'Compte-rendu' :
          activeTabId === 'tab-chat'    ? 'Conversation' :
          activeTabId;
        const msg = `La sauvegarde ne peut se faire que depuis l'onglet "Transcription". Onglet actuel : "${tabName}".`;
        console.warn('[agilo:save] tentative de sauvegarde hors onglet transcript', activeTabId);
        if (btn) btn.textContent = btn.__idleText;
        if (window.toast) window.toast(msg);
        else alert(msg);
        return { ok:false, reason:'wrong_tab', error:msg };
      }

      // 2) Vérifier que le transcript est chargé
      const ready = await waitTranscriptReady();
      if (!ready.ready){
        const msg = 'Transcript non prêt ou vide. Attendez la fin du chargement avant de sauvegarder.';
        console.warn('[agilo:save] transcript pas prêt', ready);
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
        console.warn('[agilo:save] transcript vide', { segments:segments.length, len: totalText.length });
        if (btn) btn.textContent = btn.__idleText;
        if (window.toast) window.toast(msg);
        else alert(msg);
        return { ok:false, reason:'empty', error:msg };
      }

      // 4) Credentials
      const creds = await ensureCreds();
      if (!creds.email || !creds.token || !creds.jobId){
        const msg = 'Contexte incomplet (email/token/jobId manquants).';
        console.error('[agilo:save] credentials manquants', creds);
        if (btn) btn.textContent = btn.__idleText;
        if (window.toast) window.toast(msg);
        else alert(msg);
        return { ok:false, reason:'no_creds', error:msg };
      }

      if (String(pickJobId()) !== String(creds.jobId)) {
        throw Object.assign(new Error('Le dossier affiché a changé avant la sauvegarde.'), { code:'job_changed' });
      }

      // 5) Envoi
      expectedDto = buildTranscriptStatusJson(segments, creds.jobId);
      payloadHash = transcriptHash(expectedDto);
      let response;
      try {
        response = await postTranscript(creds, segments);
      } catch (postError) {
        try {
          verified = await verifyServerTranscript(creds, expectedDto);
          recoveredAfterError = true;
        } catch (_) {
          throw postError;
        }
      }
      if (!verified) verified = await verifyServerTranscript(creds, expectedDto);
      if (String(pickJobId()) !== String(creds.jobId)) {
        throw Object.assign(new Error('La sauvegarde a abouti, mais un autre dossier est maintenant affiché.'), { code:'job_changed_after_save' });
      }
      const savedAt = new Date().toISOString();
      lastVerifiedHash = verified.payloadHash;
      lastVerifiedJobId = String(creds.jobId);
      console.log('[agilo:save] ✅ sauvegarde vérifiée', response?.res?.status || 200, { jobId:creds.jobId, payloadHash });
      notifySaved(creds.jobId, options.history ? 'history-presave' : (btn ? 'manual' : 'requested'), verified.dto, payloadHash, savedAt);

      let historyRefresh = { ok:true };
      if (typeof window.agiloWaitForTranscriptHistory === 'function') {
        try { await window.agiloWaitForTranscriptHistory(); }
        catch (historyError) {
          historyRefresh = { ok:false, error:String(historyError?.message || historyError) };
          announce('Sauvegarde effectuée, historique temporairement indisponible. Réessayez.');
        }
      }

      let dirtyAfterSave = false;
      try {
        const currentDto = buildTranscriptStatusJson(buildSegments(), creds.jobId);
        dirtyAfterSave = transcriptHash(currentDto) !== payloadHash;
      } catch (_) { dirtyAfterSave = true; }

      if (btn) {
        btn.textContent = dirtyAfterSave ? 'Modifications à sauvegarder' : 'Sauvegardé ✓';
        setTimeout(() => {
          if (!isSaving) btn.textContent = btn.__idleText;
        }, 2000);
      }
      if (btn) announce(recoveredAfterError ? 'Modification enregistrée et vérifiée après une interruption réseau.' : 'Modification sauvegardée et vérifiée.');
      return {
        ok:true,
        jobId:String(creds.jobId),
        segmentCount:verified.dto.segments.length,
        payloadHash,
        savedAt,
        verified:true,
        dirtyAfterSave,
        recoveredAfterError,
        historyRefresh,
        status:response?.res?.status || 200,
        data:response?.j || null,
        dto:verified.dto
      };

    }catch(e){
      console.error('[agilo:save] ❌ erreur sauvegarde', e);
      if (btn) btn.textContent = btn.__idleText || 'Sauvegarder';
      const msg = 'Erreur pendant la sauvegarde: ' + (e && e.message ? e.message : e);
      if (window.toast) window.toast(msg);
      else alert(msg);
      return { ok:false, reason:e?.code || 'save_failed', error:e && e.message ? e.message : String(e), verified:false };
    } finally{
      setButtonBusy(btn, false);
      setSaveInProgress(false);
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
      console.warn('[agilo:save] bouton "Sauvegarder" introuvable');
    }

    // Raccourci clavier Cmd/Ctrl + S
    document.addEventListener('keydown', (e)=>{
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && String(e.key).toLowerCase() === 's'){
        e.preventDefault();
        e.stopImmediatePropagation();
        const b = findSaveButton();
        doSave(b || null);
      }
    }, true);

    // Exposer quelques helpers globaux pour debug / intégration
    window.agiloSaveNow = function(){
      const b = findSaveButton();
      return doSave(b || null);
    };

    window.addEventListener('agilo:transcript-loaded', (event) => {
      const detail = event?.detail || {};
      try {
        const dto = validateBackupDto(detail.transcript, detail.jobId);
        lastVerifiedHash = transcriptHash(dto);
        lastVerifiedJobId = String(detail.jobId);
      } catch (_) {
        lastVerifiedHash = '';
        lastVerifiedJobId = '';
      }
    });

    const loaded = window.__agiloLastLoadedTranscript;
    if (loaded) {
      try {
        lastVerifiedHash = transcriptHash(validateBackupDto(loaded.transcript, loaded.jobId));
        lastVerifiedJobId = String(loaded.jobId);
      } catch (_) {}
    }

    window.addEventListener('beforeunload', (event) => {
      let dirty = isSaving;
      try {
        const jobId = String(pickJobId());
        if (!dirty && lastVerifiedHash && lastVerifiedJobId === jobId) {
          dirty = transcriptHash(buildTranscriptStatusJson(buildSegments(), jobId)) !== lastVerifiedHash;
        }
      } catch (_) {}
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    });

    window.agiloGetPayload = async function(){
      const creds    = await ensureCreds();
      const segments = buildSegments();
      return payloadFromSegments(creds, segments);
    };

    window.agiloSaveCurrentForHistory = function(){
      return doSave(null, { history: true });
    };

    window.agiloPostTranscriptFromBackupJson = async function(dto){
      const creds = await ensureCreds();
      const valid = validateBackupDto(dto, creds.jobId);
      const result = await postTranscriptDto(creds, valid);
      notifySaved(creds.jobId, 'history-restore', valid);
      return { ok: true, status: result.res.status, data: result.j, dto: valid };
    };

    window.agiloFinishTranscriptRestore = async function(jobId){
      try { localStorage.removeItem('agilo:draft:' + String(jobId || pickJobId())); } catch (e) {}
      return true;
    };

    window.__agiloSaveHelpers = {
      validateBackupDto, payloadFromSegments, canonicalTranscript, transcriptHash,
      sameTranscriptExact, verifyServerTranscript
    };

    window.agiloGetState = function(){
      const edition = pickEdition();
      const email   = pickEmail();
      const token   = pickToken(edition, email);
      const jobId   = pickJobId();
      return { edition, jobId, email, hasToken: !!token };
    };

    console.info('[agilo:save] ✅ init OK ('+VERSION+') — sauvegarde manuelle vérifiée (bouton ou Cmd/Ctrl+S, avertissement avant fermeture si nécessaire).');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }

})();
