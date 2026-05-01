// Agilotext — Mes transcripts : bulk export / webhook / suppression (+ confirm modale)
// Source: extrait de l’embed Webflow ; à servir via jsDelivr.
//
// Si un ANCIEN embed inline a déjà défini AgilotextBulk, tout le bloc ci‑dessous est ignoré
// (voir `if (window.AgilotextBulk) return`). Le correctif suivant garantit tout de même la
// poubelle par ligne (`window.confirm`). Retirez tout script inline dupliqué et ne garde
// QUE ce fichier pour retrouver la modale Agilo unifiée.

/** Paramètre API `edition` : dérivé du chemin (/app/free/, /app/pro/, /app/business/, …). */
(function registerAgiloBulkApiEdition() {
  if (typeof window.agiloBulkApiEdition === 'function') return;
  window.agiloBulkApiEdition = function agiloBulkApiEdition() {
    const p = window.location.pathname || '';
    if (p.includes('/app/free/')) return 'free';
    if (p.includes('/app/pro/') || p.includes('/app/premium/')) return 'pro';
    if (p.includes('/app/ent/') || p.includes('/app/business/')) return 'ent';
    return 'ent';
  };
})();

(function agiloMesTranscriptsRowTrashFallback() {
  if (window.__agiloMesTranscriptsRowTrashFallback) return;
  window.__agiloMesTranscriptsRowTrashFallback = true;

  document.addEventListener(
    'click',
    async function agiloMesTranscriptsRowTrashFallbackClick(ev) {
      if (window.__agiloRowTrashHandledByBulk) return;

      const btn = ev.target && ev.target.closest && ev.target.closest('.delete-job-button_to-confirm');
      if (!btn || btn.id === 'bulkDeleteBtn') return;

      const row = btn.closest('.wrapper-content_item-row[data-job-id]');
      if (!row) return;

      const jobsRoot = document.getElementById('jobs-container');
      if (!jobsRoot || !jobsRoot.contains(btn)) return;

      ev.preventDefault();

      try {
        if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette transcription ?')) return;
      } catch (_) {
        return;
      }

      const emailEl = document.querySelector('[name="memberEmail"]');
      const email = (
        emailEl?.value ||
        emailEl?.getAttribute('src') ||
        emailEl?.textContent ||
        ''
      ).trim();
      const token = typeof globalToken !== 'undefined' && globalToken ? globalToken : null;
      if (!token) {
        window.alert('Session indisponible (token). Rechargez la page.');
        return;
      }
      if (!email) {
        window.alert('Email utilisateur introuvable.');
        return;
      }

      const jobId = row.getAttribute('data-job-id');
      if (!jobId) return;

      const apiBase = jobsRoot.dataset.apiBase || 'https://api.agilotext.com/api/v1';
      const edition = window.agiloBulkApiEdition();
      const url =
        `${apiBase}/deleteJob?username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}` +
        `&jobId=${encodeURIComponent(jobId)}&edition=${encodeURIComponent(edition)}`;

      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      try {
        const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
        const data = await res.json().catch(() => ({}));
        if (data.status === 'OK') {
          row.remove();
          try {
            const all = Array.from(document.querySelectorAll('#jobs-container .wrapper-content_item-row .job-select'));
            const checked = all.filter(function (cb) { return cb.checked; });
            const countEl = document.getElementById('selected-count');
            if (countEl) countEl.textContent = checked.length + ' sélectionné(s)';
            const selectAll = document.getElementById('select-all');
            if (selectAll && all.length) {
              if (checked.length === 0) { selectAll.checked = false; selectAll.indeterminate = false; }
              else if (checked.length === all.length) { selectAll.checked = true; selectAll.indeterminate = false; }
              else { selectAll.checked = false; selectAll.indeterminate = true; }
            }
          } catch (_) {}
        } else {
          window.alert(data.errorMessage || data.message || 'Suppression impossible.');
        }
      } catch (err) {
        window.alert(err && err.message ? err.message : 'Erreur réseau.');
      } finally {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
      }
    },
    true
  );
})();

