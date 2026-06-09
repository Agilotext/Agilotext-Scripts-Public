/* ================================================================
   AGILOTEXT - GLOBAL INVITE HANDLER + LOGIN REDIRECT FIX
   À coller dans Webflow : Project Settings → Custom Code
   → Before </body> (s'applique à TOUTES les pages du site)

   Rôles :
   1. Invite handler : si pendingInviteCode en attente, redirige vers
      join-team pour appliquer l'invitation (quelle que soit la page).
   2. loginRedirect fix : sur toutes les pages /app/* et /tools/*, corrige
      silencieusement loginRedirect → /auth/post-login pour les membres qui
      ont encore un ancien loginRedirect direct (contournant le router).
================================================================ */
(function () {
  'use strict';

  var path = window.location.pathname || '';

  // Pages auth : elles gèrent elles-mêmes, on ne touche à rien.
  if (path.indexOf('/auth/') !== -1) return;

  var pendingCode = localStorage.getItem('pendingInviteCode');
  var isAppPage = path.indexOf('/app/') !== -1 || path.indexOf('/tools/') !== -1;

  // Ne charger Memberstack que si on a un code invite ou qu'on est sur une page app.
  if (!pendingCode && !isAppPage) return;

  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  async function waitForMemberstack(maxWait) {
    var start = Date.now();
    while (Date.now() - start < maxWait) {
      if (window.$memberstackDom && typeof window.$memberstackDom.getCurrentMember === 'function') {
        return window.$memberstackDom;
      }
      await sleep(200);
    }
    return null;
  }

  function memberIsInTeam(member) {
    if (!member) return false;
    var teams = member.teams || {};
    var joined = Array.isArray(teams.joinedTeams) ? teams.joinedTeams : [];
    return joined.length > 0;
  }

  // Corrige loginRedirect → /auth/post-login en background si nécessaire.
  // Sans await : fire & forget, zéro impact UX.
  function fixLoginRedirectIfNeeded(ms, member) {
    if (!member) return;
    var lr = String(member.loginRedirect || '');
    if (lr === '/auth/post-login') return;
    ms.updateMember({ loginRedirect: '/auth/post-login' }).catch(function () { /* non critique */ });
    console.log('[agilo-global] loginRedirect corrigé → /auth/post-login (était : ' + lr + ')');
  }

  async function run() {
    var ms = await waitForMemberstack(8000);
    if (!ms) return;

    var result;
    try { result = await ms.getCurrentMember({ useCache: false }); }
    catch (_) { return; }

    var member = result && result.data;
    if (!member) return;

    // Fix silencieux loginRedirect sur toutes les pages app/tools.
    if (isAppPage) fixLoginRedirectIfNeeded(ms, member);

    // Gestion invite en attente.
    var code = localStorage.getItem('pendingInviteCode');
    if (!code) return;

    // Re-vérifier : un autre onglet a peut-être déjà nettoyé le code.
    code = localStorage.getItem('pendingInviteCode');
    if (!code) return;

    if (memberIsInTeam(member)) {
      localStorage.removeItem('pendingInviteCode');
      console.log('[agilo-invite] Invitation déjà appliquée, routage…');
      window.location.replace('/auth/post-login');
      return;
    }

    localStorage.removeItem('pendingInviteCode');
    console.log('[agilo-invite] Invitation en attente, application…', code);
    window.location.replace('/auth/join-team?inviteToken=' + encodeURIComponent(code) + '&_from=pl');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
