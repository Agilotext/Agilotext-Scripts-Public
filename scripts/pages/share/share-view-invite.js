/* ================================================================
   AGILOTEXT — Vue lecture seule d’un partage (transcription, CR, PV, etc.)
   Page : /auth/share?token=d8478fa34a…
   Prod    : https://www.agilotext.com/auth/share?token=…
   Staging : https://agilotext-test.webflow.io/auth/share?token=…
   Embed Webflow :
     <div id="editorRoot" class="editorroot"></div>
     <script src="…/scripts/shared/agilo-share-url.js"></script>
     <script src="…/scripts/pages/share/share-zip-parse.js"></script>
     <script src="…/scripts/pages/share/share-view-invite.js?v=share-v1"></script>
   Guest : GET /api/d8478fa34a…-download (zip public, sans compte), puis lecture locale.
   API JSON : GET /api/v1/getSharedJobView?shareToken=…  (Nico, pas encore en prod)
   Mock  : ?mock=1
   Job ID (aperçu propriétaire connecté) : ?jobId=1000040476
   ================================================================ */
(function () {
  'use strict';

  if (!/^\/(auth\/)?share\/?$/.test(window.location.pathname || '')) return;
  if (window.__agiloShareViewInit) return;
  window.__agiloShareViewInit = true;

  var API_BASE = 'https://api.agilotext.com/api/v1';
  var JSZIP_SRC = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
  var SIGNUP_URL = 'https://www.agilotext.com/?utm_source=share_link&utm_medium=referral&utm_campaign=share_guest';
  var HELP_URL = 'https://www.agilotext.com/contact';
  var LOGO_SRC = 'https://cdn.prod.website-files.com/6815bee5a9c0b57da18354fb/6815bee5a9c0b57da18355b2_Logo_svg%20(1).svg';
  var ROOT_ID = 'editorRoot';
  var FALLBACK_ROOT_ID = 'agilo-share-view';

  /** Type document par défaut si l’API n’envoie pas sharedDocumentType (cr | pv | note | transcript). */
  var SHARE_DOCUMENT_TYPE_DEFAULT = 'cr';

  /** Libellés UI — surchargeables via API (sharedDocumentType, summaryTabLabel, pageKicker). */
  var COPY = {
    pageKicker: 'Partage',
    defaultTitle: 'Document partagé',
    sharedByPrefix: 'Partagé par',
    lectureSeule: 'Lecture seule',
    transcriptTab: 'Transcription',
    summaryTabDefault: 'Compte rendu',
    summaryTabByType: {
      cr: 'Compte rendu',
      report: 'Compte rendu',
      pv: 'Procès-verbal',
      pv_cse: 'PV',
      note: 'Note',
      minutes: 'Procès-verbal',
      summary: 'Synthèse'
    },
    copyTranscript: 'Copier la transcription',
    copySummaryPrefix: 'Copier',
    download: 'Télécharger',
    banner: 'Document confidentiel. Lecture seule. Hébergement en France.',
    audioMissing: '',
    ctaBody: '',
    ctaButton: 'Créer un compte',
    transcriptEmpty: 'Transcription indisponible.',
    summaryEmpty: 'Document indisponible.'
  };

  var MOCK_JOB = {
    status: 'OK',
    jobTitle: 'Démo équipe commerciale',
    filename: 'demo-equipe-commerciale.m4a',
    sharedByName: 'Florian',
    expiresAt: '',
    audioUrl: '',
    audioAvailable: false,
    sharedDocumentType: 'cr',
    transcriptHtml: '',
    summaryHtml:
      '<h2>Décisions</h2><ul><li>Relancer le compte avant vendredi</li><li>Envoyer le devis révisé d’ici mercredi</li></ul>' +
      '<h2>Prochaines étapes</h2><ul><li>Point terrain lundi 9h</li><li>Partager le compte rendu au siège</li></ul>' +
      '<h2>Points abordés</h2><p>Revue du pipeline, blocage devis, besoin d’un compte rendu propre à envoyer sans compte Agilotext.</p>',
    segments: [
      { speaker: 'Intervenant 1', start: 0, text: 'On reprend le point de la semaine dernière : le devis n’est toujours pas parti.' },
      { speaker: 'Intervenant 2', start: 14, text: 'J’ai la version révisée. Je l’envoie dès que le compte rendu est calé.' },
      { speaker: 'Intervenant 1', start: 28, text: 'Parfait. On a besoin d’un lien de lecture, pas d’un export zip illisible.' }
    ]
  };

  function qs(name) {
    try { return new URLSearchParams(window.location.search).get(name) || ''; }
    catch (_) { return ''; }
  }

  function shareHelpers() {
    return window.AgiloShareUrl || null;
  }

  function zipHelpers() {
    return window.AgiloShareZip || null;
  }

  function maskEmail(email) {
    var s = String(email || '');
    var at = s.indexOf('@');
    if (at < 1) return '';
    return s.slice(0, 1) + '…' + s.slice(at);
  }

  function parseJobId() {
    var fromQ = qs('jobId');
    if (/^\d{6,}$/.test(fromQ)) return fromQ;
    var t = String(qs('token') || qs('shareToken') || '').trim();
    if (/^\d{6,}$/.test(t)) return t;
    return '';
  }

  function parseMaybeJson(raw) {
    var s = String(raw || '').trim();
    if (!s) return null;
    if (s.charAt(0) !== '{' && s.charAt(0) !== '[') return null;
    try { return JSON.parse(s); } catch (_) { return null; }
  }

  function mapNicoSegments(j) {
    var arr = (j && Array.isArray(j.segments)) ? j.segments : [];
    return arr.map(function (r, i) {
      var startMs = r.milli_start != null ? r.milli_start : r.start;
      return {
        speaker: String(r.speaker || '').trim() || ('Intervenant ' + (i + 1)),
        start: Math.max(0, Math.floor((+startMs || 0) / (String(startMs).length > 6 ? 1000 : 1))),
        text: String(r.text || '').replace(/\\n/g, '\n')
      };
    }).filter(function (s) { return String(s.text || '').trim(); });
  }

  async function memberEmailFromMs() {
    var i;
    for (i = 0; i < 15; i++) {
      try {
        if (window.$memberstackDom && typeof window.$memberstackDom.getCurrentMember === 'function') {
          var res = await window.$memberstackDom.getCurrentMember();
          var d = (res && (res.data || res.member || res)) || {};
          var email = String((d.email || (d.auth && d.auth.email) || '') || '').trim();
          if (email) return email;
        }
      } catch (_) { /* ignore */ }
      await new Promise(function (ok) { setTimeout(ok, 100); });
    }
    return '';
  }

  async function resolveAuth() {
    var edition = qs('edition') || localStorage.getItem('agilo:edition') || 'ent';
    var email =
      (document.querySelector('[name="memberEmail"]') || {}).value ||
      window.memberEmail ||
      localStorage.getItem('agilo:username') ||
      '';
    var token =
      (typeof window.globalToken === 'string' && window.globalToken) ||
      localStorage.getItem('agilo:token:' + String(edition).toLowerCase() + ':' + String(email).toLowerCase()) ||
      localStorage.getItem('agilo:token') ||
      '';
    if (!email) email = await memberEmailFromMs();
    if (!token && email) {
      try {
        var r = await fetch(API_BASE + '/getToken?username=' + encodeURIComponent(email) + '&edition=' + encodeURIComponent(edition), { credentials: 'omit' });
        var j = await r.json().catch(function () { return {}; });
        if (j && j.status === 'OK' && j.token) token = j.token;
      } catch (_) { /* ignore */ }
    }
    if (email) {
      try { localStorage.setItem('agilo:username', email); } catch (_) { /* ignore */ }
    }
    if (token) window.globalToken = token;
    return { email: email, token: token, edition: edition };
  }

  async function fetchJobById(jobId, auth) {
    var q = 'jobId=' + encodeURIComponent(jobId) +
      '&username=' + encodeURIComponent(auth.email) +
      '&token=' + encodeURIComponent(auth.token) +
      '&edition=' + encodeURIComponent(auth.edition);
    var sumUrl = API_BASE + '/receiveSummary?' + q + '&format=html';
    var txtUrl = API_BASE + '/receiveTextJson?' + q;
    var infoUrl = API_BASE + '/getJobsInfo?username=' + encodeURIComponent(auth.email) +
      '&token=' + encodeURIComponent(auth.token) +
      '&edition=' + encodeURIComponent(auth.edition) +
      '&jobId=' + encodeURIComponent(jobId) + '&limit=5&offset=0';

    var sumRaw = '';
    var txtRaw = '';
    var info = {};
    try {
      var pack = await Promise.all([
        fetch(sumUrl, { credentials: 'omit', cache: 'no-store' }).then(function (r) { return r.text(); }),
        fetch(txtUrl, { credentials: 'omit', cache: 'no-store' }).then(function (r) { return r.text(); }),
        fetch(infoUrl, { credentials: 'omit', cache: 'no-store' }).then(function (r) { return r.text(); }).catch(function () { return ''; })
      ]);
      sumRaw = pack[0];
      txtRaw = pack[1];
      info = parseMaybeJson(pack[2]) || {};
    } catch (_) {
      return { error: 'network' };
    }

    var sumJson = parseMaybeJson(sumRaw);
    var txtJson = parseMaybeJson(txtRaw);
    var sumCode = (sumJson && (sumJson.errorMessage || sumJson.error)) || '';
    var txtCode = (txtJson && (txtJson.errorMessage || txtJson.error)) || '';
    var code = String(sumCode || txtCode);
    if (/invalid[_-]?token/i.test(code)) return { error: 'need_login' };
    if (sumJson && String(sumJson.status || '').toUpperCase() === 'KO' && txtJson && String(txtJson.status || '').toUpperCase() === 'KO') {
      return { error: 'error_job_not_found' };
    }

    var summaryHtml = '';
    if (sumJson && String(sumJson.status || '').toUpperCase() === 'KO') summaryHtml = '';
    else if (sumJson && (sumJson.summary || sumJson.content || sumJson.html)) {
      summaryHtml = String(sumJson.summary || sumJson.content || sumJson.html);
    } else if (!sumJson && sumRaw && /<[a-z][\s\S]*>/i.test(sumRaw)) {
      summaryHtml = sumRaw;
    }

    var segments = mapNicoSegments(txtJson || {});
    var hit = (info.jobsInfoDtos || []).find(function (x) {
      return String(x.jobid || x.jobId) === String(jobId);
    }) || {};

    var job = {
      status: 'OK',
      jobTitle: (hit.jobTitle != null ? String(hit.jobTitle) : '').trim() || hit.filename || ('Fichier ' + jobId),
      filename: hit.filename || '',
      sharedByName: auth.email ? String(auth.email).split('@')[0] : '',
      expiresAt: '',
      audioUrl: '',
      audioAvailable: false,
      transcriptHtml: '',
      summaryHtml: summaryHtml,
      segments: segments,
      sharedDocumentType: 'cr'
    };
    if (!hasTranscriptContent(job) && !hasSummaryContent(job)) return { error: 'error_job_not_found' };
    return { job: job };
  }

  function parseToken() {
    var raw = qs('token') || qs('shareToken') || '';
    var helpers = shareHelpers();
    if (helpers && helpers.parseShareToken) {
      var parsed = helpers.parseShareToken(raw);
      if (parsed) return parsed;
    }
    var s = String(raw).replace(/-download$/i, '');
    if (/^d8478fa34a/i.test(s)) return s;
    return '';
  }

  function downloadUrlFor(token) {
    var helpers = shareHelpers();
    if (helpers && helpers.toApiDownloadUrl && token) return helpers.toApiDownloadUrl(token);
    if (token && /^d8478fa34a/i.test(token)) return 'https://api.agilotext.com/api/' + token + '-download';
    return '';
  }

  function loadJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = JSZIP_SRC;
      s.async = true;
      s.onload = function () {
        if (window.JSZip) resolve(window.JSZip);
        else reject(new Error('jszip'));
      };
      s.onerror = function () { reject(new Error('jszip')); };
      document.head.appendChild(s);
    });
  }

  async function createSharedToken(jobId, auth) {
    var body = new URLSearchParams({
      username: auth.email,
      token: auth.token,
      edition: auth.edition,
      jobId: String(jobId)
    });
    try {
      var r = await fetch(API_BASE + '/getSharedUrl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: body.toString(),
        credentials: 'omit'
      });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok || String(j.status || '').toUpperCase() !== 'OK' || !j.url) return '';
      var helpers = shareHelpers();
      return (helpers && helpers.parseShareToken) ? (helpers.parseShareToken(j.url) || '') : '';
    } catch (_) {
      return '';
    }
  }

  async function filesFromZipBuffer(buf) {
    var JSZip = await loadJSZip();
    var zip = await JSZip.loadAsync(buf);
    var names = Object.keys(zip.files || {});
    var out = [];
    var i;
    for (i = 0; i < names.length; i++) {
      var entry = zip.files[names[i]];
      if (!entry || entry.dir) continue;
      var text = await entry.async('string');
      out.push({ name: names[i], text: text });
    }
    return out;
  }

  async function fetchJobFromShareZip(token) {
    var z = zipHelpers();
    var url = downloadUrlFor(token);
    if (!url) return { error: 'missing_token' };
    var r;
    try {
      r = await fetch(url, { method: 'GET', credentials: 'omit', cache: 'no-store' });
    } catch (_) {
      return { error: 'zip_cors' };
    }
    var buf;
    try {
      buf = await r.arrayBuffer();
    } catch (_) {
      return { error: 'zip_cors' };
    }
    var htmlGuess = '';
    try {
      htmlGuess = new TextDecoder('utf-8').decode(buf.slice(0, Math.min(buf.byteLength, 800)));
    } catch (_) { htmlGuess = ''; }
    if (z && z.looksLikeGoneHtml(htmlGuess)) return { error: 'error_share_not_found' };
    if (z && !z.isZipBuffer(buf)) {
      if (/<!doctype html|<html/i.test(htmlGuess)) return { error: 'error_share_not_found' };
      return { error: 'error_share_not_ready' };
    }
    var files;
    try {
      files = await filesFromZipBuffer(buf);
    } catch (_) {
      return { error: 'error_share_not_ready' };
    }
    var job = z && z.jobFromZipFiles ? z.jobFromZipFiles(files) : null;
    if (!job) return { error: 'error_share_not_ready' };
    return { job: job };
  }

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function htmlToPlain(html) {
    var div = document.createElement('div');
    div.innerHTML = String(html || '');
    return (div.textContent || div.innerText || '').replace(/\s+\n/g, '\n').trim();
  }

  function capture(event, props) {
    try {
      if (window.posthog && typeof window.posthog.capture === 'function') {
        window.posthog.capture(event, props || {});
      }
    } catch (_) { /* ignore */ }
  }

  function injectStyles() {
    if (document.getElementById('agilo-share-view-styles')) return;
    var css = [
      'html.agilo-share-page .nav_component,html.agilo-share-page footer.footer{display:none!important}',
      'html.agilo-share-page .main-wrapper{min-height:100vh}',
      'html.agilo-share-page .dashboard.mes-transcript{min-height:100vh;align-items:stretch}',
      'html.agilo-share-page .dashboard-left,html.agilo-share-page .dashboard-menu.menu-app{height:auto!important;min-height:0!important;max-height:none!important}',
      'html.agilo-share-page .dashboard-menu.menu-app{justify-content:flex-start!important;padding:16px 18px 20px!important;gap:12px!important}',
      'html.agilo-share-page .dashboard-menu .nav_logo.app-center{max-height:28px}',
      'html.agilo-share-page .dashboard-right{padding:20px 24px 40px}',
      'html.agilo-share-page #editorRoot{max-width:860px}',
      '#editorRoot .agilo-share-doc{max-width:100%}',
      '#editorRoot .ed-header{display:flex;flex-direction:column;gap:8px;padding:0 0 12px;border-bottom:0}',
      '#editorRoot .ed-header .ed-wrap{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:10px 16px}',
      '#editorRoot .ed-title-wrap{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;min-width:0}',
      '#editorRoot .ed-title{font-size:1.35rem;line-height:1.25;font-weight:700;margin:0}',
      '#editorRoot .agilo-share-chip{display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;background:rgba(23,74,150,.08);color:var(--color--blue,#174a96);font-size:.72rem;font-weight:700;letter-spacing:.02em;text-transform:uppercase}',
      '#editorRoot .agilo-share-meta{margin:0;color:var(--color--gris,#525252);font-size:.82rem;line-height:1.4}',
      '#editorRoot .agilo-share-actions{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:center}',
      '#editorRoot .agilo-share-act{appearance:none;border:0;background:none;padding:0;font:inherit;font-size:.86rem;font-weight:600;color:var(--color--blue,#174a96);cursor:pointer;text-decoration:none}',
      '#editorRoot .agilo-share-act:hover{text-decoration:underline}',
      '#editorRoot .agilo-player, #editorRoot .wrapper-audio-api{margin:0 0 14px;padding:10px 12px;border:1px solid rgba(52,58,64,.16);border-radius:var(--0-5_radius,.5rem);background:#fff}',
      '#editorRoot .wrapper-audio-api audio,#editorRoot .agilo-player audio{width:100%;height:40px}',
      '#editorRoot nav.ed-tabs{display:flex;justify-content:flex-start!important;gap:4px;margin:4px 0 14px;padding:0;border-bottom:1px solid rgba(52,58,64,.14);text-align:left}',
      '#editorRoot .agilo-share-meta,#editorRoot .agilo-share-banner{text-align:left}',
      '#editorRoot .ed-tab{appearance:none;border:0;background:none;padding:10px 12px 12px;font:inherit;font-weight:600;color:#525252;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}',
      '#editorRoot .ed-tab.is-active{color:var(--color--blue,#174a96);border-bottom-color:var(--color--blue,#174a96)}',
      '#editorRoot .agilo-share-banner{margin:0 0 14px;font-size:.8rem;line-height:1.45;color:var(--color--gris,#525252)}',
      '#editorRoot .agilo-share-status{margin:0 0 12px;padding:8px 10px;border-radius:var(--0-5_radius,.5rem);font-size:.86rem;display:none}',
      '#editorRoot .agilo-share-status.is-info{display:block;background:rgba(23,74,150,.08);color:var(--color--blue,#174a96)}',
      '#editorRoot .agilo-share-status.is-error{display:block;background:rgba(168,38,51,.08);color:var(--color--rouge,#a82633)}',
      '#editorRoot .edtr-pane{display:none;font-size:.95rem;line-height:1.65;color:var(--color--gris_foncé,#020202)}',
      '#editorRoot .edtr-pane.is-active{display:block}',
      '#editorRoot .edtr-pane h2,#editorRoot .edtr-pane h3{margin:1.15em 0 .4em;font-size:1.05rem}',
      '#editorRoot .edtr-pane h2:first-child,#editorRoot .edtr-pane h3:first-child{margin-top:0}',
      '#editorRoot #pane-transcript .ag-seg{margin:0 0 16px}',
      '#editorRoot #pane-transcript .ag-seg__head{margin:0 0 4px}',
      '#editorRoot #pane-transcript .ag-seg__head .speaker{font-size:.75rem;font-weight:700;letter-spacing:.02em;color:var(--color--blue,#174a96)}',
      '#editorRoot .agilo-share-error{text-align:center;padding:48px 12px}',
      '@media (max-width:991px){html.agilo-share-page .dashboard-menu.menu-app{flex-direction:row!important;align-items:center!important;justify-content:space-between!important;padding:10px 16px!important}html.agilo-share-page .dashboard-menu .full-width{display:flex;flex-direction:row;gap:8px;width:auto!important}html.agilo-share-page .dashboard-right{padding:12px 16px 32px}#editorRoot .ed-title{font-size:1.2rem}}'
    ].join('');
    var st = document.createElement('style');
    st.id = 'agilo-share-view-styles';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function errorCopy(code) {
    var map = {
      error_share_not_found: {
        title: 'Lien introuvable',
        text: 'Ce lien de partage n’existe plus ou est incomplet. Demandez un nouveau lien à la personne qui vous l’a envoyé.'
      },
      error_share_expired: {
        title: 'Lien expiré',
        text: 'Ce lien de lecture n’est plus valable. Demandez un nouveau partage, ou créez un compte Agilotext pour conserver vos propres comptes rendus.'
      },
      error_share_revoked: {
        title: 'Lien révoqué',
        text: 'Le propriétaire a retiré ce partage. Le contenu n’est plus accessible.'
      },
      error_share_not_ready: {
        title: 'Contenu pas encore prêt',
        text: 'Le partage n’est pas encore disponible. Réessayez dans quelques minutes.'
      },
      missing_token: {
        title: 'Lien incomplet',
        text: 'Le lien public commence par d8478fa34a, ce n’est pas le numéro du fichier dans l’éditeur. Dans l’éditeur, cliquez Partager un lien, puis ouvrez cette URL.'
      },
      need_login: {
        title: 'Ce n’est pas le lien public',
        text: 'Un numéro du type 1000040476 est l’identifiant interne. Pour un invité sans compte, envoyez le lien Partager (il contient d8478fa34a). Ou connectez-vous avec le compte propriétaire, puis rechargez.'
      },
      error_job_not_found: {
        title: 'Ce n’est pas le lien public',
        text: 'Ce numéro de fichier n’est pas dans le compte actuellement connecté. Pour un invité, utilisez le lien Partager (d8478fa34a…), pas le jobId. Le zip derrière Télécharger contient déjà la transcription et le compte rendu.'
      },
      zip_cors: {
        title: 'Le zip public existe, la page ne peut pas le lire',
        text: 'Le bouton Télécharger fonctionne sans compte. Le serveur n’autorise pas encore la lecture de ce zip depuis Webflow (en-tête CORS manquant sur le servlet -download). En attendant, téléchargez le zip, ou ouvrez le lien d’origine sur api.agilotext.com.'
      },
      api_pending: {
        title: 'Page en cours de mise à jour',
        text: 'La lecture brandée Agilotext arrive. L’API publique n’est pas encore en production. Réessayez plus tard, ou ouvrez le lien d’origine si on vous l’a aussi envoyé.'
      },
      network: {
        title: 'Impossible de charger',
        text: 'Vérifiez votre connexion puis rechargez la page.'
      }
    };
    return map[code] || map.network;
  }

  function renderError(root, code, extra) {
    extra = extra || {};
    var copy = errorCopy(code);
    var jobId = parseJobId();
    var href = extra.href || SIGNUP_URL;
    var label = extra.label || 'Essayer Agilotext gratuitement';
    if (!extra.href && (code === 'need_login' || code === 'error_job_not_found') && jobId) {
      href = 'https://www.agilotext.com/app/business/editor?jobId=' + encodeURIComponent(jobId) + '&edition=ent';
      label = 'Ouvrir l’éditeur (connexion)';
    }
    if (!extra.href && extra.downloadUrl) {
      href = extra.downloadUrl;
      label = 'Télécharger le zip (transcript + compte rendu)';
    }
    var note = extra.note ? '<p>' + escapeHtml(extra.note) + '</p>' : '';
    root.innerHTML =
      '<div class="dashboard-content agilo-share-error" lang="fr">' +
      '<h2 class="h1-small">' + escapeHtml(copy.title) + '</h2><p>' + escapeHtml(copy.text) + '</p>' +
      note +
      '<p style="margin-top:18px"><a class="button-secondary" href="' + escapeHtml(href) + '">' + escapeHtml(label) + '</a></p>' +
      '</div>';
    capture('share_view_error', { code: code });
  }

  function inMain(el) {
    return !!(el && el.closest && el.closest('.main-wrapper'));
  }

  function fillGuestRail(left) {
    if (!left) return;
    var menu = left.querySelector('.dashboard-menu') || left;
    if (menu.getAttribute('data-agilo-share-rail') === '1') return;
    menu.setAttribute('data-agilo-share-rail', '1');
    menu.innerHTML =
      '<a href="https://www.agilotext.com/" class="nav_logo-link w-nav-brand">' +
      '<img src="' + LOGO_SRC + '" loading="lazy" alt="Agilotext" class="nav_logo">' +
      '</a>' +
      '<div class="full-width">' +
      '<a href="' + HELP_URL + '" class="dashboard-link w-inline-block"><div>Aide</div></a>' +
      '<a href="' + SIGNUP_URL + '" class="dashboard-link w-inline-block"><div>' + escapeHtml(COPY.ctaButton) + '</div></a>' +
      '</div>';
  }

  function ensureChrome() {
    try { document.documentElement.classList.add('agilo-share-page'); } catch (_) { /* ignore */ }
    var main = document.querySelector('.main-wrapper');
    if (!main) return null;

    var section = main.querySelector('.section_hero') || main.querySelector('section') || main.querySelector('.section');
    if (section) {
      section.removeAttribute('data-ms-content');
      section.classList.add('section_hero', 'app');
      section.classList.remove('section');
    }

    var dash = main.querySelector('.dashboard');
    if (!dash && section) {
      dash = document.createElement('div');
      dash.className = 'dashboard mes-transcript';
      section.appendChild(dash);
    }

    var left = main.querySelector('.dashboard-left');
    if (!left && dash) {
      left = document.createElement('div');
      left.className = 'dashboard-left';
      dash.appendChild(left);
    }
    fillGuestRail(left);

    var right = main.querySelector('.dashboard-right');
    if (!right && dash) {
      right = document.createElement('div');
      right.className = 'dashboard-right';
      dash.appendChild(right);
    }

    var mount = document.getElementById(ROOT_ID) || document.getElementById(FALLBACK_ROOT_ID);
    if (mount && !inMain(mount)) mount = null;
    if (!mount && right) {
      mount = document.createElement('div');
      mount.id = ROOT_ID;
      mount.className = 'editorroot';
      right.appendChild(mount);
    }
    if (!mount && section) {
      mount = document.createElement('div');
      mount.id = ROOT_ID;
      mount.className = 'editorroot';
      section.appendChild(mount);
    }
    if (mount) mount.classList.add('editorroot');
    return mount || null;
  }

  function setStatus(el, kind, text) {
    if (!el) return;
    el.className = 'agilo-share-status' + (kind ? ' is-' + kind : '');
    el.textContent = text || '';
  }

  function normalizeDocType(raw) {
    var t = String(raw || '').toLowerCase().replace(/[\s-]+/g, '_');
    if (!t || t === 'both' || t === 'full' || t === 'all') return '';
    if (t === 'transcript' || t === 'transcription' || t === 'verbatim') return 'transcript';
    if (t === 'pv' || t === 'proces_verbal' || t === 'procès_verbal' || t === 'minutes') return 'pv';
    if (t === 'pv_cse' || t === 'cse') return 'pv_cse';
    if (t === 'cr' || t === 'compte_rendu' || t === 'report' || t === 'compte-rendu') return 'cr';
    if (t === 'note' || t === 'memo') return 'note';
    if (t === 'summary' || t === 'synthese' || t === 'synthèse') return 'summary';
    return t;
  }

  function hasTranscriptContent(job) {
    if (job.transcriptHtml && htmlToPlain(job.transcriptHtml)) return true;
    var segs = Array.isArray(job.segments) ? job.segments : [];
    return segs.some(function (seg) { return String(seg && seg.text || '').trim(); });
  }

  function hasSummaryContent(job) {
    return !!(job.summaryHtml && htmlToPlain(job.summaryHtml));
  }

  function resolveSummaryTabLabel(docType, job) {
    if (job.summaryTabLabel) return String(job.summaryTabLabel);
    if (job.summaryLabel) return String(job.summaryLabel);
    return COPY.summaryTabByType[docType] || COPY.summaryTabDefault;
  }

  function resolveShareViewModel(job) {
    var docType = normalizeDocType(job.sharedDocumentType || job.documentType || job.shareKind || '');
    var hasTranscript = hasTranscriptContent(job);
    var hasSummary = hasSummaryContent(job);

    if (!docType) {
      if (hasTranscript && !hasSummary) docType = 'transcript';
      else if (hasSummary && !hasTranscript) docType = normalizeDocType(SHARE_DOCUMENT_TYPE_DEFAULT) || 'cr';
      else docType = normalizeDocType(SHARE_DOCUMENT_TYPE_DEFAULT) || 'cr';
    }

    var summaryTabLabel = resolveSummaryTabLabel(docType, job);
    var showTranscript = hasTranscript;
    var showSummary = hasSummary;
    if (docType === 'transcript') showSummary = hasSummary;
    if (docType === 'transcript' && !hasTranscript && hasSummary) {
      showTranscript = false;
      docType = normalizeDocType(SHARE_DOCUMENT_TYPE_DEFAULT) || 'cr';
      summaryTabLabel = resolveSummaryTabLabel(docType, job);
    }

    var useTabs = showTranscript && showSummary;
    var defaultTab = 'summary';
    if (!showSummary && showTranscript) defaultTab = 'transcript';
    if (docType === 'transcript' && showTranscript) defaultTab = 'transcript';
    var pageKicker = job.pageKicker || COPY.pageKicker;
    var title = job.jobTitle || job.filename || COPY.defaultTitle;
    var copySummaryLabel = COPY.copySummaryPrefix + ' ' + summaryTabLabel.toLowerCase();

    return {
      docType: docType,
      summaryTabLabel: summaryTabLabel,
      pageKicker: pageKicker,
      title: title,
      metaBy: job.sharedByName ? (COPY.sharedByPrefix + ' ' + job.sharedByName) : COPY.lectureSeule,
      showTranscript: showTranscript,
      showSummary: showSummary,
      useTabs: useTabs,
      defaultTab: defaultTab,
      copySummaryLabel: copySummaryLabel
    };
  }

  function buildTranscriptHtml(job) {
    if (job.transcriptHtml) return String(job.transcriptHtml);
    var segs = Array.isArray(job.segments) ? job.segments : [];
    if (!segs.length) return '<p>' + escapeHtml(COPY.transcriptEmpty) + '</p>';
    return segs.map(function (seg) {
      return '<div class="ag-seg"><div class="ag-seg__head"><span class="speaker">' +
        escapeHtml(seg.speaker || 'Intervenant') + '</span></div><div>' +
        escapeHtml(seg.text || '') + '</div></div>';
    }).join('');
  }

  function buildSummaryHtml(job) {
    if (job.summaryHtml) return String(job.summaryHtml);
    return '<p>' + escapeHtml(COPY.summaryEmpty) + '</p>';
  }

  function renderJob(root, job, token) {
    var vm = resolveShareViewModel(job);
    var downloadUrl = downloadUrlFor(token);
    var audioOk = job.audioAvailable !== false && !!job.audioUrl;
    var transcript = buildTranscriptHtml(job);
    var summary = buildSummaryHtml(job);

    try { document.title = vm.title + ' | Agilotext'; } catch (_) { /* ignore */ }

    var actions = '';
    if (vm.showTranscript) {
      actions += '<button type="button" class="agilo-share-act" data-act="copy-transcript">' +
        escapeHtml(COPY.copyTranscript) + '</button>';
    }
    if (vm.showSummary) {
      actions += '<button type="button" class="agilo-share-act" data-act="copy-summary">' +
        escapeHtml(vm.copySummaryLabel) + '</button>';
    }
    if (downloadUrl) {
      actions += '<a class="agilo-share-act" data-act="download" href="' + escapeHtml(downloadUrl) + '">' +
        escapeHtml(COPY.download) + '</a>';
    }

    var tabs = '';
    if (vm.useTabs) {
      tabs =
        '<nav class="ed-tabs" role="tablist">' +
        '<button type="button" class="ed-tab' + (vm.defaultTab === 'transcript' ? ' is-active' : '') +
        '" data-tab="transcript" role="tab">' + escapeHtml(COPY.transcriptTab) + '</button>' +
        '<button type="button" class="ed-tab' + (vm.defaultTab === 'summary' ? ' is-active' : '') +
        '" data-tab="summary" role="tab">' + escapeHtml(vm.summaryTabLabel) + '</button>' +
        '</nav>';
    }

    var panels = '';
    if (vm.showTranscript) {
      panels += '<div class="edtr-pane' + (vm.defaultTab === 'transcript' ? ' is-active' : '') +
        '" id="pane-transcript" role="tabpanel">' + transcript + '</div>';
    }
    if (vm.showSummary) {
      panels += '<div class="edtr-pane' + (vm.defaultTab === 'summary' ? ' is-active' : '') +
        '" id="pane-summary" role="tabpanel">' + summary + '</div>';
    }

    var audioBlock = '';
    if (audioOk) {
      audioBlock = '<div id="agilo-audio-wrap" class="agilo-player wrapper-audio-api">' +
        '<audio controls preload="metadata" src="' + escapeHtml(job.audioUrl) + '"></audio></div>';
    }

    root.innerHTML =
      '<div class="dashboard-content agilo-share-doc">' +
      '<header class="ed-header"><div class="ed-wrap">' +
      '<div class="ed-title-wrap"><span class="ed-title">' + escapeHtml(vm.title) + '</span>' +
      '<span class="agilo-share-chip">' + escapeHtml(COPY.lectureSeule) + '</span></div>' +
      '<div class="agilo-share-actions">' + actions + '</div></div>' +
      '<p class="agilo-share-meta">' + escapeHtml(vm.metaBy) +
      (job.expiresAt ? ' · Lien à durée limitée' : '') + '</p></header>' +
      audioBlock +
      tabs +
      '<p class="agilo-share-banner">' + escapeHtml(COPY.banner) + '</p>' +
      '<div class="agilo-share-status" id="agilo-share-status"></div>' +
      panels +
      '</div>';

    var statusEl = $('#agilo-share-status', root);

    if (vm.useTabs) {
      root.querySelectorAll('.ed-tab').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var tab = btn.getAttribute('data-tab');
          root.querySelectorAll('.ed-tab').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
          var t = $('#pane-transcript', root);
          var s = $('#pane-summary', root);
          if (t) t.classList.toggle('is-active', tab === 'transcript');
          if (s) s.classList.toggle('is-active', tab === 'summary');
        });
      });
    }

    function copyText(label, html) {
      var plain = htmlToPlain(html);
      var done = function () { setStatus(statusEl, 'info', label + ' copié.'); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(plain).then(done).catch(function () { setStatus(statusEl, 'error', 'Copie impossible.'); });
      } else {
        setStatus(statusEl, 'error', 'Copie impossible sur ce navigateur.');
      }
    }

    var copyTranscriptBtn = root.querySelector('[data-act="copy-transcript"]');
    if (copyTranscriptBtn) {
      copyTranscriptBtn.addEventListener('click', function () {
        copyText(COPY.transcriptTab, transcript);
        capture('share_copy', { kind: 'transcript', docType: vm.docType });
      });
    }
    var copySummaryBtn = root.querySelector('[data-act="copy-summary"]');
    if (copySummaryBtn) {
      copySummaryBtn.addEventListener('click', function () {
        copyText(vm.summaryTabLabel, summary);
        capture('share_copy', { kind: 'summary', docType: vm.docType });
      });
    }
    capture('share_view_opened', { mock: qs('mock') === '1', audio: audioOk, docType: vm.docType });
  }

  function normalizeJob(j) {
    if (!j || typeof j !== 'object') return null;
    if (String(j.status || '').toUpperCase() === 'KO') return null;
    return {
      status: 'OK',
      jobTitle: j.jobTitle || j.title || '',
      filename: j.filename || '',
      sharedByName: j.sharedByName || j.sharedBy || '',
      expiresAt: j.expiresAt || j.expires_at || '',
      audioUrl: j.audioUrl || j.audio_url || '',
      audioAvailable: j.audioAvailable !== false && !!(j.audioUrl || j.audio_url),
      transcriptHtml: j.transcriptHtml || j.transcript_html || '',
      summaryHtml: j.summaryHtml || j.summary_html || '',
      segments: Array.isArray(j.segments) ? j.segments : [],
      sharedDocumentType: j.sharedDocumentType || j.shared_document_type || j.documentType || j.document_type || '',
      summaryTabLabel: j.summaryTabLabel || j.summary_tab_label || j.summaryLabel || j.summary_label || '',
      pageKicker: j.pageKicker || j.page_kicker || ''
    };
  }

  async function fetchJob(token) {
    var url = API_BASE + '/getSharedJobView?shareToken=' + encodeURIComponent(token);
    var r;
    try {
      r = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, credentials: 'omit' });
    } catch (_) {
      return { error: 'api_pending', raw: {} };
    }
    var j = {};
    try { j = await r.json(); } catch (_) { j = {}; }
    if (r.status === 404) return { error: 'api_pending', raw: j };
    if (!j || typeof j !== 'object' || !Object.keys(j).length) return { error: 'api_pending', raw: j };
    var code = j.errorMessage || j.error || j.exceptionName || '';
    if (!r.ok || String(j.status || '').toUpperCase() === 'KO') {
      if (/expired/i.test(code)) return { error: 'error_share_expired', raw: j };
      if (/revok/i.test(code)) return { error: 'error_share_revoked', raw: j };
      if (/not_found|invalid/i.test(code)) return { error: 'error_share_not_found', raw: j };
      if (/not_ready/i.test(code)) return { error: 'error_share_not_ready', raw: j };
      return { error: r.status === 404 ? 'api_pending' : 'network', raw: j };
    }
    var job = normalizeJob(j);
    if (!job) return { error: 'error_share_not_found', raw: j };
    return { job: job };
  }

  async function init() {
    injectStyles();
    var mount = ensureChrome();
    if (!mount) return;

    var token = parseToken();
    var jobId = parseJobId();
    var useMock = qs('mock') === '1';

    if (!token && !jobId && !useMock) {
      renderError(mount, 'missing_token');
      return;
    }

    if (useMock) {
      var mockJob = Object.assign({}, MOCK_JOB);
      var mockDoc = normalizeDocType(qs('doc'));
      if (mockDoc) mockJob.sharedDocumentType = mockDoc;
      if (qs('kicker')) mockJob.pageKicker = qs('kicker');
      renderJob(mount, mockJob, token || 'd8478fa34amock');
      return;
    }

    try {
      if (token) {
        var fromZip = await fetchJobFromShareZip(token);
        if (fromZip.job) {
          renderJob(mount, fromZip.job, token);
          return;
        }
        if (fromZip.error && fromZip.error !== 'zip_cors') {
          var jsonView = await fetchJob(token);
          if (jsonView.job) {
            renderJob(mount, jsonView.job, token);
            return;
          }
          renderError(mount, fromZip.error, { downloadUrl: downloadUrlFor(token) });
          return;
        }
        if (fromZip.error === 'zip_cors') {
          var pending = await fetchJob(token);
          if (pending.job) {
            renderJob(mount, pending.job, token);
            return;
          }
          renderError(mount, 'zip_cors', { downloadUrl: downloadUrlFor(token) });
          return;
        }
      }

      if (jobId) {
        var auth = await resolveAuth();
        if (!auth.email || !auth.token) {
          renderError(mount, 'need_login');
          return;
        }
        var sharedToken = await createSharedToken(jobId, auth);
        if (sharedToken) {
          try {
            history.replaceState({}, '', (location.pathname || '/auth/share') + '?token=' + encodeURIComponent(sharedToken));
          } catch (_) { /* ignore */ }
          var sharedZip = await fetchJobFromShareZip(sharedToken);
          if (sharedZip.job) {
            renderJob(mount, sharedZip.job, sharedToken);
            return;
          }
        }
        var byId = await fetchJobById(jobId, auth);
        if (byId.job) {
          renderJob(mount, byId.job, sharedToken || '');
          return;
        }
        var who = maskEmail(auth.email);
        renderError(mount, byId.error || 'error_job_not_found', {
          note: who ? ('Connecté en tant que ' + who + '.') : '',
          downloadUrl: sharedToken ? downloadUrlFor(sharedToken) : ''
        });
        return;
      }

      renderError(mount, token ? 'network' : 'missing_token');
    } catch (_) {
      renderError(mount, jobId ? 'need_login' : (token ? 'zip_cors' : 'network'), {
        downloadUrl: downloadUrlFor(token)
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
