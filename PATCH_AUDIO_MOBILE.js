// ⭐ PATCH POUR MOBILE : Remplacez la section playBtn dans votre script
// 
// Remplacer cette partie :
//   playBtn?.addEventListener?.('click', async (e)=>{
//     e.preventDefault();
//     if (seekLocked) return;
//     try { audio.paused ? await audio.play() : audio.pause(); } catch {}
//   });
//
// Par ce code :

const playClick = async (e)=>{
  e.preventDefault();
  e.stopPropagation();
  if (seekLocked) return;
  
  try {
    if (audio.paused) {
      await audio.play();
    } else {
      audio.pause();
    }
  } catch (err) {
    log('Erreur lecture audio:', err);
    // Sur mobile, les erreurs sont fréquentes - on les log mais on ne bloque pas l'UI
    if (DEBUG && (err.name === 'NotAllowedError' || err.name === 'NotSupportedError')) {
      console.warn('[agilo:audio] Lecture bloquée:', err.message);
    }
  }
};

// ✅ CORRECTION MOBILE : Écouter click ET touchend
if (playBtn) {
  playBtn.addEventListener('click', playClick);
  // touchend est déclenché après le tap complet, meilleur que touchstart pour les boutons
  playBtn.addEventListener('touchend', playClick, { passive: false });
}


