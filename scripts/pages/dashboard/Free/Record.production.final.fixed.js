(function () {
  function initRecord() {
    if (window.__AGILO_RECORD_BOOTED__) {
      console.warn('[Record Script] Déjà initialisé, ignoré');
      return;
    }
    window.__AGILO_RECORD_BOOTED__ = true;
    console.log('[Record Script] 🚀 Initialisation démarrée');

    const DBG = !!window.AGILO_DEBUG;

  // --- MODULES FIABILITÉ (INJECTÉS V2 & V3) ---

  // [V3] Notification Manager (Non-bloquant)
  const NotificationManager = {
    container: null,
    init() {
      if (this.container) return;
      this.container = document.createElement('div');
      this.container.id = 'agilo-notification-container';
      Object.assign(this.container.style, {
        position: 'fixed', top: '20px', right: '20px', zIndex: '999999',
        display: 'flex', flexDirection: 'column', gap: '10px', pointerEvents: 'none'
      });
      document.body.appendChild(this.container);

      // Inject CSS (P2: garde pour éviter double injection)
      if (document.getElementById('agilo-record-styles')) return;
      const style = document.createElement('style');
      style.id = 'agilo-record-styles';
      style.innerHTML = `
        .agilo-toast {
          background: #fff; color: #333; padding: 12px 16px; border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-family: sans-serif; font-size: 14px;
          border-left: 4px solid #333; min-width: 300px; max-width: 450px;
          animation: slideIn 0.3s ease-out; pointer-events: auto; display: flex; align-items: flex-start; gap: 10px;
        }
        .agilo-toast.error { border-left-color: #d32f2f; background: #fff0f0; }
        .agilo-toast.warning { border-left-color: #f57c00; background: #fff8e1; }
        .agilo-toast.success { border-left-color: #388e3c; background: #e8f5e9; }
        .agilo-toast.critical { border-left-color: #d32f2f; background: #ffebee; border: 2px solid #d32f2f; }
        .agilo-toast-content { flex: 1; }
        .agilo-toast-title { font-weight: bold; margin-bottom: 4px; display: block; }
        .agilo-toast-actions { margin-top: 8px; display: flex; gap: 8px; }
        .agilo-btn { padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px; }
        .agilo-btn-primary { background: #d32f2f; color: white; }
        .agilo-btn-secondary { background: rgba(0,0,0,0.1); color: #333; }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `;
      document.head.appendChild(style);
    },
    show(msg, type = 'info', duration = 5000, title = '', actions = []) {
      this.init();
      const toast = document.createElement('div');
      toast.className = 'agilo-toast ' + type;

      const content = document.createElement('div');
      content.className = 'agilo-toast-content';
      if (title) {
        const titleEl = document.createElement('span');
        titleEl.className = 'agilo-toast-title';
        titleEl.textContent = title;
        content.appendChild(titleEl);
      }
      const msgEl = document.createElement('span');
      msgEl.textContent = msg;
      content.appendChild(msgEl);

      if (actions.length > 0) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'agilo-toast-actions';
        actions.forEach((act, idx) => {
          const btn = document.createElement('button');
          btn.className = 'agilo-btn ' + (act.primary ? 'agilo-btn-primary' : 'agilo-btn-secondary');
          btn.textContent = act.label;
          btn.onclick = () => { act.onClick(toast); };
          actionsDiv.appendChild(btn);
        });
        content.appendChild(actionsDiv);
      }
      toast.appendChild(content);
      this.container.appendChild(toast);

      if (duration > 0) {
        setTimeout(() => {
          toast.style.opacity = '0';
          setTimeout(() => toast.remove(), 300);
        }, duration);
      }
      return toast;
    }
  };

  const WakeLockManager = {
    lock: null,
    async request() {
      if ('wakeLock' in navigator) {
        try {
          this.lock = await navigator.wakeLock.request('screen');
          if (DBG) console.log('[WakeLock] Acquired');
        } catch (e) { if (DBG) console.warn('[WakeLock] Error:', e); }
      }
    },
    async release() {
      if (this.lock) {
        try { await this.lock.release(); } catch (e) { }
        this.lock = null;
      }
    }
  };

  const MAX_BACKUP_CHUNKS = 50000;
  const MAX_BACKUP_BYTES = 1024 * 1024 * 1024; // P1: 1 Go cap IndexedDB

  const BackupManager = {
    db: null, DB_NAME: 'AgilotextRecDB', STORE_NAME: 'chunks',
    _totalBytes: null,
    async open() {
      if (this.db) return this.db;
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(this.DB_NAME, 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => { this.db = req.result; resolve(this.db); };
        req.onupgradeneeded = (e) => {
          if (!e.target.result.objectStoreNames.contains(this.STORE_NAME)) {
            e.target.result.createObjectStore(this.STORE_NAME, { autoIncrement: true });
          }
        };
      });
    },
    async saveChunk(blob, mimeType) {
      if (blob.size === 0) return;
      try {
        await this.open();
        const count = await this.count();
        if (count >= MAX_BACKUP_CHUNKS) {
          if (DBG) console.warn('[Backup] Cap chunks atteint', MAX_BACKUP_CHUNKS);
          return;
        }
        if (this._totalBytes === null) {
          const all = await new Promise((res, rej) => {
            const req = this.db.transaction([this.STORE_NAME], 'readonly').objectStore(this.STORE_NAME).getAll();
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
          });
          this._totalBytes = all.reduce((s, r) => s + (r.blob ? r.blob.size : 0), 0);
        }
        if (this._totalBytes >= MAX_BACKUP_BYTES) {
          if (DBG) console.warn('[Backup] Cap bytes atteint', MAX_BACKUP_BYTES);
          if (!backupCapWarned) {
            backupCapWarned = true;
            NotificationManager.show('Limite de sauvegarde locale atteinte (1 Go). Les nouveaux fragments ne sont plus sauvegardés.', 'warning', 8000);
          }
          return;
        }
        this.db.transaction([this.STORE_NAME], 'readwrite').objectStore(this.STORE_NAME).add({
          timestamp: Date.now(), blob: blob, mimeType: mimeType || null
        });
        this._totalBytes += blob.size;
      } catch (e) { if (DBG) console.warn('[Backup] Save failed:', e); }
    },
    async getAllChunks() {
      await this.open();
      return new Promise((resolve, reject) => {
        const req = this.db.transaction([this.STORE_NAME], 'readonly').objectStore(this.STORE_NAME).getAll();
        req.onsuccess = () => {
          const result = req.result;
          result.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          const blobs = result.map(r => r.blob);
          const mimeType = (result.map(r => r.mimeType).find(Boolean)) || 'audio/webm';
          resolve({ blobs, mimeType });
        };
        req.onerror = () => reject(req.error);
      });
    },
    async count() {
      try {
        await this.open();
        return new Promise(resolve => {
          const req = this.db.transaction([this.STORE_NAME], 'readonly').objectStore(this.STORE_NAME).count();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(0);
        });
      } catch { return 0; }
    },
    async clear() {
      if (!this.db) return;
      this.db.transaction([this.STORE_NAME], 'readwrite').objectStore(this.STORE_NAME).clear();
      this._totalBytes = 0;
    }
  };

  const Reliability = {
    heartbeatInterval: null, watchdogInterval: null, lastChunkTime: 0, lastTick: 0,
    start(mediaRecorder) {
      this.lastTick = Date.now();
      this.lastChunkTime = Date.now();
      this.heartbeatInterval = setInterval(() => {
        const now = Date.now();
        if (now - this.lastTick > 5000) { // Gap > 5s (Veille)
          console.warn('[Reliability] System suspended for', now - this.lastTick, 'ms');
          WakeLockManager.request(); // Re-acquire lock
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            try { mediaRecorder.requestData(); } catch (e) { }
          }
        }
        this.lastTick = now;
      }, 1000);
      this.watchdogInterval = setInterval(() => {
        if (mediaRecorder && mediaRecorder.state === 'recording' && (Date.now() - this.lastChunkTime > 4000)) {
          console.warn('[Reliability] Watchdog: No data for 4s. Forcing requestData.');
          try { mediaRecorder.requestData(); } catch (e) { }
        }
      }, 2000);
    },
    notifyChunk() { this.lastChunkTime = Date.now(); },
    stop() { clearInterval(this.heartbeatInterval); clearInterval(this.watchdogInterval); }
  };
  // --- FIN MODULES FIABILITÉ ---

  const MAX_RECORDING_MS = 30 * 60 * 1000; // 30 minutes (limitation Free)
  const MIN_BLOB_BYTES = 2048;
  const RECORD_VERSION = '2026-02-13-r1';
  const ONSTOP_TIMEOUT_MS = 6000;

  // ============================================
  // CONFIGURATION "DIARIZATION-FIRST" OPTIMISÉE
  // Objectif : Maximiser la séparation des locuteurs pour la diarization
  // - Pas de ducking (préserve les chevauchements)
  // - Compression très légère (préserve les différences entre voix)
  // - AGC modéré (évite le pompage qui lisse les voix)
  // - EchoCancellation activé (sauf preset Casque)
  // - NoiseSuppression désactivé (préserve les caractéristiques des voix)
  // ============================================
  const useEchoCancellation = window.AGILO_RECORD_PRESET !== 'casque'; // P2: casque = false, haut-parleur = true
  const MIC_CONSTRAINTS_BASE = {
    echoCancellation: useEchoCancellation,
    noiseSuppression: false,   // Désactivé pour préserver les différences entre locuteurs et caractéristiques des voix
    autoGainControl: false,   // Désactivé car on a un AGC custom (évite double AGC / pompage)
    channelCount: 1,
    sampleRate: 48000
  };

  const MIX_PREGAIN_DB = 0.0;  // Pas de gain global pour préserver la dynamique naturelle

  const MIC_BASE_GAIN = 2.0;   // Gain micro équilibré
  const SYS_BASE_GAIN = 1.2;   // Diarization: pas trop haut pour ne pas masquer la voix locale (P0)

  const AGC_ENABLED = true;
  const AGC_TARGET = 0.24;     // Légère hausse pour voix locale (max 0.25)
  const AGC_SMOOTH = 0.01;     // Très doux pour éviter les variations brusques
  const AGC_MIN_GAIN = 0.8;    // Permet de baisser si trop fort
  const AGC_MAX_GAIN = 3.2;    // Légère hausse pour voix faible (max 3.5)

  const MIC_COMP = {
    threshold: -16,   // Compression très légère pour préserver les différences entre locuteurs
    knee: 18,         // Transition très douce
    ratio: 1.4,       // Compression minimale (critique pour diarization : préserve les différences)
    attack: 0.01,     // Attack modéré
    release: 0.25     // Release long pour naturel et transitions douces
  };

  const MIX_LIMITER = {
    threshold: -2.0,  // Limite avec plus de marge pour éviter la distorsion sans écraser la dynamique
    knee: 2,
    ratio: 2,         // Ratio faible pour préserver la dynamique
    attack: 0.005,
    release: 0.08     // Release rapide pour transitions naturelles
  };

  const DUCKING_ENABLED = false;
  console.log('[Record Script] Version', RECORD_VERSION);
  window.__AGILO_RECORD_VERSION__ = RECORD_VERSION;

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

  let mixBus = null;
  let mixPreGain = null;
  let mixLimiter = null;

  let meterAnalyser = null;
  let meterData = null;
  let meterRafId = null;
  let lastMeterLevel = 0;
  let clipActive = false;
  let clipStartTs = 0;

  // Exposer les stats audio pour debug
  window.AGILO_AUDIO_DEBUG = {
    getStats: () => ({
      micGain: micGainNode?.gain?.value,
      agcEnabled: AGC_ENABLED,
      mimeType: mediaRecorder?.mimeType,
      audioContextState: audioContext?.state,
      chunks: audioChunks.length
    })
  };

  let micSourceNode = null;
  let micHPF = null;
  let micDeEsser = null;
  let micCompressor = null;
  let micGainNode = null;
  let micAgcAnalyser = null;
  let micAgcData = null;
  let agcRafId = null;

  let sysSourceNode = null;
  let sysGainNode = null;

  let currentMicStream = null;
  let currentScreenStream = null;
  let lastMicDeviceId = null;
  let screenVideoTrack = null;
  let onScreenEnded = null;

  let stopInProgress = false;
  let uploadConfirmed = false;
  let onstopTimeoutId = null;
  let micRestartInFlight = false;
  let restartMicAttempts = 0;
  let devicechangeDebounceTimer = null;
  let muteWarnTimer = null;
  let silentSince = null;
  let silentWarnShown = false;
  let clipWarnShown = false;
  let backgroundWarnTimeout = null;
  let backgroundRequestDataInterval = null;
  let backupCapWarned = false;

  const MAX_RESTART_MIC_ATTEMPTS = 3;
  const DEVICECHANGE_DEBOUNCE_MS = 700;
  const SILENT_RMS_THRESHOLD = 0.012;
  const SILENT_WARN_AFTER_MS = 8000;
  const MUTE_WARN_AFTER_MS = 5000;
  const CLIP_WARN_AFTER_MS = 2000;
  const BACKGROUND_WARN_AFTER_MS = 25000;
  const BACKGROUND_REQUEST_DATA_MS = 4000;

  const log = (...a) => { if (DBG) console.log('[rec]', ...a); };
  const logEvent = (name, data) => { console.log('[Record]', name, data != null ? data : ''); };
  const warn = (...a) => { if (DBG) console.warn('[rec]', ...a); };
  const err = (...a) => { console.error('[rec]', ...a); };

  const dbToGain = (db) => Math.pow(10, db / 20);

  /* =========================
     DÉTECTION NAVIGATEUR / MOBILE
     ========================= */
  function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  function isIOS() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function isFirefox() {
    return /Firefox/i.test(navigator.userAgent);
  }

  function isChromeLike() {
    return /Chrome|Edg|Brave/i.test(navigator.userAgent) && !/OPR|Opera/i.test(navigator.userAgent);
  }

  function supportsDisplayMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  }

  function supportsMediaRecorder() {
    return typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function';
  }

  function supportsWebAudio() {
    return !!(window.AudioContext || window.webkitAudioContext);
  }

  /* =========================
     FALLBACKS POUR MOBILE / NAVIGATEURS
     ========================= */
  function stopStreamTracks(s) {
    try { s && s.getTracks && s.getTracks().forEach(t => t.stop()); } catch { }
  }

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
      if (!warned5min && remaining === 300) { warned5min = true; NotificationManager.show("Il reste 5 minutes d'enregistrement.", 'warning'); }
      if (!warned1min && remaining === 60) { warned1min = true; NotificationManager.show("Il reste 1 minute d'enregistrement.", 'warning'); }
    }
  }

  function simulateFileInput(fileInput, file) {
    if (!fileInput) return;
    if (typeof DataTransfer !== 'undefined') {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      const reader = new FileReader();
      reader.onload = function (e) {
        fileInput.value = '';
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      };
      reader.readAsDataURL(file);
    }
  }

  function downloadRecording(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 100);
  }

  function showTabAudioHintOnce() {
    if (!isChromeLike() || isMobileDevice()) return;
    if (document.getElementById('tab-audio-hint')) return;
    NotificationManager.show('Partage un "Onglet Chrome" et coche "Partager l\'audio de l\'onglet" pour capter la voix de l\'autre.', 'info', 8000, 'Astuce Audio');
  }

  /* ---------------- VU-mètre ---------------- */
  function startLevelMeter() {
    if (!audioContext || !levelFill || !meterAnalyser || !meterData) return;
    if (meterRafId) cancelAnimationFrame(meterRafId);
    lastMeterLevel = 0;
    clipActive = false; clipStartTs = 0;

    const loop = () => {
      if (!meterAnalyser || !meterData || !levelFill) return;

      try {
        meterAnalyser.getByteTimeDomainData(meterData);

        let sum = 0;
        for (let i = 0; i < meterData.length; i++) {
          const v = (meterData[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / meterData.length);

        const BOOST = 4;
        const rawLevel = Math.min(1, rms * BOOST);

        const SMOOTH = 0.3;
        const level = SMOOTH * rawLevel + (1 - SMOOTH) * lastMeterLevel;
        lastMeterLevel = level;

        const pct = Math.round(level * 100);
        levelFill.style.width = pct + '%';
        levelFill.style.backgroundColor =
          level < 0.15 ? '#a82c33' : (level < 0.7 ? '#1c661a' : '#fd7e14');

        const now = performance.now();
        if (level > 0.95) {
          if (!clipActive) { clipActive = true; clipStartTs = now; }
          if (now - clipStartTs > 150) levelFill.style.outline = '2px solid rgba(255,0,0,.75)';
          if (now - clipStartTs > CLIP_WARN_AFTER_MS && !clipWarnShown) {
            clipWarnShown = true;
            NotificationManager.show('Clipping prolongé — baissez le volume système ou le micro.', 'warning', 6000);
          }
        } else {
          clipActive = false;
          levelFill.style.outline = '';
        }
      } catch (e) {
        warn('Erreur VU-mètre:', e);
      }

      meterRafId = requestAnimationFrame(loop);
    };

    loop();
  }

  function stopLevelMeter() {
    if (meterRafId) { cancelAnimationFrame(meterRafId); meterRafId = null; }
    if (levelFill) {
      levelFill.style.width = '0%';
      levelFill.style.backgroundColor = '#a82c33';
      levelFill.style.outline = '';
    }
    meterAnalyser = null;
    meterData = null;
    lastMeterLevel = 0;
  }

  /* ---------------- AGC micro ---------------- */
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
          const v = (micAgcData[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / micAgcData.length);

        // AGC micro
        const g = micGainNode.gain.value;
        if (rms > 0.001) {
          silentSince = null;
          const desired = Math.min(AGC_MAX_GAIN, Math.max(AGC_MIN_GAIN, MIC_BASE_GAIN * (AGC_TARGET / rms)));
          micGainNode.gain.value = g + (desired - g) * AGC_SMOOTH;
        } else {
          if (silentSince === null) silentSince = Date.now();
          if (!silentWarnShown && (Date.now() - silentSince > SILENT_WARN_AFTER_MS)) {
            silentWarnShown = true;
            NotificationManager.show('Micro silencieux depuis longtemps — vérifiez le micro.', 'warning', 8000);
          }
        }

        // Ducking DÉSACTIVÉ : on veut capturer toutes les voix simultanément
        // (Le ducking pénalise les chevauchements et nuit à la séparation des locuteurs)
      } catch (e) {
        warn('Erreur AGC:', e);
      }

      agcRafId = requestAnimationFrame(loop);
    };

    loop();
  }

  function stopMicAutoGain() {
    if (agcRafId) { cancelAnimationFrame(agcRafId); agcRafId = null; }
  }

  /* ---------------- Audio graph ---------------- */
  function setupAudioContext() {
    if (!supportsWebAudio()) {
      err('Web Audio API non supporté');
      return;
    }

    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      err('Impossible de créer AudioContext:', e);
      return;
    }

    try {
      destination = audioContext.createMediaStreamDestination();
    } catch (e) {
      err('Impossible de créer MediaStreamDestination:', e);
      return;
    }

    mixBus = audioContext.createGain();
    mixBus.gain.value = 1.0;

    mixPreGain = audioContext.createGain();
    mixPreGain.gain.value = dbToGain(MIX_PREGAIN_DB);

    mixLimiter = audioContext.createDynamicsCompressor();
    mixLimiter.threshold.value = MIX_LIMITER.threshold;
    mixLimiter.knee.value = MIX_LIMITER.knee;
    mixLimiter.ratio.value = MIX_LIMITER.ratio;
    mixLimiter.attack.value = MIX_LIMITER.attack;
    mixLimiter.release.value = MIX_LIMITER.release;

    mixBus.connect(mixPreGain);
    mixPreGain.connect(mixLimiter);
    mixLimiter.connect(destination);

    if (levelFill) {
      meterAnalyser = audioContext.createAnalyser();
      meterAnalyser.fftSize = 512;
      meterData = new Uint8Array(meterAnalyser.fftSize);
      mixLimiter.connect(meterAnalyser);
    }

    micHPF = audioContext.createBiquadFilter();
    micHPF.type = 'highpass';
    micHPF.frequency.value = 80;

    micDeEsser = audioContext.createBiquadFilter();
    micDeEsser.type = 'peaking';
    micDeEsser.frequency.value = 6000;
    micDeEsser.Q.value = 2;
    micDeEsser.gain.value = -3;

    micCompressor = audioContext.createDynamicsCompressor();
    micCompressor.threshold.value = MIC_COMP.threshold;
    micCompressor.knee.value = MIC_COMP.knee;
    micCompressor.ratio.value = MIC_COMP.ratio;
    micCompressor.attack.value = MIC_COMP.attack;
    micCompressor.release.value = MIC_COMP.release;

    micGainNode = audioContext.createGain();
    micGainNode.gain.value = MIC_BASE_GAIN;

    micAgcAnalyser = audioContext.createAnalyser();
    micAgcAnalyser.fftSize = 512;
    micAgcData = new Uint8Array(micAgcAnalyser.fftSize);

    sysGainNode = audioContext.createGain();
    sysGainNode.gain.value = SYS_BASE_GAIN;
  }

  function teardownAudioGraph() {
    stopMicAutoGain();
    stopLevelMeter();

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

    micSourceNode = null;
    sysSourceNode = null;
    micHPF = null;
    micDeEsser = null;
    micCompressor = null;
    micGainNode = null;
    sysGainNode = null;
    mixBus = null;
    mixPreGain = null;
    mixLimiter = null;
    meterAnalyser = null;
    micAgcAnalyser = null;
    micAgcData = null;

    try { if (audioContext && audioContext.state !== 'closed') audioContext.close(); } catch { }
    audioContext = null;
    destination = null;
  }

  /* ---------------- Start buttons ---------------- */
  if (startAudioButton) {
    startAudioButton.onclick = function () {
      if (isMobileDevice() || !supportsDisplayMedia()) {
        initiateRecording(false);
      } else if (isChromeLike()) {
        initiateRecording(false);
      } else if (startButton) {
        startButton.click();
      } else {
        initiateRecording(false);
      }
    };
  }
  if (startSharingButton) {
    startSharingButton.onclick = function () {
      if (isMobileDevice() || !supportsDisplayMedia()) {
        if (confirm('Le partage d\'écran n\'est pas disponible sur cet appareil. Voulez-vous enregistrer uniquement le micro ?')) {
          initiateRecording(false);
        }
      } else if (isFirefox()) {
        if (confirm('⚠️ Firefox ne supporte pas la capture de l\'audio système/onglet.\n\nL\'enregistrement utilisera uniquement votre micro.\n\nPour capter la voix de l\'autre personne, utilisez Chrome ou Edge.\n\nContinuer quand même ?')) {
          initiateRecording(true);
        }
      } else if (isChromeLike()) {
        initiateRecording(true);
      } else if (startButton) {
        startButton.click();
      } else {
        initiateRecording(true);
      }
    };
  }

  function effectiveMicConstraints() {
    const c = { audio: {} };
    if (isMobileDevice() || isIOS()) {
      c.audio = { echoCancellation: useEchoCancellation };
    } else {
      Object.assign(c.audio, MIC_CONSTRAINTS_BASE);
    }
    if (lastMicDeviceId) {
      c.audio.deviceId = { exact: lastMicDeviceId };
    }
    return c;
  }

  async function getMicStreamWithFallback() {
    try {
      return await navigator.mediaDevices.getUserMedia(effectiveMicConstraints());
    } catch (e1) {
      warn('getUserMedia exact device failed -> fallback audio:true', e1);
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e2) {
        warn('getUserMedia audio:true failed -> fallback minimal', e2);
        return await navigator.mediaDevices.getUserMedia({ audio: {} });
      }
    }
  }

  function attachMicTrackListeners(stream) {
    const track = stream && stream.getAudioTracks && stream.getAudioTracks()[0];
    if (!track) return;

    try {
      const s = track.getSettings && track.getSettings();
      if (s && s.deviceId) lastMicDeviceId = s.deviceId;
    } catch (e) {
      warn('Impossible de récupérer deviceId:', e);
    }

    track.addEventListener('ended', () => {
      warn('Piste micro ended -> tentative de recovery');
      if (mediaRecorder && mediaRecorder.state === 'recording') restartMic();
    });

    track.addEventListener('mute', () => {
      warn('Piste micro mute');
      if (muteWarnTimer) clearTimeout(muteWarnTimer);
      muteWarnTimer = setTimeout(() => {
        muteWarnTimer = null;
        NotificationManager.show('Micro en sourdine depuis longtemps.', 'warning', 8000);
      }, MUTE_WARN_AFTER_MS);
    });
    track.addEventListener('unmute', () => {
      if (muteWarnTimer) { clearTimeout(muteWarnTimer); muteWarnTimer = null; }
      warn('Piste micro unmute');
    });
  }

  async function initiateRecording(shareScreen) {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') return;

    if (audioContext && audioContext.state === 'suspended') {
      try {
        await audioContext.resume();
      } catch (e) {
        warn('AudioContext.resume() dans initiateRecording:', e);
      }
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      NotificationManager.show('Votre navigateur ne supporte pas l\'enregistrement audio. Veuillez utiliser un navigateur récent (Chrome, Firefox, Safari, Edge).', 'error', 0);
      return;
    }

    if (!supportsMediaRecorder()) {
      NotificationManager.show('Votre navigateur ne supporte pas MediaRecorder. Veuillez utiliser un navigateur récent.', 'error', 0);
      return;
    }

    setupAudioContext();

    if (!destination || !destination.stream) {
      NotificationManager.show("Votre navigateur ne supporte pas le mixage audio (WebAudio). Essayez Chrome/Edge.", 'error', 0);
      stopStreamTracks(currentMicStream);
      currentMicStream = null;
      stopStreamTracks(currentScreenStream);
      currentScreenStream = null;
      teardownAudioGraph();
      return;
    }

    try {
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const res = await navigator.permissions.query({ name: 'microphone' });
        } catch (e) {
          warn('Permissions API non disponible:', e);
        }
      }
    } catch { }

    // Micro
    try {
      currentMicStream = await getMicStreamWithFallback();
      attachMicTrackListeners(currentMicStream);
    } catch (e) {
      err('getUserMedia audio:', e);
      stopButton && (stopButton.style.display = 'none');
      pauseButton && (pauseButton.style.display = 'none');
      if (errorMessage) errorMessage.style.display = 'block';

      let errorMsg = 'Erreur lors de l\'accès au microphone: ';
      if (e.name === 'NotAllowedError') {
        errorMsg += 'Permission refusée. Veuillez autoriser l\'accès au microphone dans les paramètres de votre navigateur.';
      } else if (e.name === 'NotFoundError') {
        errorMsg += 'Aucun microphone trouvé. Vérifiez que votre microphone est connecté.';
      } else {
        errorMsg += e.message || e;
      }

      NotificationManager.show(errorMsg, 'error', 0);
      teardownAudioGraph();
      return;
    }

    // Onglet/écran
    if (shareScreen && !isSharingScreen && supportsDisplayMedia()) {
      isSharingScreen = true;
      try {
        currentScreenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        screenVideoTrack = currentScreenStream.getVideoTracks && currentScreenStream.getVideoTracks()[0] || null;

        currentScreenStream.addEventListener?.('addtrack', (e) => {
          if (e.track && e.track.kind === 'audio') {
            warn('Nouvelle piste audio écran ajoutée -> rebind');
            bindSystemToGraph(currentScreenStream);
          }
        });

      } catch (e) {
        err('getDisplayMedia:', e);
        if (errorMessage) errorMessage.style.display = 'block';
        if (stopButton) stopButton.style.display = 'none';
        if (pauseButton) pauseButton.style.display = 'none';

        let errorMsg;
        if (e.name === 'NotAllowedError') {
          errorMsg = 'Permission de partage d\'écran refusée.';
          NotificationManager.show(errorMsg + ' Pour capter l\'audio d\'un onglet, partage un "Onglet Chrome" et coche "Partager l\'audio".', 'warning', 8000);
        } else if (e.name === 'NotFoundError') {
          errorMsg = 'Aucune source de partage trouvée.';
          NotificationManager.show(errorMsg, 'error');
        } else if (e.name === 'AbortError') {
          errorMsg = 'Partage d\'écran annulé.';
          NotificationManager.show(errorMsg, 'info');
        } else {
          errorMsg = 'Erreur de partage d\'écran : ' + (e.message || e.name || 'Erreur inconnue');
          NotificationManager.show(errorMsg, 'error');
        }

        isSharingScreen = false;
        currentScreenStream = null;
        screenVideoTrack = null;
        stopStreamTracks(currentMicStream);
        currentMicStream = null;
        teardownAudioGraph();
        return;
      }
    } else if (shareScreen && !supportsDisplayMedia()) {
      warn('getDisplayMedia non disponible, enregistrement micro seul');
    }

    if (shareScreen && currentScreenStream) {
      const hasSystemAudio = !!(currentScreenStream.getAudioTracks && currentScreenStream.getAudioTracks().length > 0);
      if (!hasSystemAudio) {
        if (isFirefox()) {
          warn('Firefox : pas d\'audio système détecté, enregistrement micro seul');
          NotificationManager.show('⚠️ Firefox ne supporte pas la capture de l\'audio système/onglet. L\'enregistrement continuera avec votre micro uniquement.', 'warning', 10000);
          stopStreamTracks(currentScreenStream);
          currentScreenStream = null;
          screenVideoTrack = null;
          isSharingScreen = false;
        } else {
          err('Pas d\'audio système détecté, enregistrement annulé');
          if (errorMessage) errorMessage.style.display = 'block';
          if (stopButton) stopButton.style.display = 'none';
          if (pauseButton) pauseButton.style.display = 'none';
          NotificationManager.show('Astuce : sélectionnez "Onglet Chrome" et cochez "Partager l\'audio de l\'onglet" pour capter la voix de l\'autre.', 'error', 8000, "Pas d'audio système");
          showTabAudioHintOnce();
          stopStreamTracks(currentMicStream);
          stopStreamTracks(currentScreenStream);
          currentMicStream = null;
          currentScreenStream = null;
          screenVideoTrack = null;
          isSharingScreen = false;
          teardownAudioGraph();
          return;
        }
      } else {
        if (screenVideoTrack) {
          onScreenEnded = () => stopRecordingAndSubmitForm();
          screenVideoTrack.addEventListener('ended', onScreenEnded);
        }
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
      micSourceNode.connect(micHPF);
      micHPF.connect(micDeEsser);
      micDeEsser.connect(micCompressor);
      micCompressor.connect(micAgcAnalyser);
      micCompressor.connect(micGainNode);
      micGainNode.connect(mixBus);
    } catch (e) {
      err('Erreur bindMicToGraph:', e);
    }
  }

  function bindSystemToGraph(screenStream) {
    if (!audioContext || !mixBus || !sysGainNode) return;
    try { sysSourceNode && sysSourceNode.disconnect(); } catch { }
    sysSourceNode = null;
    const hasSystemAudio = !!(screenStream.getAudioTracks && screenStream.getAudioTracks().length > 0);
    if (!hasSystemAudio) {
      warn('bindSystemToGraph appelé sans audio système');
      return;
    }
    try {
      sysSourceNode = audioContext.createMediaStreamSource(screenStream);
      sysSourceNode.connect(sysGainNode);
      sysGainNode.connect(mixBus);
    } catch (e) {
      err('Erreur bindSystemToGraph:', e);
    }
  }

  async function restartMic() {
    if (micRestartInFlight) return;
    if (restartMicAttempts >= MAX_RESTART_MIC_ATTEMPTS) {
      NotificationManager.show(
        "Micro perdu après " + MAX_RESTART_MIC_ATTEMPTS + " tentatives. Relancez l'enregistrement.",
        'error', 0, 'Micro indisponible',
        [{ label: 'Relancer l\'enregistrement', primary: true, onClick: (t) => { t.remove(); if (startSharingButton) startSharingButton.click(); else initiateRecording(true); } }]
      );
      return;
    }
    micRestartInFlight = true;
    restartMicAttempts++;
    try {
      const newMic = await getMicStreamWithFallback();
      stopStreamTracks(currentMicStream);
      currentMicStream = newMic;
      attachMicTrackListeners(currentMicStream);
      bindMicToGraph(currentMicStream);
      log('Micro rétabli.');
    } catch (e) {
      err('Échec de réacquisition du micro:', e);
      NotificationManager.show(
        "Le micro a été perdu (casque déconnecté). Merci de re-sélectionner un micro puis relancer l'enregistrement si besoin.",
        'error', 0, null,
        [{ label: 'Relancer', primary: true, onClick: (t) => { t.remove(); if (startSharingButton) startSharingButton.click(); else initiateRecording(true); } }]
      );
    } finally {
      micRestartInFlight = false;
    }
  }

  function getSupportedMimeType() {
    const types = [
      'audio/webm; codecs=opus',
      'audio/webm',
      'audio/ogg; codecs=opus',
      'audio/mp4',
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return 'audio/webm';
  }

  function startRecording(stream) {
    uploadConfirmed = false;
    restartMicAttempts = 0;
    silentWarnShown = false;
    clipWarnShown = false;
    silentSince = null;
    backupCapWarned = false;
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().catch(e => {
        warn('Impossible de réactiver AudioContext:', e);
      });
    }

    const mimeType = getSupportedMimeType();
    logEvent('record_start', { mime: mimeType, shareScreen: isSharingScreen });
    let options = { mimeType };
    if (isFirefox()) {
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        options = {};
      }
    }

    try {
      mediaRecorder = new MediaRecorder(stream, options);
    } catch (e) {
      err('MediaRecorder non supporté:', mimeType, e);
      try {
        mediaRecorder = new MediaRecorder(stream);
      } catch (e2) {
        err('MediaRecorder échec complet:', e2);
        NotificationManager.show("Votre navigateur ne supporte pas l'enregistrement audio. Essayez un navigateur récent (Chrome, Firefox, Edge, Safari).", 'error', 0);
        toggleAnimation(false);
        stopStreamTracks(currentMicStream);
        currentMicStream = null;
        stopStreamTracks(currentScreenStream);
        currentScreenStream = null;
        teardownAudioGraph();
        return;
      }
    }

    audioChunks = [];
    mediaRecorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        audioChunks.push(ev.data);
        Reliability.notifyChunk();
        BackupManager.saveChunk(ev.data, mediaRecorder?.mimeType || mimeType);
      }
    };

    mediaRecorder.onerror = (event) => {
      err('MediaRecorder error:', event.error);
      logEvent('onerror', { name: (event.error && event.error.name) || 'Unknown' });
      const name = (event.error && event.error.name) || 'Unknown';
      const map = {
        NotSupportedError: "Format audio non supporté sur ce navigateur.",
        SecurityError: "Accès refusé pour des raisons de sécurité.",
        InvalidStateError: "État d'enregistrement invalide.",
        UnknownError: "Erreur inconnue lors de l'enregistrement."
      };
      NotificationManager.show(map[name] || "Erreur d'enregistrement : " + name, 'error', 0);
      stopRecordingAndSubmitForm();
    };

    mediaRecorder.onstop = function () {
      if (onstopTimeoutId) { clearTimeout(onstopTimeoutId); onstopTimeoutId = null; }
      stopInProgress = false;
      WakeLockManager.release();
      Reliability.stop();
      const finalMime = (mediaRecorder && mediaRecorder.mimeType) ? mediaRecorder.mimeType : mimeType;
      logEvent('record_stop', { mime: finalMime, durationSec: elapsedTimeInSeconds, chunks: audioChunks.length, size: audioChunks.reduce((s, c) => s + (c.size || 0), 0) });

      setTimeout(() => {
        const audioBlob = new Blob(audioChunks, { type: finalMime });

        if (!audioBlob || audioBlob.size < MIN_BLOB_BYTES) {
          warn('Audio trop petit ou vide');
          audioChunks = [];
          NotificationManager.show("L'enregistrement est trop court ou vide. Réessayez.", 'warning');
          stopStreamTracks(currentMicStream);
          currentMicStream = null;
          stopStreamTracks(currentScreenStream);
          currentScreenStream = null;
          teardownAudioGraph();
          mediaRecorder = null;
          return;
        }

        const ext = (finalMime.split(';')[0].split('/')[1] || 'webm');
        const now = new Date();
        const pad = n => n.toString().padStart(2, '0');
        const datePart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const timePart = `${pad(now.getHours())}h${pad(now.getMinutes())}`;
        const durSec = elapsedTimeInSeconds || Math.round(audioBlob.size / (128 * 1024));
        const dh = Math.floor(durSec / 3600), dm = Math.floor((durSec % 3600) / 60), ds = durSec % 60;
        const durationPart = `${pad(dh)}h${pad(dm)}m${pad(ds)}s`;
        const audioFileName = `Agilotext_${datePart}_${timePart}_${durationPart}.${ext}`;

        let hiddenName = form && form.querySelector('input[name="generatedFilename"]');
        if (form && !hiddenName) {
          hiddenName = document.createElement('input');
          hiddenName.type = 'hidden';
          hiddenName.name = 'generatedFilename';
          form.appendChild(hiddenName);
        }
        if (hiddenName) hiddenName.value = audioFileName;

        const fileInput = form && form.querySelector('input[type="file"]');
        const pondInstance = window.FilePond && fileInput ? (() => {
          try { return FilePond.find(fileInput); } catch (e) { warn('FilePond.find:', e); return null; }
        })() : null;

        const doSubmit = () => {
          if (!form) return;
          logEvent('upload_start', { size: audioBlob.size, mime: finalMime });
          if (typeof form.requestSubmit === 'function') form.requestSubmit();
          else if (submitButton) submitButton.click();
        };

        let submitted = false;
        let submitAttempts = 0;
        const SUBMIT_RETRY_DELAY = 150;
        const MAX_SUBMIT_WAIT_MS = 30000;
        let submitTimeoutId = null;

        const submitWhenAdded = () => {
          if (submitted) return;

          const ready =
            (pondInstance && pondInstance.getFiles && pondInstance.getFiles().length > 0 &&
              pondInstance.getFiles()[0].file && pondInstance.getFiles()[0].file.size > 0) ||
            (fileInput && fileInput.files && fileInput.files.length > 0 &&
              fileInput.files[0].size > 0);

          if (!ready) {
            submitAttempts++;
            if (submitAttempts * SUBMIT_RETRY_DELAY < MAX_SUBMIT_WAIT_MS) {
              submitTimeoutId = setTimeout(submitWhenAdded, SUBMIT_RETRY_DELAY);
            } else {
              warn('Fichier non prêt après 30s — clic manuel possible.');
              try {
                if (!submitted && pondInstance && pondInstance.off) {
                  pondInstance.off('addfile', submitWhenAdded);
                }
              } catch (e) {
                warn('Cleanup listener FilePond:', e);
              }
            }
            return;
          }

          submitted = true;
          if (submitTimeoutId) clearTimeout(submitTimeoutId);
          try {
            if (pondInstance && pondInstance.off) {
              pondInstance.off('addfile', submitWhenAdded);
            }
          } catch (e) {
            warn('Cleanup listener FilePond:', e);
          }

          if (!navigator.onLine) {
            window.addEventListener('online', doSubmit, { once: true });
          } else {
            doSubmit();
          }
        };

        const audioFile = new File([audioBlob], audioFileName, { type: finalMime });

        if (pondInstance && pondInstance.addFile) {
          pondInstance.addFile(audioFile)
            .then(() => {
              submitWhenAdded();
            })
            .catch((e) => {
              warn('Erreur FilePond.addFile, fallback sur simulateFileInput:', e);
              if (fileInput) {
                simulateFileInput(fileInput, audioFile);
              }
              setTimeout(submitWhenAdded, 100);
            });
        } else {
          if (fileInput) {
            simulateFileInput(fileInput, audioFile);
          }
          if (pondInstance && pondInstance.once) {
            pondInstance.once('addfile', submitWhenAdded);
          } else if (pondInstance && pondInstance.on) {
            pondInstance.on('addfile', submitWhenAdded);
            setTimeout(() => {
              try {
                if (!submitted && pondInstance && pondInstance.off) {
                  pondInstance.off('addfile', submitWhenAdded);
                }
              } catch (e) {
                warn('Cleanup listener FilePond:', e);
              }
            }, MAX_SUBMIT_WAIT_MS + 1000);
          } else {
            setTimeout(submitWhenAdded, 100);
          }
        }

        setTimeout(() => {
          if (submitted) return;
          const items = pondInstance && pondInstance.getFiles ? pondInstance.getFiles() : [];
          if (items.length > 0 && items[0].file) submitWhenAdded();
          else if (!pondInstance) {
            setTimeout(() => {
              if (!navigator.onLine) window.addEventListener('online', doSubmit, { once: true });
              else doSubmit();
            }, 300);
          }
        }, 50);

        audioChunks = [];
        setTimeout(() => downloadRecording(audioBlob, audioFileName), 1000);

        if (screenVideoTrack && onScreenEnded) {
          try {
            screenVideoTrack.removeEventListener('ended', onScreenEnded);
          } catch (e) {
            warn('Erreur retrait listener screen ended:', e);
          }
          screenVideoTrack = null;
          onScreenEnded = null;
        }
        stopStreamTracks(currentMicStream);
        currentMicStream = null;
        stopStreamTracks(currentScreenStream);
        currentScreenStream = null;
        teardownAudioGraph();
        mediaRecorder = null;
        if (uploadConfirmed) BackupManager.clear();
      }, 50);
    };

    const timeslice = isFirefox() ? 1000 : 250;
    try {
      mediaRecorder.start(timeslice);
    } catch (e) {
      try {
        mediaRecorder.start();
      } catch (e2) {
        err('Impossible de démarrer MediaRecorder:', e2);
        NotificationManager.show('Erreur lors du démarrage de l\'enregistrement. Veuillez réessayer.', 'error');
        toggleAnimation(false);
        stopStreamTracks(currentMicStream);
        currentMicStream = null;
        stopStreamTracks(currentScreenStream);
        currentScreenStream = null;
        teardownAudioGraph();
        return;
      }
    }

    // [INJECTED V2]
    WakeLockManager.request();
    Reliability.start(mediaRecorder);

    toggleAnimation(true);
    if (startButton) startButton.disabled = true;
    if (stopButton) { stopButton.disabled = false; stopButton.style.display = 'flex'; }
    if (pauseButton) {
      pauseButton.disabled = false;
      pauseButton.style.display = 'flex';
    }
    if (newButton) newButton.style.display = 'none';

    elapsedTimeInSeconds = 0;
    if (recordingTimeDisplay) recordingTimeDisplay.innerText = '00:00';
    recordingInterval = setInterval(updateRecordingTime, 1000);

    if (Number.isFinite(MAX_RECORDING_MS)) autoStopTimeout = setTimeout(stopRecordingAndSubmitForm, MAX_RECORDING_MS);
    else autoStopTimeout = null;
  }

  if (pauseButton) {
    pauseButton.onclick = function () {
      if (!mediaRecorder) return;

      try {
        if (mediaRecorder.state === 'paused') {
          mediaRecorder.resume();
          if (pauseButtonText) pauseButtonText.innerText = 'Pause';
          clearInterval(recordingInterval);
          recordingInterval = setInterval(updateRecordingTime, 1000);
        } else if (mediaRecorder.state === 'recording') {
          mediaRecorder.pause();
          if (pauseButtonText) pauseButtonText.innerText = 'Reprendre';
          clearInterval(recordingInterval);
        }
        toggleAnimation(mediaRecorder.state !== 'paused');
      } catch (e) {
        warn('Erreur pause/resume:', e);
        NotificationManager.show('La pause n\'est pas supportée sur ce navigateur.', 'warning');
        if (pauseButton) pauseButton.style.display = 'none';
      }
    };
  }

  function stopRecordingAndSubmitForm() {
    if (stopInProgress) return;
    stopInProgress = true;

    // [INJECTED V2]
    Reliability.stop();
    WakeLockManager.release();

    if (screenVideoTrack && onScreenEnded) {
      try {
        screenVideoTrack.removeEventListener('ended', onScreenEnded);
      } catch (e) {
        warn('Erreur retrait listener screen ended:', e);
      }
      screenVideoTrack = null;
      onScreenEnded = null;
    }

    const canStopRecorder = mediaRecorder && mediaRecorder.state !== 'inactive';

    try {
      if (mediaRecorder && (mediaRecorder.state === 'recording' || mediaRecorder.state === 'paused')) {
        mediaRecorder.requestData();
      }
    } catch (e) {
      warn('Erreur requestData dans stopRecordingAndSubmitForm:', e);
    }

    const stopMediaRecorder = () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try {
          mediaRecorder.stop();
        } catch (e) {
          warn('Erreur lors de l\'arrêt du MediaRecorder:', e);
          stopInProgress = false;
          if (screenVideoTrack && onScreenEnded) {
            try {
              screenVideoTrack.removeEventListener('ended', onScreenEnded);
            } catch (e2) {
              warn('Erreur retrait listener screen ended:', e2);
            }
            screenVideoTrack = null;
            onScreenEnded = null;
          }
          stopStreamTracks(currentMicStream);
          currentMicStream = null;
          stopStreamTracks(currentScreenStream);
          currentScreenStream = null;
          teardownAudioGraph();
          mediaRecorder = null;
        }
      }
    };

    if (canStopRecorder) {
      onstopTimeoutId = setTimeout(function forceCleanupAfterStopTimeout() {
        onstopTimeoutId = null;
        if (!stopInProgress) return;
        try { if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.requestData(); } catch (e) { }
        stopStreamTracks(currentMicStream);
        currentMicStream = null;
        stopStreamTracks(currentScreenStream);
        currentScreenStream = null;
        teardownAudioGraph();
        mediaRecorder = null;
        stopInProgress = false;
        clearInterval(recordingInterval);
        clearTimeout(autoStopTimeout);
        toggleAnimation(false);
        if (startButton) startButton.disabled = false;
        if (stopButton) { stopButton.disabled = true; stopButton.style.display = 'none'; }
        if (pauseButton) { pauseButton.disabled = true; pauseButton.style.display = 'none'; }
        if (newButton) newButton.style.display = 'flex';
        if (recordingDiv) recordingDiv.style.display = 'none';
        if (recordingTimeDisplay) recordingTimeDisplay.innerText = '00:00';
        warned5min = warned1min = false;
        isSharingScreen = false;
        if (errorMessage) errorMessage.style.display = 'none';
        logEvent('onstop_timeout', {});
      }, ONSTOP_TIMEOUT_MS);
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        setTimeout(stopMediaRecorder, 150);
      } else {
        stopMediaRecorder();
      }
    } else {
      if (screenVideoTrack && onScreenEnded) {
        try {
          screenVideoTrack.removeEventListener('ended', onScreenEnded);
        } catch (e) {
          warn('Erreur retrait listener screen ended:', e);
        }
        screenVideoTrack = null;
        onScreenEnded = null;
      }
      stopStreamTracks(currentMicStream);
      currentMicStream = null;
      stopStreamTracks(currentScreenStream);
      currentScreenStream = null;
      teardownAudioGraph();
      mediaRecorder = null;
      stopInProgress = false;
    }

    clearInterval(recordingInterval);
    clearTimeout(autoStopTimeout);

    toggleAnimation(false);

    if (startButton) startButton.disabled = false;
    if (stopButton) { stopButton.disabled = true; stopButton.style.display = 'none'; }
    if (pauseButton) { pauseButton.disabled = true; pauseButton.style.display = 'none'; }
    if (newButton) newButton.style.display = 'flex';
    if (recordingDiv) recordingDiv.style.display = 'none';
    if (recordingTimeDisplay) recordingTimeDisplay.innerText = '00:00';

    warned5min = warned1min = false;
    isSharingScreen = false;

    if (errorMessage) errorMessage.style.display = 'none';
  }

  if (stopButton) stopButton.onclick = stopRecordingAndSubmitForm;

  document.addEventListener('agilo-upload-confirmed', function () {
    uploadConfirmed = true;
    BackupManager.clear();
    logEvent('upload_success', {});
  });

  window.addEventListener('beforeunload', function (event) {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.requestData(); } catch (e) { }
      const msg = 'Enregistrement en cours. Voulez-vous vraiment quitter la page ?';
      event.returnValue = msg; return msg;
    }
  });

  window.addEventListener('unload', function () {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.requestData(); } catch (e) { }
    }
  });

  window.addEventListener('pagehide', function () {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.requestData(); } catch (e) { }
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && mediaRecorder && mediaRecorder.state === 'recording') {
      warn('Page en arrière-plan pendant l\'enregistrement');
      if (backgroundWarnTimeout) clearTimeout(backgroundWarnTimeout);
      backgroundWarnTimeout = setTimeout(() => {
        backgroundWarnTimeout = null;
        NotificationManager.show('L\'enregistrement continue en arrière-plan. Revenez sur l\'onglet pour éviter les coupures.', 'warning', 8000);
      }, BACKGROUND_WARN_AFTER_MS);
      if (backgroundRequestDataInterval) clearInterval(backgroundRequestDataInterval);
      backgroundRequestDataInterval = setInterval(() => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          try { mediaRecorder.requestData(); } catch (e) { }
        }
      }, BACKGROUND_REQUEST_DATA_MS);
    } else {
      if (backgroundWarnTimeout) { clearTimeout(backgroundWarnTimeout); backgroundWarnTimeout = null; }
      if (backgroundRequestDataInterval) { clearInterval(backgroundRequestDataInterval); backgroundRequestDataInterval = null; }
    }
  });

  const newErrorButton = document.getElementById('New-button_error');
  if (newErrorButton) {
    newErrorButton.addEventListener('click', function () {
      if (errorMessage) errorMessage.style.display = 'none';
      if (startSharingButton) {
        startSharingButton.click();
      } else {
        initiateRecording(true);
      }
    });
  }

  if (startButton) {
    startButton.addEventListener('click', function () {
      initiateRecording(false);
    });
  }

  try {
    navigator.mediaDevices?.addEventListener?.('devicechange', () => {
      if (devicechangeDebounceTimer) clearTimeout(devicechangeDebounceTimer);
      devicechangeDebounceTimer = setTimeout(() => {
        devicechangeDebounceTimer = null;
        if (micRestartInFlight || !mediaRecorder || mediaRecorder.state !== 'recording') return;
        warn('devicechange détecté -> tentative de recovery micro');
        restartMic();
      }, DEVICECHANGE_DEBOUNCE_MS);
    });
  } catch { }

  (async function () {
    const count = await BackupManager.count();
    if (count > 0) {
      logEvent('recovery_available', { count });
      NotificationManager.show(
        "⚠️ CRITICAL: Une session précédente a été interrompue brutalement (" + count + " fragments).",
        "critical",
        0,
        "Récupération d'Urgence",
        [
          {
            label: "📥 RÉCUPÉRER L'AUDIO",
            primary: true,
            onClick: async (toast) => {
              const { blobs, mimeType } = await BackupManager.getAllChunks();
              const recoveredMime = mimeType || 'audio/webm';
              const ext = (recoveredMime.split(';')[0].split('/')[1]) || 'webm';
              downloadRecording(new Blob(blobs, { type: recoveredMime }), 'RECOVERY_' + Date.now() + '.' + ext);
              // Après téléchargement, on propose d'effacer (non-intrusif)
              toast.remove();
              NotificationManager.show(
                "Fichier récupéré. Effacer la sauvegarde ?",
                "info",
                0,
                "Nettoyage",
                [
                  { label: "Oui, effacer", primary: false, onClick: (t) => { BackupManager.clear(); t.remove(); } },
                  { label: "Garder pour plus tard", primary: false, onClick: (t) => t.remove() }
                ]
              );
            }
          },
          {
            label: "Ignorer / Effacer",
            primary: false,
            onClick: (toast) => {
              if (confirm("Voulez-vous vraiment supprimer définitivement cette sauvegarde ?")) {
                BackupManager.clear();
                toast.remove();
              }
            }
          }
        ]
      );
    }
  })();
  }

  // Log pour debug
  console.log('[Record Script] Script chargé, readyState:', document.readyState);
  
  if (document.readyState === 'loading') {
    console.log('[Record Script] En attente de DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', function() {
      console.log('[Record Script] DOMContentLoaded déclenché');
      initRecord();
    });
  } else {
    console.log('[Record Script] DOM déjà prêt, initialisation immédiate');
    // Attendre un peu pour être sûr que les éléments sont dans le DOM
    setTimeout(initRecord, 100);
  }
})();
