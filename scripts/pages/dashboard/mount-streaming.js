/**
 * mount-streaming.js
 * ──────────────────────────────────────────────────────────────────
 * Patch d'intégration pour ent.js / pro.js / free.js
 *
 * Ce code doit être ajouté à la fin du handler DOMContentLoaded
 * de chaque script dashboard. Il connecte speechmatics-streaming.js
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
 *   1. speechmatics-streaming.js
 *   2. ent.js / pro.js / free.js (qui contient ce patch)
 * ──────────────────────────────────────────────────────────────────
 */

// ── Appel API pour obtenir un JWT Speechmatics court ────────────
async function getSpeechmaticsRtJwt({ email, token, edition }) {
  const res = await fetch("https://api.agilotext.com/api/v1/getSpeechmaticsRtJwt", {
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
    throw new Error(data.errorMessage || "speechmatics_rt_jwt_failed");
  }
  return data;
}

// ── Montage du contrôleur Speechmatics ──────────────────────────
function mountSpeechmaticsStreaming() {
  var root = document.querySelector("[data-agilo-streaming-root]");
  if (!root || !window.AgiloSpeechmaticsStreaming) return;

  // URL du worklet — doit être HTTPS, même origine ou CORS OK
  var WORKLET_URL =
    window.AGILO_PCM_WORKLET_URL ||
    "https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/scripts/shared/pcm-audio-worklet.js";

  window.AgiloSpeechmaticsStreaming.mount({
    root: root,
    language: "fr",
    workletUrl: WORKLET_URL,

    // Authentification : revalide le token Agilotext puis obtient un JWT Speechmatics
    getAgiloAuth: async function (email) {
      var tokenOk = await ensureValidToken(email);
      if (!tokenOk || !globalToken) {
        throw new Error("invalidToken");
      }

      return getSpeechmaticsRtJwt({
        email: email,
        token: globalToken,
        edition: edition
      });
    },

    // Upload du WAV final vers le pipeline Agilotext existant
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

    // Callback quand l'upload est accepté → lance le polling standard
    onUploadAccepted: function ({ jobId, email }) {
      localStorage.setItem("currentJobId", jobId);
      document.dispatchEvent(new CustomEvent("newJobIdAvailable"));
      checkTranscriptStatus(jobId, email);
    },

    // Callback erreur → utilise le showError du dashboard
    onError: function (key) {
      showError(key || "default");
    }
  });
}

// Expose la fonction pour un appel manuel si besoin.
window.mountSpeechmaticsStreaming = mountSpeechmaticsStreaming;

// ── Auto-bootstrap (mode externe, sans patch direct ent/pro/free) ─
(function bootstrapSpeechmaticsMount() {
  var MAX_ATTEMPTS = 40;
  var RETRY_MS = 300;
  var attempt = 0;
  var mounted = false;

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
      window.AgiloSpeechmaticsStreaming &&
      document.querySelector("[data-agilo-streaming-root]")
    );
  }

  function tryMount() {
    if (mounted) return true;
    if (!hasDashboardDeps() || !hasStreamingDeps()) return false;
    try {
      mountSpeechmaticsStreaming();
      mounted = true;
      return true;
    } catch (err) {
      console.error("Speechmatics mount failed:", err);
      return false;
    }
  }

  function schedule() {
    if (tryMount()) return;
    attempt += 1;
    if (attempt >= MAX_ATTEMPTS) {
      console.warn("Speechmatics mount skipped: dependencies not ready.");
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
