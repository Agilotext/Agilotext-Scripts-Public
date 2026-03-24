/**
 * mount-streaming.js
 * ──────────────────────────────────────────────────────────────────
 * Patch d'intégration pour ent.js / pro.js / free.js
 *
 * Ce code doit être ajouté à la fin du handler DOMContentLoaded
 * de chaque script dashboard. Il connecte agilo-live-transcribe.js
 * aux helpers existants du dashboard (token, upload, polling).
 *
 * DÉPENDANCES (déjà présentes dans ent/pro/free.js) :
 *   - ensureValidToken(email)   → renouvelle globalToken si expiré
 *   - sendWithRetry(formData, retries, flag)
 *   - checkTranscriptStatus(jobId, email)
 *   - showError(key)
 *   - globalToken, edition, window.DEVICE_ID
 *
 * SCRIPTS À CHARGER AVANT (dans cet ordre) :
 *   1. agilo-live-transcribe.js (ou speechmatics-streaming.js → shim)
 *   2. ent.js / pro.js / free.js (qui contient ce patch)
 *
 * Optionnel : window.AGILO_LIVE_VOICE_JWT_URL — URL POST JSON complète pour
 * obtenir { jwt, websocketUrl, ... } si vous exposez un alias côté API.
 * ──────────────────────────────────────────────────────────────────
 */

// ── Session temps réel (JWT + URL WebSocket fournis par l’API Agilotext) ─
async function fetchAgiloLiveVoiceSession({ email, token, edition }) {
  var jwtUrl =
    window.AGILO_LIVE_VOICE_JWT_URL ||
    "https://api.agilotext.com/api/v1/getSpeechmaticsRtJwt";

  const res = await fetch(jwtUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: email,
      token: token,
      edition: edition
    })
  });

  const data = await res.json();
  if (!res.ok || data.status !== "OK" || !data.jwt) {
    throw new Error(data.errorMessage || "live_voice_jwt_failed");
  }
  return data;
}

