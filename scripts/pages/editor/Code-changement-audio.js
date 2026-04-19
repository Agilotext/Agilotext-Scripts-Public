// Agilotext - Rail Changement Audio
// ⚠️ Ce fichier est chargé depuis GitHub
// Correspond à: code-changement-audio dans Webflow

(function(){
  // Singleton
  if (window.__agiloRail) return;
  window.__agiloRail = { version: '4.6.1' };

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
    debug: false,
    /** 'all' | 'root' | number (folderId > 0) — voir MODE_EMPLOI folders */
    folderFilter: 'all',
    foldersCache: { rootJobsCount: 0, folders: [] }
  };
  const dbg = (...a) => state.debug && console.debug('[Rail]', ...a);

  function stemFilename(name){
    const s = String(name || '');
    const i = s.lastIndexOf('.');
    return i > 0 ? s.slice(0, i) : s;
  }
  function displayTitleFromDto(x){
    const raw = x.jobTitle != null ? String(x.jobTitle) : (x.jobtitle != null ? String(x.jobtitle) : '');
    const jt = raw.trim();
    if (jt) return jt;
    const fn = x.filename || '';
    if (fn) return stemFilename(fn) || fn;
    return `Transcript ${x.jobid}`;
  }

  /** Compteur dossier depuis getTranscriptFolders — alias de champs API possibles */
  function folderDtoJobsCount(f) {
    const v =
      f.jobsCount ??
      f.count ??
      f.jobCount ??
      f.nbJobs ??
      f.totalJobs ??
      f.jobs_count ??
      f.numJobs ??
      f.numberOfJobs;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  async function postForm(endpoint, fields){
    const body = new URLSearchParams(fields);
    let resp;
    try {
      resp = await fetch(`${API_BASE}/${endpoint}`, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        credentials: 'omit',
        cache: 'no-store'
      });
    } catch (e) {
      return { ok: false, error: e?.message || 'réseau' };
    }
    const raw = await resp.text();
    let j = null;
    try { j = JSON.parse(raw); } catch { return { ok: false, error: raw || 'réponse invalide' }; }
    if (j && String(j.status).toUpperCase() === 'OK') return { ok: true, data: j };
    const msg = j?.message || j?.errorMessage || j?.userErrorMessage || j?.error || 'Erreur API';
    return { ok: false, error: String(msg), data: j };
  }

  async function fetchTranscriptFoldersList(auth){
    const url = `${API_BASE}/getTranscriptFolders?username=${encodeURIComponent(auth.username)}&token=${encodeURIComponent(auth.token)}&edition=${encodeURIComponent(auth.edition)}`;
    let resp;
    try { resp = await fetch(url, { credentials: 'omit', cache: 'no-store' }); }
    catch (e) { dbg('getTranscriptFolders network', e); return { rootJobsCount: 0, folders: [] }; }
    if (!resp.ok) { dbg('getTranscriptFolders http', resp.status); return { rootJobsCount: 0, folders: [] }; }
    const j = await resp.json().catch(() => null);
    if (!j || String(j.status).toUpperCase() !== 'OK') { dbg('getTranscriptFolders KO', j); return { rootJobsCount: 0, folders: [] }; }
    const rawList = j.folders || j.transcriptFolderDtos || j.transcriptFolders || j.folderDtos || [];
    const folders = (Array.isArray(rawList) ? rawList : []).map((f) => ({
      folderId: Number(f.folderId != null ? f.folderId : f.id) || 0,
      folderName: String(f.folderName != null ? f.folderName : f.name || '').trim(),
      jobsCount: folderDtoJobsCount(f)
    })).filter((f) => f.folderId > 0 && f.folderName);
    const rootJobsCount = Number(j.rootJobsCount != null ? j.rootJobsCount : j.rootCount) || 0;
    return { rootJobsCount, folders };
  }

  /** Décompte racine + par folderId depuis la liste jobs (getJobsInfo, même fenêtre que « Tous »). */
  function deriveFolderCountsFromJobs(jobs) {
    let rootJobsCount = 0;
    const byFolder = new Map();
    if (!Array.isArray(jobs)) return { rootJobsCount, byFolder };
    jobs.forEach((j) => {
      const fid = Number(j.folderId);
      if (!Number.isFinite(fid) || fid < 0) return;
      if (fid === 0) rootJobsCount++;
      else byFolder.set(fid, (byFolder.get(fid) || 0) + 1);
    });
    return { rootJobsCount, byFolder };
  }

  /**
   * Fusionne compteurs API dossiers et décompte client (max des deux).
   * Si AGILO_DEBUG ou state.debug : journaliser quand le dérivé corrige l’agrégat — écart persistant → vérifier getTranscriptFolders côté API / BDD.
   */
  function mergeFoldersCacheWithDerived(cache, derived) {
    const apiRoot = Number(cache?.rootJobsCount) || 0;
    const mergedRoot = Math.max(apiRoot, derived.rootJobsCount);
    const doLog = typeof window !== 'undefined' && (window.AGILO_DEBUG || state.debug);
    if (doLog && mergedRoot > apiRoot) {
      console.debug('[Rail] rootJobsCount : agrégat API', apiRoot, '— dérivé getJobsInfo', derived.rootJobsCount, '— affiché', mergedRoot);
    }
    const folders = (Array.isArray(cache?.folders) ? cache.folders : []).map((f) => {
      const fid = Number(f.folderId);
      const api = Number(f.jobsCount) || 0;
      const d = Number.isFinite(fid) && fid > 0 ? (derived.byFolder.get(fid) || 0) : 0;
      const m = Math.max(api, d);
      if (doLog && m > api) {
        console.debug('[Rail] jobsCount dossier', f.folderName, fid, ': API', api, '— dérivé', d, '— affiché', m);
      }
      return { ...f, jobsCount: m };
    });
    return { rootJobsCount: mergedRoot, folders };
  }

  /** Recharge dossiers + réconciliation à partir de getJobsInfo sans filtre dossier. Retourne la liste « tous » (limite API). */
  async function refreshFoldersCacheMerged(auth) {
    const [foldersData, jobsAll] = await Promise.all([
      fetchTranscriptFoldersList(auth),
      fetchJobs(auth, false, 'all')
    ]);
    state.foldersCache = mergeFoldersCacheWithDerived(foldersData, deriveFolderCountsFromJobs(jobsAll));
    return jobsAll;
  }

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
  /**
   * @param {{ username: string, token: string, edition: string }} auth
   * @param {boolean} retried
   * @param {'all'|'root'|number|undefined} overrideFilter — si défini, remplace state.folderFilter pour cet appel (ex. 'all' pour décomptes)
   */
  async function fetchJobs(auth, retried = false, overrideFilter){
    const ff = overrideFilter !== undefined ? overrideFilter : state.folderFilter;
    let url = `${API_BASE}/getJobsInfo?username=${encodeURIComponent(auth.username)}&token=${encodeURIComponent(auth.token)}&edition=${encodeURIComponent(auth.edition)}&limit=200&offset=0`;
    if (ff === 'root') {
      url += '&folderId=0';
    } else if (typeof ff === 'number' && ff > 0) {
      url += `&folderId=${encodeURIComponent(String(ff))}`;
    }
    let resp;
    try { resp = await fetch(url, { credentials:'omit', cache:'no-store' }); }
    catch(e){ dbg('getJobsInfo network error', e); return []; }

    async function refreshAndRetry() {
      if (retried || !auth.username || typeof window.getToken !== 'function') return null;
      try { window.getToken(auth.username, auth.edition); } catch {}
      const a2 = await ensureAuth(8000);
      if (a2.token) return fetchJobs(a2, true, ff);
      return null;
    }

    if ((resp.status === 401 || resp.status === 403) && !retried) {
      const again = await refreshAndRetry();
      if (again) return again;
    }

    if (!resp.ok) { dbg('getJobsInfo http', resp.status); return []; }

    const j = await resp.json().catch(()=>null);
    const errMsg = String(j?.errorMessage || j?.userErrorMessage || '').toLowerCase();
    const looksToken =
      /invalid[_-]?token|bad[_-]?token|expired|jeton|token\s*invalide|non\s*autoris|unauthoriz/i.test(errMsg);

    if (!retried && auth.username && j && j.status !== 'OK' && looksToken) {
      dbg('getJobsInfo KO token-like', j);
      const again = await refreshAndRetry();
      if (again) return again;
    }

    if (!j || j.status!=='OK' || !Array.isArray(j.jobsInfoDtos)) { dbg('getJobsInfo format', j); return []; }

    return j.jobsInfoDtos.map(x=>{
      const m = String(x.dtCreation||'').match(/(\d{2})[-/](\d{2})[-/](\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
      const iso = m ? new Date(+m[3], +m[2]-1, +m[1], +m[4], +m[5], +m[6]).toISOString() : new Date().toISOString();
      const title = displayTitleFromDto(x);
      const folderId = x.folderId != null ? Number(x.folderId) : 0;
      const folderName = (x.folderName != null ? String(x.folderName) : '').trim();
      return {
        jobId: String(x.jobid),
        title,
        filename: String(x.filename || ''),
        folderId,
        folderName,
        createdAt: iso,
        ts: Date.parse(iso) || 0,
        status: x.transcriptStatus || 'PENDING'
      };
    });
  }

  function renderFolderBarDom(auth){
    const bar = ensureFolderBar();
    if (!bar || !auth?.username || !auth?.token) return;
    const { rootJobsCount, folders } = state.foldersCache;

    function chip(id, label, active){
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'agilo-folder-chip' + (active ? ' is-active' : '');
      b.dataset.filter = String(id);
      b.textContent = label;
      b.addEventListener('click', async () => {
        if (id === 'all') state.folderFilter = 'all';
        else if (id === 'root') state.folderFilter = 'root';
        else state.folderFilter = Number(id);
        const a = await ensureAuth();
        renderFolderBarDom(a);
        const jobs = await fetchJobs(a);
        if (jobs?.length) renderRail(jobs);
        else renderEmptyRail();
      });
      return b;
    }

    bar.innerHTML = '';
    const lab = document.createElement('span');
    lab.className = 'agilo-folder-label';
    lab.textContent = 'Dossiers';
    bar.appendChild(lab);

    const chipsWrap = document.createElement('div');
    chipsWrap.className = 'agilo-folder-chips';
    chipsWrap.appendChild(chip('all', 'Tous', state.folderFilter === 'all'));
    chipsWrap.appendChild(chip('root', `Racine (${rootJobsCount})`, state.folderFilter === 'root'));
    folders.forEach((f) => {
      const active = Number(state.folderFilter) === Number(f.folderId);
      chipsWrap.appendChild(chip(String(f.folderId), `${f.folderName} (${f.jobsCount})`, active));
    });

    const newFoldBtn = document.createElement('button');
    newFoldBtn.type = 'button';
    newFoldBtn.className = 'agilo-folder-chip agilo-folder-chip--new';
    newFoldBtn.textContent = '+ Dossier';
    newFoldBtn.addEventListener('click', async () => {
      const name = window.prompt('Nom du nouveau dossier ?');
      if (!name || !String(name).trim()) return;
      const r = await postForm('createTranscriptFolder', {
        username: auth.username,
        token: auth.token,
        edition: auth.edition,
        folderName: String(name).trim()
      });
      if (!r.ok) {
        window.alert(r.error || 'Création impossible');
        return;
      }
      const a = await ensureAuth();
      await refreshFoldersCacheMerged(a);
      renderFolderBarDom(a);
    });
    chipsWrap.appendChild(newFoldBtn);
    bar.appendChild(chipsWrap);

    const moveDetails = document.createElement('details');
    moveDetails.className = 'agilo-folder-move-details';
    const moveSum = document.createElement('summary');
    moveSum.textContent = 'Déplacer le transcript ouvert…';
    const moveInner = document.createElement('div');
    moveInner.className = 'agilo-folder-move-inner';
    const moveHelp = document.createElement('p');
    moveHelp.className = 'agilo-folder-move-help';
    moveHelp.id = 'agilo-folder-move-help';
    moveHelp.textContent = 'S’applique au job dont l’identifiant est dans la barre d’adresse (paramètre jobId). Choisissez le dossier de destination puis validez.';
    const sel = document.createElement('select');
    sel.id = 'agilo-folder-move-select';
    sel.setAttribute('aria-describedby', 'agilo-folder-move-help');
    const o0 = document.createElement('option');
    o0.value = '';
    o0.textContent = '— Destination —';
    sel.appendChild(o0);
    const oR = document.createElement('option');
    oR.value = '0';
    oR.textContent = 'Racine';
    sel.appendChild(oR);
    folders.forEach((f) => {
      const o = document.createElement('option');
      o.value = String(f.folderId);
      o.textContent = f.folderName;
      sel.appendChild(o);
    });
    const go = document.createElement('button');
    go.type = 'button';
    go.textContent = 'OK';
    go.addEventListener('click', async () => {
      const jid = currentJobId();
      const v = sel.value;
      if (!jid) {
        window.alert('Aucun job ouvert.');
        return;
      }
      if (v === '') {
        window.alert('Choisis un dossier cible.');
        return;
      }
      const a = await ensureAuth();
      const r = await postForm('moveTranscriptToFolder', {
        username: a.username,
        token: a.token,
        edition: a.edition,
        jobId: jid,
        folderId: v
      });
      if (!r.ok) {
        window.alert(r.error || 'Déplacement impossible');
        return;
      }
      await refreshFoldersCacheMerged(a);
      renderFolderBarDom(a);
      const jobs = await fetchJobs(a);
      if (jobs?.length) renderRail(jobs);
      else renderEmptyRail();
    });
    moveInner.appendChild(moveHelp);
    moveInner.appendChild(sel);
    moveInner.appendChild(go);
    moveDetails.appendChild(moveSum);
    moveDetails.appendChild(moveInner);
    bar.appendChild(moveDetails);
  }

  function ensureFolderBar(){
    let bar = byId('agilo-folder-bar');
    if (bar) return bar;
    const parent = rail.list?.parentElement;
    if (!parent) return null;
    bar = document.createElement('div');
    bar.id = 'agilo-folder-bar';
    bar.className = 'agilo-folder-bar';
    bar.setAttribute('role', 'navigation');
    bar.setAttribute('aria-label', 'Dossiers transcriptions');
    parent.insertBefore(bar, rail.list);
    return bar;
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
  function renderLoadingRail(){
    rail.list.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'rail-loading';
    div.setAttribute('role', 'status');
    div.textContent = 'Chargement des transcriptions…';
    rail.list.appendChild(div);
    rail.list.setAttribute('aria-busy', 'true');
  }

  function renderEmptyRail(){
    rail.list.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'rail-empty';
    div.setAttribute('role','status');
    let msg = 'Aucun transcript trouvé.';
    if (state.folderFilter === 'root') {
      msg = 'Aucun transcript à la racine.';
    } else if (typeof state.folderFilter === 'number' && state.folderFilter > 0) {
      const name = state.foldersCache.folders.find((x) => Number(x.folderId) === Number(state.folderFilter))?.folderName;
      msg = name
        ? `Aucun transcript dans le dossier « ${name} ».`
        : 'Aucun transcript dans ce dossier.';
    }
    div.textContent = msg;
    rail.list.appendChild(div);
    if (state.folderFilter === 'all') {
      const hint = document.createElement('div');
      hint.className = 'rail-empty-hint';
      hint.textContent = 'Les compteurs sur les dossiers peuvent inclure des transcripts au-delà des 200 derniers affichés dans cette liste.';
      rail.list.appendChild(hint);
    }
    rail.list.removeAttribute('aria-busy');
  }

  /** Annule les hydratations concurrentes (token vs init) */
  let __railHydrateGen = 0;

  async function hydrateRailWithAuth(auth){
    const gen = ++__railHydrateGen;
    const jobsAll = await refreshFoldersCacheMerged(auth);
    if (gen !== __railHydrateGen) return { stale: true, jobCount: 0 };
    renderFolderBarDom(auth);
    rail.list.removeAttribute('aria-busy');
    let list;
    if (state.folderFilter === 'all') {
      list = jobsAll || [];
    } else {
      list = await fetchJobs(auth);
      if (gen !== __railHydrateGen) return { stale: true, jobCount: 0 };
    }
    if (list.length) renderRail(list);
    else renderEmptyRail();
    return { stale: false, jobCount: list.length };
  }

  let __railRefreshDebounce = null;
  function scheduleRailRefresh(){
    if (__railRefreshDebounce) clearTimeout(__railRefreshDebounce);
    __railRefreshDebounce = setTimeout(async ()=>{
      __railRefreshDebounce = null;
      try{
        const auth = await ensureAuth();
        if (!auth.username || !auth.token) return;
        await hydrateRailWithAuth(auth);
      } catch (e) {
        if (state.debug) console.warn('[Rail] refresh', e);
      }
    }, 200);
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
          <div class="ri-folder-hint" hidden></div>
          <div class="ri-bottom">
            <span class="ri-badge ri-badge-ok"><div class="dot-ready"></div><div>Ok</div></span>
            <span class="ri-badge ri-badge-wip" hidden><div class="dot-ready pending"></div><div>En cours</div></span>
          </div>`;
      }
      el.className = 'rail-item';
      el.type = 'button';
      el.dataset.jobId     = String(j.jobId);
      el.dataset.title     = j.title || ('Transcript ' + j.jobId);
      el.dataset.filename  = j.filename || '';
      el.dataset.folderName = j.folderName || '';
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
      const fh = el.querySelector('.ri-folder-hint');
      if (fh) {
        if (j.folderName) {
          fh.textContent = j.folderName;
          fh.hidden = false;
        } else {
          fh.textContent = '';
          fh.hidden = true;
        }
      }

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

    rail.list.removeAttribute('aria-busy');

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

  window.addEventListener('agilo:refresh-rail', () => { scheduleRailRefresh(); });
  
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


  // Token (Memberstack) ou creds orchestrateur → même chemin debouncé (évite double appel token+credsUpdated)
  window.addEventListener('agilo:token', () => { scheduleRailRefresh(); }, { passive: true });
  window.addEventListener('agilo:credsUpdated', () => { scheduleRailRefresh(); }, { passive: true });

  /* ================== INIT ================== */
  (async function init(){
    state.edition = getEdition();
    // Sécurité UX : vider la recherche qui pourrait filtrer à 1 item
    if (rail.search) rail.search.value = '';
    bootstrapExistingRailItems();

    renderLoadingRail();
    const auth = await ensureAuth();
    let jobCount = 0;
    if (auth.username && auth.token) {
      const res = await hydrateRailWithAuth(auth);
      if (res && !res.stale) jobCount = res.jobCount;
      else jobCount = rail.list.querySelectorAll('.rail-item').length;
    } else {
      rail.list.removeAttribute('aria-busy');
      renderEmptyRail();
    }

    // Petit rattrapage si la liste semble incomplète au premier tir
    if (jobCount <= 1) {
      setTimeout(async ()=>{
        const auth2 = await ensureAuth();
        if (auth2.username && auth2.token) await hydrateRailWithAuth(auth2);
      }, 700);
    }

    // Liste vide au 1er tir : dernier rattrapage (Memberstack / getToken souvent prêt ~2s après)
    if (!jobCount && auth.username) {
      setTimeout(async ()=>{
        if (typeof window.getToken === 'function') {
          try { window.getToken(auth.username, auth.edition); } catch {}
        }
        const auth3 = await ensureAuth(10000);
        if (auth3.username && auth3.token) await hydrateRailWithAuth(auth3);
      }, 2200);
    }
  })();
})();

