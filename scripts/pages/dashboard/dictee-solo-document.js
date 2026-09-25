/** Web dashboard document creation from approved Dictée solo text and its original WAV. */
(function (global) {
  "use strict";

  var state = {
    email: "", draftId: "", recording: false, saving: false, sending: false,
    audioCount: 0, storageError: "", segmentFailed: false, reviewConfirmed: false,
    submission: null, apiError: "", serverBlocked: false, cleanupWarning: false,
    ready: false, mounted: false
  };
  var root = null;
  var channel = null;

  function notifyOtherTabs() { if (channel) channel.postMessage("changed"); }

  function api() { return global.AgiloSoloAudio; }
  function usages() { return global.AgiloDicteeUsages; }
  function reviewKey(email, draftId) { return "agilotext:soloReview:" + email + ":" + draftId; }
  function saveReview(value) {
    try { global.localStorage.setItem(reviewKey(state.email, state.draftId), value); } catch (e) {}
  }
  function contractReady() { return global.AGILO_SOLO_DOCUMENT_CONTRACT_READY === true; }
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
      ".agilo-solo-document__button:focus-visible,.agilo-solo-document a:focus-visible,.agilo-solo-document input:focus-visible{outline:3px solid var(--agilo-primary,#174a96);outline-offset:3px;}" +
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
      ".agilo-solo-document__links a,.agilo-solo-document__links button{color:var(--agilo-primary,#174a96);text-decoration:underline;background:none;border:0;padding:0;font:inherit;cursor:pointer;}";
    document.head.appendChild(style);
  }

  function setStatus(message, error) {
    if (!root) return;
    var el = root.querySelector(".agilo-solo-document__status");
    el.textContent = message || "";
    el.classList.toggle("is-error", !!error);
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
    var pending = state.submission &&
      (state.submission.status === "uncertain" || state.submission.status === "pending");
    var done = state.submission && state.submission.status === "accepted";
    var selected = global.AgiloDicteeCarnetPicker && global.AgiloDicteeCarnetPicker.getSelected();
    var hasText = !!(textEl() && textEl().value.trim());
    root.classList.toggle("is-sending", state.sending);
    review.hidden = !state.segmentFailed;
    editorLink.hidden = !done;
    if (done) editorLink.href = editorUrl(state.submission.jobId, state.submission.edition);
    retry.hidden = !pending || !contractReady();
    btn.disabled = state.recording || state.saving || state.sending || pending || done ||
      !state.ready || !state.email || state.serverBlocked || !!state.storageError ||
      !state.audioCount || !hasText || !selected ||
      (state.segmentFailed && !state.reviewConfirmed) || !available();
    label.textContent = state.sending ? "Envoi en cours…" : "Générer le document";
    if (state.sending) setStatus("Envoi en cours…", false);
    else if (done && (state.cleanupWarning || state.audioCount > 0))
      setStatus("Reçu pour traitement. L’audio local est conservé ; vérifiez Mes fichiers avant d’effacer ce brouillon.", true);
    else if (done) setStatus("Reçu pour traitement. Le document sera disponible dans l’éditeur.", false);
    else if (pending) setStatus("Réponse incertaine. Vérifiez Mes fichiers avant de reprendre cet envoi.", true);
    else if (state.storageError) setStatus("Audio local indisponible. Le texte reste copiable ; la génération ne peut pas démarrer.", true);
    else if (state.saving) setStatus("Finalisation de la dictée…", false);
    else if (state.apiError) setStatus(state.apiError, true);
    else if (state.segmentFailed && !state.reviewConfirmed) setStatus("Une phrase n’a pas été transcrite. Corrigez le texte, puis confirmez sa relecture.", true);
    else if (!state.audioCount) setStatus("Dictez puis arrêtez pour joindre l’audio au document.", false);
    else if (!selected) setStatus("Choisissez un modèle pour générer le document.", false);
    else setStatus("Le texte corrigé et l’audio seront envoyés après votre clic.", false);
  }

  async function hydrate() {
    var email = usages() && usages().getEmail();
    email = String(email || "").trim().toLowerCase();
    if (!api()) return;
    if (!email) {
      state.email = "";
      state.draftId = "";
      state.audioCount = 0;
      state.submission = null;
      state.storageError = "";
      state.ready = false;
      update();
      return;
    }
    if (email !== state.email) {
      state.email = email;
      state.audioCount = 0;
      state.submission = null;
      state.storageError = "";
      state.apiError = "";
      state.segmentFailed = false;
      state.reviewConfirmed = false;
      state.serverBlocked = false;
      state.cleanupWarning = false;
      state.ready = false;
      try { state.draftId = api().getDraftId(email); }
      catch (e) { state.storageError = e.message || "storage_error"; update(); return; }
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
        api().getSubmission(expectedEmail, expectedDraft)
      ]);
      if (expectedEmail !== state.email || expectedDraft !== state.draftId) return;
      state.audioCount = pair[0].length;
      state.submission = pair[1];
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
    if (contractReady()) fd.append("requestId", snapshot.requestId);
    var response = await fetch("https://api.agilotext.com/api/v1/createTranscriptFromText", {
      method: "POST", body: fd
    });
    var data;
    try { data = await response.json(); }
    catch (e) { throw new Error("uncertain_response"); }
    if (!response.ok || !data || data.status !== "OK") {
      var err = new Error((data && data.errorMessage) || "api_rejected");
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
      if (e.certain || e.message === "invalid_token" || e.message === "audio_missing" ||
          e.message === "invalid_saved_wav") {
        await api().clearSubmission(snapshot.email, snapshot.draftId).catch(function () {});
        if (snapshot.email === state.email && snapshot.draftId === state.draftId) state.submission = null;
        notifyOtherTabs();
        state.storageError = e.message === "audio_missing" || e.message === "invalid_saved_wav" ? e.message : "";
        if (e.message === "invalid_token") state.apiError = "Session expirée. Reconnectez-vous puis réessayez.";
        else if (e.message === "quota_uploads_exceeded") state.apiError = "Limite d’envois atteinte. Consultez vos compteurs.";
        else if (e.message === "quota_minutes_exceeded") state.apiError = "Quota mensuel de dictée atteint. Consultez vos compteurs.";
        else if (e.message === "audio_too_long") state.apiError = "Cette dictée dépasse la durée autorisée. Conservez le texte et recommencez plus court.";
        else if (e.message === "account_not_allowed" || e.message === "subscription_required")
          { state.apiError = "Dictée solo et génération réservées aux offres Pro et Business/ENT."; state.serverBlocked = true; }
        else state.apiError = "Le document a été refusé. Vérifiez le modèle ou l’audio, puis réessayez.";
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

  async function reset() {
    if (state.recording || state.saving || state.sending) return;
    var existing = await api().getSubmission(state.email, state.draftId).catch(function () { return null; });
    if (existing && (existing.status === "pending" || existing.status === "uncertain")) {
      state.submission = existing;
      update();
      return;
    }
    if (!global.confirm("Effacer le texte et l’audio local de cette dictée solo ?")) return;
    try {
      await Promise.all([api().clearAudio(state.email, state.draftId),
        api().clearSubmission(state.email, state.draftId)]);
      try { global.localStorage.removeItem(reviewKey(state.email, state.draftId)); } catch (e) {}
      if (textEl()) textEl().value = "";
      if (usages()) usages().writeDraft(state.email, "");
      state.draftId = api().nextDraftId(state.email);
      state.audioCount = 0;
      state.submission = null;
      state.segmentFailed = false;
      state.reviewConfirmed = false;
      state.storageError = "";
      state.apiError = "";
      state.cleanupWarning = false;
      root.querySelector(".agilo-solo-document__review input").checked = false;
      notifyOtherTabs();
      update();
    } catch (e) {
      state.storageError = e.message || "storage_error";
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
      '<button type="button" class="agilo-solo-document__retry" hidden>Reprendre le même envoi</button></div>';
    var after = document.getElementById("agilo-carnet-after");
    var secondary = panel.querySelector(".dictee-secondary-actions");
    if (after && after.parentNode) after.parentNode.insertBefore(root, after.nextSibling);
    else if (secondary && secondary.parentNode) secondary.parentNode.insertBefore(root, secondary);
    else ta.parentNode.insertBefore(root, ta.nextSibling);
    root.querySelector(".agilo-solo-document__button").addEventListener("click", create);
    root.querySelector(".agilo-solo-document__retry").addEventListener("click", function () {
      if (state.submission && state.submission.status === "uncertain" && !state.sending) send(state.submission);
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
    available: available,
    contractReady: contractReady,
    canStart: function () {
      return state.ready && !state.serverBlocked && !state.saving && !state.sending &&
        !(state.submission && (state.submission.status === "pending" ||
          state.submission.status === "uncertain" || state.submission.status === "accepted"));
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
