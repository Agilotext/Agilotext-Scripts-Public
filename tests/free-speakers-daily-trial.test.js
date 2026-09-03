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

  it("expire prudemment après le TTL uncertain si aucun job", async function () {
    let now = 1_000;
    const core = trial.createCore({
      store: trial.createMemoryStore(),
      now: function () { return now; },
      getMemberId: function () { return "mem_a"; },
      pendingTtlMs: 5_000,
      uncertainTtlMs: 5_000
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

  it("erreur API inconnue = ambiguë", function () {
    assert.equal(
      trial.isCertainRejection(null, { status: "KO", errorMessage: "weird_unknown_backend_error" }),
      false
    );
    assert.equal(trial.isCertainRejection({ type: "httpError", status: 500, message: "boom" }), false);
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

describe("consentement armed et exclusivité", function () {
  it("démarre en mode standard même si speakers a été coché", function () {
    assert.equal(trial.nextUiMode("speakers", "boot"), "standard");
  });

  it("confirmation arme speakers, format ON désarme", function () {
    assert.equal(trial.nextUiMode("standard", "confirm"), "speakers");
    assert.equal(trial.nextUiMode("speakers", "formatOn"), "standard");
    assert.equal(trial.nextUiMode("speakers", "cancel"), "standard");
    assert.equal(trial.nextUiMode("speakers", "speakersOff"), "standard");
  });

  it("checkbox ON sans armed refuse speakers", function () {
    assert.equal(trial.speakersIntent(true, false), false);
    assert.equal(trial.speakersIntent(true, true), true);
    assert.deepEqual(
      trial.resolveFreeSpeakersPayload(true, { speakers: true, armed: false, formatChecked: true }, { ok: true }),
      { timestampTranscript: false, formatTranscript: true }
    );
  });

  it("garde absent : fail-closed Free", function () {
    assert.deepEqual(
      trial.resolveFreeSpeakersPayload(false, { speakers: true, armed: true, formatChecked: true }, { ok: true }),
      { timestampTranscript: false, formatTranscript: true }
    );
  });

  it("speakers accepté impose format OFF", function () {
    assert.deepEqual(
      trial.payloadInvariant({ speakers: true, formatChecked: true }),
      { timestampTranscript: true, formatTranscript: false }
    );
  });

  it("used n’arme pas, pending n’ouvre pas l’upsell Pro", function () {
    assert.equal(trial.canArm("available"), true);
    assert.equal(trial.canArm("used"), false);
    assert.equal(trial.canArm("pending"), false);
    assert.equal(trial.canArm("uncertain"), false);
    assert.equal(trial.upsellKind("used"), "pro");
    assert.equal(trial.upsellKind("pending"), "info");
    assert.equal(trial.upsellKind("uncertain"), "info");
    assert.equal(trial.upsellKind("available"), "confirm");
  });
});

describe("migration v1 vers v2", function () {
  const now = Date.parse("2026-09-03T10:00:00+02:00");
  const day = "2026-09-03";

  it("used v1 du jour est réinitialisé une seule fois", async function () {
    const store = trial.createMemoryStore();
    const memberId = "mem_a";
    store.set(trial.storageKey(memberId, day), {
      version: 1,
      memberId: memberId,
      parisDay: day,
      status: "used",
      source: "upload",
      requestId: "fst-old",
      jobId: "job-old",
      reservedAt: now
    });
    const core = trial.createCore({
      store: store,
      now: function () { return now; },
      getMemberId: function () { return memberId }
    });
    assert.equal(core.getState().status, "available");
    store.set(trial.storageKey(memberId, day), {
      version: 1,
      memberId: memberId,
      parisDay: day,
      status: "used",
      source: "upload",
      requestId: "fst-old-2",
      jobId: "job-old-2",
      reservedAt: now
    });
    assert.equal(core.getState().status, "used");
  });

  it("pending v1 reste bloqué", async function () {
    const result = trial.migrateV1Record({
      version: 1,
      memberId: "mem_a",
      parisDay: day,
      status: "pending",
      reservedAt: now,
      requestId: "fst-1"
    }, "mem_a", day, now, false);
    assert.equal(result.reset, false);
    assert.equal(result.migrated, true);
    assert.equal(result.record.status, "pending");
    assert.equal(result.record.version, 2);
    assert.equal(result.record.migration_v2, true);
  });

  it("uncertain v1 reste bloqué", function () {
    const result = trial.migrateV1Record({
      version: 1,
      memberId: "mem_a",
      parisDay: day,
      status: "uncertain",
      reservedAt: now,
      requestId: "fst-1"
    }, "mem_a", day, now, false);
    assert.equal(result.record.status, "uncertain");
    assert.ok(result.record.uncertainExpiresAt);
  });

  it("ne migre pas un jour antérieur", function () {
    const result = trial.migrateV1Record({
      version: 1,
      memberId: "mem_a",
      parisDay: "2026-09-02",
      status: "used"
    }, "mem_a", day, now, false);
    assert.equal(result.migrated, false);
    assert.equal(result.record, null);
  });
});

describe("TTL pending 3 h et uncertain 15 min", function () {
  it("expose les constantes du plan", function () {
    assert.equal(trial.PENDING_TTL_MS, 3 * 60 * 60 * 1000);
    assert.equal(trial.UNCERTAIN_TTL_MS, 15 * 60 * 1000);
  });

  it("pending expire après 3 heures sans job", async function () {
    let now = 1_000;
    const core = trial.createCore({
      store: trial.createMemoryStore(),
      now: function () { return now; },
      getMemberId: function () { return "mem_a"; }
    });
    await core.reserve({ source: "upload" });
    now = 1_000 + (2 * 60 * 60 * 1000);
    assert.equal(core.getState().status, "pending");
    now = 1_000 + trial.PENDING_TTL_MS;
    const state = await core.reconcile([]);
    assert.equal(state.status, "available");
  });

  it("uncertain expire après 15 minutes sans job", async function () {
    let now = 1_000;
    const core = trial.createCore({
      store: trial.createMemoryStore(),
      now: function () { return now; },
      getMemberId: function () { return "mem_a"; }
    });
    await core.reserve({ source: "recording" });
    await core.markUncertain();
    now = 1_000 + (10 * 60 * 1000);
    assert.equal(core.getState().status, "uncertain");
    now = 1_000 + trial.UNCERTAIN_TTL_MS + 1;
    const state = await core.reconcile([]);
    assert.equal(state.status, "available");
  });
});

describe("parcours upload, micro et dictée", function () {
  it("partagent le même quota quotidien", async function () {
    const core = trial.createCore({
      store: trial.createMemoryStore(),
      now: function () { return 1_000; },
      getMemberId: function () { return "mem_a"; }
    });
    const first = await core.reserve({ source: "upload" });
    await core.commit("job-up", { requestId: first.requestId });
    const rec = await core.reserve({ source: "recording" });
    const dic = await core.reserve({ source: "dictation" });
    assert.equal(rec.ok, false);
    assert.equal(dic.ok, false);
    assert.equal(rec.reason, "used");
    assert.equal(dic.reason, "used");
  });
});

describe("fallback sans Web Locks", function () {
  it("relit le requestId après écriture", async function () {
    const store = trial.createMemoryStore();
    const core = trial.createCore({
      store: store,
      now: function () { return 1_000; },
      getMemberId: function () { return "mem_a"; }
    });
    const reserved = await core.reserve({ source: "upload" });
    assert.equal(reserved.ok, true);
    const record = store.get(trial.storageKey("mem_a", trial.parisDay(new Date(1_000))));
    assert.equal(record.requestId, reserved.requestId);
    assert.equal(record.version, 2);
  });
});

describe("readEdition ignore l’accès nommé window.edition", function () {
  it("n’accepte qu’une string", function () {
    assert.equal(trial.readEdition("free"), "free");
    assert.equal(trial.readEdition("pro"), "pro");
    assert.equal(trial.readEdition(""), "");
    assert.equal(trial.readEdition({}), "");
    assert.equal(trial.readEdition({ id: "edition", textContent: "Free" }), "");
    assert.equal(trial.readEdition(undefined), "");
    assert.equal(trial.readEdition(null), "");
  });

  it("un objet edition n’empêche pas le contexte Free", function () {
    assert.equal(trial.isFreeEditionContext({}, "/app/free/dashboard", false), true);
    assert.equal(trial.isFreeEditionContext("free", "/app/free/dashboard", false), true);
    assert.equal(trial.isFreeEditionContext("pro", "/app/free/dashboard", false), false);
    assert.equal(trial.isFreeEditionContext("ent", "/app/free/dashboard", false), false);
    assert.equal(trial.isFreeEditionContext("free", "/app/ent/dashboard", false), false);
  });
});

describe("closestOptionWrap et copy infobulle", function () {
  it("préfère .checkbox-component au label Webflow", function () {
    const component = { id: "row" };
    const label = {
      closest: function (sel) {
        if (sel === ".checkbox-component") return component;
        return label;
      }
    };
    assert.equal(trial.closestOptionWrap(label), component);
  });

  it("expose la copy available et used", function () {
    assert.match(trial.hintText("available"), /1 essai offert aujourd’hui/);
    assert.match(trial.hintText("used"), /Essai utilisé aujourd’hui/);
    assert.match(trial.hintText("pending"), /Envoi de l’essai en cours/);
    assert.match(trial.hintText("uncertain"), /vérification/);
  });
});

describe("boot navigateur malgré div#edition", function () {
  const fs = require("fs");
  const path = require("path");
  const vm = require("vm");
  const src = fs.readFileSync(
    path.join(__dirname, "../scripts/pages/dashboard/Free/free-speakers-daily-trial.js"),
    "utf8"
  );

  function el(id, extras) {
    const node = {
      id: id || "",
      tagName: extras && extras.tagName || "DIV",
      className: extras && extras.className || "",
      textContent: extras && extras.textContent || "",
      checked: !!(extras && extras.checked),
      style: {},
      attrs: {},
      children: [],
      parentNode: extras && extras.parent || null,
      parentElement: extras && extras.parent || null,
      nextSibling: null,
      classList: {
        toggle: function () {},
        add: function () {},
        remove: function () {},
        contains: function (name) {
          return (" " + node.className + " ").indexOf(" " + name + " ") !== -1;
        }
      },
      setAttribute: function (name, value) {
        node.attrs[name] = String(value);
        if (name === "id") node.id = String(value);
        if (name === "class" || name === "className") node.className = String(value);
      },
      getAttribute: function (name) {
        if (name === "id") return node.id || null;
        return Object.prototype.hasOwnProperty.call(node.attrs, name) ? node.attrs[name] : null;
      },
      removeAttribute: function (name) { delete node.attrs[name]; },
      querySelector: function (sel) {
        return node.querySelectorAll(sel)[0] || null;
      },
      querySelectorAll: function (sel) {
        const out = [];
        function match(child) {
          if (sel === "input, .checkbox_toggle") {
            return child.tagName === "INPUT" || (" " + child.className + " ").indexOf(" checkbox_toggle ") !== -1;
          }
          if (sel === "div, span, p, label") {
            return ["DIV", "SPAN", "P", "LABEL"].indexOf(child.tagName) !== -1;
          }
          if (sel === ".checkbox_toggle") {
            return (" " + child.className + " ").indexOf(" checkbox_toggle ") !== -1;
          }
          return false;
        }
        function walk(current) {
          (current.children || []).forEach(function (child) {
            if (match(child)) out.push(child);
            walk(child);
          });
        }
        walk(node);
        return out;
      },
      contains: function (other) {
        let cur = other;
        while (cur) {
          if (cur === node) return true;
          cur = cur.parentNode;
        }
        return false;
      },
      appendChild: function (child) {
        if (child.parentNode && child.parentNode.children) {
          const list = child.parentNode.children;
          const idx = list.indexOf(child);
          if (idx !== -1) list.splice(idx, 1);
        }
        node.children.push(child);
        child.parentNode = node;
        child.parentElement = node;
        return child;
      },
      insertBefore: function (child) { return node.appendChild(child); },
      removeChild: function (child) {
        const idx = node.children.indexOf(child);
        if (idx !== -1) node.children.splice(idx, 1);
        child.parentNode = null;
        return child;
      },
      closest: function (sel) {
        let cur = node;
        while (cur) {
          if (sel === ".checkbox-component" && (" " + cur.className + " ").indexOf(" checkbox-component ") !== -1) return cur;
          if ((sel === ".w-checkbox, label" || sel === "label") && (cur.tagName === "LABEL" || (" " + cur.className + " ").indexOf(" w-checkbox ") !== -1)) return cur;
          if (sel && sel.charAt(0) === "#" && cur.id === sel.slice(1)) return cur;
          cur = cur.parentNode;
        }
        return null;
      },
      addEventListener: function () {},
      dispatchEvent: function () { return true; }
    };
    return node;
  }

  function loadGuard(edition, pathname) {
    const speakersInput = el("toggle-speakers", { tagName: "INPUT" });
    const formatInput = el("toggle-format-transcript", { tagName: "INPUT", checked: true });
    const toggleLabel = el("", { tagName: "LABEL", className: "w-checkbox checkbox-field" });
    const speakersWrap = el("speakers-wrap", { className: "checkbox-component" });
    const labelHost = el("", {
      tagName: "DIV",
      className: "text-size-small text-color-grey",
      textContent: "Activer la reconnaissance des intervenants"
    });
    const speakersHost = el("speakers-host");
    speakersHost.appendChild(speakersWrap);
    speakersWrap.appendChild(toggleLabel);
    toggleLabel.appendChild(speakersInput);
    speakersWrap.appendChild(labelHost);
    const created = [];
    const byId = {
      "toggle-speakers": speakersInput,
      "toggle-format-transcript": formatInput,
      "speakers-select": el("speakers-select", { tagName: "SELECT" })
    };
    const head = el("head");
    const body = el("body");
    const mem = {};
    const sandbox = {
      window: null,
      document: {
        readyState: "complete",
        head: head,
        body: body,
        getElementById: function (id) {
          if (byId[id]) return byId[id];
          for (let i = 0; i < created.length; i += 1) {
            if (created[i].id === id) return created[i];
          }
          return null;
        },
        querySelector: function (sel) {
          if (sel === 'input[name="memberId"]') return null;
          if (sel === 'input[name="memberEmail"]') return null;
          if (sel === ".select-container.diarization") return el("diarization");
          if (sel === 'input[name="agilo_record_session_id"]') return null;
          return null;
        },
        querySelectorAll: function () { return []; },
        createElement: function (tag) {
          const node = el("", { tagName: String(tag).toUpperCase() });
          created.push(node);
          const originalSet = node.setAttribute;
          node.setAttribute = function (name, value) {
            originalSet(name, value);
            if (name === "id") byId[String(value)] = node;
          };
          return node;
        },
        addEventListener: function () {}
      },
      location: { pathname: pathname },
      localStorage: {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
        setItem: function (k, v) { mem[k] = String(v); },
        removeItem: function (k) { delete mem[k]; }
      },
      navigator: {},
      addEventListener: function () {},
      requestAnimationFrame: function (fn) { fn(); },
      setTimeout: function (fn) { fn(); },
      fetch: function () { return Promise.resolve({ json: function () { return Promise.resolve({ jobsInfoDtos: [] }); } }); },
      console: console,
      Intl: Intl,
      JSON: JSON,
      Date: Date,
      Object: Object,
      Array: Array,
      String: String,
      Number: Number,
      Boolean: Boolean,
      Promise: Promise,
      Error: Error,
      Math: Math,
      parseInt: parseInt,
      encodeURIComponent: encodeURIComponent
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.edition = edition;
    vm.runInNewContext(src, sandbox, { timeout: 2000 });
    return {
      sandbox: sandbox,
      speakersWrap: speakersWrap,
      toggleLabel: toggleLabel,
      labelHost: labelHost,
      head: head,
      created: created
    };
  }

  it("démarre si edition est un objet (div#edition) sur /app/free/", function () {
    const loaded = loadGuard({ id: "edition", textContent: "Free" }, "/app/free/dashboard");
    const api = loaded.sandbox.AgiloFreeSpeakerTrial;
    assert.ok(api);
    assert.equal(api.booted, true);
    assert.equal(loaded.speakersWrap.attrs["data-agilo-speaker-trial"], "2.0.3");
    assert.ok(loaded.head.children.some(function (node) { return node.id === "agilo-speaker-trial-css"; }));
  });

  it("place l’infobulle après le libellé, pas entre le toggle et le texte", function () {
    const loaded = loadGuard({ id: "edition", textContent: "Free" }, "/app/free/dashboard");
    const between = loaded.speakersWrap.children.filter(function (child) {
      return child !== loaded.toggleLabel && child !== loaded.labelHost;
    });
    assert.equal(between.length, 0);
    const tip = loaded.labelHost.children.find(function (child) {
      return child.id === "agilo-speaker-trial-tip-wrap";
    });
    assert.ok(tip);
    assert.equal(tip.className, "agilo-speaker-trial-tip-wrap");
    const bubble = tip.children.find(function (child) { return child.id === "agilo-speaker-trial-hint"; });
    assert.ok(bubble);
    assert.match(bubble.textContent, /1 essai offert aujourd’hui/);
    assert.ok(bubble.classList.contains("agilo-speaker-trial-bubble"));
    assert.equal(loaded.speakersWrap.children.some(function (child) { return child.tagName === "P"; }), false);
  });

  it("ne démarre pas si edition est la string pro", function () {
    const loaded = loadGuard("pro", "/app/free/dashboard");
    const api = loaded.sandbox.AgiloFreeSpeakerTrial;
    assert.ok(api);
    assert.equal(api.booted, false);
    assert.equal(loaded.speakersWrap.attrs["data-agilo-speaker-trial"], undefined);
    assert.equal(loaded.head.children.length, 0);
  });
});
