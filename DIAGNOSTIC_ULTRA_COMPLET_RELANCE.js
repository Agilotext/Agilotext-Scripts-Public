/**
 * 🔍 DIAGNOSTIC ULTRA-COMPLET POUR RÉGÉNÉRATION COMPTE-RENDU
 * 
 * Copiez-collez ce script COMPLET dans la console du navigateur
 * Il va tester TOUT le processus et identifier EXACTEMENT où ça bloque
 */

(async function() {
  console.log('🔍 ========================================');
  console.log('🔍 DIAGNOSTIC ULTRA-COMPLET - RÉGÉNÉRATION');
  console.log('🔍 ========================================');
  console.log('');
  
  // 1. Récupérer les credentials
  console.log('📋 ÉTAPE 1: Récupération des credentials...');
  const urlParams = new URLSearchParams(window.location.search);
  let jobId = urlParams.get('jobId') || document.querySelector('#editorRoot')?.dataset.jobId;
  let edition = urlParams.get('edition') || document.querySelector('#editorRoot')?.dataset.edition || 'ent';
  let email = window.AGILO_EMAIL || localStorage.getItem('agilo:email') || 'bauerwebpro@gmail.com';
  let token = window.globalToken || localStorage.getItem('agilo:token');
  
  if (!jobId || !email || !token) {
    console.error('❌ CREDENTIALS MANQUANTS !');
    console.error('jobId:', jobId);
    console.error('email:', email);
    console.error('token:', token ? '✓ (' + token.length + ' chars)' : '✗');
    return;
  }
  
  console.log('✅ Credentials OK:', {
    jobId,
    edition,
    email: email.substring(0, 20) + '...',
    tokenLength: token.length
  });
  console.log('');
  
  // 2. Vérifier le statut ACTUEL avant redoSummary
  console.log('📊 ÉTAPE 2: Statut ACTUEL avant redoSummary...');
  try {
    const statusUrl1 = `https://api.agilotext.com/api/v1/getTranscriptStatus?jobId=${encodeURIComponent(String(jobId))}&username=${encodeURIComponent(String(email))}&token=${encodeURIComponent(String(token))}&edition=${encodeURIComponent(String(edition))}`;
    const statusResponse1 = await fetch(statusUrl1, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit'
    });
    const statusData1 = await statusResponse1.json();
    const currentStatus = statusData1.status === 'OK' && statusData1.transcriptStatus ? statusData1.transcriptStatus : null;
    console.log('📊 Statut ACTUEL:', currentStatus);
    console.log('📊 Réponse complète:', statusData1);
    console.log('');
  } catch (error) {
    console.error('❌ Erreur récupération statut actuel:', error);
    console.log('');
  }
  
  // 3. Récupérer l'ancien hash
  console.log('🔐 ÉTAPE 3: Récupération hash ANCIEN compte-rendu...');
  let oldHash = '';
  try {
    const oldUrl = `https://api.agilotext.com/api/v1/receiveSummary?jobId=${encodeURIComponent(String(jobId))}&username=${encodeURIComponent(String(email))}&token=${encodeURIComponent(String(token))}&edition=${encodeURIComponent(String(edition))}&format=html`;
    const oldResponse = await fetch(oldUrl, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit'
    });
    if (oldResponse.ok) {
      const oldText = await oldResponse.text();
      if (oldText && oldText.length > 100 && !oldText.includes('pas encore disponible')) {
        // Hash simple
        oldHash = btoa(oldText.substring(0, 1000)).substring(0, 50);
        console.log('✅ Hash ancien CR récupéré:', oldHash);
        console.log('📏 Longueur ancien CR:', oldText.length, 'caractères');
      } else {
        console.warn('⚠️ Ancien CR non disponible ou invalide');
      }
    }
    console.log('');
  } catch (error) {
    console.error('❌ Erreur récupération ancien hash:', error);
    console.log('');
  }
  
  // 4. Appel redoSummary
  console.log('🚀 ÉTAPE 4: Appel redoSummary...');
  const redoUrl = `https://api.agilotext.com/api/v1/redoSummary?jobId=${encodeURIComponent(String(jobId))}&username=${encodeURIComponent(String(email))}&token=${encodeURIComponent(String(token))}&edition=${encodeURIComponent(String(edition))}`;
  console.log('📤 URL:', redoUrl.substring(0, 150) + '...');
  
  const redoStartTime = Date.now();
  let redoResult;
  try {
    const redoResponse = await fetch(redoUrl, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit'
    });
    const redoTime = Date.now() - redoStartTime;
    redoResult = await redoResponse.json();
    
    console.log('📥 Réponse redoSummary:', {
      status: redoResult.status,
      httpStatus: redoResponse.status,
      ok: redoResponse.ok,
      timeMs: redoTime,
      errorMessage: redoResult.errorMessage,
      fullResult: redoResult
    });
    
    if (redoResult.status !== 'OK' && !redoResponse.ok) {
      console.error('❌ redoSummary ÉCHOUÉ - Arrêt du diagnostic');
      return;
    }
    
    console.log('✅ redoSummary OK');
    console.log('');
  } catch (error) {
    console.error('❌ Erreur redoSummary:', error);
    return;
  }
  
  // 5. Délai initial de 40 secondes avec monitoring
  console.log('⏳ ÉTAPE 5: Délai initial de 40 secondes...');
  console.log('⏳ Le backend a besoin de temps pour traiter redoSummary');
  console.log('⏳ On vérifie le statut toutes les 5 secondes pendant l\'attente...');
  console.log('');
  
  const initialDelay = 40000; // 40 secondes
  let statusHistory = [];
  
  for (let remaining = initialDelay; remaining > 0; remaining -= 5000) {
    const secondsLeft = Math.ceil(remaining / 1000);
    console.log(`⏳ Attente... ${secondsLeft} secondes restantes`);
    
    // Vérifier le statut toutes les 5 secondes
    try {
      const statusUrl = `https://api.agilotext.com/api/v1/getTranscriptStatus?jobId=${encodeURIComponent(String(jobId))}&username=${encodeURIComponent(String(email))}&token=${encodeURIComponent(String(token))}&edition=${encodeURIComponent(String(edition))}`;
      const statusResponse = await fetch(statusUrl, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit'
      });
      const statusData = await statusResponse.json();
      const status = statusData.status === 'OK' && statusData.transcriptStatus ? statusData.transcriptStatus : null;
      
      statusHistory.push({
        time: new Date().toISOString(),
        secondsLeft: secondsLeft,
        status: status
      });
      
      console.log(`  📊 Statut à ${secondsLeft}s:`, status);
      
      if (status === 'READY_SUMMARY_PENDING') {
        console.log('  ✅✅✅ READY_SUMMARY_PENDING DÉTECTÉ ! La régénération a commencé !');
      }
    } catch (error) {
      console.error('  ❌ Erreur vérification statut:', error);
    }
    
    await new Promise(r => setTimeout(r, Math.min(5000, remaining)));
  }
  
  console.log('');
  console.log('📊 Historique des statuts pendant l\'attente:');
  statusHistory.forEach(h => {
    console.log(`  ${h.time} (${h.secondsLeft}s restantes): ${h.status}`);
  });
  console.log('');
  console.log('✅ Délai initial terminé');
  console.log('');
  
  // 6. Polling détaillé
  console.log('🔄 ÉTAPE 6: Polling détaillé pour READY_SUMMARY_READY...');
  console.log('🔄 On vérifie le statut toutes les 3 secondes (max 60 tentatives = 3 minutes)');
  console.log('');
  
  let hasSeenPending = false;
  let lastReadyHash = null;
  let pollingHistory = [];
  
  for (let attempt = 1; attempt <= 60; attempt++) {
    try {
      const statusUrl = `https://api.agilotext.com/api/v1/getTranscriptStatus?jobId=${encodeURIComponent(String(jobId))}&username=${encodeURIComponent(String(email))}&token=${encodeURIComponent(String(token))}&edition=${encodeURIComponent(String(edition))}`;
      const statusStartTime = Date.now();
      const statusResponse = await fetch(statusUrl, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit'
      });
      const statusTime = Date.now() - statusStartTime;
      const statusData = await statusResponse.json();
      const status = statusData.status === 'OK' && statusData.transcriptStatus ? statusData.transcriptStatus : null;
      
      pollingHistory.push({
        attempt,
        time: new Date().toISOString(),
        status,
        responseTimeMs: statusTime,
        fullResponse: statusData
      });
      
      console.log(`📊 Tentative ${attempt}/60 - Statut:`, status, `(temps réponse: ${statusTime}ms)`);
      
      // Détecter READY_SUMMARY_PENDING
      if (status === 'READY_SUMMARY_PENDING') {
        if (!hasSeenPending) {
          console.log('✅✅✅ READY_SUMMARY_PENDING DÉTECTÉ ! La régénération a commencé !');
          hasSeenPending = true;
        } else {
          console.log('⏳ READY_SUMMARY_PENDING - En cours de génération...');
        }
      }
      
      // Détecter READY_SUMMARY_READY
      if (status === 'READY_SUMMARY_READY') {
        console.log('✅ READY_SUMMARY_READY détecté ! Vérification du hash...');
        
        // Récupérer le nouveau compte-rendu
        try {
          const receiveUrl = `https://api.agilotext.com/api/v1/receiveSummary?jobId=${encodeURIComponent(String(jobId))}&username=${encodeURIComponent(String(email))}&token=${encodeURIComponent(String(token))}&edition=${encodeURIComponent(String(edition))}&format=html`;
          const receiveResponse = await fetch(receiveUrl, {
            method: 'GET',
            cache: 'no-store',
            credentials: 'omit'
          });
          
          if (receiveResponse.ok) {
            const newText = await receiveResponse.text();
            
            if (newText && newText.length > 100 && 
                !newText.includes('pas encore disponible') && 
                !newText.includes('non publié')) {
              
              const newHash = btoa(newText.substring(0, 1000)).substring(0, 50);
              
              console.log('📊 Hash nouveau CR:', newHash);
              console.log('📊 Hash ancien CR:', oldHash || '(aucun)');
              console.log('📏 Longueur nouveau CR:', newText.length, 'caractères');
              
              if (oldHash && newHash === oldHash) {
                console.log('⚠️ Hash identique - C\'est probablement l\'ANCIEN compte-rendu');
                console.log('⚠️ On continue le polling...');
                lastReadyHash = newHash;
              } else {
                console.log('✅✅✅ HASH DIFFÉRENT - NOUVEAU COMPTE-RENDU CONFIRMÉ !');
                console.log('');
                console.log('🎉 SUCCÈS COMPLET !');
                console.log('');
                console.log('📊 RÉSUMÉ:');
                console.log('  - redoSummary: OK');
                console.log('  - Délai initial: 40 secondes');
                console.log('  - READY_SUMMARY_PENDING détecté:', hasSeenPending ? 'OUI' : 'NON');
                console.log('  - READY_SUMMARY_READY détecté: OUI');
                console.log('  - Hash changé: OUI');
                console.log('  - Nombre de tentatives:', attempt);
                console.log('  - Temps total:', Math.round((Date.now() - redoStartTime) / 1000), 'secondes');
                return;
              }
            } else {
              console.warn('⚠️ Contenu invalide - Continuation du polling');
            }
          }
        } catch (error) {
          console.error('❌ Erreur récupération nouveau CR:', error);
        }
      }
      
      // Détecter erreurs
      if (status === 'READY_SUMMARY_ON_ERROR' || status === 'ON_ERROR') {
        console.error('❌ Erreur lors de la génération:', status);
        console.log('');
        console.log('📊 RÉSUMÉ:');
        console.log('  - redoSummary: OK');
        console.log('  - Délai initial: 40 secondes');
        console.log('  - READY_SUMMARY_PENDING détecté:', hasSeenPending ? 'OUI' : 'NON');
        console.log('  - Erreur détectée:', status);
        console.log('  - Nombre de tentatives:', attempt);
        return;
      }
      
      // Attendre avant la prochaine tentative
      if (attempt < 60) {
        await new Promise(r => setTimeout(r, 3000));
      }
      
    } catch (error) {
      console.error(`❌ Erreur polling (tentative ${attempt}/60):`, error);
      if (attempt < 60) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
  
  console.log('');
  console.log('⚠️ TIMEOUT: READY_SUMMARY_READY non obtenu après 60 tentatives');
  console.log('');
  console.log('📊 RÉSUMÉ COMPLET:');
  console.log('  - redoSummary: OK');
  console.log('  - Délai initial: 40 secondes');
  console.log('  - READY_SUMMARY_PENDING détecté:', hasSeenPending ? 'OUI' : 'NON');
  console.log('  - READY_SUMMARY_READY détecté: NON');
  console.log('  - Nombre de tentatives: 60');
  console.log('  - Temps total:', Math.round((Date.now() - redoStartTime) / 1000), 'secondes');
  console.log('');
  console.log('📊 Historique complet du polling:');
  pollingHistory.forEach(h => {
    console.log(`  Tentative ${h.attempt} (${h.time}): ${h.status} (${h.responseTimeMs}ms)`);
  });
  console.log('');
  console.log('🔍 ANALYSE:');
  if (!hasSeenPending) {
    console.log('  ⚠️ PROBLÈME: READY_SUMMARY_PENDING n\'a JAMAIS été détecté');
    console.log('  ⚠️ Cela signifie que le backend n\'a peut-être pas commencé la régénération');
    console.log('  ⚠️ Nicolas doit vérifier si redoSummary déclenche bien la régénération');
  } else {
    console.log('  ✅ READY_SUMMARY_PENDING a été détecté - La régénération a commencé');
    console.log('  ⚠️ Mais READY_SUMMARY_READY n\'a pas été obtenu après 60 tentatives');
    console.log('  ⚠️ La régénération prend peut-être plus de 3 minutes');
    console.log('  ⚠️ Ou il y a un problème côté backend');
  }
  console.log('');
  console.log('💡 RECOMMANDATIONS:');
  console.log('  1. Vérifier avec Nicolas si redoSummary déclenche bien la régénération');
  console.log('  2. Vérifier combien de temps prend réellement la régénération côté backend');
  console.log('  3. Augmenter le nombre de tentatives si la régénération prend plus de 3 minutes');
  console.log('  4. Vérifier les logs backend pour voir si la régénération se bloque quelque part');
  console.log('');
})();