(() => {
  if (window.AgilotextBulk) {
    console.warn(
      '[Agilotext] Embed AgilotextBulk déjà présent (souvent un ancien bloc Webflow avant jsDelivr). ' +
      'La poubelle par ligne passe par un secours avec confirm navigateur tant que vous ne supprimez pas le doublon. ' +
      'Retirez tout script inline équivalent puis ne chargez que ce fichier (v2.4.3).'
    );
    return;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Helpers: tier-aware URLs (/app/{tier}/...)
  // ───────────────────────────────────────────────────────────────────────────
  function getAppTier() {
    const m = location.pathname.match(/^\/app\/([^\/]+)/);
    return m ? m[1] : null;
  }
  function appUrl(subpath = "") {
    const tier = getAppTier() || "business";
    const clean = String(subpath).replace(/^\/+/, "");
    return `/app/${tier}/${clean}`;
  }

  /** Même convention que Code-mes-transcripts-logic.js (URLs → paramètre API `edition`). */
  function apiEditionFromUrl() {
    return window.agiloBulkApiEdition();
  }

  function injectDialogTheme() {
    if (document.getElementById('agilo-dialog-theme')) return;
    const css = `
    .agilo-overlay{position:fixed; inset:0; display:none; z-index:99999; background: var(--agilo-overlay, rgba(0,0,0,.35));}
    .agilo-modal{max-width:560px; margin:6vh auto; background:var(--color--white); border-radius: var(--0-5_radius); box-shadow: var(--agilo-shadow, 0 10px 30px rgba(0,0,0,.2)); overflow:hidden; color: var(--color--gris_foncé);}
    .agilo-modal__header{padding:18px 22px; border-bottom:1px solid var(--color--noir_25); background: var(--color--white);}
    .agilo-modal__title{margin:0; font-size:18px;}
    .agilo-modal__subtitle{margin:6px 0 0; color: var(--color--gris); font-size:14px;}
    .agilo-modal__body{padding:16px 22px; max-height:60vh; overflow:auto; background: var(--color--white);}
    .agilo-modal__footer{display:flex; gap:8px; justify-content:flex-end; padding:14px 16px; border-top:1px solid var(--color--noir_25); background: var(--color--blanc_gris);}
    .agilo-block{margin-bottom:14px;}
    .agilo-block__heading{font-weight:600; margin-bottom:4px;}
    .agilo-block__text{color: var(--color--gris_foncé); margin-bottom:6px;}
    .agilo-block__details summary{cursor:pointer; color: var(--color--gris);}
    .agilo-block__pre{white-space:pre-wrap; background: var(--color--blanc_gris); border:1px solid var(--color--noir_25); border-radius: var(--0-5_radius); padding:8px; margin-top:6px; font-size:12px;}
    .agilo-kbdrow{display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px;}
    .agilo-linklist{font-size:13px; line-height:1.4;}
    .agilo-linklist a{display:block; margin:4px 0;}
    .agilo-btn,.agilo-link{padding:10px 14px; border-radius: var(--0-5_radius); border:1px solid var(--color--noir_25); background: var(--color--white); color: var(--color--gris_foncé); cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; transition: background .15s ease, border-color .15s ease, filter .15s ease;}
    .agilo-btn:hover,.agilo-link:hover{background: var(--color--blanc_gris);}
    .agilo-btn--primary{border-color: var(--color--blue); background: var(--color--blue); color: var(--color--white);}
    .agilo-btn--primary:hover{filter:none; background: var(--color--blue);}
    .agilo-btn--danger{border-color: #dc3545; background: #dc3545; color: white;}
    .agilo-btn--danger:hover{background: #c82333; border-color: #bd2130;}
    .agilo-btn:focus-visible,.agilo-link:focus-visible{outline:2px solid var(--color--blue); outline-offset:2px;}
    `;
    const style = document.createElement('style');
    style.id = 'agilo-dialog-theme';
    style.textContent = css;
    document.head.appendChild(style);
  }
  function ensureDialog() {
    injectDialogTheme();
    const legacy = document.querySelector('#agilo-dialog[style]'); if (legacy) legacy.remove();
    if (document.getElementById('agilo-dialog')) return;
    const html = `
      <div id="agilo-dialog" role="dialog" aria-modal="true" class="agilo-overlay" lang="fr">
        <div class="agilo-modal">
          <div class="agilo-modal__header">
            <h3 id="agilo-dialog-title" class="agilo-modal__title">Résultat</h3>
            <p id="agilo-dialog-sub" class="agilo-modal__subtitle"></p>
          </div>
          <div id="agilo-dialog-body" class="agilo-modal__body"></div>
          <div class="agilo-modal__footer">
            <button id="agilo-dialog-close" class="agilo-btn">Fermer</button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('agilo-dialog-close').addEventListener('click', ()=>hideDialog());
    document.getElementById('agilo-dialog').addEventListener('click', (e)=>{ if(e.target.id==='agilo-dialog') hideDialog(); });
  }
  function showDialog({ title, subtitle, blocks }) {
    ensureDialog();
    document.getElementById('agilo-dialog-title').textContent = title || 'Résultat';
    document.getElementById('agilo-dialog-sub').textContent = subtitle || '';
    const body = document.getElementById('agilo-dialog-body');
    body.innerHTML = '';
    (blocks || []).forEach(b => {
      const box = document.createElement('div');
      box.className = 'agilo-block';
      box.innerHTML = `
        ${b.heading ? `<div class="agilo-block__heading">${b.heading}</div>` : ''}
        ${b.text ? `<div class="agilo-block__text">${b.text}</div>` : ''}
        ${b.html ? b.html : ''}
        ${b.cta ? `<a href="${b.cta.href}" ${b.cta.sameTab ? '' : 'target="_blank"'} class="agilo-link">${b.cta.label}</a>` : ''}
        ${b.details ? `<details class="agilo-block__details"><summary>Détails techniques</summary><pre class="agilo-block__pre">${b.details}</pre></details>` : ''}`;
      body.appendChild(box);
    });
    document.getElementById('agilo-dialog').style.display = 'block';
  }
  function hideDialog(){ const m = document.getElementById('agilo-dialog'); if (m) m.style.display = 'none'; }

  // ───────────────────────────────────────────────────────────────────────────
  // CONFIRMATION CUSTOM
  // ───────────────────────────────────────────────────────────────────────────
  function showConfirmation({ title, message, confirmText = "Oui", cancelText = "Non", onConfirm, onCancel }) {
    return new Promise((resolve) => {
      ensureDialog();
      
      document.getElementById('agilo-dialog-title').textContent = title || 'Confirmation';
      document.getElementById('agilo-dialog-sub').textContent = '';
      
      const body = document.getElementById('agilo-dialog-body');
      body.innerHTML = `
        <div class="agilo-block">
          <div class="agilo-block__text">${message}</div>
        </div>
      `;
      
      // Remplacer le footer avec les boutons de confirmation
      const footer = document.querySelector('.agilo-modal__footer');
      footer.innerHTML = `
        <button id="agilo-confirm-btn" class="agilo-btn agilo-btn--primary">${confirmText}</button>
        <button id="agilo-cancel-btn" class="agilo-btn">${cancelText}</button>
      `;
      
      // Gestion des clics
      const confirmBtn = document.getElementById('agilo-confirm-btn');
      const cancelBtn = document.getElementById('agilo-cancel-btn');
      
      const handleConfirm = () => {
        hideDialog();
        if (onConfirm) onConfirm();
        resolve(true);
      };
      
      const handleCancel = () => {
        hideDialog();
        if (onCancel) onCancel();
        resolve(false);
      };
      
      confirmBtn.addEventListener('click', handleConfirm);
      cancelBtn.addEventListener('click', handleCancel);
      
      // Afficher la modal
      document.getElementById('agilo-dialog').style.display = 'block';
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BULK MODULE
  // ───────────────────────────────────────────────────────────────────────────
  window.AgilotextBulk = (function () {
    const SELECTORS = {
      container: '#jobs-container',
      row: '.wrapper-content_item-row',
      selectAll: '#select-all',
      selectedCount: '#selected-count',
      exportBtn: '#exportBtn',
      resendWebhookBtn: '#resendWebhookBtn',
      bulkDeleteBtn: '#bulkDeleteBtn',
      openBtn: '.button-open',
      automationProvider: '#automationProvider'
    };

    const EDITION = apiEditionFromUrl();
    const API_BASE =
      document.querySelector(SELECTORS.container)?.dataset.apiBase ||
      'https://api.agilotext.com/api/v1';

    const containerEl = document.querySelector(SELECTORS.container);
    const EDITOR_BASE = appUrl(
      containerEl?.dataset.editorTail ||
      document.querySelector('.dashboard-content')?.dataset.editorTail ||
      'editor'
    );
    const SETTINGS_URL = appUrl(
      containerEl?.dataset.webhookSettingsTail ||
      document.querySelector('.dashboard-content')?.dataset.webhookSettingsTail ||
      'profile#integrations'
    );

    const ENDPOINTS = {
      deleteJob: (jobId, email, token) =>
        `${API_BASE}/deleteJob?username=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&jobId=${encodeURIComponent(jobId)}&edition=${encodeURIComponent(EDITION)}`,
      webhookResendPost: () => `${API_BASE}/webhookResend`,
      getSharedUrl: () => `${API_BASE}/getSharedUrl`
    };
    const CONCURRENCY = 4;

    const ERROR_TRANSLATIONS = {
      error_no_webhook_configured: {
        title: "Aucun webhook configuré",
        explain: "Pour renvoyer l'automatisation, vous devez d'abord configurer un webhook dans votre compte.",
        next: "Configurer un webhook",
        link: SETTINGS_URL
      },
      error_invalid_automation_provider: {
        title: "Fournisseur d'automatisation invalide",
        explain: "Le provider transmis (Make/Zapier/n8n) n'a pas été trouvé pour cet utilisateur.",
        tip: "Vérifiez le champ « Automation Provider »."
      },
      error_transcript_not_ready: {
        title: "Transcript non prêt",
        explain: "Aucun transcript à l'état READY.",
        tip: "Attendez la fin du traitement, puis rechargez la page."
      }
    };
    function translateError(code, raw) {
      const t = ERROR_TRANSLATIONS[code];
      return t ? { ...t, raw } : { title:"Erreur inconnue", explain:"Une erreur est survenue.", tip:"Réessayez plus tard.", raw };
    }

    const getUserEmail = () => document.querySelector('[name="memberEmail"]')?.value || '';
    const getToken = () => (typeof globalToken !== 'undefined' && globalToken) ? globalToken : null;

    const getRow = (el) => el?.closest(`${SELECTORS.row}[data-job-id]`);
    const getJobIdFromRow = (row) => row?.getAttribute('data-job-id') || '';

    const getSelectedRows = () => Array.from(document.querySelectorAll(
      `${SELECTORS.container} ${SELECTORS.row} .job-select:checked`
    )).map(cb => cb.closest(SELECTORS.row));

    async function pMap(array, mapper, { concurrency = 4 } = {}) {
      const ret = []; let i = 0;
      const exec = async () => { for (; i < array.length;) {
        const cur = i++;
        try { ret[cur] = await mapper(array[cur], cur); }
        catch (e) { ret[cur] = { ok: false, error: e?.message || 'Erreur' }; }
      }};
      const workers = Array.from({ length: Math.min(concurrency, array.length) }, exec);
      await Promise.all(workers);
      return ret;
    }

    async function bulkDelete(rows, email, token) {
      const tasks = rows.map(row => ({ row, jobId: getJobIdFromRow(row) })).filter(t => !!t.jobId);
      const results = await pMap(tasks, async (t) => {
        const res  = await fetch(ENDPOINTS.deleteJob(t.jobId, email, token), { method: 'GET', headers: { 'Accept': 'application/json' } });
        const data = await res.json().catch(() => ({}));
        if (data.status === 'OK') { t.row.remove(); setSelectAllState(); return { ok: true, jobId: t.jobId }; }
        return { ok: false, jobId: t.jobId, error: data.errorMessage || 'KO' };
      }, { concurrency: CONCURRENCY });

      const ok = results.filter(r => r?.ok).length;
      const ko = results.filter(r => !r?.ok);

      showDialog({
        title: "Suppression",
        subtitle: `${ok} OK, ${ko.length} échec(s).`,
        blocks: ko.length ? [{
          heading: "Éléments en échec",
          text: ko.slice(0,10).map(r=>`• ${r.jobId} : ${r.error || 'Erreur'}`).join('<br>') + (ko.length>10?'<br>…':'' )
        }] : []
      });
    }

    function toDownloadUrl(sharedUrl) { return sharedUrl.endsWith('-download') ? sharedUrl : `${sharedUrl}-download`; }
    function triggerDownload(url) {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none'; iframe.src = url; document.body.appendChild(iframe);
      setTimeout(() => iframe.remove(), 20000);
    }
    async function fetchSharedUrl(jobId, email, token) {
      const body = new URLSearchParams({ username: email, token: token, jobId: String(jobId), edition: EDITION });
      try {
        const res = await fetch(ENDPOINTS.getSharedUrl(), {
          method:'POST', headers:{ 'Accept':'application/json','Content-Type':'application/x-www-form-urlencoded' }, body: body.toString()
        });
        const data = await res.json().catch(()=> ({}));
        if (res.ok && data.status === 'OK' && data.url) return { ok:true, jobId, url:data.url, download: toDownloadUrl(data.url) };
        return { ok:false, jobId, code: data.errorMessage || 'share_unknown', raw: JSON.stringify(data) };
      } catch (e) { return { ok:false, jobId, code:'network_error', raw: e?.message || String(e) }; }
    }
    async function exportShared(rows, email, token) {
      const tasks = rows.map(row => ({ row, jobId: getJobIdFromRow(row) })).filter(t => !!t.jobId);
      const results = await pMap(tasks, (t) => fetchSharedUrl(t.jobId, email, token), { concurrency: CONCURRENCY });
      const oks = results.filter(r => r.ok), kos = results.filter(r => !r.ok);

      if (tasks.length === 1 && oks.length === 1) { triggerDownload(oks[0].download); return; }

      const linksHtml = oks.length
        ? `<div class="agilo-kbdrow"><button id="agilo-dl-all" class="agilo-btn agilo-btn--primary">Télécharger tout (${oks.length})</button></div>
           <div class="agilo-linklist">${oks.map(x => `<a href="${x.download}" rel="noopener">${x.jobId} — Télécharger</a>`).join('')}</div>`
        : `<div class="agilo-block__text">Aucun lien de partage généré.</div>`;

      const blocks = [{ heading: "Liens de téléchargement", html: linksHtml }];
      if (kos.length) blocks.push({
        heading: "Échecs",
        details: kos.slice(0,10).map(r => `• ${r.jobId} : ${r.code} ${r.raw ? '('+r.raw+')' : ''}`).join('\n') + (kos.length>10?'\n…':'')
      });

      showDialog({ title: "Export (liens de partage)", subtitle: `${oks.length} OK, ${kos.length} échec(s).`, blocks });

      const dlAllBtn = document.getElementById('agilo-dl-all');
      if (dlAllBtn) dlAllBtn.addEventListener('click', () => {
        const delay = 700; oks.forEach((x,i) => setTimeout(() => triggerDownload(x.download), i*delay));
      });
    }

    function safeCsv(val) {
      const s = String(val ?? '');
      return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
    }
    function setSelectAllState() {
      const all = Array.from(document.querySelectorAll(`${SELECTORS.container} ${SELECTORS.row} .job-select`));
      const checked = all.filter(i => i.checked);
      const selectAll = document.querySelector(SELECTORS.selectAll);
      const countEl = document.querySelector(SELECTORS.selectedCount);
      if (countEl) countEl.textContent = `${checked.length} sélectionné(s)`;
      if (!selectAll) return;
      if (checked.length === 0) { selectAll.checked = false; selectAll.indeterminate = false; }
      else if (checked.length === all.length) { selectAll.checked = true; selectAll.indeterminate = false; }
      else { selectAll.checked = false; selectAll.indeterminate = true; }
    }
    function toggleAll(checked) {
      document.querySelectorAll(`${SELECTORS.container} ${SELECTORS.row} .job-select`).forEach(cb => { cb.checked = checked; });
      setSelectAllState();
    }

    function openEditorForRow(row) {
      const jobId = getJobIdFromRow(row);
      if (!jobId) return;
      try { localStorage.setItem('agilotext:lastJobId', jobId); } catch(e){}
      const url = `${EDITOR_BASE}?jobId=${encodeURIComponent(jobId)}&edition=${encodeURIComponent(EDITION)}`;
      window.location.href = url;
    }

    // ───────────────────────────────────────────────────────────────────────────
    // BINDING — délégation + capture (robuste aux ré-injections)
    // ───────────────────────────────────────────────────────────────────────────
    function bindUI() {
      // Toujours activer l'UI immédiatement (pas d'attente du token)
      const container = document.querySelector(SELECTORS.container);
      if (container) {
        container.addEventListener('change', (e) => {
          if (e.target?.classList?.contains('job-select')) setSelectAllState();
        });
        // Observer pour maintenir le compteur/cochage
        if (!container.__bulkObserver) {
          const obs = new MutationObserver(() => { setSelectAllState(); forceButtonTypes(); });
          obs.observe(container, { childList: true, subtree: true });
          container.__bulkObserver = obs;
        }
      }

      // Forcer les types button pour éviter submit
      function forceButtonTypes(){
        ['#bulkDeleteBtn','#exportBtn','#resendWebhookBtn'].forEach(sel=>{
          document.querySelectorAll(sel).forEach(b=>{ if(b.tagName==='BUTTON') b.type='button'; });
        });
      }
      forceButtonTypes();

      // Open editor (par ligne) — déjà en délégation dans ton code
      document.addEventListener('click', (e) => {
        const btn = e.target.closest(SELECTORS.openBtn);
        if (!btn) return;
        e.preventDefault();
        const row = btn.closest(SELECTORS.row);
        if (row) openEditorForRow(row);
      }, { capture:true });

      // Select all
      document.addEventListener('change', (e) => {
        const el = e.target.closest(SELECTORS.selectAll);
        if (!el) return;
        toggleAll(!!el.checked);
      }, { capture:true });

      // BULK DELETE (délégation + capture) - AVEC CONFIRMATION
      document.addEventListener('click', async (e) => {
        const btn = e.target.closest(SELECTORS.bulkDeleteBtn);
        if (!btn) return;
        e.preventDefault();

        const rows = getSelectedRows();
        if (rows.length === 0) { 
          showDialog({ 
            title:'Suppression', 
            subtitle:'0 sélection', 
            blocks:[{text:'Sélectionnez au moins un élément.'}]
          }); 
          return; 
        }

        // ✅ CONFIRMATION DE SUPPRESSION
        const confirmed = await showConfirmation({
          title: "Confirmer la suppression",
          message: `Êtes-vous sûr de vouloir supprimer <strong>${rows.length} élément(s)</strong> ?`,
          confirmText: "Oui, supprimer",
          cancelText: "Annuler"
        });
        
        if (!confirmed) return; // L'utilisateur a annulé

        const email = getUserEmail();
        const token = getToken();
        if (!token) { 
          showDialog({ 
            title:'Suppression', 
            blocks:[{text:'Token non disponible. Réessayez.'}]
          }); 
          return; 
        }

        btn.disabled = true; 
        btn.setAttribute('aria-busy','true');
        btn.textContent = 'Suppression...';
        
        try { 
          await bulkDelete(rows, email, token); 
        } finally { 
          btn.disabled = false; 
          btn.removeAttribute('aria-busy');
          btn.textContent = 'Supprimer'; // Restaurer le texte original
        }
      }, { capture:true });

      // Suppression ligne (poubelle Webflow `.delete-job-button_to-confirm`) — même modale que le bulk `#bulkDeleteBtn`
      document.addEventListener('click', async (e) => {
        const btn = e.target.closest('.delete-job-button_to-confirm');
        if (!btn) return;
        const row = getRow(btn);
        if (!row || !getJobIdFromRow(row)) return;
        const container = document.querySelector(SELECTORS.container);
        if (!container || !container.contains(btn)) return;
        e.preventDefault();

        const confirmed = await showConfirmation({
          title: "Confirmer la suppression",
          message: `Êtes-vous sûr de vouloir supprimer <strong>1 élément(s)</strong> ?`,
          confirmText: "Oui, supprimer",
          cancelText: "Annuler"
        });
        if (!confirmed) return;

        const email = getUserEmail();
        const token = getToken();
        if (!token) {
          showDialog({
            title: 'Suppression',
            blocks: [{ text: 'Token non disponible. Réessayez.' }]
          });
          return;
        }

        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
        try {
          await bulkDelete([row], email, token);
        } finally {
          btn.disabled = false;
          btn.removeAttribute('aria-busy');
        }
      }, { capture:true });

      // RESEND WEBHOOK (délégation + capture) - AVEC CONFIRMATION
      document.addEventListener('click', async (e) => {
        const btn = e.target.closest(SELECTORS.resendWebhookBtn);
        if (!btn) return;
        e.preventDefault();

        const rows = getSelectedRows();
        if (rows.length === 0) { 
          showDialog({ 
            title:'Renvoi du webhook', 
            subtitle:'0 sélection', 
            blocks:[{text:'Sélectionnez au moins un élément.'}]
          }); 
          return; 
        }

        // ✅ CONFIRMATION DE WEBHOOK
        const confirmed = await showConfirmation({
          title: "Confirmer le renvoi du webhook",
          message: `Êtes-vous sûr de vouloir relancer le webhook pour <strong>${rows.length} audio(s)</strong> sélectionné(s) ?`,
          confirmText: "Oui, relancer",
          cancelText: "Annuler"
        });
        
        if (!confirmed) return; // L'utilisateur a annulé

        const email = getUserEmail();
        const token = getToken();
        if (!token) { 
          showDialog({ 
            title:'Renvoi du webhook', 
            blocks:[{text:'Token non disponible. Réessayez.'}]
          }); 
          return; 
        }

        const providerInput = document.querySelector(SELECTORS.automationProvider);
        const automationProvider = providerInput?.value?.trim() || '';

        const tasks = rows.map(row => ({ row, jobId: getJobIdFromRow(row) })).filter(t => !!t.jobId);

        async function readJsonSafe(res) { 
          const txt = await res.text().catch(()=> ''); 
          try { return JSON.parse(txt || '{}'); } catch { return { _raw: txt }; } 
        }

        btn.disabled = true; 
        btn.setAttribute('aria-busy','true');
        btn.textContent = 'Envoi en cours...';
        
        try {
          const results = await pMap(tasks, async (t) => {
            const body = new URLSearchParams({ 
              username: email, 
              token: token, 
              jobId: String(t.jobId), 
              edition: EDITION 
            });
            if (automationProvider) body.set('automationProvider', automationProvider);
            
            try {
              const res = await fetch(ENDPOINTS.webhookResendPost(), { 
                method:'POST', 
                headers:{ 
                  'Accept':'application/json',
                  'Content-Type':'application/x-www-form-urlencoded' 
                }, 
                body: body.toString() 
              });
              
              if (!res.ok) return { 
                ok:false, 
                jobId:t.jobId, 
                code:'http_error_' + res.status, 
                raw:`HTTP ${res.status}` 
              };
              
              const data = await readJsonSafe(res);
              if (data.status === 'OK') return { ok:true, jobId:t.jobId };
              return { 
                ok:false, 
                jobId:t.jobId, 
                code: data.errorMessage || 'unknown', 
                raw: data.exceptionStackTrace || JSON.stringify(data) 
              };
            } catch (e) {
              return {
                ok:false, 
                jobId:t.jobId, 
                code:'network_error', 
                raw: e?.message || String(e) 
              };
            }
          }, { concurrency: CONCURRENCY });

          const oks = results.filter(r => r.ok);
          const kos = results.filter(r => !r.ok);
          const errorGroups = {};
          kos.forEach(r => { 
            const key = r.code || 'unknown'; 
            (errorGroups[key]||(errorGroups[key]=[])).push(r); 
          });

          const blocks = [];
          Object.entries(errorGroups).forEach(([code, list]) => {
            const tr = translateError(code, list[0]?.raw);
            blocks.push({
              heading: `${tr.title} (${list.length})`,
              text: [tr.explain || '', tr.tip ? `<div style="margin-top:6px;color:var(--color--gris)">💡 ${tr.tip}</div>` : ''].join(''),
              cta: tr.link ? { href: tr.link, label: tr.next || 'Ouvrir' } : null,
              details: list.slice(0,10).map(r => `• ${r.jobId} : ${r.raw || r.code}`).join('\n') + (list.length>10?'\n…':'')
            });
          });

          showDialog({
            title: "Renvoi du webhook",
            subtitle: `${oks.length} OK, ${kos.length} échec(s).`,
            blocks: blocks.length ? blocks : [{ 
              heading: "Tout est OK ✅", 
              text: "Le webhook a été renvoyé pour tous les éléments sélectionnés." 
            }]
          });
        } finally { 
          btn.disabled = false; 
          btn.removeAttribute('aria-busy');
          btn.textContent = 'Relancer webhook'; // Restaurer le texte original
        }
      }, { capture:true });

      // EXPORT (délégation + capture) - AVEC CONFIRMATION
      document.addEventListener('click', async (e) => {
        const btn = e.target.closest(SELECTORS.exportBtn);
        if (!btn) return;
        e.preventDefault();

        const rows = getSelectedRows();
        if (rows.length === 0) { 
          showDialog({ 
            title:'Export', 
            subtitle:'0 sélection', 
            blocks:[{text:'Sélectionnez au moins un élément.'}]
          }); 
          return; 
        }

        // ✅ CONFIRMATION D'EXPORT
        const confirmed = await showConfirmation({
          title: "Confirmer l'export",
          message: `Générer les liens de téléchargement pour <strong>${rows.length} élément(s)</strong> ?`,
          confirmText: "Oui, exporter",
          cancelText: "Annuler"
        });
        
        if (!confirmed) return; // L'utilisateur a annulé

        const email = getUserEmail();
        const token = getToken();
        if (!token) { 
          showDialog({ 
            title:'Export', 
            blocks:[{text:'Token non disponible. Réessayez.'}]
          }); 
          return; 
        }

        btn.disabled = true; 
        btn.setAttribute('aria-busy','true');
        btn.textContent = 'Génération...';
        
        try { 
          await exportShared(rows, email, token); 
        } finally { 
          btn.disabled = false; 
          btn.removeAttribute('aria-busy');
          btn.textContent = 'Exporter'; // Restaurer le texte original
        }
      }, { capture:true });

      // Compteur initial
      setSelectAllState();
    }

    // Init immédiat dès que le DOM est prêt (pas d'attente token)
    function initNow() {
      injectDialogTheme();
      bindUI();
      window.__agiloRowTrashHandledByBulk = true;
    }

    return { init: initNow, version: '2.4.3' };
  })();

  // Démarrage immédiat
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.AgilotextBulk.init(), { once:true });
  } else {
    window.AgilotextBulk.init();
  }
})();
