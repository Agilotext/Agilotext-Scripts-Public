/**
 * Sidecar Nico : POST /api/v1/formatInvestigationPv → DOCX habillé.
 * Allowlist promptid 705–712 (Bauer) et 713–720 (Magali). Pas 700/703/704/787/CSE.
 * N’écrit pas le compte rendu officiel.
 */
(function (root) {
  "use strict";

  var API_URL = "https://api.agilotext.com/api/v1/formatInvestigationPv";
  var TIMEOUT_MS = 60000;
  var LABEL_BUSY = "Préparation du Word";
  var LINK_LABEL = "PV d’enquête (Word)";
  var LINK_TITLE = "Propos tels quels, présentation du modèle";
  var LINK_CLASS = "download_wrapper-link_investigation_docx";
  var inFlight = Object.create(null);

  function toInt(id) {
    var n = Number(id);
    return Number.isFinite(n) ? n : 0;
  }

  function isInvestigationPvPromptId(id) {
    var n = toInt(id);
    return n >= 705 && n <= 720;
  }

  function isReadyStatus(status) {
    return String(status || "").toUpperCase().indexOf("READY_SUMMARY_") === 0;
  }

  function shouldShowInvestigationPvLink(promptId, status) {
    return isInvestigationPvPromptId(promptId) && isReadyStatus(status);
  }

  function buildFormBody(opts) {
    var body = new URLSearchParams();
    body.set("username", String(opts.username || ""));
    body.set("token", String(opts.token || ""));
    body.set("edition", String(opts.edition || "ent"));
    body.set("jobId", String(opts.jobId || ""));
    body.set("templateId", String(opts.templateId || ""));
    return body.toString();
  }

  function parseContentDispositionFilename(header, jobId) {
    var fallback = "PV_enquete_" + String(jobId || "job") + ".docx";
    var raw = String(header || "");
    if (!raw) return fallback;
    var star = raw.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
    if (star && star[1]) {
      try {
        return decodeURIComponent(star[1].trim().replace(/^["']|["']$/g, "")) || fallback;
      } catch (_) { /* ignore */ }
    }
    var plain = raw.match(/filename\s*=\s*([^;]+)/i);
    if (plain && plain[1]) {
      return plain[1].trim().replace(/^["']|["']$/g, "") || fallback;
    }
    return fallback;
  }

  function parseApiError(payload, httpStatus) {
    var data = payload;
    if (typeof payload === "string") {
      try { data = JSON.parse(payload); } catch (_) { data = null; }
    }
    var msg = "";
    if (data && typeof data === "object") {
      msg = String(data.errorMessage || data.message || data.error || "").trim();
    }
    if (!msg && typeof payload === "string") {
      msg = payload.trim().slice(0, 400);
    }
    if (!msg) {
      if (httpStatus === 409) msg = "La transcription n’est pas encore prête.";
      else if (httpStatus === 422) msg = "Ce modèle n’accepte pas ce formatage.";
      else if (httpStatus === 401) msg = "Session expirée. Rechargez la page.";
      else if (httpStatus === 404) msg = "Travail ou modèle introuvable.";
      else msg = "Impossible de préparer le Word (erreur " + String(httpStatus || "") + ").";
    }
    return {
      status: data && data.status != null ? data.status : httpStatus,
      code: data && data.code ? String(data.code) : "",
      errorMessage: msg
    };
  }

  function triggerBlobDownload(blob, filename) {
    if (typeof document === "undefined" || typeof URL === "undefined") return;
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      try { URL.revokeObjectURL(url); } catch (_) { /* ignore */ }
    }, 4000);
  }

  function looksLikeJson(blob, contentType, head) {
    var ct = String(contentType || "").toLowerCase();
    if (ct.indexOf("json") !== -1) return true;
    if (ct.indexOf("wordprocessingml") !== -1) return false;
    return String(head || "").charAt(0) === "{";
  }

  function downloadInvestigationPv(opts) {
    opts = opts || {};
    var jobId = String(opts.jobId || "");
    if (inFlight[jobId]) {
      return Promise.resolve({
        ok: false,
        busy: true,
        errorMessage: "Préparation du Word déjà en cours."
      });
    }
    if (!opts.username || !opts.token || !jobId || !opts.templateId) {
      return Promise.resolve({
        ok: false,
        errorMessage: "Identifiants manquants pour préparer le Word."
      });
    }

    inFlight[jobId] = true;
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = null;
    if (controller) {
      timer = setTimeout(function () {
        try { controller.abort(); } catch (_) { /* ignore */ }
      }, TIMEOUT_MS);
    }

    var fetchFn = opts.fetch || (typeof fetch === "function" ? fetch : null);
    if (!fetchFn) {
      inFlight[jobId] = false;
      return Promise.resolve({ ok: false, errorMessage: "Téléchargement indisponible dans cet environnement." });
    }

    return fetchFn(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Accept: "application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/json"
      },
      body: buildFormBody(opts),
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      var ct = res.headers && res.headers.get ? (res.headers.get("content-type") || "") : "";
      var cd = res.headers && res.headers.get ? (res.headers.get("content-disposition") || "") : "";
      return res.arrayBuffer().then(function (buf) {
        var head = "";
        try {
          head = String.fromCharCode.apply(null, Array.prototype.slice.call(new Uint8Array(buf), 0, 32));
        } catch (_) { head = ""; }
        var blob = new Blob([buf], { type: ct || "application/octet-stream" });
        return { res: res, ct: ct, cd: cd, blob: blob, head: head, buf: buf };
      });
    }).then(function (pack) {
      var jsonish = looksLikeJson(pack.blob, pack.ct, pack.head);
      if (!pack.res.ok || jsonish) {
        var text = "";
        try {
          text = new TextDecoder("utf-8").decode(pack.buf);
        } catch (_) {
          text = pack.head;
        }
        var err = parseApiError(text, pack.res.status);
        return { ok: false, httpStatus: pack.res.status, code: err.code, errorMessage: err.errorMessage };
      }
      var filename = parseContentDispositionFilename(pack.cd, jobId);
      if (typeof opts.triggerDownload === "function") {
        opts.triggerDownload(pack.blob, filename);
      } else {
        triggerBlobDownload(pack.blob, filename);
      }
      return { ok: true, filename: filename, blob: pack.blob };
    }).catch(function (e) {
      var aborted = e && (e.name === "AbortError" || /abort/i.test(String(e.message || "")));
      return {
        ok: false,
        errorMessage: aborted
          ? "Le Word a mis trop longtemps. Réessayez."
          : (e && e.message) || "Impossible de préparer le Word."
      };
    }).then(function (result) {
      if (timer) clearTimeout(timer);
      inFlight[jobId] = false;
      return result;
    });
  }

  function isBusy(jobId) {
    return !!inFlight[String(jobId || "")];
  }

  var api = {
    API_URL: API_URL,
    TIMEOUT_MS: TIMEOUT_MS,
    LABEL_BUSY: LABEL_BUSY,
    LINK_LABEL: LINK_LABEL,
    LINK_TITLE: LINK_TITLE,
    LINK_CLASS: LINK_CLASS,
    isInvestigationPvPromptId: isInvestigationPvPromptId,
    isReadyStatus: isReadyStatus,
    shouldShowInvestigationPvLink: shouldShowInvestigationPvLink,
    buildFormBody: buildFormBody,
    parseContentDispositionFilename: parseContentDispositionFilename,
    parseApiError: parseApiError,
    downloadInvestigationPv: downloadInvestigationPv,
    isBusy: isBusy
  };

  root.AgiloFormatInvestigationPv = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
