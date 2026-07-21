/**
 * Agilotext — Toggle « Copie locale de sécurité » (téléchargement auto audio).
 *
 * Business dashboard only (Ent). Visible by default.
 * Pref key: localStorage `agilo:record:auto-download` ('1' ON | '0' OFF). Default ON.
 * IT override: window.AGILO_RECORD_AUTO_DOWNLOAD = true|false (locks UI when false).
 * Optional early reveal (legacy): ?ft=recorder-adv (sticky localStorage, no longer required).
 *
 * Embed (Webflow Business dashboard), after Record script:
 *   <script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.10/scripts/pages/dashboard/Code-record-audio-toggle.js?v=<HASH>"></script>
 */
(function () {
  'use strict';

  var PREF_KEY = 'agilo:record:auto-download';
  var ROOT_ID = 'agilo-auto-download-pref';
  var INPUT_ID = 'agilo-auto-download-checkbox';

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

  function findAnchor() {
    return (
      document.querySelector('.startrecording') ||
      document.querySelector('form[ms-code-file-upload="form"]') ||
      document.querySelector('#Recording_animation') ||
      null
    );
  }

  function injectStyles() {
    if (document.getElementById('agilo-auto-download-pref-style')) return;
    var style = document.createElement('style');
    style.id = 'agilo-auto-download-pref-style';
    style.textContent =
      '#' + ROOT_ID + '{' +
        'display:block;width:100%;max-width:36rem;margin:12px 0 8px;' +
        'padding:12px 14px;box-sizing:border-box;border:1px solid rgba(0,0,0,.12);' +
        'border-radius:10px;background:rgba(245,245,245,.85);font-family:inherit;' +
        'color:#0e0e0e;text-align:left;' +
      '}' +
      '#' + ROOT_ID + ' .agilo-ad-row{' +
        'display:flex;align-items:flex-start;gap:10px;margin:0;cursor:pointer;' +
      '}' +
      '#' + ROOT_ID + ' #' + INPUT_ID + '{' +
        'width:18px;height:18px;margin:2px 0 0;flex-shrink:0;cursor:pointer;' +
        'accent-color:#fd7d13;' +
      '}' +
      '#' + ROOT_ID + ' .agilo-ad-label{' +
        'font-size:14px;font-weight:600;line-height:1.35;margin:0;' +
      '}' +
      '#' + ROOT_ID + ' .agilo-ad-help{' +
        'font-size:12px;line-height:1.45;color:#525252;margin:6px 0 0 28px;' +
      '}' +
      '#' + ROOT_ID + ' .agilo-ad-org{' +
        'font-size:12px;line-height:1.4;color:#a82633;margin:8px 0 0 28px;' +
      '}' +
      '#' + ROOT_ID + '.is-locked{opacity:.92;}' +
      '#' + ROOT_ID + '.is-locked #' + INPUT_ID + '{cursor:not-allowed;}';
    document.head.appendChild(style);
  }

  function buildUi() {
    if (document.getElementById(ROOT_ID)) return null;

    var locked = isOrgLockedOff();
    var on = readPrefOn();

    var root = document.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('role', 'group');
    root.setAttribute('aria-labelledby', 'agilo-ad-label-text');
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

    var labelText = document.createElement('span');
    labelText.className = 'agilo-ad-label';
    labelText.id = 'agilo-ad-label-text';
    labelText.textContent = 'Copie locale de sécurité (dossier Téléchargements)';

    row.appendChild(input);
    row.appendChild(labelText);
    root.appendChild(row);

    var help = document.createElement('p');
    help.className = 'agilo-ad-help';
    help.id = 'agilo-ad-help';
    help.textContent =
      "Désactivez si votre organisation interdit les fichiers audio sur le poste. " +
      "L'envoi vers Agilotext continue ; une récupération d'urgence reste possible si l'envoi échoue.";
    root.appendChild(help);

    if (locked) {
      var org = document.createElement('p');
      org.className = 'agilo-ad-org';
      org.textContent = 'Imposé par votre organisation (téléchargement automatique désactivé).';
      root.appendChild(org);
    }

    input.setAttribute('aria-describedby', 'agilo-ad-help');

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

  function mount() {
    // Optional sticky reveal flag (no longer required for visibility).
    try {
      var q = new URLSearchParams(window.location.search || '').get('ft');
      if (q === 'recorder-adv') localStorage.setItem('agilo:ft:recorder-adv', '1');
    } catch (_) {}

    var anchor = findAnchor();
    if (!anchor || !anchor.parentNode) return false;

    injectStyles();
    var ui = buildUi();
    if (!ui) return true;

    if (anchor.classList && anchor.classList.contains('startrecording')) {
      anchor.parentNode.insertBefore(ui, anchor);
    } else {
      anchor.parentNode.insertBefore(ui, anchor);
    }
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
