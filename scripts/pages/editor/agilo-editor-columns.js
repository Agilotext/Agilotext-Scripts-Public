// Agilotext — colonnes de l’éditeur (liste + Raccourcis)
// Script parent : il voit .ed-body. L’iframe ne la voit pas.
// Ne toggles pas .ed-rail : Code-changement-audio le fait déjà.

(function () {
  'use strict';

  if (window.__agiloEditorColumnsBoot) return;
  window.__agiloEditorColumnsBoot = true;

  var KEY_IA = 'agilo:editor:ia-hidden';
  var KEY_RAIL = 'agilo:editor:rail-collapsed';

  var COLUMNS_CSS = [
    '.agilo-col-hide-ia,',
    '.agilo-col-reopen{',
    'appearance:none;',
    'margin:.35rem .4rem;',
    'padding:.28rem .6rem;',
    'border:1px solid var(--color--noir_25, rgba(0,0,0,.18));',
    'border-radius:.4rem;',
    'background:#fff;',
    'color:var(--color--gris_foncé, #020202);',
    'font:600 .72rem/1.2 system-ui,-apple-system,Segoe UI,sans-serif;',
    'cursor:pointer;',
    '}',
    '.agilo-col-reopen[hidden]{display:none;}',
    '@media (max-width:991px){',
    '.agilo-col-hide-ia,.agilo-col-reopen{display:none !important;}',
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

  function reopenEl() {
    return document.getElementById('agilo-col-reopen-ia');
  }

  function pingResize() {
    window.dispatchEvent(new Event('resize'));
  }

  function syncRailButton() {
    var rail = railEl();
    var btn = document.querySelector('.rail-toggle');
    if (!btn || !rail) return;
    var collapsed = rail.classList.contains('is-collapsed');
    btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    btn.setAttribute('aria-label', collapsed ? 'Afficher la liste' : 'Replier la liste');
  }

  function syncReopen(hidden) {
    var btn = reopenEl();
    if (!btn) return;
    btn.hidden = !hidden;
    btn.setAttribute('aria-expanded', hidden ? 'false' : 'true');
  }

  function setIaHidden(hidden, moveFocus) {
    var body = bodyEl();
    if (!body) return;
    var aside = asideEl();
    var active = document.activeElement;
    var focusInside = !!(moveFocus && hidden && aside && active && aside.contains(active));
    body.classList.toggle('is-ia-hidden', !!hidden);
    writeFlag(KEY_IA, !!hidden);
    syncReopen(!!hidden);
    if (focusInside) {
      var back = reopenEl();
      if (back) back.focus();
    }
    pingResize();
  }

  function ensureReopen(main) {
    if (!main || reopenEl()) return reopenEl();
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'agilo-col-reopen-ia';
    btn.className = 'agilo-col-reopen';
    btn.textContent = 'Raccourcis';
    btn.setAttribute('aria-controls', 'agilo-editor-ia');
    btn.hidden = true;
    var toggle = main.querySelector('.rail-toggle');
    if (toggle) toggle.insertAdjacentElement('afterend', btn);
    else main.insertBefore(btn, main.firstChild);
    btn.addEventListener('click', function () {
      setIaHidden(false, false);
    });
    return btn;
  }

  function ensureHide(head) {
    if (!head || head.querySelector('.agilo-col-hide-ia')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'agilo-col-hide-ia';
    btn.textContent = 'Masquer';
    btn.setAttribute('aria-controls', 'agilo-editor-ia');
    btn.addEventListener('click', function () {
      setIaHidden(true, true);
    });
    head.appendChild(btn);
  }

  function tagAside() {
    var aside = asideEl();
    if (aside && !aside.id) aside.id = 'agilo-editor-ia';
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

  function boot() {
    injectCss();
    var body = bodyEl();
    if (!body) return;
    tagAside();
    var main = body.querySelector('.ed-main') || document.querySelector('.ed-main');
    ensureReopen(main);
    var head = document.querySelector('[data-view="ia"] .ed-ia-head');
    ensureHide(head);
    if (readFlag(KEY_RAIL)) {
      var rail = railEl();
      if (rail) rail.classList.add('is-collapsed');
    }
    syncRailButton();
    setIaHidden(readFlag(KEY_IA), false);
  }

  document.addEventListener('click', onRailClick, false);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
