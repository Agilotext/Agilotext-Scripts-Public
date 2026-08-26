'use strict';

/**
 * Édition produit (restore/pseudo) vs édition API transcription.
 * Source de vérité des tests 2.4.19. Garder aligné avec
 * agiloshield-embed-anonymisation-anon2-beta.js.
 */

const ACTIVE_PLAN_STATUSES = Object.freeze(['ACTIVE', 'TRIALING', 'GRACE']);
const API_EDITIONS = Object.freeze(['free', 'pro', 'ent']);

function normalizeEdition(rawEdition) {
  const n = String(rawEdition || '').trim().toLowerCase();
  if (!n) return 'free';
  if (n === 'business') return 'ent';
  if (n === 'anonymisation' || n === 'shield' || n === 'agiloshield-classic') return 'agiloshield';
  if (n === 'free' || n === 'pro' || n === 'ent' || n === 'agiloshield') return n;
  return 'free';
}

function isActivePlanStatus(status) {
  return ACTIVE_PLAN_STATUSES.indexOf(String(status || '').toUpperCase()) !== -1;
}

function collectMemberPlans(member) {
  const conns = Array.isArray(member && member.planConnections) ? member.planConnections : [];
  if (conns.length) return conns;
  return Array.isArray(member && member.plans) ? member.plans : [];
}

function getPlanId(plan) {
  return String((plan && (plan.planId || plan.plan_id || (plan.plan && plan.plan.id) || plan.id)) || '');
}

function makeHasPlan(plans) {
  const list = Array.isArray(plans) ? plans : [];
  return function hasPlan(prefix) {
    return list.some((plan) => {
      const id = getPlanId(plan);
      return isActivePlanStatus(plan && plan.status) && id.indexOf(prefix) === 0;
    });
  };
}

function hasMemberstackAnonProPlan(plans, hasPlan, classicPriceId) {
  const check = typeof hasPlan === 'function' ? hasPlan : makeHasPlan(plans);
  if (check('pln_agiloshield') || check('pln_agiloshield-classic')) return true;
  const priceIdExpected = classicPriceId || 'prc_classic-mensuel-3u5vr0uq5';
  return (Array.isArray(plans) ? plans : []).some((plan) => {
    const status = String((plan && plan.status) || '').toUpperCase();
    if (status && ACTIVE_PLAN_STATUSES.indexOf(status) === -1) return false;
    const payment = (plan && plan.payment) || {};
    const priceId = String(payment.priceId || plan.priceId || '');
    if (priceId === priceIdExpected) return true;
    const label = [
      plan && plan.planId,
      plan && plan.planName,
      plan && plan.name,
      plan && plan.priceName,
      payment && payment.priceName
    ].filter(Boolean).join(' ').toLowerCase();
    return label.indexOf('agiloshield') !== -1 || label.indexOf('classic mensuel') !== -1;
  });
}

function hasClassicStorageHint(hints) {
  const src = hints || {};
  if (normalizeEdition(src.canonicalEdition) === 'agiloshield') return true;
  if (String(src.agiloshieldEdition || '').toLowerCase() === 'classic') return true;
  return normalizeEdition(src.storedEdition) === 'agiloshield';
}

function resolveTranscriptionEdition(plans, teams) {
  const hasPlan = makeHasPlan(plans);
  const isSeat = !!(teams && teams.belongsToTeam && !(teams.ownedTeams || []).length);
  if (isSeat || hasPlan('pln_business')) return 'ent';
  if (hasPlan('pln_pro')) return 'pro';
  if (hasPlan('pln_free')) return 'free';
  return 'free';
}

