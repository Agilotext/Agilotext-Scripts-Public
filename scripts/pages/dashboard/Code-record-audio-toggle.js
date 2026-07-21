/**
 * Agilotext — Toggle minimal « Copie locale » (téléchargement auto audio).
 *
 * Business dashboard (Ent). Ligne discrète sous le texte RGPD.
 * Pref : localStorage `agilo:record:auto-download` ('1' ON | '0' OFF). Défaut ON.
 * Override IT : window.AGILO_RECORD_AUTO_DOWNLOAD = true|false.
 *
 * Embed (après Record) :
 *   <script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.10/scripts/pages/dashboard/Code-record-audio-toggle.js?v=<HASH>"></script>
 */
(function () {
  'use strict';

  var PREF_KEY = 'agilo:record:auto-download';
  var ROOT_ID = 'agilo-auto-download-pref';
  var INPUT_ID = 'agilo-auto-download-checkbox';
  var HELP_ID = 'agilo-ad-help';
  var HELP_TEXT =
    "Télécharge l'audio dans Téléchargements à la fin. Décochez si votre organisation l'interdit. " +
    "Upload Agilotext inchangé ; récupération d'urgence possible si échec.";

  if (window.__AGILO_RECORD_AUDIO_TOGGLE_BOOTED__) return;
  window.__AGILO_RECORD_AUDIO_TOGGLE_BOOTED__ = true;

  function readPrefOn() {
    if (window.AGILO_RECORD_AUTO_DOWNLOAD === false) return false;
    if (window.AGILO_RECORD_AUTO_DOWNLOAD === true) return true;
    try {
      var v = localStorage.getItem(PREF_KEY);
      if (v === '0' || v === 'false') return false;
      if (v === '1' || v === 'true') return true;
    } catch (_) {}
    return true;
  }

  function writePref(on) {
    try {
      localStorage.setItem(PREF_KEY, on ? '1' : '0');
    } catch (_) {}
  }

  function isOrgLockedOff() {
    return window.AGILO_RECORD_AUTO_DOWNLOAD === false;
  }

  function findRgpdNode() {
    var nodes = document.querySelectorAll(
      '.text-color-grey.text-size-small, .text-size-small.text-color-grey, .text-size-small'
    );
    for (var i = 0; i < nodes.length; i++) {
      var t = (nodes[i].textContent || '').replace(/\s+/g, ' ').trim();
      if (t.indexOf('Conforme au RGPD') !== -1) return nodes[i];
    }
    return null;
  }

  /**
   * Insertion juste après le texte RGPD.
   * Fallback : après .wrapper-button_recording.
   */
  function findMountTarget() {
    var rgpd = findRgpdNode();
    if (rgpd && rgpd.parentNode) {
      return {
        parent: rgpd.parentNode,
        before: rgpd.nextSibling,
        after: rgpd,
        kind: 'rgpd'
      };
    }

    var main = document.querySelector('.wrapper-button_recording');
    if (main && main.parentNode) {
      return {
        parent: main.parentNode,
        before: main.nextSibling,
        after: main,
        kind: 'main-record'
      };
    }

    return null;
  }

  function injectStyles() {
    if (document.getElementById('agilo-auto-download-pref-style')) return;
    var style = document.createElement('style');
    style.id = 'agilo-auto-download-pref-style';
    style.textContent =
      '#' + ROOT_ID + '{' +
        'display:block;position:relative;width:auto;max-width:none;' +
        'margin:4px 0 0;padding:0;border:none;background:transparent;' +
        'box-sizing:border-box;font-family:inherit;text-align:inherit;' +
      '}' +
      '#' + ROOT_ID + ' .agilo-ad-row{' +
        'display:inline-flex;align-items:center;gap:6px;margin:0;' +
        'cursor:pointer;font-size:12px;font-weight:400;line-height:1.35;' +
        'color:#6b6b6b;' +
      '}' +
      '#' + ROOT_ID + ' #' + INPUT_ID + '{' +
        'width:14px;height:14px;margin:0;flex-shrink:0;cursor:pointer;' +
        'accent-color:#fd7d13;' +
      '}' +
      '#' + ROOT_ID + ' .agilo-ad-label{' +
        'font-size:12px;font-weight:400;line-height:1.35;margin:0;' +
        'color:inherit;' +
      '}' +
      '#' + ROOT_ID + ' .agilo-ad-help{' +
        'position:absolute;left:0;bottom:calc(100% + 6px);z-index:40;' +
        'display:none;width:max-content;max-width:min(280px,80vw);' +
        'padding:8px 10px;border-radius:6px;background:#1f1f1f;color:#fff;' +
        'font-size:11px;font-weight:400;line-height:1.4;text-align:left;' +
        'box-shadow:0 4px 14px rgba(0,0,0,.18);pointer-events:none;' +
      '}' +
      '#' + ROOT_ID + ':hover .agilo-ad-help,' +
      '#' + ROOT_ID + ':focus-within .agilo-ad-help{' +
        'display:block;' +
      '}' +
      '#' + ROOT_ID + '.is-locked .agilo-ad-row{cursor:default;opacity:.85;}' +
      '#' + ROOT_ID + '.is-locked #' + INPUT_ID + '{cursor:not-allowed;}';
    document.head.appendChild(style);
  }

  function buildUi() {
    if (document.getElementById(ROOT_ID)) return null;

    var locked = isOrgLockedOff();
    var on = readPrefOn();

    var root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'text-color-grey text-size-small';
    root.setAttribute('role', 'group');
    if (locked) root.classList.add('is-locked');

    var row = document.createElement('label');
    row.className = 'agilo-ad-row';
    row.setAttribute('for', INPUT_ID);

    var input = document.createElement('input');
    input.type = 'checkbox';
    input.id = INPUT_ID;
    input.name = INPUT_ID;
    input.checked = on;
    if (locked) input.disabled = true;
    input.setAttribute('aria-label', 'Copie locale dans le dossier Téléchargements');
    input.setAttribute('aria-describedby', HELP_ID);
    input.title = HELP_TEXT;

    var labelText = document.createElement('span');
    labelText.className = 'agilo-ad-label';
    labelText.textContent = locked ? 'Copie locale (imposée désactivée)' : 'Copie locale';

    var help = document.createElement('span');
    help.className = 'agilo-ad-help';
    help.id = HELP_ID;
    help.setAttribute('role', 'tooltip');
    help.textContent = HELP_TEXT;

    row.appendChild(input);
    row.appendChild(labelText);
    root.appendChild(row);
    root.appendChild(help);

    input.addEventListener('change', function () {
      if (isOrgLockedOff()) {
        input.checked = false;
        return;
      }
      if (!input.checked) {
        var ok = window.confirm(
          "Sans copie locale, l'audio ne sera plus téléchargé automatiquement à la fin de l'enregistrement. Continuer ?"
        );
        if (!ok) {
          input.checked = true;
          return;
        }
      }
      writePref(input.checked);
    });

    return root;
  }

  function placeNode(ui, target) {
    if (target.after && target.after.parentNode === target.parent) {
      if (target.after.nextSibling) {
        target.parent.insertBefore(ui, target.after.nextSibling);
      } else {
        target.parent.appendChild(ui);
      }
      return;
    }
    if (target.before) target.parent.insertBefore(ui, target.before);
    else target.parent.appendChild(ui);
  }

  function isBadPlacement(el) {
    var n = el;
    while (n && n !== document.body) {
      if (n.id === 'wrapper_button-ok') return true;
      try {
        if (n.classList && n.classList.contains('popup-container---recording')) {
          var st = window.getComputedStyle(n);
          if (st && st.display === 'none') return true;
        }
      } catch (_) {}
      n = n.parentNode;
    }
    return false;
  }

  function mount() {
    try {
      var q = new URLSearchParams(window.location.search || '').get('ft');
      if (q === 'recorder-adv') localStorage.setItem('agilo:ft:recorder-adv', '1');
    } catch (_) {}

    var target = findMountTarget();
    if (!target) return false;

    injectStyles();

    var existing = document.getElementById(ROOT_ID);
    if (existing) {
      if (isBadPlacement(existing) || existing.parentNode !== target.parent) {
        placeNode(existing, target);
      }
      return true;
    }

    var ui = buildUi();
    if (!ui) return true;
    placeNode(ui, target);
    return true;
  }

  function boot() {
    if (mount()) return;
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (mount() || tries >= 40) clearInterval(timer);
    }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
