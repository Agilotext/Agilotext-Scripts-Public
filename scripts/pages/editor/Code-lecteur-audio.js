// Agilotext - Lecteur Audio
// ⚠️ Ce fichier est chargé depuis GitHub
// Correspond à: code-lecteur-audio dans Webflow

(function () {
  if (window.__agiloAudioLite) return;
  window.__agiloAudioLite = '3.3-persist-speed-fixed';

  // ---------- Refs DOM (déclarées globalement, assignées plus tard) ----------
  let wrap, audio, playBtn, backBtn, fwdBtn, speedBtn;
  let timeEl, currentVisEl, remainingVisEl; // ⟵ IMPORTANT: visibles + a11y
  let volRange, track, prog, buff, thumb, hoverTip;
  let overlay; // créé après que 'wrap' existe

  // ---------- Params ----------
  const qs = new URLSearchParams(location.search);
  const autoplayParam = qs.get('autoplay') === '1';
  const DEBUG = qs.get('debugAudio') === '1' || window.AGILO_DEBUG;
  const log = (...a) => { if (DEBUG) console.log('[agilo:audio]', ...a); };

  const SPEED_STEPS = [0.75, 1, 1.25, 1.5, 1.75, 2];
  let edition = 'ent';
  let RATE_KEY = `agilo:rate:${edition}`;
  const VOL_KEY  = `agilo:vol`;

  let activeJobId = '';
  let POS_KEY     = '';
  let wasPlaying  = false;
  let lastBlobUrl = '';
  let seekLocked  = true;
  let isScrubbing = false;

  // ---------- Cleanup ----------
  let cleanupListeners = [];
  function addCleanup(fn) { cleanupListeners.push(fn); }
  window.addEventListener('beforeunload', () => {
    cleanupListeners.forEach(fn => { try { fn(); } catch {} });
    cleanupListeners = [];
  });

  // ---------- Helpers ----------
  function normalizeEdition(v){
    v = String(v||'').trim().toLowerCase();
    if (/(^ent$|enterprise|entreprise|business|team|biz)/.test(v)) return 'ent';
    if (/^pro/.test(v)) return 'pro';
    if (/^free|gratuit/.test(v)) return 'free';
    return 'ent';
  }

  function fmt(s){
    if (!isFinite(s) || s<0) s=0;
    const h=(s/3600)|0, m=((s%3600)/60)|0, sec=(s%60)|0;
    const mm = h? String(m).padStart(2,'0') : String(m);
    const ss = String(sec).padStart(2,'0');
    return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
  }
  function getSafeDuration(){
    const d1 = Number.isFinite(audio?.duration) ? audio.duration : 0;
    if (d1>0 && d1<1e6) return d1;
    try { const len = audio?.seekable?.length||0; if (len){ const end = audio.seekable.end(len-1); if (isFinite(end)&&end>0) return end; } } catch {}
    return 0;
  }
  function getSavedRate(){
    const r = parseFloat(localStorage.getItem(RATE_KEY));
    return (Number.isFinite(r) && r > 0) ? r : 1;
  }
  function setRate(r, {fromStep=false}={}){
    if (!audio) return;
    let val = r;
    if (fromStep){
      const cur = audio.playbackRate || 1;
      const idx = SPEED_STEPS.findIndex(v => v >= cur - 1e-6);
      val = SPEED_STEPS[(idx+1) % SPEED_STEPS.length];
    }
    val = Math.max(.5, Math.min(3, +(+val).toFixed(2)));
    audio.playbackRate = val;
    if (speedBtn) speedBtn.textContent = `${val.toFixed(2).replace(/\.00$|0$/,'')}x`;
    try { localStorage.setItem(RATE_KEY, String(val)); } catch {}
  }
  function lockControls(lock){
    seekLocked = !!lock;
    [playBtn, backBtn, fwdBtn, speedBtn, volRange].forEach(el => { if (el) el.disabled = lock; });
    if (wrap) wrap.classList.toggle('is-locked', !!lock);
  }

  // ---------- Overlay local ----------
  function makeLocalOverlay() {
    let ov = wrap.querySelector('.agilo-preload');
    if (!ov) {
      ov = document.createElement('div');
      ov.className = 'agilo-preload';
      ov.innerHTML = `
        <div class="agilo-preload__card" role="status" aria-live="polite">
          <div class="agilo-preload__title">Préchargement audio…</div>
          <div class="agilo-preload__bar" aria-hidden="true">
            <div class="agilo-preload__bar-fill"></div>
          </div>
          <div class="agilo-preload__txt">0%</div>
        </div>`;
      wrap.appendChild(ov);
    }
    const fill = ov.querySelector('.agilo-preload__bar-fill');
    const txt  = ov.querySelector('.agilo-preload__txt');
    return {
      show(){ ov.classList.add('is-visible'); wrap.classList.add('is-locked'); lockControls(true); },
      hide(){ ov.classList.remove('is-visible','is-indeterminate'); wrap.classList.remove('is-locked'); lockControls(false); },
      set(pct, ind){
        if (ind){ ov.classList.add('is-indeterminate'); txt.textContent = '…'; }
        else { ov.classList.remove('is-indeterminate'); const v = Math.max(0, Math.min(100, Math.round(pct*100))); fill.style.width = v+'%'; txt.textContent = v+'%'; }
      }
    };
  }

  // ---------- UI sync ----------
  function syncBuffered(){
    if (!buff || !audio) return;
    try{
      const dur = getSafeDuration();
      if (dur<=0){ buff.style.width = '0%'; return; }
      const len = audio.buffered.length; if (!len){ buff.style.width='0%'; return; }
      const end = audio.buffered.end(len-1);
      buff.style.width = `${Math.min(100,(end/dur)*100)}%`;
    }catch{ buff.style.width='0%'; }
  }
  function syncTime(){
    if (!audio) return;
    const cur = audio.currentTime || 0;
    const dur = getSafeDuration();

    // a11y caché
    if (timeEl){
      const txt = `${fmt(cur)} / ${dur ? fmt(dur) : '0:00'} `;
      timeEl.firstChild ? (timeEl.firstChild.nodeValue = txt) : (timeEl.textContent = txt);
    }

    // visibles
    if (currentVisEl)   currentVisEl.textContent   = fmt(cur);
    if (remainingVisEl) remainingVisEl.textContent = '–' + fmt(Math.max(0, dur - cur));

    if (!isScrubbing && dur>0 && prog) prog.style.width = `${(cur/dur)*100}%`;
    if (thumb && dur>0) thumb.style.left = `${(cur/dur)*100}%`;
  }

  function updatePlayUI(){
    if (!audio) return;
    const playing = !audio.paused && !audio.ended;
    if (playBtn){
      playBtn.textContent = playing ? '⏸︎ Pause' : '▶︎ Lire';
      playBtn.setAttribute('aria-pressed', String(playing));
      playBtn.dataset.state = playing ? 'playing' : 'paused';
    }
  }

  // ---------- Auth ----------
  async function ensureEmail(){
    const el = document.querySelector('[name="memberEmail"]');
    const fromAttr = el?.getAttribute?.('value') || '';
    const fromText = document.querySelector('[data-ms-member="email"]')?.textContent || '';
    const now = (el?.value || fromAttr || fromText || window.memberEmail || '').trim();
    if (now) return now;
    if (window.$memberstackDom?.getMember){
      try { const r = await window.$memberstackDom.getMember(); return (r?.data?.email||'').trim(); } catch {}
    }
    return '';
  }
  async function ensureToken(email){
    if (window.globalToken) return window.globalToken;
    if (typeof window.getToken === 'function' && email){ try { window.getToken(email, edition); } catch {} }
    for (let i=0;i<200;i++){ if (window.globalToken) return window.globalToken; await new Promise(r=>setTimeout(r,100)); }
    try{
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30000);
      const r = await fetch(`https://api.agilotext.com/api/v1/getToken?username=${encodeURIComponent(email)}&edition=${encodeURIComponent(edition)}`, { signal: ctrl.signal });
      clearTimeout(timer);
      const j = await r.json();
      if (j?.status==='OK' && j.token){ window.globalToken=j.token; return j.token; }
    }catch(e){ log('getToken fallback error', e); }
    return '';
  }
  function buildSrc(email, token, id=activeJobId){
    const u = new URL('https://api.agilotext.com/api/v1/receiveAudio');
    u.searchParams.set('jobId', id);
    u.searchParams.set('username', email);
    u.searchParams.set('token', token);
    u.searchParams.set('edition', edition);
    return u.toString();
  }
// === PATCH anti courses : annulation propre des chargements en vol ===
let __agiloLoadSeq = 0;         // id de chargement courant

function newAbortCtrl(){
  const ctrl = (typeof AbortController!=='undefined') ? new AbortController() : null;
  return ctrl?.signal;
}


// quand le rail annonce un changement imminent → marquer obsolète et relâcher l'UI
window.addEventListener('agilo:beforeload', ()=>{
  __agiloLoadSeq++;             // invalide toute promesse en cours (les résultats seront ignorés)
  try { audio?.pause(); } catch {}
  // ⚠️ Ne pas reset src / ne pas audio.load() pour éviter un abort côté serveur
  // ⚠️ Ne pas __agiloAbortCtrl.abort() pour laisser finir les fetchs en arrière-plan
  try { overlay?.hide(); } catch {}
  try { lockControls(false); } catch {}
});



  // ---------- Range detection + fallback ----------
async function serverSupportsRange(url){
  const signal = newAbortCtrl();
  try{
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(url, { method:'GET', headers:{ Range:'bytes=0-0' }, signal: ctrl.signal });
    clearTimeout(timer);
    const ar = (r.headers.get('accept-ranges')||'').toLowerCase();
    const cr = r.headers.get('content-range')||'';
    return (r.status === 206) || (ar.includes('bytes') && !!cr);
  }catch(e){
    return true; // on suppose OK si probe annulée
  }
}

async function preloadToBlob(url){
  const signal = newAbortCtrl();
  try { overlay?.show(); } catch {}
  try{
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10 * 60 * 1000);
    const res   = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
      const total = +(res.headers.get('content-length') || 0);
      const type  = res.headers.get('content-type') || 'audio/mpeg';
      const chunks=[]; let loaded=0;

      if (res.body?.getReader){
        const rd = res.body.getReader();
        for(;;){
          const {done, value} = await rd.read();
          if (done) break;
          chunks.push(value);
          loaded += value.byteLength;
          if (total) overlay?.set(loaded/total, false); else overlay?.set(0, true);
        }
      } else {
        chunks.push(new Uint8Array(await res.arrayBuffer()));
        overlay?.set(1,false);
      }
      const blob = new Blob(chunks, { type });
      return URL.createObjectURL(blob);
    } finally {
      try { overlay?.hide(); } catch {}
    }
  }
