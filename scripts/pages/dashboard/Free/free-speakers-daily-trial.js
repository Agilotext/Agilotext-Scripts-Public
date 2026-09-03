/**
 * Agilotext Free — essai quotidien reconnaissance d’intervenants
 * 1 essai / membre / jour (Europe/Paris). Garde client uniquement.
 *
 * v2.0.1 : visuels Webflow, bind unique, upsell Pro seulement si used
 * v2.0.0 : consentement armed par onglet, exclusivité format, migration v1,
 * popup de confirmation, fail-closed, TTL pending 3 h / uncertain 15 min.
 */
(function (root) {
  "use strict";

  var VERSION = "2.0.1";
  var SCHEMA_VERSION = 2;
  var STORAGE_PREFIX = "agilo_free_speaker_trial:";
  var CHANNEL_NAME = "agilo-free-speaker-trial";
  var LOCK_NAME = "agilo-free-speaker-trial";
  var LOCK_FALLBACK_KEY = "agilo_free_speaker_trial:lock";
  var PENDING_TTL_MS = 3 * 60 * 60 * 1000;
  var UNCERTAIN_TTL_MS = 15 * 60 * 1000;
  var HINT_ID = "agilo-speaker-trial-hint";
  var MODAL_ID = "agilo-speaker-trial-modal";
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

  function speakersIntent(checkboxChecked, armed) {
    return !!(checkboxChecked && armed);
  }

  function payloadInvariant(intent) {
    if (intent && intent.speakers) {
      return { timestampTranscript: true, formatTranscript: false };
    }
    return {
      timestampTranscript: false,
      formatTranscript: !!(intent && intent.formatChecked)
    };
  }

  function nextUiMode(mode, eventName) {
    if (eventName === "confirm") return "speakers";
    if (eventName === "formatOn" || eventName === "speakersOff" || eventName === "boot" || eventName === "cancel") {
      return "standard";
    }
    return mode === "speakers" ? "speakers" : "standard";
  }

  function canArm(status) {
    return status === "available";
  }

  function upsellKind(status) {
    if (status === "used") return "pro";
    if (status === "pending" || status === "uncertain") return "info";
    return "confirm";
  }

  function migrationMarkerKey(memberId, day) {
    return STORAGE_PREFIX + "migration_v2:" + String(memberId || "") + ":" + String(day || "");
  }

  function migrateV1Record(record, memberId, day, now, alreadyMigrated) {
    if (alreadyMigrated) {
      return { record: record || null, migrated: false, reset: false };
    }
    if (!record || record.memberId !== memberId || record.parisDay !== day) {
      return { record: null, migrated: false, reset: false };
    }
    if (record.version >= SCHEMA_VERSION || record.migration_v2) {
      return { record: record, migrated: false, reset: false };
    }
    if (record.status === "used") {
      return { record: null, migrated: true, reset: true };
    }
    var next = Object.assign({}, record);
    next.version = SCHEMA_VERSION;
    next.migration_v2 = true;
    var reservedAt = Number(record.reservedAt || now || 0);
    if (record.status === "pending" && !next.pendingExpiresAt) {
      next.pendingExpiresAt = reservedAt + PENDING_TTL_MS;
    }
    if (record.status === "uncertain" && !next.uncertainExpiresAt) {
      next.uncertainExpiresAt = reservedAt + UNCERTAIN_TTL_MS;
    }
    return { record: next, migrated: true, reset: false };
  }

  function isExpired(record, now) {
    if (!record) return false;
    if (record.status === "pending") {
      var pendingAt = record.pendingExpiresAt || ((record.reservedAt || 0) + PENDING_TTL_MS);
      return now >= pendingAt;
    }
    if (record.status === "uncertain") {
      var uncertainAt = record.uncertainExpiresAt || ((record.reservedAt || 0) + UNCERTAIN_TTL_MS);
      return now >= uncertainAt;
    }
    return false;
  }

  function effectiveStatus(record, memberId, day, now) {
    if (!record || record.memberId !== memberId || record.parisDay !== day) return "available";
    if (isExpired(record, typeof now === "number" ? now : Date.now())) return "available";
    if (record.status === "pending" || record.status === "used" || record.status === "uncertain") {
      return record.status;
    }
    return "available";
  }

  function makeRequestId(now) {
    return "fst-" + String(now) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function decideReserve(record, memberId, day, now, source) {
    var status = effectiveStatus(record, memberId, day, now);
    if (status === "used" || status === "pending" || status === "uncertain") {
      return { ok: false, reason: status, status: status };
    }
    var requestId = makeRequestId(now);
    return {
      ok: true,
      requestId: requestId,
      next: {
        version: SCHEMA_VERSION,
        memberId: memberId,
        parisDay: day,
        status: "pending",
        source: source || "upload",
        requestId: requestId,
        jobId: "",
        reservedAt: now,
        pendingExpiresAt: now + PENDING_TTL_MS,
        knownJobIds: [],
        migration_v2: true
      }
    };
  }

  function applyCommit(record, jobId, requestId) {
    if (!record) return null;
    if (requestId && record.requestId && record.requestId !== requestId) return record;
    var next = Object.assign({}, record);
    next.status = "used";
    next.version = SCHEMA_VERSION;
    next.migration_v2 = true;
    next.jobId = String(jobId || record.jobId || "");
    return next;
  }

  function applyRelease(record, requestId) {
    if (!record) return null;
    if (record.status === "used") return record;
    if (requestId && record.requestId && record.requestId !== requestId) return record;
    return null;
  }

  function applyUncertain(record, requestId, now) {
    if (!record) return null;
    if (record.status === "used") return record;
    if (requestId && record.requestId && record.requestId !== requestId) return record;
    var next = Object.assign({}, record);
    next.status = "uncertain";
    next.version = SCHEMA_VERSION;
    next.migration_v2 = true;
    next.uncertainExpiresAt = (typeof now === "number" ? now : Date.now()) + UNCERTAIN_TTL_MS;
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
      return isCertainApiErrorMessage(data.errorMessage);
    }
    if (!err) return false;
    if (err === "speaker_trial_blocked" || (err && err.message === "speaker_trial_blocked")) return true;
    var type = err.type || "";
    if (type === "timeout" || type === "offline" || type === "unreachable" || type === "serverError") return false;
    if (type === "invalidToken") return true;
    return isCertainApiErrorMessage(err.message || err.errorMessage || err);
  }

  function resolveFreeSpeakersPayload(trialPresent, intent, reservation) {
    var speakers = !!(
      trialPresent &&
      intent &&
      intent.speakers &&
      intent.armed &&
      reservation &&
      reservation.ok
    );
    return payloadInvariant({
      speakers: speakers,
      formatChecked: !!(intent && intent.formatChecked)
    });
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

  function createStorageLock(store, nowFn) {
    return function withLock(fn) {
      if (typeof navigator !== "undefined" && navigator.locks && typeof navigator.locks.request === "function") {
        return navigator.locks.request(LOCK_NAME, fn);
      }
      var now = nowFn();
      var current = store.get(LOCK_FALLBACK_KEY);
      if (current && current.ts && now - current.ts < 800 && current.id) {
        return new Promise(function (resolve) {
          setTimeout(function () { resolve(Promise.resolve().then(fn)); }, 50);
        });
      }
      var token = { id: makeRequestId(now), ts: now };
      store.set(LOCK_FALLBACK_KEY, token);
      return Promise.resolve().then(fn).then(function (result) {
        var after = store.get(LOCK_FALLBACK_KEY);
        if (after && after.id === token.id) store.remove(LOCK_FALLBACK_KEY);
        return result;
      }, function (err) {
        var after = store.get(LOCK_FALLBACK_KEY);
        if (after && after.id === token.id) store.remove(LOCK_FALLBACK_KEY);
        throw err;
      });
    };
  }

  function createCore(opts) {
    opts = opts || {};
    var store = opts.store || createMemoryStore();
    var nowFn = opts.now || function () { return Date.now(); };
    var dayFn = opts.parisDay || parisDay;
    var getMemberId = opts.getMemberId || function () { return ""; };
    var withLock = opts.withLock || createStorageLock(store, nowFn);
    var broadcast = opts.broadcast || function () {};
    var fetchJobs = opts.fetchJobs || null;
    var pendingTtl = typeof opts.pendingTtlMs === "number" ? opts.pendingTtlMs : PENDING_TTL_MS;
    var uncertainTtl = typeof opts.uncertainTtlMs === "number" ? opts.uncertainTtlMs : UNCERTAIN_TTL_MS;
    var onChange = opts.onChange || function () {};
    var onMigrationReset = opts.onMigrationReset || function () {};

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
      var now = nowFn();
      var status = effectiveStatus(record, memberId, day, now);
      if (record && isExpired(record, now) && (record.status === "pending" || record.status === "uncertain")) {
        status = "available";
      }
      return {
        version: VERSION,
        status: status,
        memberId: memberId || "",
        parisDay: day || "",
        source: record && record.source || "",
        requestId: record && record.requestId || "",
        jobId: record && record.jobId || "",
        reservedAt: record && record.reservedAt || 0,
        armed: false
      };
    }

    function migrateNow() {
      var memberId = getMemberId();
      var day = currentDay();
      var markerKey = migrationMarkerKey(memberId, day);
      var already = !!store.get(markerKey);
      var record = read(memberId, day);
      var result = migrateV1Record(record, memberId, day, nowFn(), already);
      if (result.migrated) {
        store.set(markerKey, { done: true, reset: !!result.reset, at: nowFn() });
        write(memberId, day, result.record);
        if (result.reset) onMigrationReset({ memberId: memberId, parisDay: day });
      }
      return result;
    }

    function expireIfNeeded(memberId, day, record) {
      if (record && isExpired(record, nowFn()) && record.status !== "used") {
        write(memberId, day, null);
        return null;
      }
      return record;
    }

    function getState() {
      migrateNow();
      var memberId = getMemberId();
      var day = currentDay();
      var record = expireIfNeeded(memberId, day, read(memberId, day));
      return normalize(record, memberId, day);
    }

    function reserve(input) {
      var source = (input && input.source) || "upload";
      var knownJobIds = (input && input.knownJobIds) || [];
      return withLock(function () {
        migrateNow();
        var memberId = getMemberId();
        if (!memberId) {
          return { ok: false, reason: "no_member", status: "available" };
        }
        var day = currentDay();
        var record = expireIfNeeded(memberId, day, read(memberId, day));
        var decided = decideReserve(record, memberId, day, nowFn(), source);
        if (!decided.ok) return decided;
        decided.next.knownJobIds = knownJobIds.slice();
        if (typeof opts.pendingTtlMs === "number") {
          decided.next.pendingExpiresAt = nowFn() + pendingTtl;
        }
        write(memberId, day, decided.next);
        var verify = read(memberId, day);
        if (!verify || verify.requestId !== decided.requestId) {
          return { ok: false, reason: "state_conflict", status: verify && verify.status || "pending" };
        }
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
        var next = applyUncertain(read(memberId, day), input && input.requestId, nowFn());
        if (next) {
          if (typeof opts.uncertainTtlMs === "number") {
            next.uncertainExpiresAt = nowFn() + uncertainTtl;
          }
          write(memberId, day, next);
        }
        return normalize(next, memberId, day);
      });
    }

    function reconcile(jobs) {
      return withLock(function () {
        migrateNow();
        var memberId = getMemberId();
        var day = currentDay();
        var record = expireIfNeeded(memberId, day, read(memberId, day));
        var status = effectiveStatus(record, memberId, day, nowFn());
        if (status !== "pending" && status !== "uncertain") {
          return normalize(record, memberId, day);
        }
        var found = findReconcileJob(jobs || [], record.knownJobIds, record.reservedAt);
        if (found) {
          var used = applyCommit(record, found.jobId, record.requestId);
          write(memberId, day, used);
          return normalize(used, memberId, day);
        }
        if (isExpired(record, nowFn())) {
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
      reconcile: reconcile,
      migrateNow: migrateNow
    };
  }

  var api = {
    VERSION: VERSION,
    SCHEMA_VERSION: SCHEMA_VERSION,
    parisDay: parisDay,
    parseJobDateMs: parseJobDateMs,
    storageKey: storageKey,
    speakersIntent: speakersIntent,
    payloadInvariant: payloadInvariant,
    nextUiMode: nextUiMode,
    canArm: canArm,
    upsellKind: upsellKind,
    migrateV1Record: migrateV1Record,
    migrationMarkerKey: migrationMarkerKey,
    effectiveStatus: effectiveStatus,
    decideReserve: decideReserve,
    applyCommit: applyCommit,
    applyRelease: applyRelease,
    applyUncertain: applyUncertain,
    findReconcileJob: findReconcileJob,
    isCertainRejection: isCertainRejection,
    isCertainApiErrorMessage: isCertainApiErrorMessage,
    resolveFreeSpeakersPayload: resolveFreeSpeakersPayload,
    wrapStorage: wrapStorage,
    createMemoryStore: createMemoryStore,
    createCore: createCore,
    PENDING_TTL_MS: PENDING_TTL_MS,
    UNCERTAIN_TTL_MS: UNCERTAIN_TTL_MS
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

  function optionWrap(checkbox) {
    if (!checkbox) return null;
    return checkbox.closest(".checkbox-component, .w-checkbox, label") || checkbox.parentElement;
  }

  function paintToggle(checkbox, checked) {
    if (!checkbox) return;
    checkbox.checked = !!checked;
    var rootEl = optionWrap(checkbox);
    if (!rootEl) return;
    rootEl.querySelectorAll(".checkbox_toggle, .w-checkbox-input").forEach(function (visual) {
      if (visual.tagName === "INPUT") {
        visual.checked = !!checked;
        return;
      }
      visual.classList.toggle("w--redirected-checked", !!checked);
      visual.classList.toggle("checked", !!checked);
      visual.classList.toggle("unchecked", !checked);
    });
  }

  function setNativeToggle(checkbox, checked) {
    paintToggle(checkbox, checked);
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(function () { paintToggle(checkbox, checked); });
    }
  }

  var isApplyingMode = false;
  var armed = false;
  var lastSource = "";
  var lastFocus = null;
  var lastGestureAt = 0;
  var core = null;
  var booted = false;
  var trackedAvailable = false;

  function speakersCheckbox() {
    return document.getElementById("toggle-speakers");
  }

  function formatCheckbox() {
    return document.getElementById("toggle-format-transcript");
  }

  function speakersWrap() {
    return optionWrap(speakersCheckbox());
  }

  function formatWrap() {
    return optionWrap(formatCheckbox());
  }

  function toggleVisual(wrap) {
    if (!wrap) return null;
    return wrap.querySelector(".checkbox_toggle") || wrap.querySelector("[data-visual-for]");
  }

  function bindRoot(wrap, checkbox) {
    var visual = toggleVisual(wrap);
    if (wrap && visual && wrap.contains(visual)) return wrap;
    return visual || checkbox || wrap;
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

  function quotaStatus() {
    return core ? core.getState().status : "available";
  }

  function applyOptionMode(mode) {
    var status = quotaStatus();
    var speakersOn = mode === "speakers" && canArm(status);
    isApplyingMode = true;
    try {
      armed = speakersOn;
      setNativeToggle(speakersCheckbox(), speakersOn);
      setNativeToggle(formatCheckbox(), !speakersOn);
      syncSpeakersSelect(speakersOn);
      var wrap = speakersWrap();
      var blocked = status === "used" || status === "pending" || status === "uncertain";
      if (wrap) {
        wrap.classList.toggle("is-disabled", blocked && !speakersOn);
        if (blocked && !speakersOn) wrap.setAttribute("aria-disabled", "true");
        else wrap.removeAttribute("aria-disabled");
      }
      var checkbox = speakersCheckbox();
      if (checkbox) {
        if (blocked && !speakersOn) checkbox.setAttribute("aria-disabled", "true");
        else checkbox.removeAttribute("aria-disabled");
      }
    } finally {
      isApplyingMode = false;
    }
    refreshStatus();
  }

  function findLabelHost() {
    var wrap = speakersWrap();
    if (!wrap) return null;
    var nodes = wrap.querySelectorAll("div, span, p, label");
    for (var i = 0; i < nodes.length; i += 1) {
      var el = nodes[i];
      if (el.id === HINT_ID) continue;
      var text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (/reconnaissance des intervenants/i.test(text) && el.querySelectorAll("input, .checkbox_toggle").length === 0) {
        return el;
      }
    }
    return wrap;
  }

  function ensureHint() {
    var existing = document.getElementById(HINT_ID);
    if (existing) return existing;
    var hint = document.createElement("p");
    hint.id = HINT_ID;
    hint.className = "agilo-speaker-trial-status";
    hint.setAttribute("role", "status");
    hint.setAttribute("aria-live", "polite");
    var host = findLabelHost();
    if (host) {
      if (host.nextSibling) host.parentNode.insertBefore(hint, host.nextSibling);
      else host.parentNode.appendChild(hint);
    } else {
      document.body.appendChild(hint);
    }
    var checkbox = speakersCheckbox();
    if (checkbox) checkbox.setAttribute("aria-describedby", HINT_ID);
    return hint;
  }

  function injectStatusCss() {
    if (document.getElementById("agilo-speaker-trial-css")) return;
    var style = document.createElement("style");
    style.id = "agilo-speaker-trial-css";
    style.textContent =
      ".agilo-speaker-trial-status{display:block;margin:.25rem 0 0;font-size:.78rem;line-height:1.35;max-width:24rem;}" +
      ".agilo-speaker-trial-status.is-available{color:#5d2de6;}" +
      ".agilo-speaker-trial-status.is-blocked{color:#666;}" +
      "#" + MODAL_ID + "{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(4px);}" +
      "#" + MODAL_ID + " .agilo-free-modal-panel{position:relative;background:#fff;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,.18);width:min(460px,92vw);padding:2.2rem 2rem 1.8rem;text-align:center;font-family:inherit;}" +
      "#" + MODAL_ID + " h3{margin:0 0 .6rem;font-size:1.1rem;font-weight:700;color:#020202;}" +
      "#" + MODAL_ID + " .agilo-free-modal-reason{margin:0 0 1.2rem;font-size:.88rem;line-height:1.55;color:#525252;}" +
      "#" + MODAL_ID + " .agilo-free-btn-primary{display:flex;align-items:center;justify-content:center;width:100%;padding:.75rem 1rem;background:#174a96;color:#fff;border:none;border-radius:10px;font-size:.92rem;font-weight:600;cursor:pointer;font-family:inherit;}" +
      "#" + MODAL_ID + " .agilo-free-btn-ghost{display:block;margin:.8rem auto 0;background:none;border:none;font-size:.78rem;color:#888;cursor:pointer;font-family:inherit;text-decoration:underline;}" +
      "#" + MODAL_ID + " .agilo-free-close{position:absolute;top:.6rem;right:.7rem;background:none;border:none;font-size:1.5rem;cursor:pointer;color:#888;line-height:1;padding:.25rem}";
    document.head.appendChild(style);
  }

  function hintText(status) {
    if (status === "pending") return "Envoi de l’essai en cours";
    if (status === "uncertain") return "Essai en cours de vérification";
    if (status === "used") return "Essai utilisé aujourd’hui";
    return "1 essai gratuit aujourd’hui";
  }

  function refreshStatus() {
    if (!isFreeContext()) return;
    var state = core ? core.getState() : { status: "available" };
    var hint = ensureHint();
    hint.textContent = hintText(state.status);
    hint.classList.toggle("is-available", state.status === "available");
    hint.classList.toggle("is-blocked", state.status !== "available");
    var wrap = speakersWrap();
    if (wrap && state.status !== "available" && !armed) wrap.classList.add("is-disabled");
    if (wrap && (state.status === "available" || armed)) wrap.classList.remove("is-disabled");
  }

  function closeModal() {
    var overlay = document.getElementById(MODAL_ID);
    if (overlay) overlay.remove();
    document.removeEventListener("keydown", onModalKey, true);
    if (lastFocus && typeof lastFocus.focus === "function") {
      try { lastFocus.focus(); } catch (e) { /* ignore */ }
    }
  }

  function onModalKey(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== "Tab") return;
    var overlay = document.getElementById(MODAL_ID);
    if (!overlay) return;
    var focusable = overlay.querySelectorAll("button, [href], [tabindex]:not([tabindex='-1'])");
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function showInfoModal(opts) {
    injectStatusCss();
    closeModal();
    lastFocus = document.activeElement;
    var overlay = document.createElement("div");
    overlay.id = MODAL_ID;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "agilo-speaker-trial-title");

    var panel = document.createElement("div");
    panel.className = "agilo-free-modal-panel";

    var title = document.createElement("h3");
    title.id = "agilo-speaker-trial-title";
    title.textContent = opts.title;

    var reason = document.createElement("p");
    reason.className = "agilo-free-modal-reason";
    reason.textContent = opts.reason;

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "agilo-free-close";
    closeBtn.setAttribute("aria-label", "Fermer");
    closeBtn.textContent = "\u00D7";
    closeBtn.onclick = closeModal;

    panel.appendChild(closeBtn);
    panel.appendChild(title);
    panel.appendChild(reason);

    if (opts.primary) {
      var primary = document.createElement("button");
      primary.type = "button";
      primary.className = "agilo-free-btn-primary";
      primary.textContent = opts.primary;
      primary.onclick = function () {
        if (typeof opts.onPrimary === "function") opts.onPrimary();
      };
      panel.appendChild(primary);
    }

    var ghost = document.createElement("button");
    ghost.type = "button";
    ghost.className = "agilo-free-btn-ghost";
    ghost.textContent = opts.secondary || "Annuler";
    ghost.onclick = function () {
      if (typeof opts.onSecondary === "function") opts.onSecondary();
      closeModal();
    };
    panel.appendChild(ghost);

    overlay.appendChild(panel);
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) closeModal();
    });
    document.body.appendChild(overlay);
    document.addEventListener("keydown", onModalKey, true);
    var focusEl = overlay.querySelector(".agilo-free-btn-primary") || closeBtn;
    focusEl.focus();
  }

  function showUpgrade(source) {
    track("free_speaker_trial_upgrade_clicked", { source: source || lastSource || "" });
    if (root.AgiloFreeUpgrade && typeof root.AgiloFreeUpgrade.show === "function") {
      root.AgiloFreeUpgrade.show({
        minPlan: "pro",
        reason: "Vous avez utilisé votre essai du jour pour la reconnaissance des intervenants. Passez en Pro pour l’utiliser sans limite.",
        source: "speaker_trial"
      });
      return;
    }
    if (root.AgiloGate && typeof root.AgiloGate.showUpgrade === "function") {
      root.AgiloGate.showUpgrade("pro", "Reconnaissance des intervenants");
      return;
    }
    var existing = document.querySelector('[data-ms-price\\:update="' + MS_PRICE_PRO + '"]');
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

  function confirmSpeakers() {
    if (!core) boot();
    if (!readMemberId()) {
      closeModal();
      applyOptionMode("standard");
      return;
    }
    var state = core.getState();
    if (state.status === "used") {
      track("free_speaker_trial_state_conflict", { reason: "used" });
      closeModal();
      applyOptionMode("standard");
      showUpgrade(lastSource);
      return;
    }
    if (state.status === "pending" || state.status === "uncertain") {
      track("free_speaker_trial_state_conflict", { reason: state.status });
      closeModal();
      applyOptionMode("standard");
      showStateModal(state.status);
      return;
    }
    closeModal();
    applyOptionMode("speakers");
    track("free_speaker_trial_confirmed", { source: lastSource || "toggle" });
  }

  function showStateModal(forcedStatus) {
    if (!core) boot();
    var status = forcedStatus || (core && core.getState().status) || "available";
    if (status === "used") {
      showUpgrade(lastSource);
      return;
    }
    if (status === "pending") {
      showInfoModal({
        title: "Essai en cours d’envoi",
        reason: "Votre essai est en cours d’envoi. Attendez la confirmation avant de recommencer.",
        secondary: "Fermer"
      });
      return;
    }
    if (status === "uncertain") {
      showInfoModal({
        title: "Vérification de l’essai",
        reason: "Nous vérifions si votre essai a bien été envoyé.",
        secondary: "Fermer"
      });
      return;
    }
    showInfoModal({
      title: "Tester la reconnaissance des intervenants",
      reason: "1 essai gratuit aujourd’hui. Le formatage sera désactivé. L’essai n’est consommé que si votre fichier est accepté.",
      primary: "Activer mon essai",
      secondary: "Annuler",
      onPrimary: confirmSpeakers,
      onSecondary: function () {
        track("free_speaker_trial_declined", { source: lastSource || "toggle" });
      }
    });
  }

  function shouldIgnoreGesture(event) {
    if (!event) return false;
    if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return true;
    if (event.type === "pointerdown" && event.button && event.button !== 0) return true;
    return false;
  }

  function consumeGesture(event) {
    var now = Date.now();
    if (event && event.type === "click" && now - lastGestureAt < 400) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      return true;
    }
    if (event && event.type === "pointerdown") lastGestureAt = now;
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    }
    return false;
  }

  function handleSpeakersGesture(event) {
    if (!isFreeContext() || isApplyingMode) return;
    if (shouldIgnoreGesture(event)) return;
    if (consumeGesture(event)) return;
    var status = quotaStatus();
    if (status === "used") {
      applyOptionMode("standard");
      showUpgrade(lastSource);
      return;
    }
    if (status === "pending" || status === "uncertain") {
      applyOptionMode("standard");
      showStateModal(status);
      return;
    }
    if (armed) {
      applyOptionMode("standard");
      return;
    }
    showStateModal("available");
  }

  function handleFormatGesture(event) {
    if (!isFreeContext() || isApplyingMode || !armed) return;
    if (shouldIgnoreGesture(event)) return;
    if (consumeGesture(event)) return;
    applyOptionMode("standard");
  }

  function bindTarget(el, handler) {
    if (!el || el.getAttribute("data-agilo-speaker-bound") === "1") return;
    el.setAttribute("data-agilo-speaker-bound", "1");
    el.addEventListener("click", handler, true);
    el.addEventListener("pointerdown", handler, true);
    el.addEventListener("keydown", handler, true);
  }

  function bindUi() {
    injectStatusCss();
    var sCb = speakersCheckbox();
    if (!sCb) return false;
    bindTarget(bindRoot(speakersWrap(), sCb), handleSpeakersGesture);
    var fCb = formatCheckbox();
    if (fCb) bindTarget(bindRoot(formatWrap(), fCb), handleFormatGesture);
    return true;
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

  var channel = null;
  try {
    if (typeof BroadcastChannel !== "undefined") channel = new BroadcastChannel(CHANNEL_NAME);
  } catch (e) {
    channel = null;
  }

  function broadcast(record) {
    try {
      if (channel) channel.postMessage({ type: "sync", status: record && record.status || "available" });
    } catch (e) { /* ignore */ }
  }

  function boot() {
    if (!isFreeContext()) return;
    if (!core) {
      core = createCore({
        store: wrapStorage(root.localStorage),
        getMemberId: readMemberId,
        broadcast: broadcast,
        fetchJobs: defaultFetchJobs,
        onChange: function () { refreshStatus(); },
        onMigrationReset: function () {
          track("free_speaker_trial_migration_reset", { source: "boot" });
        }
      });
    }
    bindUi();
    var status = core.getState().status;
    if (!armed || !canArm(status)) applyOptionMode("standard");
    refreshStatus();
    if (!trackedAvailable && core.getState().status === "available") {
      trackedAvailable = true;
      track("free_speaker_trial_available", { source: "init" });
    }
    if (!booted) {
      booted = true;
      Promise.resolve(core.reconcile([])).then(function () {
        return defaultFetchJobs().then(function (jobs) {
          if (jobs && jobs.length) return core.reconcile(jobs);
        });
      }).then(function () {
        if (!armed || !canArm(core.getState().status)) applyOptionMode("standard");
        refreshStatus();
      }).catch(function () { refreshStatus(); });
    }
  }

  function publicReserve(input) {
    if (!isFreeContext()) return Promise.resolve({ ok: true, skipped: true, requestId: "" });
    if (!core) boot();
    lastSource = (input && input.source) || "upload";
    if (!armed) {
      track("free_speaker_trial_blocked", { source: lastSource, reason: "not_armed" });
      return Promise.resolve({ ok: false, reason: "not_armed", status: core.getState().status });
    }
    return Promise.resolve(core.reserve(input)).then(function (result) {
      refreshStatus();
      if (result && result.ok) {
        track("free_speaker_trial_reserved", { source: lastSource });
      } else {
        track("free_speaker_trial_blocked", { source: lastSource, reason: result && result.reason || "" });
        showStateModal(result && result.reason);
      }
      return result;
    });
  }

  function publicCommit(jobId, input) {
    if (!core) return Promise.resolve(null);
    return Promise.resolve(core.commit(jobId, input)).then(function (state) {
      armed = false;
      applyOptionMode("standard");
      track("free_speaker_trial_used", { source: (input && input.source) || lastSource || "" });
      return state;
    });
  }

  function publicRelease(input) {
    if (!core) return Promise.resolve(null);
    return Promise.resolve(core.release(input)).then(function (state) {
      refreshStatus();
      return state;
    });
  }

  function publicUncertain(input) {
    if (!core) return Promise.resolve(null);
    return Promise.resolve(core.markUncertain(input)).then(function (state) {
      refreshStatus();
      return state;
    });
  }

  function publicReadIntent(sourceHint) {
    var checkbox = speakersCheckbox();
    var select = document.getElementById("speakers-select");
    var session = document.querySelector('input[name="agilo_record_session_id"]');
    var source = sourceHint || (session && session.value ? "recording" : "upload");
    var checked = !!(checkbox && checkbox.checked);
    return {
      speakers: speakersIntent(checked, armed),
      armed: !!armed,
      formatChecked: !!(formatCheckbox() && formatCheckbox().checked),
      speakersExpected: select ? String(select.value || "") : "",
      source: source
    };
  }

  root.AgiloFreeSpeakerTrial = {
    init: boot,
    getState: function () {
      var state = core ? core.getState() : { status: "available" };
      state.armed = !!armed;
      return state;
    },
    isReady: function () { return !!(core && isFreeContext()); },
    reserve: publicReserve,
    commit: publicCommit,
    release: publicRelease,
    markUncertain: publicUncertain,
    refreshUi: function () {
      refreshStatus();
    },
    applyOptionMode: applyOptionMode,
    showUpgrade: showUpgrade,
    showStateModal: showStateModal,
    isCertainRejection: isCertainRejection,
    readIntent: publicReadIntent
  };

  function start() {
    if (!isFreeContext()) return;
    boot();
    [0, 350, 1100].forEach(function (ms) {
      setTimeout(function () {
        boot();
        if (!armed || !canArm(core.getState().status)) applyOptionMode("standard");
      }, ms);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  if (channel) {
    channel.onmessage = function () { refreshStatus(); };
  }
  root.addEventListener("storage", function (event) {
    if (event && event.key && String(event.key).indexOf(STORAGE_PREFIX) === 0) refreshStatus();
  });
})(typeof window !== "undefined" ? window : globalThis);
