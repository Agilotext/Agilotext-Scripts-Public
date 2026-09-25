/**
 * Ent - loader Webflow pour la dictée vocale (Réunion / Carnet).
 * SHA du commit piné en dur. Les URLs transcribe, usages, picker, mount et worklet partent de ce PIN.
 */
(function () {
  "use strict";

  var BUILD = "20260925solo3";
  var PIN = "f9b583be5733074115df0ca3cc229213b3ae7eb9";
  var CDN = "https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@" + PIN;

  function bust(path) {
    return CDN + path + "?v=" + BUILD;
  }

  var liveTranscribeUrl = bust("/scripts/shared/agilo-live-transcribe.js");
  var usagesUrl = bust("/scripts/pages/dashboard/dictee-usages.js");
  var pickerUrl = bust("/scripts/pages/dashboard/dictee-carnet-picker.js");
  var soloAudioUrl = bust("/scripts/pages/dashboard/dictee-solo-audio.js");
  var soloDocumentUrl = bust("/scripts/pages/dashboard/dictee-solo-document.js");
  var mountUrl = bust("/scripts/pages/dashboard/mount-streaming.js");
  var workletUrl = bust("/scripts/shared/pcm-audio-worklet.js");

  window.AGILO_PCM_WORKLET_URL = workletUrl;

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
      .then(function () { return loadScriptOnce(usagesUrl); })
      .then(function () { return loadScriptOnce(pickerUrl); })
      .then(function () { return loadScriptOnce(soloAudioUrl); })
      .then(function () { return loadScriptOnce(soloDocumentUrl); })
      .then(function () { return loadScriptOnce(mountUrl); })
      .then(function () {
        if (typeof window.AgiloLiveVoice === "undefined") {
          console.error("[Agilotext] agilo-live-transcribe.js chargé mais AgiloLiveVoice absent — cache CDN périmé ?");
        }
      })
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
