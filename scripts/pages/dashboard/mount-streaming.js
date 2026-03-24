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

    onError: function (key) {
      showError(key || "default");
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
      typeof window.globalToken !== "undefined" &&
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