function resolveProductEdition(input) {
  const opts = input || {};
  const plans = Array.isArray(opts.plans) ? opts.plans : collectMemberPlans(opts.member);
  const teams = opts.teams || (opts.member && opts.member.teams) || { belongsToTeam: false, ownedTeams: [] };
  const hasPlan = makeHasPlan(plans);
  const isSeat = !!(teams.belongsToTeam && !(teams.ownedTeams || []).length);
  const hasClassic = hasMemberstackAnonProPlan(plans, hasPlan, opts.classicPriceId);
  const transcriptionEdition = resolveTranscriptionEdition(plans, teams);
  const hints = {
    canonicalEdition: opts.canonicalEdition,
    agiloshieldEdition: opts.agiloshieldEdition,
    storedEdition: opts.storedEdition
  };
  const hintClassic = hasClassicStorageHint(hints);
  const memberPresent = !!(opts.member || opts.memberstackResolved || (opts.plans && opts.plans.length));

  if (hasClassic) {
    return {
      edition: 'agiloshield',
      transcriptionEdition,
      memberstackResolved: true,
      hasClassic: true,
      keptFromHint: false
    };
  }

  if (hintClassic) {
    return {
      edition: 'agiloshield',
      transcriptionEdition,
      memberstackResolved: memberPresent,
      hasClassic: false,
      keptFromHint: true
    };
  }

  if (memberPresent) {
    let edition = 'free';
    if (isSeat || hasPlan('pln_business')) edition = 'ent';
    else if (hasPlan('pln_pro')) edition = 'pro';
    else if (hasPlan('pln_free')) edition = 'free';
    return {
      edition,
      transcriptionEdition,
      memberstackResolved: true,
      hasClassic: false,
      keptFromHint: false
    };
  }

  const q = String(opts.queryEdition || '').toLowerCase();
  if (q === 'agiloshield' || q === 'anonymisation') {
    return {
      edition: 'agiloshield',
      transcriptionEdition: 'free',
      memberstackResolved: false,
      hasClassic: false,
      keptFromHint: false
    };
  }
  if (q === 'business' || q === 'ent' || q === 'pro' || q === 'free') {
    return {
      edition: q === 'business' ? 'ent' : q,
      transcriptionEdition: q === 'business' ? 'ent' : q,
      memberstackResolved: false,
      hasClassic: false,
      keptFromHint: false
    };
  }

  const stored = normalizeEdition(opts.storedEdition);
  if (opts.storedEdition) {
    return {
      edition: stored,
      transcriptionEdition: stored === 'agiloshield' ? 'free' : stored,
      memberstackResolved: false,
      hasClassic: false,
      keptFromHint: false
    };
  }

  const path = String(opts.pathname || '');
  if (path.indexOf('/business/') !== -1 || path.indexOf('/ent/') !== -1) {
    return {
      edition: 'ent',
      transcriptionEdition: 'ent',
      memberstackResolved: false,
      hasClassic: false,
      keptFromHint: false
    };
  }
  if (path.indexOf('/pro/') !== -1 || path.indexOf('/premium/') !== -1) {
    return {
      edition: 'pro',
      transcriptionEdition: 'pro',
      memberstackResolved: false,
      hasClassic: false,
      keptFromHint: false
    };
  }
  return {
    edition: 'free',
    transcriptionEdition: 'free',
    memberstackResolved: false,
    hasClassic: false,
    keptFromHint: false
  };
}

function getEditionForApi(productEdition, transcriptionEdition) {
  const product = normalizeEdition(productEdition);
  if (product === 'agiloshield') {
    const api = normalizeEdition(transcriptionEdition || 'free');
    return API_EDITIONS.indexOf(api) !== -1 ? api : 'free';
  }
  if (product === 'ent' || product === 'pro' || product === 'free') return product;
  return 'free';
}

function applyInflightProductEdition(currentProduct, payload) {
  const current = normalizeEdition(currentProduct);
  const data = payload || {};
  const fromProduct = data.productEdition || data.product_edition;
  if (normalizeEdition(fromProduct) === 'agiloshield') return 'agiloshield';
  if (normalizeEdition(data.edition) === 'agiloshield') return 'agiloshield';
  return current;
}

function shouldApplyTokenEdition(_currentProduct, incomingEdition) {
  return normalizeEdition(incomingEdition) === 'agiloshield';
}

function applyUrlEdition(currentProduct, queryEdition) {
  const current = normalizeEdition(currentProduct);
  if (current === 'agiloshield') return current;
  const q = String(queryEdition || '').toLowerCase();
  if (!q) return current;
  if (q === 'agiloshield' || q === 'anonymisation') return 'agiloshield';
  if (q === 'business' || q === 'ent') return 'ent';
  if (q === 'pro' || q === 'free') return q;
  return current;
}

function persistInflightPayload(base, productEdition, apiEdition) {
  const out = Object.assign({}, base || {});
  out.productEdition = normalizeEdition(productEdition);
  out.apiEdition = getEditionForApi(productEdition, apiEdition);
  return out;
}

module.exports = {
  ACTIVE_PLAN_STATUSES,
  API_EDITIONS,
  normalizeEdition,
  isActivePlanStatus,
  collectMemberPlans,
  makeHasPlan,
  hasMemberstackAnonProPlan,
  hasClassicStorageHint,
  resolveTranscriptionEdition,
  resolveProductEdition,
  getEditionForApi,
  applyInflightProductEdition,
  shouldApplyTokenEdition,
  applyUrlEdition,
  persistInflightPayload
};
