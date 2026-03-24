/**
 * speechmatics-streaming.js
 * ──────────────────────────────────────────────────────────────────
 * Client-side Speechmatics Realtime streaming controller.
 * Mounts on any DOM element with [data-agilo-streaming-root].
 *
 * Source: Nicolas — webflow-speechmatics-streaming-florian-v2.md
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

  function AgiloSpeechmaticsStreamingController(config) {
    this.config = config;
    this.root = config.root;
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

    this.els = {
      start:  this.root.querySelector("[data-agilo-streaming-start]"),
      pause:  this.root.querySelector("[data-agilo-streaming-pause]"),
      resume: this.root.querySelector("[data-agilo-streaming-resume]"),
      stop:   this.root.querySelector("[data-agilo-streaming-stop]"),
      status: this.root.querySelector("[data-agilo-streaming-status]"),
      text:   this.root.querySelector("[data-agilo-streaming-text]"),
      timer:  this.root.querySelector("#agilo-streaming-timer"),
      dot:    this.root.querySelector("#dictee-status-dot"),
      levelWrap: this.root.querySelector("#agilo-level-wrap"),
      levelFill: this.root.querySelector("#agilo-level-fill")
    };

    this._timerInterval = null;
    this._timerStart = 0;

    this.bind();
    this.render();
  }

  AgiloSpeechmaticsStreamingController.prototype.bind = function () {
    var self = this;
    this.els.start.addEventListener("click", function () { self.start(); });
    this.els.pause.addEventListener("click", function () { self.pause(); });
    this.els.resume.addEventListener("click", function () { self.resume(); });
    this.els.stop.addEventListener("click", function () { self.stop(); });
  };

  AgiloSpeechmaticsStreamingController.prototype.setStatus = function (status, label) {
    this.state.status = status;
    if (this.els.status) this.els.status.textContent = label || status;
    this.render();
  };

  AgiloSpeechmaticsStreamingController.prototype.render = function () {
    var s = this.state.status;
    var isIdle = s === "idle";
    var isRecording = s === "recording";
    var isPaused = s === "paused";
    var isUploading = s === "uploading";

    this.els.start.disabled  = !isIdle;
    this.els.pause.disabled  = !isRecording;
    this.els.resume.disabled = !isPaused;
    this.els.stop.disabled   = isIdle || isUploading;

    this.els.start.style.display  = isIdle ? "flex" : "none";
    this.els.pause.style.display  = isRecording ? "flex" : "none";
    this.els.resume.style.display = isPaused ? "flex" : "none";
    this.els.stop.style.display   = (isRecording || isPaused || s === "connecting" || s === "initializing" || s === "pausing") ? "flex" : "none";

    this.els.text.readOnly = !isPaused;

    if (this.els.dot) {
      this.els.dot.classList.toggle("listening", isRecording);
    }
    if (this.els.levelWrap) {
      this.els.levelWrap.style.display = isRecording ? "" : "none";
    }
  };

  AgiloSpeechmaticsStreamingController.prototype.startTimer = function () {
    var self = this;
    this._timerStart = Date.now();
    if (this._timerInterval) clearInterval(this._timerInterval);
    this._timerInterval = setInterval(function () {
      var elapsed = Math.floor((Date.now() - self._timerStart) / 1000);
      var mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
      var ss = String(elapsed % 60).padStart(2, "0");
      if (self.els.timer) {
        self.els.timer.innerHTML = mm + '<span class="sep">:</span>' + ss;
      }
    }, 500);
  };

  AgiloSpeechmaticsStreamingController.prototype.stopTimer = function () {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  };

  AgiloSpeechmaticsStreamingController.prototype.resetTimer = function () {
    this.stopTimer();
    if (this.els.timer) {
      this.els.timer.innerHTML = '00<span class="sep">:</span>00';
    }
  };

  AgiloSpeechmaticsStreamingController.prototype.renderText = function () {
    this.els.text.value = joinText([
      this.state.committedText,
      this.state.partialText
    ]);
  };

  AgiloSpeechmaticsStreamingController.prototype.getEmail = function () {
    var input = document.querySelector('input[name="memberEmail"]');
    return ((input && (input.value || input.getAttribute("src"))) || "").trim();
  };

  AgiloSpeechmaticsStreamingController.prototype.getLanguage = function () {
    var input = document.querySelector('input[name="streamingLanguage"]');
    return ((input && input.value) || this.config.language || "fr").trim();
  };

  AgiloSpeechmaticsStreamingController.prototype.getOptions = function () {
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

  AgiloSpeechmaticsStreamingController.prototype.ensureAudioPipeline = function () {
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

  AgiloSpeechmaticsStreamingController.prototype.openRealtimeSession = function () {
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
            reject(new Error(msg.reason || "speechmatics_rt_error"));
          }
        });

        ws.addEventListener("error", function () {
          reject(new Error("speechmatics_ws_error"));
        });

        ws.addEventListener("close", function () {
          if (self.state.status === "recording") {
            if (self.config.onError) self.config.onError("default");
          }
        });
      });
    });
  };

  AgiloSpeechmaticsStreamingController.prototype.closeRealtimeSession = function () {
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

  AgiloSpeechmaticsStreamingController.prototype.start = function () {
    var self = this;

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
        self.setStatus("connecting", "Connexion Speechmatics...");
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
        self.setStatus("idle", "Erreur");
        if (self.config.onError) self.config.onError("default");
      });
  };

  AgiloSpeechmaticsStreamingController.prototype.pause = function () {
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

  AgiloSpeechmaticsStreamingController.prototype.resume = function () {
    if (this.state.status !== "paused") return;
    var self = this;

    // Prendre le texte édité comme nouvelle base
    this.state.committedText = (this.els.text.value || "").trim();
    this.state.partialText = "";
    this.renderText();

    this.setStatus("connecting", "Reconnexion Speechmatics...");

    this.openRealtimeSession()
      .then(function () { return self.state.audioContext.resume(); })
      .then(function () { self.setStatus("recording", "En écoute..."); self.startTimer(); })
      .catch(function (err) {
        console.error(err);
        if (self.config.onError) self.config.onError("default");
      });
  };

  AgiloSpeechmaticsStreamingController.prototype.stop = function () {
    if (this.state.status === "idle" || this.state.status === "uploading") return;
    var self = this;

    var suspendPromise = (this.state.audioContext && this.state.status === "recording")
      ? this.state.audioContext.suspend().then(function () { return self.closeRealtimeSession(); })
      : Promise.resolve();

    suspendPromise
      .then(function () {
        self.setStatus("uploading", "Upload vers Agilotext...");
        self.state.committedText = (self.els.text.value || "").trim();
        self.state.partialText = "";
        self.renderText();

        var blob = pcm16ChunksToWavBlob(self.state.pcmChunks, self.state.sampleRate);

        return self.config.uploadBlob({
          blob: blob,
          email: self.state.email,
          options: self.getOptions()
        });
      })
      .then(function (response) {
        if (!response || response.status !== "OK") {
          throw new Error((response && response.errorMessage) || "upload_failed");
        }

        var jobId = response.jobIdList && response.jobIdList[0];
        if (!jobId) throw new Error("missing_job_id");

        return self.teardownAudio().then(function () {
          self.resetTimer();
          self.setStatus("idle", "Envoyé");
          if (self.config.onUploadAccepted) {
            self.config.onUploadAccepted({ jobId: jobId, email: self.state.email });
          }
        });
      })
      .catch(function (err) {
        console.error(err);
        self.teardownAudio().then(function () {
          self.resetTimer();
          self.setStatus("idle", "Erreur");
          if (self.config.onError) self.config.onError("default");
        });
      });
  };


  /* ── Teardown ───────────────────────────────────────────────────── */

  AgiloSpeechmaticsStreamingController.prototype.teardownAudio = function () {
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

  window.AgiloSpeechmaticsStreaming = {
    mount: function (config) {
      if (!config || !config.root) {
        throw new Error("AgiloSpeechmaticsStreaming: root manquant");
      }
      return new AgiloSpeechmaticsStreamingController(config);
    }
  };

})();
