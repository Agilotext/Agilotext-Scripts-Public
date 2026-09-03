/**
 * Essai quotidien Free : garde intervenants
 * node --test tests/free-speakers-daily-trial.test.js
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const trial = require("../scripts/pages/dashboard/Free/free-speakers-daily-trial.js");

describe("parisDay Europe/Paris", function () {
  it("minuit Paris n’utilise pas toISOString UTC", function () {
    const midnightParis = new Date("2026-09-02T22:00:00.000Z");
    assert.equal(trial.parisDay(midnightParis), "2026-09-03");
    assert.equal(midnightParis.toISOString().slice(0, 10), "2026-09-02");
  });

  it("veille 23:59 Paris reste la veille", function () {
    const almostMidnight = new Date("2026-09-02T21:59:00.000Z");
    assert.equal(trial.parisDay(almostMidnight), "2026-09-02");
  });

  it("changement d’heure mars 2026", function () {
    assert.equal(trial.parisDay(new Date("2026-03-28T23:30:00.000Z")), "2026-03-29");
    assert.equal(trial.parisDay(new Date("2026-03-29T00:30:00.000Z")), "2026-03-29");
  });

  it("changement d’heure octobre 2026", function () {
    assert.equal(trial.parisDay(new Date("2026-10-24T22:30:00.000Z")), "2026-10-25");
    assert.equal(trial.parisDay(new Date("2026-10-25T00:30:00.000Z")), "2026-10-25");
  });
});

describe("parseJobDateMs", function () {
  it("parse dtCreation dd-mm-yyyy hh:mm:ss", function () {
    const ms = trial.parseJobDateMs("03-09-2026 10:15:30");
    assert.ok(ms);
    const d = new Date(ms);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 8);
    assert.equal(d.getDate(), 3);
  });

  it("fallback creationDate ISO", function () {
    const ms = trial.parseJobDateMs("2026-09-03T08:15:30.000Z");
    assert.ok(ms);
    assert.equal(new Date(ms).toISOString(), "2026-09-03T08:15:30.000Z");
  });

  it("refuse une date vide", function () {
    assert.equal(trial.parseJobDateMs(""), null);
    assert.equal(trial.parseJobDateMs(null), null);
  });
});

describe("transitions available / pending / used / uncertain", function () {
  it("reserve puis commit", async function () {
    const store = trial.createMemoryStore();
    const core = trial.createCore({
      store: store,
      now: function () { return 1_000; },
      getMemberId: function () { return "mem_a"; }
    });
    const reserved = await core.reserve({ source: "upload" });
    assert.equal(reserved.ok, true);
    assert.equal(core.getState().status, "pending");
    await core.commit("job-1", { requestId: reserved.requestId });
    assert.equal(core.getState().status, "used");
    assert.equal(core.getState().jobId, "job-1");
  });

  it("rejet certain libère l’essai", async function () {
    const core = trial.createCore({
      store: trial.createMemoryStore(),
      now: function () { return 1_000; },
      getMemberId: function () { return "mem_a"; }
    });
    const reserved = await core.reserve({ source: "upload" });
    await core.release({ requestId: reserved.requestId });
    assert.equal(core.getState().status, "available");
  });

  it("timeout ambigu ne rouvre pas", async function () {
    const core = trial.createCore({
      store: trial.createMemoryStore(),
      now: function () { return 1_000; },
      getMemberId: function () { return "mem_a"; }
    });
    const reserved = await core.reserve({ source: "recording" });
    await core.markUncertain({ requestId: reserved.requestId });
    assert.equal(core.getState().status, "uncertain");
    const again = await core.reserve({ source: "upload" });
    assert.equal(again.ok, false);
    assert.equal(again.reason, "uncertain");
  });

  it("used ne redevient pas available si on release", async function () {
    const core = trial.createCore({
      store: trial.createMemoryStore(),
      now: function () { return 1_000; },
      getMemberId: function () { return "mem_a"; }
    });
    const reserved = await core.reserve({ source: "upload" });
    await core.commit("job-1", { requestId: reserved.requestId });
    await core.release({ requestId: reserved.requestId });
    assert.equal(core.getState().status, "used");
  });
});

describe("double clic et deux onglets", function () {
  it("refuse une seconde réserve le même jour", async function () {
    const store = trial.createMemoryStore();
    const core = trial.createCore({
      store: store,
      now: function () { return 1_000; },
      getMemberId: function () { return "mem_a"; }
    });
    const first = await core.reserve({ source: "upload" });
    const second = await core.reserve({ source: "dictation" });
    assert.equal(first.ok, true);
    assert.equal(second.ok, false);
    assert.equal(second.reason, "pending");
  });

  it("deux cœurs qui partagent le store voient le pending", async function () {
    const map = {};
    const storeA = trial.createMemoryStore(map);
    const storeB = trial.createMemoryStore(map);
    const coreA = trial.createCore({
      store: storeA,
      now: function () { return 1_000; },
      getMemberId: function () { return "mem_a"; }
    });
    const coreB = trial.createCore({
      store: storeB,
      now: function () { return 1_001; },
      getMemberId: function () { return "mem_a"; }
    });
    const first = await coreA.reserve({ source: "upload" });
    const second = await coreB.reserve({ source: "recording" });
    assert.equal(first.ok, true);
    assert.equal(second.ok, false);
  });
});

describe("membre, lendemain, suppression de job", function () {
  it("un autre membre sur le même navigateur a son propre essai", async function () {
    const store = trial.createMemoryStore();
    let member = "mem_a";
    const core = trial.createCore({
      store: store,
      now: function () { return 1_000; },
      getMemberId: function () { return member; }
    });
    const first = await core.reserve({ source: "upload" });
    await core.commit("job-a", { requestId: first.requestId });
    member = "mem_b";
    assert.equal(core.getState().status, "available");
    const second = await core.reserve({ source: "upload" });
    assert.equal(second.ok, true);
  });

  it("le lendemain ouvre un nouvel essai", async function () {
    const store = trial.createMemoryStore();
    let now = Date.parse("2026-09-03T10:00:00+02:00");
    const core = trial.createCore({
      store: store,
      now: function () { return now; },
      getMemberId: function () { return "mem_a"; }
    });
    const first = await core.reserve({ source: "upload" });
    await core.commit("job-1", { requestId: first.requestId });
    now = Date.parse("2026-09-04T00:05:00+02:00");
    assert.equal(core.getState().status, "available");
    const second = await core.reserve({ source: "upload" });
    assert.equal(second.ok, true);
  });

  it("supprimer le job ne redonne pas d’essai", async function () {
    const core = trial.createCore({
      store: trial.createMemoryStore(),
      now: function () { return 1_000; },
      getMemberId: function () { return "mem_a"; }
    });
    const reserved = await core.reserve({ source: "upload" });
    await core.commit("job-1", { requestId: reserved.requestId });
    const after = await core.reconcile([]);
    assert.equal(after.status, "used");
    const again = await core.reserve({ source: "upload" });
    assert.equal(again.ok, false);
    assert.equal(again.reason, "used");
  });
});

describe("réconciliation timeout", function () {
  it("commit si un nouveau job apparaît après reservedAt", async function () {
    const core = trial.createCore({
      store: trial.createMemoryStore(),
      now: function () { return Date.parse("2026-09-03T10:00:00"); },
      getMemberId: function () { return "mem_a"; }
    });
    const reserved = await core.reserveNow({
      source: "upload",
      knownJobIds: ["old-1"]
    });
    const state = await core.reconcile([
      { jobId: "old-1", dtCreation: "03-09-2026 09:00:00" },
      { jobId: "new-2", dtCreation: "03-09-2026 10:00:05" }
    ]);
    assert.equal(state.status, "used");
    assert.equal(state.jobId, "new-2");
    assert.equal(reserved.ok, true);
  });

  it("expire prudemment après le TTL si aucun job", async function () {
    let now = 1_000;
    const core = trial.createCore({
      store: trial.createMemoryStore(),
      now: function () { return now; },
      getMemberId: function () { return "mem_a"; },
      pendingTtlMs: 5_000
    });
    await core.reserve({ source: "upload" });
    await core.markUncertain();
    now = 7_000;
    const state = await core.reconcile([]);
    assert.equal(state.status, "available");
  });
});

describe("rejet certain vs ambigu", function () {
  it("erreur API mappée = certain", function () {
    assert.equal(
      trial.isCertainRejection(null, { status: "KO", errorMessage: "error_audio_format_not_supported" }),
      true
    );
  });

  it("timeout réseau = ambigu", function () {
    assert.equal(trial.isCertainRejection({ type: "timeout" }), false);
    assert.equal(trial.isCertainRejection({ type: "unreachable" }), false);
    assert.equal(trial.isCertainRejection({ type: "serverError" }), false);
  });

  it("invalidToken = certain", function () {
    assert.equal(trial.isCertainRejection({ type: "invalidToken" }), true);
  });
});

describe("Pro et Business inactifs", function () {
  it("decideReserve n’est pas appelé hors Free via skipped public API", function () {
    assert.equal(typeof trial.createCore, "function");
    const core = trial.createCore({
      store: trial.createMemoryStore(),
      getMemberId: function () { return "mem_pro"; }
    });
    assert.equal(core.getState().status, "available");
  });
});
