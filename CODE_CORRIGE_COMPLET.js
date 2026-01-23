// ============================================
// CODE CORRIGÉ - À COPIER-COLLER DANS VOTRE HTML
// ============================================

// ⭐ MODIFICATION 1 : fetchWithTimeout (remplacer la fonction existante)
function fetchWithTimeout(url, options = {}) {
  // ⭐ PERMET UN TIMEOUT PERSONNALISÉ (30s pour polling, 3h pour upload)
  const TIMEOUT = options.timeout || (3 * 60 * 60 * 1000);
  
  if (!navigator.onLine) return Promise.reject({ type: 'offline' });
  
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  
  return fetch(url, { ...options, signal: ctrl.signal })
    .finally(() => clearTimeout(timer))
    .catch(err => {
      if (err.name === 'AbortError') return Promise.reject({ type: 'timeout' });
      return Promise.reject({ type: 'unreachable' });
    });
}

// ⭐ MODIFICATION 2 : checkTranscriptStatus (remplacer TOUTE la fonction existante)
function checkTranscriptStatus(jobId,email){
  if(!globalToken) return console.error('Token manquant');
  if (window._agiloStatusInt) clearInterval(window._agiloStatusInt);

  // ⭐ AJOUT : Timeout global de 2 heures
  const GLOBAL_TIMEOUT = 2 * 60 * 60 * 1000; // 2 heures maximum
  const startTime = Date.now();
  let fetched=false;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 10; // ⭐ Arrêter après 10 erreurs (pas à la première)
  let pollCount = 0;

  const intId=setInterval(()=>{
    pollCount++;
    
    // ⭐ AJOUT : Vérifier le timeout global AVANT chaque requête
    const elapsed = Date.now() - startTime;
    if (elapsed > GLOBAL_TIMEOUT) {
      clearInterval(intId);
      window._agiloStatusInt = null;
      loadingAnimDiv.style.display='none';
      readyAnimDiv.style.display='none';
      showError('timeout');
      alert('Le traitement prend plus de temps que prévu (plus de 2 heures). Veuillez réessayer plus tard ou contacter le support si le problème persiste.');
      return;
    }

    // ⭐ AJOUT : Message de progression toutes les 30 secondes
    if (pollCount % 6 === 0) {
      const minutes = Math.floor(elapsed / 60000);
      console.log(`⏳ Traitement en cours depuis ${minutes} minute(s)...`);
    }

    // ⭐ MODIFICATION : Timeout de 30 secondes pour le polling (au lieu de 3h)
    fetchWithTimeout(
      `https://api.agilotext.com/api/v1/getTranscriptStatus?jobId=${jobId}&username=${email}&token=${globalToken}&edition=${edition}`,
      { timeout: 30 * 1000 } // ⭐ 30 secondes au lieu de 3 heures
    )
      .then(r=>{
        // ⭐ AJOUT : Vérifier si la réponse est OK
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`);
        }
        return r.json();
      })
      .then(data=>{
        // ⭐ AJOUT : Réinitialiser le compteur d'erreurs en cas de succès
        consecutiveErrors = 0;
        
        switch(data.transcriptStatus){
          case 'READY_SUMMARY_PENDING':
            loadingAnimDiv.style.display='none';
            readyAnimDiv.style.display='block';
            if (summaryCheckbox.checked) setSummaryUI('loading'); else setSummaryUI('hidden');
            if(!fetched){ fetchTranscriptText(jobId,email); fetched=true; }
            break;

          case 'READY_SUMMARY_READY':
            clearInterval(intId);
            window._agiloStatusInt = null; // ⭐ AJOUT
            loadingAnimDiv.style.display='none';
            readyAnimDiv.style.display='block';
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
            window._agiloStatusInt = null; // ⭐ AJOUT
            loadingAnimDiv.style.display='none';
            if (summaryCheckbox.checked) setSummaryUI('error'); else setSummaryUI('hidden');
            showError('default');
            alert(data.javaException||'Erreur inconnue');
            break;
        }
      })
      .catch(err=>{
        consecutiveErrors++; // ⭐ AJOUT : Compter les erreurs
        console.error(`getTranscriptStatus (tentative ${pollCount}, erreurs: ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, err);
        
        // ⭐ MODIFICATION : Ne pas s'arrêter à la première erreur
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          clearInterval(intId);
          window._agiloStatusInt = null;
          loadingAnimDiv.style.display='none';
          readyAnimDiv.style.display='none';
          
          // ⭐ AJOUT : Messages d'erreur adaptés selon le type
          if (err.type === 'timeout') {
            showError('timeout');
            alert('Connexion trop lente ou instable. Le traitement a été interrompu après plusieurs tentatives échouées. Veuillez vérifier votre connexion internet et réessayer.');
          } else if (err.type === 'offline') {
            showError('offline');
            alert('Vous êtes hors ligne. Veuillez vérifier votre connexion internet.');
          } else {
            showError('unreachable');
            alert('Impossible de contacter le serveur après plusieurs tentatives. Veuillez vérifier votre connexion internet et réessayer.');
          }
          return;
        }
        
        // ⭐ AJOUT : Avertissement après 3 erreurs (mais continuer)
        if (consecutiveErrors === 3) {
          console.warn('⚠️ Plusieurs erreurs de connexion détectées. Le processus continue...');
        }
        
        // ⭐ IMPORTANT : Ne pas clearInterval ici - on continue à essayer jusqu'à MAX_CONSECUTIVE_ERRORS
      });
  },5000);
  
  window._agiloStatusInt = intId;
}

