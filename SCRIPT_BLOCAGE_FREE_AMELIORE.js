<script>
window.addEventListener('load', function() {
  
  // Fonction pour détecter l'édition (identique à votre logique)
  function getEdition() {
    const root = document.querySelector('#editorRoot');
    const qs = new URLSearchParams(location.search).get('edition');
    const html = document.documentElement.getAttribute('data-edition');
    const ls = localStorage.getItem('agilo:edition');
    const v = String(qs || root?.dataset.edition || html || ls || 'ent').trim().toLowerCase();
    if (/(^ent$|enterprise|entreprise|business|team|biz)/.test(v)) return 'ent';
    if (/^pro/.test(v)) return 'pro';
    if (/^free|gratuit/.test(v)) return 'free';
    return 'ent';
  }
  
  // Fonction pour bloquer le bouton relancer-compte-rendu pour les free
  function blockRelancerButtonForFree() {
    const edition = getEdition();
    
    // Si ce n'est pas free, ne rien faire
    if (edition !== 'free') return;
    
    const relancerBtn = document.querySelector('[data-action="relancer-compte-rendu"]');
    if (!relancerBtn) return;
    
    // Éviter de bloquer plusieurs fois
    if (relancerBtn.hasAttribute('data-free-blocked')) return;
    relancerBtn.setAttribute('data-free-blocked', 'true');
    
    // Désactiver le bouton (même apparence que save-transcript)
    relancerBtn.disabled = true;
    relancerBtn.setAttribute('aria-disabled', 'true');
    relancerBtn.setAttribute('data-plan-min', 'pro');
    relancerBtn.setAttribute('data-upgrade-reason', 'Régénération de compte-rendu');
    relancerBtn.style.opacity = '0.5';
    relancerBtn.style.cursor = 'not-allowed';
    
    // Gérer le clic pour afficher la pop-up AgiloGate (même comportement que save-transcript)
    relancerBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      // Utiliser AgiloGate pour afficher la pop-up d'upgrade
      if (typeof window.AgiloGate !== 'undefined' && window.AgiloGate.showUpgrade) {
        window.AgiloGate.showUpgrade('pro', 'Régénération de compte-rendu');
      } else {
        // Fallback si AgiloGate n'est pas disponible
        alert('🔒 Fonctionnalité Premium\n\nLa régénération de compte-rendu est disponible pour les plans Pro et Business.\n\nUpgradez votre compte pour accéder à cette fonctionnalité.');
      }
    }, { once: false }); // Permettre plusieurs clics
    
    // S'assurer que AgiloGate décore ce bouton (badge Pro)
    if (typeof window.AgiloGate !== 'undefined' && window.AgiloGate.decorate) {
      // Attendre un peu que le DOM soit prêt
      setTimeout(() => {
        window.AgiloGate.decorate();
      }, 500);
    }
  }

  // Attendre que le DOM soit entièrement chargé et que le token soit récupéré
  const checkTokenAvailability = setInterval(() => {
    if (typeof globalToken !== 'undefined' && globalToken) {
      clearInterval(checkTokenAvailability); // Arrêter la vérification une fois le token disponible
      
      const userEmailElement = document.querySelector('[name="memberEmail"]');
      if (!userEmailElement) {
        console.error("Élément d'email utilisateur non trouvé");
        return;
      }

      const userEmail = userEmailElement.value;
      const edition = getEdition(); // Utiliser la fonction pour détecter l'édition dynamiquement

      fetchNumberOfUploads(userEmail, globalToken, edition);
      
      // Bloquer le bouton relancer-compte-rendu pour les free
      blockRelancerButtonForFree();
      
    } else {
      console.log("Attente de la disponibilité du token global...");
    }
  }, 100); // Vérifier toutes les 100ms
  
  // Observer les changements dans le DOM pour bloquer le bouton s'il apparaît plus tard
  // (utile si le bouton est ajouté dynamiquement après le chargement)
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.addedNodes.length > 0) {
        // Vérifier si le bouton relancer-compte-rendu a été ajouté
        const relancerBtn = document.querySelector('[data-action="relancer-compte-rendu"]');
        if (relancerBtn && !relancerBtn.hasAttribute('data-free-blocked')) {
          blockRelancerButtonForFree();
        }
      }
    });
  });
  
  // Observer les changements dans le body
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Appeler aussi au chargement initial (au cas où le bouton existe déjà)
  setTimeout(() => {
    blockRelancerButtonForFree();
  }, 1000);

  function fetchNumberOfUploads(email, token, edition) {
    console.log(`Récupération du nombre d'uploads pour ${email}`);
    fetch(`https://api.agilotext.com/api/v1/getNumberOfUploadsForPeriod?username=${email}&token=${globalToken}&edition=${edition}`, {
      method: 'GET',
      headers: {'Accept': 'application/json'}
    })
    .then(response => response.json())
    .then(data => {
      if (data.status === "OK") {
        updateUploadsUI(data.numberOfUploads, data.dailyLimit);
      } else {
        console.error('Erreur API:', data.errorMessage);
      }
    })
    .catch(error => console.error("Erreur lors de la requête:", error));
  }

  function updateUploadsUI(numberOfUploads, dailyLimit) {
    const transcriptionCounterElement = document.querySelector('.transcriptioncounter');
    const progressBarFillElement = document.querySelector('.progressbarfill');
    if (!transcriptionCounterElement || !progressBarFillElement) {
      console.error("Éléments UI pour les uploads non trouvés");
      return;
    }
    transcriptionCounterElement.textContent = `${numberOfUploads} sur ${dailyLimit} transcriptions utilisées en 24 heures.`;
    const usagePercentage = Math.min((numberOfUploads / dailyLimit) * 100, 100);
    progressBarFillElement.style.width = `${usagePercentage}%`;
  }

});
</script>

