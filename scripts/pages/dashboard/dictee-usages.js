/**
 * Dictée dashboard : usages Réunion / Carnet.
 * Persist localStorage agilotext:dicteeUsage:{email} après hydratation Memberstack.
 * Masque options globaux seulement si onglet Dictée + Carnet (wrapper aussi utilisé par Fichier).
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
  var PLACEHOLDER_CARNET =
    "Le texte ponctué s’ajoute ici à chaque pause. Vous pouvez corriger avant de copier.";
  var PLACEHOLDER_REUNION =
    "La transcription apparaîtra ici dès que vous commencerez à parler...";

  var NUCLEO = {
    meeting:
      '<path d="M5.75 8.25049C6.8546 8.25049 7.75 7.35549 7.75 6.25049C7.75 5.14549 6.8546 4.25049 5.75 4.25049C4.6454 4.25049 3.75 5.14549 3.75 6.25049C3.75 7.35549 4.6454 8.25049 5.75 8.25049Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M9.60903 15.1225C10.132 14.9475 10.439 14.3785 10.245 13.8635C9.56003 12.0455 7.80903 10.7515 5.75103 10.7515C3.69303 10.7515 1.94203 12.0455 1.25703 13.8635C1.06303 14.3795 1.37003 14.9485 1.89303 15.1225C2.85503 15.4435 4.17403 15.7505 5.75203 15.7505C7.33003 15.7505 8.64803 15.4435 9.60903 15.1225Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M12 5.75049C13.1046 5.75049 14 4.85549 14 3.75049C14 2.64549 13.1046 1.75049 12 1.75049C10.8954 1.75049 10 2.64549 10 3.75049C10 4.85549 10.8954 5.75049 12 5.75049Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M13.154 13.1873C14.2224 13.0845 15.1437 12.8614 15.858 12.6226C16.381 12.4476 16.688 11.8785 16.494 11.3636C15.809 9.54549 14.058 8.2515 12 8.2515C11.1608 8.2515 10.379 8.4771 9.69287 8.8555" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    document:
      '<line x1="5.75" y1="6.75" x2="7.75" y2="6.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><line x1="5.75" y1="9.75" x2="12.25" y2="9.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><line x1="5.75" y1="12.75" x2="12.25" y2="12.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><path d="M2.75,14.25V3.75c0-1.105,.895-2,2-2h5.586c.265,0,.52,.105,.707,.293l3.914,3.914c.188,.188,.293,.442,.293,.707v7.586c0,1.105-.895,2-2,2H4.75c-1.105,0-2-.895-2-2Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><path d="M15.16,6.25h-3.41c-.552,0-1-.448-1-1V1.852" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
    sparkle:
      '<path d="M6.65802 4.02597L5.39502 3.60495L4.97402 2.34195C4.83702 1.93395 4.16202 1.93395 4.02502 2.34195L3.60402 3.60495L2.34102 4.02597C2.13702 4.09397 1.99902 4.28497 1.99902 4.49997C1.99902 4.71497 2.13702 4.90597 2.34102 4.97397L3.60402 5.39499L4.02502 6.65799C4.09302 6.86199 4.28502 6.99997 4.50002 6.99997C4.71502 6.99997 4.90602 6.86199 4.97502 6.65799L5.39602 5.39499L6.65902 4.97397C6.86302 4.90597 7.00102 4.71497 7.00102 4.49997C7.00102 4.28497 6.86202 4.09397 6.65802 4.02597Z" fill="currentColor"/><path d="M15.658 13.026L14.395 12.605L13.974 11.3419C13.837 10.9339 13.162 10.9339 13.025 11.3419L12.604 12.605L11.341 13.026C11.137 13.094 10.999 13.285 10.999 13.5C10.999 13.715 11.137 13.906 11.341 13.974L12.604 14.395L13.025 15.658C13.093 15.862 13.285 16 13.5 16C13.715 16 13.906 15.862 13.975 15.658L14.396 14.395L15.659 13.974C15.863 13.906 16.001 13.715 16.001 13.5C16.001 13.285 15.862 13.094 15.658 13.026Z" fill="currentColor"/><path d="M6 8.75L6.671 11.329L9.25 12L6.671 12.671L6 15.25L5.329 12.671L2.75 12L5.329 11.329L6 8.75Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 2.75L12.671 5.32898L15.25 6L12.671 6.67102L12 9.25L11.329 6.67102L8.75 6L11.329 5.32898L12 2.75Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
  };

  var state = {
    usage: DEFAULT_USAGE,
    email: "",
    recording: false,
    mounted: false
  };

  function nucleoSvg(key) {
    var Core = global.AgiloLibraryCore;
    if (Core && typeof Core.svgIcon === "function") return Core.svgIcon(key, 18);
    var inner = NUCLEO[key] || NUCLEO.document;
    return (
      '<svg class="agilo-dictee-usage__ico" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">' +
      inner +
      "</svg>"
    );
  }

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

  function hideCheckboxById(id, hide) {
    var input = document.getElementById(id);
    if (!input) return;
    var wrap =
      input.closest(".checkbox-component") ||
      input.closest("label") ||
      input.parentElement ||
      input;
    setWrapDisplay(wrap, hide);
    if (wrap !== input) setWrapDisplay(input, hide);
  }

  function hideGlobalOptionsIfNeeded() {
    var hide = shouldHideGlobalOptions();
    ["toggle-speakers", "toggle-summary", "toggle-format-transcript", "toggle-translate"].forEach(
      function (id) {
        hideCheckboxById(id, hide);
      }
    );
    ["speakers-select", "translate-select"].forEach(function (id) {
      var sel = document.getElementById(id);
      if (!sel) return;
      if (sel.closest(".checkbox-component")) return;
      setWrapDisplay(sel, hide);
      var selWrap = sel.closest(".select-wrapper") || sel.parentElement;
      if (selWrap && selWrap !== sel) setWrapDisplay(selWrap, hide);
    });

    var anchor = document.getElementById("agilo-prompt-picker-anchor");
    if (anchor) {
      var box = anchor.closest(".select-container") || anchor.closest(".wrapper-select") || anchor;
      setWrapDisplay(box, hide);
      var info = box && box.parentElement && box.parentElement.querySelector
        ? box.parentElement.querySelector(".wrapper-info")
        : null;
      if (info) setWrapDisplay(info, hide);
      var flex = box && box.closest && box.closest(".custom-select-wrapper");
      if (flex) setWrapDisplay(flex, hide);
    }

    document.querySelectorAll(".link-create-template, [data-open-wizard]").forEach(function (el) {
      setWrapDisplay(el, hide);
    });
    var createRoots = [];
    var ow = document.querySelector(".options-wrapper");
    if (ow) createRoots.push(ow);
    var panel = document.getElementById("panel-dictee");
    if (panel) createRoots.push(panel);
    createRoots.forEach(function (root) {
      root.querySelectorAll("a, button").forEach(function (el) {
        if (!el || el.id === "agilo-carnet-mes-fichiers") return;
        var t = String(el.textContent || "").replace(/\s+/g, " ").trim();
        if (t === "Créer un modèle" || t === "+ Créer un modèle") setWrapDisplay(el, hide);
      });
    });

    var wb = document.getElementById("agilo-wb-picker");
    if (wb) setWrapDisplay(wb, hide);
    document.querySelectorAll("[data-agilo-wb], .agilo-wb-picker").forEach(function (el) {
      setWrapDisplay(el, hide);
    });
  }

  function ensureCss() {
    if (document.getElementById("agilo-dictee-usage-css")) return;
    var style = document.createElement("style");
    style.id = "agilo-dictee-usage-css";
    style.textContent =
      ".agilo-dictee-usage{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin:0 0 1rem;}" +
      "@media (max-width:640px){.agilo-dictee-usage{grid-template-columns:1fr;}}" +
      ".agilo-dictee-usage__btn{appearance:none;text-align:left;cursor:pointer;border:1.5px solid #d4d4d4;background:#fff;border-radius:12px;padding:.7rem .85rem;font-family:inherit;color:#171717;transition:border-color .15s,box-shadow .15s,background .15s;}" +
      ".agilo-dictee-usage__btn[aria-selected='true']{border-color:var(--agilo-primary,#174a96);box-shadow:0 0 0 1px var(--agilo-primary,#174a96);background:#f4f7fb;}" +
      ".agilo-dictee-usage__btn:disabled{opacity:.55;cursor:not-allowed;}" +
      ".agilo-dictee-usage__head{display:flex;align-items:center;gap:.45rem;}" +
      ".agilo-dictee-usage__ico,.agilo-dictee-usage__head svg{flex:0 0 18px;color:var(--agilo-primary,#174a96);}" +
      ".agilo-dictee-usage__title{display:block;font-size:.92rem;font-weight:700;line-height:1.2;}" +
      ".agilo-dictee-usage__sub{display:block;margin-top:.28rem;font-size:.75rem;line-height:1.35;color:#525252;font-weight:400;}" +
      ".agilo-carnet-chrome{margin:0 0 .75rem;}" +
      ".agilo-carnet-help{margin:0 0 .65rem;font-size:.82rem;line-height:1.45;color:#404040;}" +
      ".agilo-carnet-generate{display:none;flex-wrap:wrap;align-items:center;gap:.4rem .65rem;margin:.75rem 0 0;color:#525252;font-size:.82rem;line-height:1.4;cursor:default;user-select:none;}" +
      "#live-streaming-panel.is-carnet .agilo-carnet-generate:not([hidden]),[data-agilo-streaming-root].is-carnet .agilo-carnet-generate:not([hidden]){display:flex;}" +
      ".agilo-carnet-generate[hidden]{display:none !important;}" +
      ".agilo-carnet-generate__ico{display:inline-flex;color:var(--agilo-primary,#174a96);}" +
      ".agilo-carnet-generate__label{font-weight:600;color:#404040;}" +
      ".agilo-chip-bientot{display:inline-flex;align-items:center;padding:.15rem .5rem;border-radius:999px;background:#eef2ff;color:var(--agilo-primary,#174a96);font-size:.72rem;font-weight:700;letter-spacing:.02em;}" +
      ".agilo-carnet-generate a{font-size:.82rem;color:var(--agilo-primary,#174a96);}" +
      ".agilo-carnet-error{min-height:1.1rem;margin:.45rem 0 0;font-size:.8rem;line-height:1.35;color:#b42318;}" +
      "#live-streaming-panel.is-carnet #agilo-copy-btn,[data-agilo-streaming-root].is-carnet #agilo-copy-btn{background:#fff !important;color:var(--agilo-primary,#174a96) !important;border:1.5px solid var(--agilo-primary,#174a96) !important;}";
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
    if (global.AgiloDicteeCarnetPicker && typeof AgiloDicteeCarnetPicker.setDisabled === "function") {
      AgiloDicteeCarnetPicker.setDisabled(!!disabled);
    }
  }

  function applyCopyLabel() {
    var el = document.getElementById("agilo-copy-btn-text");
    if (el) el.textContent = state.usage === "carnet" ? "Copier le carnet" : "Copier le texte";
  }

  function applyPlaceholder() {
    var ta = document.querySelector("[data-agilo-streaming-text]");
    if (!ta) return;
    if (!ta.dataset.agiloPhReunion) {
      ta.dataset.agiloPhReunion = ta.getAttribute("placeholder") || PLACEHOLDER_REUNION;
    }
    ta.setAttribute(
      "placeholder",
      state.usage === "carnet" ? PLACEHOLDER_CARNET : ta.dataset.agiloPhReunion
    );
  }

  function applyPreviewAndNote() {
    var root = document.querySelector("[data-agilo-streaming-root]");
    if (root) root.classList.toggle("is-carnet", state.usage === "carnet");
    var livePanel = document.getElementById("live-streaming-panel");
    if (livePanel && livePanel !== root) livePanel.classList.toggle("is-carnet", state.usage === "carnet");
    var preview = document.querySelector("#panel-dictee .dictee-preview-label");
    var note = document.querySelector("#panel-dictee .dictee-note");
    var help = document.getElementById("agilo-carnet-help");
    var chrome = document.getElementById("agilo-carnet-chrome");
    var generate = document.getElementById("agilo-carnet-generate");
    var isCarnet = state.usage === "carnet";
    if (preview) setWrapDisplay(preview, isCarnet);
    if (help) setWrapDisplay(help, !isCarnet);
    if (chrome) chrome.hidden = !isCarnet;
    if (generate) generate.hidden = !isCarnet;
    if (note) {
      if (isCarnet) setWrapDisplay(note, true);
      else {
        setWrapDisplay(note, false);
        note.innerHTML =
          "L'audio reste en local sur votre appareil et n'est envoyé qu'à l'arrêt.<br>" +
          "Conforme RGPD (serveurs UE). Vous pouvez aussi copier le texte sans envoyer.";
      }
    }
    applyCopyLabel();
    applyPlaceholder();
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
      '<span class="agilo-dictee-usage__head">' +
      nucleoSvg("meeting") +
      '<span class="agilo-dictee-usage__title">Réunion</span></span>' +
      '<span class="agilo-dictee-usage__sub">Le texte s’écrit pendant que vous parlez. Idéal à plusieurs.</span>' +
      "</button>" +
      '<button type="button" class="agilo-dictee-usage__btn" role="tab" data-agilo-usage="carnet" aria-selected="false">' +
      '<span class="agilo-dictee-usage__head">' +
      nucleoSvg("document") +
      '<span class="agilo-dictee-usage__title">Carnet</span></span>' +
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
      '<p id="agilo-carnet-error" class="agilo-carnet-error" role="status" aria-live="polite"></p>';
    if (ta && ta.parentNode) {
      ta.parentNode.insertBefore(chrome, ta);
    } else {
      panel.appendChild(chrome);
    }
  }

  function injectGenerate(panel) {
    if (document.getElementById("agilo-carnet-generate")) return;
    var gen = document.createElement("div");
    gen.id = "agilo-carnet-generate";
    gen.className = "agilo-carnet-generate";
    gen.hidden = true;
    gen.innerHTML =
      '<span class="agilo-carnet-generate__ico" aria-hidden="true">' +
      nucleoSvg("sparkle") +
      "</span>" +
      '<span class="agilo-carnet-generate__label">Générer le document</span>' +
      '<span class="agilo-chip-bientot">Bientôt</span>' +
      '<a id="agilo-carnet-mes-fichiers" href="' +
      mesTranscriptsHref() +
      '">Mes fichiers</a>';
    var copyWrap =
      panel.querySelector(".dictee-secondary-actions") ||
      (document.getElementById("agilo-copy-btn") &&
        document.getElementById("agilo-copy-btn").parentElement);
    if (copyWrap && copyWrap.parentNode) {
      if (copyWrap.nextSibling) copyWrap.parentNode.insertBefore(gen, copyWrap.nextSibling);
      else copyWrap.parentNode.appendChild(gen);
    } else {
      panel.appendChild(gen);
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
    injectGenerate(panel);
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
    PLACEHOLDER_CARNET: PLACEHOLDER_CARNET,
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
