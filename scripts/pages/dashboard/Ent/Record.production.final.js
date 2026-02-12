// Log IMMÉDIAT pour vérifier que le script se charge (avant DOMContentLoaded)
console.log('[Record Script] 🚀 Script chargé - Version production finale');

// Fonction principale
function initRecordScript() {
  const DBG = !!window.AGILO_DEBUG;
  
  // Log de démarrage
  console.log('[Record Script] 🚀 Initialisation du script d\'enregistrement');

  // --- MODULES FIABILITÉ (INJECTÉS V2) ---
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

  const BackupManager = {
    db: null, DB_NAME: 'AgilotextRecDB', STORE_NAME: 'chunks',
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
    async saveChunk(blob) {
      if (blob.size === 0) return;
      try {
        await this.open();
        this.db.transaction([this.STORE_NAME], 'readwrite').objectStore(this.STORE_NAME).add({
          timestamp: Date.now(), blob: blob
        });
      } catch (e) { if (DBG) console.warn('[Backup] Save failed:', e); }
    },
    async getAllChunks() {
      await this.open();
      return new Promise((resolve, reject) => {
        const req = this.db.transaction([this.STORE_NAME], 'readonly').objectStore(this.STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result.map(r => r.blob));
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

  const MAX_RECORDING_MS = null;
  const MIN_BLOB_BYTES = 2048;

  const MIC_CONSTRAINTS_BASE = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: false, // Désactivé car on a un AGC custom (évite double AGC / pompage)
    channelCount: 1,
    sampleRate: 48000
  };

  const MIX_PREGAIN_DB = 6.0; // Traitement fort pour transcription : gain global élevé

  const MIC_BASE_GAIN = 1.8;  // Traitement fort : gain micro élevé (+80%)
  const SYS_BASE_GAIN = 1.2;  // Traitement fort : gain audio système (+20%)

  const AGC_ENABLED = true;
  const AGC_TARGET = 0.35; // Traitement fort : cible RMS élevée (35%) pour signal constant
  const AGC_SMOOTH = 0.03;  // Réactif pour traitement fort
  const AGC_MIN_GAIN = 0.60;  // Permet de baisser si trop fort
  const AGC_MAX_GAIN = 4.0;   // Traitement fort : amplification max élevée (400%)

  const MIC_COMP = {
    threshold: -30,   // Traitement fort : compresse tôt
    knee: 10,         // Transition nette
    ratio: 3.5,       // Traitement fort : compression agressive
    attack: 0.002,    // Très rapide
    release: 0.15     // Release court
  };

  const MIX_LIMITER = {
    threshold: -0.5,  // Traitement fort : proche de 0dB pour niveau constant
    knee: 0,
    ratio: 20,
    attack: 0.001,
    release: 0.08     // Rapide
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

  // DEBUG: Vérifier que les éléments sont trouvés
  console.log('[Record Script] 🔍 Vérification des éléments DOM:');
  console.log('  - startButton (.startrecording):', startButton ? '✅' : '❌');
  console.log('  - startAudioButton (#recording_audio):', startAudioButton ? '✅' : '❌');
  console.log('  - startSharingButton (#recording_sharing):', startSharingButton ? '✅' : '❌');
  console.log('  - recordingDiv (#recordingDiv):', recordingDiv ? '✅' : '❌');
  console.log('  - recordingAnimation (#Recording_animation):', recordingAnimation ? '✅' : '❌');
  console.log('  - stopButton (#stopRecording):', stopButton ? '✅' : '❌');
  console.log('  - pauseButton (#pauseRecording):', pauseButton ? '✅' : '❌');
  
  // DEBUG: Chercher tous les boutons qui contiennent "record" ou "enregistrement"
  const allButtons = document.querySelectorAll('button, [role="button"], a[href="#"], .w-button');
  const recordButtons = Array.from(allButtons).filter(btn => {
    const text = (btn.textContent || btn.innerText || '').toLowerCase();
    const id = (btn.id || '').toLowerCase();
    const className = (btn.className || '').toLowerCase();
    return text.includes('record') || text.includes('enregistrer') || 
           id.includes('record') || className.includes('record');
  });
  console.log('[Record Script] 🔍 Boutons trouvés contenant "record/enregistrer":', recordButtons.length);
  recordButtons.forEach((btn, idx) => {
    console.log(`  [${idx}] ID: ${btn.id || 'N/A'}, Classes: ${btn.className || 'N/A'}, Text: ${(btn.textContent || '').substring(0, 50)}`);
  });

  // Fonction pour réessayer de trouver les éléments si ils sont chargés dynamiquement
  function retryFindElements(maxRetries = 5, delay = 500) {
    let retries = 0;
    const checkElements = () => {
      retries++;
      const audioBtn = document.getElementById('recording_audio');
      const sharingBtn = document.getElementById('recording_sharing');
      const startBtn = document.querySelector('.startrecording');
      
      if ((audioBtn || sharingBtn || startBtn) && retries < maxRetries) {
        console.log(`[Record Script] 🔄 Tentative ${retries}/${maxRetries} - Éléments trouvés, réinitialisation...`);
        
        // Réattacher les listeners si les boutons sont maintenant disponibles
        if (audioBtn && !audioBtn.hasAttribute('data-listener-attached')) {
          console.log('[Record Script] ✅ Réattachement listener sur startAudioButton');
          audioBtn.setAttribute('data-listener-attached', 'true');
          audioBtn.onclick = function () {
            console.log('[Record Script] 🎤 Clic sur startAudioButton (retry)');
            if (isMobileDevice() || !supportsDisplayMedia()) {
              initiateRecording(false);
            } else if (isChromeLike()) {
              initiateRecording(false);
            } else if (startBtn) {
              startBtn.click();
            } else {
              initiateRecording(false);
            }
          };
        }
        
        if (sharingBtn && !sharingBtn.hasAttribute('data-listener-attached')) {
          console.log('[Record Script] ✅ Réattachement listener sur startSharingButton');
          sharingBtn.setAttribute('data-listener-attached', 'true');
          sharingBtn.onclick = function () {
            console.log('[Record Script] 🎥 Clic sur startSharingButton (retry)');
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
            } else if (startBtn) {
              startBtn.click();
            } else {
              initiateRecording(true);
            }
          };
        }
        
        if (startBtn && !startBtn.hasAttribute('data-listener-attached')) {
          console.log('[Record Script] ✅ Réattachement listener sur startButton');
          startBtn.setAttribute('data-listener-attached', 'true');
          startBtn.addEventListener('click', function () {
            console.log('[Record Script] 🎬 Clic sur startButton (retry)');
            initiateRecording(false);
          });
        }
      } else if (retries < maxRetries) {
        setTimeout(checkElements, delay);
      } else {
        console.warn('[Record Script] ⚠️ Éléments non trouvés après', maxRetries, 'tentatives');
      }
    };
    
    // Ne lancer le retry que si les éléments ne sont pas trouvés initialement
    if (!startAudioButton && !startSharingButton && !startButton) {
      console.log('[Record Script] 🔄 Aucun bouton trouvé, démarrage du retry...');
      setTimeout(checkElements, delay);
    }
  }
  
  // Lancer le retry si nécessaire
  retryFindElements();

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
  let micDeEsser = null; // De-esser léger pour réduire les sifflantes
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
  let screenVideoTrack = null; // Pour pouvoir retirer le listener si besoin
  let onScreenEnded = null; // Handler nommé pour pouvoir le retirer

  let stopInProgress = false; // Flag pour éviter les doubles clics "Stop"

  const log = (...a) => { if (DBG) console.log('[rec]', ...a); };
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

  // Vérifier si getDisplayMedia est disponible
  function supportsDisplayMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  }

  // Vérifier si MediaRecorder est disponible
  function supportsMediaRecorder() {
    return typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function';
  }

  // Vérifier si Web Audio API est disponible
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

  /* =========================
     FONCTION TOGGLE ANIMATION AMÉLIORÉE POUR WEBFLOW
     ========================= */
  function toggleAnimation(on) {
    // D'abord, afficher/masquer les éléments
    if (recordingAnimation) {
      recordingAnimation.style.display = on ? 'block' : 'none';
    }
    if (recordingDiv) {
      recordingDiv.style.display = on ? 'block' : 'none';
    }

    // Si on active l'animation, déclencher les interactions Webflow
    if (on) {
      // Attendre un peu pour que le DOM soit mis à jour
      setTimeout(() => {
        // Méthode 1: Déclencher via Webflow IX2 si disponible
        if (window.Webflow && window.Webflow.require) {
          try {
            const ix2 = window.Webflow.require('ix2');
            if (ix2 && typeof ix2.init === 'function') {
              // Réinitialiser IX2 pour prendre en compte les nouveaux éléments visibles
              ix2.init();
              if (DBG) console.log('[Webflow] IX2 réinitialisé');
            }
          } catch (e) {
            if (DBG) console.warn('[Webflow] IX2 non disponible:', e);
          }
        }

        // Méthode 2: Déclencher un événement personnalisé pour les interactions Webflow
        if (recordingDiv) {
          // Déclencher un événement qui peut être capturé par Webflow
          recordingDiv.dispatchEvent(new CustomEvent('webflow:show', { bubbles: true }));
          if (DBG) console.log('[Webflow] Événement webflow:show déclenché');
        }

        // Méthode 3: Ajouter/retirer une classe pour déclencher les interactions
        if (recordingDiv) {
          recordingDiv.classList.add('is-recording');
          recordingDiv.classList.remove('is-not-recording');
        }
        if (recordingAnimation) {
          recordingAnimation.classList.add('is-recording');
          recordingAnimation.classList.remove('is-not-recording');
        }

        // Méthode 4: Forcer le recalcul du style pour déclencher les animations CSS
        if (recordingDiv) {
          void recordingDiv.offsetHeight; // Force reflow
        }
        if (recordingAnimation) {
          void recordingAnimation.offsetHeight; // Force reflow
        }

        // Méthode 5: Essayer de déclencher via les attributs data-webflow
        if (recordingDiv && recordingDiv.hasAttribute('data-wf-animation')) {
          recordingDiv.setAttribute('data-wf-animation', 'play');
        }
      }, 50); // Petit délai pour laisser le DOM se mettre à jour
    } else {
      // Quand on désactive, retirer les classes
      if (recordingDiv) {
        recordingDiv.classList.remove('is-recording');
        recordingDiv.classList.add('is-not-recording');
      }
      if (recordingAnimation) {
        recordingAnimation.classList.remove('is-recording');
        recordingAnimation.classList.add('is-not-recording');
      }
    }
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
    // Fallback pour navigateurs anciens
    if (typeof DataTransfer !== 'undefined') {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // Fallback pour navigateurs très anciens
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

    const hint = document.createElement('div');
    hint.id = 'tab-audio-hint';
    hint.textContent = 'Partage un "Onglet Chrome" et coche "Partager l\'audio de l\'onglet" pour capter la voix de l\'autre.';
    Object.assign(hint.style, {
      position: 'fixed', bottom: '12px', left: '12px', background: '#111', color: '#fff',
      padding: '8px 12px', borderRadius: '6px', fontSize: '13px', opacity: .92, zIndex: 99999
    });
    document.body.appendChild(hint);
    setTimeout(() => hint.remove(), 8000);
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

        const g = micGainNode.gain.value;
        if (rms > 0.001) {
          const desired = Math.min(AGC_MAX_GAIN, Math.max(AGC_MIN_GAIN, MIC_BASE_GAIN * (AGC_TARGET / rms)));
          micGainNode.gain.value = g + (desired - g) * AGC_SMOOTH;
        }
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

    // De-esser léger pour réduire les sifflantes (utile pour la transcription)
    micDeEsser = audioContext.createBiquadFilter();
    micDeEsser.type = 'peaking';
    micDeEsser.frequency.value = 6000;  // Fréquence des sifflantes
    micDeEsser.Q.value = 2;
    micDeEsser.gain.value = -3;         // -3dB

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

    // Note: AudioContext.resume() doit être appelé dans un handler utilisateur (initiateRecording)
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
    console.log('[Record Script] ✅ Attachement listener sur startAudioButton');
    startAudioButton.setAttribute('data-listener-attached', 'true');
    startAudioButton.onclick = function () {
      console.log('[Record Script] 🎤 Clic sur startAudioButton');
      // Sur mobile ou navigateurs sans getDisplayMedia, on permet quand même l'enregistrement micro seul
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
  } else {
    console.warn('[Record Script] ⚠️ startAudioButton (#recording_audio) non trouvé !');
  }
  
  if (startSharingButton) {
    console.log('[Record Script] ✅ Attachement listener sur startSharingButton');
    startSharingButton.setAttribute('data-listener-attached', 'true');
    startSharingButton.onclick = function () {
      console.log('[Record Script] 🎥 Clic sur startSharingButton');
      // Sur mobile, getDisplayMedia n'est pas disponible, on fait un fallback micro seul
      if (isMobileDevice() || !supportsDisplayMedia()) {
        if (confirm('Le partage d\'écran n\'est pas disponible sur cet appareil. Voulez-vous enregistrer uniquement le micro ?')) {
          initiateRecording(false);
        }
      } else if (isFirefox()) {
        // Firefox : avertir que l'audio système ne sera pas capté
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
  } else {
    console.warn('[Record Script] ⚠️ startSharingButton (#recording_sharing) non trouvé !');
  }

  function effectiveMicConstraints() {
    const c = { audio: {} };

    // Sur mobile/iOS, on simplifie les contraintes
    if (isMobileDevice() || isIOS()) {
      c.audio = { echoCancellation: true };
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
        // Dernier recours : contraintes minimales
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

    track.addEventListener('mute', () => warn('Piste micro mute'));
    track.addEventListener('unmute', () => warn('Piste micro unmute'));
  }

  // Exposer initiateRecording globalement pour la délégation d'événements
  window.initiateRecording = async function initiateRecording(shareScreen) {
    console.log('[Record Script] 🎬 initiateRecording appelé, shareScreen:', shareScreen);
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      console.warn('[Record Script] ⚠️ Enregistrement déjà en cours, ignoré');
      return;
    }

    // AJOUT : Réactiver AudioContext dans le contexte utilisateur (iOS)
    if (audioContext && audioContext.state === 'suspended') {
      try {
        await audioContext.resume();
      } catch (e) {
        warn('AudioContext.resume() dans initiateRecording:', e);
      }
    }

    // Vérifications de compatibilité
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Votre navigateur ne supporte pas l\'enregistrement audio. Veuillez utiliser un navigateur récent (Chrome, Firefox, Safari, Edge).');
      return;
    }

    if (!supportsMediaRecorder()) {
      alert('Votre navigateur ne supporte pas MediaRecorder. Veuillez utiliser un navigateur récent.');
      return;
    }

    setupAudioContext();

    // Vérifier que setupAudioContext() a réussi
    if (!destination || !destination.stream) {
      alert("Votre navigateur ne supporte pas le mixage audio (WebAudio). Essayez Chrome/Edge.");
      stopStreamTracks(currentMicStream);
      currentMicStream = null;
      stopStreamTracks(currentScreenStream);
      currentScreenStream = null;
      teardownAudioGraph();
      return;
    }

    // Vérification des permissions (avec fallback pour navigateurs sans Permissions API)
    try {
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const res = await navigator.permissions.query({ name: 'microphone' });
          if (res.state !== 'granted') {
            // On continue quand même, l'erreur sera gérée par getUserMedia
          }
        } catch (e) {
          // Permissions API non supportée ou erreur, on continue
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

      alert(errorMsg);
      teardownAudioGraph();
      return;
    }

    // Onglet/écran (seulement si demandé ET disponible)
    if (shareScreen && !isSharingScreen && supportsDisplayMedia()) {
      isSharingScreen = true;
      try {
        currentScreenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        // Stocker la piste vidéo mais NE PAS attacher le listener tout de suite
        // (on l'attachera seulement si on garde vraiment le stream après le check hasSystemAudio)
        screenVideoTrack = currentScreenStream.getVideoTracks && currentScreenStream.getVideoTracks()[0] || null;

        currentScreenStream.addEventListener?.('addtrack', (e) => {
          if (e.track && e.track.kind === 'audio') {
            warn('Nouvelle piste audio écran ajoutée -> rebind');
            bindSystemToGraph(currentScreenStream);
          }
        });

      } catch (e) {
        err('getDisplayMedia:', e);
        // Afficher l'erreur comme dans l'ancien script : div error + popup
        if (errorMessage) errorMessage.style.display = 'block';
        if (stopButton) stopButton.style.display = 'none';
        if (pauseButton) pauseButton.style.display = 'none';

        // Différencier les types d'erreurs
        let errorMsg;
        if (e.name === 'NotAllowedError') {
          errorMsg = 'Permission de partage d\'écran refusée.\n\nPour capter l\'audio d\'un onglet, partage un "Onglet Chrome" et coche "Partager l\'audio".';
        } else if (e.name === 'NotFoundError') {
          errorMsg = 'Aucune source de partage trouvée.';
        } else if (e.name === 'AbortError') {
          errorMsg = 'Partage d\'écran annulé.';
        } else {
          errorMsg = 'Erreur de partage d\'écran : ' + (e.message || e.name || 'Erreur inconnue');
        }
        alert(errorMsg);

        isSharingScreen = false;
        currentScreenStream = null;
        screenVideoTrack = null;
        // Nettoyer les ressources
        stopStreamTracks(currentMicStream);
        currentMicStream = null;
        teardownAudioGraph();
        return; // NE PAS démarrer l'enregistrement
      }
    } else if (shareScreen && !supportsDisplayMedia()) {
      // getDisplayMedia non disponible, on continue avec micro seul
      warn('getDisplayMedia non disponible, enregistrement micro seul');
    }

    // Vérifier l'audio système AVANT de démarrer l'enregistrement
    if (shareScreen && currentScreenStream) {
      const hasSystemAudio = !!(currentScreenStream.getAudioTracks && currentScreenStream.getAudioTracks().length > 0);
      if (!hasSystemAudio) {
        // Firefox ne supporte pas l'audio système via getDisplayMedia
        // On fait un fallback : continuer en micro seul avec un message explicite
        if (isFirefox()) {
          warn('Firefox : pas d\'audio système détecté, enregistrement micro seul');
          alert('⚠️ Firefox ne supporte pas la capture de l\'audio système/onglet.\n\nL\'enregistrement continuera avec votre micro uniquement.\n\nPour capter la voix de l\'autre personne, utilisez Chrome ou Edge.');
          // On continue avec micro seul (pas de currentScreenStream)
          // IMPORTANT : libérer la capture écran (on n'a pas encore attaché le listener ended, donc c'est safe)
          stopStreamTracks(currentScreenStream);
          currentScreenStream = null;
          screenVideoTrack = null;
          isSharingScreen = false;
        } else {
          // Sur Chrome/Edge : bloquer si pas d'audio système (c'est possible, donc on doit l'exiger)
          err('Pas d\'audio système détecté, enregistrement annulé');
          if (errorMessage) errorMessage.style.display = 'block';
          if (stopButton) stopButton.style.display = 'none';
          if (pauseButton) pauseButton.style.display = 'none';
          alert('Astuce : sélectionnez "Onglet Chrome" et cochez "Partager l\'audio de l\'onglet" pour capter la voix de l\'autre.');
          // Afficher l'aide pour Chrome/Edge
          showTabAudioHintOnce();
          // Nettoyer les ressources
          stopStreamTracks(currentMicStream);
          stopStreamTracks(currentScreenStream);
          currentMicStream = null;
          currentScreenStream = null;
          screenVideoTrack = null;
          isSharingScreen = false;
          teardownAudioGraph();
          return; // NE PAS démarrer l'enregistrement
        }
      } else {
        // On garde le stream, donc on peut maintenant attacher le listener ended
        // Utiliser une fonction nommée pour pouvoir la retirer si besoin
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
      // Cette fonction ne devrait pas être appelée si pas d'audio système
      // car c'est vérifié dans initiateRecording avant
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
    try {
      const newMic = await getMicStreamWithFallback();
      stopStreamTracks(currentMicStream);
      currentMicStream = newMic;
      attachMicTrackListeners(currentMicStream);
      bindMicToGraph(currentMicStream);
      log('Micro rétabli.');
    } catch (e) {
      err('Échec de réacquisition du micro:', e);
      alert("Le micro a été perdu (casque déconnecté). Merci de re-sélectionner un micro puis relancer l'enregistrement si besoin.");
    }
  }

  function getSupportedMimeType() {
    // Ordre de préférence selon les navigateurs
    const types = [
      'audio/webm; codecs=opus',  // Chrome, Edge, Firefox
      'audio/webm',               // Chrome, Edge (fallback)
      'audio/ogg; codecs=opus',   // Firefox
      'audio/mp4',                // Safari (limité)
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    // Fallback : essayer sans spécifier de codec
    return 'audio/webm';
  }

  function startRecording(stream) {
    // Réactiver AudioContext si suspendu (souvent nécessaire sur mobile/iOS)
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().catch(e => {
        warn('Impossible de réactiver AudioContext:', e);
      });
    }

    const mimeType = getSupportedMimeType();
    let options = { mimeType };

    // Sur Firefox, certaines options peuvent causer des problèmes
    if (isFirefox()) {
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        options = {}; // Laisser Firefox choisir
      }
    }

    try {
      mediaRecorder = new MediaRecorder(stream, options);
    } catch (e) {
      err('MediaRecorder non supporté:', mimeType, e);
      // Essayer sans options
      try {
        mediaRecorder = new MediaRecorder(stream);
      } catch (e2) {
        err('MediaRecorder échec complet:', e2);
        alert("Votre navigateur ne supporte pas l'enregistrement audio. Essayez un navigateur récent (Chrome, Firefox, Edge, Safari).");
        toggleAnimation(false);
        // Stopper les streams en cas d'échec
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
        // [INJECTED V2]
        Reliability.notifyChunk();
        BackupManager.saveChunk(ev.data);
      }
    };

    mediaRecorder.onerror = (event) => {
      err('MediaRecorder error:', event.error);
      const name = (event.error && event.error.name) || 'Unknown';
      const map = {
        NotSupportedError: "Format audio non supporté sur ce navigateur.",
        SecurityError: "Accès refusé pour des raisons de sécurité.",
        InvalidStateError: "État d'enregistrement invalide.",
        UnknownError: "Erreur inconnue lors de l'enregistrement."
      };
      alert(map[name] || "Erreur d'enregistrement : " + name);
      stopRecordingAndSubmitForm();
    };

    mediaRecorder.onstop = function () {
      stopInProgress = false;

      // [INJECTED V2]
      WakeLockManager.release();
      Reliability.stop();

      setTimeout(() => {
        const finalMime = (mediaRecorder && mediaRecorder.mimeType) ? mediaRecorder.mimeType : mimeType;
        const audioBlob = new Blob(audioChunks, { type: finalMime });

        if (!audioBlob || audioBlob.size < MIN_BLOB_BYTES) {
          warn('Audio trop petit ou vide');
          audioChunks = [];
          alert("L'enregistrement est trop court ou vide. Réessayez.");
          // Cleanup même en cas de return early
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
          if (typeof form.requestSubmit === 'function') form.requestSubmit();
          else if (submitButton) submitButton.click();
        };

        let submitted = false;
        let submitAttempts = 0;
        const SUBMIT_RETRY_DELAY = 150;
        const MAX_SUBMIT_WAIT_MS = 30000; // Plus sûr pour connexions lentes
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

        // Stopper les streams et fermer AudioContext APRÈS avoir construit le blob
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

        // [INJECTED V2]
        BackupManager.clear();
      }, 50);
    };

    // Timeslice pour flush régulier (important pour Firefox)
    const timeslice = isFirefox() ? 1000 : 250;
    try {
      mediaRecorder.start(timeslice);
    } catch (e) {
      try {
        mediaRecorder.start();
      } catch (e2) {
        err('Impossible de démarrer MediaRecorder:', e2);
        alert('Erreur lors du démarrage de l\'enregistrement. Veuillez réessayer.');
        toggleAnimation(false);
        // Stopper les streams en cas d'échec
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

    // IMPORTANT: Déclencher l'animation Webflow APRÈS avoir démarré l'enregistrement
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
        alert('La pause n\'est pas supportée sur ce navigateur.');
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
      stopRecordingAndSubmitForm();
    }
  });

  window.addEventListener('pagehide', function () {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.requestData(); } catch (e) { }
      stopRecordingAndSubmitForm();
    }
  });

  // Sur mobile/iOS, gérer la visibilité de la page
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && mediaRecorder && mediaRecorder.state === 'recording') {
      warn('Page en arrière-plan pendant l\'enregistrement');
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
    console.log('[Record Script] ✅ Attachement listener sur startButton (.startrecording)');
    startButton.setAttribute('data-listener-attached', 'true');
    startButton.addEventListener('click', function () {
      console.log('[Record Script] 🎬 Clic sur startButton');
      initiateRecording(false);
    });
  } else {
    console.warn('[Record Script] ⚠️ startButton (.startrecording) non trouvé !');
  }

  try {
    navigator.mediaDevices?.addEventListener?.('devicechange', () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        warn('devicechange détecté -> tentative de recovery micro');
        restartMic();
      }
    });
  } catch { }

  // [INJECTED V2] Recovery Check
  (async function () {
    const count = await BackupManager.count();
    if (count > 0) {
      if (confirm("⚠️ Une session précédente a été interrompue (" + count + " fragments).\nVoulez-vous la récupérer ?")) {
        const blobs = await BackupManager.getAllChunks();
        downloadRecording(new Blob(blobs, { type: 'audio/webm' }), 'RECOVERY_' + Date.now() + '.webm');
        if (confirm("Effacer la sauvegarde ?")) BackupManager.clear();
      }
    }
  })();
}

