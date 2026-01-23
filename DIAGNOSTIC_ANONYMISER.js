// Script de diagnostic pour le bouton Anonymiser
// Copiez-collez ce code dans la console du navigateur

console.log('\n🔍 ===== DIAGNOSTIC BOUTON ANONYMISER =====\n');

// 1. Vérifier si le script est chargé
console.log('1️⃣ VÉRIFICATION DU SCRIPT:');
console.log('   Script initialisé:', !!window.__agiloAnonymiserInitialized);
console.log('   Fonction anonymiser disponible:', typeof window.anonymiser === 'function' || typeof anonymiser === 'function');

// 2. Vérifier le bouton
console.log('\n2️⃣ VÉRIFICATION DU BOUTON:');
const btn = document.querySelector('[data-action="anonymiser"]');
console.log('   Bouton trouvé:', !!btn);
if (btn) {
  console.log('   - ID:', btn.id || 'aucun');
  console.log('   - Classes:', btn.className);
  console.log('   - Display:', window.getComputedStyle(btn).display);
  console.log('   - Visibility:', window.getComputedStyle(btn).visibility);
  console.log('   - Opacity:', window.getComputedStyle(btn).opacity);
  console.log('   - Disabled:', btn.disabled);
  console.log('   - Text:', btn.textContent || btn.innerText);
  console.log('   - Parent:', btn.parentElement?.className || 'aucun');
  
  // Vérifier les event listeners
  const listeners = getEventListeners ? getEventListeners(btn) : 'getEventListeners non disponible';
  console.log('   - Event listeners:', listeners);
} else {
  console.error('   ❌ BOUTON NON TROUVÉ !');
}

// 3. Vérifier l'onglet actif
console.log('\n3️⃣ VÉRIFICATION ONGLET ACTIF:');
const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
console.log('   Onglet actif:', activeTab?.id || 'aucun');
console.log('   - ID:', activeTab?.id);
console.log('   - data-tab:', activeTab?.dataset.tab);
console.log('   - aria-selected:', activeTab?.getAttribute('aria-selected'));

// Fonction pour détecter l'onglet (copie du script)
function getActiveTab() {
  const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
  if (!activeTab) return null;
  
  const tabId = activeTab.id || '';
  if (tabId === 'tab-transcript') return 'transcript';
  if (tabId === 'tab-summary') return 'summary';
  if (tabId === 'tab-chat') return 'chat';
  
  return null;
}

const detectedTab = getActiveTab();
console.log('   Onglet détecté par fonction:', detectedTab);

// 4. Vérifier les éditeurs
console.log('\n4️⃣ VÉRIFICATION ÉDITEURS:');
const transcriptEditor = document.getElementById('transcriptEditor') || 
                        document.querySelector('[data-editor="transcript"]');
const summaryEditor = document.getElementById('summaryEditor') || 
                     document.getElementById('pane-summary') ||
                     document.querySelector('[data-editor="summary"]');

console.log('   Transcript Editor:', !!transcriptEditor);
if (transcriptEditor) {
  console.log('   - ID:', transcriptEditor.id);
  console.log('   - Contenu (premiers 50 chars):', (transcriptEditor.textContent || '').substring(0, 50));
  console.log('   - window._segments:', !!window._segments, window._segments?.length || 0);
}

console.log('   Summary Editor:', !!summaryEditor);
if (summaryEditor) {
  console.log('   - ID:', summaryEditor.id);
  console.log('   - Contenu (premiers 50 chars):', (summaryEditor.textContent || '').substring(0, 50));
  console.log('   - Hidden:', summaryEditor.hasAttribute('hidden'));
}

// 5. Vérifier les credentials
console.log('\n5️⃣ VÉRIFICATION CREDENTIALS:');
const editorRoot = document.getElementById('editorRoot');
const email = editorRoot?.dataset.username ||
              document.querySelector('[name="memberEmail"]')?.value ||
              window.memberEmail ||
              localStorage.getItem('agilo:username') ||
              '';
const edition = editorRoot?.dataset.edition ||
                window.AGILO_EDITION ||
                new URLSearchParams(location.search).get('edition') ||
                localStorage.getItem('agilo:edition') ||
                'ent';
const token = editorRoot?.dataset.token ||
              window.globalToken ||
              localStorage.getItem(`agilo:token:${edition}:${email.toLowerCase()}`) ||
              '';

console.log('   Email:', email || '❌ MANQUANT');
console.log('   Edition:', edition);
console.log('   Token:', token ? '✅ Présent (' + token.substring(0, 10) + '...)' : '❌ MANQUANT');
console.log('   editorRoot:', !!editorRoot);

// 6. Tester l'extraction du contenu
console.log('\n6️⃣ TEST EXTRACTION CONTENU:');

