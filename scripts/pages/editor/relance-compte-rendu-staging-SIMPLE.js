/* AGILO — Script SIMPLE pour cacher/afficher le bouton Régénérer
   APPROCHE SIMPLE : 
   1. Si summaryEmpty='1' → CACHER
   2. Si message d'erreur dans summaryEditor → CACHER
   3. Sinon → AFFICHER
*/

(function () {
  'use strict';
  
  console.log('[AGILO:RELANCE-SIMPLE] Script chargé');
  
  const DEBUG = false; // Désactivé par défaut pour moins de lag (mettre à true pour debug)
  const log = (...a) => { if (DEBUG) console.log('[AGILO:RELANCE-SIMPLE]', ...a); };
  
  // Helpers
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const byId = (id) => document.getElementById(id);
  
  // Message d'erreur exact
  const ERROR_MSG = "Le compte-rendu n'est pas encore disponible (fichier manquant/non publié).";
  
  // Fonction SIMPLE pour vérifier si on doit cacher le bouton
  function shouldHideButton() {
    const root = byId('editorRoot');
    const summaryEl = byId('summaryEditor') || byId('ag-summary') || $('[data-editor="summary"]');
    
    // PRIORITÉ 1 : summaryEmpty='1'
    if (root?.dataset.summaryEmpty === '1') {
      log('✅ CACHER : summaryEmpty=1');
      return true;
    }
    
    // PRIORITÉ 2 : Message d'erreur dans summaryEditor
    if (summaryEl) {
      const text = (summaryEl.textContent || summaryEl.innerText || '').toLowerCase();
      const html = (summaryEl.innerHTML || '').toLowerCase();
      const errorLower = ERROR_MSG.toLowerCase();
      
      // Vérifier le message exact
      if (text.includes(errorLower) || html.includes(errorLower)) {
        log('✅ CACHER : Message erreur détecté dans summaryEditor');
        return true;
      }
      
      // Vérifier les patterns (seulement si contenu court)
      if (text.length < 300 && (
          text.includes('pas encore disponible') && 
          (text.includes('fichier manquant') || text.includes('non publié'))
        )) {
        log('✅ CACHER : Pattern erreur détecté dans summaryEditor');
        return true;
      }
      
      // Vérifier dans les alertes
      const alerts = summaryEl.querySelectorAll('.ag-alert, .ag-alert--warn, .ag-alert__title');
      for (const alert of alerts) {
        const alertText = (alert.textContent || alert.innerText || '').toLowerCase();
        if (alertText.includes(errorLower) || 
            (alertText.includes('pas encore disponible') && alertText.includes('fichier manquant'))) {
          log('✅ CACHER : Message erreur dans alerte');
          return true;
        }
      }
    }
    
    log('❌ AFFICHER : Aucune raison de cacher');
    return false;
  }
  
  // Fonction SIMPLE pour cacher le bouton
  function hideButton(btn) {
    if (!btn) return;
    log('🔒 Cache bouton');
    btn.style.cssText = 'display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;';
    btn.classList.add('agilo-force-hide');
    btn.setAttribute('hidden', '');
    btn.setAttribute('aria-hidden', 'true');
    btn.disabled = true;
  }
  
  // Fonction SIMPLE pour afficher le bouton
  function showButton(btn) {
    if (!btn) return;
    log('🔓 Affiche bouton');
    btn.style.removeProperty('display');
    btn.style.removeProperty('visibility');
    btn.style.removeProperty('opacity');
    btn.style.removeProperty('pointer-events');
    btn.classList.remove('agilo-force-hide');
    btn.removeAttribute('hidden');
    btn.removeAttribute('aria-hidden');
    btn.disabled = false;
  }
  
  // Fonction SIMPLE pour mettre à jour la visibilité (avec cache pour éviter appels inutiles)
  let lastState = null; // 'hidden' ou 'visible'
  function updateVisibility() {
    const btn = $('[data-action="relancer-compte-rendu"]');
    if (!btn) {
      log('⚠️ Bouton non trouvé');
      return;
    }
    
    const shouldHide = shouldHideButton();
    const currentState = shouldHide ? 'hidden' : 'visible';
    
    // Ne rien faire si l'état n'a pas changé
    if (lastState === currentState) {
      return; // État identique, pas besoin de modifier
    }
    
    lastState = currentState;
    
    if (shouldHide) {
      hideButton(btn);
    } else {
      showButton(btn);
    }
  }
  
  // Initialisation SIMPLE
  function init() {
    if (window.__agiloRelanceSimpleInit) {
      log('⚠️ Déjà initialisé');
      return;
    }
    window.__agiloRelanceSimpleInit = true;
    log('✅ Initialisation');
    
    // Vérifier immédiatement
    updateVisibility();
    
    // Vérifier périodiquement (toutes les 1000ms pour moins de lag)
    setInterval(updateVisibility, 1000);
    
    // Écouter les changements de summaryEmpty (avec reset du cache)
    const root = byId('editorRoot');
    if (root) {
      const observer = new MutationObserver(() => {
        log('📊 summaryEmpty changé:', root.dataset.summaryEmpty);
        lastState = null; // Reset cache pour forcer la vérification
        updateVisibility();
      });
      observer.observe(root, { attributes: true, attributeFilter: ['data-summary-empty'] });
    }
    
    // Écouter agilo:load (avec reset du cache)
    window.addEventListener('agilo:load', () => {
      log('📡 agilo:load détecté');
      lastState = null; // Reset cache pour forcer la vérification
      setTimeout(updateVisibility, 100);
      setTimeout(updateVisibility, 500);
      setTimeout(updateVisibility, 1500);
    });
  }
  
  // Démarrer
  if (document.readyState !== 'loading') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  }
  
  // Fallback si DOMContentLoaded n'a pas été déclenché
  setTimeout(init, 1000);
})();

