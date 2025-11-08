// Agilotext - Rail Changement Audio
// ⚠️ Ce fichier est chargé depuis GitHub
// Correspond à: code-changement-audio dans Webflow

(function(){
  // Singleton
  if (window.__agiloRail) return;
  window.__agiloRail = { version: '4.3.0' };

  /* ================== CONFIG ================== */
  const API_BASE = 'https://api.agilotext.com/api/v1';
  const EDITION_FALLBACK = 'ent';
  // Anti-clics frénétiques : n'expédier que le dernier changement
const DISPATCH_DEBOUNCE_MS = 500;
let __pendingLoadTimer = null;


  /* ================== DOM helpers ================== */
  const byId = (id) => document.getElementById(id);
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const rail = {
    list:   byId('rail-list') || byId('railList') || byId('ag-rail-list'),
    tpl:    byId('template-rail-row'),
    search: byId('railSearch') || byId('ag-rail-search'),
    sortAsc:  $('[data-rail-sort="asc"]')  || $('[data-action="sort"][data-order="asc"]'),
    sortDesc: $('[data-rail-sort="desc"]') || $('[data-action="sort"][data-order="desc"]'),
    toggle:   $('.rail-toggle') || $('[data-action="toggle-rail"]')
  };
  if (!rail.list) return;

  // Rôle accessible si absent
  if (!rail.list.getAttribute('role')) rail.list.setAttribute('role', 'listbox');

  /* ================== State ================== */
  const state = {
    isSwitching: false,
    lastRequestedJobId: '',
    edition: EDITION_FALLBACK,
    debug: false
  };
  const dbg = (...a) => state.debug && console.debug('[Rail]', ...a);

  /* ================== Utils ================== */
  function normalizeEdition(v){
    v = String(v||'').trim().toLowerCase();
    if (/(^ent$|enterprise|entreprise|business|team|biz)/.test(v)) return 'ent';
    if (/^pro/.test(v))         return 'pro';
    if (/^free|gratuit/.test(v))return 'free';
    return EDITION_FALLBACK;
  }
  function getEdition(){
    const fromRoot = byId('editorRoot')?.dataset?.edition;
    const fromQS   = new URLSearchParams(location.search).get('edition');
    const fromLS   = localStorage.getItem('agilo:edition');
    return normalizeEdition(fromQS || fromRoot || fromLS || EDITION_FALLBACK);
  }
  function currentJobId(){
    const u = new URL(location.href);
    return (
      u.searchParams.get('jobId') ||
      byId('editorRoot')?.dataset?.jobId ||
      byId('agilo-audio-wrap')?.dataset?.jobId ||
      ''
    );
  }
  function setUrlParams({ jobId, edition }){
    const u = new URL(location.href);
    if (jobId)   u.searchParams.set('jobId', jobId);
    if (edition) u.searchParams.set('edition', edition);
    history.replaceState({}, '', u);
  }
  function setDatasets(jobId){
    const root = byId('editorRoot');
    const wrap = byId('agilo-audio-wrap');
    if (root) root.dataset.jobId = jobId || '';
    if (wrap) wrap.dataset.jobId = jobId || '';
  }

  // Dates / tri
  const monthsFR = { 'janv':'01','jan':'01','févr':'02','fevr':'02','fév':'02','fev':'02','mars':'03','avr':'04','mai':'05','juin':'06','juil':'07','août':'08','aout':'08','sept':'09','oct':'10','nov':'11','déc':'12','dec':'12' };
  const fmtDate = (iso) => {
    try{
      const d = new Date(iso);
      return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}) + ' • ' +
             d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
    }catch{ return ''; }
  };
  function parseFrDateLabel(s){
    if (!s) return NaN;
    try{
      const parts = s.toLowerCase().replaceAll('\u00a0',' ').split('•');
      const left  = (parts[0]||'').trim();
      const right = (parts[1]||'').trim();
      const m1 = left.match(/(\d{1,2})\s*([a-zéû\.]+)/i);
      const m2 = right.match(/(\d{1,2}):(\d{2})/);
      if (!m1 || !m2) return NaN;
      const dd = parseInt(m1[1],10);
      const mKey = (m1[2]||'').replace('.','').replace('é','e').replace('û','u');
      const MM = monthsFR[mKey] || '01';
      const yyyy = new Date().getFullYear();
      const HH = parseInt(m2[1],10);
      const mm = parseInt(m2[2],10);
      return new Date(`${yyyy}-${String(MM).padStart(2,'0')}-${String(dd).padStart(2,'0')}T${String(HH).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`).getTime();
    }catch{ return NaN; }
  }
  function parseTitleTimestamp(title){
    const m = String(title||'').match(/_(\d{6})_(\d{6})/);
    if (!m) return NaN;
    const YY = m[1].slice(0,2), MM = m[1].slice(2,4), DD = m[1].slice(4,6);
    const hh = m[2].slice(0,2), mi = m[2].slice(2,4), ss = m[2].slice(4,6);
    const yyyy = 2000 + parseInt(YY,10);
    return new Date(`${yyyy}-${MM}-${DD}T${hh}:${mi}:${ss}`).getTime();
  }
  function getItemTs(el){
    const ds = Number(el.dataset.ts);
    if (!isNaN(ds) && ds>0) return ds;
    const fromTitle = parseTitleTimestamp(el.dataset.title || el.querySelector('.ri-title')?.textContent);
    if (!isNaN(fromTitle)) return fromTitle;
    const fromLabel = parseFrDateLabel(el.querySelector('.ri-date')?.textContent);
    if (!isNaN(fromLabel)) return fromLabel;
    return 0;
  }

  // Statuts → badges
  function isReadyStatus(sRaw){
    const s = String(sRaw||'').toUpperCase();
    if (!s) return false;
    if (s.includes('ON_ERROR') || s.includes('ERROR')) return false;
    if (s.includes('PENDING') || s.includes('IN_PROGRESS') || s.includes('QUEUED') || s.includes('UPLOADING')) return false;
    if (s === 'READY' || s.startsWith('READY')) return true;
    return false;
  }
  const show = el => { if(!el) return; el.hidden=false; el.removeAttribute('hidden'); el.style.display=''; };
  const hide = el => { if(!el) return; el.hidden=true;  el.setAttribute('hidden','');  el.style.display='none'; };
  function applyBadgeVisibility(rootEl, status){
    const ok = isReadyStatus(status);
    const okEl  = rootEl.querySelector('.ri-badge.ri-badge-ok');
    const wipEl = rootEl.querySelector('.ri-badge.ri-badge-wip');
    if (ok){ show(okEl); hide(wipEl); }
    else   { hide(okEl); show(wipEl); }
    rootEl.setAttribute('data-status', status || '');
    okEl?.setAttribute('aria-label','Statut : prêt');
    wipEl?.setAttribute('aria-label','Statut : en cours');
  }
  function updateItemStatus(jobId, status){
    const el = rail.list?.querySelector(`.rail-item[data-job-id="${CSS.escape(String(jobId))}"]`);
    if (!el) return;
    el.dataset.status = status || '';
    applyBadgeVisibility(el, status);
  }

  /* ================== Auth (via script <head>) ================== */
  function tokenKey(email, edition){
    return `agilo:token:${normalizeEdition(edition)}:${String(email||'').toLowerCase()}`;
  }
  function readAuthSnapshot(){
    const root     = byId('editorRoot');
    const edition  = getEdition();
    const email    = root?.dataset.username
                  || byId('memberEmail')?.value
                  || $('[name="memberEmail"]')?.value
                  || localStorage.getItem('agilo:username')
                  || window.memberEmail
                  || '';
    const token =
      root?.dataset.token ||
      window.globalToken ||
      localStorage.getItem(tokenKey(email, edition)) ||
      localStorage.getItem('agilo:token') || '';
    return { username: (email||'').trim(), token: token||'', edition };
  }
  function waitForTokenEvent(timeoutMs, wantEmail, wantEdition){
    return new Promise((resolve)=>{
      const t0 = performance.now();
      let done = false;
      const finish = (res) => { if (!done){ done = true; resolve(res); } };
      const onEvt = (e) => {
        const d = e?.detail||{};
        const okEmail = wantEmail ? (String(d.email||'').toLowerCase() === String(wantEmail||'').toLowerCase()) : true;
        const okEd    = wantEdition ? (normalizeEdition(d.edition) === normalizeEdition(wantEdition)) : true;
        if (d.token && okEmail && okEd) finish({ username: d.email, token: d.token, edition: normalizeEdition(d.edition) });
      };
      window.addEventListener('agilo:token', onEvt, { passive:true });
      (function loop(){
        if (done) return;
        const snap = readAuthSnapshot();
        if (snap.username && snap.token) {
          window.removeEventListener('agilo:token', onEvt);
          finish(snap); return;
        }
        if (performance.now() - t0 > timeoutMs) {
          window.removeEventListener('agilo:token', onEvt);
          finish(readAuthSnapshot()); return;
        }
        requestAnimationFrame(loop);
      })();
    });
  }
  async function ensureAuth(timeoutMs = 12000){
    const snap = readAuthSnapshot();
    if (snap.username && snap.token) return snap;

    // Demande polie au script <head> s'il est dispo
    if (!snap.token && snap.username && typeof window.getToken === 'function'){
      try { window.getToken(snap.username, snap.edition); } catch {}
    }
    // Attendre l'évènement agilo:token ou remplissage global/localStorage
    const final = await waitForTokenEvent(timeoutMs, snap.username, snap.edition);
    return { username: final.username || snap.username, token: final.token || snap.token, edition: final.edition || snap.edition };
  }

  /* ================== API ================== */
  async function fetchJobs(auth){
    const url = `${API_BASE}/getJobsInfo?username=${encodeURIComponent(auth.username)}&token=${encodeURIComponent(auth.token)}&edition=${encodeURIComponent(auth.edition)}&limit=200&offset=0`;
    let resp;
    try { resp = await fetch(url, { credentials:'omit', cache:'no-store' }); }
    catch(e){ dbg('getJobsInfo network error', e); return []; }

    // 401 ? → tenter un refresh via script <head>, puis retry unique
    if (resp.status === 401 && typeof window.getToken === 'function'){
      try { window.getToken(auth.username, auth.edition); } catch {}
      const a2 = await ensureAuth(8000);
      if (a2.token && a2.token !== auth.token) return fetchJobs(a2);
    }

    if (!resp.ok) { dbg('getJobsInfo http', resp.status); return []; }

    const j = await resp.json().catch(()=>null);
    if (!j || j.status!=='OK' || !Array.isArray(j.jobsInfoDtos)) { dbg('getJobsInfo format', j); return []; }

    return j.jobsInfoDtos.map(x=>{
      const m = String(x.dtCreation||'').match(/(\d{2})[-/](\d{2})[-/](\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
      const iso = m ? new Date(+m[3], +m[2]-1, +m[1], +m[4], +m[5], +m[6]).toISOString() : new Date().toISOString();
      return { jobId:String(x.jobid), title:x.filename||`Transcript ${x.jobid}`, createdAt:iso, ts:Date.parse(iso)||0, status:x.transcriptStatus||'PENDING' };
    });
  }

  /* ================== Bootstrap items déjà présents ================== */
  function bootstrapExistingRailItems(){
    $$('.rail-item', rail.list).forEach(el => {
      if (!el.dataset.ts) el.dataset.ts = String(getItemTs(el));
      applyBadgeVisibility(el, el.dataset.status || '');
      el.setAttribute('role', el.getAttribute('role') || 'option');
      if (!el.hasAttribute('aria-selected')) el.setAttribute('aria-selected','false');
    });
  }

  /* ================== Empty state ================== */
  function renderEmptyRail(){
    rail.list.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'rail-empty';
    div.setAttribute('role','status');
    div.textContent = 'Aucun transcript trouvé.';
    rail.list.appendChild(div);
  }

  /* ================== Rendu ================== */
  function renderRail(jobs){
    const current = currentJobId();
    rail.list.innerHTML = '';

    let hasActive = false;

    jobs.forEach((j) => {
      const el = rail.tpl?.content
        ? rail.tpl.content.firstElementChild.cloneNode(true)
        : document.createElement('button');

      if (!el.querySelector('.ri-title')) {
        el.innerHTML = `
          <div class="ri-top"><span class="ri-title"></span><span class="ri-date"></span></div>
          <div class="ri-bottom">
            <span class="ri-badge ri-badge-ok"><div class="dot-ready"></div><div>Ok</div></span>
            <span class="ri-badge ri-badge-wip" hidden><div class="dot-ready pending"></div><div>En cours</div></span>
          </div>`;
      }
      el.className = 'rail-item';
      el.type = 'button';
      el.dataset.jobId     = String(j.jobId);
      el.dataset.title     = j.title || ('Transcript ' + j.jobId);
      el.dataset.status    = j.status || '';
      el.dataset.createdAt = j.createdAt || '';
      el.dataset.ts        = String(j.ts||0);
      el.setAttribute('role','option');

      const isActive = current ? (String(j.jobId) === String(current)) : false;
      hasActive = hasActive || isActive;
      el.classList.toggle('is-active', isActive);
      el.setAttribute('aria-selected', isActive ? 'true' : 'false');

      el.querySelector('.ri-title').textContent = el.dataset.title;
      el.querySelector('.ri-date').textContent  = fmtDate(j.createdAt || new Date().toISOString());

      applyBadgeVisibility(el, j.status);
      rail.list.appendChild(el);
    });

 

    const saved = localStorage.getItem('agilo:rail:sort') || 'desc';
    sortRail(saved === 'asc');

    const active = rail.list.querySelector('.rail-item.is-active') || rail.list.querySelector('.rail-item');
    if (active) {
      window.dispatchEvent(new CustomEvent('agilo:jobtitle', {
        detail: { jobId: active.dataset.jobId, title: active.dataset.title || active.querySelector('.ri-title')?.textContent || 'Transcript' }
      }));
    }

    // Pas de seed auto si aucun job : on laisse l'empty state gérer
  }

  /* ================== Tri / interactions ================== */
  function sortRail(asc=true){
    const items = $$('.rail-item', rail.list);
    items.forEach(el => { const ts = getItemTs(el); el.dataset.ts = String(ts||0); });
    items.sort((a,b) => {
      const ta = Number(a.dataset.ts)||0;
      const tb = Number(b.dataset.ts)||0;
      return asc ? (ta - tb) : (tb - ta);
    }).forEach(el => rail.list.appendChild(el));
  }

  rail.sortAsc?.addEventListener('click', () => { localStorage.setItem('agilo:rail:sort','asc');  sortRail(true);  });
  rail.sortDesc?.addEventListener('click', () => { localStorage.setItem('agilo:rail:sort','desc'); sortRail(false); });

  rail.toggle?.addEventListener('click', () => ($('.ed-rail') || $('.ag-rail'))?.classList.toggle('is-collapsed'));

  // Recherche avec petit throttle
  (function(){
    let tid = null;
    rail.search?.addEventListener('input', () => {
      if (tid) cancelAnimationFrame(tid);
      tid = requestAnimationFrame(()=>{
        const q = (rail.search.value || '').trim().toLowerCase();
        $$('.rail-item', rail.list).forEach(b => {
          const t = (b.dataset.title || b.querySelector('.ri-title')?.textContent || '').toLowerCase();
          b.style.display = !q || t.includes(q) ? '' : 'none';
        });
      });
    });
  })();

// --- Anti-clics frénétiques (500ms) ---
const CLICK_FLOOD_MS = 500;
let __clickGateUntil = 0;
function clickFloodGate(){
  const now = performance.now();
  if (now < __clickGateUntil) return false;
  __clickGateUntil = now + CLICK_FLOOD_MS;
  setTimeout(() => {
    if (performance.now() >= __clickGateUntil) __clickGateUntil = 0;
  }, CLICK_FLOOD_MS + 60);
  return true;
}


rail.list.addEventListener('click', (e) => {
  if (!clickFloodGate()) return; // ⟵ bloque le spam pendant 500ms

  const btn = e.target.closest('.rail-item');
  if (!btn) return;

    const jobId = btn.dataset.jobId;
    if (!jobId) return;
    if (btn.classList.contains('is-active')) return; // rien à faire

    // Toggle visuel immédiat + ARIA
    $$('.rail-item', rail.list).forEach(b => {
      const on = b===btn;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    state.edition = getEdition();
    

    window.dispatchEvent(new CustomEvent('agilo:jobtitle', {
      detail: { jobId, title: btn.dataset.title || btn.querySelector('.ri-title')?.textContent || 'Transcript' }
    }));

    safeDispatchLoad(jobId);
  });

  /* ================== Safe dispatch (avec beforeload) ================== */
function pauseAndResetAudioUI(){
  const wrap  = byId('agilo-audio-wrap');
  const ov    = wrap?.querySelector?.('.agilo-preload');
  const audio = byId('agilo-audio');

  // On met juste en pause, sans casser le flux réseau en cours
  try { audio?.pause(); } catch {}

  // Nettoyage UI
  try { wrap?.classList.remove('is-locked'); } catch {}
  try { ov?.classList.remove('is-visible','is-indeterminate'); } catch {}
}


function safeDispatchLoad(jobId){
  if (!jobId) return;

  state.lastRequestedJobId = jobId;
  clearTimeout(__pendingLoadTimer);

  __pendingLoadTimer = setTimeout(()=>{
    // si ce timer ne correspond plus à la dernière intention, on annule
    if (jobId !== state.lastRequestedJobId) return;
    if (state.isSwitching) {
      __pendingLoadTimer = setTimeout(()=> safeDispatchLoad(jobId), 60);
      return;
    }

    state.isSwitching = true;

    const audio = document.getElementById('agilo-audio');
    const wantAutoplay = audio ? !audio.paused : false;

    pauseAndResetAudioUI();

    // MAJ URL + datasets (une seule fois ici)
    setUrlParams({ jobId, edition: getEdition() });

// Un seul beforeload, dans les 2 branches
if (window.__agiloOrchestrator?.loadJob) {
  window.dispatchEvent(new CustomEvent('agilo:beforeload', { detail: { jobId } }));
  try { window.__agiloOrchestrator.loadJob(jobId, { autoplay: wantAutoplay }); } catch {}
} else {
  window.dispatchEvent(new CustomEvent('agilo:beforeload', { detail: { jobId } }));
  window.dispatchEvent(new CustomEvent('agilo:load',       { detail: { jobId, autoplay: wantAutoplay } }));
}



    setTimeout(()=>{ state.isSwitching = false; }, 350);
  }, DISPATCH_DEBOUNCE_MS);
}



  /* ================== Statut live & refresh externe ================== */
  window.addEventListener('agilo:status', (ev)=>{
    const { jobId, status } = ev.detail || {};
    if (jobId && status) updateItemStatus(jobId, status);
  });

  window.addEventListener('agilo:refresh-rail', async ()=>{
    const auth = await ensureAuth();
    const jobs = await fetchJobs(auth);
    if (jobs?.length) renderRail(jobs);
    else renderEmptyRail();
  });
  
  // Si un load est déclenché ailleurs, on resynchronise la sélection visuelle + URL
window.addEventListener('agilo:load', (e)=>{
  const id = String(e?.detail?.jobId || e?.detail || '');
  if (!id) return;
  const btn = rail.list?.querySelector(`.rail-item[data-job-id="${CSS.escape(id)}"]`);
  if (!btn) return;
  $$('.rail-item', rail.list).forEach(b => {
    const on = (b === btn);
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  setUrlParams({ jobId: id, edition: getEdition() });
});


  // Si le token arrive après coup (script <head> lent) → re-fetch auto
window.addEventListener('agilo:token', async ()=>{
  const auth = readAuthSnapshot();
  if (!auth.username || !auth.token) return;
  const jobs = await fetchJobs(auth);
  if (jobs?.length) renderRail(jobs);
  else renderEmptyRail();
});

  /* ================== INIT ================== */
  (async function init(){
    state.edition = getEdition();
    // Sécurité UX : vider la recherche qui pourrait filtrer à 1 item
    if (rail.search) rail.search.value = '';
    bootstrapExistingRailItems();

    const auth = await ensureAuth();
    const jobs = await fetchJobs(auth);

    if (jobs.length){ renderRail(jobs); }
    else { renderEmptyRail(); }

    // Petit rattrapage si la liste semble incomplète au premier tir
    if (jobs.length <= 1) {
      setTimeout(async ()=>{
        const auth2 = await ensureAuth();
        const jobs2 = await fetchJobs(auth2);
        if (jobs2.length) renderRail(jobs2);
        else renderEmptyRail();
      }, 700);
    }
  })();
})();

