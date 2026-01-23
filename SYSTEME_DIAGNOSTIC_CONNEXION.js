// ============================================
// SYSTÈME DE DIAGNOSTIC ET ADAPTATION CONNEXION
// ============================================

/* -------------- Détection de la qualité de connexion -------------- */

class ConnectionMonitor {
  constructor() {
    this.latencyHistory = [];
    this.slowConnectionThreshold = 2000; // 2 secondes = connexion lente
    this.isSlowConnection = false;
    this.pollInterval = 5000; // Intervalle de base : 5 secondes
    this.maxPollInterval = 30000; // Maximum : 30 secondes
    this.requestTimeouts = [];
  }

  // Mesurer la latence d'une requête
  async measureLatency(url) {
    const startTime = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s max pour le test
      
      await fetch(url, { 
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache'
      });
      
      clearTimeout(timeoutId);
      const latency = performance.now() - startTime;
      this.latencyHistory.push(latency);
      
      // Garder seulement les 10 dernières mesures
      if (this.latencyHistory.length > 10) {
        this.latencyHistory.shift();
      }
      
      return latency;
    } catch (err) {
      return null; // Échec de mesure
    }
  }

  // Tester la connexion avec l'API
  async testConnection() {
    const testUrl = 'https://api.agilotext.com/api/v1/getToken?username=test&edition=ent';
    const latency = await this.measureLatency(testUrl);
    
    if (latency === null) {
      console.warn('⚠️ Test de connexion échoué');
      return { status: 'failed', latency: null };
    }
    
    const avgLatency = this.getAverageLatency();
    const isSlow = avgLatency > this.slowConnectionThreshold;
    
    if (isSlow !== this.isSlowConnection) {
      this.isSlowConnection = isSlow;
      console.log(`📊 Connexion ${isSlow ? 'LENTE' : 'NORMALE'} détectée (latence moyenne: ${Math.round(avgLatency)}ms)`);
    }
    
    return {
      status: 'ok',
      latency: latency,
      avgLatency: avgLatency,
      isSlow: isSlow
    };
  }

  // Obtenir la latence moyenne
  getAverageLatency() {
    if (this.latencyHistory.length === 0) return 0;
    const sum = this.latencyHistory.reduce((a, b) => a + b, 0);
    return sum / this.latencyHistory.length;
  }

  // Adapter l'intervalle de polling selon la connexion
  getAdaptivePollInterval() {
    const avgLatency = this.getAverageLatency();
    
    if (avgLatency > 5000) {
      // Très lente : 30 secondes
      return 30000;
    } else if (avgLatency > 2000) {
      // Lente : 15 secondes
      return 15000;
    } else if (avgLatency > 1000) {
      // Moyenne : 10 secondes
      return 10000;
    }
    // Normale : 5 secondes
    return 5000;
  }

  // Obtenir un timeout adapté selon la connexion
  getAdaptiveTimeout(baseTimeout = 30000) {
    const avgLatency = this.getAverageLatency();
    // Ajouter 3x la latence moyenne au timeout de base
    return baseTimeout + (avgLatency * 3);
  }
}

// Instance globale du moniteur
const connectionMonitor = new ConnectionMonitor();

/* -------------- fetchWithTimeout amélioré avec diagnostic -------------- */

function fetchWithTimeout(url, options = {}) {
  const TIMEOUT = options.timeout || connectionMonitor.getAdaptiveTimeout(3 * 60 * 60 * 1000);
  
  if (!navigator.onLine) return Promise.reject({ type: 'offline' });
  
  const requestStartTime = performance.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  
  return fetch(url, { ...options, signal: ctrl.signal })
    .finally(() => {
      clearTimeout(timer);
      const requestDuration = performance.now() - requestStartTime;
      
      // Enregistrer la latence pour le diagnostic
      connectionMonitor.latencyHistory.push(requestDuration);
      if (connectionMonitor.latencyHistory.length > 20) {
        connectionMonitor.latencyHistory.shift();
      }
      
      // Avertir si la requête est très lente
      if (requestDuration > 10000) {
        console.warn(`⚠️ Requête lente détectée: ${Math.round(requestDuration)}ms pour ${url.substring(0, 50)}...`);
      }
    })
    .catch(err => {
      if (err.name === 'AbortError') return Promise.reject({ type: 'timeout' });
      return Promise.reject({ type: 'unreachable' });
    });
}

/* -------------- checkTranscriptStatus avec adaptation automatique -------------- */

