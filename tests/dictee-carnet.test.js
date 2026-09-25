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

  it("createTranscriptFromText uniquement dans le module de document", function () {
    const files = [
      "scripts/shared/agilo-live-transcribe.js",
      "scripts/pages/dashboard/mount-streaming.js",
      "scripts/pages/dashboard/dictee-usages.js",
      "scripts/pages/dashboard/dictee-carnet-picker.js"
    ];
    files.forEach(function (f) {
      assert.doesNotMatch(read(f), /createTranscriptFromText/);
    });
    assert.match(read("scripts/pages/dashboard/dictee-solo-document.js"), /createTranscriptFromText/);
    assert.doesNotMatch(read("scripts/pages/dashboard/dictee-solo-document.js"), /sendMultipleAudio|agilo-upload-confirmed/);
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

  it("UI Dictée solo: icones Nucleo, actions, ordre DOM", function () {
    const usages = read("scripts/pages/dashboard/dictee-usages.js");
    const picker = read("scripts/pages/dashboard/dictee-carnet-picker.js");
    const document = read("scripts/pages/dashboard/dictee-solo-document.js");
    assert.match(usages, /nucleoSvg\("meeting"\)/);
    assert.match(usages, /nucleoSvg\("document"\)/);
    assert.match(document, /nucleoSvg\("sparkle"\)/);
    assert.match(usages, /insertBefore\(chrome, ta\)/);
    assert.match(usages, /Dictée solo/);
    assert.match(usages, /injectToolbar/);
    assert.match(usages, /agilo-dictee-toolbar\{display:flex;flex-direction:column/);
    assert.match(document, /Générer le document/);
    assert.doesNotMatch(document, /Bientôt/);
    assert.match(usages, /generate\.hidden = !isCarnet/);
    assert.match(usages, /chrome\.hidden = !isCarnet/);
    assert.match(document, /dictee-secondary-actions/);
    assert.match(usages, /toggle-format-transcript/);
    assert.match(usages, /toggle-translate/);
    assert.match(usages, /agilo-prompt-picker-anchor/);
    assert.match(usages, /Créer un modèle/);
    assert.match(usages, /agilo-wb-picker-anchor/);
    assert.match(usages, /data-agilo-wb-picker/);
    assert.match(usages, /classList.contains\("options-wrapper"\)/);
    assert.match(usages, /max-width:640px/);
    assert.match(usages, /PLACEHOLDER_CARNET/);
    assert.match(document, /agilo-solo-document__button/);
    assert.match(usages, /is-carnet #agilo-copy-btn/);
    assert.doesNotMatch(usages, /agilo-chip-bientot/);
    assert.match(picker, /agilo-carnet-picker__label">Modèles/);
    assert.match(picker, /Personnalisés/);
    assert.match(picker, /iconKey:/);
    assert.match(picker, /setDisabled/);
    assert.doesNotMatch(picker, /Ajouter pour l.utiliser/);
    assert.doesNotMatch(picker, /data-open-wizard/);
  });

  it("picker conserve iconKey et jamais CSE 1 auto", function () {
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
    const n = P.normalizeModel(
      { promptModelId: 817, promptModelName: "Carnet", iconKey: "meeting" },
      "STANDARD"
    );
    assert.equal(n.id, "817");
    assert.equal(n.iconKey, "meeting");
    const user = P.normalizeModel({ id: 200, name: "Perso" }, "USER");
    assert.equal(user.iconKey, "custom");
  });

  it("hide wrappers seulement dictee+carnet, pas Fichier", function () {
    function el(id, className) {
      const n = {
        id: id || "",
        className: className || "",
        textContent: "",
        parentElement: null,
        hidden: false,
        dataset: {},
        style: {
          props: {},
          setProperty: function (k, v) { this.props[k] = v; },
          removeProperty: function (k) { delete this.props[k]; }
        },
        classList: {
          contains: function (c) {
            return (" " + n.className + " ").indexOf(" " + c + " ") >= 0;
          },
          toggle: function () {}
        },
        closest: function (sel) {
          var cur = n;
          while (cur) {
            if (sel.charAt(0) === "#" && cur.id === sel.slice(1)) return cur;
            if (sel.charAt(0) === "." && cur.classList.contains(sel.slice(1))) return cur;
            if (sel === "label") return null;
            cur = cur.parentElement;
          }
          return null;
        },
        querySelector: function () { return null; },
        querySelectorAll: function () { return []; },
        setAttribute: function () {},
        getAttribute: function () { return null; }
      };
      return n;
    }
    function wrapCheckbox(input) {
      var wrap = el("", "checkbox-component");
      input.parentElement = wrap;
      return wrap;
    }
    var format = el("toggle-format-transcript");
    var formatWrap = wrapCheckbox(format);
    var trans = el("toggle-translate");
    var transWrap = wrapCheckbox(trans);
    var speakers = el("toggle-speakers");
    wrapCheckbox(speakers);
    var summary = el("toggle-summary");
    wrapCheckbox(summary);
    var transSel = el("translate-select");
    var selectContainer = el("", "select-container");
    var pvAnchor = el("agilo-prompt-picker-anchor");
    pvAnchor.parentElement = selectContainer;
    var createA = el("", "");
    createA.textContent = "Créer un modèle";
    var wrapperSelect = el("", "wrapper-select");
    var createParent = {
      querySelectorAll: function (s) { return s === "a" ? [createA] : []; },
      querySelector: function () { return null; }
    };
    wrapperSelect.parentElement = createParent;
    var wb = el("", "agilo-wb-picker");
    var wbAnchor = el("agilo-wb-picker-anchor");
    wbAnchor.closest = function (sel) {
      return sel === ".agilo-wb-picker" ? wb : el.prototype && null;
    };
    var dicteeTab = el("", "source-tab active");
    dicteeTab.getAttribute = function (name) {
      return name === "data-tab" ? "dictee" : null;
    };
    var panelDictee = el("panel-dictee", "active");
    var byId = {
      "toggle-format-transcript": format,
      "toggle-translate": trans,
      "toggle-speakers": speakers,
      "toggle-summary": summary,
      "translate-select": transSel,
      "speakers-select": null,
      "agilo-prompt-picker-anchor": pvAnchor,
      "agilo-wb-picker-anchor": wbAnchor,
      "agilo-wb-picker": null,
      "panel-dictee": panelDictee,
      "agilo-dictee-usage": null,
      "agilo-carnet-help": null,
      "agilo-carnet-chrome": { hidden: false },
      "agilo-carnet-generate": { hidden: false },
      "live-streaming-panel": null,
      "agilo-copy-btn-text": null
    };
    var sandbox = {
      window: {},
      edition: "ent",
      AGILO_SOLO_DOCUMENT_CONTRACT_READY: true,
      CustomEvent: function (name, opts) { this.type = name; this.detail = opts && opts.detail; },
      document: {
        getElementById: function (id) { return byId[id] || null; },
        querySelector: function (sel) {
          if (sel === '.source-tab[data-tab="dictee"]') return dicteeTab;
          if (sel === ".options-wrapper") {
            return { querySelectorAll: function () { return []; } };
          }
          if (sel === "[data-agilo-streaming-root]") return null;
          if (sel === "[data-agilo-streaming-text]") {
            return { dataset: {}, getAttribute: function () { return ""; }, setAttribute: function () {}, value: "" };
          }
          if (sel === "#panel-dictee .dictee-preview-label") return null;
          if (sel === "#panel-dictee .dictee-note") return null;
          return null;
        },
        querySelectorAll: function (sel) {
          if (sel === ".wrapper-select") return [wrapperSelect];
          if (sel === "[data-agilo-wb], [data-agilo-wb-picker], .agilo-wb-picker") return [wb];
          return [];
        },
        createElement: function () {
          return { style: {}, setAttribute: function () {}, appendChild: function () {}, textContent: "" };
        },
        head: { appendChild: function () {} },
        addEventListener: function () {},
        dispatchEvent: function () {}
      },
      localStorage: {
        getItem: function () { return null; },
        setItem: function () {}
      },
      console: console
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    loadScript("scripts/pages/dashboard/dictee-usages.js", sandbox);
    const U = sandbox.AgiloDicteeUsages;
    U.setUsage("carnet", false);
    assert.equal(formatWrap.style.props.display, "none");
    assert.equal(transWrap.style.props.display, "none");
    assert.equal(selectContainer.style.props.display, "none");
    assert.equal(createA.style.props.display, "none");
    assert.equal(wb.style.props.display, "none");
    U.setUsage("reunion", false);
    assert.equal(formatWrap.style.props.display, undefined);
    assert.equal(transWrap.style.props.display, undefined);
    assert.equal(selectContainer.style.props.display, undefined);
    assert.equal(createA.style.props.display, undefined);
    assert.equal(wb.style.props.display, undefined);
    U.setUsage("carnet", false);
    dicteeTab.className = "source-tab";
    panelDictee.className = "";
    U.hideGlobalOptionsIfNeeded();
    assert.equal(formatWrap.style.props.display, undefined);
  });
});
