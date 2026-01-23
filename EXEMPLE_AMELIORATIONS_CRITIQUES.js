// ============================================
// EXEMPLE : Améliorations critiques intégrées
// ============================================
// Ce code montre comment intégrer les 3 améliorations prioritaires
// dans votre script existant

/* -------------- AMÉLIORATION 1 : Nettoyage des intervals -------------- */

function checkTranscriptStatus(jobId,email){
  if(!globalToken) return console.error('Token manquant');
  if (window._agiloStatusInt) clearInterval(window._agiloStatusInt);

  const GLOBAL_TIMEOUT = 2 * 60 * 60 * 1000;
  const startTime = Date.now();
  let fetched=false;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 10;
  let pollCount = 0;

  const intId=setInterval(()=>{
    // ... code existant ...
  },5000);

  window._agiloStatusInt = intId;

  // ⭐ AMÉLIORATION 1 : Nettoyage automatique
  const cleanup = () => {
    if (window._agiloStatusInt === intId) {
      clearInterval(intId);
      window._agiloStatusInt = null;
      console.log('Polling nettoyé (changement de page)');
    }
  };

  // Nettoyer si l'utilisateur quitte la page
  window.addEventListener('beforeunload', cleanup);
  
  // Nettoyer aussi quand le traitement est terminé (dans les cas de succès/erreur)
  // À ajouter dans les cases 'READY_SUMMARY_READY' et 'ON_ERROR'
}

/* -------------- AMÉLIORATION 2 : Validation du token -------------- */

// Fonction helper pour vérifier/rafraîchir le token
async function ensureValidToken(email, edition) {
  if (!globalToken) {
    try {
      const response = await fetch(`https://api.agilotext.com/api/v1/getToken?username=${email}&edition=${edition}`);
      const data = await response.json();
      if (data.status === 'OK') {
        globalToken = data.token;
        console.log('Token récupéré automatiquement');
        return true;
      }
    } catch (err) {
      console.error('Erreur lors de la récupération du token:', err);
    }
    return false;
  }
  return true;
}

// Utilisation dans checkTranscriptStatus :
function checkTranscriptStatus(jobId,email){
  // ... code existant ...
  
  const intId=setInterval(async ()=>{
    pollCount++;
    
    // ⭐ AMÉLIORATION 2 : Vérifier le token avant chaque requête
    const tokenValid = await ensureValidToken(email, edition);
    if (!tokenValid) {
      clearInterval(intId);
      window._agiloStatusInt = null;
      loadingAnimDiv.style.display='none';
      showError('invalidToken');
      alert('Votre session a expiré. Veuillez rafraîchir la page.');
      return;
    }
    
    // ... reste du code de polling ...
  },5000);
}

/* -------------- AMÉLIORATION 3 : Gestion des erreurs HTTP spécifiques -------------- */

// Améliorer fetchWithTimeout pour mieux gérer les erreurs HTTP
function fetchWithTimeout(url, options = {}) {
  const TIMEOUT = options.timeout || (3 * 60 * 60 * 1000);
  
  if (!navigator.onLine) return Promise.reject({ type: 'offline' });
  
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  
  return fetch(url, { ...options, signal: ctrl.signal })
    .then(response => {
      // ⭐ AMÉLIORATION 3 : Gérer les erreurs HTTP spécifiques
      if (!response.ok) {
        const status = response.status;
        if (status === 401 || status === 403) {
          return Promise.reject({ type: 'invalidToken', status, message: 'Session expirée' });
        } else if (status >= 500) {
          return Promise.reject({ type: 'serverError', status, message: 'Erreur serveur' });
        } else if (status === 429) {
          return Promise.reject({ type: 'tooMuchTraffic', status, message: 'Trop de requêtes' });
        }
        return Promise.reject({ type: 'httpError', status, message: `Erreur HTTP ${status}` });
      }
      return response;
    })
    .finally(() => clearTimeout(timer))
    .catch(err => {
      if (err.name === 'AbortError') return Promise.reject({ type: 'timeout' });
      // Si c'est déjà une erreur HTTP qu'on a créée, la retourner telle quelle
      if (err.type) return Promise.reject(err);
      return Promise.reject({ type: 'unreachable' });
    });
}

