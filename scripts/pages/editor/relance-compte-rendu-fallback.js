/* AGILO — FALLBACK pour cacher le bouton Régénérer si le script staging ne charge pas
   Ce script s'exécute IMMÉDIATEMENT et cache le bouton si summaryEmpty=1 ou message d'erreur présent
*/

(function() {
  'use strict';
  
  // Réduire les logs en production (seulement les warnings/erreurs)
  const DEBUG = false; // Mettre à true pour debug
  const log = (...a) => { if (DEBUG) console.log('[AGILO:FALLBACK]', ...a); };
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
  
  function showButton(btn, reason='') {
    if (!btn) return;
    log('showButton', reason);
    
    // Réafficher le bouton
    btn.style.removeProperty('display');
    btn.style.removeProperty('visibility');
    btn.style.removeProperty('opacity');
    btn.style.removeProperty('position');
    btn.style.removeProperty('left');
    btn.style.removeProperty('width');
    btn.style.removeProperty('height');
    btn.style.removeProperty('overflow');
    btn.style.removeProperty('margin');
    btn.style.removeProperty('padding');
    btn.classList.remove('agilo-force-hide');
    btn.removeAttribute('hidden');
    btn.removeAttribute('aria-hidden');
    btn.disabled = false;
    
    // Réafficher les enfants
    $$('*', btn).forEach(child => {
      child.style.removeProperty('display');
    });
    
    log('Bouton réaffiché', reason);
  }
  
  function hasErrorMessage() {
    const root = byId('editorRoot');
    
    // PRIORITÉ 1 : summaryEmpty=1
    if (root?.dataset.summaryEmpty === '1') {
      return true;
    }
    
    // PRIORITÉ 2 : Message d'erreur dans le DOM
    const summaryEl = byId('summaryEditor') || byId('ag-summary') || $('[data-editor="summary"]');
    if (!summaryEl) return false;
    
    const text = (summaryEl.textContent || summaryEl.innerText || '').trim();
    const html = (summaryEl.innerHTML || '').trim();
    
    // Si le contenu est vide ou très court, ce n'est pas un compte-rendu valide
    if (text.length < 50) {
      return false; // Pas assez d'info pour décider
    }
    
    const lowerText = text.toLowerCase();
    const lowerHtml = html.toLowerCase();
    const exactMsg = "Le compte-rendu n'est pas encore disponible (fichier manquant/non publié).".toLowerCase();
    
    // Vérifier le message exact
    if (lowerText.includes(exactMsg) || lowerHtml.includes(exactMsg)) {
      return true;
    }
    
    // Vérifier les patterns d'erreur (seulement si le contenu est court, sinon c'est peut-être un vrai compte-rendu)
    if (text.length < 200 && (lowerText.includes('pas encore disponible') || lowerText.includes('fichier manquant'))) {
      return true;
    }
    
    return false;
  }
  
  function hideCounter(btn) {
    if (!btn) return;
    const counters = $$('.regeneration-counter, #regeneration-info', btn.parentElement || document);
    counters.forEach(c => {
      c.style.display = 'none';
      c.style.visibility = 'hidden';
    });
  }
  
  function showCounter(btn) {
    if (!btn) return;
    const counters = $$('.regeneration-counter, #regeneration-info', btn.parentElement || document);
    counters.forEach(c => {
      c.style.removeProperty('display');
      c.style.removeProperty('visibility');
    });
  }
  
  function checkAndHide() {
    const allButtons = $$('[data-action="relancer-compte-rendu"]');
    if (allButtons.length === 0) return;
    
    // Supprimer les doublons
    if (allButtons.length > 1) {
      if (DEBUG) warn(`⚠️ ${allButtons.length} boutons détectés ! Suppression des doublons...`);
      for (let i = 1; i < allButtons.length; i++) {
        allButtons[i].remove();
      }
    }
    
    const btn = allButtons[0];
    if (!btn) return;
    
    const hasError = hasErrorMessage();
    const styles = window.getComputedStyle(btn);
    const isHidden = btn.classList.contains('agilo-force-hide') || 
                     styles.display === 'none' || 
                     styles.visibility === 'hidden' ||
                     styles.opacity === '0';
    
    if (hasError) {
      // Si erreur détectée et bouton visible → cacher
      if (!isHidden) {
        if (DEBUG) log('⚠️ Message d\'erreur détecté - Cache bouton FORCÉ');
        hideButton(btn, 'fallback-check-error');
      }
      // Cacher aussi le compteur
      hideCounter(btn);
    } else {
      // Si pas d'erreur et bouton caché par le fallback → réafficher
      if (isHidden && btn.classList.contains('agilo-force-hide')) {
        if (DEBUG) log('✅ Pas d\'erreur détectée - Réaffiche bouton');
        showButton(btn, 'fallback-check-ok');
      }
      // Réafficher le compteur
      showCounter(btn);
    }
  }
  
  // Vérification immédiate
  checkAndHide();
  
  // Vérifications multiples (réduites pour moins de lag)
  setTimeout(checkAndHide, 100);
  setTimeout(checkAndHide, 500);
  
  // Vérification périodique (réduite à 500ms au lieu de 200ms pour moins de lag)
  setInterval(checkAndHide, 500);
  
  // ⚠️ IMPORTANT : Écouter les changements de job (agilo:load)
  window.addEventListener('agilo:load', (e) => {
    if (DEBUG) log('agilo:load détecté - Vérification...');
    // Attendre un peu que le DOM se mette à jour
    setTimeout(checkAndHide, 100);
    setTimeout(checkAndHide, 500);
    setTimeout(checkAndHide, 1000);
  });
  
  // Écouter les changements du DOM (optimisé)
  if (typeof MutationObserver !== 'undefined') {
    let timeoutId = null;
    const debouncedCheck = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(checkAndHide, 100); // Debounce pour moins de lag
    };
    
    const observer = new MutationObserver(debouncedCheck);
    
    const root = byId('editorRoot');
    const summaryEl = byId('summaryEditor') || byId('ag-summary') || $('[data-editor="summary"]');
    
    if (root) {
      observer.observe(root, {
        attributes: true,
        attributeFilter: ['data-summary-empty', 'data-job-id']
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
  
  if (DEBUG) log('✅ Script fallback initialisé');
})();