// ── Popup d'upsell Free (limites dictée) ────────────────────────
function showDicteeLimitModal(reason) {
  if (document.getElementById("agilo-dictee-limit-modal")) return;

  var isDaily = reason === "max_daily_usage";
  var title = isDaily
    ? "Limite quotidienne atteinte"
    : "Durée maximale atteinte (30 min)";
  var desc = isDaily
    ? "Vous avez utilisé votre <strong>dictée en direct gratuite</strong> pour aujourd'hui. Passez en Pro pour un accès illimité, ou en Business pour des comptes rendus avec l'IA Mistral 100% française."
    : "La durée maximale de <strong>30 minutes</strong> a été atteinte. Votre dictée a été envoyée pour transcription. Pour des dictées plus longues, passez à un abonnement supérieur.";

  var overlay = document.createElement("div");
  overlay.id = "agilo-dictee-limit-modal";
  overlay.style.cssText = "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(4px);animation:agiloFadeIn .2s ease";

  var panel = document.createElement("div");
  panel.style.cssText = "position:relative;background:#fff;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,.18);width:min(460px,92vw);padding:2.2rem 2rem 1.8rem;text-align:center;font-family:inherit;animation:agiloSlideUp .25s ease";

  var closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Fermer");
  closeBtn.style.cssText = "position:absolute;top:.6rem;right:.7rem;background:none;border:none;font-size:1.5rem;cursor:pointer;color:#888;line-height:1;padding:.25rem";
  closeBtn.textContent = "\u00D7";
  closeBtn.onclick = function () { overlay.remove(); };

  var icon = document.createElement("div");
  icon.style.cssText = "font-size:2.5rem;margin-bottom:.6rem";
  icon.textContent = isDaily ? "\u26A0\uFE0F" : "\u23F1\uFE0F";

  var h3 = document.createElement("h3");
  h3.style.cssText = "margin:0 0 .6rem;font-size:1.1rem;font-weight:700;color:#020202";
  h3.textContent = title;

  var p = document.createElement("p");
  p.style.cssText = "margin:0 0 1.4rem;font-size:.88rem;line-height:1.55;color:#525252";
  p.innerHTML = desc;

  var btnPro = document.createElement("button");
  btnPro.type = "button";
  btnPro.setAttribute("data-ms-price:update", "prc_pro-qn9f07eb");
  btnPro.style.cssText = "display:flex;align-items:center;justify-content:center;gap:.4rem;width:100%;padding:.75rem 1rem;background:#174a96;color:#fff;border:none;border-radius:10px;font-size:.92rem;font-weight:600;cursor:pointer;font-family:inherit;transition:background .2s";
  btnPro.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#fff"><rect fill="none" height="24" width="24"/><path d="M9.68,13.69L12,11.93l2.31,1.76-.88-2.85L15.75,9h-2.84L12,6.19 11.09,9H8.25l2.31,1.84-.88,2.85zM20,10c0-4.42-3.58-8-8-8s-8,3.58-8,8c0,2.03.76,3.87,2,5.28V23l6-2 6,2v-7.72C19.24,13.87,20,12.03,20,10zM12,4c3.31,0,6,2.69,6,6s-2.69,6-6,6-6-2.69-6-6S8.69,4,12,4z"/></svg> Passer en Pro \u2014 7 jours gratuits';
  btnPro.onmouseover = function () { btnPro.style.background = "#12397A"; };
  btnPro.onmouseout = function () { btnPro.style.background = "#174a96"; };
  btnPro.onclick = function () {
    overlay.remove();
    var existing = document.querySelector('[data-ms-price\\:update^="prc_pro-"]');
    if (existing && existing !== btnPro) { existing.click(); return; }
    var link = document.querySelector('a[href*="sign-up-pro"]');
    if (link) { link.click(); return; }
    window.location.href = "/auth/sign-up-pro";
  };

  var btnBiz = document.createElement("button");
  btnBiz.type = "button";
  btnBiz.setAttribute("data-ms-price:update", "prc_business-1-seat-aj1780sye");
  btnBiz.style.cssText = "display:flex;align-items:center;justify-content:center;gap:.4rem;width:100%;padding:.65rem 1rem;margin-top:.55rem;background:transparent;color:#174a96;border:1.5px solid #174a96;border-radius:10px;font-size:.85rem;font-weight:600;cursor:pointer;font-family:inherit;transition:background .2s,color .2s";
  btnBiz.textContent = "Ou en Business (100% fran\u00E7ais, IA Mistral)";
  btnBiz.onmouseover = function () { btnBiz.style.background = "#174a96"; btnBiz.style.color = "#fff"; };
  btnBiz.onmouseout = function () { btnBiz.style.background = "transparent"; btnBiz.style.color = "#174a96"; };
  btnBiz.onclick = function () {
    overlay.remove();
    var existing = document.querySelector('[data-ms-price\\:update^="prc_business-"]');
    if (existing && existing !== btnBiz) { existing.click(); return; }
    var link = document.querySelector('a[href*="sign-up-business"]');
    if (link) { link.click(); return; }
  };

  var later = document.createElement("button");
  later.type = "button";
  later.style.cssText = "display:block;margin:.8rem auto 0;background:none;border:none;font-size:.78rem;color:#888;cursor:pointer;font-family:inherit;text-decoration:underline";
  later.textContent = "Plus tard";
  later.onclick = function () { overlay.remove(); };

  panel.appendChild(closeBtn);
  panel.appendChild(icon);
  panel.appendChild(h3);
  panel.appendChild(p);
  panel.appendChild(btnPro);
  panel.appendChild(btnBiz);
  panel.appendChild(later);
  overlay.appendChild(panel);

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) overlay.remove();
  });

  if (!document.getElementById("agilo-limit-modal-anim")) {
    var style = document.createElement("style");
    style.id = "agilo-limit-modal-anim";
    style.textContent = "@keyframes agiloFadeIn{from{opacity:0}to{opacity:1}}@keyframes agiloSlideUp{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}";
    document.head.appendChild(style);
  }

  document.body.appendChild(overlay);
}

/**
 * Même logique que le bloc « else » après sendWithRetry dans pro_v2.js / free_v2.js /
 * upload_ent_v2.js (erreurs API + préfixes __network__: pour fetchWithTimeout).
 */
