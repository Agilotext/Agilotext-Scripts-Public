/**
 * Agilotext Free — essai quotidien reconnaissance d’intervenants
 * 1 essai / membre / jour (Europe/Paris). Garde client uniquement.
 *
 * Probe 2026-09-03 :
 * - getJobsInfo expose jobId, filename, creationDate|dtCreation, statuts, promptId.
 *   Aucun champ timestampTranscript / speakersExpected. Réconciliation seulement
 *   via un jobId déjà marqué, jamais un comptage des jobs du jour.
 * - Lock publié : lockFreeCheckbox() dans free_v2.js (pas un embed Webflow).
 * - #toggle-speakers vit dans COMP-Options_wrapper (symbole partagé).
 *
 * Version : 1.0.0
 */
(function (root) {
  "use strict";

  var VERSION = "1.0.0";
  var STORAGE_PREFIX = "agilo_free_speaker_trial:";
  var CHANNEL_NAME = "agilo-free-speaker-trial";
  var LOCK_NAME = "agilo-free-speaker-trial";
  var PENDING_TTL_MS = 15 * 60 * 1000;
  var HINT_ID = "agilo-speaker-trial-hint";
  var MS_PRICE_PRO = "prc_pro-qn9f07eb";
  var CERTAIN_API_ERRORS = [
    "error_audio_format_not_supported",
    "error_max_file_size_exceeded",
    "error_duration_is_too_long_for_summary",
    "error_duration_is_too_long",
    "error_max_duration_exceeded",
    "error_audio_file_not_found",
    "error_invalid_token",
    "error_too_many_hours_for_last_30_days",
    "error_account_pending_validation",
    "error_limit_reached_for_user",
    "error_quota_exceeded",
    "error_pro_quota_exceeded",
    "error_subscription_quota",
    "error_plan_limit_reached",
    "error_subscription_limit",
    "error_limit_reached",
    "error_invalid_audio_file_content",
    "error_silent_audio_file",
    "error_transcript_too_long_for_summary",
    "error_too_many_devices_used_for_account",
    "error_too_many_calls",
    "error_too_much_traffic",
    "ERROR_CANNOT_DONWLOAD_YOUTUBE_URL",
    "ERROR_CANNOT_DOWNLOAD_YOUTUBE_URL",
    "ERROR_INVALID_YOUTUBE_URL",
    "speaker_trial_blocked"
  ];

  function parisDay(date, timeZone) {
    var d = date instanceof Date ? date : new Date(date);
    var tz = timeZone || "Europe/Paris";
    var fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return fmt.format(d);
  }

  function parseJobDateMs(raw) {
    if (raw == null || raw === "") return null;
    var s = String(raw).trim();
    var m = s.match(/^(\d{2})-(\d{2})-(\d{4})(?:[ T](\d{2}):(\d{2}):(\d{2}))?$/);
    if (m) {
      var iso = m[3] + "-" + m[2] + "-" + m[1] + "T" + (m[4] || "00") + ":" + (m[5] || "00") + ":" + (m[6] || "00");
      var asLocal = new Date(iso);
      return isNaN(asLocal.getTime()) ? null : asLocal.getTime();
    }
    var isoDate = new Date(s);
    return isNaN(isoDate.getTime()) ? null : isoDate.getTime();
  }

  function storageKey(memberId, day) {
    return STORAGE_PREFIX + String(memberId || "") + ":" + String(day || "");
  }

  function effectiveStatus(record, memberId, day) {
    if (!record || record.memberId !== memberId || record.parisDay !== day) return "available";
    if (record.status === "pending" || record.status === "used" || record.status === "uncertain") {
      return record.status;
    }
    return "available";
  }

  function makeRequestId(now) {
    return "fst-" + String(now) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function decideReserve(record, memberId, day, now, source) {
    var status = effectiveStatus(record, memberId, day);
    if (status === "used" || status === "pending" || status === "uncertain") {
      return { ok: false, reason: status, status: status };
    }
    var requestId = makeRequestId(now);
    return {
      ok: true,
      requestId: requestId,
      next: {
        version: 1,
        memberId: memberId,
        parisDay: day,
        status: "pending",
        source: source || "upload",
        requestId: requestId,
        jobId: "",
        reservedAt: now,
        knownJobIds: []
      }
    };
  }

  function applyCommit(record, jobId, requestId) {
    if (!record) return null;
    if (requestId && record.requestId && record.requestId !== requestId) return record;
    var next = Object.assign({}, record);
    next.status = "used";
    next.jobId = String(jobId || record.jobId || "");
    return next;
  }

  function applyRelease(record, requestId) {
    if (!record) return null;
    if (record.status === "used") return record;
    if (requestId && record.requestId && record.requestId !== requestId) return record;
    return null;
  }

  function applyUncertain(record, requestId) {
    if (!record) return null;
    if (record.status === "used") return record;
    if (requestId && record.requestId && record.requestId !== requestId) return record;
    var next = Object.assign({}, record);
    next.status = "uncertain";
    return next;
  }

  function findReconcileJob(jobs, knownJobIds, reservedAt) {
    var known = {};
    (knownJobIds || []).forEach(function (id) {
      if (id) known[String(id)] = true;
    });
    var candidates = [];
    (jobs || []).forEach(function (job) {
      if (!job || !job.jobId) return;
      var id = String(job.jobId);
      if (known[id]) return;
      var ms = parseJobDateMs(job.dtCreation || job.creationDate);
      if (ms == null) return;
      if (typeof reservedAt === "number" && ms + 2000 < reservedAt) return;
      candidates.push({ jobId: id, ms: ms });
    });
    candidates.sort(function (a, b) { return a.ms - b.ms; });
    return candidates[0] || null;
  }

  function isCertainApiErrorMessage(message) {
    var em = String(message || "");
    if (!em) return false;
    for (var i = 0; i < CERTAIN_API_ERRORS.length; i += 1) {
      if (em.indexOf(CERTAIN_API_ERRORS[i]) !== -1) return true;
    }
    return false;
  }

  function isCertainRejection(err, data) {
    if (data && data.status && data.status !== "OK") {
      if (isCertainApiErrorMessage(data.errorMessage)) return true;
      if (data.errorMessage) return true;
    }
    if (!err) return false;
    if (err === "speaker_trial_blocked" || (err && err.message === "speaker_trial_blocked")) return true;
    var type = err.type || "";
    if (type === "timeout" || type === "offline" || type === "unreachable" || type === "serverError") return false;
    if (type === "invalidToken") return true;
    if (type === "httpError") {
      var status = Number(err.status || 0);
      if (status === 408 || status === 429) return false;
      if (status >= 400 && status < 500) return true;
      return false;
    }
    if (isCertainApiErrorMessage(err.message || err.errorMessage || err)) return true;
    return false;
  }

  function wrapStorage(raw) {
    return {
      get: function (key) {
        try {
          var value = raw && raw.getItem ? raw.getItem(key) : (raw ? raw[key] : null);
          if (!value) return null;
          return typeof value === "string" ? JSON.parse(value) : value;
        } catch (e) {
          return null;
        }
      },
      set: function (key, val) {
        var serialized = JSON.stringify(val);
        if (raw && raw.setItem) raw.setItem(key, serialized);
        else if (raw) raw[key] = serialized;
      },
      remove: function (key) {
        if (raw && raw.removeItem) raw.removeItem(key);
        else if (raw) delete raw[key];
      }
    };
  }

  function createMemoryStore(map) {
    var data = map || {};
    return wrapStorage({
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
      setItem: function (k, v) { data[k] = v; },
      removeItem: function (k) { delete data[k]; }
    });
  }

  function createCore(opts) {
    opts = opts || {};
    var store = opts.store || createMemoryStore();
    var nowFn = opts.now || function () { return Date.now(); };
    var dayFn = opts.parisDay || parisDay;
    var getMemberId = opts.getMemberId || function () { return ""; };
    var withLock = opts.withLock || function (fn) { return Promise.resolve().then(fn); };
    var broadcast = opts.broadcast || function () {};
    var fetchJobs = opts.fetchJobs || null;
    var ttl = typeof opts.pendingTtlMs === "number" ? opts.pendingTtlMs : PENDING_TTL_MS;
    var onChange = opts.onChange || function () {};

    function currentDay() {
      return dayFn(new Date(nowFn()));
    }

    function read(memberId, day) {
      return store.get(storageKey(memberId, day));
    }

    function write(memberId, day, record) {
      var key = storageKey(memberId, day);
      if (!record) store.remove(key);
      else store.set(key, record);
      broadcast(record);
      onChange(normalize(record, memberId, day));
    }

    function normalize(record, memberId, day) {
      var status = effectiveStatus(record, memberId, day);
      return {
        version: VERSION,
        status: status,
        memberId: memberId || "",
        parisDay: day || "",
        source: record && record.source || "",
        requestId: record && record.requestId || "",
        jobId: record && record.jobId || "",
        reservedAt: record && record.reservedAt || 0
      };
    }

    function getState() {
      var memberId = getMemberId();
      var day = currentDay();
      return normalize(read(memberId, day), memberId, day);
    }

    function reserve(input) {
      var source = (input && input.source) || "upload";
      var knownJobIds = (input && input.knownJobIds) || [];
      return withLock(function () {
        var memberId = getMemberId();
        if (!memberId) {
          return { ok: false, reason: "no_member", status: "available" };
        }
        var day = currentDay();
        var decided = decideReserve(read(memberId, day), memberId, day, nowFn(), source);
        if (!decided.ok) return decided;
        decided.next.knownJobIds = knownJobIds.slice();
        write(memberId, day, decided.next);
        return {
          ok: true,
          requestId: decided.requestId,
          status: "pending",
          source: source,
          memberId: memberId,
          parisDay: day
        };
      });
    }

    function commit(jobId, input) {
      return withLock(function () {
        var memberId = getMemberId();
        var day = currentDay();
        var next = applyCommit(read(memberId, day), jobId, input && input.requestId);
        if (next) write(memberId, day, next);
        return normalize(next, memberId, day);
      });
    }

    function release(input) {
      return withLock(function () {
        var memberId = getMemberId();
        var day = currentDay();
        var next = applyRelease(read(memberId, day), input && input.requestId);
        write(memberId, day, next);
        return normalize(next, memberId, day);
      });
    }

    function markUncertain(input) {
      return withLock(function () {
        var memberId = getMemberId();
        var day = currentDay();
        var next = applyUncertain(read(memberId, day), input && input.requestId);
        if (next) write(memberId, day, next);
        return normalize(next, memberId, day);
      });
    }

    function reconcile(jobs) {
      return withLock(function () {
        var memberId = getMemberId();
        var day = currentDay();
        var record = read(memberId, day);
        var status = effectiveStatus(record, memberId, day);
        if (status !== "pending" && status !== "uncertain") {
          return normalize(record, memberId, day);
        }
        var found = findReconcileJob(jobs || [], record.knownJobIds, record.reservedAt);
        if (found) {
          var used = applyCommit(record, found.jobId, record.requestId);
          write(memberId, day, used);
          return normalize(used, memberId, day);
        }
        if (nowFn() - (record.reservedAt || 0) >= ttl) {
          write(memberId, day, null);
          return normalize(null, memberId, day);
        }
        return normalize(record, memberId, day);
      });
    }

    function snapshotAndReserve(input) {
      var source = (input && input.source) || "upload";
      if (!fetchJobs) return reserve({ source: source, knownJobIds: [] });
      return Promise.resolve()
        .then(function () { return fetchJobs(); })
        .catch(function () { return []; })
        .then(function (jobs) {
          var ids = (jobs || []).map(function (j) { return j && j.jobId; }).filter(Boolean);
          return reserve({ source: source, knownJobIds: ids });
        });
    }

    return {
      getState: getState,
      reserve: snapshotAndReserve,
      reserveNow: reserve,
      commit: commit,
      release: release,
      markUncertain: markUncertain,
      reconcile: reconcile
    };
  }

  var api = {
    VERSION: VERSION,
    parisDay: parisDay,
    parseJobDateMs: parseJobDateMs,
    storageKey: storageKey,
    effectiveStatus: effectiveStatus,
    decideReserve: decideReserve,
    applyCommit: applyCommit,
    applyRelease: applyRelease,
    applyUncertain: applyUncertain,
    findReconcileJob: findReconcileJob,
    isCertainRejection: isCertainRejection,
    isCertainApiErrorMessage: isCertainApiErrorMessage,
    wrapStorage: wrapStorage,
    createMemoryStore: createMemoryStore,
    createCore: createCore,
    PENDING_TTL_MS: PENDING_TTL_MS
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.AgiloFreeSpeakerTrialCore = api;

  if (typeof document === "undefined") return;

  function isFreeContext() {
    if (root.__AGILO_SPEAKER_TRIAL_OFF) return false;
    if (root.edition && root.edition !== "free") return false;
    var path = (root.location && root.location.pathname) || "";
    if (path && path.indexOf("/app/free/") === -1) return false;
    return true;
  }

  function readMemberId() {
    var input = document.querySelector('input[name="memberId"]');
    if (input) {
      var fromInput = String(input.value || input.getAttribute("src") || input.getAttribute("data-src") || "").trim();
      if (fromInput) return fromInput;
    }
    var bound = document.querySelector('[data-ms-member="id"]');
    if (bound) {
      var fromBound = String(bound.value || bound.textContent || bound.getAttribute("src") || "").trim();
      if (fromBound) return fromBound;
    }
    try {
      var raw = localStorage.getItem("_ms-mem");
      if (raw) {
        var mem = JSON.parse(raw);
        if (mem && mem.id) return String(mem.id);
      }
    } catch (e) { /* ignore */ }
    return "";
  }

  function readMemberEmail() {
    var input = document.querySelector('input[name="memberEmail"]');
    return String((input && (input.value || input.getAttribute("src") || input.getAttribute("data-src"))) || "").trim();
  }

  function track(name, props) {
    try {
      if (root.posthog && typeof root.posthog.capture === "function") {
        root.posthog.capture(name, props || {});
      }
    } catch (e) { /* ignore */ }
  }

  function showUpgrade(source) {
    track("free_speaker_trial_upgrade_clicked", { source: source || "" });
    if (root.AgiloGate && typeof root.AgiloGate.showUpgrade === "function") {
      root.AgiloGate.showUpgrade("pro", "Reconnaissance des intervenants");
      return;
    }
    if (root.AgiloFreeUpgrade && typeof root.AgiloFreeUpgrade.show === "function") {
      root.AgiloFreeUpgrade.show({
        minPlan: "pro",
        reason: "Vous avez utilisé votre essai du jour pour la reconnaissance des intervenants. Passez en Pro pour l’utiliser sans limite.",
        source: "speaker_trial"
      });
      return;
    }
    var sel = '[data-ms-price\\:update="' + MS_PRICE_PRO + '"]';
    var existing = document.querySelector(sel);
    if (existing) {
      existing.click();
      return;
    }
    var link = document.querySelector('a[href*="sign-up-pro"]');
    if (link) {
      link.click();
      return;
    }
    root.location.href = "/auth/sign-up-pro";
  }

  function setToggleVisual(checkbox, checked) {
    if (!checkbox) return;
    checkbox.checked = !!checked;
    var rootEl = checkbox.closest(".checkbox-component, .w-checkbox, label") || checkbox.parentElement;
    if (!rootEl) return;
    rootEl.querySelectorAll(".checkbox_toggle, .w-checkbox-input").forEach(function (visual) {
      visual.classList.toggle("w--redirected-checked", !!checked);
      visual.classList.toggle("checked", !!checked);
      visual.classList.toggle("unchecked", !checked);
    });
  }

  function syncSpeakersSelect(visible) {
    var select = document.getElementById("speakers-select");
    var wrap = document.querySelector(".select-container.diarization");
    if (wrap) wrap.style.display = visible ? "block" : "none";
    if (select) {
      select.style.pointerEvents = visible ? "" : "none";
      if (visible) {
        select.removeAttribute("aria-disabled");
        select.removeAttribute("tabindex");
      } else {
        select.setAttribute("aria-disabled", "true");
        select.setAttribute("tabindex", "-1");
      }
    }
  }

  function ensureHint() {
    var existing = document.getElementById(HINT_ID);
    if (existing) return existing;
    var hint = document.createElement("p");
    hint.id = HINT_ID;
    hint.setAttribute("role", "status");
    hint.style.cssText = "margin:.35rem 0 0;font-size:.78rem;line-height:1.4;color:#5d2de6;";
    var host =
      document.querySelector('[data-visual-for="toggle-speakers"]') ||
      (document.getElementById("toggle-speakers") &&
        document.getElementById("toggle-speakers").closest(".checkbox-component, .w-checkbox, label")) ||
      document.querySelector(".select-container.diarization");
    if (host && host.parentElement) host.parentElement.insertBefore(hint, host.nextSibling);
    else if (host) host.appendChild(hint);
    else document.body.appendChild(hint);
    return hint;
  }

  function hintText(status) {
    if (status === "pending" || status === "uncertain") return "Essai en cours d’envoi";
    if (status === "used") return "Essai du jour utilisé";
    return "1 essai gratuit par jour";
  }

  function defaultFetchJobs() {
    var email = readMemberEmail();
    var token = root.globalToken;
    var edition = root.edition || "free";
    if (!email || !token) return Promise.resolve([]);
    var url =
      "https://api.agilotext.com/api/v1/getJobsInfo?username=" +
      encodeURIComponent(email) +
      "&token=" +
      encodeURIComponent(token) +
      "&edition=" +
      encodeURIComponent(edition) +
      "&limit=20&offset=0";
    return fetch(url, { credentials: "omit", cache: "no-store" })
      .then(function (res) { return res.json(); })
      .then(function (data) { return (data && data.jobsInfoDtos) || []; })
      .catch(function () { return []; });
  }

  function withWebLock(fn) {
    if (root.navigator && root.navigator.locks && typeof root.navigator.locks.request === "function") {
      return root.navigator.locks.request(LOCK_NAME, fn);
    }
    return Promise.resolve().then(fn);
  }

  var channel = null;
  try {
    if (typeof BroadcastChannel !== "undefined") channel = new BroadcastChannel(CHANNEL_NAME);
  } catch (e) {
    channel = null;
  }

  var core = null;
  var booted = false;
  var trackedAvailable = false;
  var lastSource = "";

  function broadcast(record) {
    try {
      if (channel) channel.postMessage({ type: "sync", status: record && record.status || "available" });
    } catch (e) { /* ignore */ }
  }

  function refreshUi() {
    if (!isFreeContext() || !core) return;
    var state = core.getState();
    var checkbox = document.getElementById("toggle-speakers");
    var hint = ensureHint();
    hint.textContent = hintText(state.status);
    if (!checkbox) return;

    var wrap = checkbox.closest(".checkbox-component, .w-checkbox, label") || checkbox.parentElement;
    if (state.status === "available") {
      checkbox.removeAttribute("aria-disabled");
      if (wrap) wrap.removeAttribute("aria-disabled");
      syncSpeakersSelect(!!checkbox.checked);
      return;
    }

    checkbox.setAttribute("aria-disabled", "true");
    if (wrap) wrap.setAttribute("aria-disabled", "true");
    setToggleVisual(checkbox, false);
    syncSpeakersSelect(false);
    try {
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (e) { /* ignore */ }
  }

  function interceptToggle(event) {
    if (!core || !isFreeContext()) return;
    var state = core.getState();
    if (state.status === "available") return;
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    }
    setToggleVisual(document.getElementById("toggle-speakers"), false);
    syncSpeakersSelect(false);
    if (state.status === "used") showUpgrade(state.source || lastSource);
    if (state.status === "pending" || state.status === "uncertain") {
      var hint = ensureHint();
      hint.textContent = hintText(state.status);
    }
  }

  function bindUi() {
    if (bindUi.done) return;
    bindUi.done = true;
    var checkbox = document.getElementById("toggle-speakers");
    var visual = document.querySelector('[data-visual-for="toggle-speakers"]');
    var wrap = checkbox && (checkbox.closest(".checkbox-component, .w-checkbox, label") || checkbox.parentElement);
    [checkbox, visual, wrap].forEach(function (el) {
      if (!el) return;
      el.addEventListener("click", interceptToggle, true);
      el.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") interceptToggle(event);
      }, true);
    });
    if (checkbox) {
      checkbox.addEventListener("change", function () {
        if (!core) return;
        var state = core.getState();
        if (state.status !== "available") {
          setToggleVisual(checkbox, false);
          syncSpeakersSelect(false);
          return;
        }
        syncSpeakersSelect(!!checkbox.checked);
      });
    }
  }

  function boot() {
    if (booted || !isFreeContext()) return;
    booted = true;
    core = createCore({
      store: wrapStorage(root.localStorage),
      getMemberId: readMemberId,
      withLock: withWebLock,
      broadcast: broadcast,
      fetchJobs: defaultFetchJobs,
      onChange: function () { refreshUi(); }
    });
    bindUi();
    refreshUi();
    if (!trackedAvailable && core.getState().status === "available") {
      trackedAvailable = true;
      track("free_speaker_trial_available", { source: "init" });
    }
    Promise.resolve(core.reconcile([])).then(function () {
      return defaultFetchJobs().then(function (jobs) {
        if (jobs && jobs.length) return core.reconcile(jobs);
      });
    }).then(function () { refreshUi(); }).catch(function () { refreshUi(); });
  }

  function publicReserve(input) {
    if (!isFreeContext()) return Promise.resolve({ ok: true, skipped: true, requestId: "" });
    if (!core) boot();
    lastSource = (input && input.source) || "upload";
    return Promise.resolve(core.reserve(input)).then(function (result) {
      refreshUi();
      if (result && result.ok) {
        track("free_speaker_trial_reserved", { source: lastSource });
      } else {
        track("free_speaker_trial_blocked", { source: lastSource, reason: result && result.reason || "" });
        if (result && result.reason === "used") showUpgrade(lastSource);
      }
      return result;
    });
  }

  function publicCommit(jobId, input) {
    if (!core) return Promise.resolve(null);
    return Promise.resolve(core.commit(jobId, input)).then(function (state) {
      refreshUi();
      track("free_speaker_trial_used", { source: (input && input.source) || lastSource || "" });
      return state;
    });
  }

  function publicRelease(input) {
    if (!core) return Promise.resolve(null);
    return Promise.resolve(core.release(input)).then(function (state) {
      refreshUi();
      return state;
    });
  }

  function publicUncertain(input) {
    if (!core) return Promise.resolve(null);
    return Promise.resolve(core.markUncertain(input)).then(function (state) {
      refreshUi();
      return state;
    });
  }

  root.AgiloFreeSpeakerTrial = {
    init: boot,
    getState: function () { return core ? core.getState() : { status: "available" }; },
    reserve: publicReserve,
    commit: publicCommit,
    release: publicRelease,
    markUncertain: publicUncertain,
    refreshUi: refreshUi,
    showUpgrade: showUpgrade,
    isCertainRejection: isCertainRejection,
    readIntent: function (sourceHint) {
      var checkbox = document.getElementById("toggle-speakers");
      var select = document.getElementById("speakers-select");
      var session = document.querySelector('input[name="agilo_record_session_id"]');
      var source = sourceHint || (session && session.value ? "recording" : "upload");
      return {
        speakers: !!(checkbox && checkbox.checked),
        speakersExpected: select ? String(select.value || "") : "",
        source: source
      };
    }
  };

  function start() {
    if (!isFreeContext()) return;
    boot();
    [350, 1100].forEach(function (ms) {
      setTimeout(function () {
        boot();
        refreshUi();
      }, ms);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  if (channel) {
    channel.onmessage = function () { refreshUi(); };
  }
  root.addEventListener("storage", function (event) {
    if (event && event.key && String(event.key).indexOf(STORAGE_PREFIX) === 0) refreshUi();
  });
})(typeof window !== "undefined" ? window : globalThis);
