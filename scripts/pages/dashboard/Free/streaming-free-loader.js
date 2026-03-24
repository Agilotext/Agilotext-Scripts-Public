/**
 * Free - loader Webflow pour la dictée vocale temps réel.
 * Ajoutez UNIQUEMENT ce script après free_v2.js dans Webflow.
 * Limites Free : 1 utilisation/jour, 30 minutes max.
 * Cache-bust : le loader ajoute ?v=BUILD aux URLs dynamiques.
 */
(function () {
  "use strict";

  var BUILD = "20260324f";

  var base =
    window.AGILO_SCRIPTS_BASE ||
    "https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main";

  function bust(url) { return url + "?v=" + BUILD; }

  var liveTranscribeUrl = bust(base + "/scripts/shared/agilo-live-transcribe.js");
  var mountUrl          = bust(base + "/scripts/pages/dashboard/mount-streaming.js");
  var workletUrl        = bust(base + "/scripts/shared/pcm-audio-worklet.js");

  window.AGILO_PCM_WORKLET_URL = window.AGILO_PCM_WORKLET_URL || workletUrl;

  window.__AGILO_DICTEE_LIMITS = {
    maxDurationSec: 1800,
    maxUsagesPerDay: 1,
    storageKey: "agilo_dictee_free_usage"
  };

  function loadScriptOnce(src) {
    var key = src.replace(/[?#].*$/, "");
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[data-agilo-src="' + key + '"]')) {
        resolve();
        return;
      }
      var script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.dataset.agiloSrc = key;
      script.onload = function () { resolve(); };
      script.onerror = function () {
        reject(new Error("Impossible de charger: " + src));
      };
      document.body.appendChild(script);
    });
  }

  function start() {
    loadScriptOnce(liveTranscribeUrl)
      .then(function () { return loadScriptOnce(mountUrl); })
      .then(function () {
        if (typeof window.AgiloLiveVoice === "undefined") {
          console.error("[Agilotext] agilo-live-transcribe.js chargé mais AgiloLiveVoice absent — cache CDN périmé ?");
        }
      })
      .catch(function (err) {
        console.error("[Agilotext] Streaming Free loader error:", err);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
