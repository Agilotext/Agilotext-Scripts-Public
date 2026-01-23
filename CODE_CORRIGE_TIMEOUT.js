// ============================================
// CODE CORRIGÉ - Gestion des timeouts et connexions lentes
// ============================================

/* -------------- fetchWithTimeout amélioré -------------- */

function fetchWithTimeout(url, options = {}) {
  // ⭐ Permettre un timeout personnalisé par requête
  // Par défaut : 3h pour les uploads, mais personnalisable pour le polling
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

/* -------------- checkTranscriptStatus CORRIGÉ -------------- */

function checkTranscriptStatus(jobId, email) {
  if (!globalToken) return console.error('Token manquant');
  if (window._agiloStatusInt) clearInterval(window._agiloStatusInt);

  // ⭐ NOUVEAU : Timeout global de 2 heures pour le processus complet
  const GLOBAL_TIMEOUT = 2 * 60 * 60 * 1000; // 2 heures maximum
  const startTime = Date.now();
  let fetched = false;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 5; // Arrêter après 5 erreurs consécutives
  let pollCount = 0;

  const intId = setInterval(() => {
    pollCount++;
    
    // ⭐ Vérifier le timeout global AVANT chaque requête
    const elapsed = Date.now() - startTime;
    if (elapsed > GLOBAL_TIMEOUT) {
      clearInterval(intId);
      window._agiloStatusInt = null;
      loadingAnimDiv.style.display = 'none';
      readyAnimDiv.style.display = 'none';
      showError('timeout');
      alert('Le traitement prend plus de temps que prévu (plus de 2 heures). Veuillez réessayer plus tard ou contacter le support si le problème persiste.');
      return;
    }

    // ⭐ Afficher un message de progression toutes les 30 secondes (6 polls = 30s)
    if (pollCount % 6 === 0) {
      const minutes = Math.floor(elapsed / 60000);
      console.log(`⏳ Traitement en cours depuis ${minutes} minute(s)...`);
    }

    // ⭐ Timeout de 30 secondes pour chaque requête de polling (au lieu de 3h)
    fetchWithTimeout(
      `https://api.agilotext.com/api/v1/getTranscriptStatus?jobId=${jobId}&username=${email}&token=${globalToken}&edition=${edition}`,
      { timeout: 30 * 1000 } // 30 secondes par requête
    )
      .then(r => {
        // ⭐ Vérifier si la réponse est OK
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`);
        }
        return r.json();
      })
      .then(data => {
        // ⭐ Réinitialiser le compteur d'erreurs en cas de succès
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
        console.error(`getTranscriptStatus (tentative ${pollCount}):`, err);
        
        // ⭐ Arrêter après trop d'erreurs consécutives
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          clearInterval(intId);
          window._agiloStatusInt = null;
          loadingAnimDiv.style.display = 'none';
          readyAnimDiv.style.display = 'none';
          
          // ⭐ Message d'erreur adapté selon le type
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
        
        // ⭐ Afficher un avertissement après 3 erreurs (mais continuer)
        if (consecutiveErrors === 3) {
          console.warn('⚠️ Plusieurs erreurs de connexion détectées. Le processus continue...');
          // Optionnel : Afficher un message discret à l'utilisateur
          // Vous pouvez ajouter un toast ou une notification ici
        }
        
        // ⭐ Ne pas clearInterval ici - on continue à essayer jusqu'à MAX_CONSECUTIVE_ERRORS
      });
  }, 5000); // Polling toutes les 5 secondes

  window._agiloStatusInt = intId;
}

/* -------------- fetchTranscriptText amélioré -------------- */

function fetchTranscriptText(jobId, email) {
  if(!globalToken) return console.error('Token manquant');
  
  // ⭐ Timeout de 2 minutes pour récupérer le transcript (fichier peut être gros)
  fetchWithTimeout(
    `https://api.agilotext.com/api/v1/receiveText?jobId=${jobId}&username=${email}&token=${globalToken}&edition=${edition}&format=txt`,
    { timeout: 2 * 60 * 1000 } // 2 minutes
  )
    .then(r => {
      if (!r.ok) {
        throw new Error(`HTTP ${r.status}`);
      }
      return r.text();
    })
    .then(txt => {
      const ta = document.getElementById('transcriptText');
      if (ta) ta.value = txt;
      window.dispatchEvent(new CustomEvent('agilo:transcript-ready', { detail:{ text: txt }}));
      transcriptContainer.style.display = 'block';
      submitBtn.style.display = 'none';
      transcriptionTabLink && transcriptionTabLink.click();
    })
    .catch(err => { 
      console.error('receiveText:', err); 
      showError(err.type || 'default'); 
    });
}

/* -------------- fetchSummaryText amélioré -------------- */

function fetchSummaryText(jobId, email) {
  if(!globalToken) return console.error('Token manquant');
  
  // ⭐ Timeout de 2 minutes pour récupérer le summary (fichier peut être gros)
  fetchWithTimeout(
    `https://api.agilotext.com/api/v1/receiveSummary?jobId=${jobId}&username=${email}&token=${globalToken}&edition=${edition}&format=html`,
    { timeout: 2 * 60 * 1000 } // 2 minutes
  )
    .then(r => {
      if (!r.ok) {
        throw new Error(`HTTP ${r.status}`);
      }
      return r.text();
    })
    .then(html => {
      summaryText.innerHTML = adjustHtmlContent(html);
      setSummaryUI('ready');
      summaryContainer.style.display = 'block';
      newFormBtn.style.display = newBtn.style.display = 'flex';
      submitBtn.style.display = 'none';
      summaryTabLink && summaryTabLink.click();
      window.dispatchEvent(new Event('agilo:rehighlight'));
    })
    .catch(err => { 
      console.error('receiveSummary:', err); 
      showError(err.type || 'default'); 
    });
}

/* -------------- sendWithRetry amélioré -------------- */

async function sendWithRetry(fd, max = 3) {
  const url = 'https://api.agilotext.com/api/v1/sendMultipleAudio';
  
  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      if (!navigator.onLine) await waitForOnline();

      // ⭐ Timeout de 10 minutes pour l'upload (fichiers peuvent être gros)
      const res = await fetchWithTimeout(url, { 
        method: 'POST', 
        body: fd,
        timeout: 10 * 60 * 1000 // 10 minutes pour l'upload
      });

      let data = {};
      try { 
        data = await res.json(); 
      } catch (_) {
        // Si la réponse n'est pas du JSON, c'est une erreur
        throw new Error('Réponse invalide du serveur');
      }

      if (res.ok && data && data.status === 'OK') return data;

      const em = (data && data.errorMessage) || '';

      // ⭐ Erreurs non retryables - retourner directement
      if (
        em.includes('error_audio_format_not_supported') ||
        em.includes('error_duration_is_too_long_for_summary') ||
        em.includes('error_duration_is_too_long') ||
        em.includes('error_audio_file_not_found') ||
        em.includes('error_invalid_token') ||
        em.includes('error_too_many_hours_for_last_30_days')
      ) {
        return data; // laisser le mapping gérer
      }

      // ⭐ Erreurs retryables
      const retryableHttp = [408, 425, 429, 500, 502, 503, 504].includes(res.status);
      const retryableApi  = em === 'error_too_much_traffic';
      
      if ((retryableHttp || retryableApi) && attempt < max) {
        const backoff = Math.min(12000, 1200 * Math.pow(2, attempt - 1)) + Math.floor(Math.random() * 400);
        console.log(`⏳ Tentative ${attempt}/${max} échouée. Nouvelle tentative dans ${Math.round(backoff/1000)}s...`);
        await delay(backoff);
        continue;
      }

      return data;
    } catch (err) {
      if (attempt < max && err && (err.type === 'offline' || err.type === 'timeout' || err.type === 'unreachable')) {
        if (err.type === 'offline') {
          console.log('📴 Hors ligne. Attente de reconnexion...');
          await waitForOnline();
        } else {
          const backoff = Math.min(12000, 1200 * Math.pow(2, attempt - 1)) + Math.floor(Math.random() * 400);
          console.log(`⏳ Erreur de connexion (tentative ${attempt}/${max}). Nouvelle tentative dans ${Math.round(backoff/1000)}s...`);
          await delay(backoff);
        }
        continue;
      }
      throw err;
    }
  }
  
  throw new Error('upload_failed');
}

// ============================================
// RÉSUMÉ DES AMÉLIORATIONS
// ============================================

/*
✅ AMÉLIORATIONS APPORTÉES :

1. ⏱️ TIMEOUT GLOBAL
   - Ajout d'un timeout global de 2 heures pour le processus complet
   - Arrêt automatique si le traitement dépasse cette durée

2. 🔄 GESTION DES ERREURS CONSÉCUTIVES
   - Compteur d'erreurs consécutives
   - Arrêt après 5 erreurs consécutives
   - Messages d'erreur adaptés selon le type (timeout, offline, unreachable)

3. ⚡ TIMEOUTS PAR REQUÊTE
   - Polling : 30 secondes (au lieu de 3h)
   - Récupération transcript/summary : 2 minutes
   - Upload : 10 minutes

4. 📊 INDICATEUR DE PROGRESSION
   - Log toutes les 30 secondes pour rassurer l'utilisateur
   - Avertissement après 3 erreurs (mais continue)

5. 🛡️ VALIDATION DES RÉPONSES
   - Vérification du statut HTTP avant de parser le JSON
   - Meilleure gestion des erreurs réseau

6. 📝 LOGS AMÉLIORÉS
   - Messages plus clairs dans la console
   - Numéro de tentative affiché
*/

