/**
 * Dictée locale (Web Speech API) réutilisable : une seule reconnaissance à la fois.
 * Contrat navigateur comme l’onglet Conversation (Code-chat_V05) : segments finaux appendus.
 * @version 1.0.1
 */
(function (global) {
  "use strict";

  var SVG_MIC =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
  var SVG_MIC_STOP =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

  var speechRec = null;
  var activeInput = null;
  var activeMicBtn = null;

  function sanitizeId(raw) {
    return String(raw || "")
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "field";
  }

  function isSupported() {
    return !!(global.SpeechRecognition || global.webkitSpeechRecognition);
  }

  function cleanupMicUi() {
    if (activeMicBtn) {
      activeMicBtn.setAttribute("aria-pressed", "false");
      activeMicBtn.classList.remove("is-recording");
      activeMicBtn.innerHTML = SVG_MIC;
      activeMicBtn = null;
    }
    activeInput = null;
  }

  /**
   * @param {HTMLInputElement|HTMLTextAreaElement} el
   * @returns {boolean}
   */
  function isRecordingFor(el) {
    return !!(speechRec && activeInput === el);
  }

  /**
   * Arrêt moteur + UI ; safe si `onend` se déclenche après {@link tearDown}.
   */
  function tearDown() {
    var prev = speechRec;
    speechRec = null;
    cleanupMicUi();
    if (prev) {
      try {
        prev.stop();
      } catch (e) {
        /* noop */
      }
    }
  }

  /**
   * @param {HTMLInputElement|HTMLTextAreaElement} input
   * @param {string} chunk
   */
  function appendFinalChunk(input, chunk) {
    if (!chunk || !input) return;
    var max = typeof input.maxLength === "number" && input.maxLength >= 0 ? input.maxLength : 0;
    var cur = (input.value || "").trimEnd();
    var next = cur + (cur ? " " : "") + chunk.trim() + " ";
    if (max > 0 && next.length > max) {
      next = next.slice(0, max);
    }
    input.value = next;
    try {
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (e) {
      /* IE */
    }
  }

  /**
   * @typedef {object} StartInlineDictateOpts
   * @property {string} [lang]
   * @property {(evt: SpeechRecognitionErrorEvent|Error) => void} [onError]
   * @property {() => void} [onUnsupported]
   */

  /**
   * Démarre la dictée sur ce champ ; arrête toute reco en cours sur un autre champ.
   * @param {HTMLInputElement|HTMLTextAreaElement} input
   * @param {HTMLButtonElement} micBtn
   * @param {StartInlineDictateOpts=} opts
   */
  function startForField(input, micBtn, opts) {
    opts = opts || {};
    var Rec = global.SpeechRecognition || global.webkitSpeechRecognition;
    if (!Rec) {
      if (opts.onUnsupported) opts.onUnsupported();
      return;
    }
    tearDown();

    var rec = new Rec();
    var lang = opts.lang || "fr-FR";
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = true;

    rec.onresult = function (ev) {
      var chunk = "";
      var i = ev.resultIndex;
      for (; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) {
          chunk += ev.results[i][0].transcript;
        }
      }
      var target = opts.getActiveInput ? opts.getActiveInput() : activeInput || input;
      if (chunk && target) appendFinalChunk(target, chunk);
    };

    rec.onerror = function (e) {
      var code = (e && e.error) || "";
      if (code === "no-speech" || code === "aborted") return;
      if (opts.onError) opts.onError(e);
      if (code === "not-allowed" || code === "service-not-allowed") tearDown();
    };

    rec.onend = function () {
      if (speechRec !== rec) return;
      speechRec = null;
      cleanupMicUi();
    };

    speechRec = rec;
    activeInput = input;
    activeMicBtn = micBtn;
    micBtn.setAttribute("aria-pressed", "true");
    micBtn.classList.add("is-recording");
    micBtn.innerHTML = SVG_MIC_STOP;
    try {
      rec.start();
    } catch (err) {
      if (opts.onError) opts.onError(err);
      tearDown();
    }
  }

  /**
   * @param {HTMLInputElement|HTMLTextAreaElement} input
   * @param {HTMLButtonElement} micBtn
   * @param {StartInlineDictateOpts=} opts
   */
  function toggleForField(input, micBtn, opts) {
    if (speechRec && activeInput === input) {
      tearDown({ reason: "toggle-off" });
      return;
    }
    if (speechRec) tearDown();
    startForField(input, micBtn, opts);
  }

  /**
   * Bouton à côté du champ ; wrapper léger sous le champ (alignement type barre Conversation).
   * Ne pas utiliser `#chat-dictate-btn` hors éditeur (IDs réservés au chat).
   *
   * @param {HTMLInputElement|HTMLTextAreaElement} input
   * @param {{
   *   lang?: string,
   *   ariaLabel?: string,
   *   titleHint?: string,
   *   layout?: "inline"|"stack",
   *   onError?: (e: SpeechRecognitionErrorEvent|Error|null, message?: string) => void,
   *   announceUnsupportedOnce?: boolean
   * }} options
   * @returns {HTMLButtonElement|null}
   */
  function mountButtonAdjacent(input, options) {
    options = options || {};
    if (!input || input.getAttribute("data-agilo-dictate-mounted") === "1") {
      return null;
    }

    var announceEl = input.closest(".agilo-wizard-dictate__wrap")
      ? null
      : injectUnsupportedHintOnce(input, options);

    var idSuffix =
      sanitizeId(input.name || input.id || "field-" + (input.getAttribute("data-name") || "")) ||
      sanitizeId("" + Math.random());
    var btn = global.document.createElement("button");
    btn.type = "button";
    btn.className =
      options.buttonClass ||
      "agilo-wizard-dictate__btn agilo-wizard-dictate__btn--standalone";
    btn.id = "agilo-wizard-dictate-btn-" + idSuffix;
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("aria-label", options.ariaLabel || "Dicter dans ce champ");
    btn.title = options.titleHint || "Dicter (navigateur)";

    if (!isSupported()) {
      btn.disabled = true;
      btn.setAttribute("aria-disabled", "true");
      btn.title = "Dictée non disponible dans ce navigateur";
      btn.innerHTML = SVG_MIC;
      finalizeMount(input, btn, announceEl, options, true);
      return btn;
    }

    btn.innerHTML = SVG_MIC;
    finalizeMount(input, btn, announceEl, options, false);
    return btn;
  }

  function injectUnsupportedHintOnce(input, options) {
    var wrapEarly = input.closest(".agilo-wizard-dictate__wrap");
    if (
      wrapEarly &&
      wrapEarly.querySelector(".agilo-wizard-dictate__unsupported") &&
      wrapEarly.__agiloUnsupportedInserted
    ) {
      return wrapEarly.querySelector(".agilo-wizard-dictate__unsupported");
    }

    var announced = !!global.document.getElementById("agilo-wizard-dictate-unsupported-msg");
    if (isSupported()) return null;
    if (options && options.announceUnsupportedOnce === false) return null;

    var el = global.document.createElement("p");
    el.className =
      "agilo-wizard-dictate__unsupported" + (!announced ? " agilo-wizard-dictate__unsupported--first" : "");
    if (!announced) {
      el.id = "agilo-wizard-dictate-unsupported-msg";
      el.textContent =
        "Dictée navigateur : meilleure prise en charge dans Chrome ou Edge (ordinateur).";
    } else {
      el.setAttribute("hidden", "");
    }
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");

    /* inséré après le wrap lors du finalizeMount */
    return el;
  }

  /**
   * @param {'inline'|'stack'} layout
   */
  function applyLayoutUi(wrap, bar, input, layout) {
    if (!wrap || !bar || !input) return;
    if (layout === "inline") {
      wrap.classList.add("agilo-wizard-dictate__wrap--inline");
      input.classList.add("agilo-wizard-dictate__field--withMic");
      bar.classList.add("agilo-wizard-dictate__bar--floating");
      if (input.tagName === "INPUT") {
        wrap.classList.add("agilo-wizard-dictate__wrap--singleline");
      }
    }
  }

  /** @returns {'inline'|'stack'} */
  function resolveLayout(options) {
    if (options && options.layout === "stack") return "stack";
    return "inline";
  }

  function finalizeMount(input, btn, announceEl, options, unsupported) {
    options = options || {};
    var layout = resolveLayout(options);
    var parent = input.parentNode;
    if (!parent) return;

    /* wrapper unique */
    var wrap =
      parent.classList &&
      parent.classList.contains("agilo-wizard-dictate__wrap")
        ? parent
        : null;
    if (!wrap) {
      wrap = global.document.createElement("div");
      wrap.className =
        layout === "inline"
          ? "agilo-wizard-dictate__wrap agilo-wizard-dictate__wrap--inline"
          : "agilo-wizard-dictate__wrap";
      parent.insertBefore(wrap, input);
      wrap.appendChild(input);
      if (layout === "inline") {
        input.classList.add("agilo-wizard-dictate__field--withMic");
        if (input.tagName === "INPUT") wrap.classList.add("agilo-wizard-dictate__wrap--singleline");
      }
    } else if (layout === "inline") {
      wrap.classList.add("agilo-wizard-dictate__wrap--inline");
      input.classList.add("agilo-wizard-dictate__field--withMic");
      if (input.tagName === "INPUT") wrap.classList.add("agilo-wizard-dictate__wrap--singleline");
    }

    if (unsupported) {
      var barDisabled = wrap.querySelector(".agilo-wizard-dictate__bar");
      if (!barDisabled) {
        barDisabled = global.document.createElement("div");
        barDisabled.className = "agilo-wizard-dictate__bar";
        wrap.appendChild(barDisabled);
      }
      if (layout === "inline") {
        applyLayoutUi(wrap, barDisabled, input, "inline");
      }
      barDisabled.appendChild(btn);
      if (
        announceEl &&
        !announceEl.parentNode &&
        !global.document.getElementById("agilo-wizard-dictate-unsupported-msg")
      ) {
        wrap.appendChild(announceEl);
        wrap.__agiloUnsupportedInserted = true;
      } else if (
        announceEl &&
        !announceEl.parentNode &&
        announceEl.classList.contains("agilo-wizard-dictate__unsupported--first") === false
      ) {
        wrap.appendChild(announceEl);
      }
      input.setAttribute("data-agilo-dictate-mounted", "1");
      return;
    }

    var bar = wrap.querySelector(".agilo-wizard-dictate__bar") || global.document.createElement("div");
    if (!bar.parentNode) {
      bar.className =
        layout === "inline"
          ? "agilo-wizard-dictate__bar agilo-wizard-dictate__bar--floating"
          : "agilo-wizard-dictate__bar";
      wrap.appendChild(bar);
    } else {
      if (!bar.classList.contains("agilo-wizard-dictate__bar")) {
        bar.className = (bar.className || "") + " agilo-wizard-dictate__bar";
      }
      if (layout === "inline") {
        applyLayoutUi(wrap, bar, input, "inline");
      }
    }
    bar.appendChild(btn);

    if (
      announceEl &&
      !announceEl.parentNode &&
      announceEl.id === "agilo-wizard-dictate-unsupported-msg"
    ) {
      wrap.appendChild(announceEl);
      wrap.__agiloUnsupportedInserted = true;
    }

    btn.addEventListener(
      "click",
      function (ev) {
        ev.preventDefault();
        toggleForField(input, btn, {
          lang: options.lang || "fr-FR",
          getActiveInput: function () {
            return input;
          },
          onError: function (e) {
            var msg = e && e.error ? String(e.error) : "";
            var human =
              msg === "not-allowed"
                ? "Micro refusé : autorisez le micro dans la barre d’adresse."
                : "Dictée : " + (msg || "erreur");
            if (options.onError) options.onError(e, human);
          },
          onUnsupported: function () {
            var h =
              global.document.getElementById("agilo-wizard-dictate-unsupported-msg");
            if (h) h.hidden = false;
          },
        });
      },
      { passive: false }
    );

    input.setAttribute("data-agilo-dictate-mounted", "1");
  }

  global.AgiloSpeechDictate = {
    SVG_MIC: SVG_MIC,
    SVG_MIC_STOP: SVG_MIC_STOP,
    isSupported: isSupported,
    stop: tearDown,
    tearDown: tearDown,
    isRecordingFor: isRecordingFor,
    mountButtonAdjacent: mountButtonAdjacent,
    appendFinalChunk: appendFinalChunk,
    toggleForField: toggleForField,
    startForField: startForField,
  };
})(typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : this);
