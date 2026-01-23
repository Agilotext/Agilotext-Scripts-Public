// Agilotext - Vérification onboarding
// ⚠️ Ce fichier est chargé depuis GitHub
// Vérifie si l'utilisateur a complété l'onboarding et redirige si nécessaire

(function() {
  'use strict';
  
  const ONBOARDING_URL = 'https://www.agilotext.com/auth/setup';
  const MAX_WAIT_TIME = 3000; // 3 secondes max pour attendre Memberstack
  const CHECK_INTERVAL = 100; // Vérifier toutes les 100ms
  const ONBOARDING_ELEMENT_ID = 'ms-onboarding-version';
  
  function checkOnboardingStatus() {
    const element = document.getElementById(ONBOARDING_ELEMENT_ID);
    
    // Si l'élément n'existe pas encore, on attend
    if (!element) {
      return null; // null = pas encore prêt
    }
    
    // Récupérer le contenu textuel (trim pour enlever les espaces)
    const content = (element.textContent || element.innerText || '').trim();
    
    // Si vide ou null/undefined, l'utilisateur n'a pas fait l'onboarding
    if (!content || content === '') {
      return false; // false = pas d'onboarding
    }
    
    // Si contient une valeur (ex: "v1"), l'onboarding est fait
    return true; // true = onboarding fait
  }
  
  function redirectToOnboarding() {
    // Redirection immédiate sans délai
    window.location.href = ONBOARDING_URL;
  }
  
  function waitForMemberstackData() {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkInterval = setInterval(() => {
        const status = checkOnboardingStatus();
        
        // Si on a une réponse (true ou false), on arrête
        if (status !== null) {
          clearInterval(checkInterval);
          resolve(status);
          return;
        }
        
        // Si on dépasse le temps max, on considère qu'il n'y a pas d'onboarding
        // (pour éviter d'attendre indéfiniment)
        if (Date.now() - startTime >= MAX_WAIT_TIME) {
          clearInterval(checkInterval);
          // Si l'élément n'existe toujours pas après 3s, on considère qu'il n'y a pas d'onboarding
          resolve(false);
        }
      }, CHECK_INTERVAL);
    });
  }
  
  async function init() {
    // Attendre que le DOM soit prêt
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
      });
    }
    
    // Attendre que Memberstack charge les données
    const hasOnboarding = await waitForMemberstackData();
    
    // Si l'utilisateur n'a pas fait l'onboarding, rediriger
    if (hasOnboarding === false) {
      redirectToOnboarding();
    }
    // Si hasOnboarding === true, on continue normalement (pas de redirection)
  }
  
  // Démarrer la vérification
  init();
})();