// Fonction pour extraire le transcript (copie du script)
function getTranscriptContent() {
  if (window._segments && Array.isArray(window._segments) && window._segments.length > 0) {
    return window._segments
      .map(seg => {
        const speaker = (seg.speaker || '').trim();
        const text = (seg.text || '').trim();
        return speaker ? `${speaker}: ${text}` : text;
      })
      .join('\n\n');
  }
  
  const transcriptEditor = document.getElementById('transcriptEditor') || 
                          document.querySelector('[data-editor="transcript"]');
  
  if (!transcriptEditor) {
    return null;
  }
  
  if (typeof window.visibleTextFromBox === 'function') {
    return window.visibleTextFromBox(transcriptEditor);
  }
  
  return transcriptEditor.textContent || transcriptEditor.innerText || '';
}

// Fonction pour extraire le compte-rendu (copie du script)
function getSummaryContent() {
  const summaryEditor = document.getElementById('summaryEditor') || 
                       document.getElementById('pane-summary') ||
                       document.querySelector('[data-editor="summary"]');
  
  if (!summaryEditor) {
    return null;
  }
  
  const textContent = summaryEditor.textContent || summaryEditor.innerText || '';
  return textContent;
}

const transcriptContent = getTranscriptContent();
const summaryContent = getSummaryContent();

console.log('   Transcript:', transcriptContent ? `✅ ${transcriptContent.length} caractères` : '❌ Vide ou introuvable');
if (transcriptContent) {
  console.log('   - Aperçu:', transcriptContent.substring(0, 100) + '...');
}

console.log('   Compte-rendu:', summaryContent ? `✅ ${summaryContent.length} caractères` : '❌ Vide ou introuvable');
if (summaryContent) {
  console.log('   - Aperçu:', summaryContent.substring(0, 100) + '...');
}

// 7. Vérifier la visibilité du bouton selon l'onglet
console.log('\n7️⃣ VÉRIFICATION VISIBILITÉ:');
if (btn) {
  const shouldBeVisible = detectedTab === 'transcript' || detectedTab === 'summary';
  const isVisible = window.getComputedStyle(btn).display !== 'none' && 
                    window.getComputedStyle(btn).visibility !== 'hidden';
  
  console.log('   Onglet actif:', detectedTab);
  console.log('   Devrait être visible:', shouldBeVisible);
  console.log('   Est visible:', isVisible);
  console.log('   État:', shouldBeVisible === isVisible ? '✅ Correct' : '❌ Incorrect');
}

// 8. Tester le clic manuellement
console.log('\n8️⃣ TEST CLIC MANUEL:');
if (btn) {
  console.log('   Pour tester, exécutez dans la console:');
  console.log('   document.querySelector(\'[data-action="anonymiser"]\').click();');
  console.log('\n   Ou testez la fonction directement:');
  console.log('   (Copiez le code de la fonction anonymiser depuis le script)');
}

// 9. Vérifier les erreurs JavaScript
console.log('\n9️⃣ VÉRIFICATION ERREURS:');
console.log('   Vérifiez la console pour les erreurs JavaScript (en rouge)');
console.log('   Vérifiez l\'onglet Network pour les appels API');

// 10. Résumé et recommandations
console.log('\n🔟 RÉSUMÉ:');
const issues = [];

if (!btn) {
  issues.push('❌ Bouton non trouvé dans le DOM');
}
if (!email || !token) {
  issues.push('❌ Credentials manquants');
}
if (!transcriptContent && !summaryContent) {
  issues.push('❌ Aucun contenu à anonymiser');
}
if (detectedTab === 'chat') {
  issues.push('⚠️ Onglet Conversation actif (anonymisation non disponible)');
}
if (btn && window.getComputedStyle(btn).display === 'none') {
  issues.push('⚠️ Bouton caché (vérifier la logique de visibilité)');
}

if (issues.length === 0) {
  console.log('   ✅ Tout semble correct !');
  console.log('   Si ça ne fonctionne toujours pas, vérifiez:');
  console.log('   - Que le script est bien chargé (vérifier Network)');
  console.log('   - Qu\'il n\'y a pas d\'erreurs JavaScript');
  console.log('   - Que l\'événement click est bien attaché');
} else {
  console.log('   Problèmes détectés:');
  issues.forEach(issue => console.log('   ' + issue));
}

console.log('\n📋 COMMANDES UTILES:');
console.log('   - Voir le bouton: document.querySelector(\'[data-action="anonymiser"]\')');
console.log('   - Voir l\'onglet actif: document.querySelector(\'[role="tab"][aria-selected="true"]\')');
console.log('   - Voir les segments: window._segments');
console.log('   - Tester le clic: document.querySelector(\'[data-action="anonymiser"]\').click()');
console.log('   - Voir les credentials: { email, edition, token }');
console.log('\n========================================\n');

