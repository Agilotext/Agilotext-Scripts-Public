/**
 * Tests logique post-login v8.5 (CSE pending checkout)
 * Exécution : node --test tests/post-login-router.test.js
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const router = require("../scripts/pages/auth/post-login-router.js");

const {
  getTeamSignals,
  getEditionSignals,
  resolveRoute,
  VERSION,
  readPendingCsePrice,
  consumePendingCsePrice
} = router;

const supportSeat = {
  teams: {
    belongsToTeam: true,
    ownedTeams: [{ teamId: "cmlkq7yb604vaps0spucnflmo", role: "OWNER" }],
    joinedTeams: [{ teamId: "cmniumzya003f8e0ssjup5gck", role: "MEMBER", planName: "Business 9 seats" }]
  },
  planConnections: [
    { status: "CANCELED", planId: "pln_business-1-seat-q85y0ozf", active: false },
    { status: "ACTIVE", planId: "pln_agiloshield-classic-qa5ux0uli", active: true }
  ]
};

const florianOwner = {
  teams: {
    belongsToTeam: true,
    ownedTeams: [{ teamId: "cmlv09ya900636l0sjkp0hzac", role: "OWNER" }],
    joinedTeams: []
  },
  planConnections: [
    { status: "ACTIVE", planId: "pln_pro-jf6u05qw", active: true },
    { status: "CANCELED", planId: "pln_business-3-seats--en1520pbn", active: false }
  ]
};

const legacyAnonOnly = {
  planConnections: [
    { status: "ACTIVE", planId: "pln_anonymisation-legacy-test", active: true }
  ]
};

const classicOnly = {
  planConnections: [
    { status: "ACTIVE", planId: "pln_agiloshield-classic-qa5ux0uli", active: true }
  ]
};

const freePlusAnon = {
  planConnections: [
    { status: "ACTIVE", planId: "pln_free-njg10umr", active: true },
    { status: "ACTIVE", planId: "pln_anonymisation-legacy-test", active: true }
  ]
};

describe("version", () => {
  it("exporte v8.5", () => {
    assert.equal(VERSION, "v8.5");
  });
});

describe("getTeamSignals v8", () => {
  it("support@agilotext.com : isSeat true malgré ownedTeams", () => {
    const t = getTeamSignals(supportSeat);
    assert.equal(t.isSeat, true);
    assert.equal(t.isOwner, true);
  });

  it("florian.bauer : isSeat false, isOwner true", () => {
    const t = getTeamSignals(florianOwner);
    assert.equal(t.isSeat, false);
    assert.equal(t.isOwner, true);
  });
});

describe("resolveRoute", () => {
  it("siège business -> /app/business/dashboard", () => {
    const signals = getEditionSignals(supportSeat);
    assert.equal(signals.hasBusiness, false);
    assert.equal(signals.isSeat, true);
    const route = resolveRoute(signals, true);
    assert.equal(route.targetRoute, "/app/business/dashboard");
    assert.equal(route.decisionReason, "team_seat_membership");
  });

  it("owner pro actif, business annulé -> /app/premium/dashboard", () => {
    const signals = getEditionSignals(florianOwner);
    assert.equal(signals.hasBusiness, false);
    assert.equal(signals.isSeat, false);
    assert.equal(signals.hasPro, true);
    const route = resolveRoute(signals, true);
    assert.equal(route.targetRoute, "/app/premium/dashboard");
    assert.equal(route.decisionReason, "active_pro_plan");
  });

  it("pln_anonymisation seul -> /tools/agiloshield/premium/dashboard", () => {
    const signals = getEditionSignals(legacyAnonOnly);
    assert.equal(signals.hasLegacyAnon, true);
    assert.equal(signals.hasFree, false);
    const route = resolveRoute(signals, true);
    assert.equal(route.targetRoute, "/tools/agiloshield/premium/dashboard");
    assert.equal(route.decisionReason, "active_legacy_anonymisation_plan");
    assert.equal(route.targetRoute.includes("/app/anonymisation/"), false);
  });

  it("Agiloshield Classic seul -> /tools/agiloshield/premium/dashboard", () => {
    const signals = getEditionSignals(classicOnly);
    assert.equal(signals.hasAgiloshield, true);
    assert.equal(signals.hasLegacyAnon, false);
    const route = resolveRoute(signals, true);
    assert.equal(route.targetRoute, "/tools/agiloshield/premium/dashboard");
    assert.equal(route.decisionReason, "active_agiloshield_classic_only");
  });

  it("Free + Anonymisation -> /app/free/dashboard", () => {
    const signals = getEditionSignals(freePlusAnon);
    assert.equal(signals.hasFree, true);
    assert.equal(signals.hasLegacyAnon, true);
    const route = resolveRoute(signals, true);
    assert.equal(route.targetRoute, "/app/free/dashboard");
    assert.equal(route.decisionReason, "active_free_plan");
  });

  it("pln_cse-5920aby seul -> /app/business/dashboard", () => {
    const cseOnly = {
      planConnections: [
        { status: "ACTIVE", planId: "pln_cse-5920aby", active: true }
      ]
    };
    const signals = getEditionSignals(cseOnly);
    assert.equal(signals.hasCse, true);
    assert.equal(signals.hasBusiness, false);
    const route = resolveRoute(signals, true);
    assert.equal(route.targetRoute, "/app/business/dashboard");
    assert.equal(route.decisionReason, "active_cse_plan");
  });

  it("pln_pack-cse cadeau ne compte pas comme CSE payant", () => {
    const gift = {
      planConnections: [
        { status: "ACTIVE", planId: "pln_free-njg10umr", active: true },
        { status: "ACTIVE", planId: "pln_pack-cse", active: true }
      ]
    };
    const signals = getEditionSignals(gift);
    assert.equal(signals.hasCse, false);
    assert.equal(signals.hasFree, true);
    const route = resolveRoute(signals, true);
    assert.equal(route.targetRoute, "/app/free/dashboard");
  });
});

describe("join-team params", () => {
  it("decode owner depuis query string", () => {
    const p = new URLSearchParams("owner=Florian+de+BauerWebPro&team=Equipe+Test");
    const owner = decodeURIComponent(String(p.get("owner")).replace(/\+/g, " "));
    assert.equal(owner, "Florian de BauerWebPro");
    assert.equal(decodeURIComponent(String(p.get("team")).replace(/\+/g, " ")), "Equipe Test");
  });
});

describe("pending CSE checkout", () => {
  const mem = {};
  function mockStorage() {
    global.sessionStorage = {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: (k) => { delete mem[k]; }
    };
    Object.keys(mem).forEach((k) => delete mem[k]);
  }
  it("lit un price CSE récent", () => {
    mockStorage();
    mem.agiloCsePriceId = "prc_cse89y-jl40a31";
    mem.agiloCsePriceAt = String(Date.now());
    assert.equal(readPendingCsePrice(), "prc_cse89y-jl40a31");
  });
  it("ignore un price Business", () => {
    mockStorage();
    mem.agiloCsePriceId = "prc_business-1-seat-aj1780sye";
    mem.agiloCsePriceAt = String(Date.now());
    assert.equal(readPendingCsePrice(), "");
  });
  it("consume vide le storage", () => {
    mockStorage();
    mem.agiloCsePriceId = "prc_cse89-8230aqy";
    mem.agiloCsePriceAt = String(Date.now());
    assert.equal(consumePendingCsePrice(), "prc_cse89-8230aqy");
    assert.equal(readPendingCsePrice(), "");
  });
});
