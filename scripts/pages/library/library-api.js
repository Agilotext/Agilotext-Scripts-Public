/**
 * Agilotext bibliothèque — client API (v1 historique ou library2).
 * Capacités lues sur le serveur. Jamais de targetUsername. Mutations POST only.
 * @version 1.0.0
 */
(function (global) {
  "use strict";

  var API_ORIGIN = "https://api.agilotext.com";
  var V1 = API_ORIGIN + "/api/v1";
  var LIB2 = API_ORIGIN + "/api/v1/library2";
  var duplicateInFlight = false;

  function cfg() {
    var c = global.__AGILO_PROMPT_LIBRARY__ || {};
    return {
      library2Live: !!c.library2Live,
      cse89Live: !!c.cse89Live,
      apiBase: c.apiBase || V1,
      library2Base: c.library2Base || LIB2,
      mountSelector: c.mountSelector || "#agilo-prompt-library-anchor",
      pickerSelector: c.pickerSelector || "#agilo-prompt-picker-anchor",
      ctaMailto: c.ctaMailto || "mailto:contact@agilotext.com?subject=Pack%20CSE",
      ctaAnnualUrl: c.ctaAnnualUrl || "/cse",
      ctaMonthlyUrl: c.ctaMonthlyUrl || "/cse",
      edition: c.edition || ""
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

  function parsePayload(data, httpStatus) {
    if (httpStatus === 503) {
      return { ok: false, retry: false, reload: true, code: "SERVICE_UNAVAILABLE", message: "Service occupé. Recharge la page avant de réessayer." };
    }
    if (!data || typeof data !== "object") {
      return { ok: false, retry: false, code: "BAD_PAYLOAD", message: "Réponse inattendue." };
    }
    var status = String(data.status || "").toUpperCase();
    if (status === "OK" || status === "SUCCESS" || status === "") {
      if (httpStatus && httpStatus >= 400) {
        return { ok: false, retry: false, code: String(httpStatus), message: data.errorMessage || data.message || "Erreur." };
      }
      return { ok: true, data: data };
    }
    if (status === "ERROR" || status === "KO") {
      var code = String(data.code || data.errorCode || "");
      return {
        ok: false,
        retry: false,
        reload: code === "REVISION_CONFLICT" || httpStatus === 503,
        code: code,
        message: data.lockReasonMessage || data.errorMessage || data.message || "Erreur."
      };
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
        return parsed;
      });
    });
  }

  function listFrom(data) {
    if (!data) return [];
    if (Array.isArray(data.promptModeInfoDTOList)) return data.promptModeInfoDTOList;
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
    var types = typesList(m);
    if (types.indexOf("cse") !== -1) return true;
    return m.lockReasonCode === "SUBSCRIPTION_ACCESS_REQUIRED";
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
    if (canDuplicate == null) canDuplicate = type === "STANDARD";
    var canPin = !!raw.canPin;
    var canEdit = !!raw.canEdit;
    var requiresCopy = raw.requiresUserCopy;
    if (requiresCopy == null) requiresCopy = id < -1;
    var visible = raw.visible;
    if (visible === false) return null;
    var name = raw.cardTitle || raw.promptModelName || ("Modèle " + id);
    return {
      promptModelId: id,
      promptId: raw.promptId != null ? Number(raw.promptId) : id,
      promptModelName: name,
      cardTitle: name,
      publicDescription: raw.publicDescription || raw.description || "",
      publicExample: raw.publicExample || "",
      promptModelType: type,
      type: type,
      iconUrl: absIconUrl(raw.iconUrl),
      iconLabel: raw.iconLabel || "",
      iconKey: raw.iconKey || "",
      hasHtml: !!raw.hasHtml,
      pinned: !!raw.pinned,
      isDefault: defaultId != null && Number(defaultId) === id,
      canUse: !!canUse,
      canDuplicate: !!canDuplicate,
      canPin: canPin,
      canEdit: canEdit,
      requiresUserCopy: !!requiresCopy,
      lockReasonCode: lockCode,
      lockReasonMessage: lockMsg,
      lockedReason: lockMsg,
      allowedSubscriptionTypes: typesList(raw),
      packCse: isPackCseCard(raw),
      displayOrder: Number(raw.displayOrder || 0),
      featured: !!raw.featured,
      alreadyCopied: canDuplicate === false && type === "STANDARD" && !lockCode
    };
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

  function waitForCreds(timeoutMs) {
    timeoutMs = timeoutMs || 12000;
    return new Promise(function (resolve, reject) {
      function pick() {
        var edition = inferEdition();
        if (edition === "business" || edition === "enterprise" || edition === "entreprise") edition = "ent";
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
        if (email && token) return { email: email, token: token, edition: edition };
        return null;
      }
      var now = pick();
      if (now) return resolve(now);
      var timer = setTimeout(function () {
        global.removeEventListener("agilo:token", onTok);
        reject(new Error("Session introuvable. Reconnecte-toi."));
      }, timeoutMs);
      function onTok(ev) {
        var d = (ev && ev.detail) || {};
        var got = pick();
        if (got) {
          clearTimeout(timer);
          global.removeEventListener("agilo:token", onTok);
          resolve(got);
          return;
        }
        if (d.email && d.token) {
          clearTimeout(timer);
          global.removeEventListener("agilo:token", onTok);
          resolve({
            email: d.email,
            token: d.token,
            edition: d.edition || inferEdition()
          });
        }
      }
      global.addEventListener("agilo:token", onTok);
    });
  }

  function base(creds) {
    var c = cfg();
    return c.library2Live ? c.library2Base : c.apiBase;
  }

  function listUrl(creds, op) {
    var c = cfg();
    var root = base(creds);
    var q = "username=" + encodeURIComponent(creds.email) +
      "&token=" + encodeURIComponent(creds.token) +
      "&edition=" + encodeURIComponent(creds.edition);
    if (c.library2Live) return root + "/" + op;
    return root + "/" + op + "?" + q;
  }

  function fetchLists(creds) {
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
      if (!userRes.ok && !stdRes.ok) {
        throw new Error(userRes.message || stdRes.message || "Impossible de charger les modèles.");
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
      return {
        models: models,
        defaultPromptModelId: defaultId,
        library2Live: c.library2Live
      };
    });
  }

  function fetchMemberAccess(creds) {
    var c = cfg();
    if (!c.library2Live) {
      return Promise.resolve({ hasCse: false, noun: "compte rendu", sources: [] });
    }
    return postJson(c.library2Base + "/member-access", authFields(creds)).then(function (res) {
      if (!res.ok) return { hasCse: false, noun: "compte rendu", sources: [] };
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
    });
  }

  function duplicate(creds, sourcePromptId, name) {
    if (duplicateInFlight) {
      return Promise.resolve({ ok: false, retry: false, message: "Copie déjà en cours." });
    }
    var c = cfg();
    if (!c.library2Live) {
      return Promise.resolve({ ok: false, retry: false, message: "La copie catalogue arrive avec la nouvelle API. En attendant, utilise tes modèles existants." });
    }
    duplicateInFlight = true;
    return postJson(c.library2Base + "/duplicatePromptModel", {
      username: creds.email,
      token: creds.token,
      edition: creds.edition,
      sourcePromptId: sourcePromptId,
      promptModelName: name
    }).then(function (res) {
      duplicateInFlight = false;
      if (res.httpStatus === 503 || res.reload) res.retry = false;
      return res;
    }).catch(function (err) {
      duplicateInFlight = false;
      return { ok: false, retry: false, reload: true, message: "Réseau interrompu. Recharge avant de réessayer." };
    });
  }

  function setDefault(creds, promptId) {
    assertGenerationId(promptId);
    var c = cfg();
    var url = c.library2Live
      ? c.library2Base + "/setPromptModelUserDefault"
      : c.apiBase + "/setPromptModelUserDefault";
    return postJson(url, {
      username: creds.email,
      token: creds.token,
      edition: creds.edition,
      promptId: promptId
    });
  }

  function setPinned(creds, promptId, pinned) {
    var c = cfg();
    if (!c.library2Live) {
      return Promise.resolve({ ok: false, message: "Épingles indisponibles tant que library2 n’est pas en ligne." });
    }
    return postJson(c.library2Base + "/setPromptModelPinned", {
      username: creds.email,
      token: creds.token,
      edition: creds.edition,
      promptId: promptId,
      pinned: pinned ? "true" : "false"
    });
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
    VERSION: "1.0.0",
    cfg: cfg,
    waitForCreds: waitForCreds,
    fetchLists: fetchLists,
    fetchMemberAccess: fetchMemberAccess,
    duplicate: duplicate,
    setDefault: setDefault,
    setPinned: setPinned,
    modelId: modelId,
    isGenerationSafeId: isGenerationSafeId,
    assertGenerationId: assertGenerationId,
    ctaForLocked: ctaForLocked,
    absIconUrl: absIconUrl
  };
})(typeof window !== "undefined" ? window : globalThis);
