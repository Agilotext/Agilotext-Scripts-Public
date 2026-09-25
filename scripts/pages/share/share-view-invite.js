/* ================================================================
   AGILOTEXT — Vue lecture seule d’un partage (transcription, CR, PV, etc.)
   Guest 11.0.5 : /auth/share#token=  (43 chars) → GET /api/v1/guestRead/document Bearer
   Historique  : /auth/share?token=d8478fa34a…  (zip servlet, fallback)
   Prod    : https://www.agilotext.com/auth/share
   Staging : https://agilotext-test.webflow.io/auth/share
   Mock    : ?mock=1
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
  var blobUrls = [];

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
    audioAvailable: true,
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
    var M = window.AgiloShareSegments;
    if (M && typeof M.mapGuestSegments === 'function') {
      return M.mapGuestSegments(arr);
    }
    /* Fallback si share-segments.js non chargé (même règle éditeur). */
    return arr.map(function (r, i) {
      var hasMilli = r.milli_start != null || r.milliStart != null;
      var raw = hasMilli
        ? (r.milli_start != null ? r.milli_start : r.milliStart)
        : r.start;
      var n = Number(raw);
      if (!Number.isFinite(n) || n < 0) n = 0;
      var startSec = hasMilli
        ? Math.floor(n / 1000)
        : Math.floor(n > 1e6 ? n / 1000 : n);
      return {
        speaker: String(r.speaker || '').trim() || ('Intervenant ' + (i + 1)),
        start: Math.max(0, startSec),
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

  function parseGuestToken() {
    var helpers = shareHelpers();
    if (helpers && helpers.parseGuestTokenFromLocation) {
      return helpers.parseGuestTokenFromLocation(window.location) || '';
    }
    var hash = String(window.location.hash || '');
    var hm = hash.match(/^#token=([^&]+)/i);
    if (hm) {
      try {
        var h = decodeURIComponent(hm[1]);
        if (/^[A-Za-z0-9_-]{43}$/.test(h)) return h;
      } catch (_) { /* ignore */ }
    }
    var q = String(qs('token') || qs('shareToken') || '');
    if (/^[A-Za-z0-9_-]{43}$/.test(q)) return q;
    return '';
  }

  function revokeBlobs() {
    var i;
    for (i = 0; i < blobUrls.length; i++) {
      try { URL.revokeObjectURL(blobUrls[i]); } catch (_) { /* ignore */ }
    }
    blobUrls = [];
  }

  function rememberBlobUrl(url) {
    if (url) blobUrls.push(url);
    return url;
  }

  function guestErrorCode(code) {
    var c = String(code || '');
    if (/error_guest_read_invalid_token|error_guest_read_not_found/i.test(c)) return 'error_share_not_found';
    if (/error_guest_read_not_ready/i.test(c)) return 'error_share_not_ready';
    if (/error_guest_read_forbidden|error_guest_read_origin_forbidden/i.test(c)) return 'error_guest_forbidden';
    if (/error_guest_read_bad_request/i.test(c)) return 'error_share_not_found';
    return '';
  }

  async function fetchGuestBlob(kind, guestToken) {
    var path = kind === 'audio' ? '/guestRead/audio' : '/guestRead/zip';
    var r;
    try {
      r = await fetch(API_BASE + path, {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + guestToken },
        credentials: 'omit',
        cache: 'no-store'
      });
    } catch (_) {
      return null;
    }
    if (!r.ok) return null;
    var blob;
    try { blob = await r.blob(); } catch (_) { return null; }
    if (!blob || !blob.size) return null;
    var url = rememberBlobUrl(URL.createObjectURL(blob));
    var name = '';
    var cd = r.headers.get('Content-Disposition') || '';
    var nm = cd.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
    if (nm) {
      try { name = decodeURIComponent(nm[1].replace(/"/g, '').trim()); }
      catch (_) { name = nm[1]; }
    }
    return { url: url, blob: blob, filename: name };
  }

  async function fetchGuestDocument(guestToken) {
    var r;
    try {
      r = await fetch(API_BASE + '/guestRead/document', {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: 'Bearer ' + guestToken },
        credentials: 'omit',
        cache: 'no-store'
      });
    } catch (_) {
      return { error: 'network' };
    }
    var j = {};
    try { j = await r.json(); } catch (_) { j = {}; }
    var code = String(j.errorMessage || j.error || j.exceptionName || '');
    var mapped = guestErrorCode(code);
    if (mapped) return { error: mapped, raw: j };
    if (!r.ok || String(j.status || '').toUpperCase() === 'KO') {
      if (r.status === 403) return { error: 'error_guest_forbidden', raw: j };
      if (r.status === 404) return { error: 'error_share_not_found', raw: j };
      return { error: 'network', raw: j };
    }
    var job = {
      status: 'OK',
      jobTitle: j.jobTitle || j.title || '',
      filename: j.filename || '',
      sharedByName: j.sharedByName || j.sharedBy || '',
      expiresAt: j.expiresAt || '',
      audioUrl: '',
      audioAvailable: j.audioAvailable === true,
      zipAvailable: j.zipAvailable !== false,
      transcriptHtml: j.transcriptHtml || '',
      summaryHtml: j.summaryHtml || '',
      segments: mapNicoSegments(j),
      sharedDocumentType: j.sharedDocumentType || '',
      summaryTabLabel: j.summaryTabLabel || '',
      pageKicker: j.pageKicker || '',
      guestToken: guestToken
    };
    if (job.audioAvailable) {
      var audio = await fetchGuestBlob('audio', guestToken);
      if (audio && audio.url) {
        job.audioUrl = audio.url;
        job.audioAvailable = true;
      } else {
        job.audioAvailable = false;
      }
    }
    return { job: job };
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

  function fmtHMS(s) {
    s = Math.max(0, Math.floor(Number(s) || 0));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    var MM = String(m).padStart(2, '0');
    var SS = String(sec).padStart(2, '0');
    if (h) return String(h).padStart(2, '0') + ':' + MM + ':' + SS;
    return MM + ':' + SS;
  }

  function silentWavUrl(seconds) {
    var sr = 8000;
    var n = Math.max(1, Math.floor(sr * (Number(seconds) || 1)));
    var dataSize = n * 2;
    var buf = new ArrayBuffer(44 + dataSize);
    var view = new DataView(buf);
    function wstr(offset, str) {
      var i;
      for (i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    }
    wstr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    wstr(8, 'WAVE');
    wstr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sr, true);
    view.setUint32(28, sr * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    wstr(36, 'data');
    view.setUint32(40, dataSize, true);
    return rememberBlobUrl(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
  }

  function guardGuestPlayerToken() {
    if (!window.globalToken) window.globalToken = 'guest-share';
  }

  function stripOwnerJobId(el) {
    if (!el) return;
    try {
      if (el.dataset) delete el.dataset.jobId;
      el.removeAttribute('data-job-id');
    } catch (_) { /* ignore */ }
  }

  function playerMarkup() {
    return (
      '<div id="agilo-audio-wrap" class="agilo-player" data-tour="audio">' +
      '<audio id="agilo-audio" preload="metadata"></audio>' +
      '<div class="agilo-bar">' +
      '<button id="agilo-skip-back" class="agilo-btn" type="button" title="Reculer de 10 s (Shift+← = -10s, ← = -5s)" aria-label="Reculer de 10 secondes">10s</button>' +
      '<button id="agilo-play" class="agilo-btn is-primary" type="button" aria-pressed="false" aria-controls="agilo-audio" data-state="paused">▶︎ Lire</button>' +
      '<button id="agilo-skip-fwd" class="agilo-btn" type="button" title="Avancer de 10 s (Shift+→ = +10s, → = +5s)" aria-label="Avancer de 10 secondes">10s</button>' +
      '<button id="agilo-speed" class="agilo-btn agilo-speed" type="button" title="Vitesse (clic = cycle 1x→2x ; S = raccourci)">1x</button>' +
      '<a id="agilo-download" class="agilo-btn" aria-label="Télécharger l\'audio" style="display:none;text-decoration:none"></a>' +
      '<div id="agilo-time" class="agilo-time visually-hidden" aria-live="polite">0:00 / 0:00</div>' +
      '<div class="agilo-spacer"></div>' +
      '<div class="agilo-vol" title="Volume (M = mute)">' +
      '<span class="icon-small --grey" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" width="1em" height="1em" focusable="false"><path d="M3 9v6h4l5 4V5L7 9H3zM16.5 12a3.5 3.5 0 0 0-2.5-3.346v6.692A3.5 3.5 0 0 0 16.5 12zm0-6.5v2.05a7 7 0 0 1 0 8.9V18.5a9.5 9.5 0 0 0 0-13z"></path></svg>' +
      '</span>' +
      '<input id="agilo-volume" type="range" min="0" max="1" step="0.01" value="1" aria-label="Volume">' +
      '</div></div>' +
      '<div class="agilo-timeline">' +
      '<div class="agilo-track" id="agilo-track" aria-label="Position de lecture">' +
      '<div class="agilo-buffered" id="agilo-buffered"></div>' +
      '<div class="agilo-progress" id="agilo-progress"></div>' +
      '<div class="agilo-thumb" id="agilo-thumb" aria-hidden="true"></div>' +
      '<div class="agilo-hover" id="agilo-hover" aria-hidden="true">0:00</div>' +
      '</div>' +
      '<div class="agilo-times" aria-hidden="true">' +
      '<div id="ag-current" class="ag-time ag-time--left">0:00</div>' +
      '<div id="ag-remaining" class="ag-time ag-time--right">0:00</div>' +
      '</div></div></div>'
    );
  }

  function ensureShareShell(root) {
    var doc = root.querySelector('.agilo-share-doc');
    if (!doc) {
      root.innerHTML =
        '<div class="dashboard-content agilo-share-doc" lang="fr">' +
        '<div id="agilo-share-header"></div>' +
        '<div id="agilo-audio-host" class="wrapper-audio-api" hidden></div>' +
        '<div id="agilo-share-body"></div>' +
        '</div>';
      doc = root.querySelector('.agilo-share-doc');
    }
    return {
      doc: doc,
      header: document.getElementById('agilo-share-header'),
      host: document.getElementById('agilo-audio-host'),
      body: document.getElementById('agilo-share-body')
    };
  }

  function mountPlayer(host, audioUrl) {
    if (!host) return null;
    guardGuestPlayerToken();
    var wrap = document.getElementById('agilo-audio-wrap');
    var audio = document.getElementById('agilo-audio');
    if (!wrap || !audio || wrap.parentNode !== host) {
      host.innerHTML = playerMarkup();
      wrap = document.getElementById('agilo-audio-wrap');
      audio = document.getElementById('agilo-audio');
    }
    stripOwnerJobId(wrap);
    var dl = document.getElementById('agilo-download');
    if (dl) {
      dl.style.display = 'none';
      dl.removeAttribute('href');
    }
    if (audio && audioUrl && audio.getAttribute('src') !== audioUrl) {
      audio.src = audioUrl;
    }
    host.removeAttribute('hidden');
    host.style.display = '';
    return audio;
  }

  function hidePlayer(host) {
    if (!host) return;
    host.setAttribute('hidden', '');
  }

  function syncFollow(job) {
    var F = window.AgiloShareFollow;
    if (!F || typeof F.bind !== 'function') return;
    F.bind({
      segments: Array.isArray(job.segments) ? job.segments : [],
      root: document.getElementById('transcriptEditor')
    });
  }

  function pingSticky() {
    try {
      window.dispatchEvent(new CustomEvent('agilo:load', { detail: {} }));
    } catch (_) { /* ignore */ }
  }

  function capture(event, props) {
    var clean = {};
    var k;
    for (k in (props || {})) {
      if (!Object.prototype.hasOwnProperty.call(props, k)) continue;
      if (/token/i.test(k)) continue;
      clean[k] = props[k];
    }
    try {
      if (window.posthog && typeof window.posthog.capture === 'function') {
        window.posthog.capture(event, clean);
      }
    } catch (_) { /* ignore */ }
  }

  function injectStyles() {
    if (document.getElementById('agilo-share-view-styles')) return;
    var css = [
      'html.agilo-share-page .nav_component,html.agilo-share-page footer.footer{display:none!important}',
      'html.agilo-share-page .main-wrapper{min-height:100vh}',
      'html.agilo-share-page .dashboard.mes-transcript,html.agilo-share-page.agilo-a11y-app .dashboard.mes-transcript{min-height:100vh;align-items:stretch;flex-direction:column!important;width:100%;max-width:none;overflow-x:hidden}',
      'html.agilo-share-page .dashboard-left,html.agilo-share-page.agilo-a11y-app .dashboard-left{height:auto!important;min-height:0!important;max-height:none!important;width:100%!important;max-width:none!important;flex:0 0 auto!important;position:relative!important}',
      'html.agilo-share-page .dashboard-left .dashboard-menu.menu-app,html.agilo-share-page.agilo-a11y-app .dashboard-left .dashboard-menu.menu-app{width:100%!important;min-width:0!important;max-width:none!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;flex-direction:row!important;align-items:center!important;justify-content:space-between!important;padding:.75rem 1.25rem!important;gap:.75rem!important;box-sizing:border-box!important}',
      'html.agilo-share-page .dashboard-menu.menu-app a.dashboard-link,html.agilo-share-page.agilo-a11y-app .dashboard-menu.menu-app a.dashboard-link{width:auto!important;max-width:none!important}',
      'html.agilo-share-page .dashboard-menu .full-width{display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:flex-end!important;gap:.75rem!important;width:auto!important;height:auto!important;min-height:0!important}',
      'html.agilo-share-page .dashboard-menu .nav_logo.app-center,html.agilo-share-page .dashboard-menu .nav_logo{max-height:1.75rem}',
      'html.agilo-share-page .section_hero.app,html.agilo-share-page .section_hero.app .padding-global,html.agilo-share-page .container-large{max-width:none!important;width:100%!important}',
      'html.agilo-share-page .dashboard-content{max-width:none!important;width:100%}',
      'html.agilo-share-page #editorRoot .dashboard-content.agilo-share-doc,#editorRoot .agilo-share-doc{display:flex!important;flex-direction:column!important;align-items:stretch!important;width:100%!important;max-width:none!important}',
      '#editorRoot #agilo-share-header,#editorRoot #agilo-audio-host,#editorRoot #agilo-share-body{width:100%!important;max-width:none!important;align-self:stretch!important}',
      'html.agilo-share-page .dashboard-right{flex:1 1 auto;width:100%!important;max-width:none!important;padding:1.25rem 1.5rem 2.5rem;text-align:left!important;box-sizing:border-box!important}',
      'html.agilo-share-page #editorRoot{max-width:none!important;width:100%;flex:1;text-align:left!important}',
      '#editorRoot .agilo-share-doc{max-width:none;width:100%}',
      '#editorRoot .ed-header{display:flex;flex-direction:column;gap:.5rem;padding:0 0 .75rem;border-bottom:0;text-align:left!important;width:100%}',
      '#editorRoot .ed-header .ed-wrap{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:flex-start;gap:.625rem 1rem;width:100%}',
      '#editorRoot .ed-title-wrap{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-start;gap:.5rem .625rem;min-width:0;width:100%}',
      '#editorRoot .ed-title{font-size:1.35rem;line-height:1.25;font-weight:700;margin:0;text-align:left}',
      '#editorRoot .agilo-share-chip{display:inline-flex;align-items:center;padding:.1875rem .5rem;border-radius:999px;background:rgba(23,74,150,.08);color:var(--color--blue,#174a96);font-size:.72rem;font-weight:700;letter-spacing:.02em;text-transform:uppercase}',
      '#editorRoot .agilo-share-meta{margin:0;color:var(--color--gris,#525252);font-size:.82rem;line-height:1.4;text-align:left}',
      '#editorRoot .agilo-share-actions{display:flex;align-items:center;gap:.125rem;margin-left:auto;padding:0 0 .5rem}',
      '#editorRoot .agilo-share-act{appearance:none;border:0;background:none;padding:0;font:inherit;color:var(--color--blue,#174a96);cursor:pointer;text-decoration:none}',
      '#editorRoot .agilo-share-act--icon{position:relative;width:2.25rem;height:2.25rem;display:inline-flex;align-items:center;justify-content:center;border-radius:.5rem;flex:0 0 auto}',
      '#editorRoot .agilo-share-act--icon:hover{background:rgba(23,74,150,.08);text-decoration:none}',
      '#editorRoot .agilo-share-act--icon .icon-1x1-small{width:1.125rem;height:1.125rem;display:block}',
      '#editorRoot .agilo-share-act--icon.is-copied{color:var(--color--green,#1c661a)}',
      '#editorRoot .agilo-share-act__icon--check{display:none;position:absolute;inset:0;align-items:center;justify-content:center}',
      '#editorRoot .agilo-share-act--icon.is-copied .agilo-share-act__icon--main{opacity:0}',
      '#editorRoot .agilo-share-act--icon.is-copied .agilo-share-act__icon--check{display:flex}',
      '#editorRoot .visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}',
      '#editorRoot #agilo-audio-host{margin:0 0 .875rem}',
      '#editorRoot #agilo-download{display:none!important}',
      '#editorRoot #summaryEditor{outline:none}',
      '#editorRoot #summaryEditor .ag-summary-iframe{width:100%;border:0;min-height:max(600px,100svh);background:#fff;display:block}',
      '#editorRoot #transcriptEditor .ag-seg__text{white-space:pre-wrap;overflow-wrap:anywhere}',
      '#editorRoot #transcriptEditor,#editorRoot #summaryEditor{width:100%;max-width:none;margin-left:0}',
      '#editorRoot nav.ed-tabs{display:flex;justify-content:space-between!important;align-items:flex-end;gap:.75rem;margin:.25rem 0 .875rem;padding:0;border-bottom:1px solid rgba(52,58,64,.14);text-align:left;width:100%}',
      '#editorRoot .agilo-share-tabs{display:flex;gap:.25rem;min-width:0}',
      '#editorRoot .agilo-share-meta,#editorRoot .agilo-share-banner{text-align:left}',
      '#editorRoot .ed-tab{appearance:none;border:0;background:none;padding:.625rem .75rem .75rem;font:inherit;font-weight:600;color:#525252;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}',
      '#editorRoot .ed-tab.is-active{color:var(--color--blue,#174a96);border-bottom-color:var(--color--blue,#174a96)}',
      '#editorRoot .agilo-share-banner{margin:0 0 .875rem;font-size:.8rem;line-height:1.45;color:var(--color--gris,#525252)}',
      '#editorRoot .agilo-share-status{margin:0 0 .75rem;padding:.5rem .625rem;border-radius:var(--0-5_radius,.5rem);font-size:.86rem;display:none}',
      '#editorRoot .agilo-share-status.is-info{display:block;background:rgba(23,74,150,.08);color:var(--color--blue,#174a96)}',
      '#editorRoot .agilo-share-status.is-error{display:block;background:rgba(168,38,51,.08);color:var(--color--rouge,#a82633)}',
      '#editorRoot .edtr-pane{display:none;font-size:.95rem;line-height:1.65;color:var(--color--gris_foncé,#020202);width:100%;max-width:none}',
      '#editorRoot .edtr-pane.is-active{display:block}',
      '#editorRoot .edtr-pane h2,#editorRoot .edtr-pane h3{margin:1.15em 0 .4em;font-size:1.05rem}',
      '#editorRoot .edtr-pane h2:first-child,#editorRoot .edtr-pane h3:first-child{margin-top:0}',
      '#editorRoot #pane-transcript .ag-seg{margin:0 0 1rem}',
      '#editorRoot #pane-transcript .ag-seg__head{margin:0 0 .25rem}',
      '#editorRoot #pane-transcript .ag-seg__head .time{font-size:.875rem}',
      '#editorRoot #pane-transcript .ag-seg__head .speaker{font-size:.95rem;font-weight:700;letter-spacing:.02em;color:var(--color--blue,#174a96)}',
      '#editorRoot .agilo-share-error{text-align:center;padding:3rem .75rem}',
      '@media (max-width:991px){html.agilo-share-page .dashboard-right{padding:1rem 1.25rem 2rem}#editorRoot .ed-title{font-size:1.2rem}}',
      '@media (max-width:479px){html.agilo-share-page .dashboard-left .dashboard-menu.menu-app,html.agilo-share-page.agilo-a11y-app .dashboard-left .dashboard-menu.menu-app{padding:.625rem .75rem!important}html.agilo-share-page .dashboard-right{padding:.75rem .75rem calc(1.5rem + env(safe-area-inset-bottom, 0))}#editorRoot .ed-title{font-size:1.1rem}#editorRoot .agilo-share-act--icon{width:2.75rem;height:2.75rem}}'
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
        text: 'Ouvrez le lien Partager (il se termine par #token=…). Ce n’est pas le numéro du fichier dans l’éditeur.'
      },
      error_guest_forbidden: {
        title: 'Lien non autorisé',
        text: 'Ce partage n’est pas lisible depuis cette page. Ouvrez le lien original, ou demandez un nouveau partage.'
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
    var shell = ensureShareShell(root);
    hidePlayer(shell.host);
    if (shell.header) shell.header.innerHTML = '';
    if (shell.body) {
      shell.body.innerHTML =
        '<div class="agilo-share-error" lang="fr">' +
        '<h2 class="h1-small">' + escapeHtml(copy.title) + '</h2><p>' + escapeHtml(copy.text) + '</p>' +
        note +
        '<p style="margin-top:18px"><a class="button-secondary" href="' + escapeHtml(href) + '">' + escapeHtml(label) + '</a></p>' +
        '</div>';
    }
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
    var audioOk = job.audioAvailable !== false && !!job.audioUrl;
    var defaultTab = 'summary';
    if (!showSummary && showTranscript) defaultTab = 'transcript';
    if (docType === 'transcript' && showTranscript) defaultTab = 'transcript';
    if (audioOk && showTranscript) defaultTab = 'transcript';
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
    return segs.map(function (seg, i) {
      var start = Number(seg.start);
      if (!Number.isFinite(start) || start < 0) start = 0;
      var tText = fmtHMS(start);
      return '<article class="ag-seg" data-id="s' + i + '" data-start="' + start + '" data-speaker="' +
        escapeHtml(seg.speaker || '') + '">' +
        '<header class="ag-seg__head">' +
        '<button type="button" class="time" data-action="seek" data-t="' + start + '" title="Aller à ' + tText + '">' +
        tText + '</button>' +
        '<span class="speaker">' + escapeHtml(seg.speaker || 'Intervenant') + '</span>' +
        '</header>' +
        '<div class="ag-seg__text">' + escapeHtml(seg.text || '') + '</div>' +
        '</article>';
    }).join('');
  }

  function buildSummaryHtml(job) {
    if (job.summaryHtml) return String(job.summaryHtml);
    return '<p>' + escapeHtml(COPY.summaryEmpty) + '</p>';
  }

  function summaryNeedsIframe(html) {
    var h = String(html || '');
    if (!h) return false;
    return /<!DOCTYPE/i.test(h) ||
      /<head[\s>]/i.test(h) ||
      /<body[\s>]/i.test(h) ||
      /<style[\s>]/i.test(h) ||
      /\*\s*\{/.test(h) ||
      /body\s*\{/.test(h);
  }

  /** Même isolation que l’éditeur (injectSummaryContent) sans édition ni mail blocks. */
  function injectShareSummaryContent(el, html) {
    if (!el || !html) return;
    var raw = String(html);
    el.setAttribute('data-raw-html', raw);

    if (summaryNeedsIframe(raw)) {
      el.setAttribute('data-is-iframe', 'true');
      el.innerHTML = '';
      var iframe = document.createElement('iframe');
      iframe.className = 'ag-summary-iframe';
      iframe.setAttribute('sandbox', 'allow-same-origin');
      iframe.setAttribute('title', 'Compte rendu');
      el.appendChild(iframe);

      iframe.onload = function () {
        try {
          var idoc = this.contentDocument || this.contentWindow.document;
          idoc.open();
          idoc.write(raw);
          idoc.close();

          var ifr = this;
          var resolveSummarySvhFloorPx = function () {
            try {
              var probe = document.createElement('div');
              probe.style.cssText =
                'position:fixed;left:-10000px;top:0;width:1px;height:100svh;visibility:hidden;pointer-events:none;';
              document.documentElement.appendChild(probe);
              var hPx = Math.round(probe.getBoundingClientRect().height);
              probe.remove();
              if (hPx > 200) return hPx;
            } catch (e) { /* ignore */ }
            return Math.round(typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 880);
          };
          var summarySvhFloorPx = resolveSummarySvhFloorPx();
          var scheduleSummaryIframeFit = function () {
            try {
              var body = idoc.body;
              if (!body) return;
              var rootEl = idoc.documentElement;
              var measured = Math.max(
                body.scrollHeight,
                body.offsetHeight,
                rootEl ? rootEl.scrollHeight : 0,
                rootEl ? rootEl.offsetHeight : 0
              );
              var nextH = Math.max(measured + 24, summarySvhFloorPx);
              ifr.style.height = nextH + 'px';
              ifr.style.minHeight = summarySvhFloorPx + 'px';
            } catch (e) { /* ignore */ }
          };
          [0, 120, 450, 1400].forEach(function (ms) {
            setTimeout(scheduleSummaryIframeFit, ms);
          });
        } catch (e) {
          try {
            this.srcdoc = raw;
          } catch (e2) {
            el.setAttribute('data-is-iframe', 'false');
            el.innerHTML = raw;
          }
        }
      };

      if (iframe.contentDocument) {
        iframe.onload();
      }
    } else {
      el.setAttribute('data-is-iframe', 'false');
      el.innerHTML = raw;
    }
  }

  function nucleoSvg(kind) {
    var copyPaths =
      '<rect x="6.25" y="1.75" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/>' +
      '<path d="M11.75 11.75V14.25C11.75 15.3546 10.8546 16.25 9.75 16.25H3.75C2.64543 16.25 1.75 15.3546 1.75 14.25V8.25C1.75 7.14543 2.64543 6.25 3.75 6.25H6.25" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>';
    var downloadPaths =
      '<path d="M9 2.75V11.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '<path d="M5.75 8L9 11.25L12.25 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
      '<path d="M3.25 15.25H14.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
    var checkPaths =
      '<polyline points="2.75 9.25 6.75 14.25 15.25 3.75" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';
    var inner = copyPaths;
    if (kind === 'download') inner = downloadPaths;
    if (kind === 'check') inner = checkPaths;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" fill="none" class="icon-1x1-small" aria-hidden="true">' + inner + '</svg>';
  }

  function iconAction(tag, act, label, icon, href) {
    var open = tag === 'a'
      ? '<a class="agilo-share-act agilo-share-act--icon" data-act="' + act + '" href="' + escapeHtml(href || '#') + '" aria-label="' + escapeHtml(label) + '" title="' + escapeHtml(label) + '">'
      : '<button type="button" class="agilo-share-act agilo-share-act--icon" data-act="' + act + '" aria-label="' + escapeHtml(label) + '" title="' + escapeHtml(label) + '">';
    var close = tag === 'a' ? '</a>' : '</button>';
    return open +
      '<span class="agilo-share-act__icon agilo-share-act__icon--main">' + nucleoSvg(icon) + '</span>' +
      (icon === 'copy' ? '<span class="agilo-share-act__icon agilo-share-act__icon--check">' + nucleoSvg('check') + '</span>' : '') +
      '<span class="visually-hidden">' + escapeHtml(label) + '</span>' +
      close;
  }

  function renderJob(root, job, token) {
    var vm = resolveShareViewModel(job);
    var guestToken = job.guestToken || '';
    var downloadUrl = guestToken ? '' : downloadUrlFor(token);
    var audioOk = job.audioAvailable !== false && !!job.audioUrl;
    var transcript = buildTranscriptHtml(job);
    var summary = buildSummaryHtml(job);
    var shell = ensureShareShell(root);
    stripOwnerJobId(root);

    try { document.title = vm.title + ' | Agilotext'; } catch (_) { /* ignore */ }

    var copyLabel = vm.defaultTab === 'summary' && vm.showSummary ? vm.copySummaryLabel : COPY.copyTranscript;
    var actions = '';
    if (vm.showTranscript || vm.showSummary) {
      actions += iconAction('button', 'copy-active', copyLabel, 'copy');
    }
    if (guestToken && job.zipAvailable !== false) {
      actions += iconAction('button', 'download-guest', COPY.download, 'download');
    } else if (downloadUrl) {
      actions += iconAction('a', 'download', COPY.download, 'download', downloadUrl);
    }

    var tabBtns = '';
    if (vm.useTabs) {
      tabBtns =
        '<button type="button" class="ed-tab' + (vm.defaultTab === 'transcript' ? ' is-active' : '') +
        '" data-tab="transcript" role="tab">' + escapeHtml(COPY.transcriptTab) + '</button>' +
        '<button type="button" class="ed-tab' + (vm.defaultTab === 'summary' ? ' is-active' : '') +
        '" data-tab="summary" role="tab">' + escapeHtml(vm.summaryTabLabel) + '</button>';
    }
    var tabs =
      '<nav class="ed-tabs" role="tablist">' +
      '<div class="agilo-share-tabs">' + tabBtns + '</div>' +
      '<div class="agilo-share-actions">' + actions + '</div>' +
      '</nav>';

    var panels = '';
    if (vm.showTranscript) {
      panels += '<div class="edtr-pane' + (vm.defaultTab === 'transcript' ? ' is-active' : '') +
        '" id="pane-transcript" role="tabpanel">' +
        '<div id="transcriptEditor">' + transcript + '</div></div>';
    }
    if (vm.showSummary) {
      panels += '<div class="edtr-pane' + (vm.defaultTab === 'summary' ? ' is-active' : '') +
        '" id="pane-summary" role="tabpanel">' +
        '<div id="summaryEditor" class="ag-summary-readonly"></div></div>';
    }

    if (shell.header) {
      shell.header.innerHTML =
        '<header class="ed-header"><div class="ed-wrap">' +
        '<div class="ed-title-wrap"><span class="ed-title">' + escapeHtml(vm.title) + '</span>' +
        '<span class="agilo-share-chip">' + escapeHtml(COPY.lectureSeule) + '</span></div>' +
        '</div>' +
        '<p class="agilo-share-meta">' + escapeHtml(vm.metaBy) +
        (job.expiresAt ? ' · Lien à durée limitée' : '') + '</p></header>';
    }

    if (audioOk) {
      mountPlayer(shell.host, job.audioUrl);
    } else {
      hidePlayer(shell.host);
    }

    if (shell.body) {
      shell.body.innerHTML =
        tabs +
        '<p class="agilo-share-banner">' + escapeHtml(COPY.banner) + '</p>' +
        '<div class="agilo-share-status" id="agilo-share-status"></div>' +
        panels;
    }

    if (vm.showSummary) {
      var summaryMount = $('#summaryEditor', root);
      if (summaryMount) injectShareSummaryContent(summaryMount, summary);
    }

    var statusEl = $('#agilo-share-status', root);
    var copyBtn = root.querySelector('[data-act="copy-active"]');

    function activeCopy() {
      var tab = root.querySelector('.ed-tab.is-active');
      var which = tab ? tab.getAttribute('data-tab') : vm.defaultTab;
      if (which === 'summary' && vm.showSummary) {
        var sumEl = $('#summaryEditor', root);
        var sumHtml = (sumEl && sumEl.getAttribute('data-raw-html')) || summary;
        return { label: vm.copySummaryLabel, html: sumHtml, kind: 'summary', spoken: vm.summaryTabLabel };
      }
      return { label: COPY.copyTranscript, html: transcript, kind: 'transcript', spoken: COPY.transcriptTab };
    }

    function syncCopyLabel() {
      if (!copyBtn) return;
      var t = activeCopy();
      copyBtn.setAttribute('aria-label', t.label);
      copyBtn.title = t.label;
      var vh = copyBtn.querySelector('.visually-hidden');
      if (vh) vh.textContent = t.label;
    }

    function markCopied(btn) {
      if (!btn) return;
      btn.classList.add('is-copied');
      setTimeout(function () { btn.classList.remove('is-copied'); }, 1200);
    }

    if (vm.useTabs) {
      root.querySelectorAll('.ed-tab').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var tab = btn.getAttribute('data-tab');
          root.querySelectorAll('.ed-tab').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
          var t = $('#pane-transcript', root);
          var s = $('#pane-summary', root);
          if (t) t.classList.toggle('is-active', tab === 'transcript');
          if (s) s.classList.toggle('is-active', tab === 'summary');
          syncCopyLabel();
          if (tab === 'transcript') pingSticky();
        });
      });
    }

    function copyText(label, html, spoken) {
      var plain = htmlToPlain(html);
      var done = function () {
        setStatus(statusEl, 'info', (spoken || label) + ' copié.');
        markCopied(copyBtn);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(plain).then(done).catch(function () { setStatus(statusEl, 'error', 'Copie impossible.'); });
      } else {
        setStatus(statusEl, 'error', 'Copie impossible sur ce navigateur.');
      }
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var t = activeCopy();
        copyText(t.label, t.html, t.spoken);
        capture('share_copy', { kind: t.kind, docType: vm.docType });
      });
    }
    var guestDl = root.querySelector('[data-act="download-guest"]');
    if (guestDl && guestToken) {
      guestDl.addEventListener('click', async function () {
        guestDl.disabled = true;
        setStatus(statusEl, 'info', 'Préparation du téléchargement…');
        var pack = await fetchGuestBlob('zip', guestToken);
        if (!pack || !pack.url) {
          setStatus(statusEl, 'error', 'Téléchargement indisponible.');
          guestDl.disabled = false;
          return;
        }
        var a = document.createElement('a');
        a.href = pack.url;
        a.download = pack.filename || 'agilotext-partage.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setStatus(statusEl, 'info', 'Téléchargement lancé.');
        guestDl.disabled = false;
        capture('share_download', { kind: 'guest_zip' });
      });
    }

    syncFollow(job);
    pingSticky();
    capture('share_view_opened', { mock: qs('mock') === '1', audio: audioOk, docType: vm.docType, guest: !!guestToken });
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

  async function loadShare(mount) {
    var previousBlobs = blobUrls.slice();
    blobUrls = [];
    function dropOldBlobs() {
      var i;
      for (i = 0; i < previousBlobs.length; i++) {
        if (blobUrls.indexOf(previousBlobs[i]) >= 0) continue;
        try { URL.revokeObjectURL(previousBlobs[i]); } catch (_) { /* ignore */ }
      }
    }
    var guestToken = parseGuestToken();
    var token = parseToken();
    var jobId = guestToken ? '' : parseJobId();
    var useMock = qs('mock') === '1';

    if (!guestToken && !token && !jobId && !useMock) {
      renderError(mount, 'missing_token');
      dropOldBlobs();
      return;
    }

    if (useMock) {
      var mockJob = Object.assign({}, MOCK_JOB);
      var mockDoc = normalizeDocType(qs('doc'));
      if (mockDoc) mockJob.sharedDocumentType = mockDoc;
      if (qs('kicker')) mockJob.pageKicker = qs('kicker');
      mockJob.audioUrl = silentWavUrl(40);
      mockJob.audioAvailable = true;
      renderJob(mount, mockJob, token || 'd8478fa34amock');
      dropOldBlobs();
      return;
    }

    try {
      if (guestToken) {
        var guest = await fetchGuestDocument(guestToken);
        if (guest.job) {
          renderJob(mount, guest.job, '');
          dropOldBlobs();
          return;
        }
        renderError(mount, guest.error || 'error_share_not_found');
        dropOldBlobs();
        return;
      }

      if (token) {
        var fromZip = await fetchJobFromShareZip(token);
        if (fromZip.job) {
          renderJob(mount, fromZip.job, token);
          dropOldBlobs();
          return;
        }
        if (fromZip.error && fromZip.error !== 'zip_cors') {
          renderError(mount, fromZip.error, { downloadUrl: downloadUrlFor(token) });
          dropOldBlobs();
          return;
        }
        if (fromZip.error === 'zip_cors') {
          renderError(mount, 'zip_cors', { downloadUrl: downloadUrlFor(token) });
          dropOldBlobs();
          return;
        }
      }

      if (jobId) {
        var auth = await resolveAuth();
        if (!auth.email || !auth.token) {
          renderError(mount, 'need_login');
          dropOldBlobs();
          return;
        }
        var byId = await fetchJobById(jobId, auth);
        if (byId.job) {
          renderJob(mount, byId.job, '');
          dropOldBlobs();
          return;
        }
        var who = maskEmail(auth.email);
        renderError(mount, byId.error || 'error_job_not_found', {
          note: who ? ('Connecté en tant que ' + who + '.') : ''
        });
        dropOldBlobs();
        return;
      }

      renderError(mount, token ? 'network' : 'missing_token');
    } catch (_) {
      renderError(mount, jobId ? 'need_login' : (guestToken || token ? 'network' : 'missing_token'));
    }
    dropOldBlobs();
  }

  async function init() {
    injectStyles();
    var mount = ensureChrome();
    if (!mount) return;
    stripOwnerJobId(mount);
    guardGuestPlayerToken();
    window.addEventListener('pagehide', revokeBlobs);
    window.addEventListener('hashchange', function () { loadShare(mount); });
    await loadShare(mount);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