// ⭐ MODIFICATION 3 : fetchTranscriptText (optionnel mais recommandé)
function fetchTranscriptText(jobId,email){
  if(!globalToken) return console.error('Token manquant');
  
  // ⭐ AJOUT : Timeout de 2 minutes pour récupérer le transcript
  fetchWithTimeout(
    `https://api.agilotext.com/api/v1/receiveText?jobId=${jobId}&username=${email}&token=${globalToken}&edition=${edition}&format=txt`,
    { timeout: 2 * 60 * 1000 } // ⭐ 2 minutes
  )
    .then(r=>{
      // ⭐ AJOUT : Vérifier si la réponse est OK
      if (!r.ok) {
        throw new Error(`HTTP ${r.status}`);
      }
      return r.text();
    })
    .then(txt=>{
      const ta = document.getElementById('transcriptText');
      if (ta) ta.value = txt;
      window.dispatchEvent(new CustomEvent('agilo:transcript-ready', { detail:{ text: txt }}));
      transcriptContainer.style.display='block';
      submitBtn.style.display='none';
      transcriptionTabLink && transcriptionTabLink.click();
    })
    .catch(err=>{ 
      console.error('receiveText:', err); 
      showError(err.type||'default'); 
    });
}

// ⭐ MODIFICATION 4 : fetchSummaryText (optionnel mais recommandé)
function fetchSummaryText(jobId,email){
  if(!globalToken) return console.error('Token manquant');
  
  // ⭐ AJOUT : Timeout de 2 minutes pour récupérer le summary
  fetchWithTimeout(
    `https://api.agilotext.com/api/v1/receiveSummary?jobId=${jobId}&username=${email}&token=${globalToken}&edition=${edition}&format=html`,
    { timeout: 2 * 60 * 1000 } // ⭐ 2 minutes
  )
    .then(r=>{
      // ⭐ AJOUT : Vérifier si la réponse est OK
      if (!r.ok) {
        throw new Error(`HTTP ${r.status}`);
      }
      return r.text();
    })
    .then(html=>{
      summaryText.innerHTML = adjustHtmlContent(html);
      setSummaryUI('ready');
      summaryContainer.style.display='block';
      newFormBtn.style.display = newBtn.style.display = 'flex';
      submitBtn.style.display='none';
      summaryTabLink && summaryTabLink.click();
      window.dispatchEvent(new Event('agilo:rehighlight'));
    })
    .catch(err=>{ 
      console.error('receiveSummary:', err); 
      showError(err.type||'default'); 
    });
}

