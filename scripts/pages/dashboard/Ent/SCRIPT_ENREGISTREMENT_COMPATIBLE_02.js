  let currentSessionMimeType = null;
  let currentSessionChunkSeq = 0;
  let backupDbPromise = null;
  let precheckConfirmedForSession = false;
  let activeDecisionPromise = null;

  const log = (...a) => { if (DBG) console.log('[rec]', ...a); };
  const warn = (...a) => { if (DBG) console.warn('[rec]', ...a); };
    }
  }

  function showActionBanner(opts) {
    const id = (opts && opts.id) || 'agilo-action-banner';
    const title = (opts && opts.title) || '';
    const message = (opts && opts.message) || '';
    const actions = (opts && opts.actions) || [];

    const existing = document.getElementById(id);
    if (existing) existing.remove();

    const box = document.createElement('div');
    box.id = id;
    Object.assign(box.style, {
      position: 'fixed',
      bottom: '16px',
      right: '16px',
      maxWidth: '460px',
      zIndex: '100001',
      background: '#1f2937',
      color: '#fff',
      borderRadius: '10px',
      padding: '12px',
      boxShadow: '0 10px 28px rgba(0,0,0,.28)',
      fontSize: '13px'
    });

    const titleEl = document.createElement('div');
    titleEl.style.fontWeight = '700';
    titleEl.style.marginBottom = '6px';
    titleEl.textContent = title;
    box.appendChild(titleEl);

    const msgEl = document.createElement('div');
    msgEl.style.lineHeight = '1.45';
    msgEl.style.whiteSpace = 'pre-line';
    msgEl.textContent = message;
    box.appendChild(msgEl);

    const actionsWrap = document.createElement('div');
    Object.assign(actionsWrap.style, {
      marginTop: '10px',
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap'
    });

    actions.forEach((action) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = action.label || 'Action';
      Object.assign(btn.style, {
        border: 'none',
        borderRadius: '6px',
        padding: '7px 10px',
        cursor: 'pointer',
        background: action.kind === 'secondary' ? '#4b5563' : '#0b7a35',
        color: '#fff',
        fontWeight: '600'
      });
      btn.addEventListener('click', () => {
        if (action.closeOnClick !== false) box.remove();
        try {
          if (typeof action.onClick === 'function') action.onClick();
        } catch (e) {
          warn('action banner callback failed:', e);
        }
      });
      actionsWrap.appendChild(btn);
    });

    if (actions.length > 0) box.appendChild(actionsWrap);
    document.body.appendChild(box);
    return box;
  }

  function askUserDecision(opts) {
    if (activeDecisionPromise) return activeDecisionPromise;

    const title = (opts && opts.title) || 'Confirmer';
    const message = (opts && opts.message) || '';
    const bullets = (opts && opts.bullets) || [];
    const confirmLabel = (opts && opts.confirmLabel) || 'Continuer';
    const cancelLabel = (opts && opts.cancelLabel) || 'Annuler';
    const rememberLabel = (opts && opts.rememberLabel) || '';

    activeDecisionPromise = new Promise((resolve) => {
      const overlay = document.createElement('div');
      Object.assign(overlay.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '100002',
        background: 'rgba(0,0,0,.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      });

      const modal = document.createElement('div');
      Object.assign(modal.style, {
        width: '100%',
        maxWidth: '560px',
        background: '#fff',
        borderRadius: '10px',
        padding: '16px',
        color: '#111827',
        boxShadow: '0 16px 40px rgba(0,0,0,.3)'
      });

      const titleEl = document.createElement('div');
      titleEl.textContent = title;
      Object.assign(titleEl.style, {
        fontWeight: '700',
        marginBottom: '8px',
        fontSize: '16px'
      });
      modal.appendChild(titleEl);

      if (message) {
        const msgEl = document.createElement('div');
        msgEl.textContent = message;
        Object.assign(msgEl.style, {
          marginBottom: bullets.length ? '8px' : '12px',
          lineHeight: '1.45'
        });
        modal.appendChild(msgEl);
      }

      if (bullets.length) {
        const ul = document.createElement('ul');
        Object.assign(ul.style, {
          margin: '0 0 12px 18px',
          padding: '0',
          lineHeight: '1.45'
        });
        bullets.forEach((line) => {
          const li = document.createElement('li');
          li.textContent = line;
          ul.appendChild(li);
        });
        modal.appendChild(ul);
      }

      let rememberCheckbox = null;
      if (rememberLabel) {
        const lbl = document.createElement('label');
        Object.assign(lbl.style, {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
          fontSize: '13px'
        });
        rememberCheckbox = document.createElement('input');
        rememberCheckbox.type = 'checkbox';
        lbl.appendChild(rememberCheckbox);
        const span = document.createElement('span');
        span.textContent = rememberLabel;
        lbl.appendChild(span);
        modal.appendChild(lbl);
      }

      const actions = document.createElement('div');
      Object.assign(actions.style, {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px'
      });

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.textContent = cancelLabel;
      Object.assign(cancelBtn.style, {
        border: 'none',
        borderRadius: '6px',
        padding: '8px 12px',
        background: '#d1d5db',
        cursor: 'pointer'
      });

      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.textContent = confirmLabel;
      Object.assign(confirmBtn.style, {
        border: 'none',
        borderRadius: '6px',
        padding: '8px 12px',
        background: '#0b7a35',
        color: '#fff',
        cursor: 'pointer',
        fontWeight: '600'
      });

      const close = (ok) => {
        document.removeEventListener('keydown', onKeyDown);
        overlay.remove();
        activeDecisionPromise = null;
        resolve({
          ok: !!ok,
          remember: !!(rememberCheckbox && rememberCheckbox.checked)
        });
      };

      const onKeyDown = (ev) => {
        if (ev.key === 'Escape') close(false);
      };

      document.addEventListener('keydown', onKeyDown);
      overlay.addEventListener('click', (ev) => {
        if (ev.target === overlay) close(false);
      });
      cancelBtn.addEventListener('click', () => close(false));
      confirmBtn.addEventListener('click', () => close(true));

      actions.appendChild(cancelBtn);
      actions.appendChild(confirmBtn);
      modal.appendChild(actions);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
    });
    return activeDecisionPromise;
  }

  async function ensurePrecheckBeforeStart(shareScreen) {
    if (precheckConfirmedForSession) return true;

    const bullets = [
      'Branchez le secteur pour eviter une mise en veille.',
      'Desactivez la mise en veille automatique de l ordinateur.',
      'Ne fermez pas le capot pendant lenregistrement.',
      'Gardez cet onglet ouvert au premier plan.'
    ];
    if (shareScreen) {
      bullets.push('Pour capter laudio externe: partagez un onglet Chrome et cochez "Partager laudio".');
    }

    const decision = await askUserDecision({
      title: 'Verification avant demarrage',
      message: 'Pour fiabiliser la capture, confirmez ces points:',
      bullets,
      confirmLabel: 'Demarrer',
      cancelLabel: 'Annuler',
      rememberLabel: 'Ne plus afficher ce controle pendant cette session'
    });

    if (!decision.ok) {
      showRuntimeNotice('Demarrage annule.', 'info', 2500);
      return false;
    }
    if (decision.remember) precheckConfirmedForSession = true;
    return true;
  }

  function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
      const remaining = Math.floor((MAX_RECORDING_MS / 1000) - elapsedTimeInSeconds);
      if (!warned5min && remaining === 300) {
        warned5min = true;
        alert("Il reste 5 minutes d'enregistrement.");
        showRuntimeNotice("Il reste 5 minutes d'enregistrement.", 'warn', 5000);
      }
      if (!warned1min && remaining === 60) {
        warned1min = true;
        alert("Il reste 1 minute d'enregistrement.");
        showRuntimeNotice("Il reste 1 minute d'enregistrement.", 'warn', 6000);
      }
    }
  }
      log('Microphone recovered');
    } catch (e) {
      err('microphone recovery failed:', e);
      alert('Le micro a ete perdu. Merci de relancer un enregistrement.');
      showRuntimeNotice('Le micro a ete perdu. Finalisation de securite en cours.', 'error', 7000);
      stopRecordingAndSubmitForm('mic-lost');
    }
  }
        mediaRecorder = new MediaRecorder(stream);
      } catch (e2) {
        err('MediaRecorder failed:', e2);
        alert('Votre navigateur ne supporte pas cet enregistrement audio.');
        showRuntimeNotice('Votre navigateur ne supporte pas cet enregistrement audio.', 'error', 7000);
        cleanupRecordingResources();
        cleanupUiAfterStop();
        stopInProgress = false;
        mediaRecorder.start();
      } catch (e2) {
        err('MediaRecorder.start() failed:', e2);
        alert("Impossible de demarrer l'enregistrement.");
        showRuntimeNotice("Impossible de demarrer l'enregistrement.", 'error', 7000);
        cleanupRecordingResources();
        cleanupUiAfterStop();
        stopInProgress = false;
    if (stopInProgress || finalizeInProgress) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Votre navigateur ne supporte pas l enregistrement audio.');
      showRuntimeNotice('Votre navigateur ne supporte pas l enregistrement audio.', 'error', 7000);
      return;
    }
    if (!supportsMediaRecorder()) {
      alert('MediaRecorder non supporte.');
      showRuntimeNotice('MediaRecorder non supporte.', 'error', 7000);
      return;
    }

    setupAudioContext();
    if (!destination || !destination.stream) {
      alert('WebAudio non disponible. Essayez Chrome ou Edge.');
      showRuntimeNotice('WebAudio non disponible. Essayez Chrome ou Edge.', 'error', 7000);
      await cleanupRecordingResources();
      return;
    }
    } catch (e) {
      err('getUserMedia failed:', e);
      if (errorMessage) errorMessage.style.display = 'block';
      alert("Impossible d acceder au microphone.");
      showRuntimeNotice("Impossible d'acceder au microphone.", 'error', 7000);
      await cleanupRecordingResources();
      return;
    }
        currentScreenStream = null;
        screenVideoTrack = null;
        if (errorMessage) errorMessage.style.display = 'block';
        alert('Partage d ecran annule ou refuse.');
        showRuntimeNotice('Partage d ecran annule ou refuse.', 'warn', 6000);
        await cleanupRecordingResources();
        return;
      }
        !!(currentScreenStream.getAudioTracks && currentScreenStream.getAudioTracks().length > 0);
      if (!hasSystemAudio) {
        if (isFirefox()) {
          alert(
            'Firefox ne supporte pas la capture audio systeme/onglet. Continuation en micro seul.'
          showRuntimeNotice(
            'Firefox ne capte pas laudio systeme/onglet. Continuation en micro seul.',
            'warn',
            7000
          );
          stopStreamTracks(currentScreenStream);
          currentScreenStream = null;
          screenVideoTrack = null;
          isSharingScreen = false;
        } else {
          alert('Selectionnez un onglet Chrome et cochez "Partager l audio de l onglet".');
          showRuntimeNotice(
            'Selectionnez un onglet Chrome et cochez "Partager laudio de longlet".',
            'warn',
            7000
          );
          showTabAudioHintOnce();
          await cleanupRecordingResources();
          return;
    startRecording(destination.stream);
  }

  async function recoverPendingSession(pendingSessionId, session, recovered) {
    const recoveredName = buildRecordingFileName(recovered.mimeType, 'RECOVERY');
    const recoveredFile = new File([recovered.blob], recoveredName, { type: recovered.mimeType });

    await attachFileAndSubmit(recoveredFile);
    downloadRecording(recovered.blob, recoveredName);

    await updateSessionMeta(pendingSessionId, {
      recoveredAt: Date.now(),
      recoveredBytes: recovered.blob.size,
      completed: true,
      interruptedReason: session.interruptedReason || 'recovered-after-interruption'
    });
    localStorage.removeItem(ACTIVE_SESSION_LS_KEY);
    showRuntimeNotice('Session interrompue recuperee.', 'success', 8000);
  }

  async function offerRecoveryFromPendingSession() {
    const pendingSessionId = localStorage.getItem(ACTIVE_SESSION_LS_KEY);
    if (!pendingSessionId) return;

    const recovered = await buildRecoveredBlob(pendingSessionId, session.mimeType || 'audio/webm');
    if (!recovered || !recovered.blob || recovered.blob.size < MIN_BLOB_BYTES) return;
    const sizeMb = (recovered.blob.size / (1024 * 1024)).toFixed(2);
    const chunks = recovered.chunkCount || 0;

    const confirmRecover = window.confirm(
      "Une session interrompue a ete detectee. Voulez-vous recuperer et envoyer l'enregistrement partiel ?"
    );
    if (!confirmRecover) return;

    const recoveredName = buildRecordingFileName(recovered.mimeType, 'RECOVERY');
    const recoveredFile = new File([recovered.blob], recoveredName, { type: recovered.mimeType });

    await attachFileAndSubmit(recoveredFile);
    downloadRecording(recovered.blob, recoveredName);

    await updateSessionMeta(pendingSessionId, {
      recoveredAt: Date.now(),
      recoveredBytes: recovered.blob.size,
      completed: true,
      interruptedReason: session.interruptedReason || 'recovered-after-interruption'
    showActionBanner({
      id: 'agilo-recovery-banner',
      title: 'Session interrompue detectee',
      message: `Une sauvegarde locale est disponible (${sizeMb} MB, ${chunks} segments).`,
      actions: [
        {
          label: 'Recuperer maintenant',
          onClick: async () => {
            try {
              await recoverPendingSession(pendingSessionId, session, recovered);
            } catch (e) {
              err('pending session recovery failed:', e);
              showRuntimeNotice('Echec de recuperation de la session.', 'error', 8000);
            }
          }
        },
        {
          label: 'Plus tard',
          kind: 'secondary',
          onClick: () => {
            showRuntimeNotice('La sauvegarde reste disponible localement.', 'info', 5000);
          }
        }
      ]
    });
    localStorage.removeItem(ACTIVE_SESSION_LS_KEY);
    showRuntimeNotice('Session interrompue recuperee.', 'success', 8000);
  }

  async function startFlow(shareScreen) {
    const ok = await ensurePrecheckBeforeStart(shareScreen);
    if (!ok) return;
    await initiateRecording(shareScreen);
  }

  if (startAudioButton) {
    startAudioButton.onclick = function () {
      if (isMobileDevice() || !supportsDisplayMedia()) initiateRecording(false);
      else if (isChromeLike()) initiateRecording(false);
    startAudioButton.onclick = async function () {
      if (isMobileDevice() || !supportsDisplayMedia()) await startFlow(false);
      else if (isChromeLike()) await startFlow(false);
      else if (startButton) startButton.click();
      else initiateRecording(false);
      else await startFlow(false);
    };
  }

  if (startSharingButton) {
    startSharingButton.onclick = function () {
    startSharingButton.onclick = async function () {
      if (isMobileDevice() || !supportsDisplayMedia()) {
        if (confirm('Le partage ecran est indisponible ici. Enregistrer le micro uniquement ?')) {
          initiateRecording(false);
        }
        const choice = await askUserDecision({
          title: 'Partage ecran indisponible',
          message: 'Cet appareil ne permet pas le partage ecran. Continuer en micro seul ?',
          confirmLabel: 'Oui, micro seul',
          cancelLabel: 'Annuler'
        });
        if (choice.ok) await startFlow(false);
      } else if (isFirefox()) {
        if (confirm('Firefox ne capte pas l audio systeme. Continuer en micro seul ?')) {
          initiateRecording(true);
        }
        const choice = await askUserDecision({
          title: 'Limitation Firefox',
          message: 'Firefox ne capte pas laudio systeme. Continuer en micro seul ?',
          confirmLabel: 'Continuer',
          cancelLabel: 'Annuler'
        });
        if (choice.ok) await startFlow(true);
      } else if (isChromeLike()) {
        initiateRecording(true);
        await startFlow(true);
      } else if (startButton) {
        startButton.click();
      } else {
        initiateRecording(true);
        await startFlow(true);
      }
    };
  }
        }
      } catch (e) {
        warn('pause/resume failed:', e);
        alert('La pause nest pas supportee sur ce navigateur.');
        showRuntimeNotice('La pause nest pas supportee sur ce navigateur.', 'warn', 5000);
        pauseButton.style.display = 'none';
      }
    };
  }

  if (startButton) {
    startButton.addEventListener('click', () => initiateRecording(false));
    startButton.addEventListener('click', async () => {
      await startFlow(false);
    });
  }

  const newErrorButton = document.getElementById('New-button_error');
  if (newErrorButton) {
    newErrorButton.addEventListener('click', function () {
    newErrorButton.addEventListener('click', async function () {
      if (errorMessage) errorMessage.style.display = 'none';
      if (startSharingButton) startSharingButton.click();
      else initiateRecording(true);
      else await startFlow(true);
    });
  }
