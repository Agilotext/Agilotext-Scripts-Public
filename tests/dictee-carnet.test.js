/**
 * Tests Dictée Réunion / Carnet v2
 * Exécution : node --test tests/dictee-carnet.test.js
 */
const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function loadScript(rel, sandbox) {
  const code = read(rel);
  vm.runInNewContext(code, sandbox, { filename: rel });
  return sandbox;
}

describe("Dictee Carnet v2", function () {
  it("pause 5000 et coupe 115000 dans transcribe", function () {
    const src = read("scripts/shared/agilo-live-transcribe.js");
    assert.match(src, /var CARNET_PAUSE_MS = 5000/);
    assert.match(src, /var CARNET_SEGMENT_CUT_MS = 115000/);
    assert.match(src, /CARNET_PAUSE_MS: CARNET_PAUSE_MS/);
    assert.match(src, /CARNET_SEGMENT_CUT_MS: CARNET_SEGMENT_CUT_MS/);
  });

  it("stop Carnet ne fait pas uploadBlob ni onLocalAudioReady", function () {
    const src = read("scripts/shared/agilo-live-transcribe.js");
    const stopIdx = src.indexOf("AgiloLiveVoiceController.prototype.stop");
    const teardownIdx = src.indexOf("AgiloLiveVoiceController.prototype.teardownAudio");
    const stopSrc = src.slice(stopIdx, teardownIdx);
    const carnetBranch = stopSrc.slice(
      stopSrc.indexOf("if (isCarnet)"),
      stopSrc.indexOf("var suspendPromise")
    );
    assert.doesNotMatch(carnetBranch, /uploadBlob/);
    assert.doesNotMatch(carnetBranch, /onLocalAudioReady/);
    assert.match(carnetBranch, /_carnetRequestStop/);
    assert.match(stopSrc, /onLocalAudioReady/);
    assert.match(stopSrc, /uploadBlob/);
  });

  it("jamais createTranscriptFromText", function () {
    const files = [
      "scripts/shared/agilo-live-transcribe.js",
      "scripts/pages/dashboard/mount-streaming.js",
      "scripts/pages/dashboard/dictee-usages.js",
      "scripts/pages/dashboard/dictee-carnet-picker.js"
    ];
    files.forEach(function (f) {
      assert.doesNotMatch(read(f), /createTranscriptFromText/);
    });
  });

  it("POST dictationApiAssemblyAi dans mount", function () {
    const src = read("scripts/pages/dashboard/mount-streaming.js");
    assert.match(src, /dictationApiAssemblyAi/);
    assert.match(src, /postCarnetSegment/);
    assert.match(src, /append\("audio"/);
    assert.match(src, /append\("username"/);
    assert.match(src, /append\("token"/);
    assert.match(src, /append\("edition"/);
  });

  it("trial Free encore dans mount-streaming", function () {
    const src = read("scripts/pages/dashboard/mount-streaming.js");
    assert.match(src, /AgiloFreeSpeakerTrial/);
    assert.match(src, /trial\.reserve/);
    assert.match(src, /trial\.commit/);
    assert.match(src, /agilo-upload-failed/);
    assert.match(src, /agilo:record:auto-download/);
  });

  it("pas @main ni AGILO_SCRIPTS_BASE dans les loaders", function () {
    const loaders = [
      "scripts/pages/dashboard/Ent/streaming-ent-loader.js",
      "scripts/pages/dashboard/Pro/streaming-pro-loader.js",
      "scripts/pages/dashboard/Free/streaming-free-loader.js"
    ];
    loaders.forEach(function (f) {
      const src = read(f);
      assert.doesNotMatch(src, /@main\b/);
      assert.doesNotMatch(src, /window\.AGILO_SCRIPTS_BASE/);
      assert.doesNotMatch(src, /AGILO_SCRIPTS_BASE\s*\|\|/);
      assert.match(src, /dictee-usages\.js/);
      assert.match(src, /dictee-carnet-picker\.js/);
      assert.match(src, /var PIN = "[0-9a-f]{7,40}"/);
    });
  });

  it("Free loader expose encore __AGILO_DICTEE_LIMITS", function () {
    const src = read("scripts/pages/dashboard/Free/streaming-free-loader.js");
    assert.match(src, /__AGILO_DICTEE_LIMITS/);
    assert.match(src, /maxDurationSec: 1800/);
    assert.match(src, /maxUsagesPerDay: 1/);
  });

  it("copy sans Fidele / Lisse / doses", function () {
    const files = [
      "scripts/shared/agilo-live-transcribe.js",
      "scripts/pages/dashboard/mount-streaming.js",
      "scripts/pages/dashboard/dictee-usages.js",
      "scripts/pages/dashboard/dictee-carnet-picker.js"
    ];
    files.forEach(function (f) {
      const src = read(f);
      assert.doesNotMatch(src, /Fid[eè]le/);
      assert.doesNotMatch(src, /Liss[eé]/);
      assert.doesNotMatch(src, /doses/i);
    });
  });

  it("persist email + hide seulement dictee+carnet", function () {
    const sandbox = {
      window: {},
      document: {
        getElementById: function () { return null; },
        querySelector: function () { return null; },
        querySelectorAll: function () { return []; },
        createElement: function () {
          return { style: {}, setAttribute: function () {}, appendChild: function () {} };
        },
        head: { appendChild: function () {} },
        addEventListener: function () {}
      },
      localStorage: (function () {
        var s = {};
        return {
          getItem: function (k) { return Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null; },
          setItem: function (k, v) { s[k] = String(v); },
          _s: s
        };
      })(),
      console: console
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    loadScript("scripts/pages/dashboard/dictee-usages.js", sandbox);
    const U = sandbox.AgiloDicteeUsages;
    assert.equal(U.USAGE_PREFIX, "agilotext:dicteeUsage:");
    assert.equal(U.DRAFT_PREFIX, "agilotext:dicteeCarnet:");
    assert.equal(U.normalizeUsage("carnet"), "carnet");
    assert.equal(U.normalizeUsage("nope"), "reunion");
    const email = "bauerwebpro@gmail.com";
    sandbox.localStorage.setItem(U.usageKey(email), "carnet");
    assert.equal(sandbox.localStorage.getItem("agilotext:dicteeUsage:bauerwebpro@gmail.com"), "carnet");
    U.writeDraft(email, "phrase");
    assert.equal(U.readDraft(email), "phrase");
  });

  it("picker 817 jamais CSE 1 auto", function () {
    const sandbox = {
      window: {},
      document: {
        getElementById: function () { return null; },
        querySelector: function () { return null; },
        createElement: function () {
          return { style: {}, setAttribute: function () {}, appendChild: function () {} };
        },
        head: { appendChild: function () {} },
        addEventListener: function () {}
      },
      console: console
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    loadScript("scripts/pages/dashboard/dictee-carnet-picker.js", sandbox);
    const P = sandbox.AgiloDicteeCarnetPicker;
    assert.equal(P.FALLBACK_ID, "817");
    assert.equal(P.CSE_ID, "1");
    const models = [
      { id: "1", name: "CSE", kind: "STANDARD" },
      { id: "817", name: "Carnet", kind: "STANDARD" },
      { id: "200", name: "Perso", kind: "USER" }
    ];
    assert.equal(P.pickDefault(models, null).id, "817");
    assert.equal(P.pickDefault(models, "1").id, "817");
    assert.equal(P.pickDefault(models, "200").id, "200");
    assert.equal(P.isCseDefault(models[0]), true);
  });

  it("account_not_allowed copy Carnet", function () {
    const src = read("scripts/shared/agilo-live-transcribe.js");
    assert.match(src, /Le carnet n.est pas encore activé sur ce compte/);
  });

  it("limites Free aussi en Carnet via _checkLimits au start", function () {
    const src = read("scripts/shared/agilo-live-transcribe.js");
    const startIdx = src.indexOf("AgiloLiveVoiceController.prototype.start");
    const pauseIdx = src.indexOf("AgiloLiveVoiceController.prototype.pause");
    const startSrc = src.slice(startIdx, pauseIdx);
    assert.match(startSrc, /_checkLimits/);
    assert.match(startSrc, /isCarnet/);
  });
});
