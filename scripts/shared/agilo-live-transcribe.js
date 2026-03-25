/**
 * agilo-live-transcribe.js
 * ──────────────────────────────────────────────────────────────────
 * Client dictée vocale temps réel (WebSocket + worklet PCM).
 * Point d’ancrage : [data-agilo-streaming-root] (inchangé pour compat. Webflow).
 * Références DOM rafraîchies à chaque render (OpenTech / overlays qui recréent le DOM).
 * Après modification : recopier vers speechmatics-streaming.js (alias historique).
 * ──────────────────────────────────────────────────────────────────
 */
(function () {
  "use strict";

  /* ── Helpers ────────────────────────────────────────────────────── */

  function joinText(parts) {
    return parts
      .filter(Boolean)
      .join(" ")
      .replace(/\s+([,.;:!?])/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }

  function resultsToText(results) {
    if (!Array.isArray(results)) return "";
    return joinText(
      results.map(function (item) {
        return (item && item.alternatives && item.alternatives[0] && item.alternatives[0].content) || "";
      })
    );
  }

  /** Webflow peut déplacer le minuteur hors du nœud root : repli par id unique. */
  function queryTimerEl(root) {
    var el = root.querySelector("#agilo-streaming-timer");
    if (el) return el;
    el = document.getElementById("agilo-streaming-timer");
    return el || null;
  }

  /**
   * Rebuild a WAV blob from an array of PCM16 Int16Array chunks.
   * This replaces MediaRecorder — same audio data used for both
   * the live WebSocket stream and the final upload file.
   */
  function pcm16ChunksToWavBlob(chunks, sampleRate) {
    var sampleCount = chunks.reduce(function (sum, chunk) { return sum + chunk.length; }, 0);
    var buffer = new ArrayBuffer(44 + sampleCount * 2);
    var view = new DataView(buffer);

    function writeString(offset, value) {
      for (var i = 0; i < value.length; i += 1) {
        view.setUint8(offset + i, value.charCodeAt(i));
      }
    }

    writeString(0, "RIFF");
    view.setUint32(4, 36 + sampleCount * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);          // PCM
    view.setUint16(22, 1, true);          // mono
    view.setUint32(24, sampleRate, true); // sample rate
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true);          // block align
    view.setUint16(34, 16, true);         // bits per sample
    writeString(36, "data");
    view.setUint32(40, sampleCount * 2, true);

    var offset = 44;
    for (var c = 0; c < chunks.length; c++) {
      var chunk = chunks[c];
      for (var i = 0; i < chunk.length; i += 1) {
        view.setInt16(offset, chunk[i], true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: "audio/wav" });
  }


  /* ── Controller ─────────────────────────────────────────────────── */

  function AgiloLiveVoiceController(config) {
    this.config = config;
    this.root = config.root;
    this.limits = config.limits || null;
    this.state = {
      status: "idle",
      seqNo: 0,
      ws: null,
      wsEndPromise: null,
      wsEndResolve: null,
      audioContext: null,
      mediaStream: null,
      mediaSource: null,
      workletNode: null,
      muteGain: null,
      sampleRate: 16000,
      committedText: "",
      partialText: "",
      pcmChunks: [],
      email: ""
    };

    this.els = {};
    this._timerInterval = null;
    this._timerStart = 0;
    this._pausedElapsed = 0;

    this.refreshDomRefs();
    this.bind();
    this.render();
  }

  /** Ré-attache les nœuds visibles (outils UX / Webflow peuvent recréer le sous-arbre). */
  AgiloLiveVoiceController.prototype.refreshDomRefs = function () {
    var r = this.root;
    if (!r || !document.documentElement.contains(r)) {
      r =
        document.querySelector("[data-agilo-streaming-root]") ||
        document.getElementById("live-streaming-panel");
      this.root = r;
    }
    if (!r) {
      return;
    }
    this.els.start = r.querySelector("[data-agilo-streaming-start]");
    this.els.pause = r.querySelector("[data-agilo-streaming-pause]");
    this.els.resume = r.querySelector("[data-agilo-streaming-resume]");
    this.els.stop = r.querySelector("[data-agilo-streaming-stop]");
    this.els.status = r.querySelector("[data-agilo-streaming-status]");
    this.els.text = r.querySelector("[data-agilo-streaming-text]");
    this.els.timer = queryTimerEl(r);
    this.els.dot = r.querySelector("#dictee-status-dot");
    this.els.levelWrap = r.querySelector("#agilo-level-wrap");
    this.els.levelFill = r.querySelector("#agilo-level-fill");
    this.els.copyBtn = r.querySelector("#agilo-copy-btn");
    this.els.copyText = r.querySelector("#agilo-copy-btn-text");
  };

  /** Un seul listener document : les boutons remplacés par des clones restent utilisables. */
  AgiloLiveVoiceController.prototype.bind = function () {
    var self = this;
    this._onDocClick = function (e) {
      var root =
        (self.root && document.documentElement.contains(self.root) ? self.root : null) ||
        document.querySelector("[data-agilo-streaming-root]") ||
        document.getElementById("live-streaming-panel");
      if (!root || !root.contains(e.target)) return;

      if (e.target.closest("[data-agilo-streaming-start]")) {
        e.preventDefault();
        self.start();
        return;
      }
      if (e.target.closest("[data-agilo-streaming-pause]")) {
        e.preventDefault();
        self.pause();
        return;
      }
      if (e.target.closest("[data-agilo-streaming-resume]")) {
        e.preventDefault();
        self.resume();
        return;
      }
      if (e.target.closest("[data-agilo-streaming-stop]")) {
        e.preventDefault();
        self.stop();
        return;
      }

      var copyHit = e.target.closest("#agilo-copy-btn");
      if (copyHit && root.contains(copyHit)) {
        e.preventDefault();
        self.refreshDomRefs();
        var text = (self.els.text && self.els.text.value) || "";
        if (!text.trim()) return;
        navigator.clipboard.writeText(text).then(function () {
          self.refreshDomRefs();
          if (self.els.copyText) self.els.copyText.textContent = "Copié !";
          if (self.els.copyBtn) self.els.copyBtn.classList.add("copied");
          setTimeout(function () {
            self.refreshDomRefs();
            if (self.els.copyText) self.els.copyText.textContent = "Copier le texte";
            if (self.els.copyBtn) self.els.copyBtn.classList.remove("copied");
          }, 2000);
        });
      }
    };
    document.addEventListener("click", this._onDocClick, false);
  };

  AgiloLiveVoiceController.prototype.setStatus = function (status, label) {
    this.state.status = status;
    this.refreshDomRefs();
    if (this.els.status) this.els.status.textContent = label || status;
    this.render();
  };

  /** Webflow / thèmes mettent souvent display sur button en !important : le forcer côté script. */
  function setElDisplayImportant(el, value) {
    if (!el) return;
    if (value === "none") {
      el.style.setProperty("display", "none", "important");
    } else {
      el.style.setProperty("display", value, "important");
    }
  }

  AgiloLiveVoiceController.prototype.render = function () {
    this.refreshDomRefs();
    var s = this.state.status;
    var isIdle = s === "idle";
    var isRecording = s === "recording";
    var isPaused = s === "paused";
    var isUploading = s === "uploading";

    if (this.els.start) {
      this.els.start.disabled = !isIdle;
      setElDisplayImportant(this.els.start, isIdle ? "inline-flex" : "none");
    }
    if (this.els.pause) {
      this.els.pause.disabled = !isRecording;
      setElDisplayImportant(this.els.pause, isRecording ? "inline-flex" : "none");
    }
    if (this.els.resume) {
      this.els.resume.disabled = !isPaused;
      setElDisplayImportant(this.els.resume, isPaused ? "inline-flex" : "none");
    }
    if (this.els.stop) {
      this.els.stop.disabled = isIdle || isUploading;
      setElDisplayImportant(
        this.els.stop,
        (isRecording || isPaused || s === "connecting" || s === "initializing" || s === "pausing")
          ? "inline-flex"
          : "none"
      );
    }

    if (this.els.text) {
      this.els.text.readOnly = !isPaused;
    }

    if (this.els.dot) {
      this.els.dot.classList.toggle("listening", isRecording);
    }
    if (this.els.levelWrap) {
      if (isRecording) {
        this.els.levelWrap.style.removeProperty("display");
      } else {
        this.els.levelWrap.style.setProperty("display", "none", "important");
      }
    }
  };

  AgiloLiveVoiceController.prototype.startTimer = function () {
    var self = this;
    this._timerStart = Date.now() - (this._pausedElapsed || 0);
    if (this._timerInterval) clearInterval(this._timerInterval);
    this._timerInterval = setInterval(function () {
      self.refreshDomRefs();
      var elapsed = Math.floor((Date.now() - self._timerStart) / 1000);
      var mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
      var ss = String(elapsed % 60).padStart(2, "0");
      if (self.els.timer) {
        self.els.timer.innerHTML = mm + '<span class="sep">:</span>' + ss;
      }

      if (self.limits && self.limits.maxDurationSec && elapsed >= self.limits.maxDurationSec) {
        self.stop();
        if (self.config.onLimitReached) self.config.onLimitReached("max_duration");
      }
    }, 500);
  };

  AgiloLiveVoiceController.prototype.stopTimer = function () {
    if (this._timerInterval) {
      this._pausedElapsed = Date.now() - this._timerStart;
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  };

  AgiloLiveVoiceController.prototype.resetTimer = function () {
    if (this._timerInterval) clearInterval(this._timerInterval);
    this._timerInterval = null;
    this._pausedElapsed = 0;
    this._timerStart = 0;
    this.refreshDomRefs();
    if (this.els.timer) {
      this.els.timer.innerHTML = '00<span class="sep">:</span>00';
    }
  };

  AgiloLiveVoiceController.prototype.renderText = function () {
    this.refreshDomRefs();
    if (!this.els.text) return;
    this.els.text.value = joinText([
      this.state.committedText,
      this.state.partialText
    ]);
    var ta = this.els.text;
    if (ta.scrollHeight > ta.clientHeight) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight + 4, window.innerHeight * 0.5) + "px";
    }
  };

  AgiloLiveVoiceController.prototype._updateLevel = function (chunk) {
    this.refreshDomRefs();
    if (!this.els.levelFill) return;
    var sum = 0;
    for (var i = 0; i < chunk.length; i++) {
      sum += chunk[i] * chunk[i];
    }
    var rms = Math.sqrt(sum / chunk.length) / 32768;
    var pct = Math.min(100, Math.round(rms * 500));
    this.els.levelFill.style.width = pct + "%";
    var hue = pct < 60 ? 120 : pct < 85 ? 40 : 0;
    this.els.levelFill.style.backgroundColor = "hsl(" + hue + ",70%,45%)";
  };

  /**
   * Vérifie les limites d'utilisation (Free). Retourne true si autorisé.
   * Si refusé, appelle config.onLimitReached et retourne false.
   */
  AgiloLiveVoiceController.prototype._checkLimits = function () {
    if (!this.limits) return true;

    var key = this.limits.storageKey || "agilo_dictee_usage";
    var maxPerDay = this.limits.maxUsagesPerDay;
    var today = new Date().toISOString().slice(0, 10);
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(key)); } catch (e) {}

    if (!raw || raw.date !== today) {
      raw = { date: today, count: 0 };
    }

    if (typeof maxPerDay === "number" && raw.count >= maxPerDay) {
      if (this.config.onLimitReached) this.config.onLimitReached("max_daily_usage");
      return false;
    }

    raw.count += 1;
    try { localStorage.setItem(key, JSON.stringify(raw)); } catch (e) {}
    return true;
  };

  AgiloLiveVoiceController.prototype.getEmail = function () {
    var input = document.querySelector('input[name="memberEmail"]');
    return ((input && (input.value || input.getAttribute("src"))) || "").trim();
  };

  AgiloLiveVoiceController.prototype.getLanguage = function () {
    var input = document.querySelector('input[name="streamingLanguage"]');
    return ((input && input.value) || this.config.language || "fr").trim();
  };

  AgiloLiveVoiceController.prototype.getOptions = function () {
    var speakersCheckbox  = document.getElementById("toggle-speakers");
    var summaryCheckbox   = document.getElementById("toggle-summary");
    var formatCheckbox    = document.getElementById("toggle-format-transcript");
    var speakersSelect    = document.getElementById("speakers-select");
    var translateCheckbox = document.getElementById("toggle-translate");
    var translateSelect   = document.getElementById("translate-select");

    return {
      speakers:         !!(speakersCheckbox && speakersCheckbox.checked),
      doSummary:        !!(summaryCheckbox && summaryCheckbox.checked),
      formatTranscript: !!(formatCheckbox && formatCheckbox.checked),
      speakersExpected: Number((speakersSelect && speakersSelect.value) || 0),
      translateTo:      (translateCheckbox && translateCheckbox.checked && translateSelect && translateSelect.value)
                          ? translateSelect.value : ""
    };
  };


  /* ── Audio pipeline ─────────────────────────────────────────────── */

  AgiloLiveVoiceController.prototype.ensureAudioPipeline = function () {
    var self = this;
    if (this.state.audioContext) return Promise.resolve();

    return navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    }).then(function (mediaStream) {
      var audioContext = new AudioContext({ sampleRate: 16000 });

      return audioContext.audioWorklet.addModule(self.config.workletUrl).then(function () {
        var mediaSource = audioContext.createMediaStreamSource(mediaStream);
        var workletNode = new AudioWorkletNode(audioContext, "agilo-pcm-processor");
        var muteGain = audioContext.createGain();
        muteGain.gain.value = 0;

        workletNode.port.onmessage = function (event) {
          var chunk = new Int16Array(event.data);
          if (self.state.status !== "recording") return;

          self.state.pcmChunks.push(chunk);

          if (self.state.ws && self.state.ws.readyState === WebSocket.OPEN) {
            self.state.ws.send(chunk.buffer);
            self.state.seqNo += 1;
          }

          self._updateLevel(chunk);
        };

        mediaSource.connect(workletNode);
        workletNode.connect(muteGain);
        muteGain.connect(audioContext.destination);

        self.state.audioContext = audioContext;
        self.state.mediaStream = mediaStream;
        self.state.mediaSource = mediaSource;
        self.state.workletNode = workletNode;
        self.state.muteGain = muteGain;
        self.state.sampleRate = audioContext.sampleRate;
      });
    });
  };


  /* ── WebSocket session ──────────────────────────────────────────── */

  AgiloLiveVoiceController.prototype.openRealtimeSession = function () {
    var self = this;

    return this.config.getAgiloAuth(this.state.email).then(function (auth) {
      return new Promise(function (resolve, reject) {
        var ws = new WebSocket(
          auth.websocketUrl + "?jwt=" + encodeURIComponent(auth.jwt)
        );

        self.state.ws = ws;
        self.state.seqNo = 0;

        ws.addEventListener("open", function () {
          ws.send(JSON.stringify({
            message: "StartRecognition",
            audio_format: {
              type: "raw",
              encoding: "pcm_s16le",
              sample_rate: self.state.sampleRate
            },
            transcription_config: {
              language: self.getLanguage(),
              operating_point: "enhanced",
              enable_partials: true,
              max_delay: 1.0,
              max_delay_mode: "flexible"
            }
          }));
        });

        ws.addEventListener("message", function (evt) {
          var msg;
          try { msg = JSON.parse(evt.data); } catch (e) { return; }

          if (msg.message === "RecognitionStarted") {
            resolve();
            return;
          }

          if (msg.message === "AddPartialTranscript") {
            self.state.partialText = resultsToText(msg.results || []);
            self.renderText();
            return;
          }

          if (msg.message === "AddTranscript") {
            var finalText = resultsToText(msg.results || []);
            self.state.committedText = joinText([
              self.state.committedText,
              finalText
            ]);
            self.state.partialText = "";
            self.renderText();
            return;
          }

          if (msg.message === "EndOfTranscript") {
            if (self.state.wsEndResolve) self.state.wsEndResolve();
            return;
          }

          if (msg.message === "Error") {
            reject(new Error(msg.reason || "rt_stream_error"));
          }
        });

        ws.addEventListener("error", function () {
          reject(new Error("rt_channel_error"));
        });

        ws.addEventListener("close", function () {
          if (self.state.status === "recording") {
            if (self.config.onError) self.config.onError("default");
          }
        });
      });
    });
  };

  AgiloLiveVoiceController.prototype.closeRealtimeSession = function () {
    var self = this;
    var ws = this.state.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      this.state.ws = null;
      return Promise.resolve();
    }

    this.state.wsEndPromise = new Promise(function (resolve) {
      self.state.wsEndResolve = resolve;
    });

    ws.send(JSON.stringify({
      message: "EndOfStream",
      last_seq_no: this.state.seqNo
    }));

    return this.state.wsEndPromise.catch(function () {}).then(function () {
      ws.close();
      self.state.ws = null;
      self.state.wsEndPromise = null;
      self.state.wsEndResolve = null;
      self.state.partialText = "";
      self.renderText();
    });
  };


  /* ── Actions ────────────────────────────────────────────────────── */

  AgiloLiveVoiceController.prototype.start = function () {
    var self = this;

    if (!this._checkLimits()) return;

    this.state.email = this.getEmail();
    if (!this.state.email) {
      if (this.config.onError) this.config.onError("invalidToken");
      return;
    }

    this.state.committedText = "";
    this.state.partialText = "";
    this.state.pcmChunks = [];
    this.renderText();

    this.setStatus("initializing", "Initialisation micro...");

    this.ensureAudioPipeline()
      .then(function () {
        self.setStatus("connecting", "Connexion au service vocal en direct...");
        return self.openRealtimeSession();
      })
      .then(function () {
        return self.state.audioContext.resume();
      })
      .then(function () {
        self.setStatus("recording", "En écoute...");
        self.startTimer();
      })
      .catch(function (err) {
        console.error(err);
        self.resetTimer();
        var msg = (err && err.message) || "";
        if (msg === "rt_channel_error" || msg === "rt_stream_error") {
          self.setStatus("idle", "Connexion bloquée");
          if (self.config.onNetworkBlocked) {
            self.config.onNetworkBlocked(msg);
          } else if (self.config.onError) {
            self.config.onError("default");
          }
        } else if (msg === "NotAllowedError" || msg === "Permission denied" ||
                   (err && err.name === "NotAllowedError")) {
          self.setStatus("idle", "Micro refusé");
          if (self.config.onError) self.config.onError("default");
        } else {
          self.setStatus("idle", "Erreur");
          if (self.config.onError) self.config.onError("default");
        }
      });
  };

  AgiloLiveVoiceController.prototype.pause = function () {
    if (this.state.status !== "recording") return;
    var self = this;

    this.setStatus("pausing", "Pause...");

    this.state.audioContext.suspend()
      .then(function () { return self.closeRealtimeSession(); })
      .then(function () { self.stopTimer(); self.setStatus("paused", "Pause — texte éditable"); })
      .catch(function (err) {
        console.error(err);
        if (self.config.onError) self.config.onError("default");
      });
  };

  AgiloLiveVoiceController.prototype.resume = function () {
    if (this.state.status !== "paused") return;
    var self = this;

    this.refreshDomRefs();
    // Prendre le texte édité comme nouvelle base
    this.state.committedText = ((this.els.text && this.els.text.value) || "").trim();
    this.state.partialText = "";
    this.renderText();

    this.setStatus("connecting", "Reconnexion au service vocal...");

    this.openRealtimeSession()
      .then(function () { return self.state.audioContext.resume(); })
      .then(function () { self.setStatus("recording", "En écoute..."); self.startTimer(); })
      .catch(function (err) {
        console.error(err);
        var msg = (err && err.message) || "";
        if (msg === "rt_channel_error" || msg === "rt_stream_error") {
          self.setStatus("paused", "Connexion bloquée");
          if (self.config.onNetworkBlocked) self.config.onNetworkBlocked(msg);
          else if (self.config.onError) self.config.onError("default");
        } else {
          if (self.config.onError) self.config.onError("default");
        }
      });
  };

  AgiloLiveVoiceController.prototype.stop = function () {
    if (this.state.status === "idle" || this.state.status === "uploading") return;
    var self = this;

    var suspendPromise = (this.state.audioContext && this.state.status === "recording")
      ? this.state.audioContext.suspend().then(function () { return self.closeRealtimeSession(); })
      : Promise.resolve();

    suspendPromise
      .then(function () {
        self.stopTimer();
        self.setStatus("uploading", "Préparation du fichier...");
        if (self.config.onStopBegin) self.config.onStopBegin();

        self.state.committedText = ((self.els.text && self.els.text.value) || "").trim();
        self.state.partialText = "";
        self.renderText();

        if (self.els.levelFill) self.els.levelFill.style.width = "0%";

        var blob = pcm16ChunksToWavBlob(self.state.pcmChunks, self.state.sampleRate);
        var filename = "agilotext-live-" + Date.now() + ".wav";

        if (self.config.onLocalAudioReady) {
          self.config.onLocalAudioReady({ blob: blob, filename: filename });
        }

        self.setStatus("uploading", "Upload vers Agilotext...");
        return self.config.uploadBlob({
          blob: blob,
          email: self.state.email,
          options: self.getOptions()
        });
      })
      .then(function (response) {
        if (!response || response.status !== "OK") {
          var apiErr = new Error((response && response.errorMessage) || "upload_failed");
          apiErr._agiloErrorMessage = (response && response.errorMessage) || "";
          throw apiErr;
        }

        var jobId = response.jobIdList && response.jobIdList[0];
        if (!jobId) throw new Error("missing_job_id");

        return self.teardownAudio().then(function () {
          self.resetTimer();
          self.setStatus("idle", "Envoyé avec succès !");
          if (self.config.onUploadAccepted) {
            self.config.onUploadAccepted({ jobId: jobId, email: self.state.email });
          }
        });
      })
      .catch(function (err) {
        console.error("Agilo live voice upload error:", err);
        var rawMessage = (err && err._agiloErrorMessage) || (err && err.message) || "";
        if (!rawMessage && err && err.type) {
          rawMessage = "__network__:" + err.type;
        }
        self.teardownAudio().then(function () {
          self.resetTimer();
          self.setStatus("idle", "Erreur");
          if (self.config.onStopEnd) self.config.onStopEnd();
          if (self.config.onError) self.config.onError(rawMessage);
        });
      });
  };


  /* ── Teardown ───────────────────────────────────────────────────── */

  AgiloLiveVoiceController.prototype.teardownAudio = function () {
    try { this.state.workletNode && this.state.workletNode.disconnect(); } catch (e) {}
    try { this.state.mediaSource && this.state.mediaSource.disconnect(); } catch (e) {}
    try { this.state.muteGain && this.state.muteGain.disconnect(); } catch (e) {}

    if (this.state.mediaStream) {
      this.state.mediaStream.getTracks().forEach(function (track) { track.stop(); });
    }

    var closePromise = this.state.audioContext
      ? this.state.audioContext.close().catch(function () {})
      : Promise.resolve();

    this.state.audioContext = null;
    this.state.mediaStream = null;
    this.state.mediaSource = null;
    this.state.workletNode = null;
    this.state.muteGain = null;
    this.state.ws = null;

    return closePromise;
  };


  /* ── Public API ─────────────────────────────────────────────────── */

  window.AgiloLiveVoice = {
    mount: function (config) {
      if (!config || !config.root) {
        throw new Error("AgiloLiveVoice: root manquant");
      }
      return new AgiloLiveVoiceController(config);
    }
  };

})();
