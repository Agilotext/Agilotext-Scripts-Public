/**
 * Ent - loader Webflow pour le streaming Speechmatics.
 * Ajoutez UNIQUEMENT ce script après ent.js dans Webflow.
 */
(function () {
  "use strict";

  var base =
    window.AGILO_SCRIPTS_BASE ||
    "https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main";

  var speechmaticsUrl = base + "/scripts/shared/speechmatics-streaming.js";
  var mountUrl = base + "/scripts/pages/dashboard/mount-streaming.js";
  var workletUrl = base + "/scripts/shared/pcm-audio-worklet.js";

  window.AGILO_PCM_WORKLET_URL = window.AGILO_PCM_WORKLET_URL || workletUrl;

  function loadScriptOnce(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[data-agilo-src="' + src + '"]')) {
        resolve();
        return;
      }
      var script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.dataset.agiloSrc = src;
      script.onload = function () { resolve(); };
      script.onerror = function () {
        reject(new Error("Impossible de charger: " + src));
      };
      document.body.appendChild(script);
    });
  }

  function start() {
    loadScriptOnce(speechmaticsUrl)
      .then(function () { return loadScriptOnce(mountUrl); })
      .catch(function (err) {
        console.error("[Agilotext] Streaming Ent loader error:", err);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
