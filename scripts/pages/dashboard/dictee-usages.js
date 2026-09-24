/**
 * Dictée dashboard : usages Réunion / Carnet.
 * Persist localStorage agilotext:dicteeUsage:{email} après hydratation Memberstack.
 * Masque intervenants / PV seulement si onglet Dictée + Carnet (wrapper global Fichier).
 */
(function (global) {
  "use strict";

  var USAGE_PREFIX = "agilotext:dicteeUsage:";
  var DRAFT_PREFIX = "agilotext:dicteeCarnet:";
  var PROMPT_PREFIX = "agilotext:dicteeCarnetPrompt:";
  var RECENTS_PREFIX = "agilotext:dicteeCarnetRecents:";
  var DEFAULT_USAGE = "reunion";
  var EMAIL_WAIT_MS = 12000;
  var EMAIL_POLL_MS = 200;

  var state = {
    usage: DEFAULT_USAGE,
    email: "",
    recording: false,
    mounted: false
  };

  function normalizeUsage(v) {
    return v === "carnet" ? "carnet" : DEFAULT_USAGE;
  }

  function readMemberEmail() {
    var input =
      document.querySelector("input.memberemail") ||
      document.querySelector('input[data-ms-member="email"]') ||
      document.querySelector('input[name="memberEmail"]');
    var raw = "";
    if (input) {
      raw = (input.value || input.getAttribute("src") || input.textContent || "").trim();
    }
    if (!raw) {
      var ms = document.querySelector('[data-ms-member="email"]');
      if (ms) raw = (ms.getAttribute("src") || ms.textContent || "").trim();
    }
    if (!raw || raw.indexOf("@") === -1) return "";
    return raw.toLowerCase();
  }

  function usageKey(email) {
    return USAGE_PREFIX + String(email || "").toLowerCase();
  }

  function draftKey(email) {
    return DRAFT_PREFIX + String(email || "").toLowerCase();
  }

  function promptKey(email) {
    return PROMPT_PREFIX + String(email || "").toLowerCase();
  }

  function recentsKey(email) {
    return RECENTS_PREFIX + String(email || "").toLowerCase();
  }

  function readStoredUsage(email) {
    if (!email) return DEFAULT_USAGE;
    try {
      return normalizeUsage(localStorage.getItem(usageKey(email)));
    } catch (e) {
      return DEFAULT_USAGE;
    }
  }

  function writeStoredUsage(email, usage) {
    if (!email) return;
    try {
      localStorage.setItem(usageKey(email), normalizeUsage(usage));
    } catch (e) {}
  }

  function readDraft(email) {
    if (!email) return "";
    try {
      return String(localStorage.getItem(draftKey(email)) || "");
    } catch (e) {
      return "";
    }
  }

  function writeDraft(email, text) {
    if (!email) return;
    try {
      localStorage.setItem(draftKey(email), String(text || "").slice(0, 80000));
    } catch (e) {}
  }

  function isDicteeTab() {
    var tab = document.querySelector('.source-tab[data-tab="dictee"]');
    if (tab && tab.classList.contains("active")) return true;
    var panel = document.getElementById("panel-dictee");
    if (panel && panel.classList.contains("active")) return true;
    if (tab) return false;
    return !!(panel && panel.offsetParent !== null);
  }

  function shouldHideGlobalOptions() {
    return isDicteeTab() && state.usage === "carnet";
  }

  function setWrapDisplay(el, hide) {
    if (!el) return;
    if (hide) el.style.setProperty("display", "none", "important");
    else el.style.removeProperty("display");
  }

  function hideGlobalOptionsIfNeeded() {
    var hide = shouldHideGlobalOptions();
    ["toggle-speakers", "toggle-summary"].forEach(function (id) {
      var input = document.getElementById(id);
      var wrap = input && input.closest(".checkbox-component");
      setWrapDisplay(wrap, hide);
    });
    var sel = document.getElementById("speakers-select");
    if (sel && !sel.closest(".checkbox-component")) {
      setWrapDisplay(sel, hide);
      var selWrap = sel.closest(".select-wrapper") || sel.parentElement;
      if (selWrap && selWrap !== sel) setWrapDisplay(selWrap, hide);
    }
  }

  function ensureCss() {
    if (document.getElementById("agilo-dictee-usage-css")) return;
    var style = document.createElement("style");
    style.id = "agilo-dictee-usage-css";
    style.textContent =
      ".agilo-dictee-usage{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin:0 0 1rem;}" +
      ".agilo-dictee-usage__btn{appearance:none;text-align:left;cursor:pointer;border:1.5px solid #d4d4d4;background:#fff;border-radius:12px;padding:.7rem .85rem;font-family:inherit;color:#171717;transition:border-color .15s,box-shadow .15s,background .15s;}" +
      ".agilo-dictee-usage__btn[aria-selected='true']{border-color:var(--agilo-primary,#174a96);box-shadow:0 0 0 1px var(--agilo-primary,#174a96);background:#f4f7fb;}" +
      ".agilo-dictee-usage__btn:disabled{opacity:.55;cursor:not-allowed;}" +
      ".agilo-dictee-usage__title{display:block;font-size:.92rem;font-weight:700;line-height:1.2;}" +
      ".agilo-dictee-usage__sub{display:block;margin-top:.28rem;font-size:.75rem;line-height:1.35;color:#525252;font-weight:400;}" +
      ".agilo-carnet-chrome{margin:.75rem 0 0;}" +
      ".agilo-carnet-help{margin:0 0 .65rem;font-size:.82rem;line-height:1.45;color:#404040;}" +
      ".agilo-carnet-generate{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem .75rem;margin:.7rem 0 0;}" +
      ".agilo-carnet-generate__btn{appearance:none;border:1.5px solid #d4d4d4;background:#f5f5f5;color:#737373;border-radius:10px;padding:.55rem .9rem;font-size:.88rem;font-weight:600;font-family:inherit;cursor:not-allowed;}" +
      ".agilo-chip-bientot{display:inline-flex;align-items:center;padding:.15rem .5rem;border-radius:999px;background:#eef2ff;color:var(--agilo-primary,#174a96);font-size:.72rem;font-weight:700;letter-spacing:.02em;}" +
      ".agilo-carnet-generate a{font-size:.82rem;color:var(--agilo-primary,#174a96);}" +
      ".agilo-carnet-error{min-height:1.1rem;margin:.45rem 0 0;font-size:.8rem;line-height:1.35;color:#b42318;}" +
      "#live-streaming-panel.is-carnet #agilo-copy-btn{background:var(--agilo-primary,#174a96);color:#fff;border-color:var(--agilo-primary,#174a96);}" +
      "#live-streaming-panel.is-carnet #agilo-copy-btn svg{fill:currentColor;}";
    document.head.appendChild(style);
  }

  function mesTranscriptsHref() {
    var m = String((global.location && location.pathname) || "").match(/^\/app\/([^/]+)/);
    if (m && m[1]) return "/app/" + m[1] + "/mes-transcripts";
    var ed = String(global.edition || "").toLowerCase();
    if (ed === "free" || ed === "gratuit") return "/app/free/mes-transcripts";
    if (ed === "pro" || ed === "premium") return "/app/premium/mes-transcripts";
    return "/app/business/mes-transcripts";
  }

  function setBtnSelected(root, usage) {
    if (!root) return;
    var btns = root.querySelectorAll("[data-agilo-usage]");
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute("data-agilo-usage") === usage;
      btns[i].setAttribute("aria-selected", on ? "true" : "false");
    }
  }

  function setSwitchDisabled(disabled) {
    var root = document.getElementById("agilo-dictee-usage");
    if (!root) return;
    var btns = root.querySelectorAll("[data-agilo-usage]");
    for (var i = 0; i < btns.length; i++) btns[i].disabled = !!disabled;
  }

  function applyCopyLabel() {
    var el = document.getElementById("agilo-copy-btn-text");
    if (el) el.textContent = state.usage === "carnet" ? "Copier le carnet" : "Copier le texte";
  }

  function applyPreviewAndNote() {
    var root = document.querySelector("[data-agilo-streaming-root]");
    if (root) root.classList.toggle("is-carnet", state.usage === "carnet");
    var preview = document.querySelector("#panel-dictee .dictee-preview-label");
    var note = document.querySelector("#panel-dictee .dictee-note");
    var help = document.getElementById("agilo-carnet-help");
    var chrome = document.getElementById("agilo-carnet-chrome");
    var isCarnet = state.usage === "carnet";
    if (preview) setWrapDisplay(preview, isCarnet);
    if (help) setWrapDisplay(help, !isCarnet);
    if (chrome) chrome.hidden = !isCarnet;
    if (note) {
      if (isCarnet) {
        note.innerHTML =
          "À chaque pause, une phrase déjà ponctuée. Relisez les noms et les chiffres. Le carnet reste si vous relancez.";
      } else {
        note.innerHTML =
          "L'audio reste en local sur votre appareil et n'est envoyé qu'à l'arrêt.<br>" +
          "Conforme RGPD (serveurs UE). Vous pouvez aussi copier le texte sans envoyer.";
      }
    }
    applyCopyLabel();
  }

  function applyDraftToTextarea() {
    var ta = document.querySelector("[data-agilo-streaming-text]");
    if (!ta) return;
    if (state.usage === "carnet") {
      var draft = readDraft(state.email);
      if (draft && !ta.value) ta.value = draft;
      ta.readOnly = false;
    }
  }

  function persistDraftFromTextarea() {
    if (state.usage !== "carnet") return;
    var ta = document.querySelector("[data-agilo-streaming-text]");
    writeDraft(state.email, ta ? ta.value : "");
  }

  function applyUsageUi() {
    setBtnSelected(document.getElementById("agilo-dictee-usage"), state.usage);
    hideGlobalOptionsIfNeeded();
    applyPreviewAndNote();
    applyDraftToTextarea();
    if (global.AgiloDicteeCarnetPicker && typeof AgiloDicteeCarnetPicker.setVisible === "function") {
      AgiloDicteeCarnetPicker.setVisible(state.usage === "carnet");
    }
  }

  function setUsage(next, persist) {
    var usage = normalizeUsage(next);
    if (state.recording && usage !== state.usage) return;
    persistDraftFromTextarea();
    state.usage = usage;
    if (persist) writeStoredUsage(state.email, usage);
    applyUsageUi();
    if (global.document) {
      document.dispatchEvent(
        new CustomEvent("agilo-dictee-usage-change", { detail: { usage: usage } })
      );
    }
  }

  function injectSwitch(panel) {
    if (document.getElementById("agilo-dictee-usage")) return;
    var timer = panel.querySelector("#agilo-streaming-timer") || document.getElementById("agilo-streaming-timer");
    var wrap = document.createElement("div");
    wrap.id = "agilo-dictee-usage";
    wrap.className = "agilo-dictee-usage";
    wrap.setAttribute("role", "tablist");
    wrap.setAttribute("aria-label", "Usage de la dictée");
    wrap.innerHTML =
      '<button type="button" class="agilo-dictee-usage__btn" role="tab" data-agilo-usage="reunion" aria-selected="true">' +
      '<span class="agilo-dictee-usage__title">Réunion</span>' +
      '<span class="agilo-dictee-usage__sub">Le texte s’écrit pendant que vous parlez. Idéal à plusieurs.</span>' +
      "</button>" +
      '<button type="button" class="agilo-dictee-usage__btn" role="tab" data-agilo-usage="carnet" aria-selected="false">' +
      '<span class="agilo-dictee-usage__title">Carnet</span>' +
      '<span class="agilo-dictee-usage__sub">À chaque pause, une phrase déjà ponctuée. Idéal dicté seul.</span>' +
      "</button>";
    if (timer && timer.parentNode) {
      timer.parentNode.insertBefore(wrap, timer);
    } else {
      panel.insertBefore(wrap, panel.firstChild);
    }
    wrap.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-agilo-usage]");
      if (!btn || btn.disabled) return;
      setUsage(btn.getAttribute("data-agilo-usage"), true);
    });
  }

  function injectCarnetChrome(panel) {
    if (document.getElementById("agilo-carnet-chrome")) return;
    var ta = panel.querySelector("[data-agilo-streaming-text]");
    var chrome = document.createElement("div");
    chrome.id = "agilo-carnet-chrome";
    chrome.className = "agilo-carnet-chrome";
    chrome.hidden = true;
    chrome.innerHTML =
      '<p id="agilo-carnet-help" class="agilo-carnet-help">À chaque pause, une phrase déjà ponctuée. Relisez les noms et les chiffres. Le carnet reste si vous relancez.</p>' +
      '<div id="agilo-carnet-picker-host"></div>' +
      '<p id="agilo-carnet-error" class="agilo-carnet-error" role="status" aria-live="polite"></p>' +
      '<div class="agilo-carnet-generate">' +
      '<button type="button" class="agilo-carnet-generate__btn" disabled>Générer le document</button>' +
      '<span class="agilo-chip-bientot">Bientôt</span>' +
      '<a id="agilo-carnet-mes-fichiers" href="' +
      mesTranscriptsHref() +
      '">Mes fichiers</a>' +
      "</div>";
    if (ta && ta.parentNode) {
      if (ta.nextSibling) ta.parentNode.insertBefore(chrome, ta.nextSibling);
      else ta.parentNode.appendChild(chrome);
    } else {
      panel.appendChild(chrome);
    }
  }

  function bindTextareaDraft(panel) {
    var ta = panel.querySelector("[data-agilo-streaming-text]");
    if (!ta || ta.dataset.agiloCarnetDraftBound) return;
    ta.dataset.agiloCarnetDraftBound = "1";
    var t = null;
    ta.addEventListener("input", function () {
      if (state.usage !== "carnet") return;
      if (t) clearTimeout(t);
      t = setTimeout(function () {
        writeDraft(state.email, ta.value);
      }, 400);
    });
  }

  function bindSourceTabs() {
    document.addEventListener(
      "click",
      function (e) {
        if (!e.target.closest(".source-tab")) return;
        setTimeout(hideGlobalOptionsIfNeeded, 0);
        setTimeout(hideGlobalOptionsIfNeeded, 50);
      },
      false
    );
  }

  function waitForEmail(cb) {
    var started = Date.now();
    function tick() {
      var email = readMemberEmail();
      if (email) {
        cb(email);
        return;
      }
      if (Date.now() - started >= EMAIL_WAIT_MS) {
        cb("");
        return;
      }
      setTimeout(tick, EMAIL_POLL_MS);
    }
    tick();
  }

  function mount() {
    if (state.mounted) return;
    var panel = document.getElementById("panel-dictee");
    if (!panel) return;
    ensureCss();
    injectSwitch(panel);
    injectCarnetChrome(panel);
    bindTextareaDraft(panel);
    bindSourceTabs();
    state.mounted = true;
    applyUsageUi();
    waitForEmail(function (email) {
      state.email = email;
      if (email) {
        state.usage = readStoredUsage(email);
        applyUsageUi();
      } else {
        state.usage = DEFAULT_USAGE;
        applyUsageUi();
      }
    });
  }

  function setCarnetError(msg) {
    var el = document.getElementById("agilo-carnet-error");
    if (el) el.textContent = msg || "";
  }

  global.AgiloDicteeUsages = {
    USAGE_PREFIX: USAGE_PREFIX,
    DRAFT_PREFIX: DRAFT_PREFIX,
    DEFAULT_USAGE: DEFAULT_USAGE,
    normalizeUsage: normalizeUsage,
    readMemberEmail: readMemberEmail,
    usageKey: usageKey,
    draftKey: draftKey,
    promptKey: promptKey,
    recentsKey: recentsKey,
    shouldHideGlobalOptions: shouldHideGlobalOptions,
    hideGlobalOptionsIfNeeded: hideGlobalOptionsIfNeeded,
    getUsage: function () {
      return state.usage;
    },
    getEmail: function () {
      return state.email || readMemberEmail();
    },
    setUsage: setUsage,
    readDraft: readDraft,
    writeDraft: writeDraft,
    persistDraftFromTextarea: persistDraftFromTextarea,
    setCarnetError: setCarnetError,
    onVoiceStatus: function (status) {
      var rec =
        status === "recording" ||
        status === "connecting" ||
        status === "initializing" ||
        status === "pausing" ||
        status === "paused" ||
        status === "uploading";
      state.recording = rec;
      setSwitchDisabled(rec);
    },
    applyUsageUi: applyUsageUi,
    mount: mount
  };
})(typeof window !== "undefined" ? window : globalThis);