// Fonction wrapper pour initialiser le script
function initRecordScriptWrapper() {
  try {
    initRecordScript();
  } catch (e) {
    console.error('[Record Script] ❌ Erreur lors de l\'initialisation:', e);
  }
}

// Attendre que le DOM soit prêt (même si déjà chargé)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRecordScriptWrapper);
} else {
  // DOM déjà chargé, lancer immédiatement avec un petit délai pour laisser les autres scripts se charger
  setTimeout(initRecordScriptWrapper, 100);
}

// Délégation d'événements globale pour capturer les clics même si les boutons sont créés après
document.addEventListener('click', function(e) {
  const target = e.target;
  const btn = target.closest('#recording_audio, #recording_sharing, .startrecording, [id*="recording"], [class*="recording"]');
  
  if (btn) {
    console.log('[Record Script] 🎯 Clic détecté sur:', btn.id || btn.className || 'bouton inconnu');
    
    // Vérifier quel bouton a été cliqué
    if (btn.id === 'recording_audio' || btn.classList.contains('recording_audio')) {
      console.log('[Record Script] 🎤 Bouton audio détecté');
      e.preventDefault();
      e.stopPropagation();
      if (typeof initiateRecording === 'function') {
        initiateRecording(false);
      } else {
        console.error('[Record Script] ❌ initiateRecording non disponible');
      }
    } else if (btn.id === 'recording_sharing' || btn.classList.contains('recording_sharing')) {
      console.log('[Record Script] 🎥 Bouton sharing détecté');
      e.preventDefault();
      e.stopPropagation();
      if (typeof initiateRecording === 'function') {
        initiateRecording(true);
      } else {
        console.error('[Record Script] ❌ initiateRecording non disponible');
      }
    } else if (btn.classList.contains('startrecording')) {
      console.log('[Record Script] 🎬 Bouton start détecté');
      e.preventDefault();
      e.stopPropagation();
      if (typeof initiateRecording === 'function') {
        initiateRecording(false);
      } else {
        console.error('[Record Script] ❌ initiateRecording non disponible');
      }
    }
  }
}, true); // Utiliser capture phase pour intercepter avant les autres handlers
