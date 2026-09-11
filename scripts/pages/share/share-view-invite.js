/* ================================================================
   AGILOTEXT — Vue lecture seule d’un partage (transcription, CR, PV, etc.)
   Page : /auth/share?token=d8478fa34a…
   Prod    : https://www.agilotext.com/auth/share?token=…
   Staging : https://agilotext-test.webflow.io/auth/share?token=…
   Embed Webflow :
     <div id="editorRoot" class="editorroot"></div>
     <script src="…/scripts/shared/agilo-share-url.js"></script>
     <script src="…/scripts/pages/share/share-view-invite.js?v=share-v1"></script>
   API : GET /api/v1/getSharedJobView?shareToken=…  (Nico)
   Mock  : ?mock=1 (&doc=transcript|cr|pv|note pour tester les libellés)
   ================================================================ */
(function () {
  'use strict';

  if (!/^\/(auth\/)?share\/?$/.test(window.location.pathname || '')) return;
  if (window.__agiloShareViewInit) return;
  window.__agiloShareViewInit = true;

  var API_BASE = 'https://api.agilotext.com/api/v1';
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
    banner: 'Document confidentiel. Ne le republiez pas. Hébergement en France. Vous pouvez lire, copier et télécharger, sans modifier l’original.',
    audioMissing: 'Audio cloud indisponible (conservation limitée, 30 jours en Business). Le texte reste lisible.',
    ctaBody: 'Vous aussi, transformez vos échanges en texte structuré avec Agilotext.',
    ctaButton: 'Créer un compte gratuit',
    transcriptEmpty: 'Transcription indisponible.',
    summaryEmpty: 'Document indisponible.'
  };

  var MOCK_JOB = {
    status: 'OK',
    jobTitle: 'Entretien d’admission (exemple)',
    filename: 'admission-demo.mp3',
    sharedByName: 'Équipe Agilotext',
    expiresAt: '',
    audioUrl: '',
    audioAvailable: false,
    transcriptHtml: '<p><strong>Intervenant 1</strong> — Bonjour, merci d’être venu pour cet entretien d’admission.</p><p><strong>Intervenant 2</strong> — Merci, je vais vous présenter la situation de Madame Dupont.</p>',
    summaryHtml: '<h2>Compte rendu</h2><p>Entretien d’admission. Points abordés : dossier, autonomie, suite à donner.</p><ul><li>Décision : dossier à compléter</li><li>Relance prévue sous 8 jours</li></ul>',
    segments: [
      { speaker: 'Intervenant 1', start: 0, text: 'Bonjour, merci d’être venu pour cet entretien d’admission.' },
      { speaker: 'Intervenant 2', start: 12, text: 'Merci, je vais vous présenter la situation de Madame Dupont.' }
    ]
  };

  function qs(name) {
    try { return new URLSearchParams(window.location.search).get(name) || ''; }
    catch (_) { return ''; }
  }

  function shareHelpers() {
    return window.AgiloShareUrl || null;
  }

  function parseToken() {
    var raw = qs('token') || qs('shareToken') || '';
    var helpers = shareHelpers();
    if (helpers && helpers.parseShareToken) return helpers.parseShareToken(raw) || raw;
    return String(raw).replace(/-download$/i, '');
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
      '#editorRoot .agilo-share-banner,#agilo-share-view .agilo-share-banner{margin:0 0 16px;padding:10px 12px;border-radius:var(--0-5_radius,0.5rem);background:rgba(23,74,150,.07);border:1px solid rgba(23,74,150,.16);font-size:.86rem;line-height:1.5;color:var(--color--gris,#525252)}',
      '#editorRoot .agilo-share-status,#agilo-share-view .agilo-share-status{margin:0 0 12px;padding:10px 12px;border-radius:var(--0-5_radius,0.5rem);font-size:.9rem;display:none}',
      '#editorRoot .agilo-share-status.is-info,#agilo-share-view .agilo-share-status.is-info{display:block;background:rgba(23,74,150,.08);color:var(--color--blue,#174a96)}',
      '#editorRoot .agilo-share-status.is-error,#agilo-share-view .agilo-share-status.is-error{display:block;background:rgba(168,38,51,.08);color:var(--color--rouge,#a82633)}',
      '#editorRoot .edtr-pane{display:none;font-size:.95rem;line-height:1.65}',
      '#editorRoot .edtr-pane.is-active{display:block}',
      '#editorRoot .edtr-pane h2,#editorRoot .edtr-pane h3{margin:1.1em 0 .4em}',
      '#editorRoot #pane-transcript .ag-seg{margin:0 0 12px}',
      '#editorRoot #pane-transcript .ag-seg__head .speaker{font-size:.78rem;font-weight:700;color:var(--color--blue,#174a96)}',
      '#editorRoot .agilo-share-cta{margin:22px 0 0;padding:18px 16px;border-radius:var(--0-5_radius,0.5rem);background:var(--color--blue,#174a96);color:#fff;text-align:center}',
      '#editorRoot .agilo-share-cta p{margin:0 0 12px;font-size:.95rem;line-height:1.5}',
      '#editorRoot .agilo-share-cta a{display:inline-flex;align-items:center;justify-content:center;padding:11px 18px;border-radius:var(--0-5_radius,0.5rem);background:#fff;color:#174a96;font-weight:700;text-decoration:none}',
      '#editorRoot .agilo-share-error{text-align:center;padding:28px 12px}',
      '#editorRoot .wrapper-audio-api audio{width:100%;height:40px}',
      '#editorRoot .ed-wrap.vertical{display:flex;flex-wrap:wrap;gap:8px;align-items:center}'
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
        text: 'Ce lien de lecture est invalide ou incomplet. Ouvrez le lien reçu par email ou message.'
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

  function renderError(root, code) {
    var copy = errorCopy(code);
    root.innerHTML =
      '<div class="dashboard-content agilo-share-error" lang="fr">' +
      '<h2 class="h1-small">' + escapeHtml(copy.title) + '</h2><p>' + escapeHtml(copy.text) + '</p>' +
      '<p style="margin-top:18px"><a class="button-secondary" href="' + SIGNUP_URL + '">Essayer Agilotext gratuitement</a></p>' +
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
      '<a href="https://www.agilotext.com/" class="nav_logo-link app-center w-nav-brand">' +
      '<img src="' + LOGO_SRC + '" loading="lazy" alt="Agilotext" class="nav_logo app-center">' +
      '</a>' +
      '<div class="full-width">' +
      '<a href="' + HELP_URL + '" class="dashboard-link w-inline-block"><div>Aide</div></a>' +
      '<a href="' + SIGNUP_URL + '" class="dashboard-link w-inline-block"><div>Créer un compte</div></a>' +
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
    var defaultTab = showTranscript ? 'transcript' : 'summary';
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
    var helpers = shareHelpers();
    var downloadUrl = helpers && helpers.toApiDownloadUrl
      ? helpers.toApiDownloadUrl(token)
      : ('https://api.agilotext.com/api/' + token + '-download');
    var audioOk = job.audioAvailable !== false && !!job.audioUrl;
    var transcript = buildTranscriptHtml(job);
    var summary = buildSummaryHtml(job);

    try { document.title = vm.title + ' | Agilotext'; } catch (_) { /* ignore */ }

    var actions = '';
    if (vm.showTranscript) {
      actions += '<button type="button" class="button-secondary black" data-act="copy-transcript">' +
        escapeHtml(COPY.copyTranscript) + '</button>';
    }
    if (vm.showSummary) {
      actions += '<button type="button" class="button-secondary black" data-act="copy-summary">' +
        escapeHtml(vm.copySummaryLabel) + '</button>';
    }
    actions += '<a class="button-secondary black" data-act="download" href="' + escapeHtml(downloadUrl) + '">' +
      escapeHtml(COPY.download) + '</a>';

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

    root.innerHTML =
      '<div class="dashboard-content">' +
      '<div class="ed-header"><div class="ed-wrap">' +
      '<div class="ed-title-wrap"><span class="ed-title">' + escapeHtml(vm.title) + '</span></div>' +
      '<span class="ri-job-id">' + escapeHtml(vm.metaBy) +
      (job.expiresAt ? ' · Lien à durée limitée' : '') + '</span>' +
      '</div><div class="ed-wrap vertical">' + actions + '</div></div>' +
      '<div class="agilo-share-banner">' + escapeHtml(COPY.banner) + '</div>' +
      '<div class="agilo-share-status" id="agilo-share-status"></div>' +
      '<div class="wrapper-audio-api" id="agilo-share-audio"></div>' +
      tabs + panels +
      '<div class="agilo-share-cta">' +
      '<p>' + escapeHtml(COPY.ctaBody) + '</p>' +
      '<a id="agilo-share-cta" href="' + SIGNUP_URL + '">' + escapeHtml(COPY.ctaButton) + '</a>' +
      '</div></div>';

    var audioWrap = $('#agilo-share-audio', root);
    if (audioOk) {
      audioWrap.innerHTML = '<audio controls preload="metadata" src="' + escapeHtml(job.audioUrl) + '"></audio>';
    } else {
      audioWrap.innerHTML = '<p class="text-size-small text-color-grey">' + escapeHtml(COPY.audioMissing) + '</p>';
    }

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
    var cta = $('#agilo-share-cta', root);
    if (cta) {
      cta.addEventListener('click', function () { capture('share_cta_click', { href: SIGNUP_URL }); });
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
    var r = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, credentials: 'omit' });
    var j = {};
    try { j = await r.json(); } catch (_) { j = {}; }
    if (r.status === 404) return { error: 'api_pending', raw: j };
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
    var useMock = qs('mock') === '1';

    if (!token && !useMock) {
      renderError(mount, 'missing_token');
      return;
    }

    if (useMock) {
      var mockJob = Object.assign({}, MOCK_JOB);
      var mockDoc = normalizeDocType(qs('doc'));
      if (mockDoc) mockJob.sharedDocumentType = mockDoc;
      if (qs('kicker')) mockJob.pageKicker = qs('kicker');
      renderJob(mount, mockJob, token || 'd8478fa34amock');
      var st = $('#agilo-share-status', mount);
      setStatus(st, 'info', 'Aperçu maquette (mock=1). Les vrais liens attendront getSharedJobView.');
      return;
    }

    try {
      var res = await fetchJob(token);
      if (res.job) {
        renderJob(mount, res.job, token);
        return;
      }
      renderError(mount, res.error || 'network');
    } catch (_) {
      renderError(mount, 'network');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
