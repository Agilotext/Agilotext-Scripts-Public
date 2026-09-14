// Agilotext – Modèles de Compte-Rendu (VERSION 3.5.1 – picker search + #creer)
// Raccourcis restent à droite. Choix de modèle = select icône + nom collé à Régénérer.

(function() {
  'use strict';

  const DEBUG = false;
  const log = (...args) => { if (DEBUG) console.log('[AGILO:MODELES]', ...args); };
  const API_BASE = 'https://api.agilotext.com/api/v1';

  function agiloEditorCredsRoot() {
    const c = window.__agiloEditorCreds;
    if (!c || typeof c.pickEdition !== 'function') {
      throw new Error(
        '[AGILO:MODELES] Charger agilo-editor-creds.js avant Code-modeles-compte-rendu.js (ordre des <script> dans Webflow).'
      );
    }
    return c;
  }
  function pickEdition() {
    return agiloEditorCredsRoot().pickEdition();
  }
  function pickJobId() {
    return agiloEditorCredsRoot().pickJobId();
  }
  function pickEmail() {
    return agiloEditorCredsRoot().pickEmail();
  }
  function pickToken(edition, email) {
    return agiloEditorCredsRoot().pickToken(edition, email);
  }
  function querySummaryEditor() {
    return agiloEditorCredsRoot().querySummaryEditor();
  }

  let cachedModels = null;
  let isLoadingModels = false;
  let isPopulated = false;
  let lastPopulatedJobId = '';
  const cachedJobPromptIds = new Map();

  async function fetchGetWithRetry(url, maxAttempts) {
    var lastErr;
    var n = maxAttempts || 3;
    for (var a = 1; a <= n; a++) {
      try {
        return await fetch(url, { method: 'GET', cache: 'no-store' });
      } catch (err) {
        lastErr = err;
        if (a < n) await new Promise(function (r) { setTimeout(r, 400 * a); });
      }
    }
    throw lastErr || new Error('fetch réseau');
  }

  async function getJobPromptIdFromAPI(jobId, forceRefresh) {
    if (!jobId) return null;
    if (!forceRefresh && cachedJobPromptIds.has(jobId)) {
      return cachedJobPromptIds.get(jobId);
    }
    const email = pickEmail();
    const edition = pickEdition();
    const token = pickToken(edition, email);
    if (!email || !token) return null;
    try {
      let url = `${API_BASE}/getJobsInfo?username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}&limit=100&offset=0`;
      let res = await fetch(url, { method: 'GET', cache: 'no-store' });
      let data = await res.json();
      if (data.status === 'OK' && Array.isArray(data.jobsInfoDtos)) {
        let job = data.jobsInfoDtos.find(function (j) {
          const id = j.jobid != null ? j.jobid : j.jobId;
          return String(id) === String(jobId);
        });
        if (!job && data.jobsInfoDtos.length === 100) {
          for (let offset = 100; offset < 300; offset += 100) {
            url = `${API_BASE}/getJobsInfo?username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}&limit=100&offset=${offset}`;
            res = await fetch(url, { method: 'GET', cache: 'no-store' });
            data = await res.json();
            if (data.status === 'OK' && Array.isArray(data.jobsInfoDtos)) {
              job = data.jobsInfoDtos.find(function (j) {
                const id = j.jobid != null ? j.jobid : j.jobId;
                return String(id) === String(jobId);
              });
              if (job) break;
              if (data.jobsInfoDtos.length < 100) break;
            } else break;
          }
        }
        if (job) {
          const raw = job.promptid != null ? job.promptid : job.promptId;
          const promptId = raw && raw !== -1 && raw !== '-1' ? Number(raw) : null;
          if (promptId && !isNaN(promptId)) {
            cachedJobPromptIds.set(jobId, promptId);
            return promptId;
          }
          cachedJobPromptIds.set(jobId, null);
        }
      }
    } catch (err) {
      log('getJobsInfo', err);
    }
    return null;
  }

  function getJobPromptIdLocal(jobId) {
    if (!jobId) return null;
    try {
      const storage = localStorage.getItem('agilo:job-prompt-ids');
      if (!storage) return null;
      const data = JSON.parse(storage);
      const n = Number(data[jobId]);
      return !isNaN(n) ? n : null;
    } catch (e) {
      return null;
    }
  }

  function setJobPromptIdLocal(jobId, promptId) {
    if (!jobId || !promptId) return;
    try {
      const storage = localStorage.getItem('agilo:job-prompt-ids');
      const data = storage ? JSON.parse(storage) : {};
      data[jobId] = promptId;
      localStorage.setItem('agilo:job-prompt-ids', JSON.stringify(data));
    } catch (e) {}
  }

  function getRegenerationLimit(edition) {
    const ed = String(edition || '').toLowerCase().trim();
    if (ed.startsWith('pro')) return 2;
    if (ed === 'ent' || ed === 'business' || ed === 'enterprise' || ed === 'entreprise' || ed === 'team') return 4;
    return 0;
  }

  function getRegenerationCount(jobId) {
    if (!jobId) return 0;
    try {
      const storage = localStorage.getItem('agilo:regenerations');
      if (!storage) return 0;
      const data = JSON.parse(storage);
      return data[jobId]?.count || 0;
    } catch (e) {
      return 0;
    }
  }

  function incrementRegenerationCount(jobId, edition) {
    if (!jobId) return;
    try {
      const storage = localStorage.getItem('agilo:regenerations');
      const data = storage ? JSON.parse(storage) : {};
      if (!data[jobId]) {
        data[jobId] = {
          count: 0,
          max: getRegenerationLimit(edition),
          edition: edition,
          lastReset: new Date().toISOString()
        };
      }
      data[jobId].count += 1;
      data[jobId].lastUsed = new Date().toISOString();
      localStorage.setItem('agilo:regenerations', JSON.stringify(data));
    } catch (e) {}
  }

  function canRegenerate(jobId, edition) {
    const ed = String(edition || '').toLowerCase().trim();
    if (ed.startsWith('free') || ed === 'gratuit') {
      return { allowed: false, reason: 'free' };
    }
    const limit = getRegenerationLimit(edition);
    const count = getRegenerationCount(jobId);
    if (count >= limit) {
      return { allowed: false, reason: 'limit', count, limit };
    }
    return { allowed: true, count, limit, remaining: limit - count };
  }

  function updateExistingRegenerationCounter(jobId, edition) {
    const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
    if (!btn || !jobId) return;
    if (typeof window.updateRegenerationCounter === 'function') {
      window.updateRegenerationCounter(jobId, edition);
      return;
    }
    const canRegen = canRegenerate(jobId, edition);
    const oldCounter = btn.parentElement?.querySelector('.regeneration-counter, #regeneration-info, .regeneration-limit-message, .regeneration-premium-message');
    if (oldCounter) oldCounter.remove();
    if (canRegen.reason === 'free') return;
    if (canRegen.reason === 'limit') {
      const planName = edition === 'ent' || edition === 'business' ? 'Business' : 'Pro';
      const limitMsg = document.createElement('div');
      limitMsg.className = 'regeneration-limit-message';
      limitMsg.innerHTML =
        '<span class="regeneration-limit-icon">⚠️</span>' +
        '<div class="regeneration-limit-content">' +
        '<strong>Limite atteinte</strong>' +
        '<div class="regeneration-limit-detail">' +
        canRegen.count + '/' + canRegen.limit + ' régénération(s) utilisée(s) (plan ' + planName + ')' +
        '</div></div>';
      btn.parentElement?.appendChild(limitMsg);
      return;
    }
    const counter = document.createElement('div');
    counter.id = 'regeneration-info';
    counter.className = 'regeneration-counter';
    counter.textContent = canRegen.remaining + '/' + canRegen.limit + ' régénérations restantes';
    btn.parentElement?.appendChild(counter);
  }

  async function loadAllModels(forceRefresh) {
    if (cachedModels && !forceRefresh) return cachedModels;
    if (isLoadingModels) return cachedModels || { standard: [], custom: [], defaultId: null };

    const email = pickEmail();
    const edition = pickEdition();
    const token = pickToken(edition, email);
    if (!email || !token) {
      return { standard: [], custom: [], defaultId: null };
    }

    isLoadingModels = true;
    try {
      const [resUser, resStd] = await Promise.all([
        fetch(`${API_BASE}/getPromptModelsUserInfo?username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}`),
        fetch(`${API_BASE}/getPromptModelsStandardInfo?username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}`)
      ]);

      let userModels = [];
      let standardModels = [];
      let defaultId = null;

      if (resUser.ok) {
        const data = await resUser.json().catch(() => null);
        if (data?.status === 'OK' && Array.isArray(data.promptModeInfoDTOList)) {
          userModels = data.promptModeInfoDTOList;
          defaultId = data.defaultPromptModelId;
        }
      }
      if (resStd.ok) {
        const data = await resStd.json().catch(() => null);
        if (data?.status === 'OK' && Array.isArray(data.promptModeInfoDTOList)) {
          standardModels = data.promptModeInfoDTOList;
        }
      }

      const allMap = new Map();
      for (const m of standardModels) allMap.set(m.promptModelId, m);
      for (const m of userModels) allMap.set(m.promptModelId, m);
      const all = Array.from(allMap.values());
      const standard = all.filter(function (m) { return m.promptModelId < 100; });
      const custom = all.filter(function (m) { return m.promptModelId >= 100; });

      cachedModels = { standard, custom, defaultId };
      return cachedModels;
    } catch (err) {
      console.error('[AGILO:MODELES]', err);
      return { standard: [], custom: [], defaultId: null };
    } finally {
      isLoadingModels = false;
    }
  }

  function nameForPromptId(pack, promptId) {
    if (promptId == null || promptId === -1) return null;
    const n = Number(promptId);
    if (isNaN(n)) return null;
    const all = (pack.standard || []).concat(pack.custom || []);
    const m = all.find(function (x) { return Number(x.promptModelId) === n; });
    return m ? (m.promptModelName || ('Modèle ' + m.promptModelId)) : null;
  }

  function findModel(pack, promptId) {
    if (promptId == null) return null;
    const n = Number(promptId);
    if (isNaN(n)) return null;
    const all = (pack.standard || []).concat(pack.custom || []);
    return all.find(function (x) { return Number(x.promptModelId) === n; }) || null;
  }

  var ICON_META = { 0: 'document', 1: 'report', 2: 'idea', 3: 'briefcase', 4: 'education', 5: 'document', 7: 'document' };
  var ICON_PATHS = {
    document: '<path d="M2.75,14.25V3.75c0-1.105,.895-2,2-2h5.586c.265,0,.52,.105,.707,.293l3.914,3.914c.188,.188,.293,.442,.293,.707v7.586c0,1.105-.895,2-2,2H4.75c-1.105,0-2-.895-2-2Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><path d="M15.16,6.25h-3.41c-.552,0-1-.448-1-1V1.852" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
    custom: '<path d="m12.5717,2.9253L2.9189,12.583c-.3899.39-.3903,1.0221-.0011,1.4127l1.0852,1.0892c.391.39,1.024.39,1.415,0L15.0701,5.4269c.3898-.3901.3903-1.0221.0011-1.4127l-1.0838-1.0878c-.3904-.3918-1.0247-.3923-1.4157-.0011Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
    report: '<rect x="5.75" y="1.75" width="6.5" height="9.5" rx="3.25" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><path d="M15.25,8c0,3.452-2.798,6.25-6.25,6.25h0c-3.452,0-6.25-2.798-6.25-6.25" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
    briefcase: '<path d="M6.25,4.75V2.25c0-.552,.448-1,1-1h3.5c.552,0,1,.448,1,1v2.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><rect x="1.75" y="4.75" width="14.5" height="10.5" rx="2" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
    idea: '<rect x="7.75" y="2.75" width="2.5" height="12.5" rx="1" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><rect x="2.25" y="7.75" width="2.5" height="7.5" rx="1" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><rect x="13.25" y="11.75" width="2.5" height="3.5" rx="1" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
    education: '<path d="M9.45801 2.361L15.79 5.621C16.403 5.937 16.403 6.813 15.79 7.129L9.45801 10.389C9.17001 10.537 8.829 10.537 8.542 10.389L2.20999 7.129C1.59699 6.813 1.59699 5.937 2.20999 5.621L8.542 2.361C8.83 2.213 9.17101 2.213 9.45801 2.361Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
  };

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function resolveIconKey(m) {
    const id = Number(m && m.promptModelId);
    if (ICON_META[id]) return ICON_META[id];
    const key = String((m && m.iconKey) || '').trim();
    if (ICON_PATHS[key]) return key;
    return Number(id) >= 100 ? 'custom' : 'document';
  }

  function iconHtml(m) {
    const key = resolveIconKey(m);
    const path = ICON_PATHS[key] || ICON_PATHS.document;
    if (m && m.iconUrl) {
      return '<span class="agilo-cr-picker__ico" aria-hidden="true"><img src="' +
        escapeHtml(m.iconUrl) + '" alt="" width="16" height="16" onerror="this.hidden=true;this.nextElementSibling.hidden=false;"><svg class="agilo-cr-picker__svg" hidden width="16" height="16" viewBox="0 0 18 18" fill="none">' +
        path + '</svg></span>';
    }
    return '<span class="agilo-cr-picker__ico" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 18 18" fill="none">' + path + '</svg></span>';
  }

  function isDictationModel(m) {
    if (!m) return false;
    if (Number(m.promptModelId) === 6) return true;
    const cat = String(m.categoryKey || m.category || '').toLowerCase();
    if (cat === 'dictation' || cat === 'dictée' || cat === 'dictee') return true;
    return /dict[ée]e/i.test(String(m.promptModelName || m.cardTitle || ''));
  }

  function foldText(s) {
    return String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function modelMatchesQuery(m, q) {
    if (!q) return true;
    const blob = foldText((m.promptModelName || '') + ' ' + (m.cardTitle || ''));
    return blob.indexOf(foldText(q)) !== -1;
  }

  function visibleModels(models) {
    return (models || []).filter(function (m) { return !isDictationModel(m); });
  }

  function libraryBasePath() {
    const ed = String(pickEdition() || '').toLowerCase().trim();
    if (ed.startsWith('free') || ed === 'gratuit') return '/app/free/library';
    if (ed.startsWith('pro') || ed === 'premium') return '/app/premium/library';
    return '/app/business/library';
  }

  function removeChromeBanner() {
    const el = document.getElementById('agilo-current-model');
    if (el) el.remove();
    const rail = document.getElementById('agilo-current-model-rail');
    if (rail) rail.remove();
  }

  function renderCurrentModelBanners(model) {
    window.__agiloCurrentSummaryModel = model || { jobId: '', id: null, name: null };
    paintPickerButton();
  }

  function getToolbarRegenBtn() {
    return document.querySelector('[data-action="relancer-compte-rendu"]:not(.agilo-inline-gen-cr-btn)');
  }

  function closePickerPanel() {
    const panel = document.getElementById('agilo-cr-model-panel');
    if (panel) panel.remove();
    const host = document.getElementById('agilo-cr-model-picker');
    if (host) {
      const btn = host.querySelector('.agilo-cr-picker__btn');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
    document.removeEventListener('keydown', onPickerKeydown, true);
    document.removeEventListener('mousedown', onPickerOutside, true);
  }

  function onPickerKeydown(e) {
    if (e.key === 'Escape') closePickerPanel();
  }

  function onPickerOutside(e) {
    const host = document.getElementById('agilo-cr-model-picker');
    const panel = document.getElementById('agilo-cr-model-panel');
    if (host && host.contains(e.target)) return;
    if (panel && panel.contains(e.target)) return;
    closePickerPanel();
  }

  function positionPickerPanel(btn, panel) {
    const r = btn.getBoundingClientRect();
    const width = Math.min(280, Math.max(240, r.width));
    let left = r.left;
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
    let top = r.bottom + 4;
    panel.style.width = width + 'px';
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
    const ph = panel.getBoundingClientRect().height;
    if (top + ph > window.innerHeight - 8) {
      panel.style.top = Math.max(8, r.top - ph - 4) + 'px';
    }
  }

  function paintPickerButton() {
    const host = document.getElementById('agilo-cr-model-picker');
    if (!host) return;
    const btn = host.querySelector('.agilo-cr-picker__btn');
    if (!btn) return;
    const pack = cachedModels || { standard: [], custom: [] };
    const live = window.__agiloCurrentSummaryModel || {};
    const m = findModel(pack, live.id);
    const name = (m && (m.promptModelName || m.cardTitle)) || live.name;
    btn.innerHTML = '';
    if (m) {
      btn.insertAdjacentHTML('afterbegin', iconHtml(m));
    } else {
      btn.insertAdjacentHTML('afterbegin', iconHtml({ promptModelId: 0 }));
    }
    const label = document.createElement('span');
    label.className = 'agilo-cr-picker__title';
    label.textContent = name || 'Choisir un modèle';
    label.title = label.textContent;
    btn.appendChild(label);
    const chev = document.createElement('span');
    chev.className = 'agilo-cr-picker__chev';
    chev.setAttribute('aria-hidden', 'true');
    chev.textContent = '▾';
    btn.appendChild(chev);
  }

  function openPickerPanel(pack, defaultId, jobPromptId, isFree) {
    closePickerPanel();
    const host = document.getElementById('agilo-cr-model-picker');
    const btn = host && host.querySelector('.agilo-cr-picker__btn');
    if (!btn) return;
    btn.setAttribute('aria-expanded', 'true');
    const panel = document.createElement('div');
    panel.id = 'agilo-cr-model-panel';
    panel.className = 'agilo-cr-picker__panel';
    panel.setAttribute('role', 'listbox');

    const stdAll = visibleModels(pack.standard);
    const customAll = visibleModels(pack.custom);
    const showSearch = (stdAll.length + customAll.length) >= 8 || customAll.length > 0;

    const list = document.createElement('div');
    list.id = 'agilo-cr-model-list';
    list.className = 'agilo-cr-picker__list';

    function paintList(query) {
      list.innerHTML = '';
      const q = String(query || '').trim();
      let painted = 0;

      function addSection(title, models) {
        const visible = visibleModels(models).filter(function (m) { return modelMatchesQuery(m, q); });
        if (!visible.length) return;
        const sec = document.createElement('div');
        sec.className = 'agilo-cr-picker__sec';
        sec.textContent = title;
        list.appendChild(sec);
        visible.forEach(function (m) {
          painted += 1;
          const row = document.createElement('button');
          row.type = 'button';
          row.className = 'agilo-cr-picker__opt';
          row.setAttribute('role', 'option');
          const idNum = Number(m.promptModelId);
          const isUsed = jobPromptId != null && idNum === Number(jobPromptId);
          const isDef = defaultId != null && idNum === Number(defaultId);
          if (isUsed) {
            row.classList.add('is-active');
            row.setAttribute('aria-current', 'true');
            row.setAttribute('aria-selected', 'true');
          }
          if (isFree && !isUsed) {
            row.classList.add('is-locked');
            row.setAttribute('data-plan-min', 'pro');
            row.setAttribute('data-upgrade-reason', 'Régénération avec le modèle « ' + (m.promptModelName || '') + ' »');
          }
          row.insertAdjacentHTML('beforeend', iconHtml(m));
          row.dataset.promptId = String(m.promptModelId);
          const body = document.createElement('span');
          body.className = 'agilo-cr-picker__opt-label';
          const nm = m.promptModelName || ('Modèle ' + m.promptModelId);
          body.textContent = nm;
          body.title = nm;
          row.appendChild(body);
          if (isUsed || isDef) {
            const badge = document.createElement('span');
            badge.className = 'agilo-cr-picker__badge';
            badge.textContent = isUsed ? 'Actuel' : 'Défaut';
            row.appendChild(badge);
          }
          if (isUsed) {
            row.addEventListener('click', function (e) { e.preventDefault(); closePickerPanel(); });
          } else if (!isFree) {
            row.addEventListener('click', function () {
              closePickerPanel();
              handleChipClick(m);
            });
          }
          list.appendChild(row);
        });
      }

      addSection('Standards', pack.standard);
      addSection('Mes modèles', pack.custom);
      if (!painted) {
        const empty = document.createElement('div');
        empty.className = 'agilo-cr-picker__empty';
        empty.textContent = 'Aucun modèle';
        list.appendChild(empty);
      }
      positionPickerPanel(btn, panel);
      if (isFree && typeof window.AgiloGate !== 'undefined' && window.AgiloGate.decorate) {
        setTimeout(function () { window.AgiloGate.decorate(); }, 80);
      }
    }

    if (showSearch) {
      const search = document.createElement('input');
      search.type = 'search';
      search.className = 'agilo-cr-picker__search';
      search.placeholder = 'Rechercher un modèle';
      search.setAttribute('autocomplete', 'off');
      search.setAttribute('aria-label', 'Rechercher un modèle');
      search.addEventListener('input', function () { paintList(search.value); });
      search.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const rows = list.querySelectorAll('.agilo-cr-picker__opt:not(.is-active)');
        if (rows.length !== 1) return;
        const row = rows[0];
        if (row.classList.contains('is-locked')) {
          const locked = findModel(pack, row.getAttribute('data-prompt-id'));
          if (locked) handleChipClick(locked);
          return;
        }
        row.click();
      });
      panel.appendChild(search);
    }

    panel.appendChild(list);

    const foot = document.createElement('div');
    foot.className = 'agilo-cr-picker__foot';
    const base = libraryBasePath();
    const a1 = document.createElement('a');
    a1.href = base;
    a1.target = '_blank';
    a1.rel = 'noopener';
    a1.textContent = 'Tous les modèles';
    const a2 = document.createElement('a');
    a2.href = base + '#creer';
    a2.target = '_blank';
    a2.rel = 'noopener';
    a2.textContent = 'Créer un modèle';
    foot.appendChild(a1);
    foot.appendChild(a2);
    panel.appendChild(foot);

    document.body.appendChild(panel);
    paintList('');
    positionPickerPanel(btn, panel);
    document.addEventListener('keydown', onPickerKeydown, true);
    document.addEventListener('mousedown', onPickerOutside, true);
    const searchEl = panel.querySelector('.agilo-cr-picker__search');
    if (searchEl) {
      setTimeout(function () { searchEl.focus(); }, 0);
    }
  }

  function ensurePickerHost() {
    let host = document.getElementById('agilo-cr-model-picker');
    const btnRegen = getToolbarRegenBtn();
    if (!btnRegen || !btnRegen.parentElement) return host;
    if (!host) {
      host = document.createElement('div');
      host.id = 'agilo-cr-model-picker';
      host.className = 'agilo-cr-picker';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'agilo-cr-picker__btn';
      b.setAttribute('aria-haspopup', 'listbox');
      b.setAttribute('aria-expanded', 'false');
      b.setAttribute('aria-label', 'Modèle de compte-rendu');
      host.appendChild(b);
      btnRegen.parentElement.insertBefore(host, btnRegen);
    } else if (host.parentElement !== btnRegen.parentElement) {
      btnRegen.parentElement.insertBefore(host, btnRegen);
    }
    return host;
  }

  function mountPicker(pack, defaultId, jobPromptId, isFree) {
    removeChromeBanner();
    const host = ensurePickerHost();
    if (!host) return;
    host.hidden = !isSummaryTabActive();
    const btn = host.querySelector('.agilo-cr-picker__btn');
    if (btn && !btn._agiloBound) {
      btn._agiloBound = true;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        if (!isSummaryTabActive()) return;
        const open = document.getElementById('agilo-cr-model-panel');
        if (open) { closePickerPanel(); return; }
        var packNow = cachedModels || { standard: [], custom: [], defaultId: null };
        var liveNow = window.__agiloCurrentSummaryModel || {};
        var edNow = String(pickEdition() || '').toLowerCase().trim();
        var freeNow = edNow.startsWith('free') || edNow === 'gratuit';
        openPickerPanel(packNow, packNow.defaultId, liveNow.id, freeNow);
      });
    }
    paintPickerButton();
  }

  window.agiloResolveSummaryModel = async function (jobId) {
    const live = window.__agiloCurrentSummaryModel;
    if (live && String(live.jobId) === String(jobId) && (live.id || live.name)) {
      return live;
    }
    const pack = await loadAllModels(false);
    let id = null;
    if (jobId) {
      id = await getJobPromptIdFromAPI(jobId, false);
      if (id == null) id = getJobPromptIdLocal(jobId);
      if (id != null) {
        const n = Number(id);
        id = isNaN(n) || n === -1 ? null : n;
      }
    }
    const model = {
      jobId: String(jobId || ''),
      id: id,
      name: nameForPromptId(pack, id)
    };
    renderCurrentModelBanners(model);
    return model;
  };

  let isGenerating = false;

  function initLottieAnimation(element) {
    if (window.Webflow && window.Webflow.require) {
      try {
        const ix2 = window.Webflow.require('ix2');
        if (ix2 && typeof ix2.init === 'function') {
          setTimeout(function () { ix2.init(); }, 100);
        }
      } catch (e) {}
    }
    if (window.lottie && typeof window.lottie.loadAnimation === 'function') {
      try {
        if (!element._lottie) {
          element._lottie = window.lottie.loadAnimation({
            container: element,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            path: 'https://cdn.prod.website-files.com/6815bee5a9c0b57da18354fb/6815bee5a9c0b57da18355b3_Animation%20-%201705419825493.json'
          });
        }
      } catch (e) {}
    }
  }

  function hideSummaryRegenLoader() {
    const summaryEditor = querySummaryEditor();
    if (!summaryEditor) return;
    const loader = summaryEditor.querySelector('.summary-loading-indicator');
    if (loader) loader.style.display = 'none';
  }

  /** Loader aligné relance-compte-rendu : pas de décompte ; le texte de statut est mis à jour par le polling. */
  function showSummaryRegenLoader(modelName) {
    const summaryEditor = querySummaryEditor();
    if (!summaryEditor) return null;

    summaryEditor.innerHTML = '';
    const loaderContainer = document.createElement('div');
    loaderContainer.className = 'summary-loading-indicator';

    let lottieElement = document.querySelector('#loading-summary');
    if (!lottieElement) {
      lottieElement = document.createElement('div');
      lottieElement.id = 'loading-summary-model';
      lottieElement.className = 'lottie-check-statut';
      lottieElement.setAttribute('data-animation-type', 'lottie');
      lottieElement.setAttribute('data-src', 'https://cdn.prod.website-files.com/6815bee5a9c0b57da18354fb/6815bee5a9c0b57da18355b3_Animation%20-%201705419825493.json');
      lottieElement.setAttribute('data-loop', '1');
      lottieElement.setAttribute('data-autoplay', '1');
      lottieElement.setAttribute('data-renderer', 'svg');
    } else {
      lottieElement = lottieElement.cloneNode(true);
      lottieElement.id = 'loading-summary-model';
    }

    const loadingText = document.createElement('p');
    loadingText.className = 'loading-text';
    loadingText.textContent =
      window.__agiloSummaryRegenHelpers && window.__agiloSummaryRegenHelpers.POLL_STATUS_USER_TEXT
        ? window.__agiloSummaryRegenHelpers.POLL_STATUS_USER_TEXT
        : 'Génération du compte-rendu en cours…';
    const loadingSubtitle = document.createElement('p');
    loadingSubtitle.className = 'loading-subtitle';
    if (modelName) {
      loadingSubtitle.appendChild(document.createTextNode('Modèle : '));
      const strong = document.createElement('strong');
      strong.textContent = String(modelName);
      loadingSubtitle.appendChild(strong);
    }

    const statusEl = document.createElement('p');
    statusEl.className = 'loading-status-hint';
    statusEl.textContent =
      window.__agiloSummaryRegenHelpers && window.__agiloSummaryRegenHelpers.POLL_STATUS_USER_TEXT
        ? window.__agiloSummaryRegenHelpers.POLL_STATUS_USER_TEXT
        : 'Génération du compte-rendu en cours…';

    summaryEditor.appendChild(loaderContainer);
    loaderContainer.appendChild(lottieElement);
    loaderContainer.appendChild(loadingText);
    if (modelName) loaderContainer.appendChild(loadingSubtitle);
    loaderContainer.appendChild(statusEl);

    setTimeout(function () {
      initLottieAnimation(lottieElement);
      setTimeout(function () {
        const hasLottie = lottieElement.querySelector('svg, canvas') || lottieElement._lottie;
        if (!hasLottie) {
          const fallback = document.createElement('div');
          fallback.className = 'lottie-fallback';
          lottieElement.style.display = 'none';
          loaderContainer.insertBefore(fallback, lottieElement);
        }
      }, 1000);
    }, 100);

    return { loaderContainer: loaderContainer, statusEl: statusEl };
  }

  async function handleChipClick(model) {
    if (isGenerating) return;

    const jobId = pickJobId();
    const email = pickEmail();
    const edition = pickEdition();
    const token = pickToken(edition, email);

    if (!jobId || !email || !token) {
      alert('Informations manquantes. Rechargez la page.');
      return;
    }

    const ed = String(edition || '').toLowerCase().trim();
    const isFree = ed.startsWith('free') || ed === 'gratuit';
    if (isFree) {
      const modelName = model.promptModelName || 'Modèle ' + model.promptModelId;
      if (typeof window.AgiloGate !== 'undefined' && window.AgiloGate.showUpgrade) {
        window.AgiloGate.showUpgrade('pro', 'Régénération avec le modèle « ' + modelName + ' »');
      } else {
        alert('Cette fonctionnalité nécessite un abonnement Pro ou Business.');
      }
      return;
    }

    const canRegen = canRegenerate(jobId, edition);
    if (!canRegen.allowed) {
      if (canRegen.reason === 'limit') {
        alert('Limite atteinte: ' + canRegen.count + '/' + canRegen.limit + ' régénération(s) pour ce transcript.');
      }
      return;
    }

    const modelName = model.promptModelName || 'Modèle ' + model.promptModelId;
    const confirmed = confirm(
      'Remplacer le compte-rendu actuel ?\n\n' +
        'Modèle : ' +
        modelName +
        '\n\n' +
        canRegen.remaining +
        '/' +
        canRegen.limit +
        ' régénération(s) restante(s).\n\n' +
        'L’interface se mettra à jour automatiquement dès que la génération est terminée.'
    );
    if (!confirmed) return;

    const H0 = window.__agiloSummaryRegenHelpers;
    var priorSummaryContentHash = '';
    if (H0 && typeof H0.fetchPriorSummaryContentHash === 'function') {
      try {
        priorSummaryContentHash = await H0.fetchPriorSummaryContentHash(jobId, email, token, edition);
      } catch (e) {
        log('fetchPriorSummaryContentHash', e);
      }
    }

    isGenerating = true;
    try {
      const url = API_BASE + '/redoSummary?jobId=' + encodeURIComponent(jobId) +
        '&username=' + encodeURIComponent(email) +
        '&token=' + encodeURIComponent(token) +
        '&edition=' + encodeURIComponent(edition) +
        '&promptId=' + encodeURIComponent(model.promptModelId);

      const res = await fetchGetWithRetry(url, 3);
      const data = await res.json();

      if (data.status === 'OK' || res.ok) {
        incrementRegenerationCount(jobId, edition);
        updateExistingRegenerationCounter(jobId, edition);
        setJobPromptIdLocal(jobId, model.promptModelId);
        cachedJobPromptIds.set(jobId, Number(model.promptModelId));
        try {
          sessionStorage.setItem('agilo:summaryPromptId:' + jobId, String(model.promptModelId));
        } catch (_) {}
        if (typeof window.toast === 'function') {
          window.toast('Régénération lancée avec « ' + modelName + ' »…');
        }
        const summaryTab = document.querySelector('#tab-summary');
        if (summaryTab) summaryTab.click();

        const summaryEditorClear = querySummaryEditor();
        if (summaryEditorClear) summaryEditorClear.innerHTML = '';

        // ✅ Anti-écran-blanc : flag global piloté par relance-compte-rendu.js
        // (un MutationObserver y réinjecte le loader si l'orchestrateur écrase
        //  summaryEditor pendant la régénération).
        window.__agiloSummaryRegenInProgress = jobId;
        if (window.__agiloSummaryRegenHelpers && typeof window.__agiloSummaryRegenHelpers.emitSummaryPending === 'function') {
          window.__agiloSummaryRegenHelpers.emitSummaryPending(jobId);
        } else {
          window.dispatchEvent(new CustomEvent('agilo:summary-pending', { detail: { jobId: String(jobId || '') } }));
        }

        const ui = showSummaryRegenLoader(modelName);
        const H = window.__agiloSummaryRegenHelpers;
        if (H && typeof H.startSummaryLoaderPersistence === 'function') {
          try { H.startSummaryLoaderPersistence(); } catch (_) {}
        }

        if (!ui || !ui.statusEl) {
          isGenerating = false;
        } else if (H && typeof H.waitForSummaryTerminalState === 'function') {
          if (typeof H.formatPollStatusLabel === 'function') {
            ui.statusEl.textContent = H.formatPollStatusLabel(null);
          }
          H.waitForSummaryTerminalState(
            jobId,
            email,
            token,
            edition,
            ui.statusEl,
            function () {
              return false;
            },
            priorSummaryContentHash
          )
            .then(async function (outcome) {
              // ✅ Mobile-style : depuis la branche 1.06, waitForSummaryTerminalState ne
              // retourne JAMAIS 'error' — uniquement 'ready', 'cancelled' ou 'timeout'.
              window.__agiloSummaryRegenInProgress = false;
              if (typeof H.hideSummaryLoading === 'function') H.hideSummaryLoading();
              else hideSummaryRegenLoader();
              if (outcome === 'cancelled') {
                isGenerating = false;
                if (typeof H.emitSummaryReady === 'function') H.emitSummaryReady(jobId);
                else window.dispatchEvent(new CustomEvent('agilo:summary-ready', { detail: { jobId: String(jobId || '') } }));
                return;
              }
              if (outcome === 'ready') {
                if (typeof H.refreshSummaryInEditorWithFallback === 'function') {
                  H.refreshSummaryInEditorWithFallback(jobId, function () {
                    return false;
                  });
                }
                if (typeof window.toast === 'function') window.toast('Compte-rendu prêt');
                isGenerating = false;
                if (typeof H.emitSummaryReady === 'function') H.emitSummaryReady(jobId);
                else window.dispatchEvent(new CustomEvent('agilo:summary-ready', { detail: { jobId: String(jobId || '') } }));
                try {
                  isPopulated = false;
                  cachedModels = null;
                  populateContainer(true);
                } catch (e) {}
                return;
              }
              // outcome === 'timeout' (~25 min) ou outcome === 'error' (mort code, défensif).
              var finalOk =
                typeof H.tryFinalSummaryRecover === 'function'
                  ? await H.tryFinalSummaryRecover(jobId, email, token, edition, priorSummaryContentHash)
                  : false;
              if (finalOk) {
                if (typeof H.refreshSummaryInEditorWithFallback === 'function') {
                  H.refreshSummaryInEditorWithFallback(jobId, function () {
                    return false;
                  });
                }
                if (typeof window.toast === 'function') window.toast('Compte-rendu prêt');
              } else if (typeof H.showSummaryStalledToast === 'function') {
                H.showSummaryStalledToast(
                  jobId,
                  'délai d’attente atteint — actualisez la page (job ' + jobId + ').'
                );
              } else if (typeof window.toast === 'function') {
                window.toast('Délai d’attente. Actualisez la page pour vérifier le compte-rendu.');
              }
              isGenerating = false;
              if (typeof H.emitSummaryReady === 'function') H.emitSummaryReady(jobId);
              else window.dispatchEvent(new CustomEvent('agilo:summary-ready', { detail: { jobId: String(jobId || '') } }));
              try {
                isPopulated = false;
                cachedModels = null;
                populateContainer(true);
              } catch (e) {}
            })
            .catch(function (e) {
              log('waitForSummaryTerminalState', e);
              window.__agiloSummaryRegenInProgress = false;
              if (typeof H.hideSummaryLoading === 'function') H.hideSummaryLoading();
              else hideSummaryRegenLoader();
              isGenerating = false;
              if (typeof H.showSummaryStalledToast === 'function') {
                H.showSummaryStalledToast(
                  jobId,
                  'impossible de vérifier le statut — actualisez (job ' + jobId + ').'
                );
              } else {
                if (typeof window.toast === 'function') {
                  window.toast('Impossible de vérifier le statut. Actualisez la page.');
                }
              }
              if (typeof H.emitSummaryReady === 'function') H.emitSummaryReady(jobId);
              else window.dispatchEvent(new CustomEvent('agilo:summary-ready', { detail: { jobId: String(jobId || '') } }));
            });
        } else {
          ui.statusEl.textContent =
            'Script « relance-compte-rendu » introuvable ou obsolète. Actualisation du job dans quelques secondes…';
          setTimeout(function () {
            try {
              window.dispatchEvent(new CustomEvent('agilo:beforeload', { detail: { jobId: jobId } }));
              if (window.__agiloOrchestrator && typeof window.__agiloOrchestrator.loadJob === 'function') {
                window.__agiloOrchestrator.loadJob(jobId, { autoplay: false });
              } else {
                window.dispatchEvent(new CustomEvent('agilo:load', { detail: { jobId: jobId, autoplay: false } }));
              }
            } catch (e2) {}
            hideSummaryRegenLoader();
            isGenerating = false;
          }, 4000);
        }
      } else if (data.status === 'KO') {
        isGenerating = false;
        alert('Une génération est déjà en cours. Patientez un instant.');
      } else {
        isGenerating = false;
        alert('Erreur: ' + (data.errorMessage || data.message || 'Réessayez.'));
      }
    } catch (err) {
      isGenerating = false;
      console.error('[AGILO:MODELES]', err);
      alert('Erreur réseau. Vérifiez la connexion.');
    }
  }

  function injectStyles() {
    ['#agilo-modeles-styles', '#agilo-modeles-styles-v4', '#agilo-modeles-styles-v5', '#agilo-modeles-styles-v6', '#agilo-modeles-styles-v7', '#agilo-modeles-styles-v8', '#agilo-modeles-styles-v9', '#agilo-tpl-styles-v3'].forEach(function (sel) {
      const n = document.querySelector(sel);
      if (n) n.remove();
    });

    const style = document.createElement('style');
    style.id = 'agilo-modeles-styles-v9';
    style.textContent = `
      [data-view="templates"],
      #cr-template-chips,
      #agilo-current-model,
      #agilo-current-model-rail {
        display: none !important;
      }

      .agilo-cr-picker {
        display: inline-flex;
        align-items: center;
        margin-right: 8px;
        max-width: 240px;
        vertical-align: middle;
      }
      .agilo-cr-picker[hidden] { display: none !important; }
      .agilo-cr-picker__btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        max-width: 240px;
        min-height: 36px;
        padding: 4px 8px 4px 6px;
        border: 1px solid rgba(52, 58, 64, 0.18);
        border-radius: 8px;
        background: #fff;
        color: #020202;
        font: 500 13px/1.25 system-ui, -apple-system, sans-serif;
        cursor: pointer;
        box-sizing: border-box;
      }
      .agilo-cr-picker__btn:hover { background: #f8f9fa; }
      .agilo-cr-picker__btn[aria-expanded="true"] {
        border-color: #174a96;
        box-shadow: 0 0 0 2px rgba(23, 74, 150, 0.12);
      }
      .agilo-cr-picker__ico {
        flex: 0 0 16px;
        width: 16px;
        height: 16px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #174a96;
      }
      .agilo-cr-picker__ico img,
      .agilo-cr-picker__ico svg {
        width: 16px;
        height: 16px;
        display: block;
      }
      .agilo-cr-picker__title {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-align: left;
      }
      .agilo-cr-picker__chev {
        flex: 0 0 auto;
        font-size: 10px;
        opacity: 0.55;
        line-height: 1;
      }
      .agilo-cr-picker__panel {
        position: fixed;
        z-index: 2147483000;
        max-height: min(70vh, 420px);
        overflow: auto;
        background: #fff;
        border: 1px solid rgba(52, 58, 64, 0.18);
        border-radius: 10px;
        box-shadow: 0 8px 28px rgba(2, 2, 2, 0.16);
        padding: 0;
        box-sizing: border-box;
      }
      .agilo-cr-picker__search {
        position: sticky;
        top: 0;
        z-index: 1;
        display: block;
        width: 100%;
        box-sizing: border-box;
        margin: 0;
        padding: 8px 12px;
        border: none;
        border-bottom: 1px solid rgba(52, 58, 64, 0.12);
        background: #fff;
        color: #020202;
        font: 400 13px/1.3 system-ui, -apple-system, sans-serif;
        outline: none;
      }
      .agilo-cr-picker__search:focus {
        border-bottom-color: #174a96;
      }
      .agilo-cr-picker__list { padding-top: 4px; }
      .agilo-cr-picker__empty {
        padding: 12px 12px 10px;
        font: 400 13px/1.3 system-ui, -apple-system, sans-serif;
        color: #525252;
      }
      .agilo-cr-picker__sec {
        padding: 8px 12px 4px;
        font: 600 11px/1.2 system-ui, -apple-system, sans-serif;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: #525252;
      }
      .agilo-cr-picker__opt {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        min-height: 40px;
        padding: 6px 12px;
        border: none;
        background: transparent;
        color: #020202;
        font: 500 13px/1.3 system-ui, -apple-system, sans-serif;
        text-align: left;
        cursor: pointer;
        box-sizing: border-box;
      }
      .agilo-cr-picker__opt:hover { background: rgba(23, 74, 150, 0.06); }
      .agilo-cr-picker__opt.is-active {
        background: rgba(23, 74, 150, 0.1);
        font-weight: 600;
      }
      .agilo-cr-picker__opt.is-locked {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .agilo-cr-picker__opt-label {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .agilo-cr-picker__badge {
        flex-shrink: 0;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        color: #174a96;
      }
      .agilo-cr-picker__foot {
        display: flex;
        gap: 12px;
        padding: 8px 12px 10px;
        margin-top: 4px;
        border-top: 1px solid rgba(52, 58, 64, 0.12);
      }
      .agilo-cr-picker__foot a {
        font: 500 12px/1.3 system-ui, -apple-system, sans-serif;
        color: #174a96;
        text-decoration: none;
      }
      .agilo-cr-picker__foot a:hover { text-decoration: underline; }

      .summary-loading-indicator {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 3.75rem 1.25rem;
        text-align: center;
        min-height: 18.75rem;
        background: #ffffff;
        animation: agilo-fadeIn 0.3s ease-out;
      }
      @keyframes agilo-fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .summary-loading-indicator #loading-summary-model,
      .summary-loading-indicator .lottie-check-statut {
        width: 5.5rem;
        height: 5.5rem;
        margin: 0 auto 1.5rem;
        display: block;
      }
      .summary-loading-indicator .lottie-fallback {
        width: 5.5rem;
        height: 5.5rem;
        margin: 0 auto 1.5rem;
        border: 4px solid rgba(52, 58, 64, 0.25);
        border-top: 4px solid #174a96;
        border-radius: 50%;
        animation: agilo-spin 1s linear infinite;
      }
      @keyframes agilo-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .summary-loading-indicator .loading-text {
        font: 500 1rem/1.35 system-ui, -apple-system, sans-serif;
        color: #020202;
        margin-top: 0.5rem;
      }
      .summary-loading-indicator .loading-subtitle {
        font: 400 0.875rem/1.4 system-ui, -apple-system, sans-serif;
        color: #525252;
        margin-top: 0.5rem;
      }
      .summary-loading-indicator .loading-status-hint {
        font: 400 0.875rem/1.45 system-ui, -apple-system, sans-serif;
        color: #525252;
        margin: 0.75rem 1rem 0;
        text-align: center;
        max-width: 28rem;
      }
    `;
    document.head.appendChild(style);
  }

  async function populateContainer(forceRefresh) {
    const jobId = pickJobId();
    if (!forceRefresh && isPopulated && lastPopulatedJobId === jobId && document.getElementById('agilo-cr-model-picker')) {
      mountPicker(cachedModels || { standard: [], custom: [], defaultId: null }, (cachedModels && cachedModels.defaultId) || null, (window.__agiloCurrentSummaryModel && window.__agiloCurrentSummaryModel.id) || null, (function () {
        const ed = String(pickEdition() || '').toLowerCase().trim();
        return ed.startsWith('free') || ed === 'gratuit';
      })());
      return;
    }

    const pack = await loadAllModels(forceRefresh);
    const defaultId = pack.defaultId;

    let jobPromptId = null;
    if (jobId) {
      jobPromptId = await getJobPromptIdFromAPI(jobId, !!forceRefresh);
      if (jobPromptId == null || jobPromptId === -1) {
        jobPromptId = getJobPromptIdLocal(jobId);
      }
      if (jobPromptId != null) {
        const n = Number(jobPromptId);
        jobPromptId = isNaN(n) ? null : n;
      }
    }

    const edition = pickEdition();
    const ed = String(edition || '').toLowerCase().trim();
    const isFree = ed.startsWith('free') || ed === 'gratuit';

    const currentNum = jobPromptId != null ? Number(jobPromptId) : NaN;
    const currentId = (!isNaN(currentNum) && currentNum !== -1) ? currentNum : null;
    const currentValid = currentId != null;
    renderCurrentModelBanners({
      jobId: String(jobId || ''),
      id: currentValid ? currentId : null,
      name: nameForPromptId(pack, currentValid ? currentId : null)
    });

    mountPicker(pack, defaultId, jobPromptId, isFree);

    if (jobId) updateExistingRegenerationCounter(jobId, edition);

    isPopulated = true;
    lastPopulatedJobId = jobId || '';

    if (jobId && (jobPromptId == null || jobPromptId === -1)) {
      setTimeout(async function () {
        const retry = await getJobPromptIdFromAPI(jobId, true);
        if (retry != null && retry !== jobPromptId) {
          cachedModels = null;
          isPopulated = false;
          await populateContainer(true);
        }
      }, 2000);
    }
  }

  function isSummaryTabActive() {
    const tab = document.querySelector('[role="tab"][aria-selected="true"]');
    return tab?.id === 'tab-summary' || (tab?.id && tab.id.includes('summary'));
  }

  function hasSummaryContent() {
    const root = document.querySelector('#editorRoot');
    if (root?.dataset.summaryEmpty === '1') return false;
    const el = querySummaryEditor();
    if (!el) return false;
    const txt = (el.textContent || '').toLowerCase();
    if (txt.includes('pas encore disponible') || txt.includes('fichier manquant')) return false;
    return true;
  }

  let debounceTimer = null;
  function debouncedPopulate() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () { populateContainer(false); }, 280);
  }

  function switchView() {
    const iaView = document.querySelector('[data-view="ia"]');
    const templatesView = document.querySelector('[data-view="templates"]');
    if (iaView) iaView.style.display = 'block';
    if (templatesView) templatesView.style.display = 'none';
    removeChromeBanner();
    const host = document.getElementById('agilo-cr-model-picker');
    const onSummary = isSummaryTabActive();
    if (host) host.hidden = !onSummary;
    if (!onSummary) closePickerPanel();
    if (onSummary) debouncedPopulate();
  }

  function init() {
    if (window.__agiloModelesInitialized) return;
    window.__agiloModelesInitialized = true;

    injectStyles();
    const firstJob = pickJobId();
    if (firstJob && typeof window.agiloResolveSummaryModel === 'function') {
      window.agiloResolveSummaryModel(firstJob).catch(function () {});
    }

    let lastJobId = pickJobId();
    setInterval(function () {
      const cur = pickJobId();
      if (cur && cur !== lastJobId) {
        lastJobId = cur;
        isPopulated = false;
        cachedModels = null;
        window.__agiloCurrentSummaryModel = { jobId: cur, id: null, name: null };
        if (typeof window.agiloResolveSummaryModel === 'function') {
          window.agiloResolveSummaryModel(cur).catch(function () {});
        }
        debouncedPopulate();
      }
    }, 2000);

    document.addEventListener('click', function (e) {
      if (e.target.closest('[role="tab"]')) {
        const t = e.target.closest('[role="tab"]');
        if (t && t.id && !t.id.includes('summary')) {
          isPopulated = false;
        }
        setTimeout(switchView, 100);
      }
    });

    const summaryEl = querySummaryEditor();
    if (summaryEl) {
      const obs = new MutationObserver(function () {
        if (isGenerating) return;
        setTimeout(switchView, 200);
      });
      obs.observe(summaryEl, { childList: true, subtree: true });
    }

    setTimeout(switchView, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }
})();
