// Agilotext - Adaptation de la page onboarding pour utilisateurs existants
// ⚠️ À copier-coller dans un embed code Webflow sur la page /auth/setup
// Détecte si l'utilisateur vient du dashboard et adapte les textes

(function() {
  'use strict';
  
  // Vérifier si l'utilisateur vient du dashboard (utilisateur existant)
  const urlParams = new URLSearchParams(window.location.search);
  const isExistingUser = urlParams.get('existing') === 'true' || urlParams.get('from') === 'dashboard';
  
  if (!isExistingUser) {
    // Nouvel utilisateur, on garde les textes par défaut
    return;
  }
  
  // Utilisateur existant - Adapter les textes
  function adaptTextsForExistingUser() {
    // Attendre que le DOM soit prêt
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', adaptTextsForExistingUser, { once: true });
      return;
    }
    
    // Chercher le titre principal (h1 avec "Bienvenue")
    const headingH1 = document.querySelector('h1.heading-style-h2');
    if (headingH1) {
      // Remplacer "Bienvenue sur Agilotext" par un texte adapté
      const firstNameSpan = headingH1.querySelector('span[data-ms-member="first-name"]');
      const firstName = firstNameSpan ? firstNameSpan.textContent.trim() : '';
      
      if (firstName) {
        headingH1.innerHTML = `Améliorons votre expérience, <span data-ms-member="first-name">${firstName}</span>`;
      } else {
        headingH1.innerHTML = headingH1.innerHTML.replace('Bienvenue sur Agilotext', 'Améliorons votre expérience');
      }
    }
    
    // Chercher le sous-titre/description
    const descriptionDiv = document.querySelector('.max-width-small.align-center.text-align-center > div:not(.margin-bottom)');
    if (descriptionDiv && descriptionDiv.textContent.includes('Dites-nous l\'essentiel')) {
      descriptionDiv.innerHTML = 'Nous améliorons constamment Agilotext. Aidez-nous à mieux comprendre votre usage pour personnaliser votre expérience.';
    }
    
    // Chercher le h3 avec "Quel est votre usage principal"
    const headingH3 = document.querySelector('h3 strong');
    if (headingH3 && headingH3.textContent.includes('Quel est votre usage principal')) {
      const h3Parent = headingH3.closest('h3');
      if (h3Parent) {
        const firstNameInH3 = h3Parent.querySelector('span[data-ms-member="first-name"]');
        const firstName = firstNameInH3 ? firstNameInH3.textContent.trim() : '';
        
        if (firstName) {
          h3Parent.innerHTML = `<strong>Quel est votre usage principal, </strong><span data-ms-member="first-name">${firstName}</span><strong> ? </strong>*`;
        }
        // Sinon on garde le texte mais on peut le modifier si besoin
      }
    }
  }
  
  // Démarrer l'adaptation
  adaptTextsForExistingUser();
})();

