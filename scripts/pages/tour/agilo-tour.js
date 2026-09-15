/* agilo-tour.js v2.0.0
 * Driver.js 1.3 onboarding (agilo_tour_state_v24).
 * Premier passage : 8 étapes + stop C’est bon / Continuer.
 * Copy : 4 seaux (default, public, dirigeant, equipe) depuis le DOM Memberstack.
 * Archive v23 : scripts/pages/tour/archive/agilo-tour-v23-1.0.0.js (SHA 7d5a786b).
 */
(function () {
  'use strict';

  if (window.__AGILO_TOUR_BOOTED__) return;
  window.__AGILO_TOUR_BOOTED__ = true;
  window.__AGILO_TOUR_VERSION__ = '2.0.0';

  /* ========== CONFIG ========== */
  var STORAGE_KEY     = 'agilo_tour_state_v24';
  var FIRST_RUN_KEY   = 'agilo_tour_first_seen_v24';
  var COMPLETED_KEY   = 'agilo_tour_completed_v24';

  var LAUNCH_GUARD = { starting:false, driven:false, route:null };
  function guardStart(route){
    if (LAUNCH_GUARD.starting && LAUNCH_GUARD.route === route) { log('start ignoré: starting in progress on', route); return true; }
    if (LAUNCH_GUARD.driven   && LAUNCH_GUARD.route === route) { log('start ignoré: already driven on', route); return true; }
    return false;
  }
  function releaseGuard(reason){
    LAUNCH_GUARD.starting = false;
    LAUNCH_GUARD.driven   = false;
    LAUNCH_GUARD.route    = null;
    log('guard reset', reason ? '('+reason+')' : '');
  }

  var DEBUG           = true;
  var POLL_MS         = 100;
  var WAIT_MAX_MS     = 1500;
  var ANON_WAIT_MS    = 8000;
  var KEY_SELECTORS   = {
    anonymize: '[data-tour="anonymize"], #agfDropzone, .agf-dropzone',
    'anon-historique': '[data-tour="anon-historique"], #agfAnonJobsWrap, .agf-anon-jobs-list',
    file: '[data-tour="file"], [data-tour="send-mode"], #panel-file, .source-tabs, [data-tab="file"]',
    'prompt-picker': '[data-tour="prompt-picker"], #agilo-prompt-picker-anchor, .agilo-prompt-picker',
    'wb-picker': '[data-tour="wb-picker"], #agilo-wb-picker-anchor, .agilo-wb-picker',
    submit: '[data-tour="submit"], #submit-button',
    'share-job': '[data-tour="share-job"], .agilo-row-share, #shareLink',
    'download-transcript': '[data-tour="download-transcript"], #exportBtn, [data-format="docx"]',
    audio: '[data-tour="audio"], #audioPlayer, audio, .ed-audio'
  };
  var RESUME_GRACE_MS = 30000;
  var RETRY_TOTAL_MS  = 20000;
  var FIRST_STOP_INDEX = 7;

  var ROUTES = ['/dashboard','/mes-transcripts','/profile','/dashboard/anonymiser','/support','/editor'];
  var SYN = {
    '/mes-transcripts-business': '/mes-transcripts',
    '/mon-compte': '/profile',
    '/anonymiser': '/dashboard/anonymiser',
    '/editor': '/editor'
  };

  /* ========== UI ========== */
  var CENTER_PAD_REM  = 16.25;
  var STAGE_PAD_REM   = 0.5;
  function remPx(n){ var f = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16; return Math.round(n * f); }

  (function injectCSS(){
    var id='agilo-tour-css';
    if (document.getElementById(id)) return;
    var s=document.createElement('style');
    s.id=id;
    s.textContent = `
      .driver-popover{max-width:28rem;font-size:.95rem}
      .driver-popover-title{font-size:1.05rem;font-weight:600}
      .driver-popover-description{line-height:1.5}
      .driver-popover-footer button{font-size:.875rem;padding:.5rem .9rem}
      [data-agilo-tour-visibility="resume-only"]{transition:opacity .3s,visibility .3s}
      [data-agilo-tour-visibility="resume-only"][aria-hidden="true"]{display:none!important}
      [data-agilo-tour-visibility="resume-only"][aria-hidden="false"]{display:inline-flex!important}
    `;
    document.head.appendChild(s);
  })();

  /* ========== LOG/STORAGE ========== */
  function log(){ if (DEBUG) try{ console.log.apply(console, ['[AgiloTour]'].concat([].slice.call(arguments))); }catch(e){} }
  function saveState(s){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(s||{})); }catch(e){} }
  function loadState(){ try{ var r=localStorage.getItem(STORAGE_KEY); return r?JSON.parse(r):null; }catch(e){ return null; } }
  function clearState(){ try{ localStorage.removeItem(STORAGE_KEY);}catch(e){} }
  function hasSeenOnce(){ try{ return !!localStorage.getItem(FIRST_RUN_KEY);}catch(_){return false;} }
  function markSeenOnce(){ try{ localStorage.setItem(FIRST_RUN_KEY,'1'); }catch(_){} }
  function isCompleted(){ try{ return localStorage.getItem(COMPLETED_KEY)==='1'; }catch(_){ return false; } }
  function markCompleted(){ try{ localStorage.setItem(COMPLETED_KEY,'1'); }catch(_){ } }
  function clearCompleted(){ try{ localStorage.removeItem(COMPLETED_KEY); }catch(_){ } }
  function queryHasStart(){ return /[?&]tour=(start|1|true)\b/i.test(location.search); }

  /* ========== ROUTING ========== */
  var PREFIX_RE = /^\/(?:app(?:\/(?:free|premium|business))?)\b/;
  function stripDomain(p){ return (p||'/').replace(/^https?:\/\/[^/]+/,''); }
  function normalizePath(p){
    p = stripDomain((p||'/')).split('#')[0].split('?')[0];
    p = p.replace(PREFIX_RE,'').replace(/\/+$/,'') || '/';
    return SYN[p] || p;
  }
  function currentRoute(){ var r = normalizePath(location.pathname); return ROUTES.indexOf(r)>=0 ? r : '/dashboard'; }
  function currentPrefix(){ var m = stripDomain(location.pathname).match(/^\/app(?:\/(?:free|premium|business))?/); return m?m[0]:''; }
  function normalizeNavTarget(nav){
    if (!nav && nav!==0) return null;
    nav = (''+nav).trim();
    if (nav[0] !== '/') nav = '/'+nav;
    nav = SYN[nav] || nav;
    if (nav === '/') nav = '/dashboard';
    return nav;
  }
  function isAtRoute(route){ return normalizePath(location.pathname) === normalizePath(route); }
  function buildUrlForRoute(targetRoute){
    targetRoute = normalizeNavTarget(targetRoute) || '/dashboard';
    return (currentPrefix() + targetRoute).replace(/\/{2,}/g,'/');
  }

  /* ========== Driver.js loader ========== */
  function getV13Factory(){
    if (typeof window.driver === 'function') return function(opts){ return window.driver(opts); };
    if (window.driver && window.driver.js && typeof window.driver.js.driver === 'function')
      return function(opts){ return window.driver.js.driver(opts); };
    return null;
  }
  function ensureDriverV13(cb){
    var f=getV13Factory(); if (f) return cb(f);
    var tried=0, cdns=[
      'https://cdn.jsdelivr.net/npm/driver.js@1.3.1/dist/driver.js.iife.min.js',
      'https://unpkg.com/driver.js@1.3.1/dist/driver.js.iife.min.js'
    ];
    (function next(){
      var fac=getV13Factory(); if (fac) return cb(fac);
      if (tried>=cdns.length){ console.error('[AgiloTour] Driver.js 1.3 introuvable'); return; }
      var src=cdns[tried++], id='agilo-driver13-'+tried;
      if (document.getElementById(id)) return next();
      var s=document.createElement('script'); s.id=id; s.src=src; s.async=false;
      s.onload=function(){ setTimeout(function(){ var fac=getV13Factory(); if (fac) cb(fac); else next(); },0); };
      s.onerror=next;
      document.head.appendChild(s);
    })();
  }
  function preloadDriver(){
    if (window.__driver_preloaded) return;
    window.__driver_preloaded = true;
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/driver.js@1.3.1/dist/driver.js.iife.min.js';
    s.async=true;
    document.head.appendChild(s);
  }

  /* ========== DOM utils ========== */
  function waitFor(sel, maxMs){
    var t0=Date.now(), el=document.querySelector(sel); if (el) return Promise.resolve(el);
    return new Promise(function(res){ (function loop(){
      var el=document.querySelector(sel);
      if (el) return res(el);
      if (Date.now()-t0 >= (+maxMs||WAIT_MAX_MS)) return res(null);
      setTimeout(loop, POLL_MS);
    })();});
  }
  function ensureCenterAnchor(){
    var id='agilo-tour-center-anchor', el=document.getElementById(id);
    if(!el){
      el=document.createElement('div');
      el.id=id; el.setAttribute('aria-hidden','true');
      el.style.cssText='position:fixed;left:50%;top:50%;transform:translate(-50%, -50%);width:1px;height:1px;pointer-events:none;z-index:2147483647;';
      document.body.appendChild(el);
    }
    return el;
  }
  function hasOpenableJob(){
    return !!(document.querySelector('.wrapper-content_item-row[data-job-id], [data-job-id], a[href*="/editor"]'));
  }
  function stampStableHooks(){
    var pairs = [
      ['prompt-picker', '#agilo-prompt-picker-anchor, .agilo-prompt-picker'],
      ['wb-picker', '#agilo-wb-picker-anchor, .agilo-wb-picker'],
      ['share-job', '.agilo-row-share, #shareLink'],
      ['download-transcript', '#exportBtn, [data-tour="download-transcript"]'],
      ['file', '#panel-file, .source-tabs']
    ];
    pairs.forEach(function(pair){
      var el = document.querySelector(pair[1]);
      if (el && !el.getAttribute('data-tour')) el.setAttribute('data-tour', pair[0]);
    });
  }

  /* ========== Memberstack (DOM + client, pas Admin) ========== */
  var MEMBER_CTX = { firstName:'', persona:'', useCase:'', meetingTool:'', bucket:'default' };

  function nonempty(v){
    v = String(v==null?'':v).trim();
    if (!v || /^skipped$/i.test(v)) return '';
    return v;
  }
  function readMsNode(id, attr){
    var el = document.getElementById(id) || document.querySelector('[data-ms-member="'+attr+'"]');
    if (!el) return '';
    return nonempty(el.textContent || el.value || el.getAttribute('value'));
  }
  function ensureMeetingToolNode(){
    if (document.querySelector('[data-ms-member="meeting-tool"]')) return;
    var el = document.createElement('div');
    el.id = 'ms-meeting-tool';
    el.className = 'ms-meeting-tool';
    el.setAttribute('data-ms-member', 'meeting-tool');
    el.setAttribute('hidden', '');
    el.style.display = 'none';
    var persona = document.getElementById('ms-persona');
    var host = document.querySelector('.wrapper-id-profil');
    if (persona && persona.parentNode) persona.parentNode.insertBefore(el, persona.nextSibling);
    else if (host) host.appendChild(el);
    else document.body.appendChild(el);
  }
  function readDomMember(){
    return {
      firstName: readMsNode('ms-first-name', 'first-name'),
      persona: readMsNode('ms-persona', 'persona'),
      useCase: readMsNode('ms-use_case', 'use-case') || readMsNode('ms-use-case', 'use-case'),
      meetingTool: readMsNode('ms-meeting-tool', 'meeting-tool')
    };
  }
  function norm(s){
    return String(s||'').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[’']/g,' ')
      .replace(/[^a-z0-9]+/g,' ')
      .trim();
  }
  function resolveBucket(ctx){
    var p = norm(ctx && ctx.persona);
    var u = norm(ctx && ctx.useCase);
    var blob = (p+' '+u).trim();
    if (!blob || blob==='autre' || blob==='skipped') return 'default';
    if (/juridique|cse|collectivit|elu|institution|conseil municipal|mairie|prefect|cssct|ssct/.test(blob)) return 'public';
    if (/dirigeant|fondateur/.test(p)) return 'dirigeant';
    if (/manager|responsable d equipe|salarie|employe|reunions d equipe|equipe projets/.test(blob)) return 'equipe';
    return 'default';
  }
  function toolPhrase(tool){
    var t = norm(tool);
    if (/zoom/.test(t)) return 'Zoom';
    if (/meet|google/.test(t)) return 'Google Meet';
    if (/teams|microsoft/.test(t)) return 'Microsoft Teams';
    if (/telephone/.test(t)) return 'téléphone';
    return 'visio';
  }
  function greet(ctx){
    var n = nonempty(ctx && ctx.firstName);
    return n ? ('Bienvenue '+n+'. ') : '';
  }
  function recordLine(ctx, extra){
    var tool = toolPhrase(ctx && ctx.meetingTool);
    var visio = (tool === 'visio' || tool === 'téléphone')
      ? (tool === 'téléphone' ? 'au téléphone' : 'en visio')
      : ('sur '+tool);
    return 'Enregistrez une réunion physique (micro) ou '+visio+'. '+(extra||'')+'L’audio est aussi enregistré dans Téléchargements.';
  }

  var COPY = {
    default: {
      welcome: { title:'Bienvenue sur Agilotext', desc:function(c){ return greet(c)+'Agilotext transforme vos réunions en comptes rendus exploitables. Traitement en France et dans l’UE. Cliquez sur Suivant pour envoyer un premier fichier.'; } },
      record: { title:'Enregistrer une réunion', desc:function(c){ return recordLine(c,''); } },
      file: { title:'Déposer un fichier', desc:'Déposez un fichier audio ou vidéo. YouTube et la dictée sont dans les onglets à côté, si vous en avez besoin.' },
      options: { title:'Format du livrable', desc:'Choisissez transcription intégrale ou compte rendu, et l’option intervenants.' },
      'prompt-picker': { title:'Choisir un modèle', desc:'Choisissez le modèle avant l’envoi. C’est lui qui structure le livrable.' },
      'wb-picker': { title:'Lexique', desc:'Le lexique corrige noms et sigles. Sur l’offre Free, le choix peut être verrouillé.' },
      submit: { title:'Envoyer le fichier', desc:'Envoyez le fichier. Le résultat arrive par e-mail et dans Mes fichiers.' },
      stop: { title:'C’est bon ?', desc:'Vous pouvez envoyer un premier fichier. Continuer montre Mes fichiers et l’éditeur. C’est bon clôt le guide.' },
      'transcripts-table': { title:'Mes fichiers', desc:'Ouvrez un fichier pour relire, exporter ou partager.' },
      transcriptsEmpty: { title:'Mes fichiers', desc:'Après votre premier envoi, vos fichiers apparaissent ici.' },
      'share-job': { title:'Partager un lien', desc:'Partagez un lien de lecture, sans envoyer le fichier en pièce jointe.' },
      'editor-open': { title:'Ouvrir l’éditeur', desc:'Ouvrez le document dans l’éditeur pour relire et exporter.' },
      'ed-tabs': { title:'Trois onglets', desc:'Transcription, compte rendu, conversation : trois onglets sur le même fichier.' },
      audio: { title:'Réécouter', desc:'Réécoutez un passage. Un clic sur un timecode cale la lecture.' },
      'download-transcript': { title:'Exporter en Word', desc:'Exportez en Word pour le dossier ou l’envoi interne.' },
      save: { title:'Enregistrer', desc:'Enregistrez vos corrections. La version reste dans Mes fichiers.' },
      'nav-library': { title:'Bibliothèque', desc:'La bibliothèque range vos modèles et lexiques, pour les réutiliser.' },
      anonymize: { title:'Données personnelles', desc:'Pour un document déjà écrit, Agiloshield masque les données personnelles avant partage.' },
      'nav-support': { title:'Support', desc:'Le support est ici si un envoi bloque. Merci d’avoir suivi le guide.' }
    },
    public: {
      welcome: { title:'Bienvenue sur Agilotext', desc:function(c){ return greet(c)+'Agilotext prépare vos PV et comptes rendus pour le dossier (élus, sigles, Word). Traitement en France et dans l’UE. Cliquez sur Suivant pour envoyer un premier audio.'; } },
      record: { title:'Enregistrer la séance', desc:function(c){ return recordLine(c,'Utile pour un PV. '); } },
      file: { title:'Déposer l’audio de séance', desc:'Déposez l’audio de séance. YouTube et la dictée sont dans les onglets à côté, si vous en avez besoin.' },
      options: { title:'PV ou transcription', desc:'Choisissez transcription ou PV / compte rendu, et l’option intervenants.' },
      'prompt-picker': { title:'Modèle de PV', desc:'Choisissez le modèle de PV avant l’envoi, pour un dossier Word exploitable.' },
      'wb-picker': { title:'Lexique (élus, sigles)', desc:'Le lexique corrige noms d’élus et sigles. Sur l’offre Free, le choix peut être verrouillé.' },
      submit: { title:'Envoyer pour le dossier', desc:'Envoyez le fichier. Le PV arrive par e-mail et dans Mes fichiers, prêt pour Word.' },
      stop: { title:'C’est bon ?', desc:'Vous pouvez envoyer un premier audio de séance. Continuer montre Mes fichiers (partage, Word). C’est bon clôt le guide.' },
      'transcripts-table': { title:'Mes fichiers', desc:'Retrouvez le PV, ouvrez-le, exportez-le en Word ou partagez-le.' },
      'download-transcript': { title:'Word pour le dossier', desc:'Exportez en Word pour le dossier de séance.' }
    },
    dirigeant: {
      welcome: { title:'Bienvenue sur Agilotext', desc:function(c){ return greet(c)+'Agilotext transforme vos réunions en décisions et actions à partager. Traitement en France et dans l’UE. Cliquez sur Suivant pour envoyer un premier fichier.'; } },
      record: { title:'Enregistrer une réunion', desc:function(c){ return recordLine(c,'Pour ressortir décisions et actions. '); } },
      file: { title:'Déposer un fichier', desc:'Déposez l’audio de la réunion. YouTube et la dictée sont dans les onglets à côté, si vous en avez besoin.' },
      options: { title:'Format du compte rendu', desc:'Choisissez transcription ou compte rendu (décisions, actions), et l’option intervenants.' },
      'prompt-picker': { title:'Choisir un modèle', desc:'Choisissez le modèle avant l’envoi, pour un compte rendu prêt à partager au COMEX.' },
      'wb-picker': { title:'Lexique', desc:'Le lexique corrige noms propres et acronymes métier. Sur l’offre Free, le choix peut être verrouillé.' },
      submit: { title:'Envoyer le fichier', desc:'Envoyez le fichier. Le compte rendu arrive par e-mail et dans Mes fichiers, prêt à partager.' },
      stop: { title:'C’est bon ?', desc:'Vous pouvez envoyer un premier fichier. Continuer montre Mes fichiers et l’export. C’est bon clôt le guide.' },
      'transcripts-table': { title:'Mes fichiers', desc:'Ouvrez le compte rendu, partagez-le ou exportez-le pour le COMEX.' },
      'download-transcript': { title:'Exporter en Word', desc:'Exportez en Word pour le partage au COMEX.' }
    },
    equipe: {
      welcome: { title:'Bienvenue sur Agilotext', desc:function(c){ return greet(c)+'Agilotext transforme vos réunions d’équipe en comptes rendus clairs, avec le qui fait quoi. Traitement en France et dans l’UE. Cliquez sur Suivant pour envoyer un premier fichier.'; } },
      record: { title:'Enregistrer la réunion', desc:function(c){ return recordLine(c,'Pour un compte rendu d’équipe. '); } },
      file: { title:'Déposer un fichier', desc:'Déposez l’audio de la réunion d’équipe. YouTube et la dictée sont dans les onglets à côté, si vous en avez besoin.' },
      options: { title:'Format du compte rendu', desc:'Choisissez transcription ou compte rendu, et l’option intervenants pour le qui parle.' },
      'prompt-picker': { title:'Choisir un modèle', desc:'Choisissez le modèle avant l’envoi, pour un compte rendu d’équipe lisible.' },
      'wb-picker': { title:'Lexique', desc:'Le lexique corrige noms d’équipe et sigles internes. Sur l’offre Free, le choix peut être verrouillé.' },
      submit: { title:'Envoyer le fichier', desc:'Envoyez le fichier. Le compte rendu arrive par e-mail et dans Mes fichiers.' },
      stop: { title:'C’est bon ?', desc:'Vous pouvez envoyer un premier fichier. Continuer montre Mes fichiers et l’éditeur. C’est bon clôt le guide.' },
      'transcripts-table': { title:'Mes fichiers', desc:'Ouvrez le compte rendu d’équipe pour relire, partager ou exporter.' }
    }
  };

  function copyFor(key){
    var bucket = (MEMBER_CTX && MEMBER_CTX.bucket) || 'default';
    var pack = COPY[bucket] || COPY.default;
    var row = pack[key] || COPY.default[key];
    if (!row) return { title:key, desc:'' };
    var desc = (typeof row.desc === 'function') ? row.desc(MEMBER_CTX) : row.desc;
    return { title: row.title || COPY.default[key].title, desc: desc };
  }

  /* ========== Bouton Reprendre ========== */
  function refreshResumeUI(){
    var st = loadState();
    var idx = (st && typeof st.stepGlobalIndex === 'number') ? st.stepGlobalIndex : 0;
    var showResume = !!(idx > 0 && !isCompleted());
    document.querySelectorAll('[data-agilo-tour="start"][data-agilo-tour-visibility="resume-only"]').forEach(function(el){
      if (showResume) { el.setAttribute('aria-hidden','false'); el.style.display='inline-flex'; el.hidden=false; el.removeAttribute('hidden'); }
      else { el.setAttribute('aria-hidden','true'); el.style.display='none'; el.hidden=true; }
    });
    var mainLabel = document.querySelector('[data-agilo-tour="start-reset"] div:last-child');
    if (mainLabel && !mainLabel.querySelector('svg')) mainLabel.textContent = showResume ? 'Recommencer le guide' : 'Démarrer le guide';
  }

  /* ========== BLUEPRINT ========== */
  var BLUEPRINT = [];
  var GLOBAL_TOTAL = 0;

  function makeBlueprint(){
    var b=[];
    function add(route, key, copyKey, side, align, navigateTo, extra){
      extra = extra || {};
      var c = copyFor(copyKey);
      b.push({
        route:route,
        key:key||null,
        copyKey:copyKey,
        title:c.title,
        desc:c.desc,
        side:side||'top',
        align:align||'center',
        navigateTo: navigateTo || null,
        fallbackCenter: !!extra.fallbackCenter,
        stop: !!extra.stop,
        skipIfNoJob: !!extra.skipIfNoJob
      });
    }

    add('/dashboard','dashboard-overview','welcome','center','center');
    add('/dashboard','record','record','bottom','center');
    add('/dashboard','file','file','top','center');
    add('/dashboard','options','options','left','center');
    add('/dashboard','prompt-picker','prompt-picker','left','center');
    add('/dashboard','wb-picker','wb-picker','left','center');
    add('/dashboard','submit','submit','top','center');
    add('/dashboard','nav-transcripts','stop','right','center','/mes-transcripts', { stop:true });

    add('/mes-transcripts','transcripts-table','transcripts-table','top','center');
    add('/mes-transcripts','share-job','share-job','top','center', null, { skipIfNoJob:true });
    add('/mes-transcripts','editor-open','editor-open','center','center','/editor', { skipIfNoJob:true });

    add('/editor','ed-tabs','ed-tabs','bottom','center');
    add('/editor','audio','audio','top','center');
    add('/editor','download-transcript','download-transcript','bottom','center');
    add('/editor','save','save','bottom','center','/dashboard');

    add('/dashboard','nav-library','nav-library','right','center');
    add('/dashboard/anonymiser','anonymize','anonymize','top','center','/dashboard');
    add('/dashboard','nav-support','nav-support','right','center');

    for (var i=0;i<b.length;i++) b[i]._gIndex=i;
    return b;
  }

  function rebuildBlueprint(){
    BLUEPRINT = makeBlueprint();
    GLOBAL_TOTAL = BLUEPRINT.length;
  }
  rebuildBlueprint();

  function mapAbsoluteIndex(gIndex){ var s=BLUEPRINT[gIndex]; return s?{route:s.route, gIndex:gIndex}:null; }

  function applyMember(ctx){
    MEMBER_CTX = {
      firstName: nonempty(ctx && ctx.firstName),
      persona: nonempty(ctx && ctx.persona),
      useCase: nonempty(ctx && ctx.useCase),
      meetingTool: nonempty(ctx && ctx.meetingTool),
      bucket: 'default'
    };
    MEMBER_CTX.bucket = resolveBucket(MEMBER_CTX);
    rebuildBlueprint();
    log('seau', MEMBER_CTX.bucket, 'persona=', MEMBER_CTX.persona, 'use-case=', MEMBER_CTX.useCase, 'tool=', MEMBER_CTX.meetingTool);
  }

  function withMemberContext(cb){
    ensureMeetingToolNode();
    stampStableHooks();
    var ctx = readDomMember();
    var ms = window.$memberstackDom;
    if (!ms || typeof ms.getCurrentMember !== 'function') { applyMember(ctx); return cb(MEMBER_CTX); }
    var settled = false;
    function done(next){
      if (settled) return;
      settled = true;
      applyMember(next || ctx);
      cb(MEMBER_CTX);
    }
    var timer = setTimeout(function(){ done(ctx); }, 1200);
    try {
      ms.getCurrentMember().then(function(res){
        clearTimeout(timer);
        var m = (res && res.data) || res || {};
        var cf = m.customFields || {};
        var auth = m.auth || {};
        done({
          firstName: nonempty(ctx.firstName) || nonempty(auth.firstName) || nonempty(cf['first-name']),
          persona: nonempty(ctx.persona) || nonempty(cf.persona),
          useCase: nonempty(ctx.useCase) || nonempty(cf['use-case']) || nonempty(cf.use_case),
          meetingTool: nonempty(ctx.meetingTool) || nonempty(cf['meeting-tool']) || nonempty(cf.meeting_tool)
        });
      }).catch(function(){ clearTimeout(timer); done(ctx); });
    } catch (_) {
      clearTimeout(timer);
      done(ctx);
    }
  }

  function stepTitle(s){
    var total = (s._gIndex <= FIRST_STOP_INDEX) ? (FIRST_STOP_INDEX+1) : GLOBAL_TOTAL;
    return 'Étape '+(s._gIndex+1)+'/'+total+' · '+s.title;
  }

  /* ========== BUILD STEPS ========== */
  function buildStepsForRoute(route, absoluteIndex){
    stampStableHooks();
    var defs = BLUEPRINT.filter(function(s){ return s.route===route; });
    var promises = defs.map(function(s){
      var desc = s.desc;
      if (s.key==='transcripts-table' && !hasOpenableJob()) {
        desc = copyFor('transcriptsEmpty').desc;
      }
      var step = {
        element:null,
        popover:{ title:stepTitle(s), description:desc, side:s.side, align:s.align },
        __gIndex:s._gIndex, __nav:s.navigateTo||null, __center:!!s.fallbackCenter, __stop:!!s.stop,
        padding: s.fallbackCenter ? remPx(CENTER_PAD_REM) : undefined
      };
      if (s.key==='nav-library') {
        var canAnon = !/\/app\/free\b/.test(location.pathname) && !!document.querySelector('[data-tour="nav-anonymize"]');
        step.__nav = canAnon ? '/dashboard/anonymiser' : null;
      }
      if (s.skipIfNoJob && !hasOpenableJob()) {
        step.__skip=true;
        return Promise.resolve(step);
      }
      if (s.key){
        var sel = (KEY_SELECTORS[s.key] || ('[data-tour="'+s.key+'"]'));
        var waitMs = (s.key==='anonymize' || s.key==='anon-historique') ? ANON_WAIT_MS : WAIT_MAX_MS;
        return waitFor(sel, waitMs).then(function(el){
          if (!el){
            if (s.fallbackCenter || s.navigateTo){ step.element=ensureCenterAnchor(); step.__center=true; }
            else { step.__skip=true; }
          } else {
            step.element=el;
            if (!el.getAttribute('data-tour') && s.key) el.setAttribute('data-tour', s.key);
          }
          return step;
        });
      } else if (s.fallbackCenter){
        step.element=ensureCenterAnchor(); step.__center=true; return Promise.resolve(step);
      } else {
        step.__skip=true; return Promise.resolve(step);
      }
    });
    return Promise.all(promises).then(function(arr){
      var steps = arr.filter(function(x){return !x.__skip;});
      var startLocal=0;
      if (typeof absoluteIndex==='number'){
        for (var i=0;i<steps.length;i++){ if (steps[i].__gIndex>=absoluteIndex){ startLocal=i; break; } }
      }
      return {steps:steps, startLocal:startLocal};
    });
  }

  /* ========== DRIVER ========== */
  var STEP_TAB = {};
  var driverInstance=null;
  var stopChoice=null;
  function destroyDriver(){ if(!driverInstance) return; try{ driverInstance.destroy && driverInstance.destroy(); }catch(_){ } driverInstance=null; }

  function computeResumeIndexAfterNav(idx){
    var r = BLUEPRINT[idx] ? BLUEPRINT[idx].route : null;
    while (idx < BLUEPRINT.length){
      var s=BLUEPRINT[idx];
      if (!s || s.route!==r) break;
      if (s.fallbackCenter===true){ idx++; continue; }
      return idx;
    }
    return idx;
  }

  function firstIndexForRoute(route){
    for (var i=0;i<GLOBAL_TOTAL;i++){ if (BLUEPRINT[i].route===route && !BLUEPRINT[i].fallbackCenter) return i; }
    for (var j=0;j<GLOBAL_TOTAL;j++){ if (BLUEPRINT[j].route===route) return j; }
    return -1;
  }

  function patchStopFooter(){
    var footer = document.querySelector('.driver-popover-footer');
    if (!footer) return;
    var next = footer.querySelector('.driver-popover-next-btn');
    var done = footer.querySelector('.driver-popover-done-btn');
    if (next) next.textContent = 'Continuer';
    if (!done) {
      done = document.createElement('button');
      done.type = 'button';
      done.className = 'driver-popover-btn driver-popover-done-btn';
      footer.appendChild(done);
    }
    done.textContent = 'C’est bon';
    done.style.display = 'inline-block';
    done.setAttribute('data-agilo-tour-stop', 'done');
    done.onclick = function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      stopChoice = 'done';
      markCompleted();
      var o = loadState()||{};
      o.pending=false; o.resume=false; o.timestamp=Date.now();
      saveState(o);
      refreshResumeUI();
      destroyDriver();
    };
  }

  function startOnThisPageOrRetry(here, absoluteIndex){
    var startTs = Date.now();
    var observer = null;
    var launched = false;

    function cleanup(){ if(observer){ try{observer.disconnect();}catch(_){ } observer=null; } }

    function jumpToNextRoute(){
      var nextIdx = (typeof absoluteIndex==='number') ? absoluteIndex : 0;
      while (nextIdx < BLUEPRINT.length && BLUEPRINT[nextIdx].route === here) nextIdx++;
      if (nextIdx < BLUEPRINT.length){
        var tgt = BLUEPRINT[nextIdx].route;
        saveState({ route: tgt, stepGlobalIndex: nextIdx, resume:true, pending:true, timestamp:Date.now() });
        refreshResumeUI();
        location.assign(buildUrlForRoute(tgt));
        return true;
      }
      return false;
    }

    function tryStart(){
      if (launched) return;
      if (LAUNCH_GUARD.driven && LAUNCH_GUARD.route === here) return;

      buildStepsForRoute(here, absoluteIndex).then(function(result){
        var pageSteps=result.steps, startLocal=result.startLocal;

        if (!pageSteps.length){
          var st = loadState()||{};
          st.pending = true; st.resume = true; st.route = here; st.timestamp = Date.now();
          saveState(st); refreshResumeUI();
          if (Date.now() - startTs >= RETRY_TOTAL_MS){
            if (!jumpToNextRoute()) markCompleted();
            return;
          }
          return;
        }

        var st2 = loadState();
        var pending = st2 && st2.pending===true;
        var hasActionable = pageSteps.some(function(s){ return !s.__center; });
        if (pending && !hasActionable){ return; }

        if (st2 && st2.pending===true && pageSteps[startLocal] && pageSteps[startLocal].__center && pageSteps[startLocal+1]){
          startLocal += 1;
        }

        if (guardStart(here)) return;
        LAUNCH_GUARD.starting = true;
        LAUNCH_GUARD.route = here;

        cleanup();
        launched = true;
        bootDriver(
          pageSteps.map(function(s){return {element:s.element,popover:s.popover,padding:s.padding};}),
          startLocal, here, result
        );
      }).catch(function(){});
    }

    observer = new MutationObserver(function(){ tryStart(); });
    try{ observer.observe(document.body, {childList:true, subtree:true}); }catch(_){}

    window.addEventListener('load', tryStart, {once:true});

    var poll = setInterval(function(){
      if (launched) { clearInterval(poll); cleanup(); return; }
      tryStart();
      if (Date.now()-startTs >= RETRY_TOTAL_MS){ clearInterval(poll); cleanup(); }
    }, Math.max(POLL_MS,150));

    tryStart();
  }

 function bootDriver(driverSteps, startLocal, here, buildResult){
  var meta = (buildResult ? buildResult.steps : []).map(function(s){ return {g:s.__gIndex, nav:s.__nav, stop:!!s.__stop}; });
  if (!meta || !meta.length) meta = [{g:(loadState()&&loadState().stepGlobalIndex)||0, nav:null, stop:false}];

  var localIdx = startLocal;
  stopChoice = null;

  function navigateForNavStep(origin){
    var m = meta[localIdx] || {};
    if (!m.nav) return false;
    if (origin === 'done' && m.stop) return false;

    var nextGlobal = computeResumeIndexAfterNav((meta[localIdx]?meta[localIdx].g:0)+1);

    var hasExplicit = typeof m.nav === 'string' && m.nav.trim().length > 0;
    var targetRoute = hasExplicit ? normalizePath(m.nav) :
                       (BLUEPRINT[nextGlobal] ? BLUEPRINT[nextGlobal].route : '/dashboard');
    var targetUrl   = hasExplicit ? buildUrlForRoute(m.nav) : buildUrlForRoute(targetRoute);

    saveState({ route: targetRoute, stepGlobalIndex: nextGlobal, resume:true, pending:true, timestamp:Date.now() });
    refreshResumeUI();

    log('NAV ('+(origin||'step')+') →', targetUrl);

    if (typeof releaseGuard === 'function') releaseGuard('navigating');
    location.assign(targetUrl);
    return true;
  }

  function goNextMaybeNavigate(){
    if (navigateForNavStep('step')) return true;
    var nextGlobalIdx = Math.min((meta[localIdx]?meta[localIdx].g:0)+1, GLOBAL_TOTAL-1);
    saveState({ route: here, stepGlobalIndex: nextGlobalIdx, resume:true, pending:false, timestamp:Date.now() });
    refreshResumeUI();
    localIdx = Math.min(localIdx+1, meta.length-1);
    return false;
  }

  destroyDriver();
  ensureDriverV13(function(factoryReal){
    var drv = factoryReal({
      showProgress:true, animate:true,
      stagePadding: remPx(STAGE_PAD_REM),
      allowClose:true, nextBtnText:'Suivant', prevBtnText:'Précédent', doneBtnText:'Terminer',
      overlayClickBehavior:'none', smoothScroll:false,
      onHighlightStarted:function(ctx){
        try{
          ctx && ctx.element && ctx.element.scrollIntoView({behavior:'auto', block:'center'});
        }catch(_){}

        try{
          var m   = meta[localIdx] || {};
          var g   = (typeof m.g === 'number') ? m.g : null;
          var def = (g != null) ? BLUEPRINT[g] : null;
          var key = def ? def.key : null;
          var tab = key ? STEP_TAB[key] : null;

          if (tab && typeof window.ensureTab === 'function'){
            window.ensureTab(tab);
            setTimeout(function(){
              try { ctx && ctx.refresh && ctx.refresh(); } catch(_){}
              try { drv && drv.refresh && drv.refresh(); } catch(_){}
            }, 0);
          }
          if (m.stop) setTimeout(patchStopFooter, 0);
        }catch(_){}
      },

      onNextClick:function(){ if(!goNextMaybeNavigate()) try{ drv.moveNext(); }catch(_){ } },
      onPrevClick:function(){
        localIdx = Math.max(localIdx-1, 0);
        var prevGlobalIdx = meta[localIdx]?meta[localIdx].g:0;
        saveState({ route: here, stepGlobalIndex: prevGlobalIdx, resume:true, pending:false, timestamp:Date.now() });
        refreshResumeUI();
        try{ drv.movePrevious(); }catch(_){ }
      },
      onDestroyed:function(){
        if (stopChoice === 'done') {
          if (typeof releaseGuard === 'function') releaseGuard('stop cest bon');
          refreshResumeUI();
          return;
        }
        if (navigateForNavStep('done')) return;

        var curGlobal = meta[localIdx]?meta[localIdx].g:0;
        var isLast = (curGlobal >= (GLOBAL_TOTAL-1));
        if (isLast) markCompleted();

        var o = loadState()||{};
        o.pending=false; o.stepGlobalIndex=curGlobal; o.route=here; o.resume=true; o.timestamp=Date.now();
        saveState(o);
        refreshResumeUI();

        if (typeof releaseGuard === 'function') releaseGuard('driver destroyed');
      }
    });

    try{
      var s2 = loadState()||{}; s2.pending=false; saveState(s2);
      refreshResumeUI();
      drv.setSteps(driverSteps);
      drv.drive(startLocal);
      driverInstance = drv;
      LAUNCH_GUARD.driven = true;
      LAUNCH_GUARD.route  = here;
      log('tour démarré sur', here, 'steps=', driverSteps.length, 'startLocal=', startLocal, 'seau=', MEMBER_CTX.bucket);
    }catch(err){
      console.error('[AgiloTour] Erreur Driver:', err);
      if (typeof releaseGuard === 'function') releaseGuard('driver boot failed');
      destroyDriver();
    }
  });
 }

  function startAt(absoluteIndex){
    var target = (typeof absoluteIndex==='number') ? mapAbsoluteIndex(absoluteIndex) : null;
    var here = currentRoute();

    if (guardStart(here)) return;

    if (target && target.route !== here){
      var nextIdx = computeResumeIndexAfterNav(target.gIndex);
      var targetRoute = BLUEPRINT[nextIdx] ? BLUEPRINT[nextIdx].route : here;
      saveState({ route: targetRoute, stepGlobalIndex: nextIdx, resume:true, pending:true, timestamp:Date.now() });
      refreshResumeUI();
      var url = buildUrlForRoute(targetRoute);
      log('NAV →', url);
      location.assign(url);
      return;
    }

    startOnThisPageOrRetry(here, absoluteIndex);
  }

  /* ========== EVENTS (boutons) ========== */
  function attachTriggers(){
    document.addEventListener('click', function(e){
      var t=e.target; if(!t || !t.closest) return;

      var resumeBtn = t.closest('[data-agilo-tour="start"][data-agilo-tour-visibility="resume-only"]');
      if (resumeBtn){
        e.preventDefault(); e.stopPropagation();
        releaseGuard('user click resume');
        window.AgiloTour.start('resume');
        return;
      }

      var resetBtn = t.closest('[data-agilo-tour="start-reset"]');
      if (resetBtn){
        e.preventDefault(); e.stopPropagation();
        releaseGuard('user click reset');
        clearCompleted();
        withMemberContext(function(){
          var firstDashIdx = (function(){ for (var i=0;i<BLUEPRINT.length;i++){ if (BLUEPRINT[i].route==='/dashboard' && !BLUEPRINT[i].fallbackCenter) return i; } return 0; })();
          var targetRoute = '/dashboard';
          saveState({ route: targetRoute, stepGlobalIndex: firstDashIdx, resume:true, pending:true, timestamp:Date.now() });
          refreshResumeUI();
          if (!isAtRoute(targetRoute)){
            var url = buildUrlForRoute(targetRoute);
            log('NAV (reset) →', url);
            location.assign(url);
            return;
          }
          ensureDriverV13(function(){ startAt(firstDashIdx); });
        });
        return;
      }

      var startBtn = t.closest('[data-agilo-tour="start"]:not([data-agilo-tour-visibility]), .js-agilo-tour-start');
      if (startBtn){
        e.preventDefault(); e.stopPropagation();
        releaseGuard('user click start');
        window.AgiloTour.start('resume');
        return;
      }
    }, true);
  }

  /* ========== PUBLIC API ========== */
  window.AgiloTour = {
    start: function(stepIndexOrResume){
      releaseGuard('API start');
      withMemberContext(function(){
        if (stepIndexOrResume==='resume' || stepIndexOrResume===true){
          var st = loadState(); var idx = (st && typeof st.stepGlobalIndex==='number') ? st.stepGlobalIndex : 0;
          var tgt = (BLUEPRINT[idx] ? BLUEPRINT[idx].route : '/dashboard');
          if (!isAtRoute(tgt)){
            saveState({ route: tgt, stepGlobalIndex: idx, resume:true, pending:true, timestamp:Date.now() });
            refreshResumeUI();
            var url = buildUrlForRoute(tgt);
            log('NAV (resume) →', url);
            location.assign(url);
            return;
          }
          saveState({ route: tgt, stepGlobalIndex: idx, resume:true, pending:false, timestamp:Date.now() });
          refreshResumeUI();
          ensureDriverV13(function(){ startAt(idx); });
          return;
        }

        if (typeof stepIndexOrResume==='number'){
          var idx2 = Math.max(0, stepIndexOrResume|0);
          var tgt2 = (BLUEPRINT[idx2] ? BLUEPRINT[idx2].route : '/dashboard');
          if (!isAtRoute(tgt2)){
            saveState({ route: tgt2, stepGlobalIndex: idx2, resume:true, pending:true, timestamp:Date.now() });
            refreshResumeUI();
            var url2 = buildUrlForRoute(tgt2);
            log('NAV (start idx) →', url2);
            location.assign(url2);
            return;
          }
          saveState({ route: tgt2, stepGlobalIndex: idx2, resume:true, pending:false, timestamp:Date.now() });
          refreshResumeUI();
          ensureDriverV13(function(){ startAt(idx2); });
        }
      });
    },
    reset: function(){
      destroyDriver(); clearState(); clearCompleted(); refreshResumeUI();
      releaseGuard('API reset');
      log('Tour réinitialisé');
    },
    debug: function(){
      var st=loadState();
      console.group('[AgiloTour Debug]');
      console.log('version:', window.__AGILO_TOUR_VERSION__);
      console.log('state:', st);
      console.log('member:', MEMBER_CTX);
      console.log('pathname:', location.pathname, '→ normalized:', normalizePath(location.pathname));
      console.log('prefix courant:', currentPrefix());
      console.log('route courante:', currentRoute());
      console.log('guard:', LAUNCH_GUARD);
      console.groupEnd();
    }
  };

  window.agiloStartDeferredFirstVisitTour = function () {
    if (hasSeenOnce() || isCompleted() || currentRoute() !== '/dashboard') return;
    markSeenOnce();
    log('Première visite → démarrage auto (après CGU)');
    withMemberContext(function(){ ensureDriverV13(function () { startAt(0); }); });
  };

  /* ========== BOOT ========== */
  function boot(){
    preloadDriver();
    attachTriggers();
    ensureMeetingToolNode();
    stampStableHooks();
    refreshResumeUI();

    withMemberContext(function(){
      var st = loadState();
      if (st && st.pending===true && (Date.now() - (st.timestamp||0) >= RESUME_GRACE_MS)){
        st.pending=false; saveState(st); log('pending expiré');
      }

      var shouldAuto = st && st.resume===true && st.route===currentRoute() && st.pending===true && (Date.now() - (st.timestamp||0) < RESUME_GRACE_MS);
      if (shouldAuto){
        log('auto-reprise (boot)', st, 'prefix=', currentPrefix());
        ensureDriverV13(function(){ startAt(typeof st.stepGlobalIndex==='number' ? st.stepGlobalIndex : 0); });
        return;
      }

      if (queryHasStart()){
        markSeenOnce(); clearCompleted(); log('Démarrage forcé via URL');
        ensureDriverV13(function(){ startAt(0); });
        return;
      }

      if (!hasSeenOnce() && !isCompleted() && currentRoute() === '/dashboard') {
        if (document.querySelector('.cgv-onboarding-wrapper')) {
          log('Première visite : tour différé (modale CGU sur la page)');
          window.__agiloPendingFirstTour = true;
        } else {
          markSeenOnce();
          log('Première visite → démarrage auto');
          ensureDriverV13(function () { startAt(0); });
        }
        return;
      }

      log('Prêt. route=', currentRoute(), 'prefix=', currentPrefix(), 'seau=', MEMBER_CTX.bucket);
    });
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();

})();
