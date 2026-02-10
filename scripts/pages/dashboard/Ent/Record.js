document.addEventListener('DOMContentLoaded', function () {
  const DBG = !!window.AGILO_DEBUG;

  const MAX_RECORDING_MS = null; // ENT version: Unlimited
  const MIN_BLOB_BYTES = 2048;

  // --- MODULE: WakeLock (Anti-Veille Écran) ---
  const WakeLockManager = {
    lock: null,
    async request() {
      if ('wakeLock' in navigator) {
        try {
          this.lock = await navigator.wakeLock.request('screen');
          this.lock.addEventListener('release', () => { if (DBG) console.log('[WakeLock] Released'); });
          if (DBG) console.log('[WakeLock] Acquired');
        } catch (err) {
          if (DBG) console.warn('[WakeLock] Error:', err);
        }
      }
    },
    async release() {
      if (this.lock) {
        await this.lock.release();
        this.lock = null;
      }
    }
  };

  // --- MODULE: BackupManager (Sauvegarde Incrémentale IndexedDB) ---
  const BackupManager = {
    db: null,
    DB_NAME: 'AgilotextRecDB',
    STORE_NAME: 'chunks',

    async open() {
      if (this.db) return this.db;
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.DB_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          this.db = request.result;
          resolve(this.db);
        };
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.STORE_NAME)) {
            db.createObjectStore(this.STORE_NAME, { autoIncrement: true });
          }
        };
      });
    },

    async saveChunk(blob) {
      if (blob.size === 0) return;
      try {
        await this.open();
        const tx = this.db.transaction([this.STORE_NAME], 'readwrite');
        tx.objectStore(this.STORE_NAME).add({
          timestamp: Date.now(),
          blob: blob
        });
      } catch (e) {
        if (DBG) console.warn('[Backup] Save failed:', e);
      }
    },

    async getAllChunks() {
      await this.open();
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction([this.STORE_NAME], 'readonly');
        const req = tx.objectStore(this.STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result.map(r => r.blob));
        req.onerror = () => reject(req.error);
      });
    },

    async count() {
      try {
        await this.open();
        return new Promise((resolve) => {
          const req = this.db.transaction([this.STORE_NAME], 'readonly').objectStore(this.STORE_NAME).count();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(0);
        });
      } catch { return 0; }
    },

    async clear() {
      if (!this.db) return;
      const tx = this.db.transaction([this.STORE_NAME], 'readwrite');
      tx.objectStore(this.STORE_NAME).clear();
    }
  };

  // --- MODULE: Reliability (Heartbeat & Watchdog) ---
  const Reliability = {
    heartbeatInterval: null,
    watchdogInterval: null,
    lastTick: 0,
    lastChunkTime: 0,

    start(mediaRecorderInstance) {
      this.lastTick = Date.now();
      this.lastChunkTime = Date.now();

      // 1. Heartbeat (Détection Veille Système)
      this.heartbeatInterval = setInterval(() => {
        const now = Date.now();
        const delta = now - this.lastTick;
        if (delta > 5000) { // Gap > 5s
          console.warn(`[Reliability] SUSPENSION DÉTECTÉE: Gap de ${delta}ms`);
          // Force flush if possible
          if (mediaRecorderInstance && mediaRecorderInstance.state === 'recording') {
            try { mediaRecorderInstance.requestData(); } catch (e) { }
          }
          // Re-acquire lock
          WakeLockManager.request();
        }
        this.lastTick = now;
      }, 1000);

      // 2. Watchdog (Détection Plantage Processus Audio)
      this.watchdogInterval = setInterval(() => {
        if (!mediaRecorderInstance || mediaRecorderInstance.state !== 'recording') return;
        const timeSinceLastChunk = Date.now() - this.lastChunkTime;
        // Si pas de data depuis 3s (timeslice=1s ou 250ms), c'est suspect
        if (timeSinceLastChunk > 4000) {
          console.warn('[Reliability] WATCHDOG: No data for 4s. Forcing requestData.');
          try { mediaRecorderInstance.requestData(); } catch (e) { }
        }
      }, 2000);
    },

    notifyChunk() {
      this.lastChunkTime = Date.now();
    },

    stop() {
      clearInterval(this.heartbeatInterval);
      clearInterval(this.watchdogInterval);
    }
  };

  // --- AUDIO CONFIG (From Original Script) ---
  const MIC_CONSTRAINTS_BASE = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: false,
    channelCount: 1,
    sampleRate: 48000
  };

  const MIX_PREGAIN_DB = 6.0;
  const MIC_BASE_GAIN = 1.8;
  const SYS_BASE_GAIN = 1.2;

  const AGC_ENABLED = true;
  const AGC_TARGET = 0.35;
  const AGC_SMOOTH = 0.03;
  const AGC_MIN_GAIN = 0.60;
  const AGC_MAX_GAIN = 4.0;

  const MIC_COMP = {
    threshold: -30,
    knee: 10,
    ratio: 3.5,
    attack: 0.002,
    release: 0.15
  };

  const MIX_LIMITER = {
    threshold: -0.5,
    knee: 0,
    ratio: 20,
    attack: 0.001,
    release: 0.08
  };

  /* --------- DOM --------- */
  const startButton = document.querySelector('.startrecording');
  const stopButton = document.getElementById('stopRecording');
  const pauseButton = document.getElementById('pauseRecording');
  const pauseButtonText = document.getElementById('pauseButtonText');
  const recordingAnimation = document.getElementById('Recording_animation');
  const recordingTimeDisplay = document.getElementById('recordingTime');
  const form = document.querySelector('form[ms-code-file-upload="form"]');
  const submitButton = document.getElementById('submit-button');
  const newButton = document.getElementById('newButton');
  const recordingDiv = document.getElementById('recordingDiv');
  const startSharingButton = document.getElementById('recording_sharing');
  const startAudioButton = document.getElementById('recording_audio');
  const errorMessage = document.getElementById('error-message_recording');
  const levelFill = document.getElementById('audioLevelFill');

  /* --------- État --------- */
  let mediaRecorder;
  let audioChunks = [];
  let recordingInterval;
  let elapsedTimeInSeconds = 0;
  let autoStopTimeout;
  let warned5min = false, warned1min = false;

  let audioContext = null;
  let destination = null;
  let isSharingScreen = false;

  let mixBus = null, mixPreGain = null, mixLimiter = null;
  let meterAnalyser = null, meterData = null, meterRafId = null;
  let lastMeterLevel = 0, clipActive = false, clipStartTs = 0;

  // Exposer debug
  window.AGILO_AUDIO_DEBUG = {
    getStats: () => ({
      micGain: micGainNode?.gain?.value,
      agcEnabled: AGC_ENABLED,
      chunks: audioChunks.length,
      recoveryAvailable: false // updated later
    })
  };

  let micSourceNode = null, micHPF = null, micDeEsser = null, micCompressor = null, micGainNode = null, micAgcAnalyser = null, micAgcData = null, agcRafId = null;
  let sysSourceNode = null, sysGainNode = null;

  let currentMicStream = null, currentScreenStream = null, lastMicDeviceId = null;
  let screenVideoTrack = null, onScreenEnded = null;
  let stopInProgress = false;

  const log = (...a) => { if (DBG) console.log('[rec]', ...a); };
  const warn = (...a) => { if (DBG) console.warn('[rec]', ...a); };
  const err = (...a) => { console.error('[rec]', ...a); };

  const dbToGain = (db) => Math.pow(10, db / 20);

  // --- HELPERS ---
  function isMobileDevice() { return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent); }
  function isIOS() { return /iPhone|iPad|iPod/i.test(navigator.userAgent); }
  function isFirefox() { return /Firefox/i.test(navigator.userAgent); }
  function isChromeLike() { return /Chrome|Edg|Brave/i.test(navigator.userAgent) && !/OPR|Opera/i.test(navigator.userAgent); }
  function supportsDisplayMedia() { return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia); }
  function supportsMediaRecorder() { return typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function'; }
  function supportsWebAudio() { return !!(window.AudioContext || window.webkitAudioContext); }

  function stopStreamTracks(s) { try { s && s.getTracks && s.getTracks().forEach(t => t.stop()); } catch { } }

  function formatDurationDigital(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = n => n.toString().padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  function toggleAnimation(on) {
    if (recordingAnimation) recordingAnimation.style.display = on ? 'block' : 'none';
    if (recordingDiv) recordingDiv.style.display = on ? 'block' : 'none';
  }

  function updateRecordingTime() {
    elapsedTimeInSeconds++;
    if (recordingTimeDisplay) recordingTimeDisplay.innerText = formatDurationDigital(elapsedTimeInSeconds);
    if (Number.isFinite(MAX_RECORDING_MS)) {
      const remaining = Math.floor((MAX_RECORDING_MS / 1000) - elapsedTimeInSeconds);
      if (!warned5min && remaining === 300) { warned5min = true; alert("Il reste 5 minutes d'enregistrement."); }
      if (!warned1min && remaining === 60) { warned1min = true; alert("Il reste 1 minute d'enregistrement."); }
    }
  }

  function simulateFileInput(fileInput, file) {
    if (!fileInput) return;
    if (typeof DataTransfer !== 'undefined') {
      const dt = new DataTransfer(); dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      const reader = new FileReader();
      reader.onload = function (e) { fileInput.value = ''; fileInput.dispatchEvent(new Event('change', { bubbles: true })); };
      reader.readAsDataURL(file);
    }
  }

  function downloadRecording(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    a.style.display = 'none'; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
  }

  // --- AUDIO LOGIC ---
  function startLevelMeter() {
    if (!audioContext || !levelFill || !meterAnalyser || !meterData) return;
    if (meterRafId) cancelAnimationFrame(meterRafId);
    lastMeterLevel = 0; clipActive = false; clipStartTs = 0;
    const loop = () => {
      if (!meterAnalyser || !meterData || !levelFill) return;
      try {
        meterAnalyser.getByteTimeDomainData(meterData);
        let sum = 0;
        for (let i = 0; i < meterData.length; i++) {
          const v = (meterData[i] - 128) / 128; sum += v * v;
        }
        const rms = Math.sqrt(sum / meterData.length);
        const rawLevel = Math.min(1, rms * 4);
        const level = 0.3 * rawLevel + 0.7 * lastMeterLevel;
        lastMeterLevel = level;
        const pct = Math.round(level * 100);
        levelFill.style.width = pct + '%';
        levelFill.style.backgroundColor = level < 0.15 ? '#a82c33' : (level < 0.7 ? '#1c661a' : '#fd7e14');
        const now = performance.now();
        if (level > 0.95) {
          if (!clipActive) { clipActive = true; clipStartTs = now; }
          if (now - clipStartTs > 150) levelFill.style.outline = '2px solid rgba(255,0,0,.75)';
        } else {
          clipActive = false; levelFill.style.outline = '';
        }
      } catch (e) { warn('VU Error:', e); }
      meterRafId = requestAnimationFrame(loop);
    };
    loop();
  }
  function stopLevelMeter() {
    if (meterRafId) { cancelAnimationFrame(meterRafId); meterRafId = null; }
    if (levelFill) { levelFill.style.width = '0%'; levelFill.style.backgroundColor = '#a82c33'; levelFill.style.outline = ''; }
    meterAnalyser = null; meterData = null; lastMeterLevel = 0;
  }

  function startMicAutoGain() {
    if (!AGC_ENABLED) return;
    if (!micAgcAnalyser || !micAgcData || !micGainNode) return;
    if (agcRafId) cancelAnimationFrame(agcRafId);
    const loop = () => {
      if (!micAgcAnalyser || !micAgcData || !micGainNode) return;
      try {
        micAgcAnalyser.getByteTimeDomainData(micAgcData);
        let sum = 0;
        for (let i = 0; i < micAgcData.length; i++) {
          const v = (micAgcData[i] - 128) / 128; sum += v * v;
        }
        const rms = Math.sqrt(sum / micAgcData.length);
        const g = micGainNode.gain.value;
        if (rms > 0.001) {
          const desired = Math.min(AGC_MAX_GAIN, Math.max(AGC_MIN_GAIN, MIC_BASE_GAIN * (AGC_TARGET / rms)));
          micGainNode.gain.value = g + (desired - g) * AGC_SMOOTH;
        }
      } catch (e) { warn('AGC Error:', e); }
      agcRafId = requestAnimationFrame(loop);
    };
    loop();
  }
  function stopMicAutoGain() {
    if (agcRafId) { cancelAnimationFrame(agcRafId); agcRafId = null; }
  }

  function setupAudioContext() {
    if (!supportsWebAudio()) { err('Web Audio API non supporté'); return; }
    try { audioContext = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { err('Err AudioContext:', e); return; }
    try { destination = audioContext.createMediaStreamDestination(); }
    catch (e) { err('Err Destination:', e); return; }

    mixBus = audioContext.createGain(); mixBus.gain.value = 1.0;
    mixPreGain = audioContext.createGain(); mixPreGain.gain.value = dbToGain(MIX_PREGAIN_DB);
    mixLimiter = audioContext.createDynamicsCompressor();
    mixLimiter.threshold.value = MIX_LIMITER.threshold; mixLimiter.knee.value = MIX_LIMITER.knee;
    mixLimiter.ratio.value = MIX_LIMITER.ratio; mixLimiter.attack.value = MIX_LIMITER.attack; mixLimiter.release.value = MIX_LIMITER.release;

    mixBus.connect(mixPreGain); mixPreGain.connect(mixLimiter); mixLimiter.connect(destination);

    if (levelFill) {
      meterAnalyser = audioContext.createAnalyser(); meterAnalyser.fftSize = 512;
      meterData = new Uint8Array(meterAnalyser.fftSize);
      mixLimiter.connect(meterAnalyser);
    }

    // DSP Micro
    micHPF = audioContext.createBiquadFilter(); micHPF.type = 'highpass'; micHPF.frequency.value = 80;
    micDeEsser = audioContext.createBiquadFilter(); micDeEsser.type = 'peaking'; micDeEsser.frequency.value = 6000; micDeEsser.Q.value = 2; micDeEsser.gain.value = -3;
    micCompressor = audioContext.createDynamicsCompressor();
    micCompressor.threshold.value = MIC_COMP.threshold; micCompressor.knee.value = MIC_COMP.knee;
    micCompressor.ratio.value = MIC_COMP.ratio; micCompressor.attack.value = MIC_COMP.attack; micCompressor.release.value = MIC_COMP.release;
    micGainNode = audioContext.createGain(); micGainNode.gain.value = MIC_BASE_GAIN;
    micAgcAnalyser = audioContext.createAnalyser(); micAgcAnalyser.fftSize = 512;
    micAgcData = new Uint8Array(micAgcAnalyser.fftSize);

    // DSP Système
    sysGainNode = audioContext.createGain(); sysGainNode.gain.value = SYS_BASE_GAIN;
  }

  function teardownAudioGraph() {
    stopMicAutoGain(); stopLevelMeter();
    try { micSourceNode && micSourceNode.disconnect(); } catch { }
    try { sysSourceNode && sysSourceNode.disconnect(); } catch { }
    try { micHPF && micHPF.disconnect(); } catch { }
    try { micDeEsser && micDeEsser.disconnect(); } catch { }
    try { micCompressor && micCompressor.disconnect(); } catch { }
    try { micGainNode && micGainNode.disconnect(); } catch { }
    try { sysGainNode && sysGainNode.disconnect(); } catch { }
    try { mixBus && mixBus.disconnect(); } catch { }
    try { mixPreGain && mixPreGain.disconnect(); } catch { }
    try { mixLimiter && mixLimiter.disconnect(); } catch { }
    try { meterAnalyser && meterAnalyser.disconnect(); } catch { }
    try { micAgcAnalyser && micAgcAnalyser.disconnect(); } catch { }
    micSourceNode = null; sysSourceNode = null; micHPF = null; micDeEsser = null; micCompressor = null; micGainNode = null; sysGainNode = null; mixBus = null; mixPreGain = null; mixLimiter = null; meterAnalyser = null; micAgcAnalyser = null; micAgcData = null;
    try { if (audioContext && audioContext.state !== 'closed') audioContext.close(); } catch { }
    audioContext = null; destination = null;
  }

  /* --- Buttons Handlers (Modernized) --- */
  if (startAudioButton) {
    startAudioButton.onclick = () => initiateRecording(false);
  }
  if (startSharingButton) {
    startSharingButton.onclick = () => {
      if (isMobileDevice()) {
        if (confirm('Le partage d\'écran n\'est pas disponible sur mobile.\nVoulez-vous utiliser le micro ?')) initiateRecording(false);
        return;
      }
      if (supportsDisplayMedia()) {
        initiateRecording(true);
      } else {
        if (confirm("Votre navigateur ne supporte pas le partage d'écran. Micro seul ?")) initiateRecording(false);
      }
    };
  }

  function effectiveMicConstraints() {
    const c = { audio: {} };
    if (isMobileDevice() || isIOS()) { c.audio = { echoCancellation: true }; }
    else { Object.assign(c.audio, MIC_CONSTRAINTS_BASE); }
    if (lastMicDeviceId) { c.audio.deviceId = { exact: lastMicDeviceId }; }
    return c;
  }

  async function getMicStreamWithFallback() {
    try { return await navigator.mediaDevices.getUserMedia(effectiveMicConstraints()); }
    catch (e1) {
      warn('Mic exact failed', e1);
      try { return await navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch (e2) { return await navigator.mediaDevices.getUserMedia({ audio: {} }); }
    }
  }

  function attachMicTrackListeners(stream) {
    const track = stream && stream.getAudioTracks && stream.getAudioTracks()[0];
    if (!track) return;
    track.addEventListener('ended', () => {
      warn('Mic ended -> recovery');
      if (mediaRecorder && mediaRecorder.state === 'recording') restartMic();
    });
  }

  async function initiateRecording(shareScreen) {
    if (mediaRecorder && mediaRecorder.state === 'recording') return;
    if (audioContext && audioContext.state === 'suspended') try { await audioContext.resume(); } catch (e) { }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Navigateur incompatible (getUserMedia).'); return;
    }
    if (!supportsMediaRecorder()) { alert('Navigateur incompatible (MediaRecorder).'); return; }

    setupAudioContext();
    if (!destination || !destination.stream) {
      alert("Problème initialisation WebAudio."); teardownAudioGraph(); return;
    }

    try {
      currentMicStream = await getMicStreamWithFallback();
      attachMicTrackListeners(currentMicStream);
    } catch (e) {
      alert("Erreur Micro: " + e.message); teardownAudioGraph(); return;
    }

    if (shareScreen && !isSharingScreen && supportsDisplayMedia()) {
      isSharingScreen = true;
      try {
        currentScreenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        screenVideoTrack = currentScreenStream.getVideoTracks && currentScreenStream.getVideoTracks()[0] || null;
      } catch (e) {
        if (e.name !== 'NotAllowedError') alert("Erreur Partage: " + e.message);
        isSharingScreen = false; currentScreenStream = null; screenVideoTrack = null;
        if (e.name !== 'NotAllowedError') { stopStreamTracks(currentMicStream); currentMicStream = null; teardownAudioGraph(); return; }
        // Si NotAllowed, on continue peut-être en micro ou on annule?
        // Le comportement standard est d'annuler si le user refuse le partage
        stopStreamTracks(currentMicStream); currentMicStream = null; teardownAudioGraph(); return;
      }
    }

    if (shareScreen && currentScreenStream) {
      const hasSystemAudio = !!(currentScreenStream.getAudioTracks && currentScreenStream.getAudioTracks().length > 0);
      if (!hasSystemAudio) {
        if (isFirefox()) {
          if (!confirm("⚠️ Firefox : Pas d'audio système.\nContinuer avec Micro seul ?")) {
            stopStreamTracks(currentScreenStream); stopStreamTracks(currentMicStream); teardownAudioGraph(); return;
          }
        } else {
          alert("⚠️ Pas d'audio système détecté !\n\nCochez 'Partager l'audio' dans Chrome.");
          stopStreamTracks(currentScreenStream); stopStreamTracks(currentMicStream); teardownAudioGraph(); return;
        }
      }
      if (screenVideoTrack) {
        onScreenEnded = () => stopRecordingAndSubmitForm();
        screenVideoTrack.addEventListener('ended', onScreenEnded);
      }
    }

    bindMicToGraph(currentMicStream);
    if (currentScreenStream) bindSystemToGraph(currentScreenStream);

    if (meterAnalyser && meterData) startLevelMeter();
    startMicAutoGain();

    startRecording(destination.stream);
  }

  function bindMicToGraph(micStream) {
    if (!audioContext || !mixBus || !micHPF || !micDeEsser || !micCompressor || !micGainNode || !micAgcAnalyser) return;
    try { micSourceNode && micSourceNode.disconnect(); } catch { }
    micSourceNode = null;
    try {
      micSourceNode = audioContext.createMediaStreamSource(micStream);
      micSourceNode.connect(micHPF); micHPF.connect(micDeEsser); micDeEsser.connect(micCompressor);
      micCompressor.connect(micAgcAnalyser); micCompressor.connect(micGainNode); micGainNode.connect(mixBus);
    } catch (e) { err('BindMic Err:', e); }
  }

  function bindSystemToGraph(screenStream) {
    if (!audioContext || !mixBus || !sysGainNode) return;
    const hasAudio = screenStream.getAudioTracks().length > 0;
    if (!hasAudio) return;
    try { sysSourceNode && sysSourceNode.disconnect(); } catch { }
    sysSourceNode = null;
    try {
      sysSourceNode = audioContext.createMediaStreamSource(screenStream);
      sysSourceNode.connect(sysGainNode); sysGainNode.connect(mixBus);
    } catch (e) { err('BindSys Err:', e); }
  }

  async function restartMic() {
    try {
      const newMic = await getMicStreamWithFallback();
      stopStreamTracks(currentMicStream); currentMicStream = newMic;
      attachMicTrackListeners(currentMicStream); bindMicToGraph(currentMicStream);
      log('Mic restart OK');
    } catch (e) { err('Mic Restart Fail', e); alert("Micro perdu."); }
  }

  function startRecording(stream) {
    if (audioContext && audioContext.state === 'suspended') audioContext.resume().catch(() => { });

    let mimeType = 'audio/webm; codecs=opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/webm';

    try { mediaRecorder = new MediaRecorder(stream, { mimeType }); }
    catch (e) {
      try { mediaRecorder = new MediaRecorder(stream); }
      catch (e2) {
        alert("Erreur MediaRecorder."); stopStreamTracks(currentMicStream); stopStreamTracks(currentScreenStream); teardownAudioGraph(); return;
      }
    }

    audioChunks = [];
    mediaRecorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        audioChunks.push(ev.data);
        // HOOK: Reliability
        Reliability.notifyChunk();
        BackupManager.saveChunk(ev.data);
      }
    };

    mediaRecorder.onerror = (e) => {
      err('Rec Error:', e); alert("Erreur enregistrement."); stopRecordingAndSubmitForm();
    };

    mediaRecorder.onstop = function () {
      stopInProgress = false;
      Reliability.stop(); // HOOK: Stop watchdog
      WakeLockManager.release(); // HOOK: Stop protection

      setTimeout(() => {
        const finalMime = mediaRecorder.mimeType || mimeType;
        const audioBlob = new Blob(audioChunks, { type: finalMime });

        if (audioBlob.size < MIN_BLOB_BYTES) {
          alert("Enregistrement vide/trop court.");
          stopStreamTracks(currentMicStream); currentMicStream = null; stopStreamTracks(currentScreenStream); currentScreenStream = null; teardownAudioGraph(); mediaRecorder = null;
          return;
        }

        const now = new Date();
        const pad = n => n.toString().padStart(2, '0');
        const filename = `Agilotext_${now.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-')}.webm`;

        // UI Logic (FilePond / Form)
        let hiddenName = form && form.querySelector('input[name="generatedFilename"]');
        if (form && !hiddenName) { hiddenName = document.createElement('input'); hiddenName.type = 'hidden'; hiddenName.name = 'generatedFilename'; form.appendChild(hiddenName); }
        if (hiddenName) hiddenName.value = filename;

        // Download Backup
        downloadRecording(audioBlob, filename);

        // --- UPLOAD LOGIC ---
        // Similaire à l'existant : FilePond ou Input
        const file = new File([audioBlob], filename, { type: finalMime });
        const fileInput = form && form.querySelector('input[type="file"]');

        if (window.FilePond && fileInput) {
          // FilePond Logic...
          try {
            const pond = FilePond.find(fileInput);
            if (pond) pond.addFile(file).then(() => { if (submitButton) submitButton.click(); });
            else simulateFileInput(fileInput, file);
          } catch (e) { simulateFileInput(fileInput, file); }
        } else {
          simulateFileInput(fileInput, file);
          setTimeout(() => { if (submitButton) submitButton.click(); else if (form) form.requestSubmit(); }, 500);
        }

        // Cleanup
        if (screenVideoTrack && onScreenEnded) screenVideoTrack.removeEventListener('ended', onScreenEnded);
        stopStreamTracks(currentMicStream); currentMicStream = null; stopStreamTracks(currentScreenStream); currentScreenStream = null; teardownAudioGraph(); mediaRecorder = null;

        // Clear DB Backup
        BackupManager.clear();

      }, 50);
    };

    // START
    mediaRecorder.start(1000); // 1s slice for backup

    // HOOK: Start Reliability
    WakeLockManager.request();
    Reliability.start(mediaRecorder);

    toggleAnimation(true);
    if (startButton) startButton.disabled = true;
    if (stopButton) { stopButton.disabled = false; stopButton.style.display = 'flex'; }
    if (pauseButton) { pauseButton.disabled = false; pauseButton.style.display = 'flex'; }
    if (newButton) newButton.style.display = 'none';

    elapsedTimeInSeconds = 0;
    if (recordingTimeDisplay) recordingTimeDisplay.innerText = '00:00';
    recordingInterval = setInterval(updateRecordingTime, 1000);

    if (Number.isFinite(MAX_RECORDING_MS)) autoStopTimeout = setTimeout(stopRecordingAndSubmitForm, MAX_RECORDING_MS);
    else autoStopTimeout = null;
  }

  function stopRecordingAndSubmitForm() {
    if (stopInProgress) return;
    stopInProgress = true;

    // Hook: Stop Protection
    Reliability.stop();
    WakeLockManager.release();

    if (screenVideoTrack && onScreenEnded) {
      try { screenVideoTrack.removeEventListener('ended', onScreenEnded); } catch (e) { }
      screenVideoTrack = null; onScreenEnded = null;
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); }
      catch (e) {
        warn("Stop error", e); stopInProgress = false;
        // Cleanup if stop failed
        stopStreamTracks(currentMicStream); currentMicStream = null; stopStreamTracks(currentScreenStream); currentScreenStream = null; teardownAudioGraph(); mediaRecorder = null;
      }
    } else {
      // Déjà arrêté
      stopStreamTracks(currentMicStream); currentMicStream = null; stopStreamTracks(currentScreenStream); currentScreenStream = null; teardownAudioGraph(); mediaRecorder = null;
      stopInProgress = false;
    }

    clearInterval(recordingInterval); clearInterval(autoStopTimeout);
    toggleAnimation(false);
    if (startButton) startButton.disabled = false;
    if (stopButton) { stopButton.disabled = true; stopButton.style.display = 'none'; }
    if (pauseButton) { pauseButton.disabled = true; pauseButton.style.display = 'none'; }
    if (newButton) newButton.style.display = 'flex';
    if (recordingDiv) recordingDiv.style.display = 'none';
    if (recordingTimeDisplay) recordingTimeDisplay.innerText = '00:00';
    isSharingScreen = false;
    if (errorMessage) errorMessage.style.display = 'none';
  }

  if (stopButton) stopButton.onclick = stopRecordingAndSubmitForm;
  if (pauseButton) {
    pauseButton.onclick = function () {
      if (!mediaRecorder) return;
      if (mediaRecorder.state === 'recording') { mediaRecorder.pause(); if (pauseButtonText) pauseButtonText.innerText = 'Reprendre'; clearInterval(recordingInterval); }
      else if (mediaRecorder.state === 'paused') { mediaRecorder.resume(); if (pauseButtonText) pauseButtonText.innerText = 'Pause'; recordingInterval = setInterval(updateRecordingTime, 1000); }
      toggleAnimation(mediaRecorder.state !== 'paused');
    }
  }

  /* --- RECOVERY CHECK --- */
  (async function () {
    const count = await BackupManager.count();
    if (count > 0) {
      if (confirm(`⚠️ Session précédente interrompue (${count} fragments).\nRécupérer ?`)) {
        const blobs = await BackupManager.getAllChunks();
        const b = new Blob(blobs, { type: 'audio/webm' });
        downloadRecording(b, `RECOVERY_${Date.now()}.webm`);
        if (confirm("Effacer backup ?")) BackupManager.clear();
      }
    }
  })();
});