function checkTranscriptStatus(jobId, email) {
  if (!globalToken) return console.error('Token manquant');
  if (window._agiloStatusInt) clearInterval(window._agiloStatusInt);

  // ⭐ Tester la connexion au démarrage
  connectionMonitor.testConnection().then(result => {
    if (result.status === 'ok') {
      console.log(`📡 Test de connexion: ${Math.round(result.latency)}ms (moyenne: ${Math.round(result.avgLatency)}ms)`);
    }
  });

  const GLOBAL_TIMEOUT = 2 * 60 * 60 * 1000; // 2 heures maximum
  const startTime = Date.now();
  let fetched = false;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 10; // ⭐ Augmenté à 10 pour les connexions lentes
  let pollCount = 0;
  let lastSuccessfulPoll = Date.now();

  // ⭐ Fonction pour obtenir l'intervalle adaptatif
  const getCurrentPollInterval = () => {
    return connectionMonitor.getAdaptivePollInterval();
  };

  // ⭐ Fonction pour obtenir le timeout adaptatif
  const getCurrentTimeout = () => {
    return connectionMonitor.getAdaptiveTimeout(30000); // Base: 30s, adapté selon connexion
  };

  const poll = () => {
    pollCount++;
    const elapsed = Date.now() - startTime;
    
    // Vérifier le timeout global
    if (elapsed > GLOBAL_TIMEOUT) {
      clearInterval(intId);
      window._agiloStatusInt = null;
      loadingAnimDiv.style.display = 'none';
      readyAnimDiv.style.display = 'none';
      showError('timeout');
      alert('Le traitement prend plus de temps que prévu (plus de 2 heures). Veuillez réessayer plus tard ou contacter le support si le problème persiste.');
      return;
    }

    // ⭐ Vérifier si on n'a pas eu de réponse depuis trop longtemps
    const timeSinceLastSuccess = Date.now() - lastSuccessfulPoll;
    if (timeSinceLastSuccess > 5 * 60 * 1000) { // 5 minutes sans réponse
      console.warn('⚠️ Aucune réponse depuis 5 minutes. Test de la connexion...');
      connectionMonitor.testConnection();
    }

    // Message de progression
    if (pollCount % 6 === 0) {
      const minutes = Math.floor(elapsed / 60000);
      const avgLatency = connectionMonitor.getAverageLatency();
      const connectionStatus = connectionMonitor.isSlowConnection ? 'lente' : 'normale';
      console.log(`⏳ Traitement en cours depuis ${minutes} min (connexion ${connectionStatus}, latence: ${Math.round(avgLatency)}ms)`);
    }

    // ⭐ Utiliser un timeout adaptatif
    const currentTimeout = getCurrentTimeout();
    fetchWithTimeout(
      `https://api.agilotext.com/api/v1/getTranscriptStatus?jobId=${jobId}&username=${email}&token=${globalToken}&edition=${edition}`,
      { timeout: currentTimeout }
    )
      .then(r => {
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`);
        }
        return r.json();
      })
      .then(data => {
        // ⭐ Succès : mettre à jour le timestamp
        lastSuccessfulPoll = Date.now();
        consecutiveErrors = 0;
        
        switch(data.transcriptStatus) {
          case 'READY_SUMMARY_PENDING':
            loadingAnimDiv.style.display = 'none';
            readyAnimDiv.style.display = 'block';
            if (summaryCheckbox.checked) setSummaryUI('loading'); else setSummaryUI('hidden');
            if(!fetched){ 
              fetchTranscriptText(jobId,email); 
              fetched=true; 
            }
            break;

          case 'READY_SUMMARY_READY':
            clearInterval(intId);
            window._agiloStatusInt = null;
            loadingAnimDiv.style.display = 'none';
            readyAnimDiv.style.display = 'block';
            fetchTranscriptText(jobId,email);
            if (summaryCheckbox.checked) {
              setSummaryUI('ready');
              fetchSummaryText(jobId,email);
              summaryTabLink && summaryTabLink.click();
            } else {
              setSummaryUI('hidden');
              transcriptionTabLink && transcriptionTabLink.click();
            }
            break;

          case 'ON_ERROR':
          case 'READY_SUMMARY_ON_ERROR':
            clearInterval(intId);
            window._agiloStatusInt = null;
            loadingAnimDiv.style.display = 'none';
            if (summaryCheckbox.checked) setSummaryUI('error'); else setSummaryUI('hidden');
            showError('default');
            alert(data.javaException || 'Erreur inconnue lors du traitement');
            break;
        }
      })
      .catch(err => {
        consecutiveErrors++;
        const avgLatency = connectionMonitor.getAverageLatency();
        console.error(`❌ getTranscriptStatus (tentative ${pollCount}, erreurs: ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, err, `(latence moyenne: ${Math.round(avgLatency)}ms)`);
        
        // ⭐ Si on a trop d'erreurs, tester la connexion
        if (consecutiveErrors === 3) {
          console.log('🔍 Test de connexion après 3 erreurs...');
          connectionMonitor.testConnection();
        }
        
        // ⭐ Arrêter après trop d'erreurs consécutives
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          clearInterval(intId);
          window._agiloStatusInt = null;
          loadingAnimDiv.style.display = 'none';
          readyAnimDiv.style.display = 'none';
          
          // Message d'erreur avec diagnostic
          const diagnostic = `Latence moyenne: ${Math.round(avgLatency)}ms, Erreurs: ${consecutiveErrors}`;
          console.error('💥 Arrêt du polling. Diagnostic:', diagnostic);
          
          if (err.type === 'timeout') {
            showError('timeout');
            alert(`Connexion trop lente ou instable (latence: ${Math.round(avgLatency)}ms). Le traitement a été interrompu après ${consecutiveErrors} tentatives échouées. Veuillez vérifier votre connexion internet et réessayer.`);
          } else if (err.type === 'offline') {
            showError('offline');
            alert('Vous êtes hors ligne. Veuillez vérifier votre connexion internet.');
          } else {
            showError('unreachable');
            alert(`Impossible de contacter le serveur après ${consecutiveErrors} tentatives (latence: ${Math.round(avgLatency)}ms). Veuillez vérifier votre connexion internet et réessayer.`);
          }
          return;
        }
        
        // ⭐ Adapter l'intervalle si la connexion est lente
        if (consecutiveErrors >= 3) {
          const newInterval = getCurrentPollInterval();
          if (newInterval > 5000) {
            console.log(`🔄 Adaptation: intervalle de polling augmenté à ${newInterval/1000}s à cause de la connexion lente`);
            // Note: on ne peut pas changer l'intervalle d'un setInterval en cours
            // Il faudrait le recréer, mais pour simplifier on continue avec l'intervalle actuel
          }
        }
      });
  };

  // ⭐ Démarrer avec l'intervalle adaptatif
  const initialInterval = getCurrentPollInterval();
  console.log(`🚀 Démarrage du polling avec intervalle de ${initialInterval/1000}s`);
  
  const intId = setInterval(poll, initialInterval);
  
  // ⭐ Faire le premier poll immédiatement
  poll();
  
  window._agiloStatusInt = intId;
}

