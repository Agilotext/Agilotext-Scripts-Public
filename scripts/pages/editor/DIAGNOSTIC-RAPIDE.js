// 🔍 DIAGNOSTIC RAPIDE - Copier-coller dans la console
(function diagnostic() {
  console.group('🔍 DIAGNOSTIC CRITIQUE');
  
  // 1. Vérifier quel script est chargé
  const scripts = Array.from(document.querySelectorAll('script[src*="Code-"]'));
  const scriptNames = scripts.map(s => {
    const url = s.src || '';
    const name = url.split('/').pop() || 'inline';
    return name;
  });
  
  console.log('📜 Scripts chargés:', scriptNames);
  
  const isStaging = scriptNames.some(n => n.includes('STAGING'));
  console.log('🎭 Version:', isStaging ? '✅ STAGING' : '❌ PRODUCTION (utilisez STAGING !)');
  
  // 2. Vérifier protection suppression
  const root = document.querySelector('#transcriptEditor');
  if (root) {
    console.log('✅ transcriptEditor trouvé');
    console.log('   - __bound:', root.__bound ? '✅ OUI' : '❌ NON');
    console.log('   - Segments:', root.querySelectorAll('.ag-seg').length);
    
    // Vérifier si le listener keydown existe (approximation)
    const hasProtection = root.__bound === true;
    console.log('   - Protection suppression:', hasProtection ? '✅ Présente' : '❌ MANQUANTE');
    
    if (!hasProtection) {
      console.error('🚨 PROBLÈME : La protection contre suppression n\'est pas active !');
      console.error('   → Vérifiez que Code-main-editor-STAGING.js est chargé');
    }
  } else {
    console.error('❌ transcriptEditor non trouvé');
  }
  
  // 3. Vérifier sauvegarde
  const saveInit = window.__agiloSave_FULL_12_JSON_CONTENT;
  console.log('💾 Sauvegarde:', {
    init: saveInit ? '✅ CORRIGE chargé' : '❌ NON CHARGÉ',
    verifyTranscriptReady: typeof window.verifyTranscriptReady === 'function' ? '✅' : '❌'
  });
  
  // 4. Vérifier brouillon (peut expliquer la perte de contenu)
  const jobId = new URLSearchParams(location.search).get('jobId') || '';
  if (jobId) {
    const draftKey = `agilo:draft:${jobId}`;
    const draft = localStorage.getItem(draftKey);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        const textLength = parsed.text?.length || 0;
        console.log('📦 Brouillon localStorage:', {
          existe: '✅ OUI',
          longueur: textLength,
          date: new Date(parsed.ts).toLocaleString(),
          preview: parsed.text?.substring(0, 50) || ''
        });
        
        if (textLength < 10) {
          console.warn('⚠️ Brouillon trop court - sera ignoré par restoreDraftIfAny');
        }
      } catch (e) {
        console.error('❌ Erreur parsing brouillon:', e);
      }
    } else {
      console.log('📦 Brouillon localStorage: ❌ Aucun');
    }
  }
  
  // 5. Vérifier contenu actuel
  if (root) {
    const currentText = (root.innerText || root.textContent || '').trim();
    console.log('📝 Contenu actuel:', {
      longueur: currentText.length,
      segments: root.querySelectorAll('.ag-seg').length,
      preview: currentText.substring(0, 100) || '(vide)'
    });
    
    if (currentText.length === 0) {
      console.error('🚨 PROBLÈME : Le transcript est VIDE !');
      console.error('   → Vérifiez le brouillon localStorage ci-dessus');
    }
  }
  
  // 6. Vérifier si auto-save est désactivé
  console.log('🔄 Auto-save:', {
    note: 'Devrait être DÉSACTIVÉ (sauvegarde manuelle uniquement)',
    // startAutoSave devrait être commenté dans CORRIGE
  });
  
  console.groupEnd();
  
  // Résumé
  console.log('\n📋 RÉSUMÉ:');
  if (!isStaging) {
    console.error('❌ Vous utilisez la version PRODUCTION, pas STAGING !');
    console.error('   → Chargez Code-main-editor-STAGING.js et Code-save_transcript-CORRIGE-STAGING.js');
  }
  if (root && !root.__bound) {
    console.error('❌ Protection suppression non active (root.__bound = false)');
  }
  if (root && (root.innerText || root.textContent || '').trim().length === 0) {
    console.error('❌ Transcript vide - vérifiez le brouillon localStorage');
  }
})();