function mapDicteeUploadErrorToShowErrorKey(raw) {
  var err = raw || "";
  if (err.indexOf("__network__:") === 0) {
    var nt = err.replace("__network__:", "");
    if (nt === "offline") return { key: "offline" };
    if (nt === "timeout") return { key: "timeout" };
    if (nt === "invalidToken") return { key: "invalidToken" };
    if (nt === "tooMuchTraffic") return { key: "tooMuchTraffic" };
    if (nt === "serverError") return { key: "serverError" };
    if (nt === "httpError") return { key: "httpError" };
    if (nt === "unreachable") return { key: "unreachable" };
    return { key: "default" };
  }

  if (err === "error_too_much_traffic") return { key: "tooMuchTraffic" };
  if (
    err.indexOf("error_account_pending_validation") !== -1 ||
    err.indexOf("error_limit_reached_for_user") !== -1 ||
    err.indexOf("error_quota_exceeded") !== -1 ||
    err.indexOf("error_pro_quota_exceeded") !== -1 ||
    err.indexOf("error_subscription_quota") !== -1 ||
    err.indexOf("error_plan_limit_reached") !== -1 ||
    err.indexOf("error_subscription_limit") !== -1 ||
    err.indexOf("error_limit_reached") !== -1
  ) {
    return { key: "tooMuchTraffic" };
  }
  if (err.indexOf("error_duration_is_too_long_for_summary") !== -1) return { key: "summaryLimit" };
  if (err.indexOf("error_duration_is_too_long") !== -1 || err.indexOf("error_max_duration_exceeded") !== -1) {
    return { key: "audioTooLong" };
  }
  if (err.indexOf("error_transcript_too_long_for_summary") !== -1) return { key: "summaryLimit" };
  if (err.indexOf("error_audio_format_not_supported") !== -1 || err.indexOf("error_max_file_size_exceeded") !== -1) {
    return { key: "audioFormat" };
  }
  if (err.indexOf("error_invalid_audio_file_content") !== -1) return { key: "invalidAudioContent" };
  if (err.indexOf("error_silent_audio_file") !== -1) return { key: "audioFormat" };
  if (err.indexOf("error_audio_file_not_found") !== -1) return { key: "audioNotFound" };
  if (err.indexOf("error_invalid_token") !== -1) return { key: "invalidToken" };
  if (
    err.indexOf("error_too_many_hours_for_last_30_days") !== -1 ||
    err.indexOf("error_quota_exceeded") !== -1 ||
    err.indexOf("error_pro_quota_exceeded") !== -1 ||
    err.indexOf("error_subscription_quota") !== -1 ||
    err.indexOf("error_plan_limit_reached") !== -1 ||
    err.indexOf("error_subscription_limit") !== -1 ||
    err.indexOf("error_limit_reached") !== -1
  ) {
    return { key: "tooManyHours" };
  }
  if (err.indexOf("error_too_many_devices_used_for_account") !== -1) {
    return { key: "default", alertMsg: "Trop d'appareils utilisés pour ce compte. Veuillez contacter le support." };
  }
  if (err.indexOf("error_too_many_calls") !== -1) return { key: "tooMuchTraffic" };
  var el = err.toLowerCase();
  if (err.indexOf("ERROR_INVALID_YOUTUBE_URL") !== -1 || (el.indexOf("youtube") !== -1 && el.indexOf("invalid") !== -1)) {
    return { key: "youtubeInvalid" };
  }
  if (
    err.indexOf("ERROR_CANNOT_DONWLOAD_YOUTUBE_URL") !== -1 ||
    err.indexOf("ERROR_CANNOT_DOWNLOAD_YOUTUBE_URL") !== -1 ||
    (el.indexOf("youtube") !== -1 && el.indexOf("private") !== -1)
  ) {
    return { key: "youtubePrivate" };
  }
  if (el.indexOf("youtube") !== -1 && el.indexOf("not found") !== -1) return { key: "youtubeNotFound" };
  if (err && String(err).trim()) {
    return { key: "default", alertMsg: "Erreur: " + err };
  }
  return { key: "default" };
}