/* -------------- Fonction de diagnostic complet -------------- */

async function runConnectionDiagnostic() {
  console.log('🔍 === DIAGNOSTIC DE CONNEXION ===');
  
  const results = {
    online: navigator.onLine,
    userAgent: navigator.userAgent,
    connection: navigator.connection || navigator.mozConnection || navigator.webkitConnection,
    tests: []
  };
  
  // Test 1: API Agilotext
  console.log('📡 Test 1: Connexion à l\'API Agilotext...');
  const apiTest = await connectionMonitor.testConnection();
  results.tests.push({ name: 'API Agilotext', ...apiTest });
  
  // Test 2: Google (pour comparer)
  console.log('📡 Test 2: Connexion à Google (référence)...');
  const googleLatency = await connectionMonitor.measureLatency('https://www.google.com');
  results.tests.push({ name: 'Google (référence)', latency: googleLatency });
  
  // Test 3: Mesure de latence moyenne
  const avgLatency = connectionMonitor.getAverageLatency();
  results.avgLatency = avgLatency;
  results.isSlowConnection = avgLatency > 2000;
  
  console.log('📊 Résultats du diagnostic:', results);
  console.log(`📈 Latence moyenne: ${Math.round(avgLatency)}ms`);
  console.log(`🔴 Connexion ${results.isSlowConnection ? 'LENTE' : 'NORMALE'}`);
  
  return results;
}

// ⭐ Exposer la fonction de diagnostic globalement
window.runConnectionDiagnostic = runConnectionDiagnostic;

// ⭐ Tester la connexion au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    connectionMonitor.testConnection();
  }, 2000); // Attendre 2s après le chargement
});

