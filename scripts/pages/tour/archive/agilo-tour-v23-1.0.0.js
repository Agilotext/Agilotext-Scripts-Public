/* ARCHIVE figee. Ne pas modifier.
 * Tour Driver.js v1.0.0 / agilo_tour_state_v23
 * Pin jsDelivr SHA 7d5a786be2bc943f2d01de1fe9bc6afa114a4535 (court 7d5a786b).
 * Rollback ONBOARDING_SCRIPT : remettre ce SHA.
 */
/* agilo-tour.js v1.0.0
 * Driver.js 1.3 onboarding (agilo_tour_state_v23).
 * Extracted from Webflow HtmlEmbed code-agilo-tour.
 * v1.0.0: alias Agiloshield (#agfDropzone / #agfAnonJobsWrap) + wait 8s on anonymize keys.
 */
(function () {
  'use strict';

  if (window.__AGILO_TOUR_BOOTED__) return;
  window.__AGILO_TOUR_BOOTED__ = true;
  window.__AGILO_TOUR_VERSION__ = '1.0.0';

  /* ========== CONFIG ========== */
  var STORAGE_KEY     = 'agilo_tour_state_v23';
  var FIRST_RUN_KEY   = 'agilo_tour_first_seen_v23';
  var COMPLETED_KEY   = 'agilo_tour_completed_v23';

  // --- Anti-doublon de démarrage par route ---
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
    'anon-historique': '[data-tour="anon-historique"], #agfAnonJobsWrap, .agf-anon-jobs-list'
  };
  var RESUME_GRACE_MS = 30000;
  var RETRY_TOTAL_MS  = 20000;

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

  /* ========== ROUTING (préfixes /app/free|premium|business) ========== */
  var PREFIX_RE = /^\/(?:app(?:\/(?:free|premium|business))?)\b/;
  function stripDomain(p){ return (p||'/').replace(/^https?:\/\/[^/]+/,''); }
  function normalizePath(p){
    p = stripDomain((p||'/')).split('#')[0].split('?')[0];
    p = p.replace(PREFIX_RE,'').replace(/\/+$/,'') || '/';
    return SYN[p] || p;
  }
  function currentRoute(){ var r = normalizePath(location.pathname); return ROUTES.indexOf(r)>=0 ? r : '/dashboard'; }
  function currentPrefix(){ var m = stripDomain(location.pathname).match(/^\/app(?:\/(?:free|premium|business))?/); return m?m[0]:''; }

  // Normalise une destination de nav ('/…' obligatoire, alias '/' → '/dashboard', synonymes)
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
  var BLUEPRINT=(function(){
    var b=[]; function add(route, key, title, desc, side, align, navigateTo, fallbackCenter){
      b.push({route:route, key:key||null, title:title, desc:desc, side:side||'top', align:align||'center', navigateTo:(navigateTo?navigateTo:null), fallbackCenter:!!fallbackCenter});
    }
// DASHBOARD
add('/dashboard','dashboard-overview','Bienvenue sur Agilotext',
  `Transformez vos réunions en livrables clairs. Cliquez sur <b>« Suivant »</b> pour un tour rapide.`, 'center','center');

add('/dashboard','nav-dashboard','Tableau de bord — votre espace de travail',
  `Ici vous pouvez <b>enregistrer</b> vos réunions ou <b>importer</b> des fichiers audio/vidéo pour traitement.`, 'center','center',null,true);

add('/dashboard','credits-display','Crédits disponibles',
  `Suivez votre <b>consommation</b> et vos <b>crédits</b> dans cet encart. Informations indicatives ; le détail dépend de votre offre.`, 'bottom','center');

add('/dashboard','record','Enregistrer une réunion',
  `Cliquez sur <b>« Enregistrer »</b> pour capturer l’audio.<br><br>
   • <b>Réunion physique</b> : micro de votre ordinateur (démarrage immédiat).<br>
   • <b>Réunion en ligne</b> : capturez Teams, Zoom, Meet… (fenêtre/onglet/écran).<br><br>
   <em>À savoir :</em> par sécurité, l’audio est aussi <b>enregistré localement</b> dans votre dossier <b>Téléchargements</b> à la fin.
   Le fichier s’appelle généralement <code>agilotext_audio_[date].webm</code>.`, 'bottom','center');

add('/dashboard','send-mode','Choisir le mode d’envoi',
  `<b>Envoi unique</b> pour 1 fichier, ou <b>envoi multiple</b> pour traiter plusieurs fichiers en une fois. Formats courants acceptés (MP3, MP4, WAV, M4A, WebM, AAC…).`, 'top','center');

add('/dashboard','options','Format & options',
  `Personnalisez le résultat :
   <ul style="margin:.25rem 0 0 1rem">
     <li><b>Transcription</b> (texte intégral) ou <b>Compte rendu</b> (synthèse structurée)</li>
     <li><b>Reconnaissance des intervenants</b> (selon offre)</li>
     <li><b>Modèle</b> de mise en forme</li>
   </ul>`, 'left','center');

add('/dashboard','submit','Lancer le traitement',
  `Cliquez sur <b>« Envoyer mon fichier »</b>. Vous serez notifié dès que le document est prêt.`, 'top','center');

// NAV → /mes-transcripts
add('/dashboard','nav-transcripts','Accéder à « Mes transcriptions »',
  `Consultez tous vos documents et retrouvez vos résultats.`, 'right','center','/mes-transcripts');

/* MES TRANSCRIPTS */
add('/mes-transcripts',null,'Mes transcriptions',
  `Cette page rassemble toutes vos transcriptions et comptes rendus.`, 'center','center',null,true);

add('/mes-transcripts','new-transcript','Créer un nouveau document',
  `Cliquez ici pour revenir au <b>Tableau de bord</b> et démarrer un nouvel envoi ou un enregistrement.`, 'bottom','center');

add('/mes-transcripts','transcripts-table','Liste de vos documents',
  `Pour chaque élément : <b>télécharger</b> (Word, PDF, TXT), <b>ouvrir</b>, <b>éditer</b> ou <b>partager</b> via lien sécurisé.`, 'top','center');

add('/mes-transcripts','upload-audio','Récupérer l’audio original',
  `Cliquez sur le <b>titre de l’audio</b> pour télécharger le fichier. Pratique pour réécouter un passage.<br>
   <em>Rappel :</em> l’enregistrement est également sauvegardé automatiquement dans votre dossier <b>Téléchargements</b> à la fin.`, 'left','center');

// NAV → /editor (depuis « Mes transcriptions »)
add('/mes-transcripts', 'editor-open', 'Découvrez la page Éditeur',
  `Ouvrez un transcript pour le corriger, l’exporter et poser vos questions à l’IA.`,
  'center','center','/editor', true);

/* 2) BLUEPRINT : steps pour /editor (micro-textes courts) */
add('/editor', null, 'Éditeur — aperçu',
  `Ici vous corrigez, exportez et questionnez vos transcripts. Cliquez sur <b>« Suivant »</b>.`,
  'center','center', null, true);

add('/editor', 'ed-tabs', '3 panneaux',
  `<b>Transcription</b> (texte), <b>Compte rendu</b> (synthèse), <b>Conversation</b> (questions IA).`,
  'bottom','center');

add('/editor', 'find-replace', 'Rechercher / Remplacer',
  `Recherchez (Ctrl/Cmd+F), puis <b>Remplacer</b> ou <b>Tout remplacer</b>.`,
  'bottom','center');

add('/editor', 'save', 'Sauvegarder',
  `Enregistrez votre version. Vous la retrouvez ensuite dans la colonne de gauche.`,
  'bottom','center');

add('/editor', 'rail-list', 'Retrouver vos documents',
  `Votre historique est ici : cliquez pour rouvrir. Tri & recherche en haut.`,
  'right','center');

add('/editor', 'download-transcript', 'Télécharger',
  `Exportez la <b>transcription</b> (.txt, .docx, .pdf…).`,
  'bottom','center');

add('/editor', 'audio', 'Écouter & suivre',
  `Lisez l’audio ; un clic sur un <b>timecode</b> cale la lecture. Avec la <b>reco. intervenants</b>, le surlignage suit automatiquement.`,
  'top','center');

add('/editor', 'ia-questions', 'Questions IA',
  `Posez vos questions liées à votre cas d’usage. Des exemples sont proposés ; testez !`,
  'left','center');

// NOUVEAU — met en avant le bouton "Analyses IA"
add('/editor', 'ia-analyses', 'Analyses IA — testez en 1 clic',
  `Obtenez en un clic un rapport : <b>émotions</b>, <b>axes CAB/stratégie</b>, <b>KPI</b> avec timecodes.
  Cliquez pour lancer un exemple sur ce transcript.`,
  'left','center');
 
// NAV → /profile (on atterrit directement sur l’onglet prompts)
add('/editor','nav-account','Aller à « Mon compte »',
  `Paramétrez modèles, intégrations et préférences.`, 'right','center','/profile?tab=prompts');
   

/* PROFILE */
add('/profile',null,'Mon compte',
  `Personnalisez Agilotext selon vos besoins.`, 'center','center',null,true);

add('/profile','create-template','Modèles de compte rendu',
  `Créez des modèles adaptés à vos usages (réunions, comités, formations, entretiens) pour gagner du temps.`, 'top','center');

add('/profile','word-boost-quick','Vocabulaires',
  `Ajoutez vos <b>mots/expressions</b> (noms, sigles, marques) pour améliorer la reconnaissance et l’orthographe.<br>
   <b>Import en masse :</b> collez une liste — une entrée par ligne ou séparées par <i>virgules</i>/<i>points-virgules</i>.<br>
   Nommez le thème puis cliquez sur <b>« Ajouter les termes »</b> (prise en compte sous peu).`,
  'top','center');

add('/profile','webhook','Intégrations & automatisations',
  `Connectez vos outils (Make, Zapier, n8n) pour envoyer automatiquement les résultats vers vos systèmes (messageries, Drive, etc.).`, 'top','center');

add('/profile','general-info','Informations générales',
  `Gérez votre profil, vos préférences et les paramètres d’abonnement.`, 'top','center');

// NAV → /dashboard/anonymiser
add('/profile','nav-anonymize','Agiloshield — anonymisation documentaire',
  `Accédez à l’outil <b>Agiloshield</b> (BETA) : anonymisation avancée pour vos documents et extraits de texte, avec suivi d’historique.`, 'right','center','/dashboard/anonymiser');

/* ANONYMISER (Agiloshield — voir CNOEC_Agiloshield_Docs / Code Anon) */
add('/dashboard/anonymiser',null,'Agiloshield — vue d’ensemble',
  `Ici vous traitez des <b>fichiers</b> ou du <b>texte collé</b> dans un seul parcours.<br><br>
   <b>Fichiers</b> : déposez ou sélectionnez plusieurs documents (PDF, Word, Excel, PowerPoint, CSV, TXT, JSON, FEC, images selon offre…). Limite de taille / quota affichée dans l’interface.<br>
   <b>Texte</b> : onglet dédié — collez un e-mail, une note, du Markdown, etc. Le traitement peut partir automatiquement après saisie.<br><br>
   À droite : mode d’anonymisation, <b>types de données</b> à détecter, listes d’inclusion/exclusion. <em>Version BETA</em> : certaines options évoluent encore.`, 'center','center',null,true);

add('/dashboard/anonymiser','anonymize','Déposer des fichiers ou coller du texte',
  `Utilisez l’onglet <b>Traitement de fichier</b> pour glisser-déposer ou cliquer et choisir vos fichiers, puis <b>Anonymiser les fichiers</b>.<br><br>
   Utilisez <b>Traitement de texte</b> pour coller directement du contenu — le résultat apparaît en vis-à-vis.<br><br>
   L’onglet <b>Restauration</b> est prévu pour les flux de pseudonymisation avancés (activation progressive).`, 'top','center',null);

add('/dashboard/anonymiser','anon-historique','Historique des documents',
  `Retrouvez ici les traitements récents, téléchargez les résultats et gérez vos lots.<br><br>
   Ensuite, retour au <b>tableau de bord</b> pour la suite du guide.`, 'bottom','center','/dashboard',true);

// FIN → Support (sur le Dashboard)
add('/dashboard','nav-support','Support',
  `Besoin d’aide ? Contactez-nous. Merci d’avoir suivi le guide.`, 'right','center');

add('/dashboard','nav-support','Fin du guide',
  `Merci d’avoir suivi le guide.`, 'center','center',null,true);

    for (var i=0;i<b.length;i++) b[i]._gIndex=i;
    return b;
  })();

  var GLOBAL_TOTAL = BLUEPRINT.length;
  function mapAbsoluteIndex(gIndex){ var s=BLUEPRINT[gIndex]; return s?{route:s.route, gIndex:gIndex}:null; }

  /* ========== BUILD STEPS ========== */
  function buildStepsForRoute(route, absoluteIndex){
    var defs = BLUEPRINT.filter(function(s){ return s.route===route; });
    var promises = defs.map(function(s){
      var step = {
        element:null,
        popover:{ title:'Étape '+(s._gIndex+1)+'/'+GLOBAL_TOTAL+' — '+s.title, description:s.desc, side:s.side, align:s.align },
        __gIndex:s._gIndex, __nav:s.navigateTo||null, __center:!!s.fallbackCenter,
        padding: s.fallbackCenter ? remPx(CENTER_PAD_REM) : undefined
      };
      if (s.key){
        var sel = (KEY_SELECTORS[s.key] || ('[data-tour="'+s.key+'"]'));
        var waitMs = (s.key==='anonymize' || s.key==='anon-historique') ? ANON_WAIT_MS : WAIT_MAX_MS;
        return waitFor(sel, waitMs).then(function(el){
          if (!el){
            if (s.fallbackCenter || s.navigateTo){ step.element=ensureCenterAnchor(); step.__center=true; }
            else { step.__skip=true; }
          } else { step.element=el; }
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
    // Mapping simple "étape → onglet"
    var STEP_TAB = {
      'create-template': 'prompts',
      'word-boost-quick': 'mots-cles',
      'webhook': 'integrations',
      'general-info': 'profile'
    };


  var driverInstance=null;
  function destroyDriver(){ if(!driverInstance) return; try{ driverInstance.destroy && driverInstance.destroy(); }catch(_){ } driverInstance=null; }

  function computeResumeIndexAfterNav(idx){
    var r = BLUEPRINT[idx] ? BLUEPRINT[idx].route : null;
    while (idx < BLUEPRINT.length){
      var s=BLUEPRINT[idx];
      if (!s || s.route!==r) break;
      if (s.fallbackCenter===true){ idx++; continue; }
      return idx;
    }
    return idx; // peut renvoyer length en fin de plan
  }

  // Trouve le 1er index “actionnable” d'une route (puis sinon le 1er tout court)
  function firstIndexForRoute(route){
    for (var i=0;i<GLOBAL_TOTAL;i++){ if (BLUEPRINT[i].route===route && !BLUEPRINT[i].fallbackCenter) return i; }
    for (var j=0;j<GLOBAL_TOTAL;j++){ if (BLUEPRINT[j].route===route) return j; }
    return -1;
  }

  /* ========== CORE : start avec retry mais SANS double-boot ========== */
  function startOnThisPageOrRetry(here, absoluteIndex){
    var startTs = Date.now();
    var observer = null;
    var launched = false;

    function cleanup(){ if(observer){ try{observer.disconnect();}catch(_){ } observer=null; } }

    function tryStart(){
      if (launched) return;
      if (LAUNCH_GUARD.driven && LAUNCH_GUARD.route === here) return;

      buildStepsForRoute(here, absoluteIndex).then(function(result){
        var pageSteps=result.steps, startLocal=result.startLocal;

        if (!pageSteps.length){
          var st = loadState()||{};
          st.pending = true; st.resume = true; st.route = here; st.timestamp = Date.now();
          saveState(st); refreshResumeUI();
          if (Date.now() - startTs >= RETRY_TOTAL_MS){ return; }
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
  var meta = (buildResult ? buildResult.steps : []).map(function(s){ return {g:s.__gIndex, nav:s.__nav}; });
  if (!meta || !meta.length) meta = [{g:(loadState()&&loadState().stepGlobalIndex)||0, nav:null}];

  var localIdx = startLocal;

  // ⚠️ Patch 1 — utilise la nav explicite (peut contenir ?tab=... ou #...)
  function navigateForNavStep(origin){
    var m = meta[localIdx] || {};
    if (!m.nav) return false;

    // calcule le prochain index global (où reprendre après la nav)
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
    // si cette étape possède une nav → on navigue
    if (navigateForNavStep('step')) return true;

    // sinon, progression locale classique
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
          // scroll au centre (comme avant)
          ctx && ctx.element && ctx.element.scrollIntoView({behavior:'auto', block:'center'});
        }catch(_){}

        // → ouvre l’onglet lié à l’étape AVANT de mesurer la popover
        try{
          var m   = meta[localIdx] || {};
          var g   = (typeof m.g === 'number') ? m.g : null;
          var def = (g != null) ? BLUEPRINT[g] : null;
          var key = def ? def.key : null;
          var tab = key ? STEP_TAB[key] : null;

          if (tab && typeof window.ensureTab === 'function'){
            window.ensureTab(tab);

            // on laisse le DOM se peindre puis on recalcule la cible
            setTimeout(function(){
              try { ctx && ctx.refresh && ctx.refresh(); } catch(_){}
              try { drv && drv.refresh && drv.refresh(); } catch(_){}
            }, 0);
          }
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
        // ⬅️ si la dernière étape a une nav, on navigue aussi quand l’utilisateur clique « Terminer »
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
      log('tour démarré sur', here, 'steps=', driverSteps.length, 'startLocal=', startLocal);
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

      // Reprendre
      var resumeBtn = t.closest('[data-agilo-tour="start"][data-agilo-tour-visibility="resume-only"]');
      if (resumeBtn){
        e.preventDefault(); e.stopPropagation();
        releaseGuard('user click resume');
        window.AgiloTour.start('resume');
        return;
      }

      // Démarrer/Recommencer → force /dashboard
      var resetBtn = t.closest('[data-agilo-tour="start-reset"]');
      if (resetBtn){
        e.preventDefault(); e.stopPropagation();
        releaseGuard('user click reset');
        clearCompleted();
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
        return;
      }

      // Start générique = reprise
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
    },
    reset: function(){
      destroyDriver(); clearState(); clearCompleted(); refreshResumeUI();
      releaseGuard('API reset');
      log('Tour réinitialisé');
    },
    debug: function(){
      var st=loadState();
      console.group('[AgiloTour Debug]');
      console.log('state:', st);
      console.log('pathname:', location.pathname, '→ normalized:', normalizePath(location.pathname));
      console.log('prefix courant:', currentPrefix());
      console.log('route courante:', currentRoute());
      console.log('guard:', LAUNCH_GUARD);
      console.groupEnd();
    }
  };

  /* ========== Après CGU : lancer le guide première visite (appelé par Script_CGV) ========== */
  window.agiloStartDeferredFirstVisitTour = function () {
    if (hasSeenOnce() || isCompleted() || currentRoute() !== '/dashboard') return;
    markSeenOnce();
    log('Première visite → démarrage auto (après CGU)');
    ensureDriverV13(function () { startAt(0); });
  };

  /* ========== BOOT ========== */
  function boot(){
    preloadDriver();
    attachTriggers();
    refreshResumeUI();

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

    log('Prêt. route=', currentRoute(), 'prefix=', currentPrefix());
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();

})();
