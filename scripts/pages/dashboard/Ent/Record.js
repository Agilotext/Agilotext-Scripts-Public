document.addEventListener('DOMContentLoaded', function () {
  const DBG = !!window.AGILO_DEBUG;

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

  // Détection de silence prolongé
  let silenceStartTime = null;
  const SILENCE_THRESHOLD = 0.02; // RMS minimum pour considérer comme "son" (2%)
  const SILENCE_WARNING_MS = 2 * 60 * 1000; // 2 minutes avant avertissement
  const SILENCE_AUTO_STOP_MS = 15 * 60 * 1000; // 15 minutes avant arrêt automatique
  let silenceWarningShown = false;
  let silenceAutoStopWarned = false;
  let silenceStopTriggered = false; // Verrou pour éviter les déclenchements multiples

  // Exposer les variables de silence sur window pour le debug
  window.AGILO_SILENCE_DEBUG = {
    getState: () => ({
      silenceStartTime,
      SILENCE_THRESHOLD,
      SILENCE_WARNING_MS,
      SILENCE_AUTO_STOP_MS,
      silenceWarningShown,
      silenceAutoStopWarned,
      lastMeterLevel,
      isRecording: mediaRecorder && mediaRecorder.state === 'recording',
      silenceDuration: silenceStartTime ? performance.now() - silenceStartTime : 0
    })
  };

  // Exposer les stats audio pour debug
  window.AGILO_AUDIO_DEBUG = {
    getStats: () => ({
      micGain: micGainNode?.gain?.value,
      agcEnabled: AGC_ENABLED,
      mimeType: mediaRecorder?.mimeType,
      audioContextState: audioContext?.state,
      chunks: audioChunks.length,
      backupSessionId: backupSessionId,
      suspensionDetected: suspensionDetected,
      totalSuspensionMs: totalSuspensionMs,
      wakeLockActive: !!wakeLockSentinel
    }),
    recoverBackup: null,  // Set dynamically by checkForRecovery
    clearBackup: null,    // Set dynamically by checkForRecovery
    backupInfo: null      // Set dynamically by checkForRecovery
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

  let alertedNoSystemAudio = false;
  let stopInProgress = false; // Flag pour éviter les doubles clics "Stop"

  // [NEW] Wake Lock
  let wakeLockSentinel = null;

  // [NEW] Heartbeat / détection veille
  let heartbeatInterval = null;
  let lastHeartbeatTs = 0;
  const HEARTBEAT_INTERVAL_MS = 2000;
  const HEARTBEAT_GAP_THRESHOLD_MS = 5000; // >5s = suspension probable

  // [NEW] Chunk watchdog
  let lastChunkTs = 0;
  let chunkWatchdogInterval = null;
  let activeTimeslice = 250;
  const CHUNK_WATCHDOG_MULTIPLIER = 3;

  // [NEW] IndexedDB backup
  const IDB_NAME = 'agilo_recording_backup';
  const IDB_VERSION = 1;
  const IDB_STORE = 'chunks';
  let backupSessionId = null;

  // [NEW] Suspension recovery
  let suspensionDetected = false;
  let totalSuspensionMs = 0;

  // [NEW] Tab title
  const originalDocTitle = document.title;

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

  function isSafari() {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
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

  /* =========================
     Gestion erreurs (comme ancien script)
     ========================= */

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

        // Détection de silence prolongé
        checkSilence(rms);

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
    // Réinitialiser la détection de silence
    silenceStartTime = null;
    silenceWarningShown = false;
    silenceAutoStopWarned = false;
  }

  /* ---------------- Forcer l'attention de l'utilisateur ---------------- */
  let titleBlinkInterval = null;
  const originalTitle = document.title;

  function forcePageFocus(message) {
    // Changer le titre de l'onglet pour attirer l'attention
    if (titleBlinkInterval) clearInterval(titleBlinkInterval);

    let blinkCount = 0;
    const maxBlinks = 20; // Clignoter pendant 10 secondes (20 * 500ms)

    titleBlinkInterval = setInterval(() => {
      if (blinkCount >= maxBlinks) {
        clearInterval(titleBlinkInterval);
        titleBlinkInterval = null;
        document.title = originalTitle;
        return;
      }
      document.title = blinkCount % 2 === 0 ? '⚠️ ATTENTION - ' + message : originalTitle;
      blinkCount++;
    }, 500);

    // Essayer de forcer le focus de la fenêtre
    try {
      window.focus();
      if (document.hasFocus && !document.hasFocus()) {
        window.focus();
      }
    } catch (e) {
      warn('Impossible de forcer le focus:', e);
    }

    // Utiliser l'API Notification si disponible et autorisée
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification('⚠️ Attention - Enregistrement', {
            body: message,
            icon: '/favicon.ico',
            tag: 'silence-warning',
            requireInteraction: true
          });
        } catch (e) {
          warn('Erreur Notification:', e);
        }
      } else if (Notification.permission === 'default') {
        // Demander la permission (mais seulement une fois)
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            try {
              new Notification('⚠️ Attention - Enregistrement', {
                body: message,
                icon: '/favicon.ico',
                tag: 'silence-warning',
                requireInteraction: true
              });
            } catch (e) {
              warn('Erreur Notification:', e);
            }
          }
        });
      }
    }
  }

  function stopTitleBlink() {
    if (titleBlinkInterval) {
      clearInterval(titleBlinkInterval);
      titleBlinkInterval = null;
      document.title = originalTitle;
    }
  }

  /* ================ [NEW] WAKE LOCK ================ */
  async function requestWakeLock() {
    if (!('wakeLock' in navigator)) { warn('Wake Lock API non supportée'); return; }
    try {
      wakeLockSentinel = await navigator.wakeLock.request('screen');
      log('Wake Lock acquis');
      wakeLockSentinel.addEventListener('release', () => {
        log('Wake Lock relâché');
      });
    } catch (e) {
      warn('Wake Lock refusé:', e);
    }
  }

  async function releaseWakeLock() {
    if (wakeLockSentinel) {
      try { await wakeLockSentinel.release(); } catch (e) { warn('Erreur release Wake Lock:', e); }
      wakeLockSentinel = null;
    }
  }

  /* ================ [NEW] HEARTBEAT / DÉTECTION VEILLE ================ */
  function startHeartbeat() {
    lastHeartbeatTs = Date.now();
    suspensionDetected = false;
    totalSuspensionMs = 0;
    if (heartbeatInterval) clearInterval(heartbeatInterval);

    heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const gap = now - lastHeartbeatTs;

      if (gap > HEARTBEAT_GAP_THRESHOLD_MS) {
        warn('⚠️ Suspension détectée: gap de', gap, 'ms (' + Math.round(gap / 1000) + 's)');
        suspensionDetected = true;
        totalSuspensionMs += gap - HEARTBEAT_INTERVAL_MS;
        handleSuspendRecovery(gap);
      }

      lastHeartbeatTs = now;
    }, HEARTBEAT_INTERVAL_MS);
  }

  function stopHeartbeat() {
    if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
  }

  function handleSuspendRecovery(gapMs) {
    const gapSec = Math.round(gapMs / 1000);
    const gapMin = Math.floor(gapSec / 60);
    const gapSecRem = gapSec % 60;

    // Tenter de reprendre AudioContext
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        log('AudioContext repris après suspension');
      }).catch(e => {
        warn('Échec resume AudioContext après suspension:', e);
      });
    }

    // Tenter de flush les données pendantes
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      try { mediaRecorder.requestData(); } catch (e) {
        warn('Erreur requestData après suspension:', e);
      }
    }

    // Si MediaRecorder est devenu inactive = l'enregistrement est mort
    if (mediaRecorder && mediaRecorder.state === 'inactive') {
      err('MediaRecorder devenu inactive après suspension !');
      forcePageFocus('Enregistrement interrompu par la veille');
      alert('⚠️ L\'enregistrement a été interrompu par la mise en veille de votre ordinateur.\n\nLes données enregistrées avant la mise en veille ont été sauvegardées localement.\n\nDurée de la coupure : ' + (gapMin > 0 ? gapMin + ' min ' : '') + gapSecRem + ' s');
      return;
    }

    // Ré-acquérir le Wake Lock (il est perdu pendant la veille)
    requestWakeLock();

    // Avertir l'utilisateur si coupure significative (> 30s)
    const timeStr = gapMin > 0 ? gapMin + ' min ' + gapSecRem + ' s' : gapSec + ' s';
    if (gapMs > 30000) {
      forcePageFocus('Veille détectée - ' + timeStr);
      alert('⚠️ Votre ordinateur s\'est mis en veille pendant ' + timeStr + '.\n\nL\'enregistrement a pu être affecté. Les données avant la coupure sont sauvegardées.\n\n💡 Pour éviter ce problème :\n- Gardez votre ordinateur branché\n- Ne fermez pas l\'écran\n- Vérifiez les réglages d\'économie d\'énergie');
    }
  }

  /* ================ [NEW] CHUNK WATCHDOG ================ */
  function startChunkWatchdog(timesliceMs) {
    lastChunkTs = Date.now();
    if (chunkWatchdogInterval) clearInterval(chunkWatchdogInterval);

    const threshold = timesliceMs * CHUNK_WATCHDOG_MULTIPLIER;

    chunkWatchdogInterval = setInterval(() => {
      if (!mediaRecorder || mediaRecorder.state !== 'recording') return;

      const elapsed = Date.now() - lastChunkTs;
      if (elapsed > threshold) {
        warn('Chunk watchdog: aucun chunk depuis', elapsed, 'ms (seuil:', threshold, 'ms)');
        try {
          mediaRecorder.requestData();
          log('requestData() forcé par watchdog');
        } catch (e) {
          warn('Erreur requestData watchdog:', e);
        }
      }
    }, timesliceMs * 2);
  }

  function stopChunkWatchdog() {
    if (chunkWatchdogInterval) { clearInterval(chunkWatchdogInterval); chunkWatchdogInterval = null; }
  }

  /* ================ [NEW] INDEXEDDB BACKUP ================ */
  function openBackupDB() {
    return new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE, { keyPath: 'id', autoIncrement: true });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => { warn('IndexedDB open error:', req.error); reject(req.error); };
      } catch (e) {
        warn('IndexedDB non disponible:', e);
        reject(e);
      }
    });
  }

  async function saveChunkToBackup(blob) {
    if (!backupSessionId) return;
    try {
      const db = await openBackupDB();
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).add({
        sessionId: backupSessionId,
        blob: blob,
        timestamp: Date.now()
      });
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (e) {
      warn('Erreur sauvegarde chunk IndexedDB:', e);
    }
  }

  async function startBackupSession() {
    backupSessionId = 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    try {
      const db = await openBackupDB();
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).add({
        sessionId: backupSessionId,
        type: 'session_start',
        startTime: Date.now(),
        blob: null
      });
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      log('Backup session démarrée:', backupSessionId);
    } catch (e) {
      warn('Erreur démarrage backup session:', e);
      backupSessionId = null;
    }
  }

  async function clearBackupSession() {
    if (!backupSessionId) return;
    try {
      const db = await openBackupDB();
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const records = req.result;
        records.forEach(r => {
          if (r.sessionId === backupSessionId) store.delete(r.id);
        });
      };
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      log('Backup session nettoyée:', backupSessionId);
      backupSessionId = null;
    } catch (e) {
      warn('Erreur nettoyage backup session:', e);
      backupSessionId = null;
    }
  }

  async function recoverBackupSession() {
    try {
      const db = await openBackupDB();
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).getAll();

      return new Promise((resolve, reject) => {
        req.onsuccess = () => {
          const records = req.result;
          db.close();
          if (!records || records.length === 0) { resolve(null); return; }

          // Grouper par sessionId
          const sessions = {};
          records.forEach(r => {
            if (!sessions[r.sessionId]) sessions[r.sessionId] = [];
            sessions[r.sessionId].push(r);
          });

          // Trouver la session la plus récente avec des chunks
          let bestSession = null;
          let bestTime = 0;
          for (const sid in sessions) {
            const chunks = sessions[sid].filter(r => r.blob && r.blob.size > 0);
            const meta = sessions[sid].find(r => r.type === 'session_start');
            if (chunks.length > 0 && meta && meta.startTime > bestTime) {
              bestSession = { sessionId: sid, chunks, meta, allRecords: sessions[sid] };
              bestTime = meta.startTime;
            }
          }
          resolve(bestSession);
        };
        req.onerror = () => { db.close(); reject(req.error); };
      });
    } catch (e) {
      warn('Erreur lecture backup:', e);
      return null;
    }
  }

  async function exportBackupAsBlob(session) {
    if (!session || !session.chunks || session.chunks.length === 0) return null;
    const sorted = session.chunks.sort((a, b) => a.timestamp - b.timestamp);
    const blobs = sorted.map(c => c.blob);
    return new Blob(blobs, { type: blobs[0].type || 'audio/webm' });
  }

  async function clearAllBackups() {
    try {
      const db = await openBackupDB();
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).clear();
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      log('Tous les backups nettoyés');
    } catch (e) {
      warn('Erreur nettoyage backups:', e);
    }
  }

  /* ================ [NEW] RECOVERY CHECK ================ */
  async function checkForRecovery() {
    try {
      const session = await recoverBackupSession();
      if (!session) return;

      const chunkCount = session.chunks.length;
      const totalSize = session.chunks.reduce((acc, c) => acc + (c.blob ? c.blob.size : 0), 0);
      const startTime = new Date(session.meta.startTime);
      const sizeMB = (totalSize / (1024 * 1024)).toFixed(1);

      log('Session de recovery détectée:', chunkCount, 'chunks,', sizeMB, 'MB');

      // Exposer les helpers de recovery
      window.AGILO_AUDIO_DEBUG.recoverBackup = async () => {
        const blob = await exportBackupAsBlob(session);
        if (!blob) { console.warn('Aucun blob à récupérer'); return null; }
        downloadRecording(blob, 'Agilotext_RECOVERY_' + startTime.toISOString().slice(0, 10) + '.webm');
        return blob;
      };
      window.AGILO_AUDIO_DEBUG.clearBackup = () => clearAllBackups();
      window.AGILO_AUDIO_DEBUG.backupInfo = { sessionId: session.sessionId, chunks: chunkCount, sizeMB, startTime: startTime.toISOString() };

      // Afficher la bannière de recovery si assez de données
      if (chunkCount >= 2 && totalSize > MIN_BLOB_BYTES) {
        const recDiv = document.createElement('div');
        recDiv.id = 'agilo-recovery-banner';
        Object.assign(recDiv.style, {
          position: 'fixed', top: '0', left: '0', right: '0',
          background: 'linear-gradient(135deg, #ff6b00, #e65100)',
          color: '#fff', padding: '12px 16px', zIndex: '999999',
          fontSize: '14px', fontFamily: 'system-ui, sans-serif',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,.3)'
        });
        recDiv.innerHTML =
          '<span>\u26a0\ufe0f Un enregistrement pr\u00e9c\u00e9dent a \u00e9t\u00e9 retrouv\u00e9 (' + sizeMB + ' MB, ' + chunkCount + ' fragments). </span>' +
          '<span>' +
          '<button id="agilo-recovery-download" style="background:#fff;color:#e65100;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-weight:bold;margin-right:8px;">\ud83d\udce5 T\u00e9l\u00e9charger</button>' +
          '<button id="agilo-recovery-dismiss" style="background:transparent;color:#fff;border:1px solid #fff;padding:6px 14px;border-radius:4px;cursor:pointer;">Ignorer</button>' +
          '</span>';
        document.body.appendChild(recDiv);

        document.getElementById('agilo-recovery-download').onclick = async () => {
          const blob = await exportBackupAsBlob(session);
          if (blob) downloadRecording(blob, 'Agilotext_RECOVERY_' + startTime.toISOString().slice(0, 10) + '.webm');
          recDiv.remove();
          await clearAllBackups();
        };
        document.getElementById('agilo-recovery-dismiss').onclick = async () => {
          recDiv.remove();
          await clearAllBackups();
        };
      }
    } catch (e) {
      warn('Erreur checkForRecovery:', e);
    }
  }

  /* ---------------- Détection de silence prolongé ---------------- */
  function checkSilence(rms) {
    // Verrou : ne pas déclencher plusieurs fois l'arrêt
    if (silenceStopTriggered) return;

    // Ne pas détecter le silence si l'enregistrement n'est pas en cours
    if (!mediaRecorder || mediaRecorder.state !== 'recording') {
      // Réinitialiser si on n'est plus en enregistrement
      if (silenceStartTime !== null) {
        silenceStartTime = null;
        silenceWarningShown = false;
        silenceAutoStopWarned = false;
      }
      return;
    }

    if (rms < SILENCE_THRESHOLD) {
      // Silence détecté
      if (silenceStartTime === null) {
        silenceStartTime = performance.now();
      } else {
        const silenceDuration = performance.now() - silenceStartTime;

        // Avertissement après 2 minutes de silence
        if (silenceDuration > SILENCE_WARNING_MS && !silenceWarningShown) {
          silenceWarningShown = true;
          const minutes = Math.floor(silenceDuration / 60000);
          const message = `Aucun son détecté depuis ${minutes} minute(s).\n\nSi le silence continue pendant 15 minutes au total, l'enregistrement sera automatiquement arrêté pour éviter un fichier vide.`;

          // Forcer l'attention
          forcePageFocus('Silence détecté - Vérifiez votre micro');

          alert(`⚠️ Attention : ${message}`);
        }

        // Avertissement avant arrêt automatique (après 4 minutes)
        if (silenceDuration > (SILENCE_AUTO_STOP_MS - 60000) && !silenceAutoStopWarned) {
          silenceAutoStopWarned = true;
          const message = `Silence prolongé détecté.\n\nL'enregistrement sera arrêté automatiquement dans 1 minute si aucun son n'est détecté.`;

          // Forcer l'attention
          forcePageFocus('Arrêt imminent - Vérifiez votre micro');

          alert(`⚠️ Attention : ${message}`);
        }

        // Arrêt automatique après 15 minutes de silence
        if (silenceDuration > SILENCE_AUTO_STOP_MS && !silenceStopTriggered) {
          // Verrou : éviter les déclenchements multiples
          silenceStopTriggered = true;

          warn('Arrêt automatique après 15 minutes de silence');

          // Forcer l'attention avant l'arrêt
          forcePageFocus('Enregistrement arrêté automatiquement');

          alert('⏹️ Enregistrement arrêté automatiquement : aucun son détecté pendant 15 minutes.\n\nL\'enregistrement a été interrompu pour éviter un fichier vide.\n\nLe fichier sera sauvegardé et envoyé automatiquement.');

          // Utiliser Promise pour éviter les races
          Promise.resolve()
            .then(() => {
              if (mediaRecorder && mediaRecorder.state === 'recording') {
                try { mediaRecorder.requestData(); } catch (e) {
                  warn('Erreur requestData avant arrêt:', e);
                }
              }
            })
            .then(() => new Promise(r => setTimeout(r, 100)))
            .then(() => stopRecordingAndSubmitForm());

          return;
        }
      }
    } else {
      // Son détecté, réinitialiser le compteur
      if (silenceStartTime !== null) {
        silenceStartTime = null;
        silenceWarningShown = false;
        silenceAutoStopWarned = false;
        // Arrêter le clignotement du titre si actif
        stopTitleBlink();
      }
    }
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
    // On ne le fait pas ici car setupAudioContext() peut être appelé sans interaction utilisateur
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
      // Audio seul : toujours possible via initiateRecording(false)
      // Pas de restriction navigateur sauf si getUserMedia n'est pas supporté (déjà vérifié au début)
      initiateRecording(false);
    };
  }

  if (startSharingButton) {
    startSharingButton.onclick = function () {
      // 1. Mobile : pas de partage d'écran possible -> fallback micro
      if (isMobileDevice()) {
        if (confirm('Le partage d\'écran n\'est pas disponible sur mobile.\nVoulez-vous enregistrer uniquement le micro ?')) {
          initiateRecording(false);
        }
        return;
      }

      // 2. Firefox : supporte getDisplayMedia mais sans audio système -> warning + enregistrement
      if (isFirefox()) {
        if (confirm('⚠️ Firefox ne capture PAS l\'audio du système (réunions en ligne).\n\nL\'enregistrement ne contiendra QUE votre voix.\n\nPour enregistrer une réunion, utilisez Chrome, Edge ou Safari (récent).\n\nContinuer en mode micro seul ?')) {
          // On lance en mode partage d'écran (true) pour qu'il tente quand même,
          // mais le script gérera le fallback ou l'absence de track audio.
          // OU MIEUX : On lance direct le mode micro pour éviter la confusion
          initiateRecording(false);
        }
        return;
      }

      // 3. Autres navigateurs (Chrome, Edge, Safari, Opera...)
      // Si `getDisplayMedia` est supporté, on lance le flux partage d'écran
      if (supportsDisplayMedia()) {
        initiateRecording(true);
      } else {
        // Fallback si vraiment pas supporté (ex: vieux Safari < 13)
        if (confirm('Votre navigateur ne supporte pas le partage d\'écran.\nVoulez-vous enregistrer uniquement le micro ?')) {
          initiateRecording(false);
        }
      }
    };
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

  async function initiateRecording(shareScreen) {
    if (mediaRecorder && mediaRecorder.state === 'recording') return;

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

    // Pas besoin d'initialiser quoi que ce soit, on utilise juste errorMessage existant

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
          // Nettoyer les ressources (pas de listener attaché donc pas de problème)
          stopStreamTracks(currentMicStream);
          stopStreamTracks(currentScreenStream);
          currentMicStream = null;
          currentScreenStream = null;
          screenVideoTrack = null;
          teardownAudioGraph();
          return; // NE PAS démarrer l'enregistrement
        }
      } else {
        // BUG FIX #1 : On garde le stream, donc on peut maintenant attacher le listener ended
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

    alertedNoSystemAudio = false;

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
      // Firefox peut avoir des problèmes avec certains codecs
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

    // Réinitialiser la détection de silence pour le nouvel enregistrement
    silenceStopTriggered = false;
    silenceStartTime = null;
    silenceWarningShown = false;
    silenceAutoStopWarned = false;

    audioChunks = [];
    mediaRecorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        audioChunks.push(ev.data);
        lastChunkTs = Date.now(); // [NEW] Watchdog timestamp
        saveChunkToBackup(ev.data); // [NEW] IndexedDB backup
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
      // BUG FIX #3 : Réinitialiser le flag stopInProgress
      stopInProgress = false;

      setTimeout(() => {
        const finalMime = (mediaRecorder && mediaRecorder.mimeType) ? mediaRecorder.mimeType : mimeType;
        const audioBlob = new Blob(audioChunks, { type: finalMime });

        if (!audioBlob || audioBlob.size < MIN_BLOB_BYTES) {
          warn('Audio trop petit ou vide');
          audioChunks = [];
          alert("L'enregistrement est trop court ou vide. Réessayez.");
          // BUG FIX Bonus : Cleanup même en cas de return early
          stopStreamTracks(currentMicStream);
          currentMicStream = null;
          stopStreamTracks(currentScreenStream);
          currentScreenStream = null;
          teardownAudioGraph();
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
        // BUG FIX #1 : Utiliser const au lieu de let pour éviter double déclaration
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

          // Option A : si FilePond existe, vérifier FilePond OU input natif (pas les deux)
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
              // BUG FIX #2 : Cleanup listener avec try/catch pour éviter memory leak
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
          // BUG FIX #2 : Cleanup listener avec try/catch
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

        // Utiliser FilePond.addFile si disponible (plus robuste)
        const audioFile = new File([audioBlob], audioFileName, { type: finalMime });

        if (pondInstance && pondInstance.addFile) {
          // Option C : utiliser directement le then de addFile pour déclencher submitWhenAdded
          pondInstance.addFile(audioFile)
            .then(() => {
              // Le fichier est ajouté, déclencher la soumission
              submitWhenAdded();
            })
            .catch((e) => {
              warn('Erreur FilePond.addFile, fallback sur simulateFileInput:', e);
              // Fallback : remplir aussi l'input natif
              if (fileInput) {
                simulateFileInput(fileInput, audioFile);
              }
              // Attendre un peu puis vérifier
              setTimeout(submitWhenAdded, 100);
            });
        } else {
          // Fallback : utiliser simulateFileInput
          if (fileInput) {
            simulateFileInput(fileInput, audioFile);
          }
          // Utiliser 'once' si disponible, sinon 'on' avec cleanup après timeout
          if (pondInstance && pondInstance.once) {
            pondInstance.once('addfile', submitWhenAdded);
          } else if (pondInstance && pondInstance.on) {
            pondInstance.on('addfile', submitWhenAdded);
            // BUG FIX #2 : Cleanup après MAX_SUBMIT_WAIT_MS avec try/catch
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
            // Pas de FilePond, vérifier directement
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
        clearBackupSession(); // [NEW] Backup réussie → nettoyer IndexedDB
        setTimeout(() => downloadRecording(audioBlob, audioFileName), 1000);

        // BUG FIX #1 : Stopper les streams et fermer AudioContext APRÈS avoir construit le blob
        // (ne pas le faire dans stopRecordingAndSubmitForm pour éviter blob vide)
        // Retirer le listener ended du screen stream si présent
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
      }, 50);
    };

    // Timeslice pour flush régulier (important pour Firefox)
    const timeslice = isFirefox() ? 1000 : 250;
    activeTimeslice = timeslice; // [NEW]
    try {
      mediaRecorder.start(timeslice);
    } catch (e) {
      try {
        mediaRecorder.start();
        activeTimeslice = 5000; // [NEW] Pas de timeslice → estimation
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

    toggleAnimation(true);
    if (startButton) startButton.disabled = true;
    if (stopButton) { stopButton.disabled = false; stopButton.style.display = 'flex'; }
    // Le test de pause sera fait au clic plutôt qu'au démarrage pour éviter les artefacts
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

    // [NEW] Démarrer les protections anti-perte
    startHeartbeat();
    startChunkWatchdog(activeTimeslice);
    requestWakeLock();
    startBackupSession();
    document.title = '⏺ ' + originalDocTitle; // [NEW] Titre onglet
  }

  if (pauseButton) {
    pauseButton.onclick = function () {
      if (!mediaRecorder) return;

      try {
        if (mediaRecorder.state === 'paused') {
          mediaRecorder.resume();
          if (pauseButtonText) pauseButtonText.innerText = 'Pause';
          // Sécuriser : clear avant de recréer pour éviter les doublons
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
        // Cacher le bouton pause si non supporté
        if (pauseButton) pauseButton.style.display = 'none';
      }
    };
  }

  function stopRecordingAndSubmitForm() {
    // BUG FIX #3 : Éviter les doubles clics "Stop"
    if (stopInProgress) return;
    stopInProgress = true;

    // [NEW] Arrêter les protections anti-perte
    stopHeartbeat();
    stopChunkWatchdog();
    releaseWakeLock();
    document.title = originalDocTitle; // [NEW] Restaurer titre onglet

    // Arrêter le clignotement du titre
    stopTitleBlink();

    // Retirer le listener ended du screen stream si présent
    if (screenVideoTrack && onScreenEnded) {
      try {
        screenVideoTrack.removeEventListener('ended', onScreenEnded);
      } catch (e) {
        warn('Erreur retrait listener screen ended:', e);
      }
      screenVideoTrack = null;
      onScreenEnded = null;
    }

    // Vérifier si on peut stopper le recorder (si oui, onstop se déclenchera et fera le cleanup)
    const canStopRecorder = mediaRecorder && mediaRecorder.state !== 'inactive';

    // S'assurer que toutes les données sont récupérées avant d'arrêter
    // BUG FIX #2 : Aussi en paused
    try {
      if (mediaRecorder && (mediaRecorder.state === 'recording' || mediaRecorder.state === 'paused')) {
        mediaRecorder.requestData();
      }
    } catch (e) {
      warn('Erreur requestData dans stopRecordingAndSubmitForm:', e);
    }

    // Petit délai pour laisser requestData finir avant de stopper
    const stopMediaRecorder = () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try {
          mediaRecorder.stop();
        } catch (e) {
          warn('Erreur lors de l\'arrêt du MediaRecorder:', e);
          // BUG FIX #2 : stop() a échoué => onstop ne se déclenchera pas => débloquer et cleanup
          stopInProgress = false;
          // Retirer le listener ended du screen stream si présent
          if (screenVideoTrack && onScreenEnded) {
            try {
              screenVideoTrack.removeEventListener('ended', onScreenEnded);
            } catch (e2) {
              warn('Erreur retrait listener screen ended:', e2);
            }
            screenVideoTrack = null;
            onScreenEnded = null;
          }
          // Cleanup immédiat pour éviter les fuites
          stopStreamTracks(currentMicStream);
          currentMicStream = null;
          stopStreamTracks(currentScreenStream);
          currentScreenStream = null;
          teardownAudioGraph();
        }
      }
    };

    // Si on peut stopper le recorder, onstop se déclenchera et fera le cleanup
    if (canStopRecorder) {
      // Si on est déjà en train d'arrêter (depuis checkSilence), on attend un peu
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        setTimeout(stopMediaRecorder, 150);
      } else {
        stopMediaRecorder();
      }
    } else {
      // BUG FIX #2 : Pas de onstop possible => cleanup immédiat
      // (mediaRecorder null ou déjà inactive)
      // Retirer le listener ended du screen stream si présent
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

    // Réinitialiser la détection de silence (mais PAS silenceStopTriggered ici)
    // silenceStopTriggered sera réinitialisé dans startRecording() pour le prochain enregistrement
    silenceStartTime = null;
    silenceWarningShown = false;
    silenceAutoStopWarned = false;
    // NOTE: silenceStopTriggered reste true jusqu'au prochain startRecording()
    // pour éviter les redéclenchements pendant les ~150ms avant mediaRecorder.stop()

    // BUG FIX #1 : Ne PAS stopper les streams ici si canStopRecorder (c'est fait dans onstop)
    // Les streams seront stoppés dans mediaRecorder.onstop après la construction du blob
    // OU immédiatement si canStopRecorder === false (déjà fait plus haut)

    // Cacher le message d'erreur
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

  // [ENHANCED] Gestion visibilité page + Wake Lock re-acquisition
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && mediaRecorder && mediaRecorder.state === 'recording') {
      warn('Page en arrière-plan pendant l\'enregistrement');
    }
    // [NEW] Ré-acquérir le Wake Lock quand la page redevient visible
    if (document.visibilityState === 'visible' && mediaRecorder && mediaRecorder.state !== 'inactive') {
      requestWakeLock();
    }
  });

  // [NEW] Écouter freeze/resume pour détecter les transitions OS
  if ('onfreeze' in document) {
    document.addEventListener('freeze', () => {
      warn('Page freeze détecté');
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        try { mediaRecorder.requestData(); } catch (e) { }
      }
    });
  }
  if ('onresume' in document) {
    document.addEventListener('resume', () => {
      log('Page resume détecté');
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        requestWakeLock();
        if (audioContext && audioContext.state === 'suspended') {
          audioContext.resume().catch(e => warn('Resume AudioContext failed:', e));
        }
      }
    });
  }


  // Gérer le bouton "Recommencer" existant dans le HTML (#New-button_error)
  const newErrorButton = document.getElementById('New-button_error');
  if (newErrorButton) {
    newErrorButton.addEventListener('click', function () {
      // Cacher l'erreur et relancer l'enregistrement avec partage écran
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
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        warn('devicechange détecté -> tentative de recovery micro');
        restartMic();
      }
    });
  } catch { }

  // [NEW] Vérifier s'il y a un enregistrement à récupérer
  checkForRecovery();
});
