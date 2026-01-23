// Agilotext - Vérification onboarding (Script standalone avec DEBUG)
// ⚠️ À copier-coller dans un embed code Webflow
// Fonctionne pour tous les plans (Free, Pro, Business)
// Vérifie si l'utilisateur a complété l'onboarding et redirige si nécessaire

(function() {
  'use strict';
  
  const ONBOARDING_URL = 'https://www.agilotext.com/auth/setup';
  const MAX_WAIT_TIME = 3000; // 3 secondes max pour attendre Memberstack
  const CHECK_INTERVAL = 100; // Vérifier toutes les 100ms
  const ONBOARDING_ELEMENT_ID = 'ms-onboarding-version';
  const DEBUG = true; // Mettre à false en production
  
  // Fonction pour vérifier le statut d'onboarding
  function checkOnboardingStatus() {
    const element = document.getElementById(ONBOARDING_ELEMENT_ID);
    
    if (DEBUG) {
      console.log('[Onboarding Check] Élément recherché:', ONBOARDING_ELEMENT_ID);
      console.log('[Onboarding Check] Élément trouvé:', element);
    }
    
    // Si l'élément n'existe pas encore, on attend
    if (!element) {
      if (DEBUG) console.log('[Onboarding Check] Élément pas encore présent dans le DOM');
      return null; // null = pas encore prêt
    }
    
    // Récupérer le contenu textuel (trim pour enlever les espaces)
    const content = (element.textContent || element.innerText || '').trim();
    
    if (DEBUG) {
      console.log('[Onboarding Check] Contenu de l\'élément:', content);
      console.log('[Onboarding Check] Contenu vide?', content === '');
    }
    
    // Si vide ou null/undefined, l'utilisateur n'a pas fait l'onboarding
    if (!content || content === '') {
      if (DEBUG) console.log('[Onboarding Check] ❌ Onboarding NON fait - Redirection nécessaire');
      return false; // false = pas d'onboarding
    }
    
    // Si contient une valeur (ex: "v1"), l'onboarding est fait
    if (DEBUG) console.log('[Onboarding Check] ✅ Onboarding fait (version:', content + ') - Pas de redirection');
    return true; // true = onboarding fait
  }
  
  // Fonction de redirection
  function redirectToOnboarding() {
    // Redirection avec paramètre pour indiquer que c'est un utilisateur existant
    const url = new URL(ONBOARDING_URL);
    url.searchParams.set('from', 'dashboard');
    url.searchParams.set('existing', 'true');
    if (DEBUG) console.log('[Onboarding Check] 🔄 Redirection vers:', url.toString());
    window.location.href = url.toString();
  }
  
  // Fonction principale d'initialisation
  function init() {
    if (DEBUG) console.log('[Onboarding Check] 🚀 Initialisation du script de vérification onboarding');
    
    const startTime = Date.now();
    let checkCount = 0;
    
    const checkInterval = setInterval(() => {
      checkCount++;
      const status = checkOnboardingStatus();
      
      if (DEBUG && checkCount % 10 === 0) {
        console.log('[Onboarding Check] Vérification #' + checkCount, 'Status:', status);
      }
      
      // Si on détecte que l'utilisateur n'a pas fait l'onboarding
      if (status === false) {
        clearInterval(checkInterval);
        if (DEBUG) console.log('[Onboarding Check] ⚠️ Onboarding non fait détecté - Redirection...');
        redirectToOnboarding();
        return;
      }
      
      // Si l'onboarding est fait, on arrête la vérification
      if (status === true) {
        clearInterval(checkInterval);
        if (DEBUG) console.log('[Onboarding Check] ✅ Onboarding confirmé - Script arrêté');
        return;
      }
      
      // Si on dépasse le temps max et que l'élément n'existe toujours pas
      // On considère qu'il n'y a pas d'onboarding (sécurité)
      if (Date.now() - startTime >= MAX_WAIT_TIME) {
        clearInterval(checkInterval);
        if (DEBUG) console.log('[Onboarding Check] ⏱️ Timeout atteint (' + MAX_WAIT_TIME + 'ms)');
        // Vérifier une dernière fois
        const finalStatus = checkOnboardingStatus();
        if (finalStatus === false || finalStatus === null) {
          if (DEBUG) console.log('[Onboarding Check] ⚠️ Après timeout: Onboarding non fait - Redirection...');
          redirectToOnboarding();
        } else {
          if (DEBUG) console.log('[Onboarding Check] ✅ Après timeout: Onboarding fait - Pas de redirection');
        }
      }
    }, CHECK_INTERVAL);
  }
  
  // Démarrer la vérification dès que le DOM est prêt
  if (document.readyState === 'loading') {
    if (DEBUG) console.log('[Onboarding Check] DOM en cours de chargement - Attente DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    // DOM déjà chargé, démarrer immédiatement
    if (DEBUG) console.log('[Onboarding Check] DOM déjà chargé - Démarrage immédiat');
    init();
  }
})();

