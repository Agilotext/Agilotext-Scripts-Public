/* Independent per-interview preparation sheet. Generic code only.
   Load after the dashboard/editor credentials script with:
   window.AGILO_TRANSCRIPT_PREP = { enabled: true, apiBase: 'https://API/api/v1' }.
   The server owns the model configuration, evidence checks and zero-credit pilot gate. */
(function () {
  'use strict';
  const config = window.AGILO_TRANSCRIPT_PREP || {};
  if (!config.enabled || !config.apiBase || window.__agiloTranscriptPreparationV2) return;
  window.__agiloTranscriptPreparationV2 = true;
  const base = String(config.apiBase).replace(/\/+$/, '');
  const common = [
    'Ambiance générale de travail dans l’établissement', 'Organisation du travail',
    'Charge de travail', 'Ambiance dans le service restauration',
    'Ambiance dans le service général', 'Conflits entre des collègues',
    'Comportements, propos inappropriés', 'Relation avec l’encadrant',
    'Relations avec l’Autorité fonctionnelle'
  ];
  let view = null;

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function field(parent, text, input) {
    const label = el('label', 'agilo-tprep-field');
    label.append(el('span', '', text), input);
    parent.append(label);
    return label;
  }
  function edition() {
    const tier = location.pathname.match(/^\/app\/([^/]+)/)?.[1];
    return tier === 'free' ? 'free' : tier === 'pro' || tier === 'premium' ? 'pro' : 'ent';
  }
  async function auth() {
    const creds = window.__agiloEditorCreds;
    if (creds?.pickEmail && creds?.pickToken) {
      const username = creds.pickEmail();
      const tier = creds.pickEdition();
      const token = creds.pickToken(tier, username);
      if (username && token) return { username, token, edition: tier };
    }
    const member = document.querySelector('[name="memberEmail"]');
    const username = String(member?.value || member?.getAttribute('src') || member?.textContent || '').trim();
    if (!username) throw new Error('Compte introuvable. Recharge la page.');
    if (!window.globalToken && typeof window.getToken === 'function') {
      await window.getToken(username, edition(), true);
    }
    if (!window.globalToken) throw new Error('Session expirée. Recharge la page.');
    return { username, token: String(window.globalToken), edition: edition() };
  }
  async function request(action, jobId, values, download) {
    const identity = await auth();
    const body = new URLSearchParams({ ...identity, action, jobId: String(jobId), ...(values || {}) });
    const response = await fetch(base + '/transcriptPreparation', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body, cache: 'no-store', credentials: 'omit'
    });
    if (download && response.ok) return response.blob();
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.status === 'KO') throw new Error(result.message || 'La demande a échoué.');
    return result;
  }
  function message(text, error) {
    if (!view) return;
    view.message.textContent = text;
    view.message.classList.toggle('agilo-tprep-error', !!error);
  }
  function close() {
    if (!view) return;
    const trigger = view.trigger;
    view.closed = true;
    view.backdrop.remove();
    view = null;
    trigger.focus();
  }
  function specificQuestions() {
    return [...view.questions.querySelectorAll('.agilo-tprep-question')].map(row => ({
      title: row.querySelector('[data-title]').value.trim(),
      subject: row.querySelector('[data-subject]').value.trim(),
      context: row.querySelector('[data-context]').value.trim()
    }));
  }
  function questionRow(question) {
    const row = el('div', 'agilo-tprep-question');
    const title = el('input'); title.type = 'text'; title.maxLength = 120;
    title.dataset.title = ''; title.value = question?.title || '';
    field(row, 'Intitulé de la question', title);
    const subject = el('input'); subject.type = 'text'; subject.maxLength = 120;
    subject.dataset.subject = ''; subject.value = question?.subject || '';
    field(row, 'Personne ou sujet visé', subject);
    const context = el('textarea'); context.rows = 2; context.maxLength = 1000;
    context.dataset.context = ''; context.value = question?.context || '';
    field(row, 'Précision pour cette enquête', context);
    const buttons = el('div', 'agilo-tprep-question-actions');
    for (const [label, direction] of [['Monter', -1], ['Descendre', 1]]) {
      const button = el('button', '', label); button.type = 'button';
      button.addEventListener('click', () => {
        const sibling = direction < 0 ? row.previousElementSibling : row.nextElementSibling;
        if (!sibling) return;
        if (direction < 0) sibling.before(row); else sibling.after(row);
        markDirty();
      });
      buttons.append(button);
    }
    const remove = el('button', '', 'Retirer'); remove.type = 'button';
    remove.addEventListener('click', () => { row.remove(); markDirty(); });
    buttons.append(remove); row.append(buttons);
    row.addEventListener('input', markDirty);
    return row;
  }
  function markDirty() {
    if (!view) return;
    view.dirty = true;
    view.sha = ''; view.modelHash = '';
    view.generate.disabled = true;
    message('Enregistre ces questions sous un nouveau modèle, puis examine la transcription.');
  }
  function selectProfile(profile) {
    if (!view) return;
    view.profile = profile || null;
    view.dirty = false; view.sha = ''; view.modelHash = '';
    view.generate.disabled = true;
    view.questions.replaceChildren(...(profile?.specificQuestions || []).map(questionRow));
    view.name.value = profile ? profile.promptName + ' · copie' : '';
    message(profile ? 'Modèle chargé. Examine la transcription avant de générer.'
      : 'Crée un modèle pour préparer une fiche.');
  }
  async function loadProfiles(selectedId) {
    const result = await request('listProfiles', view.jobId);
    if (!view || view.closed) return;
    view.profiles = result.profiles || [];
    view.select.replaceChildren();
    const blank = el('option', '', 'Nouveau modèle'); blank.value = ''; view.select.append(blank);
    for (const profile of view.profiles) {
      const option = el('option', '', profile.promptName); option.value = String(profile.promptId);
      view.select.append(option);
    }
    const wanted = view.profiles.find(profile => String(profile.promptId) === String(selectedId));
    view.select.value = wanted ? String(wanted.promptId) : '';
    selectProfile(wanted);
  }
  function selectedProfile() {
    return view?.profiles.find(profile => String(profile.promptId) === view.select.value);
  }
  async function showHistory() {
    const current = view;
    const result = await request('list', current.jobId);
    if (!view || view !== current) return;
    current.history.replaceChildren();
    if (!result.generations?.length) {
      current.history.append(el('p', '', 'Aucune fiche produite pour ce travail.')); return;
    }
    for (const item of result.generations) {
      const row = el('div', 'agilo-tprep-history-row');
      row.append(el('span', '', (item.updatedAt || '') + ' · ' + item.status));
      if (item.status === 'QUEUED' || item.status === 'RUNNING') {
        const cancel = el('button', '', 'Annuler'); cancel.type = 'button';
        cancel.addEventListener('click', async () => {
          try {
            await request('cancel', current.jobId, { generationId: item.generationId });
            message('Génération annulée. Les documents existants sont conservés.');
            await showHistory();
          } catch (error) { message(error.message, true); }
        });
        row.append(cancel);
      }
      if (item.status === 'COMPLETED') {
        const button = el('button', '', 'Télécharger Word'); button.type = 'button';
        button.addEventListener('click', async () => {
          try {
            const blob = await request('download', current.jobId,
              { generationId: item.generationId }, true);
            const url = URL.createObjectURL(blob);
            const link = el('a'); link.href = url; link.download = 'fiche_preparation_entretien.docx';
            link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
          } catch (error) { message(error.message, true); }
        });
        row.append(button);
      }
      current.history.append(row);
    }
  }
  async function watch(generationId) {
    const current = view;
    for (let attempt = 0; attempt < 180 && view === current && !current.closed; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (view !== current || current.closed) return;
      const state = await request('status', current.jobId, { generationId });
      if (state.status === 'COMPLETED') {
        message('Fiche prête. Télécharge le Word dans l’historique.'); await showHistory(); return;
      }
      if (state.status === 'FAILED' || state.status === 'CANCELLED') {
        message('Fiche refusée ou annulée (' + (state.errorCode || state.status)
          + '). Le compte rendu existant est conservé.', true);
        await showHistory(); return;
      }
      message('Génération et contrôle de fidélité en cours…');
    }
    if (view === current) message('Le traitement continue. Son état reste dans cet historique.');
  }
  function open(jobId, trigger) {
    if (view) close();
    const backdrop = el('div', 'agilo-tprep-backdrop');
    backdrop.setAttribute('role', 'dialog'); backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-label', 'Fiche de préparation par entretien');
    const panel = el('div', 'agilo-tprep-panel'); backdrop.append(panel);
    const header = el('div', 'agilo-tprep-header');
    header.append(el('h2', '', 'Fiche de préparation par entretien'));
    const exit = el('button', '', 'Fermer'); exit.type = 'button'; exit.addEventListener('click', close);
    header.append(exit); panel.append(header);
    panel.append(el('p', '', 'La fiche part de la transcription corrigée et sauvegardée. Elle se télécharge à part ; le PV et le compte rendu restent inchangés.'));
    const select = el('select'); field(panel, 'Modèle de fiche', select);
    panel.append(el('h3', '', 'Rubriques communes aux enquêtes en lycée'));
    const fixed = el('ol', 'agilo-tprep-fixed');
    for (const title of common) fixed.append(el('li', '', title));
    panel.append(fixed, el('h3', '', 'Questions propres à cette enquête'));
    panel.append(el('p', '', 'Ces questions seront placées après « Comportements, propos inappropriés ». Tu peux changer leur ordre ci-dessous.'));
    const questions = el('div', 'agilo-tprep-questions'); panel.append(questions);
    const add = el('button', '', 'Ajouter une question'); add.type = 'button';
    add.addEventListener('click', () => { questions.append(questionRow(null)); markDirty(); });
    panel.append(add);
    const name = el('input'); name.type = 'text'; name.maxLength = 120;
    field(panel, 'Nom de la nouvelle copie du modèle', name);
    const save = el('button', 'agilo-tprep-secondary', 'Enregistrer sous'); save.type = 'button';
    panel.append(save);
    const preview = el('button', 'agilo-tprep-secondary', 'Examiner la transcription sauvegardée');
    preview.type = 'button'; panel.append(preview);
    const details = el('div', 'agilo-tprep-details'); panel.append(details);
    const speaker = el('select'); field(panel, 'Agent entendu', speaker);
    const generate = el('button', 'agilo-tprep-primary', 'Générer la fiche');
    generate.type = 'button'; generate.disabled = true; panel.append(generate);
    const state = el('p', 'agilo-tprep-status'); state.setAttribute('aria-live', 'polite');
    panel.append(state, el('h3', '', 'Fiches déjà produites'));
    const history = el('div', 'agilo-tprep-history'); panel.append(history);
    document.body.append(backdrop);
    view = { backdrop, trigger, jobId, select, profiles: [], profile: null, questions, name,
      generate, details, speaker, message: state, history, sha: '', modelHash: '', dirty: false, closed: false };
    exit.focus();
    backdrop.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });
    select.addEventListener('change', () => selectProfile(selectedProfile()));
    save.addEventListener('click', async () => {
      try {
        const title = name.value.trim();
        const questionsData = specificQuestions();
        if (!title || questionsData.some(q => !q.title)) {
          throw new Error('Indique un nom et un intitulé pour chaque question.');
        }
        save.disabled = true;
        const result = await request('saveProfile', jobId, {
          promptName: title, profileJson: JSON.stringify({ baseProfile: 'lycee', specificQuestions: questionsData })
        });
        await loadProfiles(result.promptId);
        message('Copie du modèle enregistrée. Examine la transcription avant de générer.');
      } catch (error) { message(error.message, true); }
      finally { if (view) save.disabled = false; }
    });
    preview.addEventListener('click', async () => {
      try {
        const profile = selectedProfile();
        if (!profile || view.dirty) throw new Error('Enregistre d’abord le modèle et ses questions.');
        preview.disabled = true;
        const result = await request('preview', jobId, { promptId: String(profile.promptId) });
        if (!view || view.closed) return;
        view.sha = result.sha256; view.modelHash = result.modelHash;
        generate.textContent = 'Générer la fiche · ' + String(result.creditCost || 0)
          + ' crédit' + (Number(result.creditCost || 0) > 1 ? 's' : '');
        details.replaceChildren();
        details.append(el('p', '', result.turnCount + ' passages · Empreinte SHA-256 : ' + result.sha256));
        details.append(el('p', '', 'Vérifie le locuteur et compare la fiche au PV consolidé.'));
        for (const turn of result.sampleTurns || []) {
          details.append(el('p', 'agilo-tprep-sample', turn.id + ' · ' + turn.speaker + ' : ' + turn.text));
        }
        speaker.replaceChildren();
        const blank = el('option', '', 'Choisir le locuteur'); blank.value = ''; speaker.append(blank);
        for (const person of result.speakers || []) {
          const option = el('option', '', person); option.value = person; speaker.append(option);
        }
        generate.disabled = true;
        message('Source vérifiée. Choisis l’agent entendu pour activer la génération.');
      } catch (error) { message(error.message, true); }
      finally { if (view) preview.disabled = false; }
    });
    speaker.addEventListener('change', () => {
      if (view) generate.disabled = !view.sha || !view.modelHash || !speaker.value || view.dirty;
    });
    generate.addEventListener('click', async () => {
      try {
        const profile = selectedProfile();
        if (!profile || view.dirty || !view.sha || !speaker.value) {
          throw new Error('Enregistre le modèle, examine la source et choisis l’agent.');
        }
        generate.disabled = true;
        const result = await request('generate', jobId, {
          promptId: String(profile.promptId), modelHash: view.modelHash,
          sha256: view.sha, agentSpeaker: speaker.value
        });
        message('Génération lancée. Aucun compte rendu existant n’est remplacé.');
        await showHistory(); await watch(result.generationId);
      } catch (error) { message(error.message, true); }
      finally { if (view && !view.closed) generate.disabled = false; }
    });
    loadProfiles().catch(error => message(error.message, true));
    showHistory().catch(error => message(error.message, true));
  }
  function mount() {
    for (const row of document.querySelectorAll('#jobs-container .wrapper-content_item-row[data-job-id]')) {
      if (row.querySelector('.agilo-tprep-open')) continue;
      const jobId = row.getAttribute('data-job-id');
      if (!/^\d+$/.test(jobId || '')) continue;
      const button = el('button', 'agilo-tprep-open', 'Fiche par entretien'); button.type = 'button';
      button.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation(); open(jobId, button);
      });
      (row.querySelector('.custom-element.report-links') || row).append(button);
    }
    const creds = window.__agiloEditorCreds;
    const editorActions = document.querySelector('.ed-actions');
    const editorJob = creds?.pickJobId?.();
    if (editorActions && /^\d+$/.test(String(editorJob || ''))
        && !editorActions.querySelector('.agilo-tprep-open')) {
      const button = el('button', 'agilo-tprep-open', 'Fiche par entretien'); button.type = 'button';
      button.addEventListener('click', () => open(String(editorJob), button));
      editorActions.append(button);
    }
  }
  const style = el('style');
  style.textContent = `
    .agilo-tprep-open{margin:.4rem;padding:.4rem .65rem;border:1px solid #174a88;border-radius:6px;background:#fff;color:#174a88;cursor:pointer}
    .agilo-tprep-backdrop{position:fixed;inset:0;z-index:2147483000;background:#0008;display:flex;align-items:center;justify-content:center;padding:1rem}
    .agilo-tprep-panel{box-sizing:border-box;width:min(720px,100%);max-height:92vh;overflow:auto;background:#fff;color:#17202b;border-radius:12px;padding:1.2rem;box-shadow:0 12px 40px #0004;font:16px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}
    .agilo-tprep-header{display:flex;align-items:start;justify-content:space-between;gap:1rem;flex-wrap:wrap}
    .agilo-tprep-header h2{margin:0 0 .8rem;font-size:1.35rem}.agilo-tprep-panel h3{margin:1.2rem 0 .5rem;font-size:1.05rem}
    .agilo-tprep-field{display:block;margin:.75rem 0}.agilo-tprep-field span{display:block;font-weight:600;margin-bottom:.25rem}
    .agilo-tprep-field input,.agilo-tprep-field select,.agilo-tprep-field textarea{box-sizing:border-box;width:100%;padding:.55rem;border:1px solid #aab6c2;border-radius:5px}
    .agilo-tprep-fixed{margin:.3rem 0 .8rem;padding-left:1.5rem}.agilo-tprep-fixed li{margin:.15rem 0}
    .agilo-tprep-question{border:1px solid #d8dee6;border-radius:8px;padding:.65rem;margin:.7rem 0}
    .agilo-tprep-question-actions{display:flex;gap:.4rem;flex-wrap:wrap}.agilo-tprep-panel button{cursor:pointer}
    .agilo-tprep-primary,.agilo-tprep-secondary{margin:.45rem .45rem .45rem 0;padding:.65rem .85rem;border-radius:6px}
    .agilo-tprep-primary{background:#185095;color:#fff;border:0}.agilo-tprep-secondary{background:#fff;color:#174a88;border:1px solid #174a88}
    .agilo-tprep-panel button:disabled{opacity:.45;cursor:not-allowed}.agilo-tprep-error{color:#aa1223}
    .agilo-tprep-details{overflow-wrap:anywhere}.agilo-tprep-history-row{display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;border-top:1px solid #ddd;padding:.5rem 0}
  `;
  document.head.append(style);
  mount();
  new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
})();
