/**
 * Agilotext bibliothèque — client API (v1 historique ou library2).
 * Capacités lues sur le serveur. Jamais de targetUsername. Mutations POST only.
 * @version 1.2.0
 */
(function (global) {
  "use strict";

  var API_ORIGIN = "https://api.agilotext.com";
  var V1 = API_ORIGIN + "/api/v1";
  var LIB2 = API_ORIGIN + "/api/v1/library2";
  var duplicateInFlight = false;
  var PIN_MAX = 5;
  var TOKEN_MAX_AGE_MS = 3 * 60 * 60 * 1000;
  var AUTH_HINT_RE = /(invalid token|expired token|token invalide|jeton invalide|unauthorized|forbidden|authentication|authentification|missing token|error_invalid_token|error_token)/i;
  var TOKEN_HASH_RE = /v2\.l[a-z0-9]+/i;
  var AUTH_RETRY_MSG = "Session expirée, reconnexion…";
  var AUTH_RELOAD_MSG = "Session expirée. Recharge la page.";
  var refreshInflight = null;

  function cfg() {
    var c = global.__AGILO_PROMPT_LIBRARY__ || {};
    return {
      library2Live: !!c.library2Live,
      cse89Live: !!c.cse89Live,
      atelierEnabled: !!c.atelierEnabled,
      apiBase: c.apiBase || V1,
      library2Base: c.library2Base || LIB2,
      mountSelector: c.mountSelector || "#agilo-prompt-library-anchor",
      pickerSelector: c.pickerSelector || "#agilo-prompt-picker-anchor",
      ctaMailto: c.ctaMailto || "mailto:contact@agilotext.com?subject=Pack%20CSE",
      ctaAnnualUrl: c.ctaAnnualUrl || "/cse",
      ctaMonthlyUrl: c.ctaMonthlyUrl || "/cse",
      edition: c.edition || "",
      pricingUrl: c.pricingUrl || "/tarifs"
    };
  }

  function authFields(creds) {
    return {
      username: creds.email,
      token: creds.token,
      edition: creds.edition
    };
  }

  function modelId(m) {
    if (!m || typeof m !== "object") return NaN;
    if (m.promptId != null && m.promptId !== "") return Number(m.promptId);
    if (m.promptModelId != null && m.promptModelId !== "") return Number(m.promptModelId);
    return NaN;
  }

  function isGenerationSafeId(id) {
    var n = Number(id);
    if (!isFinite(n) || n === -1) return false;
    if (n < -1) return false;
    return true;
  }

  function assertGenerationId(id) {
    if (!isGenerationSafeId(id)) {
      throw new Error("Identifiant de génération interdit (officiel isolé). Copie d’abord le modèle.");
    }
    return Number(id);
  }

  function absIconUrl(url) {
    var u = String(url || "").trim();
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    if (u.charAt(0) === "/") return API_ORIGIN + u;
    return API_ORIGIN + "/" + u;
  }

  function authBlob(res) {
    if (!res) return "";
    if (typeof res === "string") return res;
    return [res.code, res.errorCode, res.errorMessage, res.message, res.status, res.exceptionName].join(" ");
  }

  function isAuthStatus(httpStatus) {
    return httpStatus === 401 || httpStatus === 403;
  }

  function isAuthParsed(res) {
    if (!res) return false;
    if (res.auth) return true;
    if (isAuthStatus(res.httpStatus)) return true;
    return AUTH_HINT_RE.test(authBlob(res));
  }

  function isAuthError(err) {
    if (!err) return false;
    if (err.auth) return true;
    return AUTH_HINT_RE.test(String(err.message || "")) || TOKEN_HASH_RE.test(String(err.message || ""));
  }

  function sanitizeUserMessage(msg, duringRetry) {
    var s = String(msg == null ? "" : msg);
    if (!s) return duringRetry ? AUTH_RETRY_MSG : AUTH_RELOAD_MSG;
    if (AUTH_HINT_RE.test(s) || TOKEN_HASH_RE.test(s)) {
      return duringRetry ? AUTH_RETRY_MSG : AUTH_RELOAD_MSG;
    }
    return s;
  }

  function markAuth(parsed) {
    parsed.auth = true;
    parsed.retry = true;
    parsed.message = AUTH_RETRY_MSG;
    return parsed;
  }

  function humanize(res) {
    if (!res) return "Erreur.";
    if (isAuthParsed(res)) return sanitizeUserMessage(res.message, !!res.retry);
    if (res.httpStatus === 503 || res.reload) {
      return res.message || "Service occupé. Recharge la page avant de réessayer.";
    }
    var code = String(res.code || "").toLowerCase();
    var msg = String(res.message || "");
    var low = msg.toLowerCase();
    if (code === "error_pin_limit" || (low.indexOf("pin") !== -1 && low.indexOf("limit") !== -1)) {
      return "5 épingles maximum. Désépingle un modèle d’abord.";
    }
    if (low.indexOf("already") !== -1 || low.indexOf("existe déjà") !== -1 || low.indexOf("duplicate name") !== -1) {
      return "Ce nom existe déjà. Essaie un autre nom.";
    }
    if (low.indexOf("quota") !== -1 || (low.indexOf("limit") !== -1 && low.indexOf("model") !== -1)) {
      return "Limite de modèles atteinte. Supprime un ancien modèle ou contacte le support.";
    }
    return sanitizeUserMessage(msg || "Erreur.", false);
  }

  function parsePayload(data, httpStatus) {
    if (isAuthStatus(httpStatus)) {
      return markAuth({ ok: false, retry: true, code: String(httpStatus), httpStatus: httpStatus, message: AUTH_RETRY_MSG });
    }
    if (httpStatus === 503) {
      return { ok: false, retry: false, reload: true, code: "SERVICE_UNAVAILABLE", message: "Service occupé. Recharge la page avant de réessayer." };
    }
    if (!data || typeof data !== "object") {
      var rawTxt = typeof data === "string" ? data : "";
      if (AUTH_HINT_RE.test(rawTxt) || TOKEN_HASH_RE.test(rawTxt)) {
        return markAuth({ ok: false, retry: true, code: "AUTH", message: AUTH_RETRY_MSG });
      }
      return { ok: false, retry: false, code: "BAD_PAYLOAD", message: "Réponse inattendue." };
    }
    var blob = authBlob(data);
    if (AUTH_HINT_RE.test(blob) || TOKEN_HASH_RE.test(blob)) {
      return markAuth({
        ok: false,
        retry: true,
        code: String(data.code || data.errorCode || data.errorMessage || "AUTH"),
        message: AUTH_RETRY_MSG
      });
    }
    var status = String(data.status || "").toUpperCase();
    if (status === "OK" || status === "SUCCESS" || status === "") {
      if (httpStatus && httpStatus >= 400) {
        var bad = { ok: false, retry: false, code: String(httpStatus), message: data.errorMessage || data.message || "Erreur." };
        if (isAuthParsed(bad)) return markAuth(bad);
        bad.message = humanize(bad);
        return bad;
      }
      return { ok: true, data: data };
    }
    if (status === "ERROR" || status === "KO") {
      var errCode = String(data.code || data.errorCode || "");
      var parsed = {
        ok: false,
        retry: false,
        reload: errCode === "REVISION_CONFLICT" || httpStatus === 503,
        code: errCode,
        message: data.lockReasonMessage || data.errorMessage || data.message || "Erreur."
      };
      if (isAuthParsed(parsed)) return markAuth(parsed);
      parsed.message = humanize(parsed);
      return parsed;
    }
    return { ok: true, data: data };
  }

  function toForm(fields) {
    var body = new URLSearchParams();
    Object.keys(fields).forEach(function (k) {
      if (fields[k] == null || fields[k] === "") return;
      body.append(k, String(fields[k]));
    });
    return body;
  }

  function postJson(url, fields) {
    return fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: toForm(fields),
      cache: "no-store",
      credentials: "omit"
    }).then(function (res) {
      return res.text().then(function (txt) {
        var data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (_) { data = null; }
        var parsed = parsePayload(data, res.status);
        parsed.httpStatus = res.status;
        if (!parsed.ok) parsed.message = humanize(parsed);
        return parsed;
      });
    });
  }

  function getJson(url) {
    return fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "omit"
    }).then(function (res) {
      return res.text().then(function (txt) {
        var data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (_) { data = null; }
        var parsed = parsePayload(data, res.status);
        parsed.httpStatus = res.status;
        if (!parsed.ok) parsed.message = humanize(parsed);
        return parsed;
      });
    });
  }

  function listFrom(data) {
    if (!data) return [];
    if (Array.isArray(data.promptModeInfoDTOList)) return data.promptModeInfoDTOList;
    if (Array.isArray(data.promptModelStandardInfoList)) return data.promptModelStandardInfoList;
    if (Array.isArray(data.models)) return data.models;
    if (Array.isArray(data.items)) return data.items;
    return [];
  }

  function typesList(m) {
    var raw = m.allowedSubscriptionTypes;
    if (Array.isArray(raw)) return raw.map(function (t) { return String(t).toLowerCase(); });
    if (typeof raw === "string" && raw.trim()) {
      return raw.split(",").map(function (t) { return t.trim().toLowerCase(); }).filter(Boolean);
    }
    return [];
  }

  function isPackCseCard(m) {
    if (!cfg().library2Live) return false;
    var types = typesList(m);
    if (types.indexOf("cse") !== -1) return true;
    return m.lockReasonCode === "SUBSCRIPTION_ACCESS_REQUIRED";
  }

  function ts(v) {
    if (v == null || v === "") return 0;
    if (typeof v === "number") return v;
    var n = Date.parse(v);
    return isFinite(n) ? n : 0;
  }

  function normalizeCard(raw, defaultId) {
    var id = modelId(raw);
    var typeField = String(raw.promptModelType || "").toUpperCase();
    var type = typeField;
    if (!type) {
      if (id > 100) type = "USER";
      else type = "STANDARD";
    }
    var lockCode = raw.lockReasonCode || "";
    var lockMsg = raw.lockReasonMessage || raw.lockedReason || "";
    var canUse = raw.canUse;
    if (canUse == null) canUse = isGenerationSafeId(id);
    var canDuplicate = raw.canDuplicate;
    if (canDuplicate == null) canDuplicate = type === "USER";
    var canPin = raw.canPin;
    if (canPin == null) canPin = true;
    var canEdit = !!raw.canEdit;
    var canDelete = !!raw.canDelete;
    var canSetDefault = raw.canSetDefault;
    if (canSetDefault == null) canSetDefault = !!canUse && isGenerationSafeId(id);
    var canManageVersions = !!raw.canManageVersions;
    var requiresCopy = raw.requiresUserCopy;
    if (requiresCopy == null) requiresCopy = id < -1;
    var visible = raw.visible;
    if (visible === false) return null;
    var name = raw.cardTitle || raw.promptModelName || ("Modèle " + id);
    var locked = !!(lockCode || lockMsg) && !canUse;
    var card = {
      promptModelId: id,
      promptId: raw.promptId != null ? Number(raw.promptId) : id,
      promptModelName: raw.promptModelName || name,
      cardTitle: name,
      publicDescription: raw.publicDescription || raw.description || "",
      publicExample: raw.publicExample || "",
      promptModelType: type,
      type: type,
      iconUrl: absIconUrl(raw.iconUrl),
      iconLabel: raw.iconLabel || "",
      iconKey: raw.iconKey || "",
      categoryKey: raw.categoryKey || "",
      hasHtml: !!raw.hasHtml,
      pinned: !!raw.pinned,
      isDefault: defaultId != null && Number(defaultId) === id,
      canUse: !!canUse,
      canDuplicate: !!canDuplicate,
      canCopyOfficial: type === "STANDARD" && !locked,
      canPin: !!canPin,
      canEdit: canEdit,
      canDelete: canDelete,
      canSetDefault: !!canSetDefault,
      canManageVersions: canManageVersions,
      requiresUserCopy: !!requiresCopy,
      lockReasonCode: lockCode,
      lockReasonMessage: lockMsg,
      lockedReason: lockMsg,
      allowedSubscriptionTypes: typesList(raw),
      packCse: isPackCseCard(raw),
      displayOrder: Number(raw.displayOrder || raw.sortOrder || 0),
      sortOrder: Number(raw.sortOrder || raw.displayOrder || 0),
      featured: !!raw.featured,
      dtCreation: ts(raw.dtCreation),
      dtUpdate: ts(raw.dtUpdate || raw.dtCreation),
      alreadyCopied: canDuplicate === false && type === "STANDARD" && !lockCode
    };
    if (global.AgiloLibraryStandards && global.AgiloLibraryStandards.applyTo) {
      global.AgiloLibraryStandards.applyTo(card);
    }
    if (!card.iconKey) card.iconKey = type === "USER" ? "custom" : "document";
    if (!card.categoryKey) card.categoryKey = type === "USER" ? "custom" : "general";
    return card;
  }

  function inferEdition() {
    var c = cfg();
    if (c.edition) return String(c.edition).toLowerCase();
    if (global.__agiloEditorCreds && global.__agiloEditorCreds.pickEdition) {
      return global.__agiloEditorCreds.pickEdition();
    }
    var path = (global.location && global.location.pathname || "").toLowerCase();
    if (path.indexOf("/business") !== -1) return "ent";
    if (path.indexOf("/premium") !== -1 || path.indexOf("/app/pro/") !== -1) return "pro";
    if (path.indexOf("/free") !== -1) return "free";
    try { return localStorage.getItem("agilo:edition") || "ent"; } catch (_) { return "ent"; }
  }

  function canCreate(creds) {
    var ed = String((creds && creds.edition) || inferEdition() || "").toLowerCase();
    return ed !== "free" && ed !== "gratuit";
  }

  function appPath(kind) {
    var path = (global.location && global.location.pathname || "").toLowerCase();
    var root = "/app/business";
    if (path.indexOf("/premium") !== -1) root = "/app/premium";
    else if (path.indexOf("/free") !== -1) root = "/app/free";
    else if (path.indexOf("/business") !== -1) root = "/app/business";
    if (kind === "dashboard") return root + "/dashboard";
    if (kind === "profile") return root + "/profile?tab=prompts";
    return root;
  }

  function normEdition(v) {
    v = String(v || "").toLowerCase().trim();
    if (v === "business" || v === "enterprise" || v === "entreprise" || v === "biz") return "ent";
    return v || "ent";
  }

  function issuedAtMs(edition, email) {
    try {
      return parseInt(localStorage.getItem("agilo:tokenIssuedAt:" + edition + ":" + String(email || "").toLowerCase()) || "0", 10) || 0;
    } catch (_) {
      return 0;
    }
  }

  function isFreshToken(edition, email, token) {
    if (!token || !email) return false;
    var issued = issuedAtMs(edition, email);
    if (!issued) return false;
    return (Date.now() - issued) < TOKEN_MAX_AGE_MS;
  }

  function snapCreds() {
    var edition = normEdition(inferEdition());
    var email = "";
    var token = "";
    var creds = global.__agiloEditorCreds;
    if (creds) {
      email = creds.pickEmail() || "";
      token = creds.pickToken(edition, email) || "";
    }
    if (!email) {
      var el = document.querySelector('[name="memberEmail"]') || document.querySelector('[data-ms-member="email"]');
      email = (el && (el.value || el.textContent) || global.memberEmail || "").trim();
    }
    if (!token) token = global.globalToken || "";
    if (!token && email) {
      try {
        token = localStorage.getItem("agilo:token:" + edition + ":" + email.toLowerCase()) ||
          localStorage.getItem("agilo:token") || "";
      } catch (_) { /* ignore */ }
    }
    return {
      email: email,
      token: token,
      edition: edition,
      fresh: isFreshToken(edition, email, token)
    };
  }

  function waitForTokenEvent(timeoutMs, email) {
    return new Promise(function (resolve) {
      var done = false;
      function finish(detail) {
        if (done) return;
        done = true;
        global.removeEventListener("agilo:token", onTok);
        resolve(detail || null);
      }
      var timer = setTimeout(function () { finish(null); }, timeoutMs || 8000);
      function onTok(ev) {
        var d = (ev && ev.detail) || {};
        if (!d.token) return;
        if (email && d.email && String(d.email).toLowerCase() !== String(email).toLowerCase()) return;
        clearTimeout(timer);
        finish(d);
      }
      global.addEventListener("agilo:token", onTok);
    });
  }

  function refreshCreds(creds) {
    if (refreshInflight) return refreshInflight;
    creds = creds || {};
    var email = creds.email || snapCreds().email;
    var edition = normEdition(creds.edition || inferEdition());
    refreshInflight = Promise.resolve().then(function () {
      try { global.globalToken = ""; } catch (_) { /* ignore */ }
      if (typeof global.getToken === "function" && email) {
        try { global.getToken(email, edition, true); } catch (_) { /* ignore */ }
      }
      return waitForTokenEvent(8000, email);
    }).then(function (d) {
      var next = {
        email: (d && d.email) || email,
        token: (d && d.token) || global.globalToken || "",
        edition: normEdition((d && d.edition) || edition)
      };
      if (!next.token) {
        var err = new Error(AUTH_RELOAD_MSG);
        err.auth = true;
        throw err;
      }
      if (creds) {
        creds.email = next.email;
        creds.token = next.token;
        creds.edition = next.edition;
      }
      return next;
    }).finally(function () {
      refreshInflight = null;
    });
    return refreshInflight;
  }

  function failAuth(duringRetry) {
    var err = new Error(duringRetry ? AUTH_RETRY_MSG : AUTH_RELOAD_MSG);
    err.auth = true;
    return err;
  }

  function withAuthRetryRes(creds, run) {
    return Promise.resolve().then(function () { return run(creds); }).then(function (res) {
      if (!res || !res.auth) return res;
      return refreshCreds(creds).then(function () { return run(creds); }).then(function (res2) {
        if (res2 && res2.auth) {
          res2.retry = false;
          res2.message = AUTH_RELOAD_MSG;
        }
        return res2;
      });
    });
  }

  function waitForCreds(timeoutMs) {
    timeoutMs = timeoutMs || 12000;
    return new Promise(function (resolve, reject) {
      var done = false;
      function finishOk(c) {
        if (done) return;
        done = true;
        cleanup();
        resolve({ email: c.email, token: c.token, edition: c.edition });
      }
      function finishErr(msg) {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error(msg || "Session introuvable. Reconnecte-toi."));
      }
      function tryForce(s) {
        if (s.email && typeof global.getToken === "function") {
          try { global.getToken(s.email, s.edition, true); } catch (_) { /* ignore */ }
        }
      }
      var first = snapCreds();
      if (first.email && first.token && first.fresh) {
        finishOk(first);
        return;
      }
      tryForce(first);
      function onTok(ev) {
        var d = (ev && ev.detail) || {};
        var s = snapCreds();
        if (s.email && s.token) {
          finishOk(s);
          return;
        }
        if (d.email && d.token) {
          finishOk({
            email: d.email,
            token: d.token,
            edition: normEdition(d.edition || inferEdition())
          });
        }
      }
      var timer = setTimeout(function () {
        var s = snapCreds();
        if (s.email && s.token) {
          finishOk(s);
          return;
        }
        finishErr("Session introuvable. Reconnecte-toi.");
      }, timeoutMs);
      function cleanup() {
        clearTimeout(timer);
        global.removeEventListener("agilo:token", onTok);
      }
      global.addEventListener("agilo:token", onTok);
    });
  }

  function base() {
    var c = cfg();
    return c.library2Live ? c.library2Base : c.apiBase;
  }

  function mutationUrl(op) {
    return base() + "/" + op;
  }

  function listUrl(creds, op) {
    var c = cfg();
    var root = base();
    var q = "username=" + encodeURIComponent(creds.email) +
      "&token=" + encodeURIComponent(creds.token) +
      "&edition=" + encodeURIComponent(creds.edition);
    if (c.library2Live) return root + "/" + op;
    return root + "/" + op + "?" + q;
  }

  function fetchListsOnce(creds) {
    var c = cfg();
    var fields = authFields(creds);
    var userP;
    var stdP;
    if (c.library2Live) {
      userP = postJson(c.library2Base + "/getPromptModelsUserInfo", fields);
      stdP = postJson(c.library2Base + "/getPromptModelsStandardInfo", fields);
    } else {
      userP = getJson(listUrl(creds, "getPromptModelsUserInfo"));
      stdP = getJson(listUrl(creds, "getPromptModelsStandardInfo"));
    }
    return Promise.all([userP, stdP]).then(function (pair) {
      var userRes = pair[0];
      var stdRes = pair[1];
      if (isAuthParsed(userRes) || isAuthParsed(stdRes)) {
        throw failAuth(true);
      }
      if (!userRes.ok && !stdRes.ok) {
        throw new Error(sanitizeUserMessage(userRes.message || stdRes.message || "Impossible de charger les modèles.", false));
      }
      var userData = userRes.ok ? userRes.data : {};
      var stdData = stdRes.ok ? stdRes.data : {};
      var defaultId = userData.defaultPromptModelId != null ? userData.defaultPromptModelId : stdData.defaultPromptModelId;
      var map = {};
      listFrom(stdData).concat(listFrom(userData)).forEach(function (raw) {
        var card = normalizeCard(raw, defaultId);
        if (!card || !isFinite(card.promptModelId)) return;
        map[card.promptModelId] = card;
      });
      var models = Object.keys(map).map(function (k) { return map[k]; });
      var pinCount = models.filter(function (m) { return m.pinned; }).length;
      return {
        models: models,
        defaultPromptModelId: defaultId,
        library2Live: c.library2Live,
        pinCount: pinCount,
        pinMax: PIN_MAX
      };
    });
  }

  function fetchLists(creds) {
    return fetchListsOnce(creds).catch(function (err) {
      if (!isAuthError(err)) throw err;
      return refreshCreds(creds).then(function () {
        return fetchListsOnce(creds);
      }).catch(function (err2) {
        if (isAuthError(err2)) {
          var e = new Error(AUTH_RELOAD_MSG);
          e.auth = true;
          throw e;
        }
        throw err2;
      });
    });
  }

  function parseMemberAccess(res) {
    if (!res || !res.ok) return { hasCse: false, noun: "compte rendu", sources: [] };
    var d = res.data || {};
    var sources = d.sources || d.approvedTypes || [];
    if (typeof sources === "string") sources = sources.split(",");
    sources = (sources || []).map(function (s) { return String(s).toLowerCase(); });
    var hasCse = sources.some(function (s) {
      return s.indexOf("cse") !== -1 || s.indexOf("pln_cse-") !== -1;
    });
    if (d.approvedSubscriptionTypes) {
      var t = d.approvedSubscriptionTypes;
      if (typeof t === "string") t = t.split(",");
      hasCse = hasCse || (t || []).some(function (x) { return String(x).toLowerCase() === "cse"; });
    }
    return {
      hasCse: hasCse,
      noun: hasCse ? "PV" : "compte rendu",
      sources: sources,
      raw: d
    };
  }

  function fetchMemberAccess(creds) {
    var c = cfg();
    if (!c.library2Live) {
      return Promise.resolve({ hasCse: false, noun: "compte rendu", sources: [] });
    }
    return withAuthRetryRes(creds, function (fresh) {
      return postJson(c.library2Base + "/member-access", authFields(fresh));
    }).then(parseMemberAccess);
  }

  function duplicate(creds, sourcePromptId, name) {
    if (duplicateInFlight) {
      return Promise.resolve({ ok: false, retry: false, message: "Copie déjà en cours." });
    }
    duplicateInFlight = true;
    return withAuthRetryRes(creds, function (fresh) {
      return postJson(mutationUrl("duplicatePromptModel"), {
        username: fresh.email,
        token: fresh.token,
        edition: fresh.edition,
        sourcePromptId: sourcePromptId,
        promptName: name
      });
    }).then(function (res) {
      duplicateInFlight = false;
      if (res.httpStatus === 503 || res.reload) res.retry = false;
      return res;
    }).catch(function () {
      duplicateInFlight = false;
      return { ok: false, retry: false, reload: true, message: "Réseau interrompu. Recharge avant de réessayer." };
    });
  }

  function setDefault(creds, promptId) {
    assertGenerationId(promptId);
    return withAuthRetryRes(creds, function (fresh) {
      return postJson(mutationUrl("setPromptModelUserDefault"), {
        username: fresh.email,
        token: fresh.token,
        edition: fresh.edition,
        promptId: promptId
      });
    });
  }

  function setPinned(creds, promptId, pinned) {
    return withAuthRetryRes(creds, function (fresh) {
      return postJson(mutationUrl("setPromptModelPinned"), {
        username: fresh.email,
        token: fresh.token,
        edition: fresh.edition,
        promptId: promptId,
        pinned: pinned ? "true" : "false"
      });
    });
  }

  function rename(creds, promptId, promptName) {
    return withAuthRetryRes(creds, function (fresh) {
      return postJson(mutationUrl("renamePromptModel"), {
        username: fresh.email,
        token: fresh.token,
        edition: fresh.edition,
        promptId: promptId,
        promptName: promptName
      });
    });
  }

  function deleteModel(creds, promptId) {
    return withAuthRetryRes(creds, function (fresh) {
      return postJson(mutationUrl("deletePromptModel"), {
        username: fresh.email,
        token: fresh.token,
        edition: fresh.edition,
        promptId: promptId
      });
    });
  }

  function listVersions(creds, promptId) {
    return withAuthRetryRes(creds, function (fresh) {
      return postJson(mutationUrl("listPromptModelVersions"), {
        username: fresh.email,
        token: fresh.token,
        edition: fresh.edition,
        promptId: promptId
      });
    }).then(function (res) {
      if (!res.ok) return res;
      var d = res.data || {};
      var versions = d.versions || d.promptModelVersionList || [];
      res.versions = versions;
      res.maxVersions = d.maxVersions || 3;
      return res;
    });
  }

  function restoreVersion(creds, promptId, versionId) {
    return withAuthRetryRes(creds, function (fresh) {
      return postJson(mutationUrl("restorePromptModelVersion"), {
        username: fresh.email,
        token: fresh.token,
        edition: fresh.edition,
        promptId: promptId,
        versionId: versionId
      });
    });
  }

  function createFromWizard(creds, draft) {
    return withAuthRetryRes(creds, function (fresh) {
      return postJson(mutationUrl("createPromptModelUser"), {
        username: fresh.email,
        token: fresh.token,
        edition: fresh.edition,
        promptName: draft.name,
        promptObjective: draft.objective,
        promptSpecificInfo: draft.specificInfo,
        promptStructure: draft.structure
      });
    });
  }

  function getStatus(creds, promptId) {
    return withAuthRetryRes(creds, function (fresh) {
      return postJson(mutationUrl("getPromptModelUserStatus"), {
        username: fresh.email,
        token: fresh.token,
        edition: fresh.edition,
        promptId: promptId
      });
    }).then(function (res) {
      if (!res.ok) return res;
      var d = res.data || {};
      res.promptModelStatus = String(d.promptModelStatus || d.status || "").toUpperCase();
      return res;
    });
  }

  function waitPromptReady(creds, promptId, opts) {
    opts = opts || {};
    var maxMs = opts.maxMs || 240000;
    var pollMs = opts.pollMs || 2000;
    var start = Date.now();
    function tick() {
      return getStatus(creds, promptId).then(function (res) {
        var status = res.promptModelStatus || "";
        if (typeof opts.onTick === "function") {
          opts.onTick({ elapsedMs: Date.now() - start, status: status, maxMs: maxMs });
        }
        if (status === "READY" || status === "ACTIVE") return { ok: true, status: status, data: res.data };
        if (status === "ON_ERROR" || status === "ERROR" || status === "KO") {
          return { ok: false, status: status, message: "La création a échoué. Réessaie ou contacte le support." };
        }
        if (Date.now() - start >= maxMs) {
          return { ok: false, status: status || "TIMEOUT", message: "Création encore en cours. Recharge la page dans un instant." };
        }
        return new Promise(function (resolve) {
          setTimeout(function () { resolve(tick()); }, pollMs);
        });
      });
    }
    return tick();
  }

  function ctaForLocked(packCse) {
    var c = cfg();
    if (!packCse) return null;
    if (!c.cse89Live) {
      return {
        kind: "soft",
        label: "Bientôt disponible",
        href: c.ctaMailto,
        annualLabel: "890 € TTC / an",
        monthlyLabel: "89 € TTC / mois"
      };
    }
    return {
      kind: "buy",
      label: "890 € TTC / an",
      href: c.ctaAnnualUrl,
      secondaryHref: c.ctaMonthlyUrl,
      secondaryLabel: "89 € TTC / mois"
    };
  }

  global.AgiloLibraryApi = {
    VERSION: "1.2.0",
    PIN_MAX: PIN_MAX,
    cfg: cfg,
    waitForCreds: waitForCreds,
    refreshCreds: refreshCreds,
    fetchLists: fetchLists,
    fetchMemberAccess: fetchMemberAccess,
    duplicate: duplicate,
    setDefault: setDefault,
    setPinned: setPinned,
    rename: rename,
    deleteModel: deleteModel,
    listVersions: listVersions,
    restoreVersion: restoreVersion,
    createFromWizard: createFromWizard,
    getStatus: getStatus,
    waitPromptReady: waitPromptReady,
    modelId: modelId,
    isGenerationSafeId: isGenerationSafeId,
    assertGenerationId: assertGenerationId,
    ctaForLocked: ctaForLocked,
    absIconUrl: absIconUrl,
    canCreate: canCreate,
    appPath: appPath,
    inferEdition: inferEdition,
    humanize: humanize,
    isAuthError: isAuthError,
    sanitizeUserMessage: sanitizeUserMessage
  };
})(typeof window !== "undefined" ? window : globalThis);
