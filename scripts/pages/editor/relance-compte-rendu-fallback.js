/* AGILO — FALLBACK pour cacher le bouton Régénérer si le script staging ne charge pas
   Ce script s'exécute IMMÉDIATEMENT et cache le bouton si summaryEmpty=1 ou message d'erreur présent
*/

(function() {
  'use strict';
  
  const log = (...a) => console.log('[AGILO:FALLBACK]', ...a);
  const warn = (...a) => console.warn('[AGILO:FALLBACK]', ...a);
  
  const byId = (id) => document.getElementById(id);
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  
  function hideButton(btn, reason='') {
    if (!btn) return;
    log('hideButton', reason);
    
    // Masquage ultra-agressif
    btn.style.cssText = 'display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;position:absolute!important;left:-9999px!important;width:0!important;height:0!important;overflow:hidden!important;margin:0!important;padding:0!important;';
    btn.classList.add('agilo-force-hide');
    btn.setAttribute('hidden', '');
    btn.setAttribute('aria-hidden', 'true');
    btn.disabled = true;
    
    // Cacher tous les enfants
    $$('*', btn).forEach(child => {
      child.style.setProperty('display', 'none', 'important');
    });
    
    log('Bouton caché', reason);
  }
  
  function hasErrorMessage() {
    const root = byId('editorRoot');
    if (root?.dataset.summaryEmpty === '1') {
      return true;
    }
    
    const summaryEl = byId('summaryEditor') || byId('ag-summary') || $('[data-editor="summary"]');
    if (!summaryEl) return false;
    
    const text = (summaryEl.textContent || summaryEl.innerText || '').toLowerCase();
    const html = (summaryEl.innerHTML || '').toLowerCase();
    const exactMsg = "Le compte-rendu n'est pas encore disponible (fichier manquant/non publié).".toLowerCase();
    
    return text.includes(exactMsg) || html.includes(exactMsg) || 
           text.includes('pas encore disponible') || text.includes('fichier manquant');
  }
  
  function checkAndHide() {
    const allButtons = $$('[data-action="relancer-compte-rendu"]');
    if (allButtons.length === 0) return;
    
    // Supprimer les doublons
    if (allButtons.length > 1) {
      warn(`⚠️ ${allButtons.length} boutons détectés ! Suppression des doublons...`);
      for (let i = 1; i < allButtons.length; i++) {
        allButtons[i].remove();
      }
    }
    
    const btn = allButtons[0];
    if (!btn) return;
    
    const styles = window.getComputedStyle(btn);
    const isVisible = styles.display !== 'none' && 
                      styles.visibility !== 'hidden' &&
                      !btn.classList.contains('agilo-force-hide') &&
                      styles.opacity !== '0';
    
    if (isVisible && hasErrorMessage()) {
      log('⚠️ Message d\'erreur détecté - Cache bouton FORCÉ');
      hideButton(btn, 'fallback-check');
    }
  }
  
  // Vérification immédiate
  checkAndHide();
  
  // Vérifications multiples
  setTimeout(checkAndHide, 100);
  setTimeout(checkAndHide, 300);
  setTimeout(checkAndHide, 500);
  setTimeout(checkAndHide, 1000);
  
  // Vérification périodique (toutes les 200ms)
  setInterval(checkAndHide, 200);
  
  // Écouter les changements du DOM
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => {
      checkAndHide();
    });
    
    const root = byId('editorRoot');
    const summaryEl = byId('summaryEditor') || byId('ag-summary') || $('[data-editor="summary"]');
    
    if (root) {
      observer.observe(root, {
        attributes: true,
        attributeFilter: ['data-summary-empty']
      });
    }
    
    if (summaryEl) {
      observer.observe(summaryEl, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
  }
  
  log('✅ Script fallback initialisé');
})();

