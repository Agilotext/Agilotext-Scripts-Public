// Agilotext – Anonymisation Transcript/Compte-rendu v2
(function () {
  'use strict';

  const API_BASE = 'https://api.agilotext.com/api/v1';
  const TOKEN_ENDPOINT = API_BASE + '/getToken';
  const ANON_TEXT_ENDPOINT = API_BASE + '/anonText';
  const REQUEST_TIMEOUT_MS = 60000;
  const TOKEN_RETRY_MAX = 3;
  const TOKEN_RETRY_DELAY_MS = 800;

  let _abortController = null;

  // ============================================
  // CREDENTIALS
  // ============================================

  function resolveEdition() {
    const raw = window.AGILO_EDITION
      || new URLSearchParams(location.search).get('edition')
      || document.querySelector('#editorRoot')?.dataset.edition
      || localStorage.getItem('agilo:edition')
      || 'ent';
    const v = String(raw || '').toLowerCase().trim();
    if (['enterprise', 'entreprise', 'business', 'team', 'ent'].includes(v)) return 'ent';
    if (v.startsWith('pro')) return 'pro';
    if (v.startsWith('free') || v === 'gratuit') return 'free';
    return 'ent';
  }

  async function getMemberstackEmail() {
    const ms = window.$memberstackDom;
    if (!ms || typeof ms.getCurrentMember !== 'function') return null;
    try {
      const result = await ms.getCurrentMember({ cache: 'reload' });
      const member = result && result.data;
      const email = member && (member.email || (member.auth && member.auth.email));
      return email ? String(email).trim() : null;
    } catch (e) {
      return null;
    }
  }

  async function resolveEmail() {
    const fromMs = await getMemberstackEmail();
    if (fromMs) return fromMs;
    const root = document.querySelector('#editorRoot');
    return (
      root?.dataset.username
      || document.querySelector('[name="memberEmail"]')?.value
      || window.memberEmail
      || window.__agiloOrchestrator?.credentials?.email
      || document.querySelector('[data-ms-member="email"]')?.textContent?.trim()
      || localStorage.getItem('agilo:username')
      || ''
    ) || null;
  }

  async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    const signals = [controller.signal];
    if (_abortController) signals.push(_abortController.signal);
    const combined = signals.length > 1 ? (AbortSignal.any ? AbortSignal.any(signals) : signals[0]) : signals[0];
    try {
      return await fetch(url, { ...options, signal: combined });
    } finally {
      clearTimeout(tid);
    }
  }

  async function fetchToken(email, edition, attempt) {
    const current = typeof attempt === 'number' ? attempt : 0;
    try {
      const url = TOKEN_ENDPOINT + '?username=' + encodeURIComponent(email) + '&edition=' + encodeURIComponent(edition);
      const response = await fetchWithTimeout(url, { method: 'GET' }, 20000);
      const data = await response.json();
      if (data && data.status === 'OK' && data.token) return data.token;
      const msg = (data && (data.userErrorMessage || data.errorMessage)) || 'Token invalide';
      throw new Error(msg);
    } catch (err) {
      if (current < TOKEN_RETRY_MAX) {
        await new Promise((r) => setTimeout(r, TOKEN_RETRY_DELAY_MS * (current + 1)));
        return fetchToken(email, edition, current + 1);
      }
      throw err;
    }
  }

  async function ensureAuth() {
    const edition = resolveEdition();
    const email = await resolveEmail();
    if (!email) throw new Error('Email introuvable. Vérifiez que vous êtes connecté.');
    const token = await fetchToken(email, edition);
    localStorage.setItem('agilo:username', email);
    localStorage.setItem('agilo:edition', edition);
    return { email, token, edition };
  }

  // ============================================
  // CONTENU
  // ============================================

  function getActiveTab() {
    const tab = document.querySelector('[role="tab"][aria-selected="true"]');
    if (!tab) return null;
    const id = tab.id || '';
    if (id === 'tab-transcript') return 'transcript';
    if (id === 'tab-summary') return 'summary';
    return null;
  }

  function getTranscriptContent() {
    if (window._segments && Array.isArray(window._segments) && window._segments.length > 0) {
      return window._segments
        .map((seg) => {
          const speaker = (seg.speaker || '').trim();
          const text = (seg.text || '').trim();
          return speaker ? `${speaker}: ${text}` : text;
        })
        .join('\n\n');
    }
    const el = document.getElementById('transcriptEditor')
      || document.querySelector('[data-editor="transcript"]');
    if (!el) return null;
    if (typeof window.visibleTextFromBox === 'function') return window.visibleTextFromBox(el);
    return el.textContent || el.innerText || '';
  }

  function getSummaryContent() {
    const el = document.getElementById('summaryEditor')
      || document.getElementById('pane-summary')
      || document.querySelector('[data-editor="summary"]');
    if (!el) return null;
    return el.textContent || el.innerText || '';
  }

  function resolveEntityTypes() {
    const stored = localStorage.getItem('agilo:anon2:entityTypes');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      } catch (_) {}
    }
    if (window.__agiloAnon2Options && Array.isArray(window.__agiloAnon2Options.entityTypes)) {
      return window.__agiloAnon2Options.entityTypes;
    }
    return null;
  }

  // ============================================
  // NOTIFICATIONS
  // ============================================

  function notify(msg) {
    if (typeof window.toast === 'function') {
      window.toast(msg);
    } else {
      console.warn('[AGILO:ANON]', msg);
    }
  }

  // ============================================
  // ANONYMISATION
  // ============================================

  async function anonymiser() {
    const activeTab = getActiveTab();
    if (!activeTab) {
      notify('Anonymisation disponible uniquement sur les onglets Transcription et Compte-rendu.');
      return;
    }

    const content = activeTab === 'transcript' ? getTranscriptContent() : getSummaryContent();
    if (!content || !content.trim()) {
      notify('Aucun contenu à anonymiser.');
      return;
    }
    const fileName = activeTab === 'transcript' ? 'Transcript_anonymise.txt' : 'Compte-rendu_anonymise.txt';

    const btn = document.querySelector('[data-action="anonymiser"]');
    const originalHTML = btn ? btn.innerHTML : '';
    const textEl = btn ? (btn.querySelector('div, span') || null) : null;
    const originalText = textEl ? textEl.textContent : (btn ? btn.textContent : '');

    if (btn) {
      btn.disabled = true;
      btn.classList.add('is-anonymizing');
      if (textEl) textEl.textContent = 'Anonymisation…';
      else if (btn) btn.textContent = 'Anonymisation…';
    }

    _abortController = new AbortController();

    try {
      const creds = await ensureAuth();

      const payload = new FormData();
      payload.append('username', creds.email);
      payload.append('token', creds.token);
      payload.append('edition', creds.edition);
      payload.append('forceTextFormat', 'true');
      payload.append('fileUpload1', new Blob([content], { type: 'text/plain;charset=utf-8' }), 'input.txt');

      const entityTypes = resolveEntityTypes();
      if (entityTypes) payload.append('entityTypes', JSON.stringify(entityTypes));

      const response = await fetchWithTimeout(ANON_TEXT_ENDPOINT, { method: 'POST', body: payload }, REQUEST_TIMEOUT_MS);

      const blob = await response.blob();
      const rawText = await blob.text();

      if (!response.ok) {
        let msg = 'Erreur de traitement.';
        try {
          const json = JSON.parse(rawText);
          if (json && (json.userErrorMessage || json.errorMessage)) msg = json.userErrorMessage || json.errorMessage;
        } catch (_) {
          if (rawText && rawText.length < 300) msg = rawText;
        }
        throw new Error(msg);
      }

      let json = null;
      try { json = JSON.parse(rawText); } catch (_) {}
      if (json && json.status === 'KO') {
        throw new Error(json.userErrorMessage || json.errorMessage || 'Erreur de traitement.');
      }

      const outputText = (json && typeof json.anonymisedText === 'string') ? json.anonymisedText : rawText;
      const outputBlob = new Blob([outputText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(outputBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 30000);

      notify('Fichier téléchargé : ' + fileName);

    } catch (err) {
      if (err && (err.name === 'AbortError' || err.message === 'AbortError')) {
        notify('Anonymisation annulée.');
      } else if (err && (err.message === 'Failed to fetch' || err.name === 'TypeError')) {
        notify('Erreur réseau. Vérifiez votre connexion et réessayez.');
      } else {
        notify('Erreur : ' + ((err && err.message) || 'Une erreur est survenue.'));
      }
    } finally {
      _abortController = null;
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('is-anonymizing');
        if (originalHTML) btn.innerHTML = originalHTML;
        else if (textEl) textEl.textContent = originalText || 'Anonymiser';
        else if (btn) btn.textContent = originalText || 'Anonymiser';
      }
    }
  }

  // ============================================
  // VISIBILITÉ ET ONGLETS
  // ============================================

  function updateButtonVisibility() {
    const btn = document.querySelector('[data-action="anonymiser"]');
    if (!btn) return;
    const tab = getActiveTab();
    if (tab === 'transcript' || tab === 'summary') {
      btn.style.display = '';
      btn.style.visibility = '';
      btn.removeAttribute('hidden');
      btn.removeAttribute('aria-hidden');
      btn.title = tab === 'transcript' ? 'Anonymiser le transcript' : 'Anonymiser le compte-rendu';
    } else {
      btn.style.display = 'none';
      btn.setAttribute('aria-hidden', 'true');
    }
  }

  function setupTabObserver() {
    const tabs = document.querySelectorAll('[role="tab"]');
    tabs.forEach((tab) => tab.addEventListener('click', () => setTimeout(updateButtonVisibility, 100)));

    const observer = new MutationObserver((mutations) => {
      if (mutations.some((m) => m.type === 'attributes' && m.attributeName === 'aria-selected')) {
        setTimeout(updateButtonVisibility, 50);
      }
    });
    tabs.forEach((tab) => observer.observe(tab, { attributes: true, attributeFilter: ['aria-selected', 'class'] }));
    document.querySelectorAll('#pane-chat, #pane-summary, #pane-transcript').forEach((pane) => {
      observer.observe(pane, { attributes: true, attributeFilter: ['hidden', 'class'] });
    });
  }

  // ============================================
  // INIT
  // ============================================

  function init() {
    if (window.__agiloAnonymiserInitialized) return;
    window.__agiloAnonymiserInitialized = true;

    window.agiloAnonymiser = anonymiser;

    let attempts = 0;
    const maxAttempts = 10;

    function trySetup() {
      attempts++;
      const btn = document.querySelector('[data-action="anonymiser"]');
      if (btn) {
        if (!btn.__anonymiserListenerAttached) {
          btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); anonymiser(); });
          btn.__anonymiserListenerAttached = true;
        }
        updateButtonVisibility();
        setupTabObserver();
        return;
      }
      if (attempts < maxAttempts) setTimeout(trySetup, 500);
      else console.error('[AGILO:ANON] Bouton non trouvé. Assurez-vous que data-action="anonymiser" est présent dans Webflow.');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', trySetup, { once: true });
    else trySetup();
  }

  init();
})();
