// Agilotext - Vérification onboarding (Script standalone)
// ⚠️ À copier-coller dans un embed code Webflow
// Fonctionne pour tous les plans (Free, Pro, Business)
// Vérifie si l'utilisateur a complété l'onboarding et redirige si nécessaire

(function() {
  'use strict';
  
  const ONBOARDING_URL = 'https://www.agilotext.com/auth/setup';
  const MAX_WAIT_TIME = 3000; // 3 secondes max pour attendre Memberstack
  const CHECK_INTERVAL = 100; // Vérifier toutes les 100ms
  const ONBOARDING_ELEMENT_ID = 'ms-onboarding-version';
  
  // Fonction pour vérifier le statut d'onboarding
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
  
  // Fonction de redirection
  function redirectToOnboarding() {
    // Redirection avec paramètre pour indiquer que c'est un utilisateur existant
    const url = new URL(ONBOARDING_URL);
    url.searchParams.set('from', 'dashboard');
    url.searchParams.set('existing', 'true');
    window.location.href = url.toString();
  }
  
  // Fonction principale d'initialisation
  function init() {
    const startTime = Date.now();
    
    const checkInterval = setInterval(() => {
      const status = checkOnboardingStatus();
      
      // Si on détecte que l'utilisateur n'a pas fait l'onboarding
      if (status === false) {
        clearInterval(checkInterval);
        redirectToOnboarding();
        return;
      }
      
      // Si l'onboarding est fait, on arrête la vérification
      if (status === true) {
        clearInterval(checkInterval);
        return;
      }
      
      // Si on dépasse le temps max et que l'élément n'existe toujours pas
      // On considère qu'il n'y a pas d'onboarding (sécurité)
      if (Date.now() - startTime >= MAX_WAIT_TIME) {
        clearInterval(checkInterval);
        // Vérifier une dernière fois
        const finalStatus = checkOnboardingStatus();
        if (finalStatus === false || finalStatus === null) {
          redirectToOnboarding();
        }
      }
    }, CHECK_INTERVAL);
  }
  
  // Démarrer la vérification dès que le DOM est prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    // DOM déjà chargé, démarrer immédiatement
    init();
  }
})();

