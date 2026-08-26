'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const core = require('./lib/agiloshield-edition-core.cjs');

const embedPath = path.join(__dirname, 'agiloshield-embed-anonymisation-anon2-beta.js');
const embed = fs.readFileSync(embedPath, 'utf8');

function ok(cond, msg) {
  assert.ok(cond, msg);
}

const dualPlans = [
  { planId: 'pln_business-1-seat-q85y0ozf', status: 'ACTIVE' },
  { planId: 'pln_agiloshield-classic-qa5ux0uli', status: 'active' }
];
const businessOnly = [{ planId: 'pln_business-1-seat-q85y0ozf', status: 'ACTIVE' }];
const litePlans = [{ planId: 'pln_free-xxxx', status: 'ACTIVE' }];
const proClassic = [
  { planId: 'pln_pro-xxx', status: 'TRIALING' },
  { planId: 'pln_agiloshield-classic-qa5ux0uli', status: 'GRACE' }
];

const dual = core.resolveProductEdition({
  plans: dualPlans,
  teams: { belongsToTeam: true, ownedTeams: [] },
  pathname: '/app/business/dashboard/anonymiser',
  storedEdition: 'business'
});
ok(dual.edition === 'agiloshield', 'dual Business+Classic => produit agiloshield');
ok(dual.transcriptionEdition === 'ent', 'dual => API ent');
ok(core.getEditionForApi(dual.edition, dual.transcriptionEdition) === 'ent', 'getEditionForApi dual => ent');

const business = core.resolveProductEdition({
  plans: businessOnly,
  memberstackResolved: true,
  pathname: '/app/business/dashboard/anonymiser'
});
ok(business.edition === 'ent', 'Business only => ent');
ok(business.hasClassic === false, 'Business only hasClassic false');

const lite = core.resolveProductEdition({
  plans: litePlans,
  memberstackResolved: true,
  pathname: '/app/free/dashboard/anonymiser'
});
ok(lite.edition === 'free', 'Lite => free');

const proPlus = core.resolveProductEdition({ plans: proClassic, memberstackResolved: true });
ok(proPlus.edition === 'agiloshield', 'Pro+Classic => agiloshield');
ok(core.getEditionForApi(proPlus.edition, proPlus.transcriptionEdition) === 'pro', 'Pro+Classic API => pro');

const kept = core.resolveProductEdition({
  plans: businessOnly,
  memberstackResolved: true,
  storedEdition: 'ent',
  canonicalEdition: 'agiloshield'
});
ok(kept.edition === 'agiloshield' && kept.keptFromHint === true, 'hint canonical garde Classic');

const pathBiz = core.resolveProductEdition({
  pathname: '/app/business/dashboard/anonymiser'
});
ok(pathBiz.edition === 'ent', 'fallback path business => ent');

const pathBizHint = core.resolveProductEdition({
  pathname: '/app/business/dashboard/anonymiser',
  agiloshieldEdition: 'classic'
});
ok(pathBizHint.edition === 'agiloshield', 'path business + hint classic => agiloshield');

ok(core.applyInflightProductEdition('agiloshield', { edition: 'ent' }) === 'agiloshield', 'inflight API ent ne downgrade pas');
ok(core.applyInflightProductEdition('ent', { productEdition: 'agiloshield', edition: 'ent' }) === 'agiloshield', 'inflight productEdition restore Classic');
ok(core.applyInflightProductEdition('free', { edition: 'pro' }) === 'free', 'inflight API pro ignoree');

ok(core.shouldApplyTokenEdition('free', 'business') === false, 'token business ignore');
ok(core.shouldApplyTokenEdition('ent', 'ent') === false, 'token ent ignore');
ok(core.shouldApplyTokenEdition('ent', 'agiloshield') === true, 'token Classic upgrade');

ok(core.applyUrlEdition('agiloshield', 'business') === 'agiloshield', 'URL business ne downgrade pas Classic');
ok(core.applyUrlEdition('free', 'business') === 'ent', 'URL business sur free => ent');

const persisted = core.persistInflightPayload({ savedAt: 1, items: [] }, 'agiloshield', 'ent');
ok(persisted.productEdition === 'agiloshield', 'persist productEdition');
ok(persisted.apiEdition === 'ent', 'persist apiEdition');

ok(embed.indexOf("window.__AGILO_EMBED_ANON_VERSION__ = '2.4.19'") !== -1, 'embed version 2.4.19');
ok(embed.indexOf('productEdition') !== -1, 'embed sauve productEdition');
ok(embed.indexOf('applyInflightProductEdition') !== -1, 'embed n applique plus payload.edition API');
ok(embed.indexOf('shouldApplyTokenEdition') !== -1, 'embed ignore token non-Classic');
ok(embed.indexOf('collectMemberPlans') !== -1, 'embed lit plans + planConnections');
ok(/state\.edition = normalizeEdition\(payload\.edition\)/.test(embed) === false, 'plus de downgrade inflight brut');

const guard = fs.readFileSync(path.join(__dirname, 'webflow-agilo-edition-guard.js'), 'utf8');
ok(guard.indexOf('__agiloEditionGuard') !== -1, 'garde Webflow presente');
ok(guard.indexOf('blocked clobber') !== -1, 'garde bloque le clobber Classic');

console.log('test-edition-2.4.19: OK');
