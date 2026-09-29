/** Web dashboard document creation from approved Dictée solo text and its original WAV. */
(function (global) {
  "use strict";

  var state = {
    email: "", draftId: "", recording: false, saving: false, sending: false,
    audioCount: 0, storageError: "", segmentFailed: false, reviewConfirmed: false,
    submission: null, apiError: "", serverBlocked: false, cleanupWarning: false,
    ready: false, mounted: false, preparing: false,
    recoveryPending: false, recoveryResolved: false,
    unresolved: []
  };
  var root = null;
  var channel = null;
  var recoveryDialog = null;
  var dialogResolve = null;

  function notifyOtherTabs() { if (channel) channel.postMessage("changed"); }

  function api() { return global.AgiloSoloAudio; }
  function usages() { return global.AgiloDicteeUsages; }
  function reviewKey(email, draftId) { return "agilotext:soloReview:" + email + ":" + draftId; }
  function saveReview(value) {
    try { global.localStorage.setItem(reviewKey(state.email, state.draftId), value); } catch (e) {}
  }
  function contractReady() { return global.AGILO_SOLO_DOCUMENT_CONTRACT_READY === true; }
  function submissionError(error) {
    var code = error && error.message;
    var details = String((error && error.details) || "");
    if (code === "invalid_token") return "Session expirée. Reconnectez-vous puis réessayez.";
    if (code === "invalid_request") {
      return /promptId|modèle/i.test(details)
        ? "Le modèle choisi n’est plus accessible. Choisissez-en un autre, puis réessayez."
        : "La demande de document n’est pas compatible avec le serveur. Rechargez la page, puis réessayez.";
    }
    if (code === "invalid_audio" || code === "unsupported_audio_format" ||
        code === "invalid_saved_wav") return "L’audio de cette dictée est illisible. Conservez le texte et vérifiez l’enregistrement.";
    if (code === "audio_missing") return "L’audio local de cette dictée est introuvable. Le texte reste copiable.";
    if (code === "quota_uploads_exceeded") return "Limite d’envois atteinte. Consultez vos compteurs.";
    if (code === "quota_minutes_exceeded") return "Quota mensuel de dictée atteint. Consultez vos compteurs.";
    if (code === "audio_too_long") return "Cette dictée dépasse la durée autorisée. Conservez le texte et recommencez plus court.";
    if (code === "account_not_allowed" || code === "subscription_required")
      return "Dictée solo et génération réservées aux offres Pro et Business/ENT.";
    if (code === "idempotency_conflict")
      return "Cet envoi ne correspond plus au brouillon reçu par le serveur. Vérifiez Mes fichiers avant d’effacer ou de recommencer.";
    return "Le document n’a pas été créé. Vérifiez Mes fichiers, puis réessayez si aucun travail n’apparaît.";
  }
  function previewReady() {
    return global.AGILO_SOLO_DOCUMENT_PREVIEW === true && state.email === "bauerwebpro@gmail.com";
  }
  function available() {
    var U = usages();
    var paid = U && typeof U.soloTabAllowed === "function" && U.soloTabAllowed();
    return paid || contractReady() || previewReady();
  }
  function textEl() { return document.querySelector("[data-agilo-streaming-text]"); }
  function editorUrl(jobId, edition) {
    var tier = String(edition || global.edition || "").toLowerCase() === "pro" ? "premium" : "business";
    return "/app/" + tier + "/editor?jobId=" + encodeURIComponent(jobId) +
      "&edition=" + encodeURIComponent(String(edition || global.edition || "ent"));
  }

  function ensureCss() {
    if (document.getElementById("agilo-solo-document-css")) return;
    var style = document.createElement("style");
    style.id = "agilo-solo-document-css";
    style.textContent =
      ".agilo-solo-document{display:none;order:6;margin:1rem auto .3rem;width:min(100%,32rem);font-family:inherit;text-align:left;}" +
      ".is-carnet .agilo-solo-document:not([hidden]){display:block;}" +
      ".agilo-solo-document[hidden]{display:none!important;}" +
      ".agilo-solo-document__button{display:inline-flex;align-items:center;justify-content:center;gap:.55rem;width:100%;min-height:48px;border:1.5px solid var(--agilo-primary,#174a96);border-radius:10px;background:var(--agilo-primary,#174a96);color:#fff;font-family:inherit;font-size:.92rem;font-weight:600;line-height:1.3;cursor:pointer;padding:.7rem 1rem;}" +
      ".agilo-solo-document__button:hover:not(:disabled){filter:brightness(.91);}" +
      ".agilo-solo-document__button:disabled{opacity:.55;cursor:not-allowed;}" +
      ".agilo-solo-document button:focus-visible,.agilo-solo-document a:focus-visible,.agilo-solo-document input:focus-visible{outline:3px solid var(--agilo-primary,#174a96);outline-offset:3px;}" +
      ".agilo-solo-document__button svg{width:18px;height:18px;flex:none;}" +
      ".agilo-solo-document__icon svg{color:#fff;}" +
      ".agilo-solo-document__spinner{display:none;width:16px;height:16px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:agilo-solo-spin .75s linear infinite;}" +
      ".agilo-solo-document.is-sending .agilo-solo-document__spinner{display:inline-block;}" +
      ".agilo-solo-document.is-sending .agilo-solo-document__icon{display:none;}" +
      "@keyframes agilo-solo-spin{to{transform:rotate(360deg)}}" +
      "@media(prefers-reduced-motion:reduce){.agilo-solo-document__spinner{animation:none;border-style:dotted;}}" +
      ".agilo-solo-document__check{display:flex;align-items:flex-start;gap:.5rem;margin:.65rem 0;color:#404040;font-size:.82rem;line-height:1.4;cursor:pointer;}" +
      ".agilo-solo-document__check[hidden]{display:none!important;}" +
      ".agilo-solo-document__check input{margin:.13rem 0 0;accent-color:var(--agilo-primary,#174a96);}" +
      ".agilo-solo-document__status{min-height:1.1rem;margin:.5rem 0;color:#404040;font-size:.82rem;line-height:1.4;}" +
      ".agilo-solo-document__status.is-error{color:#b42318;}" +
      ".agilo-solo-document__links{display:flex;align-items:center;gap:.9rem;flex-wrap:wrap;font-size:.82rem;}" +
      ".agilo-solo-document__links a,.agilo-solo-document__links button{color:var(--agilo-primary,#174a96);text-decoration:underline;background:none;border:0;padding:0;font:inherit;cursor:pointer;}" +
      ".agilo-solo-recovery{box-sizing:border-box;border:0;border-radius:12px;padding:1.25rem;width:min(92vw,32rem);max-height:85vh;overflow:auto;box-shadow:0 14px 50px #0004;color:#222;font-family:inherit;}" +
      ".agilo-solo-recovery::backdrop{background:#0008;}" +
      ".agilo-solo-recovery h2{font-size:1.1rem;margin:0 0 .6rem;}" +
      ".agilo-solo-recovery p{font-size:.9rem;line-height:1.5;margin:.4rem 0 1rem;}" +
      ".agilo-solo-recovery__actions{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:1rem;}" +
      ".agilo-solo-recovery button,.agilo-solo-recovery a{font:inherit;font-size:.85rem;border-radius:7px;padding:.55rem .75rem;}" +
      ".agilo-solo-recovery button{border:1px solid #aaa;background:#fff;cursor:pointer;}" +
      ".agilo-solo-recovery button[data-choice=new]{background:var(--agilo-primary,#174a96);color:#fff;border-color:var(--agilo-primary,#174a96);}" +
      ".agilo-solo-recovery :focus-visible{outline:3px solid var(--agilo-primary,#174a96);outline-offset:2px;}" +
      ".agilo-solo-recovery [hidden]{display:none!important;}";
    document.head.appendChild(style);
  }

  function setStatus(message, error) {
    if (!root) return;
    var el = root.querySelector(".agilo-solo-document__status");
    el.textContent = message || "";
    el.classList.toggle("is-error", !!error);
  }

  function ensureRecoveryDialog() {
    if (recoveryDialog) return recoveryDialog;
    recoveryDialog = document.createElement("dialog");
    recoveryDialog.className = "agilo-solo-recovery";
    recoveryDialog.setAttribute("aria-labelledby", "agilo-solo-recovery-title");
    recoveryDialog.innerHTML =
      '<h2 id="agilo-solo-recovery-title">Brouillon de dictée solo</h2>' +
      '<p class="agilo-solo-recovery__message"></p>' +
      '<div class="agilo-solo-recovery__items"></div>' +
      '<a class="agilo-solo-recovery__files" target="_blank" rel="noopener">Vérifier Mes fichiers</a>' +
      '<div class="agilo-solo-recovery__actions">' +
      '<button type="button" data-choice="resume">Reprendre</button>' +
      '<button type="button" data-choice="new">Commencer une nouvelle dictée</button>' +
      '<button type="button" data-choice="cancel">Annuler</button></div>';
    recoveryDialog.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-choice]");
      if (button) recoveryDialog.close(button.dataset.choice);
    });
    recoveryDialog.addEventListener("close", function () {
      var resolve = dialogResolve;
      dialogResolve = null;
      if (resolve) resolve(recoveryDialog.returnValue || "cancel");
    });
    document.body.appendChild(recoveryDialog);
    return recoveryDialog;
  }

  function askRecovery(kind, submissions) {
    var dialog = ensureRecoveryDialog();
    if (dialog.open || dialogResolve) return Promise.resolve("cancel");
    var title = dialog.querySelector("h2");
    var message = dialog.querySelector(".agilo-solo-recovery__message");
    var resume = dialog.querySelector('[data-choice="resume"]');
    var fresh = dialog.querySelector('[data-choice="new"]');
    var files = dialog.querySelector(".agilo-solo-recovery__files");
    var items = dialog.querySelector(".agilo-solo-recovery__items");
    items.replaceChildren();
    files.href = usages().mesTranscriptsHref();
    files.hidden = kind === "unsent";
    resume.hidden = kind !== "unsent";
    fresh.hidden = kind === "history";
    title.textContent = kind === "history" ? "Envois précédents à vérifier" : "Une dictée précédente existe";
    message.textContent = kind === "unsent"
      ? submissions && !submissions.text && submissions.audioIds.length
        ? "Une prise audio existe, mais le texte est vide. Reprendre conserve l’audio ; commencer une nouvelle dictée l’efface."
        : "Reprendre conserve le texte et les prises audio. Commencer une nouvelle dictée efface ce brouillon non envoyé."
      : kind === "accepted"
      ? "Le document précédent reste dans Mes fichiers. Voulez-vous commencer une nouvelle dictée ?"
      : kind === "history"
      ? "Vérifiez Mes fichiers avant de reprendre un envoi dont la réponse était incertaine."
      : "L’envoi précédent peut encore être traité. Vérifiez Mes fichiers ; une nouvelle dictée conservera cet envoi à vérifier.";
    if (kind === "history") {
      (submissions || []).forEach(function (submission) {
        var row = document.createElement("div");
        var stamp = new Date(submission.createdAt || 0).toLocaleString("fr-FR");
        if (submission.status === "conflict") {
          row.textContent = "Envoi du " + stamp + " : à vérifier dans Mes fichiers.";
        } else {
          var button = document.createElement("button");
          button.type = "button";
          button.textContent = "Reprendre l’envoi du " + stamp;
          button.addEventListener("click", function () {
            state.previousToRetry = submission;
            dialog.close("retry");
          });
          row.appendChild(button);
        }
        items.appendChild(row);
      });
    }
    return new Promise(function (resolve) {
      dialogResolve = resolve;
      dialog.returnValue = "cancel";
      try {
        dialog.showModal();
        dialog.querySelector('[data-choice="cancel"]').focus();
      } catch (e) {
        dialogResolve = null;
        resolve("unavailable");
      }
    });
  }

  function update() {
    if (!root) return;
    var solo = usages() && usages().getUsage() === "carnet";
    root.hidden = !solo;
    if (!solo) return;
    var btn = root.querySelector(".agilo-solo-document__button");
    var label = root.querySelector(".agilo-solo-document__label");
    var review = root.querySelector(".agilo-solo-document__review");
    var editorLink = root.querySelector(".agilo-solo-document__editor");
    var retry = root.querySelector(".agilo-solo-document__retry");
    var previous = root.querySelector(".agilo-solo-document__previous");
    var pending = state.submission &&
      (state.submission.status === "uncertain" || state.submission.status === "pending");
    var conflict = state.submission && state.submission.status === "conflict";
    var done = state.submission && state.submission.status === "accepted";
    var selected = global.AgiloDicteeCarnetPicker && global.AgiloDicteeCarnetPicker.getSelected();
    var hasText = !!(textEl() && textEl().value.trim());
    root.classList.toggle("is-sending", state.sending);
    review.hidden = !state.segmentFailed;
    editorLink.hidden = !done;
    if (done) editorLink.href = editorUrl(state.submission.jobId, state.submission.edition);
    retry.hidden = !pending || state.sending;
    previous.hidden = !state.unresolved.length;
    previous.disabled = state.preparing || state.sending;
    previous.textContent = state.unresolved.length > 1
      ? state.unresolved.length + " envois précédents à vérifier" : "Envoi précédent à vérifier";
    var recoverable = state.recoveryPending && !state.submission;
    btn.disabled = state.recording || state.saving || state.sending || state.preparing || pending || conflict || done ||
      !state.ready || !state.email || state.serverBlocked || !!state.storageError ||
      (!recoverable && (!state.audioCount || !hasText || !selected)) ||
      (state.segmentFailed && !state.reviewConfirmed) || !available();
    label.textContent = state.sending ? "Envoi en cours…" : "Générer le document";
    if (state.sending) setStatus("Envoi en cours…", false);
    else if (state.apiError) setStatus(state.apiError, true);
    else if (state.recoveryPending && !state.submission)
      setStatus("Un brouillon précédent est disponible. Démarrez ou choisissez Générer pour le reprendre ou recommencer.", false);
    else if (done && (state.cleanupWarning || state.audioCount > 0))
      setStatus("Reçu pour traitement. L’audio local est conservé ; vérifiez Mes fichiers avant d’effacer ce brouillon.", true);
    else if (done) setStatus("Reçu pour traitement. Le document sera disponible dans l’éditeur.", false);
    else if (conflict) setStatus(state.apiError || submissionError({ message: "idempotency_conflict" }), true);
    else if (pending) setStatus("Réponse incertaine. Vérifiez Mes fichiers avant de reprendre cet envoi.", true);
    else if (state.storageError) setStatus("Audio local indisponible. Le texte reste copiable ; la génération ne peut pas démarrer.", true);
    else if (state.saving) setStatus("Finalisation de la dictée…", false);
    else if (state.segmentFailed && !state.reviewConfirmed) setStatus("Une phrase n’a pas été transcrite. Corrigez le texte, puis confirmez sa relecture.", true);
    else if (!state.audioCount) setStatus("Dictez puis arrêtez pour joindre l’audio au document.", false);
    else if (!hasText) setStatus("Ajoutez ou dictez du texte avant de générer le document.", false);
    else if (!selected) setStatus("Choisissez un modèle pour générer le document.", false);
    else setStatus("Le texte corrigé et l’audio seront envoyés après votre clic.", false);
  }

  async function hydrate() {
    var email = usages() && usages().getEmail();
    email = String(email || "").trim().toLowerCase();
    if (!api()) return;
    if (!email) {
      if (usages() && usages().holdDraft) usages().holdDraft("");
      state.email = "";
      state.draftId = "";
      state.audioCount = 0;
      state.submission = null;
      state.unresolved = [];
      state.recoveryPending = false;
      state.recoveryResolved = false;
      state.storageError = "";
      state.ready = false;
      update();
      return;
    }
    var storedDraftId;
    try { storedDraftId = api().getDraftId(email); }
    catch (e) { state.storageError = e.message || "storage_error"; state.ready = false; update(); return; }
    if (email !== state.email || storedDraftId !== state.draftId) {
      if (usages() && usages().holdDraft) usages().holdDraft(email);
      state.email = email;
      state.audioCount = 0;
      state.submission = null;
      state.unresolved = [];
      state.storageError = "";
      state.apiError = "";
      state.segmentFailed = false;
      state.reviewConfirmed = false;
      state.serverBlocked = false;
      state.cleanupWarning = false;
      state.ready = false;
      state.draftId = storedDraftId;
      state.recoveryPending = false;
      state.recoveryResolved = false;
      var pref = false;
      try { pref = global.localStorage.getItem("agilotext:soloOpenEditor:" + email) === "1"; } catch (e) {}
      root.querySelector(".agilo-solo-document__open input").checked = pref;
      var review = "";
      try { review = global.localStorage.getItem(reviewKey(email, state.draftId)) || ""; } catch (e) {}
      state.segmentFailed = review === "failed" || review === "reviewed";
      state.reviewConfirmed = review === "reviewed";
      root.querySelector(".agilo-solo-document__review input").checked = state.reviewConfirmed;
    }
    var expectedEmail = state.email;
    var expectedDraft = state.draftId;
    try {
      var pair = await Promise.all([
        api().listSessions(expectedEmail, expectedDraft),
        api().getSubmission(expectedEmail, expectedDraft),
        api().listUnresolvedSubmissions(expectedEmail)
      ]);
      if (expectedEmail !== state.email || expectedDraft !== state.draftId) return;
      state.audioCount = pair[0].length;
      state.submission = pair[1];
      state.unresolved = pair[2].filter(function (item) { return item.draftId !== expectedDraft; });
      if (!state.recoveryResolved) {
        state.recoveryPending = !!(usages().readDraft(expectedEmail) || state.audioCount || state.submission);
        if (!state.recoveryPending) {
          state.recoveryResolved = true;
          usages().unlockDraft(expectedEmail, "");
        }
      }
      state.cleanupWarning = !!(pair[1] && pair[1].status === "accepted" && pair[0].length);
      state.storageError = "";
      state.ready = true;
    } catch (e) {
      state.storageError = e.message || "storage_error";
      state.ready = false;
    }
    update();
  }

  async function saveStoppedAudio(opts) {
    if (!api()) throw new Error("storage_unavailable");
    state.saving = true;
    update();
    try {
      await api().saveSession(opts);
      state.storageError = "";
      if (opts.email === state.email && opts.draftId === state.draftId) state.audioCount += 1;
      notifyOtherTabs();
    } catch (e) {
      state.storageError = e.message || "storage_error";
      throw e;
    } finally {
      state.saving = false;
      update();
    }
  }

  async function postFrozen(snapshot, wav) {
    var tokenOk = false;
    try {
      tokenOk = typeof global.ensureValidToken === "function" &&
        await global.ensureValidToken(snapshot.email, true);
    } catch (e) { tokenOk = false; }
    if (!tokenOk || !global.globalToken) {
      throw new Error("invalid_token");
    }
    var fd = new FormData();
    fd.append("username", snapshot.email);
    fd.append("token", global.globalToken);
    fd.append("edition", snapshot.edition);
    fd.append("transcriptContent", snapshot.text);
    fd.append("audio", new File([wav], "dictee-solo.wav", { type: "audio/wav" }));
    fd.append("promptId", String(snapshot.promptId));
    fd.append("requestId", snapshot.requestId);
    var response = await fetch("https://api.agilotext.com/api/v1/createTranscriptFromText", {
      method: "POST", body: fd
    });
    var data;
    try { data = await response.json(); }
    catch (e) { throw new Error("uncertain_response"); }
    if (!response.ok || !data || data.status !== "OK") {
      var err = new Error((data && data.errorMessage) || "api_rejected");
      err.details = data && data.errorDetails;
      err.httpStatus = response.status;
      err.certain = response.status >= 400 && response.status < 500 && response.status !== 408;
      throw err;
    }
    if (!/^\d+$/.test(String(data.jobId || ""))) throw new Error("uncertain_response");
    return String(data.jobId);
  }

  async function send(snapshot) {
    if (state.sending) return;
    state.sending = true;
    update();
    try {
      var wav = await api().buildWav(snapshot.email, snapshot.draftId, snapshot.audioSessionIds);
      var jobId = await postFrozen(snapshot, wav);
      var accepted = Object.assign({}, snapshot, { status: "accepted", jobId: jobId });
      var journalPersisted = true;
      try { await api().saveSubmission(snapshot.email, snapshot.draftId, accepted); }
      catch (e) { journalPersisted = false; console.warn("[Agilotext] document journal", e); }
      if (snapshot.email === state.email && snapshot.draftId === state.draftId) state.submission = accepted;
      state.apiError = "";
      state.cleanupWarning = !journalPersisted;
      if (journalPersisted) {
        try {
          await api().clearAudio(snapshot.email, snapshot.draftId, snapshot.audioSessionIds);
          if (snapshot.email === state.email && snapshot.draftId === state.draftId) state.audioCount = 0;
        } catch (e) { state.cleanupWarning = true; console.warn("[Agilotext] audio cleanup", e); }
      }
      try { global.localStorage.removeItem(reviewKey(snapshot.email, snapshot.draftId)); } catch (e) {}
      notifyOtherTabs();
      document.dispatchEvent(new CustomEvent("agilo-solo-document-accepted", { detail: { jobId: jobId } }));
      if (snapshot.openEditor) {
        try { global.open(editorUrl(jobId, snapshot.edition), "_blank", "noopener"); } catch (e) {}
      }
    } catch (e) {
      if (e.message === "idempotency_conflict") {
        var conflict = Object.assign({}, snapshot, { status: "conflict" });
        await api().saveSubmission(snapshot.email, snapshot.draftId, conflict).catch(function () {});
        if (snapshot.email === state.email && snapshot.draftId === state.draftId) state.submission = conflict;
        state.apiError = submissionError(e);
        notifyOtherTabs();
      } else if (e.certain || e.message === "invalid_token" || e.message === "audio_missing" ||
          e.message === "invalid_saved_wav") {
        await api().clearSubmission(snapshot.email, snapshot.draftId).catch(function () {});
        if (snapshot.email === state.email && snapshot.draftId === state.draftId) state.submission = null;
        notifyOtherTabs();
        state.storageError = e.message === "audio_missing" || e.message === "invalid_saved_wav" ? e.message : "";
        state.apiError = submissionError(e);
        if (e.message === "account_not_allowed" || e.message === "subscription_required") state.serverBlocked = true;
      } else {
        var uncertain = Object.assign({}, snapshot, { status: "uncertain" });
        await api().saveSubmission(snapshot.email, snapshot.draftId, uncertain).catch(function () {});
        if (snapshot.email === state.email && snapshot.draftId === state.draftId) state.submission = uncertain;
        notifyOtherTabs();
      }
    } finally {
      state.sending = false;
      update();
    }
  }

  async function create() {
    if (state.recoveryPending && !state.submission) {
      await resolveRecovery("generate");
      return;
    }
    if (!root || root.querySelector(".agilo-solo-document__button").disabled) return;
    var model = global.AgiloDicteeCarnetPicker && global.AgiloDicteeCarnetPicker.getSelected();
    var ta = textEl();
    if (!model || !ta || !state.email || !state.draftId || !available()) return;
    var email = state.email, draftId = state.draftId;
    state.saving = true;
    update();
    try {
      var sessions = await api().listSessions(email, draftId);
      if (!sessions.length) throw new Error("audio_missing");
      var snapshot = {
        email: email, draftId: draftId,
        edition: String(global.edition || "ent"),
        requestId: api().newId(), text: ta.value.trim(), promptId: model.id,
        audioSessionIds: sessions.map(function (s) { return s.id; }),
        openEditor: root.querySelector(".agilo-solo-document__open input").checked,
        status: "pending", createdAt: Date.now()
      };
      await api().reserveSubmission(email, draftId, snapshot);
      state.submission = snapshot;
      state.apiError = "";
      state.cleanupWarning = false;
      state.saving = false;
      notifyOtherTabs();
      update();
      await send(snapshot);
    } catch (e) {
      if (e.name === "ConstraintError") {
        state.apiError = "Ce brouillon est déjà en cours d’envoi dans un autre onglet.";
        await hydrate();
      } else {
        state.storageError = e.message || "storage_error";
      }
      state.saving = false;
      update();
    }
  }

  async function readDraftSnapshot(email, draftId) {
    var pair = await Promise.all([
      api().listSessions(email, draftId), api().getSubmission(email, draftId)
    ]);
    return {
      email: email, draftId: draftId, text: usages().readDraft(email),
      audioIds: pair[0].map(function (item) { return item.id; }), submission: pair[1]
    };
  }

  function sameSnapshot(first, second) {
    return first && second && first.email === second.email && first.draftId === second.draftId &&
      first.text === second.text && first.audioIds.join("|") === second.audioIds.join("|") &&
      String(first.submission && first.submission.status || "") === String(second.submission && second.submission.status || "") &&
      String(first.submission && first.submission.requestId || "") === String(second.submission && second.submission.requestId || "");
  }

  async function resolveRecovery(intent) {
    if (state.preparing || state.sending || state.saving || state.recording) return false;
    state.preparing = true;
    update();
    try {
      if (!state.ready) await hydrate();
      if (!state.ready || !state.email || !state.draftId || state.storageError) {
        state.apiError = "Brouillon local indisponible. Rechargez la page avant de réessayer.";
        return false;
      }
      if (state.recoveryResolved && usages().isDraftReady && usages().isDraftReady())
        usages().persistDraftFromTextarea();
      var original = await readDraftSnapshot(state.email, state.draftId);
      var textMissingWithAudio = original.audioIds.length && !(textEl() && textEl().value.trim());
      var kind = original.submission
        ? original.submission.status === "accepted" ? "accepted" : "unresolved"
        : state.recoveryPending || textMissingWithAudio ? "unsent" : "none";
      if (kind === "none") return true;
      var choice = await askRecovery(kind, original);
      if (choice === "unavailable") {
        state.apiError = "La fenêtre de reprise ne s’ouvre pas dans ce navigateur. Rechargez la page avant de réessayer.";
        return false;
      }
      if (choice === "cancel") return false;
      var currentId = api().getDraftId(original.email);
      var current = currentId === original.draftId
        ? await readDraftSnapshot(original.email, original.draftId) : null;
      if (state.email !== original.email || usages().getEmail() !== original.email ||
          state.draftId !== original.draftId ||
          !sameSnapshot(original, current)) {
        state.apiError = "Ce brouillon a changé dans un autre onglet. Rechargez la page avant de réessayer.";
        return false;
      }
      if (choice === "resume" && kind === "unsent") {
        state.recoveryPending = false;
        state.recoveryResolved = true;
        if (!usages().unlockDraft(original.email, original.text)) throw new Error("account_changed");
        state.apiError = "";
        return intent === "start";
      }
      if (choice !== "new") return false;
      var nextId = api().newId();
      if (api().getDraftId(original.email) !== original.draftId) {
        state.apiError = "Le brouillon a changé dans un autre onglet. Rechargez la page.";
        return false;
      }
      api().setDraftId(original.email, original.draftId, nextId);
      try {
        if (!usages().writeDraft(original.email, "")) throw new Error("draft_text_write_failed");
        if (kind === "unsent") await api().clearAudio(original.email, original.draftId);
      } catch (e) {
        if (api().getDraftId(original.email) === nextId) {
          api().setDraftId(original.email, nextId, original.draftId);
          usages().writeDraft(original.email, original.text);
        }
        throw e;
      }
      if (!usages().unlockDraft(original.email, "")) throw new Error("account_changed");
      state.draftId = nextId;
      state.audioCount = 0;
      state.submission = null;
      state.recoveryPending = false;
      state.recoveryResolved = true;
      state.segmentFailed = false;
      state.reviewConfirmed = false;
      state.apiError = "";
      state.cleanupWarning = false;
      root.querySelector(".agilo-solo-document__review input").checked = false;
      usages().setCarnetError("");
      notifyOtherTabs();
      await hydrate();
      return intent === "start";
    } catch (e) {
      state.apiError = "Impossible de préparer ce brouillon. Aucune nouvelle prise n’a démarré.";
      return false;
    } finally {
      state.preparing = false;
      update();
    }
  }

  async function openPrevious() {
    if (state.preparing || state.sending || !state.unresolved.length) return;
    try {
      var rows = await api().listUnresolvedSubmissions(state.email);
      state.previousToRetry = null;
      var choice = await askRecovery("history", rows);
      var previous = state.previousToRetry;
      state.previousToRetry = null;
      if (choice !== "retry" || !previous || previous.status === "conflict") return;
      var latest = await api().getSubmission(previous.email, previous.draftId);
      if (!latest || latest.requestId !== previous.requestId || latest.status !== previous.status) {
        state.apiError = "Cet envoi a changé. Vérifiez Mes fichiers avant de réessayer.";
        update();
        return;
      }
      await send(latest);
      await hydrate();
    } catch (e) {
      state.apiError = "Impossible de relire cet envoi local. Vérifiez Mes fichiers avant de réessayer.";
      update();
    }
  }

  function mount() {
    if (state.mounted) return;
    var panel = document.getElementById("panel-dictee");
    var ta = panel && panel.querySelector("[data-agilo-streaming-text]");
    if (!ta) return;
    ensureCss();
    root = document.createElement("section");
    root.id = "agilo-solo-document";
    root.className = "agilo-solo-document";
    root.hidden = true;
    root.innerHTML =
      '<button type="button" class="agilo-solo-document__button" disabled>' +
      '<span class="agilo-solo-document__icon" aria-hidden="true">' + usages().nucleoSvg("sparkle") + '</span>' +
      '<span class="agilo-solo-document__spinner" aria-hidden="true"></span>' +
      '<span class="agilo-solo-document__label">Générer le document</span></button>' +
      '<label class="agilo-solo-document__check agilo-solo-document__open"><input type="checkbox">Ouvrir l’éditeur Agilotext après l’envoi</label>' +
      '<label class="agilo-solo-document__check agilo-solo-document__review" hidden><input type="checkbox">J’ai corrigé les passages manquants dans le texte</label>' +
      '<p class="agilo-solo-document__status" role="status" aria-live="polite"></p>' +
      '<div class="agilo-solo-document__links">' +
      '<a class="agilo-solo-document__editor" hidden>Ouvrir ce document</a>' +
      '<button type="button" class="agilo-solo-document__retry" hidden>Reprendre le même envoi</button>' +
      '<button type="button" class="agilo-solo-document__previous" hidden>Envoi précédent à vérifier</button></div>';
    var after = document.getElementById("agilo-carnet-after");
    var secondary = panel.querySelector(".dictee-secondary-actions");
    if (after && after.parentNode) after.parentNode.insertBefore(root, after.nextSibling);
    else if (secondary && secondary.parentNode) secondary.parentNode.insertBefore(root, secondary);
    else ta.parentNode.insertBefore(root, ta.nextSibling);
    root.querySelector(".agilo-solo-document__button").addEventListener("click", create);
    root.querySelector(".agilo-solo-document__previous").addEventListener("click", openPrevious);
    root.querySelector(".agilo-solo-document__retry").addEventListener("click", function () {
      if (state.submission && (state.submission.status === "uncertain" ||
          state.submission.status === "pending") && !state.sending) send(state.submission);
    });
    root.querySelector(".agilo-solo-document__review input").addEventListener("change", function (e) {
      state.reviewConfirmed = e.target.checked;
      saveReview(state.reviewConfirmed ? "reviewed" : "failed");
      update();
    });
    root.querySelector(".agilo-solo-document__open input").addEventListener("change", function (e) {
      try { global.localStorage.setItem("agilotext:soloOpenEditor:" + state.email, e.target.checked ? "1" : "0"); } catch (err) {}
    });
    ta.addEventListener("input", update);
    document.addEventListener("agilo-dictee-usage-change", update);
    document.addEventListener("agilo-dictee-voice-status", function (e) {
      var status = e.detail && e.detail.status;
      state.recording = status !== "idle";
      update();
    });
    document.addEventListener("agilo-carnet-segment-failed", function (event) {
      state.segmentFailed = true; state.reviewConfirmed = false;
      var code = event.detail && event.detail.errorCode;
      if (code === "account_not_allowed" || code === "subscription_required") {
        state.serverBlocked = true;
        state.apiError = "Dictée solo n’est pas activée pour ce compte.";
      } else if (code === "quota_minutes_exceeded") {
        state.apiError = "Quota mensuel de dictée atteint. Consultez vos compteurs.";
      }
      saveReview("failed");
      root.querySelector(".agilo-solo-document__review input").checked = false;
      update();
    });
    document.addEventListener("agilo-carnet-picker-change", update);
    document.addEventListener("agilo-dictee-account-ready", hydrate);
    global.addEventListener("focus", hydrate);
    global.addEventListener("storage", hydrate);
    if (global.BroadcastChannel) {
      channel = new BroadcastChannel("agilo-dictee-solo");
      channel.onmessage = hydrate;
    }
    state.mounted = true;
    hydrate();
  }

  global.AgiloDicteeSoloDocument = {
    mount: mount,
    hydrate: hydrate,
    update: update,
    saveStoppedAudio: saveStoppedAudio,
    prepareStart: function () {
      if (state.ready && state.recoveryResolved && !state.recoveryPending && !state.submission &&
          !(state.audioCount && !(textEl() && textEl().value.trim())) &&
          !state.preparing && !state.saving && !state.sending) return true;
      return resolveRecovery("start");
    },
    available: available,
    contractReady: contractReady,
    canStart: function () {
      return state.ready && !state.serverBlocked && !state.saving && !state.sending &&
        !state.preparing && !state.recoveryPending &&
        !(state.submission && (state.submission.status === "pending" ||
          state.submission.status === "uncertain" || state.submission.status === "conflict" ||
          state.submission.status === "accepted"));
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