// ── Montage du contrôleur dictée live ────────────────────────────
function mountAgiloLiveVoice() {
  if (window.__agiloLiveVoiceMounted) return;
  var root = document.querySelector("[data-agilo-streaming-root]");
  if (!root || !window.AgiloLiveVoice) return;

  // URL du worklet — doit être HTTPS, même origine ou CORS OK
  var WORKLET_URL =
    window.AGILO_PCM_WORKLET_URL ||
    "https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/scripts/shared/pcm-audio-worklet.js";

  var liveCtrl = window.AgiloLiveVoice.mount({
    root: root,
    language: "fr",
    workletUrl: WORKLET_URL,
    limits: window.__AGILO_DICTEE_LIMITS || null,

    getAgiloAuth: async function (email) {
      var tokenOk = await ensureValidToken(email);
      if (!tokenOk || !globalToken) {
        throw new Error("invalidToken");
      }

      return fetchAgiloLiveVoiceSession({
        email: email,
        token: globalToken,
        edition: edition
      });
    },

    uploadBlob: async function ({ blob, email, options }) {
      await ensureValidToken(email);

      var fd = new FormData();

      fd.append(
        "fileUpload1",
        new File(
          [blob],
          "agilotext-live-" + Date.now() + ".wav",
          { type: "audio/wav" }
        )
      );

      fd.append("username", email);
      fd.append("token", globalToken);
      fd.append("edition", edition);
      fd.append("timestampTranscript", options.speakers ? "true" : "false");
      fd.append(
        "formatTranscript",
        options.speakers ? "false" : (options.formatTranscript ? "true" : "false")
      );
      fd.append("doSummary", options.doSummary ? "true" : "false");
      fd.append("mailTranscription", "true");

      if (window.DEVICE_ID) {
        fd.append("deviceId", window.DEVICE_ID);
      }

      if (options.speakers) {
        fd.append("speakersExpected", String(options.speakersExpected || 0));
      }

      if (options.translateTo) {
        fd.append("translateTo", options.translateTo);
      }

      return sendWithRetry(fd, 3, false);
    },

    onLocalAudioReady: function ({ blob, filename }) {
      try {
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
      } catch (e) {
        console.warn("Local audio download failed:", e);
      }
    },

    onStopBegin: function () {
      var fl = document.getElementById("form_loading");
      if (fl) fl.style.display = "block";
    },

    onStopEnd: function () {
      var fl = document.getElementById("form_loading");
      if (fl) fl.style.display = "none";
    },

    onUploadAccepted: function ({ jobId, email }) {
      localStorage.setItem("currentJobId", jobId);
      document.dispatchEvent(new CustomEvent("newJobIdAvailable"));

      var fl = document.getElementById("form_loading");
      if (fl) fl.style.display = "none";

      var successDiv = document.getElementById("form_success");
      var loadingAnimDiv = document.getElementById("loading_animation");
      if (successDiv) successDiv.style.display = "flex";
      if (loadingAnimDiv) {
        loadingAnimDiv.style.display = "block";
        window.scrollTo({
          top: loadingAnimDiv.getBoundingClientRect().top + window.pageYOffset - 80,
          behavior: "smooth"
        });
      }

      checkTranscriptStatus(jobId, email);
    },

    onLimitReached: function (reason) {
      showDicteeLimitModal(reason);
    },

    onError: function (rawApiMessage) {
      var mapped = mapDicteeUploadErrorToShowErrorKey(rawApiMessage);
      showError(mapped.key);
      if (mapped.alertMsg) alert(mapped.alertMsg);
    }
  });
  /** Débogage console : __agiloLiveVoiceInstance.state.status, .render(), etc. */
  window.__agiloLiveVoiceInstance = liveCtrl;
  window.__agiloLiveVoiceMounted = true;
}

window.mountAgiloLiveVoice = mountAgiloLiveVoice;

// ── Auto-bootstrap (mode externe, sans patch direct ent/pro/free) ─
(function bootstrapAgiloLiveVoice() {
  var MAX_ATTEMPTS = 80;
  var RETRY_MS = 250;
  var attempt = 0;

  function hasDashboardDeps() {
    return (
      typeof window.ensureValidToken === "function" &&
      typeof window.sendWithRetry === "function" &&
      typeof window.checkTranscriptStatus === "function" &&
      typeof window.showError === "function" &&
      typeof window.edition !== "undefined"
    );
  }

  function hasStreamingDeps() {
    return !!(
      window.AgiloLiveVoice &&
      document.querySelector("[data-agilo-streaming-root]")
    );
  }

  function tryMount() {
    if (window.__agiloLiveVoiceMounted) return true;
    if (!hasDashboardDeps() || !hasStreamingDeps()) return false;
    try {
      mountAgiloLiveVoice();
    } catch (err) {
      console.error("Agilo live voice mount failed:", err);
      return false;
    }
    return !!window.__agiloLiveVoiceMounted;
  }

  function schedule() {
    if (tryMount()) return;
    attempt += 1;
    if (attempt >= MAX_ATTEMPTS) {
      console.warn("Agilo live voice mount skipped: dependencies not ready.");
      return;
    }
    setTimeout(schedule, RETRY_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule, { once: true });
  } else {
    schedule();
  }
})();
