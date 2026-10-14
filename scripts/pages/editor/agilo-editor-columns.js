// Agilotext — colonnes de l’éditeur (liste + Raccourcis)
// Script parent : il voit .ed-body. L’iframe ne la voit pas.
// Ne crée pas de bouton. La flèche droite est l’élément Webflow .ia-toggle.
// Ne toggles pas .ed-rail : Code-changement-audio le fait déjà.

(function () {
  'use strict';

  if (window.__agiloEditorColumnsBoot) return;
  window.__agiloEditorColumnsBoot = true;

  var KEY_IA = 'agilo:editor:ia-hidden';
  var KEY_RAIL = 'agilo:editor:rail-collapsed';
  var ASIDE_ID = 'agilo-editor-ia';

  var COLUMNS_CSS = [
    '@media (max-width:991px){',
    '.ia-toggle{display:none !important;}',
    '}',
    '@media (min-width:992px){',
    '.ed-body:has(> .ed-rail.is-collapsed):not(.is-ia-hidden){',
    'grid-template-columns:3rem minmax(0, 1fr) minmax(14rem, 18rem);',
    '}',
    '.ed-body.is-ia-hidden:not(:has(> .ed-rail.is-collapsed)){',
    'grid-template-columns:minmax(16rem, 22rem) minmax(0, 1fr);',
    '}',
    '.ed-body.is-ia-hidden:has(> .ed-rail.is-collapsed){',
    'grid-template-columns:3rem minmax(0, 1fr);',
    '}',
    '.ed-body.is-ia-hidden > .ed-ia{display:none;}',
    '.ed-rail.is-collapsed{overflow:hidden;}',
    '.ed-rail.is-collapsed .rail-head,',
    '.ed-rail.is-collapsed .rail-list,',
    '.ed-rail.is-collapsed .rail-section,',
    '.ed-rail.is-collapsed .agilo-folder-bar{display:none;}',
    '}'
  ].join('');

  function readFlag(key) {
    try { return localStorage.getItem(key) === '1'; } catch (e) { return false; }
  }

  function writeFlag(key, on) {
    try { localStorage.setItem(key, on ? '1' : '0'); } catch (e) { /* privé */ }
  }

  function injectCss() {
    if (document.getElementById('agilo-editor-columns-css')) return;
    var style = document.createElement('style');
    style.id = 'agilo-editor-columns-css';
    style.textContent = COLUMNS_CSS;
    document.head.appendChild(style);
  }

  function bodyEl() {
    return document.querySelector('.ed-body');
  }

  function railEl() {
    return document.querySelector('.ed-rail');
  }

  function asideEl() {
    return document.querySelector('aside.ed-ia');
  }

  function iaToggleEl() {
    return document.querySelector('.ia-toggle');
  }

  function pingResize() {
    window.dispatchEvent(new Event('resize'));
  }

  function clearAsideInlineDisplay(aside) {
    if (!aside || !aside.style) return;
    aside.style.removeProperty('display');
  }

  function syncRailButton() {
    var rail = railEl();
    var btn = document.querySelector('.rail-toggle');
    if (!btn || !rail) return;
    var collapsed = rail.classList.contains('is-collapsed');
    btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    btn.setAttribute('aria-label', collapsed ? 'Afficher la liste' : 'Replier la liste');
  }

  function syncIaButton(hidden) {
    var btn = iaToggleEl();
    if (!btn) return;
    btn.textContent = hidden ? '\u00ab' : '\u00bb';
    btn.setAttribute('aria-expanded', hidden ? 'false' : 'true');
    btn.setAttribute('aria-label', hidden ? 'Afficher les raccourcis' : 'Masquer les raccourcis');
    btn.setAttribute('aria-controls', ASIDE_ID);
  }

  function setIaHidden(hidden, moveFocus) {
    var body = bodyEl();
    if (!body) return;
    var aside = asideEl();
    var active = document.activeElement;
    var focusInside = !!(moveFocus && hidden && aside && active && aside.contains(active));
    clearAsideInlineDisplay(aside);
    body.classList.toggle('is-ia-hidden', !!hidden);
    writeFlag(KEY_IA, !!hidden);
    syncIaButton(!!hidden);
    if (focusInside) {
      var back = iaToggleEl();
      if (back) back.focus();
    }
    pingResize();
  }

  function tagAside() {
    var aside = asideEl();
    if (aside && !aside.id) aside.id = ASIDE_ID;
  }

  function clickTarget(event) {
    var node = event && event.target;
    if (!node) return null;
    if (node.nodeType === 1) return node;
    return node.parentElement || null;
  }

  function onRailClick(event) {
    var el = clickTarget(event);
    if (!el || !el.closest || !el.closest('.rail-toggle')) return;
    queueMicrotask(function () {
      var rail = railEl();
      if (!rail) return;
      writeFlag(KEY_RAIL, rail.classList.contains('is-collapsed'));
      syncRailButton();
      pingResize();
    });
  }

  function onIaClick(event) {
    var el = clickTarget(event);
    if (!el || !el.closest || !el.closest('.ia-toggle')) return;
    var body = bodyEl();
    if (!body) return;
    setIaHidden(!body.classList.contains('is-ia-hidden'), true);
  }

  function boot() {
    injectCss();
    var body = bodyEl();
    if (!body) return;
    tagAside();
    clearAsideInlineDisplay(asideEl());
    if (readFlag(KEY_RAIL)) {
      var rail = railEl();
      if (rail) rail.classList.add('is-collapsed');
    }
    syncRailButton();
    setIaHidden(readFlag(KEY_IA), false);
  }

  document.addEventListener('click', onRailClick, false);
  document.addEventListener('click', onIaClick, false);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
