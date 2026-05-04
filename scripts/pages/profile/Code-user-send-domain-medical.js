/**
 * Agilotext — domainRecognition (général | médical) via getUserSendDefaults / setUserSendDefaults.
 *
 * Aligné sur le script notifications mail (page export) :
 * - email : [name="memberEmail"], [data-ms-member="email"], #memberEmail
 * - édition : ?edition=, [name="edition"], globaux tête, chemin (/app/free|pro|business…),
 *   puis localStorage agilo:edition, sinon free
 * - token : window.globalToken / globalToken puis GET /getToken si besoin (comme loadPreferences mail)
 *
 * Transport : POST x-www-form-urlencoded ; setUserSendDefaults exige le paramètre userSendDefaultsJson (chaîne JSON).
 *
 * HTML + CSS : scripts/pages/profile/Code-user-send-domain-medical-embed.html
 *
 * Bouton Sauvegarder (hors embed, comme #save-mailNotif) :
 *   Type button, ID agilo-medical-save-btn, classes « button save » (recopier mail).
 *
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

  function normEdition(v) {
    v = String(v || '')
      .toLowerCase()
      .trim();
    if (v === 'business' || v === 'enterprise' || v === 'entreprise' || v === 'biz')
      return 'ent';
    if (v === 'premium') return 'pro';
    return v;
  }

  /** Même esprit que detectEdition() notifications + inferEdition token-resolver. */
  function resolveEdition() {
    try {
      var q = new URLSearchParams(window.location.search || '').get('edition');
      if (q) {
        q = normEdition(q);
        if (q === 'ent' || q === 'pro' || q === 'free') return q;
      }
    } catch (e) {}

    var input = document.querySelector('[name="edition"]');
    if (input && String(input.value || '').trim()) {
      q = normEdition(input.value);
      if (q === 'ent' || q === 'pro' || q === 'free') return q;
    }

    var head =
      (typeof window.agilotextEdition === 'string' &&
        window.agilotextEdition.trim()) ||
      (typeof window.__AGILOTEXT_EDITION__ === 'string' &&
        window.__AGILOTEXT_EDITION__.trim());
    if (head) {
      q = normEdition(head);
      if (q === 'ent' || q === 'pro' || q === 'free') return q;
    }

    var p = window.location.pathname || '';
    if (p.indexOf('/app/free/') !== -1) return 'free';
    if (
      p.indexOf('/app/pro/') !== -1 ||
      p.indexOf('/app/premium/') !== -1
    )
      return 'pro';
    if (
      p.indexOf('/app/ent/') !== -1 ||
      p.indexOf('/app/business/') !== -1
    )
      return 'ent';
    if (p.indexOf('/business/') !== -1 || p.indexOf('/ent/') !== -1)
      return 'ent';
    if (p.indexOf('/premium/') !== -1 || p.indexOf('/pro/') !== -1)
      return 'pro';
    if (p.indexOf('/free/') !== -1) return 'free';

    try {
      var stored = localStorage.getItem('agilo:edition');
      if (
        stored &&
        (stored === 'free' || stored === 'pro' || stored === 'ent')
      )
        return stored;
    } catch (e2) {}

    return 'free';
  }

  function readEmail() {
    var el =
      document.querySelector('[name="memberEmail"]') ||
      document.querySelector('[data-ms-member="email"]') ||
      document.getElementById('memberEmail');
    return String(
      (el &&
        (el.value ||
          el.getAttribute('src') ||
          el.textContent ||
          el.getAttribute('value'))) ||
        ''
    ).trim();
  }

  function readTokenSync() {
    try {
      if (typeof globalToken !== 'undefined' && globalToken)
        return String(globalToken).trim();
    } catch (e) {}
    if (typeof window.globalToken === 'string' && window.globalToken.trim())
      return window.globalToken.trim();
    if (window.globalToken) return String(window.globalToken).trim();
    return '';
  }

  function writeToken(tok) {
    var t = String(tok || '').trim();
    if (!t) return;
    window.globalToken = t;
    try {
      globalToken = t;
    } catch (e) {}
  }

  function fetchTokenFromApi(email, edition, retryCount) {
    retryCount = retryCount || 0;
    if (retryCount >= 3) return Promise.resolve('');
    var url =
      API_BASE +
      '/getToken?username=' +
      encodeURIComponent(email) +
      '&edition=' +
      encodeURIComponent(edition);
    return fetch(url)
      .then(function (res) {
        return res.json().then(function (data) {
          return { res: res, data: data };
        });
      })
      .then(function (x) {
        var res = x.res;
        var data = x.data || {};
        if (res.ok && data.status === 'OK' && data.token) {
          writeToken(data.token);
          try {
            window.dispatchEvent(
              new CustomEvent('agilo:token', {
                detail: {
                  token: data.token,
                  email: email,
                  edition: edition
                }
              })
            );
          } catch (e3) {}
          return String(data.token).trim();
        }
        var err = data.errorMessage || '';
        if (err.indexOf('error_invalid_token') !== -1 && retryCount < 2) {
          return new Promise(function (resolve) {
            setTimeout(function () {
              fetchTokenFromApi(email, edition, retryCount + 1).then(resolve);
            }, 500);
          });
        }
        if (retryCount < 2) {
          return new Promise(function (resolve) {
            setTimeout(function () {
              fetchTokenFromApi(email, edition, retryCount + 1).then(resolve);
            }, 500);
          });
        }
        return '';
      })
      .catch(function () {
        if (retryCount < 2) {
          return new Promise(function (resolve) {
            setTimeout(function () {
              fetchTokenFromApi(email, edition, retryCount + 1).then(resolve);
            }, 500);
          });
        }
        return '';
      });
  }

  function ensureToken(email, edition) {
    var t = readTokenSync();
    if (t) return Promise.resolve(t);
    if (!email) return Promise.resolve('');
    return fetchTokenFromApi(email, edition, 0);
  }

  function getAuthResolved() {
    var email = readEmail();
    var edition = resolveEdition();
    var token = readTokenSync();
    if (!email) return Promise.resolve(null);
    if (token)
      return Promise.resolve({
        username: email,
        token: token,
        edition: edition
      });
    return ensureToken(email, edition).then(function (tok) {
      if (!tok) return null;
      return { username: email, token: tok, edition: edition };
    });
  }

  function postUrlEncoded(endpoint, fields, auth) {
    if (!auth) return Promise.reject(new Error('Session indisponible'));

    var body = new URLSearchParams();
    body.append('username', auth.username);
    body.append('token', auth.token);
    body.append('edition', auth.edition);

    var k;
    for (k in fields) {
      if (!Object.prototype.hasOwnProperty.call(fields, k)) continue;
      var v = fields[k];
      if (v === undefined || v === null) continue;
      body.append(k, String(v));
    }

    return fetch(API_BASE + endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString(),
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
    if (msg) el.classList.add(isError ? 'err' : 'ok');
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
        '[agilo-medical] Manque input[name="agiloDomainRecognition"] ou #agilo-medical-save-btn (bouton hors embed comme #save-mailNotif).'
      );
      return;
    }

    window.__agiloMedicalPrefInit = true;

    var lastPayloadForSave = {};
    var loadSeq = 0;

    function loadFromApi() {
      var seq = ++loadSeq;
      setStatus(statusEl, 'Chargement…', false, true);
      getAuthResolved()
        .then(function (auth) {
          if (seq !== loadSeq) return;
          if (!auth) {
            setStatus(
              statusEl,
              'Session indisponible (email ou token). Rechargez la page.',
              true
            );
            return Promise.reject(new Error('no-auth'));
          }
          return postUrlEncoded('/getUserSendDefaults', {}, auth);
        })
        .then(function (data) {
          if (seq !== loadSeq) return;
          lastPayloadForSave = stripMetaForSave(pickDefaultsObject(data));
          var dr = readDomainRecognition(data);
          setRadioDomainFromValue(root, dr);
          setStatus(statusEl, '', false);
        })
        .catch(function (e) {
          if (seq !== loadSeq) return;
          if (e && e.message === 'no-auth') return;
          setStatus(
            statusEl,
            e && e.message
              ? e.message
              : 'Impossible de charger les préférences.',
            true
          );
        });
    }

    function save() {
      getAuthResolved()
        .then(function (auth) {
          if (!auth) {
            setStatus(
              statusEl,
              'Connexion ou token indisponible. Rechargez la page.',
              true
            );
            return Promise.reject(new Error('no-auth'));
          }

          var merged = Object.assign({}, lastPayloadForSave, {
            domainRecognition: readSelectedDomain(root)
          });
          var toSave = stripMetaForSave(merged);

          saveBtn.disabled = true;
          saveBtn.setAttribute('aria-busy', 'true');
          setStatus(statusEl, 'Enregistrement…', false, true);

          return postUrlEncoded(
            '/setUserSendDefaults',
            { userSendDefaultsJson: JSON.stringify(toSave) },
            auth
          ).then(function () {
            lastPayloadForSave = toSave;
            setStatus(statusEl, 'Préférences enregistrées.', false);
          });
        })
        .catch(function (e) {
          if (e && e.message === 'no-auth') return;
          setStatus(
            statusEl,
            e && e.message ? e.message : 'Échec de l’enregistrement.',
            true
          );
        })
        .finally(function () {
          saveBtn.disabled = false;
          saveBtn.removeAttribute('aria-busy');
        });
    }

    saveBtn.addEventListener('click', function (e) {
      if (e && e.preventDefault) e.preventDefault();
      save();
    });

    window.addEventListener(
      'agilo:token',
      function () {
        loadFromApi();
      },
      { passive: true }
    );

    function tryBootstrap() {
      if (readEmail() && readTokenSync()) {
        loadFromApi();
        return true;
      }
      return false;
    }

    setTimeout(function () {
      if (tryBootstrap()) return;
      getAuthResolved().then(function (auth) {
        if (auth) loadFromApi();
        else {
          var t0 = Date.now();
          var poll = window.setInterval(function () {
            if (tryBootstrap()) {
              window.clearInterval(poll);
              return;
            }
            getAuthResolved().then(function (a) {
              if (a) {
                window.clearInterval(poll);
                loadFromApi();
              } else if (Date.now() - t0 > 25000) {
                window.clearInterval(poll);
                setStatus(
                  statusEl,
                  'En attente de session… rechargez après connexion.',
                  false,
                  true
                );
              }
            });
          }, 700);
        }
      });
    }, 450);

    var emailRetries = 0;
    var emailTimer = window.setInterval(function () {
      emailRetries += 1;
      if (readEmail()) {
        window.clearInterval(emailTimer);
        if (!readTokenSync()) return;
        loadFromApi();
      } else if (emailRetries >= 12) window.clearInterval(emailTimer);
    }, 900);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
