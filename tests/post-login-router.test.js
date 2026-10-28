/**
 * Tests logique post-login v8.10 (CSE 89 € / 890 € → dashboard business, porte Index)
 * Exécution : node --test tests/post-login-router.test.js
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const router = require("../scripts/pages/auth/post-login-router.js");
const security = require("../scripts/shared/agilo-security-tenant.js");

const { getTeamSignals, getEditionSignals, resolveRoute, VERSION, readPendingCsePrice, consumePendingCsePrice, posthogOffer, identifyPosthogMember, hasEnoughPlanData } = router;

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
  it("exporte v8.10", () => {
    assert.equal(VERSION, "v8.10");
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

  it("pln_cse-ic00nme seul -> /app/business/dashboard", () => {
    const cseOnly = {
      planConnections: [
        { status: "ACTIVE", planId: "pln_cse-ic00nme", active: true }
      ]
    };
    const signals = getEditionSignals(cseOnly);
    assert.equal(signals.hasCse, true);
    const route = resolveRoute(signals, true);
    assert.equal(route.targetRoute, "/app/business/dashboard");
    assert.equal(route.decisionReason, "active_cse_plan");
  });

  it("price CSE annuel sans team -> /app/business/dashboard", () => {
    const cseYear = {
      planConnections: [
        { status: "ACTIVE", planId: "pln_unknown-cse", payment: { priceId: "prc_cse89y-vf20nyv" }, active: true }
      ]
    };
    const signals = getEditionSignals(cseYear);
    assert.equal(signals.hasCse, true);
    const route = resolveRoute(signals, true);
    assert.equal(route.targetRoute, "/app/business/dashboard");
  });

  it("price CSE mensuel sans team -> /app/business/dashboard", () => {
    const cseMonth = {
      planConnections: [
        { status: "ACTIVE", planId: "pln_unknown-cse", payment: { priceId: "prc_cse89-rr10n0l" }, active: true }
      ]
    };
    const signals = getEditionSignals(cseMonth);
    assert.equal(signals.hasCse, true);
    const route = resolveRoute(signals, true);
    assert.equal(route.targetRoute, "/app/business/dashboard");
  });

  it("anciens price IDs team ne suffisent plus sans pln_cse-", () => {
    const oldYear = {
      planConnections: [
        { status: "ACTIVE", planId: "pln_unknown-cse", payment: { priceId: "prc_cse89y-jl40a31" }, active: true }
      ]
    };
    assert.equal(getEditionSignals(oldYear).hasCse, false);
    const oldMonth = {
      planConnections: [
        { status: "ACTIVE", planId: "pln_unknown-cse", payment: { priceId: "prc_cse89-8230aqy" }, active: true }
      ]
    };
    assert.equal(getEditionSignals(oldMonth).hasCse, false);
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

describe("pending CSE price", () => {
  it("lit le price neuf dans sessionStorage", () => {
    sessionStorage.setItem("agiloCsePriceId", "prc_cse89y-vf20nyv");
    sessionStorage.setItem("agiloCsePriceAt", String(Date.now()));
    assert.equal(readPendingCsePrice(), "prc_cse89y-vf20nyv");
    assert.equal(consumePendingCsePrice(), "prc_cse89y-vf20nyv");
    assert.equal(readPendingCsePrice(), "");
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

describe("porte Index", () => {
  const routerSrc = fs.readFileSync(path.join(__dirname, "../scripts/pages/auth/post-login-router.js"), "utf8");
  const cgvSrc = fs.readFileSync(path.join(__dirname, "../scripts/shared/agilo-cgv-modal.js"), "utf8");
  const voiceSrc = fs.readFileSync(path.join(__dirname, "../scripts/shared/agilo-voice-dashboard-popup.js"), "utf8");

  it("le contrôle Index est avant le mobile, l'invitation et le CSE", () => {
    const gate = routerSrc.indexOf("INDEX_SECURITY_GATE");
    const mobile = routerSrc.indexOf("agilotext_mobile_auth");
    const invite = routerSrc.indexOf("pendingInviteCode");
    const cse = routerSrc.indexOf("pending_cse_checkout");
    assert.ok(gate > 0);
    assert.ok(gate < mobile);
    assert.ok(mobile < invite);
    assert.ok(invite < cse);
  });

  it("les autres comptes restent sur l'API historique", () => {
    assert.match(routerSrc, /const API_BASE = "https:\/\/api\.agilotext\.com\/api\/v1"/);
    assert.equal(security.INDEX_API_BASE, "https://index-education.agilotext.com/api");
  });

  it("un compte classic ne part pas vers la page MFA, même si le serveur Index répond 503", () => {
    const gate = security.decideIndexStatus({
      tenant: "classic",
      httpStatus: 503,
      nextStep: "mfa_setup",
      hops: 0,
      networkError: false
    });
    assert.equal(gate.action, "continue");
    assert.equal(gate.target, undefined);
  });

  it("Index mfa_setup part vers /auth/verification-mfa", () => {
    const gate = security.decideIndexStatus({
      tenant: "index",
      httpStatus: 200,
      nextStep: "mfa_setup",
      hops: 0
    });
    assert.equal(gate.action, "mfa");
    assert.equal(gate.target, "/auth/verification-mfa");
    assert.equal(gate.nextHops, 1);
    assert.equal(security.withHops(gate.target, gate.nextHops), "/auth/verification-mfa?agilo_mfa_hops=1");
  });

  it("Index mfa_verify part vers la même page", () => {
    const gate = security.decideIndexStatus({
      tenant: "index",
      httpStatus: 200,
      nextStep: "mfa_verify",
      hops: 1
    });
    assert.equal(gate.action, "mfa");
    assert.equal(gate.nextHops, 2);
  });

  it("deux allers MFA sans changement s'arrêtent, sans dashboard", () => {
    const gate = security.decideIndexStatus({
      tenant: "index",
      httpStatus: 200,
      nextStep: "mfa_setup",
      hops: 2
    });
    assert.equal(gate.action, "stuck");
    assert.equal(String(security.blockMessage(gate.action)).includes("dashboard"), false);
    assert.equal(String(security.blockMessage(gate.action)).includes("/app/"), false);
  });

  it("un 503 Index n'ouvre pas le dashboard", () => {
    const gate = security.decideIndexStatus({
      tenant: "index",
      httpStatus: 503,
      nextStep: "normal",
      hops: 0
    });
    assert.equal(gate.action, "unavailable");
    assert.match(security.blockMessage(gate.action), /ne s'ouvre pas/);
  });

  it("un 401 Index renvoie au login", () => {
    assert.equal(security.decideIndexStatus({
      tenant: "index",
      httpStatus: 401,
      nextStep: "",
      hops: 0
    }).action, "login");
  });

  it("password_change laisse le routeur continuer, normal aussi", () => {
    assert.equal(security.decideIndexStatus({
      tenant: "index", httpStatus: 200, nextStep: "password_change", hops: 2
    }).action, "password");
    assert.equal(security.decideIndexStatus({
      tenant: "index", httpStatus: 200, nextStep: "normal", hops: 0
    }).action, "continue");
  });

  it("réseau coupé ou étape inconnue : indisponible", () => {
    assert.equal(security.decideIndexStatus({
      tenant: "index", networkError: true, httpStatus: 0, nextStep: "mfa_setup"
    }).action, "unavailable");
    assert.equal(security.decideIndexStatus({
      tenant: "index", httpStatus: 200, nextStep: "autre"
    }).action, "unavailable");
    assert.equal(security.decideIndexStatus({
      tenant: "index", httpStatus: 403, nextStep: "mfa_setup"
    }).action, "unavailable");
  });

  it("le domaine exact Index et docaposte.fr sont Index, pas un sous-domaine", () => {
    assert.equal(security.classifyTenant("ada@index-education.com"), "index");
    assert.equal(security.classifyTenant("Ada@Index-Education.com"), "index");
    assert.equal(security.classifyTenant("ada@enedis.fr"), "classic");
    assert.equal(security.classifyTenant("ada@sub.index-education.com"), "classic");
    assert.equal(security.classifyTenant("ada@index-education.com.evil.test"), "classic");
    assert.equal(security.classifyTenant("index-education.com"), "classic");
    assert.equal(security.classifyTenant("ada@docaposte.fr"), "index");
    assert.equal(security.classifyTenant("ada@sub.docaposte.fr"), "classic");
    assert.equal(security.classifyTenant("ada@docaposte.com"), "classic");
    assert.equal(security.classifyTenant("ada@index-education.fr"), "classic");
    assert.equal(security.INDEX_ROSTER, undefined);
    assert.equal(security.INDEX_DOMAINS["docaposte.fr"], 1);
    assert.equal(security.INDEX_DOMAINS["index-education.com"], 1);
  });

  it("le jeton n'est pas préfixé deux fois", () => {
    assert.equal(security.authorizationHeader("abc.def"), "Bearer abc.def");
    assert.equal(security.authorizationHeader("Bearer abc.def"), "Bearer abc.def");
    assert.equal(security.authorizationHeader("bearer abc.def"), "Bearer abc.def");
    assert.equal(security.authorizationHeader(""), "");
  });

  it("un cookie vide n'appelle pas le serveur Index", async () => {
    let called = false;
    const status = await security.fetchSecurityStatus("", async () => {
      called = true;
      return { status: 200, json: async () => ({}) };
    });
    assert.equal(called, false);
    assert.equal(status.httpStatus, 401);
  });

  it("le statut Index interroge le serveur dédié, pas l'API historique", async () => {
    const calls = [];
    const status = await security.fetchSecurityStatus("tok", async (url, init) => {
      calls.push({ url, auth: init.headers.Authorization });
      return { status: 200, json: async () => ({ next_step: "mfa_setup", simulation: true }) };
    });
    assert.equal(calls[0].url, "https://index-education.agilotext.com/api/auth/security-status");
    assert.equal(calls[0].auth, "Bearer tok");
    assert.equal(status.nextStep, "mfa_setup");
  });

  it("la CGV du dashboard Business attend le mot de passe Index, pas les autres pages", () => {
    assert.equal(security.cgvWaitsForPassword("ada@index-education.com", "/app/business/dashboard"), true);
    assert.equal(security.cgvWaitsForPassword("ada@index-education.com", "/app/business/dashboard/"), true);
    assert.equal(security.cgvWaitsForPassword("ada@enedis.fr", "/app/business/dashboard"), false);
    assert.equal(security.cgvWaitsForPassword("ada@index-education.com", "/app/free/dashboard"), false);
    assert.match(cgvSrc, /agilo:index-password-done/);
    assert.ok(cgvSrc.indexOf("agilo:index-password-done") < cgvSrc.indexOf("function continueCgvCheck") || cgvSrc.includes("continueCgvCheck"));
  });

  it("la pop-up empreinte attend la fin du mot de passe Index avant la CGV", () => {
    const gate = voiceSrc.indexOf("waitForIndexPasswordGate");
    const cgv = voiceSrc.indexOf("waitUntilCgvDismissed(600000)");
    assert.ok(gate > 0);
    assert.ok(gate < cgv);
  });

  it("le code MFA est une chaîne de six chiffres", () => {
    assert.equal(security.isSixDigitCode("123456"), true);
    assert.equal(security.isSixDigitCode("000000"), true);
    assert.equal(security.isSixDigitCode("12345"), false);
    assert.equal(security.isSixDigitCode("1234567"), false);
    assert.equal(security.isSixDigitCode("12 3456"), false);
    assert.equal(security.isSixDigitCode(123456), false);
  });
});

describe("posthogOffer v8.10", () => {
  it("le CSE seul est cse, le Business avec un CSE reste business", () => {
    assert.equal(posthogOffer(getEditionSignals({
      planConnections: [{ status: "ACTIVE", planId: "pln_cse-mensuel", active: true }]
    })), "cse");
    assert.equal(posthogOffer(getEditionSignals({
      planConnections: [
        { status: "ACTIVE", planId: "pln_cse-ic00nme", active: true },
        { status: "ACTIVE", planId: "pln_business-1-seat-q85y0ozf", active: true }
      ]
    })), "business");
    assert.equal(posthogOffer(getEditionSignals(supportSeat)), "business");
    assert.equal(posthogOffer(getEditionSignals(florianOwner)), "pro");
    assert.equal(posthogOffer(getEditionSignals(classicOnly)), "agiloshield");
    assert.equal(posthogOffer(getEditionSignals(freePlusAnon)), "free");
    assert.equal(posthogOffer(getEditionSignals(legacyAnonOnly)), "agiloshield");
  });

  it("un loginRedirect gratuit sans plan ne suffit pas, un CSE actif oui", () => {
    assert.equal(hasEnoughPlanData({
      loginRedirect: "/app/free/dashboard",
      planConnections: []
    }), false);
    assert.equal(hasEnoughPlanData({
      loginRedirect: "/app/free/dashboard",
      planConnections: [{ status: "ACTIVE", planId: "pln_cse-ic00nme", active: true }]
    }), true);
    assert.equal(resolveRoute(getEditionSignals({
      loginRedirect: "/app/free/dashboard",
      planConnections: [{ status: "ACTIVE", planId: "pln_cse-5920aby", active: true }]
    }), true).targetRoute, "/app/business/dashboard");
  });

  it("identify envoie l'id et l'édition, pas l'e-mail", () => {
    const calls = [];
    global.posthog = {
      identify: function (id, props) { calls.push({ id, props }); }
    };
    global.location = { hostname: "agilotext-test.webflow.io" };
    identifyPosthogMember({
      id: "mem_123",
      auth: { email: "ada@example.com" }
    }, getEditionSignals({
      planConnections: [{ status: "ACTIVE", planId: "pln_pro-jf6u05qw", active: true }]
    }));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].id, "mem_123");
    assert.equal(calls[0].props.edition, "pro");
    assert.equal(calls[0].props.environment, "recette");
    assert.equal("email" in calls[0].props, false);
    delete global.posthog;
    delete global.location;
  });
});
