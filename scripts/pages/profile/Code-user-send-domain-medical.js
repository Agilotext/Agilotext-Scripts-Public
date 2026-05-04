/**
 * Agilotext — Mode médical (domainRecognition général/médical) via préférences d’envoi utilisateur.
 * API v2.0.70+: getUserSendDefaults / setUserSendDefaults + champ domainRecognition.
 *
 * Auth : memberEmail + globalToken + edition (path).
 * Transport : POST multipart FormData (aligné api-client / dashboard).
 *
 * ─── HTML + CSS (copier-coller Webflow) ───
 *     scripts/pages/profile/Code-user-send-domain-medical-embed.html
 *
 * ─── Bouton Sauvegarder (Designer Webflow), comme pour #save-mailNotif ───
 *     Type : button
 *     ID   : agilo-medical-save-btn
 *     Classes : recopier celles du bouton notifications métier (ex. button / w-button / variante verte).
 *     Retirer la classe agt-med-btn-fallback si tu relies le style uniquement aux classes Webflow.
 *
 * ─── Script (après token-resolver) ───
 * <script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@<SHA>/scripts/pages/profile/Code-user-send-domain-medical.js" defer></script>
 */
(function () {
  'use strict';

  var API_BASE = 'https://api.agilotext.com/api/v1';
  var META_KEYS = {
    status: 1,
    errorMessage: 1,
    exceptionStackTrace: 1,
    javaException: 1,
    javaStackTrace: 1,
    userErrorMessage: 1,
    message: 1
  };

  function editionFromPath() {
    var p = window.location.pathname || '';
    if (p.indexOf('/app/free/') !== -1) return 'free';
    if (p.indexOf('/app/pro/') !== -1 || p.indexOf('/app/premium/') !== -1) return 'pro';
    if (p.indexOf('/app/ent/') !== -1 || p.indexOf('/app/business/') !== -1) return 'ent';
    return 'ent';
  }

  function readEmail() {
    var el = document.querySelector('[name="memberEmail"]');
    return String(
      (el && (el.value || el.getAttribute('src') || el.textContent)) || ''
    ).trim();
  }

  function readToken() {
    try {
      if (typeof globalToken !== 'undefined' && globalToken) return String(globalToken).trim();
    } catch (e) {}
    return String(window.globalToken || '').trim();
  }

  function getAuthOrNull() {
    var email = readEmail();
    var token = readToken();
    var edition = editionFromPath();
    if (!email || !token) return null;
    return { username: email, token: token, edition: edition };
  }

  function postFormData(endpoint, fields) {
    var auth = getAuthOrNull();
    if (!auth) return Promise.reject(new Error('Session indisponible'));

    var fd = new FormData();
    fd.append('username', auth.username);
    fd.append('token', auth.token);
    fd.append('edition', auth.edition);

    var k;
    for (k in fields) {
      if (!Object.prototype.hasOwnProperty.call(fields, k)) continue;
      var v = fields[k];
      if (v === undefined || v === null) continue;
      fd.append(k, String(v));
    }

    return fetch(API_BASE + endpoint, {
      method: 'POST',
      body: fd,
      credentials: 'omit',
      cache: 'no-store'
    }).then(function (res) {
      return res.text().then(function (text) {
        var data;
        try {
          data = text ? JSON.parse(text) : {};
        } catch (e) {
          throw new Error('Réponse non JSON: ' + String(text).slice(0, 200));
        }
        if (!res.ok) {
          throw new Error((data && data.errorMessage) || 'HTTP ' + res.status);
        }
        if (data && data.status === 'KO') {
          throw new Error(data.errorMessage || 'Erreur API');
        }
        return data;
      });
    });
  }

  function pickDefaultsObject(data) {
    if (!data || typeof data !== 'object') return {};
    if (data.userSendDefaults && typeof data.userSendDefaults === 'object')
      return data.userSendDefaults;
    if (data.sendDefaults && typeof data.sendDefaults === 'object')
      return data.sendDefaults;
    return data;
  }

  function stripMetaForSave(obj) {
    var out = {};
    var k;
    for (k in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      if (META_KEYS[k]) continue;
      var v = obj[k];
      if (v === undefined || v === null) continue;
      if (typeof v === 'object' && !Array.isArray(v)) continue;
      out[k] = v;
    }
    return out;
  }

  function readDomainRecognition(data) {
    var o = pickDefaultsObject(data);
    var v = o.domainRecognition;
    if (v === undefined || v === null) v = data.domainRecognition;
    var s = String(v || 'general')
      .trim()
      .toLowerCase();
    return s === 'medical' ? 'medical' : 'general';
  }

  function setStatus(el, msg, isError, neutralClasses) {
    if (!el) return;
    el.textContent = msg || '';
    el.classList.remove('ok', 'err');
    if (!msg && !neutralClasses) return;
    if (neutralClasses) return;
    if (msg)
      el.classList.add(isError ? 'err' : 'ok');
  }

  function setRadioDomainFromValue(root, dr) {
    var val = dr === 'medical' ? 'medical' : 'general';
    var r = root.querySelector(
      'input[name="agiloDomainRecognition"][value="' + val + '"]'
    );
    if (r) r.checked = true;
  }

  function readSelectedDomain(root) {
    var sel = root.querySelector(
      'input[name="agiloDomainRecognition"]:checked'
    );
    var v = sel && sel.value;
    return v === 'medical' ? 'medical' : 'general';
  }

  function init() {
    if (window.__agiloMedicalPrefInit) return;
    var root = document.getElementById('agilo-medical-domain-root');
    if (!root) return;

    var saveBtn = document.getElementById('agilo-medical-save-btn');
    var statusEl = document.getElementById('agilo-medical-domain-status');
    var radioSample = root.querySelector('input[name="agiloDomainRecognition"]');

    if (!radioSample || !saveBtn) {
      console.warn(
        '[agilo-medical] Éléments requis manquants (input[name="agiloDomainRecognition"] ou #agilo-medical-save-btn).'
      );
      return;
    }

    window.__agiloMedicalPrefInit = true;

    var lastPayloadForSave = {};

    function loadFromApi() {
      setStatus(statusEl, 'Chargement…', false, true);
      postFormData('/getUserSendDefaults', {})
        .then(function (data) {
          lastPayloadForSave = stripMetaForSave(pickDefaultsObject(data));
          var dr = readDomainRecognition(data);
          setRadioDomainFromValue(root, dr);
          setStatus(statusEl, '', false);
        })
        .catch(function (e) {
          setStatus(statusEl, e && e.message ? e.message : 'Impossible de charger les préférences.', true);
        });
    }

    function save() {
      var auth = getAuthOrNull();
      if (!auth) {
        setStatus(statusEl, 'Connectez-vous ou rechargez la page (token manquant).', true);
        return;
      }

      var next = Object.assign({}, lastPayloadForSave, {
        domainRecognition: readSelectedDomain(root)
      });

      saveBtn.disabled = true;
      saveBtn.setAttribute('aria-busy', 'true');
      setStatus(statusEl, 'Enregistrement…', false, true);

      postFormData('/setUserSendDefaults', next)
        .then(function () {
          lastPayloadForSave = stripMetaForSave(next);
          setStatus(statusEl, 'Préférences enregistrées.', false);
        })
        .catch(function (e) {
          setStatus(statusEl, e && e.message ? e.message : 'Échec de l’enregistrement.', true);
        })
        .finally(function () {
          saveBtn.disabled = false;
          saveBtn.removeAttribute('aria-busy');
        });
    }

    saveBtn.addEventListener('click', function () {
      save();
    });

    window.addEventListener(
      'agilo:token',
      function () {
        loadFromApi();
      },
      { passive: true }
    );

    if (readToken()) {
      loadFromApi();
      return;
    }

    var t0 = Date.now();
    var poll = window.setInterval(function () {
      if (readToken()) {
        window.clearInterval(poll);
        loadFromApi();
      } else if (Date.now() - t0 > 20000) {
        window.clearInterval(poll);
        setStatus(
          statusEl,
          'En attente de session… rechargez après connexion.',
          false,
          true
        );
      }
    }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