async function ensureSeekableFor(url, { resumeTime=0, autoplay=false } = {}){
  const mySeq = ++__agiloLoadSeq;   // token de ce chargement
  if (lastBlobUrl){ try{ URL.revokeObjectURL(lastBlobUrl); }catch{} lastBlobUrl=''; }
  lockControls(true);
  const ok = await serverSupportsRange(url);
  if (mySeq !== __agiloLoadSeq) return;  // requête obsolète

  if (ok){
    audio.src = url;
    audio.load();
    await new Promise(r => audio.addEventListener('loadedmetadata', r, { once:true }));
  } else {
    const blobUrl = await preloadToBlob(url);
    if (mySeq !== __agiloLoadSeq) return; // blob obsolète
    lastBlobUrl = blobUrl;
    audio.src = blobUrl;
    audio.load();
    await new Promise(r => audio.addEventListener('loadedmetadata', r, { once:true }));
  }
  if (mySeq !== __agiloLoadSeq) return;

  lockControls(false);
  if (resumeTime){ try{ audio.currentTime = Math.min(resumeTime, Math.max(0, getSafeDuration()-0.25)); }catch{} }
  if (autoplay){ try{ await audio.play(); }catch{} }
}


  // ---------- Controls ----------
  function attachControlListeners(){
    if (!audio) return;

    if (!audio.__agiloCoreBound){
      const playHandler = ()=>{ wasPlaying=true;  updatePlayUI(); };
      const pauseHandler = ()=>{ wasPlaying=false; updatePlayUI(); };
      const endedHandler = ()=>{ wasPlaying=false; updatePlayUI(); };
      const timeHandler = syncTime;
      const progressHandler = syncBuffered;
      const metaHandler = ()=>{ syncTime(); syncBuffered(); updatePlayUI(); };
      
      audio.addEventListener('play', playHandler);
      audio.addEventListener('pause', pauseHandler);
      audio.addEventListener('ended', endedHandler);
      audio.addEventListener('timeupdate', timeHandler);
      audio.addEventListener('progress', progressHandler);
      audio.addEventListener('loadedmetadata', metaHandler);
      
      addCleanup(() => {
        audio.removeEventListener('play', playHandler);
        audio.removeEventListener('pause', pauseHandler);
        audio.removeEventListener('ended', endedHandler);
        audio.removeEventListener('timeupdate', timeHandler);
        audio.removeEventListener('progress', progressHandler);
        audio.removeEventListener('loadedmetadata', metaHandler);
      });
      
      // Sauvegarde position (toutes 3 s)
      let tLastSave = 0;
      const saveHandler = ()=>{
        const now = Date.now();
        if (now - tLastSave > 3000) {
          tLastSave = now;
          try { localStorage.setItem(POS_KEY, String(audio.currentTime||0)); } catch {}
        }
      };
      audio.addEventListener('timeupdate', saveHandler);
      addCleanup(() => audio.removeEventListener('timeupdate', saveHandler));
      
      audio.__agiloCoreBound = true;
    }

    const playClick = async (e)=>{
      e.preventDefault();
      if (seekLocked) return;
      try { audio.paused ? await audio.play() : audio.pause(); } catch {}
    };
    playBtn?.addEventListener?.('click', playClick);
    addCleanup(() => playBtn?.removeEventListener?.('click', playClick));

    // vitesse : clic = step, Shift+clic = +0.1, clic droit = -0.1
    const speedClick = (e)=>{
      if (seekLocked) return;
      if (e.shiftKey) setRate(audio.playbackRate + 0.1);
      else            setRate(audio.playbackRate, {fromStep:true});
    };
    const speedContext = (e)=>{ e.preventDefault(); setRate(audio.playbackRate - 0.1); };
    speedBtn?.addEventListener?.('click', speedClick);
    speedBtn?.addEventListener?.('contextmenu', speedContext);
    addCleanup(() => {
      speedBtn?.removeEventListener?.('click', speedClick);
      speedBtn?.removeEventListener?.('contextmenu', speedContext);
    });

    // sauts
    const jump = s => { const d = getSafeDuration() || 0; audio.currentTime = Math.max(0, Math.min(d, (audio.currentTime||0) + s)); };
    const backClick = ()=> jump(-15);
    const fwdClick = ()=> jump(+30);
    backBtn?.addEventListener?.('click', backClick);
    fwdBtn ?.addEventListener?.('click', fwdClick);
    addCleanup(() => {
      backBtn?.removeEventListener?.('click', backClick);
      fwdBtn?.removeEventListener?.('click', fwdClick);
    });

    // volume
    try{
      const sv = parseFloat(localStorage.getItem(VOL_KEY));
      if (!Number.isNaN(sv) && sv>=0 && sv<=1){ audio.volume = sv; if (volRange) volRange.value = String(sv); }
    }catch{}
    const volHandler = ()=>{
      if (seekLocked) return;
      audio.volume = Number(volRange.value);
      try{ localStorage.setItem(VOL_KEY, String(audio.volume)); }catch{}
    };
    volRange?.addEventListener?.('input', volHandler);
    addCleanup(() => volRange?.removeEventListener?.('input', volHandler));

    // ---------- Scrubber + tooltip ----------
    if (track && !track.__agiloBound) {
      track.style.cursor = 'pointer';
      const pctClamp = (p)=> Math.max(0, Math.min(1, p));
      const pctFromClientX = (clientX)=>{
        const rect = track.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
        return rect.width ? (x / rect.width) : 0;
      };
      const seekToPct = (p)=>{
        const dur = getSafeDuration();
        if (!dur) return;
        const t = pctClamp(p) * dur;
        try { audio.currentTime = t; } catch {}
        if (prog)  prog .style.width = `${pctClamp(p)*100}%`;
        if (thumb) thumb.style.left  = `${pctClamp(p)*100}%`;
        if (hoverTip){ hoverTip.style.left = `${pctClamp(p)*100}%`; hoverTip.textContent = fmt(t); }
      };

      const onPointerMove = (e)=>{
        if (!isScrubbing) return;
        e.preventDefault();
        const p = pctFromClientX(e.clientX ?? (e.touches?.[0]?.clientX || 0));
        seekToPct(p);
      };
      const onPointerUp = ()=>{
        if (!isScrubbing) return;
        isScrubbing = false;
        track.classList.remove('is-dragging');
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('touchmove', onPointerMove, { passive:false });
        document.removeEventListener('touchend', onPointerUp);
      };

      const onPointerDown = (e)=>{
        if (seekLocked) return;
        isScrubbing = true;
        track.classList.add('is-dragging');
        const p = pctFromClientX(e.clientX ?? (e.touches?.[0]?.clientX || 0));
        seekToPct(p);
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
        document.addEventListener('touchmove', onPointerMove, { passive:false });
        document.addEventListener('touchend', onPointerUp);
        e.preventDefault();
      };

      track.addEventListener('pointerdown', onPointerDown);
      track.addEventListener('touchstart', onPointerDown, { passive:false });
      addCleanup(() => {
        track.removeEventListener('pointerdown', onPointerDown);
        track.removeEventListener('touchstart', onPointerDown);
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('touchmove', onPointerMove);
        document.removeEventListener('touchend', onPointerUp);
      });

      const mouseMove = (e)=>{
        if (isScrubbing) return;
        const p = pctFromClientX(e.clientX);
        if (hoverTip){
          hoverTip.style.left = `${p*100}%`;
          hoverTip.textContent = fmt(p * getSafeDuration());
          track.classList.add('show-hover');
        }
      };
      const mouseLeave = ()=> track.classList.remove('show-hover');
      track.addEventListener('mousemove', mouseMove);
      track.addEventListener('mouseleave', mouseLeave);
      addCleanup(() => {
        track.removeEventListener('mousemove', mouseMove);
        track.removeEventListener('mouseleave', mouseLeave);
      });

      track.__agiloBound = true;
    }

    // ---------- Raccourcis clavier (globaux, bind 1x) ----------
    if (!document.__agiloAudioKeysBound){
      const keyHandler = (e)=>{
        const tag = (e.target?.tagName || '').toUpperCase();
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target?.isContentEditable)) return;
        const dur = getSafeDuration(); if (!dur) return;
        const step = e.shiftKey ? 15 : 5;

        switch ((e.key||'').toLowerCase()) {
          case ' ': e.preventDefault(); if (!seekLocked) (audio.paused ? audio.play() : audio.pause()); break;
          case 'arrowleft':  e.preventDefault(); audio.currentTime = Math.max(0, audio.currentTime - step); break;
          case 'arrowright': e.preventDefault(); audio.currentTime = Math.min(dur, audio.currentTime + step); break;
          case 'home':       e.preventDefault(); audio.currentTime = 0; break;
          case 'end':        e.preventDefault(); audio.currentTime = dur; break;
          case 'arrowup':    e.preventDefault(); audio.volume = Math.min(1, audio.volume + .05); if (volRange) volRange.value = String(audio.volume); break;
          case 'arrowdown':  e.preventDefault(); audio.volume = Math.max(0, audio.volume - .05); if (volRange) volRange.value = String(audio.volume); break;
          case '[': setRate(audio.playbackRate - 0.1); break;
          case ']': setRate(audio.playbackRate + 0.1); break;
          case 's': setRate(audio.playbackRate, {fromStep:true}); break; // raccourci vitesse (optionnel)
        }
      };
      document.addEventListener('keydown', keyHandler);
      addCleanup(() => document.removeEventListener('keydown', keyHandler));
      document.__agiloAudioKeysBound = true;
    }
  }

  // ---------- Init (charge la source) ----------
  async function init(){
    lockControls(true);

    const email = await ensureEmail();
    const token = await ensureToken(email);
    if (!email || !token || !activeJobId) {
      log('missing email/token/job');
      lockControls(false);
      updatePlayUI();
      return;
    }

    // vitesse (initial read)
    setRate(getSavedRate());

    // reprise
    let resume = 0; try { const saved = parseFloat(localStorage.getItem(POS_KEY)); if (saved>0) resume = saved; } catch {}

    const url = buildSrc(email, token, activeJobId);
    await ensureSeekableFor(url, { resumeTime: resume, autoplay: autoplayParam });

    // re-apply après load (les navigateurs remettent 1x)
    setRate(getSavedRate());

    seekLocked = false;
    updatePlayUI();
  }

  // ---------- Bootstrap ----------
  function captureRefs(){
    wrap      = document.getElementById('agilo-audio-wrap');
    audio     = document.getElementById('agilo-audio');
    playBtn   = document.getElementById('agilo-play');
    backBtn   = document.getElementById('agilo-skip-back');
    fwdBtn    = document.getElementById('agilo-skip-fwd');
    speedBtn  = document.getElementById('agilo-speed');

    // A11y + affichage visible — ⚠️ pas de re-const ici
    timeEl         = document.getElementById('agilo-time');     // pour l'a11y (caché)
    currentVisEl   = document.getElementById('ag-current');     // visible gauche
    remainingVisEl = document.getElementById('ag-remaining');   // visible droite

    volRange  = document.getElementById('agilo-volume');
    track     = document.getElementById('agilo-track');
    prog      = document.getElementById('agilo-progress');
    buff      = document.getElementById('agilo-buffered');
    thumb     = document.getElementById('agilo-thumb');
    hoverTip  = document.getElementById('agilo-hover');
  }

  async function start(){
    captureRefs();
    if (!wrap || !audio) {
      // Attendre que les éléments arrivent (SPA/injection tardive)
      const obs = new MutationObserver(()=>{
        captureRefs();
        if (wrap && audio){
          obs.disconnect();
          afterRefsReady();
        }
      });
      obs.observe(document.documentElement, { childList:true, subtree:true });
      addCleanup(() => obs.disconnect());
      return;
    }
    afterRefsReady();
  }

  function afterRefsReady(){
    // Edition
    edition  = normalizeEdition(qs.get('edition') || wrap.dataset.edition || 'ent');
    RATE_KEY = `agilo:rate:${edition}`;

    // Job seed
    const seedJob = qs.get('jobId') || wrap.dataset.jobId || document.getElementById('editorRoot')?.dataset?.jobId || '';
    activeJobId = String(seedJob || '');
    POS_KEY     = `agilo:pos:${activeJobId}`;
    if (wrap) wrap.dataset.jobId = activeJobId;

    // Overlay
    overlay = makeLocalOverlay();

    // Lier les contrôles
    attachControlListeners();

    // Démarrer le chargement
    init();

    // Changement de transcript
    if (!window.__agiloAudioLoadBound){
      const loadHandler = async (ev)=>{
        const newId = ev.detail?.jobId;
        const wantPlay = (typeof ev.detail?.autoplay === 'boolean') ? ev.detail.autoplay : wasPlaying;
        if (!newId) return;
        activeJobId = String(newId);
        POS_KEY     = `agilo:pos:${activeJobId}`;
        if (wrap) wrap.dataset.jobId = activeJobId;
        const email = await ensureEmail();
        const token = await ensureToken(email);
        if (email && token) {
          const url = buildSrc(email, token, activeJobId);
          await ensureSeekableFor(url, { resumeTime: 0, autoplay: wantPlay });
          setRate(getSavedRate());
        }
      };
      window.addEventListener('agilo:load', loadHandler);
      addCleanup(() => window.removeEventListener('agilo:load', loadHandler));
      window.__agiloAudioLoadBound = true;
    }
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();

