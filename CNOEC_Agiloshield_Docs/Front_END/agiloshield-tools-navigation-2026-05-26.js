(function () {
  'use strict';

  if (window.__agiloToolsNavigationV2) return;
  window.__agiloToolsNavigationV2 = true;

  var VERSION = '2026-05-26.1';
  var AGILOSHIELD_CLASSIC_PRICE_ID = 'prc_classic-mensuel-3u5vr0uq5';
  var ACTIVE_STATUSES = ['ACTIVE', 'TRIALING', 'GRACE'];

  function normStatus(value) {
    return String(value || '').trim().toUpperCase();
  }

  function normText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isActivePlan(plan) {
    var status = normStatus(plan && plan.status);
    if (status) return ACTIVE_STATUSES.indexOf(status) !== -1;
    if (typeof (plan && plan.active) === 'boolean') return plan.active;
    return false;
  }

  function getPlanId(plan) {
    return String(plan && (plan.planId || (plan.plan && plan.plan.id) || plan.id) || '');
  }

  function getPriceId(plan) {
    var payment = (plan && plan.payment) || {};
    return String(payment.priceId || plan.priceId || '');
  }

  function getPlanLabel(plan) {
    var payment = (plan && plan.payment) || {};
    return [
      plan && plan.planId,
      plan && plan.planName,
      plan && plan.name,
      plan && plan.priceName,
      plan && plan.type,
      payment && payment.priceName,
      payment && payment.priceId
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function getConnections(member) {
    return Array.isArray(member && member.planConnections) ? member.planConnections : [];
  }

  function getLegacyPlans(member) {
    return Array.isArray(member && member.plans) ? member.plans : [];
  }

  function allPlans(member) {
    var conns = getConnections(member);
    return conns.length ? conns : getLegacyPlans(member);
  }

  function hasPlan(member, matcher) {
    return allPlans(member).some(function (plan) {
      return isActivePlan(plan) && matcher(plan);
    });
  }

  function hasPlanPrefix(member, prefix) {
    return hasPlan(member, function (plan) {
      return getPlanId(plan).indexOf(prefix) === 0;
    });
  }

  function hasAgiloshieldClassic(member) {
    return hasPlan(member, function (plan) {
      var planId = getPlanId(plan);
      var priceId = getPriceId(plan);
      var label = getPlanLabel(plan);
      return planId.indexOf('pln_agiloshield') === 0 ||
        planId.indexOf('pln_agiloshield-classic') === 0 ||
        priceId === AGILOSHIELD_CLASSIC_PRICE_ID ||
        label.indexOf('agiloshield') !== -1 ||
        label.indexOf('classic mensuel') !== -1;
    });
  }

  function getTeamSignals(member) {
    var teams = (member && member.teams) || { belongsToTeam: false, ownedTeams: [], joinedTeams: [] };
    var owned = Array.isArray(teams.ownedTeams) ? teams.ownedTeams : [];
    var joined = Array.isArray(teams.joinedTeams) ? teams.joinedTeams : [];
    return {
      belongsToTeam: Boolean(teams.belongsToTeam),
      isOwner: Boolean(teams.belongsToTeam && owned.length > 0),
      isSeat: Boolean(teams.belongsToTeam && joined.length > 0 && owned.length === 0)
    };
  }

  function resolvePlanState(member) {
    var team = getTeamSignals(member);
    var hasBusiness = hasPlanPrefix(member, 'pln_business') || team.isOwner || team.isSeat;
    var hasPro = hasPlanPrefix(member, 'pln_pro');
    var hasFree = hasPlanPrefix(member, 'pln_free');
    var hasLegacyAnonymisation = hasPlanPrefix(member, 'pln_anonymisation');
    var hasAgiloshield = hasAgiloshieldClassic(member);

    var transcriptionEdition = hasBusiness ? 'business' : hasPro ? 'pro' : 'free';
    var transcriptionApiEdition = hasBusiness ? 'ent' : hasPro ? 'pro' : 'free';
    var agiloshieldEdition = hasAgiloshield ? 'classic' : hasLegacyAnonymisation ? 'legacy' : 'none';
    var agiloshieldApiEdition = hasAgiloshield ? 'ent' : 'free';
    var canonicalEdition = hasAgiloshield ? 'agiloshield' : hasBusiness ? 'business' : hasPro ? 'pro' : hasLegacyAnonymisation ? 'anonymisation' : 'free';

    return {
      version: VERSION,
      email: (member && member.auth && member.auth.email) || (member && member.email) || '',
      hasAgiloshield: hasAgiloshield,
      hasLegacyAnonymisation: hasLegacyAnonymisation,
      hasBusiness: hasBusiness,
      hasPro: hasPro,
      hasFree: hasFree,
      isOwner: team.isOwner,
      isSeat: team.isSeat,
      transcriptionEdition: transcriptionEdition,
      transcriptionApiEdition: transcriptionApiEdition,
      agiloshieldEdition: agiloshieldEdition,
      agiloshieldApiEdition: agiloshieldApiEdition,
      canonicalEdition: canonicalEdition
    };
  }

  function isAgiloshieldPage() {
    var path = window.location.pathname || '';
    return path.indexOf('/tools/agiloshield/') !== -1 || path.indexOf('/anonymisation') !== -1;
  }

  function persistPlanState(state) {
    try {
      localStorage.setItem('agilo:edition', state.transcriptionApiEdition);
      localStorage.setItem('agilo:canonicalEdition', state.canonicalEdition);
      localStorage.setItem('agilo:transcriptionEdition', state.transcriptionEdition);
      localStorage.setItem('agilo:transcriptionApiEdition', state.transcriptionApiEdition);
      localStorage.setItem('agilo:agiloshieldEdition', state.agiloshieldEdition);
      localStorage.setItem('agilo:agiloshieldApiEdition', state.agiloshieldApiEdition);
      if (state.email) localStorage.setItem('agilo:username', state.email);
    } catch (_errStorage) {
      /* localStorage may be unavailable in private contexts. */
    }
    window.AGILO_PLAN_STATE = state;
    window.dispatchEvent(new CustomEvent('agilo:plan-state', { detail: state }));
  }

  function updateLinkBySelector(selector, newUrl, label) {
    Array.prototype.slice.call(document.querySelectorAll(selector)).forEach(function (link) {
      var text = normText(link.textContent);
      var href = link.getAttribute('href') || '';
      var isMatch =
        (label === 'Tableau de bord' && (text.indexOf('tableau') !== -1 || text.indexOf('dashboard') !== -1)) ||
        (label === 'Mon compte' && (text.indexOf('compte') !== -1 || href.indexOf('profile') !== -1)) ||
        (label === 'Transcriptions' && text.indexOf('transcription') !== -1) ||
        (label === 'Anonymiser' && (text.indexOf('anonymiser') !== -1 || href.indexOf('anonymiser') !== -1)) ||
        (label === 'Breadcrumb Accueil' && (text.indexOf('accueil') !== -1 || text.indexOf('home') !== -1));
      if (isMatch && href && href !== newUrl) {
        link.href = newUrl;
      }
    });
  }

  function getUrls(state) {
    var base = {
      free: {
        dashboard: '/app/free/dashboard',
        profile: '/app/free/profile',
        transcripts: '/app/free/mes-transcripts',
        anonymiser: '/app/free/dashboard/anonymiser'
      },
      pro: {
        dashboard: '/app/premium/dashboard',
        profile: '/app/premium/profile',
        transcripts: '/app/premium/mes-transcripts',
        anonymiser: '/app/premium/dashboard/anonymiser'
      },
      business: {
        dashboard: '/app/business/dashboard',
        profile: '/app/business/profile',
        transcripts: '/app/business/mes-transcripts',
        anonymiser: '/app/business/dashboard/anonymiser'
      },
      anonymisation: {
        dashboard: '/app/anonymisation/dashboard',
        profile: '/app/anonymisation/profile',
        transcripts: '/app/anonymisation/mes-transcripts',
        anonymiser: '/app/anonymisation/dashboard/anonymiser'
      }
    };
    var urls = base[state.transcriptionEdition] || base.free;
    if (state.hasAgiloshield) {
      urls = Object.assign({}, urls, { anonymiser: '/tools/agiloshield/premium/dashboard' });
    }
    return urls;
  }

  function updateLinks(state) {
    var urls = getUrls(state);
    updateLinkBySelector('.dashboard-link[href*="dashboard"], a[data-tour="nav-dashboard"]', urls.dashboard, 'Tableau de bord');
    updateLinkBySelector('a[href*="profile"], a[data-tour="nav-account"]', urls.profile, 'Mon compte');
    updateLinkBySelector('a[href*="transcripts"], a[data-tour="nav-transcripts"]', urls.transcripts, 'Transcriptions');
    updateLinkBySelector('a[href*="anonymiser"], a[data-tour="nav-anonymize"]', urls.anonymiser, 'Anonymiser');
    updateLinkBySelector('.breadcrumb_text-link[href*="dashboard"]', urls.dashboard, 'Breadcrumb Accueil');
  }

  function getBadgeText(state) {
    if (isAgiloshieldPage() && state.hasAgiloshield) return state.agiloshieldEdition === 'classic' ? 'Agiloshield' : 'Anonymisation';
    if (state.transcriptionEdition === 'business') return 'Team';
    if (state.transcriptionEdition === 'pro') return 'Pro';
    return 'Free';
  }

  function updateEditionBadge(state) {
    var textToDisplay = getBadgeText(state);
    var selectors = [
      '.planoption-icon',
      '.icon-small.planoption-icon',
      '[class*="planoption"]',
      '[class*="edition-badge"]',
      '[data-ms-plan]',
      '.dashboard-member .icon-small'
    ];
    var candidates = ['Team', 'Pro', 'Free', 'Gratuit', 'Business', 'Anonymisation', 'Agiloshield'];
    var updated = false;

    selectors.forEach(function (selector) {
      Array.prototype.slice.call(document.querySelectorAll(selector)).forEach(function (element) {
        var currentText = String(element.textContent || '').trim();
        var isEditionBadge = candidates.indexOf(currentText) !== -1 || element.classList.contains('planoption-icon');
        if (isEditionBadge && currentText !== textToDisplay) {
          element.textContent = textToDisplay;
          updated = true;
        }
      });
    });

    if (!updated) {
      var dashboardMember = document.querySelector('.dashboard-member');
      if (dashboardMember) {
        Array.prototype.slice.call(dashboardMember.querySelectorAll('*')).forEach(function (element) {
          var text = String(element.textContent || '').trim();
          if (candidates.indexOf(text) !== -1 && element.children.length === 0) {
            element.textContent = textToDisplay;
            updated = true;
          }
        });
      }
    }
  }

  async function waitForMemberstack(maxWait, interval) {
    var start = Date.now();
    while (Date.now() - start < maxWait) {
      if (window.$memberstackDom && typeof window.$memberstackDom.getCurrentMember === 'function') return window.$memberstackDom;
      await new Promise(function (resolve) { setTimeout(resolve, interval); });
    }
    return null;
  }

  async function getFreshMember(ms) {
    var result = null;
    try {
      result = await ms.getCurrentMember({ cache: 'reload' });
    } catch (_errReload) {
      try { result = await ms.getCurrentMember({ useCache: false }); } catch (_errNoCache) { /* fallback below */ }
    }
    if (!result) {
      try { result = await ms.getCurrentMember(); } catch (_errCached) { /* ignore */ }
    }
    return result && result.data;
  }

  function fallbackStateFromUrl() {
    var path = window.location.pathname || '';
    var transcriptionEdition = 'free';
    if (path.indexOf('/business/') !== -1 || path.indexOf('/ent/') !== -1) transcriptionEdition = 'business';
    else if (path.indexOf('/premium/') !== -1 || path.indexOf('/pro/') !== -1) transcriptionEdition = 'pro';
    return {
      version: VERSION,
      email: '',
      hasAgiloshield: false,
      hasLegacyAnonymisation: path.indexOf('/anonymisation/') !== -1,
      hasBusiness: transcriptionEdition === 'business',
      hasPro: transcriptionEdition === 'pro',
      hasFree: transcriptionEdition === 'free',
      isOwner: false,
      isSeat: false,
      transcriptionEdition: transcriptionEdition,
      transcriptionApiEdition: transcriptionEdition === 'business' ? 'ent' : transcriptionEdition,
      agiloshieldEdition: 'none',
      agiloshieldApiEdition: 'free',
      canonicalEdition: transcriptionEdition
    };
  }

  async function init() {
    var ms = await waitForMemberstack(10000, 200);
    var member = ms ? await getFreshMember(ms) : null;
    var state = member ? resolvePlanState(member) : fallbackStateFromUrl();
    persistPlanState(state);
    updateLinks(state);
    updateEditionBadge(state);
    if (window.AGILO_DEBUG) console.log('[agilo-tools-navigation]', state);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
