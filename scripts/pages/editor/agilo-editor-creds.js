// Agilotext – Credentials éditeur Webflow + résolution du conteneur compte-rendu (VERSION 1.0)
// Charger ce fichier EN PREMIER, puis relance-compte-rendu.js puis Code-modeles-compte-rendu.js.
(function () {
  'use strict';

  if (window.__agiloEditorCreds && window.__agiloEditorCreds.__agiloCredsVersion >= 1) {
    return;
  }

  function pickEdition() {
    const root = document.querySelector('#editorRoot');
    const raw =
      window.AGILO_EDITION ||
      new URLSearchParams(location.search).get('edition') ||
      root?.dataset.edition ||
      localStorage.getItem('agilo:edition') ||
      'ent';
    const v = String(raw || '')
      .toLowerCase()
      .trim();
    if (['enterprise', 'entreprise', 'business', 'team', 'ent'].includes(v)) return 'ent';
    if (v.startsWith('pro')) return 'pro';
    if (v.startsWith('free') || v === 'gratuit') return 'free';
    return 'ent';
  }

  function pickJobId() {
    const u = new URL(location.href);
    const root = document.querySelector('#editorRoot');
    return (
      u.searchParams.get('jobId') ||
      root?.dataset.jobId ||
      window.__agiloOrchestrator?.currentJobId ||
      document.querySelector('.rail-item.is-active')?.dataset?.jobId ||
      ''
    );
  }

  function pickEmail() {
    const root = document.querySelector('#editorRoot');
    const raw =
      root?.dataset.username ||
      document.querySelector('[name="memberEmail"]')?.value ||
      window.memberEmail ||
      window.__agiloOrchestrator?.credentials?.email ||
      localStorage.getItem('agilo:username') ||
      document.querySelector('[data-ms-member="email"]')?.textContent ||
      '';
    return String(raw || '').trim();
  }

  function pickToken(edition, email) {
    const root = document.querySelector('#editorRoot');
    const k = `agilo:token:${edition}:${String(email || '').toLowerCase()}`;
    return (
      root?.dataset.token ||
      window.__agiloOrchestrator?.credentials?.token ||
      window.globalToken ||
      localStorage.getItem(k) ||
      localStorage.getItem(`agilo:token:${edition}`) ||
      localStorage.getItem('agilo:token') ||
      ''
    );
  }

  function querySummaryEditor() {
    return (
      document.querySelector('#summaryEditor') ||
      document.querySelector('#ag-summary') ||
      document.querySelector('[data-editor="summary"]') ||
      null
    );
  }

  window.__agiloEditorCreds = {
    __agiloCredsVersion: 1,
    pickEdition,
    pickJobId,
    pickEmail,
    pickToken,
    querySummaryEditor
  };
})();