// Utilisation dans checkTranscriptStatus :
.catch(err=>{
  consecutiveErrors++;
  console.error(`getTranscriptStatus (tentative ${pollCount}, erreurs: ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, err);
  
  // ⭐ AMÉLIORATION 3 : Gérer les erreurs spécifiques
  if (err.type === 'invalidToken') {
    clearInterval(intId);
    window._agiloStatusInt = null;
    loadingAnimDiv.style.display='none';
    showError('invalidToken');
    alert('Votre session a expiré. Veuillez rafraîchir la page.');
    return;
  }
  
  if (err.type === 'serverError') {
    // Erreur serveur : continuer à essayer (c'est temporaire)
    console.warn('Erreur serveur détectée, nouvelle tentative...');
  }
  
  // ... reste du code de gestion d'erreurs ...
});

/* -------------- CODE COMPLET INTÉGRÉ (extrait) -------------- */

// Voici comment intégrer les 3 améliorations dans votre fonction checkTranscriptStatus :

function checkTranscriptStatus(jobId,email){
  if(!globalToken) return console.error('Token manquant');
  if (window._agiloStatusInt) clearInterval(window._agiloStatusInt);

  const GLOBAL_TIMEOUT = 2 * 60 * 60 * 1000;
  const startTime = Date.now();
  let fetched=false;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 10;
  let pollCount = 0;

  const intId=setInterval(async ()=>{
    pollCount++;
    
    // Vérifier le timeout global
    const elapsed = Date.now() - startTime;
    if (elapsed > GLOBAL_TIMEOUT) {
      clearInterval(intId);
      window._agiloStatusInt = null;
      loadingAnimDiv.style.display='none';
      readyAnimDiv.style.display='none';
      showError('timeout');
      alert('Le traitement prend plus de temps que prévu (plus de 2 heures).');
      return;
    }

    // ⭐ AMÉLIORATION 2 : Vérifier le token
    const tokenValid = await ensureValidToken(email, edition);
    if (!tokenValid) {
      clearInterval(intId);
      window._agiloStatusInt = null;
      loadingAnimDiv.style.display='none';
      showError('invalidToken');
      alert('Votre session a expiré. Veuillez rafraîchir la page.');
      return;
    }

    // Message de progression
    if (pollCount % 6 === 0) {
      const minutes = Math.floor(elapsed / 60000);
      console.log(`⏳ Traitement en cours depuis ${minutes} minute(s)...`);
    }

    // Polling avec timeout adapté
    fetchWithTimeout(
      `https://api.agilotext.com/api/v1/getTranscriptStatus?jobId=${jobId}&username=${email}&token=${globalToken}&edition=${edition}`,
      { timeout: 30 * 1000 }
    )
      .then(r=>{
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`);
        }
        return r.json();
      })
      .then(data=>{
        consecutiveErrors = 0;
        
        switch(data.transcriptStatus){
          case 'READY_SUMMARY_PENDING':
            // ... code existant ...
            break;

          case 'READY_SUMMARY_READY':
            clearInterval(intId);
            window._agiloStatusInt = null; // ⭐ AMÉLIORATION 1 : Nettoyage
            // ... code existant ...
            break;

          case 'ON_ERROR':
          case 'READY_SUMMARY_ON_ERROR':
            clearInterval(intId);
            window._agiloStatusInt = null; // ⭐ AMÉLIORATION 1 : Nettoyage
            // ... code existant ...
            break;
        }
      })
      .catch(err=>{
        consecutiveErrors++;
        console.error(`getTranscriptStatus (tentative ${pollCount}, erreurs: ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, err);
        
        // ⭐ AMÉLIORATION 3 : Gérer les erreurs spécifiques
        if (err.type === 'invalidToken') {
          clearInterval(intId);
          window._agiloStatusInt = null;
          loadingAnimDiv.style.display='none';
          showError('invalidToken');
          alert('Votre session a expiré. Veuillez rafraîchir la page.');
          return;
        }
        
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          clearInterval(intId);
          window._agiloStatusInt = null;
          loadingAnimDiv.style.display='none';
          readyAnimDiv.style.display='none';
          
          // Messages d'erreur adaptés
          if (err.type === 'timeout') {
            showError('timeout');
            alert('Connexion trop lente ou instable. Le traitement a été interrompu.');
          } else if (err.type === 'offline') {
            showError('offline');
            alert('Vous êtes hors ligne. Veuillez vérifier votre connexion internet.');
          } else if (err.type === 'serverError') {
            showError('default');
            alert('Erreur serveur. Veuillez réessayer dans quelques instants.');
          } else {
            showError('unreachable');
            alert('Impossible de contacter le serveur. Veuillez vérifier votre connexion internet.');
          }
          return;
        }
        
        if (consecutiveErrors === 3) {
          console.warn('⚠️ Plusieurs erreurs de connexion détectées. Le processus continue...');
        }
      });
  },5000);

  window._agiloStatusInt = intId;

  // ⭐ AMÉLIORATION 1 : Nettoyage au changement de page
  const cleanup = () => {
    if (window._agiloStatusInt === intId) {
      clearInterval(intId);
      window._agiloStatusInt = null;
    }
  };
  window.addEventListener('beforeunload', cleanup);
}

