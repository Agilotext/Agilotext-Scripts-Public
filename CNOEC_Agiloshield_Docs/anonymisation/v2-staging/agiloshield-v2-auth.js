/* Agilotext user session adapter. No Python HMAC or service credential. */
(function () {
  'use strict';
  const TOKEN_URL = 'https://api.agilotext.com/api/v1/getToken';
  const ACTIVE = ['ACTIVE', 'TRIALING', 'GRACE'];
  let cached = null;

  function planIdOf(plan) {
    return String(plan?.planId || plan?.plan_id || plan?.id || '');
  }

  function hasPlan(member, prefix) {
    const plans = member?.planConnections || member?.plans || [];
    return plans.some(plan =>
      ACTIVE.includes(String(plan?.status || '').toUpperCase()) &&
      planIdOf(plan).startsWith(prefix));
  }

  function editionFromMember(member) {
    if (!member) return null;
    const teams = member.teams || {};
    const isSeat = !!(teams.belongsToTeam && !(teams.ownedTeams || []).length);
    if (isSeat || hasPlan(member, 'pln_business')) return 'ent';
    if (hasPlan(member, 'pln_pro')) return 'pro';
    if (hasPlan(member, 'pln_free')) return 'free';
    const plans = member.planConnections || member.plans || [];
    if (plans.length) return 'free';
    return null;
  }

  function editionFromPath() {
    const path = String(location.pathname || '');
    if (path.indexOf('/business/') !== -1 || path.indexOf('/ent/') !== -1) return 'ent';
    if (path.indexOf('/premium/') !== -1 || path.indexOf('/pro/') !== -1 ||
        path.indexOf('/tools/agiloshield/') !== -1) return 'pro';
    return 'free';
  }

  async function readMember() {
    const ms = window.$memberstackDom;
    if (!ms || typeof ms.getCurrentMember !== 'function') return null;
    const started = Date.now();
    while (Date.now() - started < 2000) {
      try {
        const member = await ms.getCurrentMember({cache:'reload'});
        const data = member?.data || null;
        if (data) return data;
      } catch (_) {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return null;
  }

  function emailOf(member) {
    const email = member?.auth?.email || member?.email;
    if (email) return String(email).trim().toLowerCase();
    const field = document.querySelector('[name="memberEmail"]');
    const display = document.querySelector('[data-ms-member="email"]');
    const fallback = String(field?.value || display?.textContent || '').trim().toLowerCase();
    if (!fallback || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fallback)) return '';
    return fallback;
  }

  async function resolveSession() {
    const member = await readMember();
    const email = emailOf(member);
    if (!email) throw new Error('Session Agilotext introuvable');
    const edition = editionFromMember(member) || editionFromPath();
    return {email, edition};
  }

  async function getUserToken(email, edition) {
    if (cached?.email === email && cached?.edition === edition &&
        Date.now() - cached.at < 10 * 60 * 1000) return cached.token;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const url = TOKEN_URL + '?username=' + encodeURIComponent(email) + '&edition=' + edition;
      const response = await fetch(url, {cache:'no-store', credentials:'omit', signal:controller.signal});
      if (!response.ok) throw new Error('Session Agilotext indisponible');
      const body = await response.json();
      if (body.status !== 'OK' || typeof body.token !== 'string' || !body.token)
        throw new Error('Token utilisateur Agilotext indisponible');
      cached = {email, edition, token:body.token, at:Date.now()};
      return body.token;
    } finally { clearTimeout(timer); }
  }

  window.agiloshieldV2UserHeaders = async function () {
    const session = await resolveSession();
    return {
      'X-Agilotext-Username': session.email,
      'X-Agilotext-Token': await getUserToken(session.email, session.edition),
      'X-Agilotext-Edition': session.edition
    };
  };
  window.agiloshieldV2ClearUserToken = function () { cached = null; };
})();
