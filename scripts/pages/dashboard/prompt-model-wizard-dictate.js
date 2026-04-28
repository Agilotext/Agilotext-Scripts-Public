/**
 * Dictée Web Speech API sur le wizard « Configurer votre modèle personnalisé » (Webflow).
 * À charger après scripts/shared/agilo-speech-dictate.js (même hôte / jsDelivr).
 *
 * Config optionnelle : window.__AGILO_WIZARD_DICTATE__ = {
 *   formSelector, rootSelector, fieldSelector, defaultFieldNames,
 *   restrictToKnownNames, lang
 * };
 * @version 1.0.2
 */
(function () {
  "use strict";

  var NS_STYLE = "agilo-wizard-dictate-style-v3";
  var DEBOUNCE_MS = 120;

  var DEFAULT_NAMES = [
    "template-name",
    "objective-2",
    "specific-info-2",
    "structure-2",
    "first-name",
    "last-name",
    "firstname",
    "lastname",
  ];

  var st = {
    modalRoot: null,
    observers: [],
    debTimer: null,
    wiredLifecycle: false,
  };

  function cfg() {
    return window.__AGILO_WIZARD_DICTATE__ || {};
  }

  function resolveForm(c) {
    if (c.formSelector) {
      var f = document.querySelector(c.formSelector);
      if (f) return f;
    }
    return (
      document.querySelector("#wf-form-Global-form") ||
      document.querySelector("form[data-agilo-wizard-form]") ||
      document.querySelector("[data-agilo-wizard-form]")
    );
  }

  function resolveModalRoot(form, c) {
    if (c.rootSelector) {
      var r = document.querySelector(c.rootSelector);
      if (r) return r;
    }
    return (
      form.closest("[data-agilo-wizard-root]") ||
      form.closest('[role="dialog"]') ||
      form.closest(".w-modal") ||
      form
    );
  }

  function eligible(el) {
    if (!el || (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA")) return false;
    if (el.disabled || el.readOnly) return false;
    if (el.closest("[data-agilo-dictate-skip]")) return false;
    if (el.tagName === "TEXTAREA") return true;
    var t = (el.getAttribute("type") || "text").toLowerCase();
    if (/hidden|submit|button|checkbox|radio|file|number|range|email|password/.test(t))
      return false;
    return /^(text|search|tel|url)?$/.test(t);
  }

  function dedupe(arr) {
    var seen = {};
    var o = [];
    for (var i = 0; i < arr.length; i++) {
      if (!seen[arr[i]]) {
        seen[arr[i]] = true;
        o.push(arr[i]);
      }
    }
    return o;
  }

  function gather(form, c) {
    if (c.fieldSelector) {
      return dedupe(
        [].slice.call(form.querySelectorAll(c.fieldSelector)).filter(eligible)
      );
    }
    var marks = [].slice.call(form.querySelectorAll("[data-agilo-dictate]"));
    if (marks.length) {
      var mo = [];
      marks.forEach(function (m) {
        var x = m.matches("input, textarea") ? m : m.querySelector("input, textarea");
        if (x && eligible(x)) mo.push(x);
      });
      if (mo.length) return dedupe(mo);
    }

    var names = (c.defaultFieldNames && c.defaultFieldNames.length ? c.defaultFieldNames : DEFAULT_NAMES).map(
      function (s) {
        return String(s).trim();
      }
    );
    function known(el) {
      var n = (el.name || "").trim();
      var id = (el.id || "").trim();
      return names.some(function (x) {
        return x === n || x === id;
      });
    }

    var pool = [].slice.call(form.querySelectorAll("textarea")).concat(
      [].slice.call(form.querySelectorAll("input")).filter(eligible)
    );
    if (c.restrictToKnownNames === false) return dedupe(pool);
    var by = pool.filter(known);
    if (by.length) return dedupe(by);
    return dedupe([].slice.call(form.querySelectorAll("textarea")));
  }

  function escId(id) {
    if (window.CSS && window.CSS.escape) return window.CSS.escape(id);
    return id.replace(/["\\]/g, "\\$&");
  }

  function ariaFor(el) {
    if (el.id) {
      try {
        var lab = document.querySelector('label[for="' + escId(el.id) + '"]');
        if (lab && lab.textContent) {
          var t = lab.textContent.trim().replace(/\s+/g, " ").slice(0, 120);
          if (t) return "Dicter : " + t;
        }
      } catch (e) {}
    }
    var k = (el.name || el.id || "").replace(/-/g, " ");
    return k ? "Dicter : " + k : "Dicter dans ce champ";
  }

  function injectCss() {
    ["agilo-wizard-dictate-style-v1", "agilo-wizard-dictate-style-v2"].forEach(function (id) {
      var leg = document.getElementById(id);
      if (leg && leg.parentNode) leg.parentNode.removeChild(leg);
    });
    if (document.getElementById(NS_STYLE)) return;
    var s = document.createElement("style");
    s.id = NS_STYLE;
    s.textContent =
      ".agilo-wizard-dictate__wrap{display:flex;flex-direction:column;gap:6px;width:100%;box-sizing:border-box}" +
      ".agilo-wizard-dictate__wrap--inline{position:relative;display:block}" +
      ".agilo-wizard-dictate__wrap--inline>input.agilo-wizard-dictate__field--withMic,.agilo-wizard-dictate__wrap--inline>textarea.agilo-wizard-dictate__field--withMic{width:100%}" +
      ".agilo-wizard-dictate__bar{display:flex;justify-content:flex-end;align-items:center;gap:8px;min-height:36px}" +
      ".agilo-wizard-dictate__wrap:not(.agilo-wizard-dictate__wrap--inline) .agilo-wizard-dictate__bar{flex-shrink:0}" +
      ".agilo-wizard-dictate__bar--floating{position:absolute;z-index:3;right:6px;bottom:7px;margin:0;min-height:0;min-width:0;align-items:center;justify-content:center;pointer-events:auto}" +
      ".agilo-wizard-dictate__wrap--singleline .agilo-wizard-dictate__bar--floating{top:0;bottom:0;right:4px;height:auto;transform:none;display:flex;align-items:center;justify-content:center}" +
      "textarea.agilo-wizard-dictate__field--withMic{padding-inline-end:44px!important;padding-bottom:9px!important;box-sizing:border-box}" +
      "input.agilo-wizard-dictate__field--withMic{padding-inline-end:40px!important;box-sizing:border-box}" +
      ".agilo-wizard-dictate__btn.agilo-wizard-dictate__btn--standalone{display:inline-flex;align-items:center;justify-content:center;min-width:32px;min-height:28px;padding:2px 4px;margin:0;border:none!important;border-radius:6px;background:transparent;color:#334155;cursor:pointer;-webkit-appearance:none;appearance:none;transition:background-color .15s,color .15s;box-shadow:none!important}" +
      ".agilo-wizard-dictate__btn.agilo-wizard-dictate__btn--standalone:hover:not([disabled]){background:rgba(15,23,42,.06)}" +
      ".agilo-wizard-dictate__btn.agilo-wizard-dictate__btn--standalone:focus-visible{outline:2px solid #2563eb;outline-offset:1px;border-radius:6px}" +
      ".agilo-wizard-dictate__btn.agilo-wizard-dictate__btn--standalone[disabled]{opacity:.4;cursor:not-allowed;background:transparent}" +
      ".agilo-wizard-dictate__btn.is-recording{background:rgba(37,99,235,.12)!important;color:#142c66}" +
      ".agilo-wizard-dictate__unsupported{margin:4px 0 0;font-size:12px;line-height:1.4;color:#475569}" +
      ".agilo-wizard-dictate__wrap--inline .agilo-wizard-dictate__unsupported{position:relative;z-index:0}";
    (document.head || document.documentElement).appendChild(s);
  }

  function toast(msg) {
    if (typeof console !== "undefined" && console.warn) console.warn("[Agilo dicter]", msg);
  }

  function disconnectIos() {
    st.observers.forEach(function (io) {
      try {
        io.disconnect();
      } catch (e) {}
    });
    st.observers = [];
  }

  function enhanceNow() {
    var D = window.AgiloSpeechDictate;
    if (!D || !D.mountButtonAdjacent) return;

    var c = cfg();
    var form = resolveForm(c);
    if (!form || !document.body.contains(form)) return;

    injectCss();
    var modal = resolveModalRoot(form, c);
    st.modalRoot = modal;

    disconnectIos();

    var fields = gather(form, c);
    fields.forEach(function (field) {
      if (field.getAttribute("data-agilo-dictate-mounted") !== "1") {
        D.mountButtonAdjacent(field, {
          layout: "inline",
          lang: c.lang || "fr-FR",
          ariaLabel: ariaFor(field),
          announceUnsupportedOnce: true,
          onError: function (_e, human) {
            if (human) toast(human);
          },
        });
      }

      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en) {
            if (
              !en.isIntersecting &&
              D.isRecordingFor &&
              D.isRecordingFor(field)
            ) {
              D.tearDown();
            }
          });
        },
        { root: modal && modal.nodeType === 1 ? modal : null, threshold: 0 }
      );
      io.observe(field);
      st.observers.push(io);
    });

    wireGlobalOnce();
  }

  function wireGlobalOnce() {
    if (st.wiredLifecycle) return;
    st.wiredLifecycle = true;

    document.addEventListener(
      "pointerdown",
      function (ev) {
        if (!st.modalRoot || st.modalRoot.contains(ev.target)) return;
        if (window.AgiloSpeechDictate) window.AgiloSpeechDictate.tearDown();
      },
      true
    );

    document.addEventListener(
      "keydown",
      function (ev) {
        if (ev.key !== "Escape") return;
        if (window.AgiloSpeechDictate) window.AgiloSpeechDictate.tearDown();
      },
      true
    );

    window.addEventListener("beforeunload", function () {
      if (window.AgiloSpeechDictate) window.AgiloSpeechDictate.tearDown();
    });
  }

  function scheduleEnhance() {
    if (st.debTimer) clearTimeout(st.debTimer);
    st.debTimer = setTimeout(function () {
      st.debTimer = null;
      try {
        enhanceNow();
      } catch (e) {
        if (console && console.warn) console.warn("prompt-model-wizard-dictate enhance", e);
      }
    }, DEBOUNCE_MS);
  }

  function initObserver() {
    var mo = new MutationObserver(scheduleEnhance);
    mo.observe(document.documentElement, { childList: true, subtree: true });
    scheduleEnhance();
  }

  /** Attendez agilo-speech-dictate (embed distinct possible). */
  function waitSpeechThenRun() {
    if (window.AgiloSpeechDictate) {
      injectCss();
      initObserver();
      return;
    }
    var n = 0;
    var t = setInterval(function () {
      n++;
      if (window.AgiloSpeechDictate) {
        clearInterval(t);
        injectCss();
        initObserver();
      } else if (n > 200) {
        clearInterval(t);
      }
    }, 50);
  }

  if (window.__agiloWizardDictateInit) return;
  window.__agiloWizardDictateInit = true;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", waitSpeechThenRun);
  } else {
    waitSpeechThenRun();
  }
})();
