/**
 * Agilotext — page Intégrations / Automatisations.
 *
 * UX simplifiée :
 * - entrée Notion "magique" avec 2 parcours supportés : Make et Zapier
 * - mode expert conservé pour Make / Zapier / n8n
 * - transport aligné sur l'API réelle : application/x-www-form-urlencoded
 *
 * HTML + CSS :
 * scripts/pages/profile/Code-integrations-automation-embed.html
 */
(function () {
  'use strict';

  if (window.__agiloIntegrationsInitV2) return;
  window.__agiloIntegrationsInitV2 = true;
  window.__agiloIntegrationsUiVersion = '2026-05-19-notion-make-zapier';

  var API = 'https://api.agilotext.com/api/v1';
  var DEBUG = false;
  var cachedSessionToken = '';
  var PROVIDER_MAP = {
    Make: 'MAKE_PROVIDER',
    Zapier: 'ZAPIER_PROVIDER',
    n8n: 'N8N_PROVIDER'
  };

  function log() {
    if (!DEBUG) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[Agilo:Integrations]');
    console.log.apply(console, args);
  }

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
      return;
    }
    fn();
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    var input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', 'readonly');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(input);
    }
    return Promise.resolve();
  }

  function downloadTextFile(filename, content, mimeType) {
    var blob = new Blob([content], { type: mimeType || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadJsonFile(filename, payload) {
    downloadTextFile(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  }

  function getEmailNow() {
    var memberEmailInput =
      $('[name="memberEmail"]') || $('#memberEmail') || $('.memberemail');
    if (memberEmailInput) {
      var val = String(memberEmailInput.value || '').trim();
      if (val && val.indexOf('@') !== -1) return val;
      var src = String(memberEmailInput.getAttribute('src') || '').trim();
      if (src && src.indexOf('@') !== -1) return src;
      var text = String(memberEmailInput.textContent || '').trim();
      if (text && text.indexOf('@') !== -1) return text;
    }

    var msEmailEl = $('[data-ms-member="email"]');
    if (msEmailEl) {
      var txt = String(msEmailEl.textContent || '').trim();
      if (txt && txt.indexOf('@') !== -1) return txt;
      var val2 = String(msEmailEl.value || '').trim();
      if (val2 && val2.indexOf('@') !== -1) return val2;
    }

    var stored = localStorage.getItem('agilo:username');
    if (stored && stored.indexOf('@') !== -1) return stored;
    if (window.memberEmail && String(window.memberEmail).indexOf('@') !== -1) return String(window.memberEmail);

    if (window.$memberstackDom && window.$memberstackDom.getCurrentMember) {
      try {
        var member = window.$memberstackDom.getCurrentMember();
        if (member && member.data && member.data.auth && member.data.auth.email) {
          return String(member.data.auth.email);
        }
      } catch (e) {}
    }

    return '';
  }

  function waitForEmail(maxWait) {
    maxWait = maxWait || 5000;
    return new Promise(function (resolve) {
      var start = Date.now();
      (function loop() {
        var email = getEmailNow();
        if (email) {
          resolve(email);
          return;
        }
        if (Date.now() - start > maxWait) {
          resolve('');
          return;
        }
        setTimeout(loop, 200);
      })();
    });
  }

  function getEdition() {
    var stored = localStorage.getItem('agilo:edition');
    if (stored && (stored === 'free' || stored === 'pro' || stored === 'ent')) return stored;

    try {
      var q = new URLSearchParams(window.location.search || '').get('edition');
      if (q) {
        q = String(q).toLowerCase();
        if (q === 'business' || q === 'ent' || q === 'enterprise' || q === 'entreprise') return 'ent';
        if (q === 'premium' || q === 'pro') return 'pro';
        if (q === 'free') return 'free';
      }
    } catch (e) {}

    var path = String(window.location.pathname || '').toLowerCase();
    if (path.indexOf('/business') !== -1 || path.indexOf('/ent') !== -1) return 'ent';
    if (path.indexOf('/pro') !== -1 || path.indexOf('/premium') !== -1) return 'pro';
    if (path.indexOf('/free') !== -1) return 'free';
    return 'pro';
  }

  function readStoredSessionToken(email, edition) {
    var key = 'agilo:token:' + edition + ':' + String(email || '').toLowerCase();
    return localStorage.getItem(key) || '';
  }

  function storeSessionToken(email, edition, token) {
    if (!email || !edition || !token) return;
    var key = 'agilo:token:' + edition + ':' + String(email || '').toLowerCase();
    localStorage.setItem(key, token);
  }

  function getSessionToken(email, forceRefresh) {
    if (!email) return Promise.resolve('');
    var edition = getEdition();

    if (!forceRefresh) {
      if (window.globalToken) return Promise.resolve(String(window.globalToken));
      if (cachedSessionToken) return Promise.resolve(String(cachedSessionToken));
      var stored = readStoredSessionToken(email, edition);
      if (stored) {
        cachedSessionToken = stored;
        return Promise.resolve(stored);
      }
    }

    return fetch(API + '/getToken?username=' + encodeURIComponent(email) + '&edition=' + encodeURIComponent(edition))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.status === 'OK' && data.token) {
          cachedSessionToken = String(data.token);
          window.globalToken = String(data.token);
          storeSessionToken(email, edition, data.token);
          return String(data.token);
        }
        cachedSessionToken = '';
        return '';
      })
      .catch(function () {
        return '';
      });
  }

  function retryIfInvalidToken(email, requestFn) {
    return requestFn(false).then(function (data) {
      if (data && data.status === 'KO' && /error_invalid_token/i.test(String(data.errorMessage || ''))) {
        return getSessionToken(email, true).then(function () {
          return requestFn(true);
        });
      }
      return data;
    });
  }

  function buildForm(fields) {
    var form = new URLSearchParams();
    Object.keys(fields || {}).forEach(function (key) {
      if (fields[key] === undefined || fields[key] === null) return;
      form.append(key, String(fields[key]));
    });
    return form;
  }

  function postForm(path, fields) {
    return fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: buildForm(fields).toString()
    }).then(function (res) { return res.json(); });
  }

  function withButtonLoading(button, loadingLabel, fn) {
    if (!button) return Promise.resolve();
    button.disabled = true;
    var textNode = button.querySelector('div') || button;
    var original = textNode.textContent;
    textNode.textContent = loadingLabel;
    return Promise.resolve()
      .then(fn)
      .finally(function () {
        button.disabled = false;
        textNode.textContent = original;
      });
  }

  function getStoredAutomationToken(email) {
    if (!email) return '';
    return localStorage.getItem('agilo:automationToken:' + String(email).toLowerCase()) || '';
  }

  function setMessage(box, text, isVisible) {
    if (!box) return;
    box.style.display = isVisible ? 'block' : 'none';
    if (isVisible && typeof text === 'string' && text) {
      var span = box.querySelector('span:last-child');
      if (span) span.textContent = text;
    }
  }

  function setTokenUiState(hasToken) {
    var copyBtn = $('#copy-automation-token');
    var revokeBtn = $('#revoke-automation-token');
    var warning = $('#automation-token-warning');
    if (copyBtn) copyBtn.style.display = hasToken ? 'flex' : 'none';
    if (revokeBtn) revokeBtn.style.display = hasToken ? 'inline-flex' : 'none';
    if (warning) warning.style.display = hasToken ? 'block' : 'none';
  }

  function showNotionPanel(kind) {
    var makePanel = $('#agilo-notion-make-panel');
    var zapierPanel = $('#agilo-notion-zapier-panel');
    if (!makePanel || !zapierPanel) return;
    makePanel.classList.toggle('is-active', kind === 'make');
    zapierPanel.classList.toggle('is-active', kind === 'zapier');
    var target = kind === 'make' ? makePanel : zapierPanel;
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function getMakeBlueprint(email, automationToken) {
    var userEmail = email || 'VOTRE_EMAIL_AGILOTEXT';
    var userToken = automationToken || 'VOTRE_AUTOMATION_TOKEN';
    return {
      name: 'Agilotext - Envoyer fichier audio',
      flow: [
        {
          id: 1,
          module: 'google-drive:watchFilesInAFolder',
          version: 4,
          parameters: { __IMTCONN__: 'VOTRE_CONNEXION_GOOGLE_DRIVE' },
          mapper: { folderId: 'VOTRE_DOSSIER_ID' },
          metadata: { designer: { x: 0, y: 0, name: 'Nouveau fichier Drive' } }
        },
        {
          id: 2,
          module: 'google-drive:getAFile',
          version: 4,
          parameters: { __IMTCONN__: 'VOTRE_CONNEXION_GOOGLE_DRIVE' },
          mapper: { fileId: '{{1.id}}' },
          metadata: { designer: { x: 260, y: 0, name: 'Lire le fichier' } }
        },
        {
          id: 3,
          module: 'http:ActionSendData',
          version: 3,
          parameters: {},
          mapper: {
            url: 'https://api.agilotext.com/api/v1/sendFromAutomation',
            method: 'POST',
            serializeUrl: false,
            qs: [],
            headers: [],
            bodyType: 'x_www_form_urlencoded',
            data: [
              { key: 'username', value: userEmail },
              { key: 'automationToken', value: userToken },
              { key: 'url', value: '{{2.webContentLink}}' }
            ],
            timeout: 60,
            shareCookies: false,
            followRedirect: true,
            followAllRedirects: false,
            rejectUnauthorized: true
          },
          metadata: {
            designer: { x: 540, y: 0, name: 'Envoyer à Agilotext' },
            restore: {
              expect: {
                method: { mode: 'chose', label: 'POST', value: 'POST' },
                bodyType: {
                  mode: 'chose',
                  label: 'x-www-form-urlencoded',
                  value: 'x_www_form_urlencoded'
                },
                url: {
                  mode: 'text',
                  label: 'URL',
                  value: 'https://api.agilotext.com/api/v1/sendFromAutomation'
                }
              }
            }
          }
        }
      ],
      ___INSTRUCTIONS___: {
        fr: {
          etape_1: 'Importez ce fichier dans Make.',
          etape_2: 'Connectez Google Drive.',
          etape_3: "Le module HTTP est déjà réglé en POST + x-www-form-urlencoded.",
          etape_4: 'Vérifiez le mapping {{2.webContentLink}} pour le champ url.',
          note: 'Ce scénario est aligné sur la doc Agilotext actuelle : pas de multipart.'
        }
      }
    };
  }

  function getMakeBlueprintReception() {
    return {
      name: 'Agilotext - Recevoir transcriptions (Webhook)',
      flow: [
        {
          id: 1,
          module: 'gateway:CustomWebHook',
          version: 1,
          parameters: { maxResults: 1 },
          mapper: {},
          metadata: { designer: { x: 0, y: 0, name: 'Webhook Agilotext' } }
        },
        {
          id: 2,
          module: 'builtin:BasicRouter',
          version: 1,
          parameters: {
            routes: [
              {
                flow: [
                  {
                    id: 3,
                    module: 'http:ActionGetFile',
                    version: 3,
                    parameters: {},
                    mapper: { url: '{{1.fileUrl}}', method: 'GET' },
                    metadata: { designer: { x: 320, y: -120, name: 'Télécharger Transcript' } }
                  }
                ],
                label: 'TRANSCRIPT',
                filter: { name: 'Si TRANSCRIPT', conditions: [[{ a: '{{1.agilotextType}}', b: 'TRANSCRIPT', o: 'text:equal' }]] }
              },
              {
                flow: [
                  {
                    id: 4,
                    module: 'http:ActionGetFile',
                    version: 3,
                    parameters: {},
                    mapper: { url: '{{1.fileUrl}}', method: 'GET' },
                    metadata: { designer: { x: 320, y: 120, name: 'Télécharger Résumé' } }
                  }
                ],
                label: 'SUMMARY',
                filter: { name: 'Si SUMMARY', conditions: [[{ a: '{{1.agilotextType}}', b: 'SUMMARY', o: 'text:equal' }]] }
              }
            ]
          },
          mapper: {},
          metadata: { designer: { x: 160, y: 0, name: 'Router par type' } }
        }
      ]
    };
  }

  function getN8nBlueprint(email, automationToken) {
    var userEmail = email || 'VOTRE_EMAIL_AGILOTEXT';
    var userToken = automationToken || 'VOTRE_AUTOMATION_TOKEN';
    return {
      name: 'Agilotext - Recevoir transcriptions (Webhook)',
      nodes: [
        {
          parameters: { httpMethod: 'POST', path: 'agilotext-webhook', responseMode: 'onReceived', options: {} },
          type: 'n8n-nodes-base.webhook',
          typeVersion: 2.1,
          position: [0, 260],
          id: 'webhook-receive',
          name: 'Webhook Agilotext'
        }
      ],
      connections: {},
      ___WORKFLOW_ENVOI_SEPARE___: {
        description: "Pour envoyer des fichiers à Agilotext depuis n8n, créez un workflow séparé avec un nœud HTTP Request.",
        etape_1: 'URL : https://api.agilotext.com/api/v1/sendFromAutomation',
        etape_2: 'Method : POST',
        etape_3: 'Body Content Type : Form URLencoded',
        etape_4: 'Body Parameters : username, automationToken, url',
        exemple_username: userEmail,
        exemple_automationToken: userToken
      }
    };
  }

  function getMakeNotionBlueprint(email) {
    var safeEmail = email || 'VOTRE_EMAIL_AGILOTEXT';
    return {
      name: 'Agilotext - Notion (Compte rendu automatique)',
      flow: [
        {
          id: 1,
          module: 'gateway:CustomWebHook',
          version: 1,
          parameters: { maxResults: 1 },
          mapper: {},
          metadata: { designer: { x: 0, y: 0, name: 'Webhook Agilotext' } }
        },
        {
          id: 2,
          module: 'util:SetVariables',
          version: 1,
          parameters: {},
          mapper: {
            variables: [
              { name: 'meeting_title', value: '{{1.filename}}' },
              { name: 'meeting_date', value: '{{1.dateTime}}' },
              {
                name: 'page_content',
                value:
                  '# Résumé\\n\\n{{1.summary}}\\n\\n---\\n\\n# Transcription complète\\n\\n{{1.transcript}}\\n\\n---\\n\\nCréé automatiquement par Agilotext'
              }
            ]
          },
          metadata: { designer: { x: 240, y: 0, name: 'Formatter' } }
        },
        {
          id: 3,
          module: 'notion:createAPage',
          version: 1,
          parameters: { __IMTCONN__: 'VOTRE_CONNEXION_NOTION' },
          mapper: {
            parent: 'VOTRE_DATABASE_NOTION',
            title: '{{2.meeting_date}} - {{2.meeting_title}}',
            content: '{{2.page_content}}'
          },
          metadata: { designer: { x: 520, y: 0, name: 'Create Notion Page' } }
        }
      ],
      ___INSTRUCTIONS___: {
        fr: {
          objectif: 'Créer automatiquement une page Notion quand le compte-rendu est prêt.',
          etape_1: 'Importez ce blueprint dans Make.',
          etape_2: 'Créez le webhook du module 1 puis collez son URL dans Agilotext > Intégrations.',
          etape_3: 'Cliquez sur Run once pour capter un premier payload Agilotext.',
          etape_4: 'Connectez Notion sur le module Create Notion Page.',
          etape_5: 'Choisissez votre base de données Notion.',
          note: 'Email de référence pour ce blueprint : ' + safeEmail
        }
      },
      ___NOTION_FORMAT___: {
        title: '{{date}} - {{meeting_title}}',
        content: ['# Résumé', '{{summary}}', '---', '# Transcription complète', '{{transcript}}', '---', 'Créé automatiquement par Agilotext']
      }
    };
  }

  function getZapierNotionGuideHtml(email, token) {
    var safeEmail = escapeHtml(email || 'votre@email.fr');
    var safeToken = escapeHtml(token || 'auto_xxxxxxxx');
    return (
      '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Agilotext + Zapier + Notion</title>' +
      '<style>body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:900px;margin:32px auto;padding:0 20px;line-height:1.6;color:#1f2937}h1,h2{color:#174a96}code,pre{background:#f8f9fa;border:1px solid #e5e7eb;border-radius:6px}code{padding:2px 6px}pre{padding:16px;overflow:auto}ol{padding-left:20px}.box{background:#f8fbff;border-left:4px solid #174a96;padding:16px;border-radius:8px;margin:20px 0}</style></head><body>' +
      '<h1>Agilotext → Zapier → Notion</h1>' +
      '<p>Objectif : créer automatiquement une page Notion quand votre compte-rendu Agilotext est prêt.</p>' +
      '<h2>Étapes</h2><ol>' +
      '<li>Dans Zapier, créez un nouveau Zap.</li>' +
      '<li>Choisissez <strong>Webhooks by Zapier</strong> comme trigger ou action de réception selon votre organisation.</li>' +
      '<li>Copiez l’URL de webhook générée par Zapier.</li>' +
      '<li>Dans Agilotext &gt; Intégrations, collez cette URL dans la section webhook et enregistrez-la.</li>' +
      '<li>Ajoutez ensuite une action <strong>Notion – Create Database Item / Create Page</strong>.</li>' +
      '<li>Connectez votre compte Notion puis choisissez votre base de données.</li>' +
      '<li>Mappez le titre et le contenu selon le format conseillé ci-dessous.</li>' +
      '</ol>' +
      '<div class="box"><strong>Format recommandé</strong><br>Titre : <code>{{date}} - {{meeting_title}}</code><br>Contenu : Résumé, puis transcription complète, puis mention Agilotext.</div>' +
      '<h2>Champs utiles</h2><ul>' +
      '<li><code>username</code> : ' + safeEmail + '</li>' +
      '<li><code>automationToken</code> : ' + safeToken + '</li>' +
      '<li><code>agilotextType</code> : filtrer sur <code>SUMMARY</code> en priorité</li>' +
      '<li><code>fileUrl</code> : lien de téléchargement si vous voulez aussi stocker le PDF</li>' +
      '</ul>' +
      '<h2>Si vous devez envoyer un fichier à Agilotext depuis Zapier</h2>' +
      '<pre>POST https://api.agilotext.com/api/v1/sendFromAutomation\nContent-Type: application/x-www-form-urlencoded\n\nusername=' + safeEmail + '\nautomationToken=' + safeToken + '\nurl=https://exemple.com/fichier.mp3</pre>' +
      '<p>Body type : <strong>x-www-form-urlencoded</strong>, pas <strong>form-data</strong>.</p>' +
      '</body></html>'
    );
  }

  function bindNotionButtons() {
    var makeBtn = $('#agilo-notion-make-btn');
    var zapierBtn = $('#agilo-notion-zapier-btn');
    if (makeBtn) makeBtn.addEventListener('click', function () { showNotionPanel('make'); });
    if (zapierBtn) zapierBtn.addEventListener('click', function () { showNotionPanel('zapier'); });

    var makeDownload = $('#download-make-notion-blueprint');
    if (makeDownload) {
      makeDownload.addEventListener('click', function () {
        var email = getEmailNow();
        downloadJsonFile('agilotext-make-notion-blueprint.json', getMakeNotionBlueprint(email));
      });
    }

    var zapierGuide = $('#download-zapier-notion-guide');
    if (zapierGuide) {
      zapierGuide.addEventListener('click', function () {
        var email = getEmailNow();
        var token = getStoredAutomationToken(email);
        downloadTextFile('agilotext-zapier-notion-guide.html', getZapierNotionGuideHtml(email, token), 'text/html;charset=utf-8');
      });
    }
  }

  function bindCopyApiEndpoint() {
    var apiEndpoint = $('#api-endpoint');
    if (!apiEndpoint) return;
    function flashCopied() {
      var oldBorder = apiEndpoint.style.borderColor;
      var oldBg = apiEndpoint.style.background;
      apiEndpoint.style.borderColor = 'var(--color--vert, #1c661a)';
      apiEndpoint.style.background = 'rgba(28, 102, 26, 0.05)';
      setTimeout(function () {
        apiEndpoint.style.borderColor = oldBorder || 'var(--color--gris-clair, #e0e0e0)';
        apiEndpoint.style.background = oldBg || 'var(--color--white, #fff)';
      }, 900);
    }
    apiEndpoint.addEventListener('click', function () {
      copyText(apiEndpoint.textContent).then(flashCopied);
    });
    apiEndpoint.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        copyText(apiEndpoint.textContent).then(flashCopied);
      }
    });
  }

  function bindTokenActions() {
    var tokenInput = $('#automation-token');
    var generateBtn = $('#generate-automation-token');
    var copyBtn = $('#copy-automation-token');
    var revokeBtn = $('#revoke-automation-token');
    var tokenSuccess = $('#automation-token-success');
    var tokenSuccessText = $('#automation-token-success-text');
    var tokenError = $('#automation-token-error');
    var tokenErrorText = $('#automation-token-error-text');

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        if (!tokenInput || !tokenInput.value) return;
        copyText(tokenInput.value).then(function () {
          var textNode = copyBtn.querySelector('div') || copyBtn;
          var original = textNode.textContent;
          textNode.textContent = 'Copié !';
          setTimeout(function () { textNode.textContent = original; }, 1200);
        });
      });
    }

    if (revokeBtn) {
      revokeBtn.addEventListener('click', function () {
        if (!confirm('Supprimer cette clé ?\n\nVos automatisations cesseront de fonctionner.')) return;
        var email = getEmailNow();
        if (email) localStorage.removeItem('agilo:automationToken:' + String(email).toLowerCase());
        if (tokenInput) {
          tokenInput.value = '';
          tokenInput.placeholder = "Cliquez sur 'Générer ma clé'";
        }
        setTokenUiState(false);
        setMessage(tokenSuccess, '', false);
        setMessage(tokenError, '', false);
      });
    }

    if (generateBtn) {
      generateBtn.addEventListener('click', function (event) {
        event.preventDefault();
        var email = getEmailNow();
        if (!email) {
          setMessage(tokenError, 'Email non trouvé. Veuillez rafraîchir la page.', true);
          setMessage(tokenSuccess, '', false);
          return;
        }
        var existingToken = getStoredAutomationToken(email);
        if (existingToken) {
          var ok = confirm(
            "⚠️ ATTENTION : Générer une nouvelle clé d'automatisation\n\nCela désactivera les clés précédentes. Voulez-vous continuer ?"
          );
          if (!ok) return;
        }
        withButtonLoading(generateBtn, 'Génération...', function () {
          return getSessionToken(email).then(function (token) {
            if (!token) throw new Error('Session expirée. Veuillez vous reconnecter.');
            var edition = getEdition();
            return retryIfInvalidToken(email, function () {
              return postForm('/getNewAutomationToken', {
                username: email,
                token: window.globalToken || token,
                edition: edition
              });
            }).then(function (data) {
              if (data && data.status === 'OK' && data.automationToken) {
                localStorage.setItem('agilo:automationToken:' + String(email).toLowerCase(), data.automationToken);
                if (tokenInput) tokenInput.value = String(data.automationToken);
                setTokenUiState(true);
                if (tokenSuccessText) tokenSuccessText.textContent = 'Clé générée ! Copiez-la et collez-la dans votre scénario Make/Zapier/n8n.';
                setMessage(tokenSuccess, '', true);
                setMessage(tokenError, '', false);
                return;
              }
              throw new Error((data && data.errorMessage) || 'Erreur lors de la génération');
            });
          });
        }).catch(function (err) {
          setMessage(tokenError, err && err.message ? err.message : 'Erreur lors de la génération.', true);
          setMessage(tokenSuccess, '', false);
        });
      });
    }
  }

  function bindWebhookActions() {
    var webhookSave = $('#save-webhook-config');
    var webhookUrl = $('#webhook-url');
    var webhookProvider = $('#webhook-provider');
    var webhookSuccess = $('#webhook-success-message');
    var webhookError = $('#webhook-error-message');
    var webhookErrorText = $('#webhook-error-text');
    var placeholders = {
      Make: 'https://hook.make.com/...',
      Zapier: 'https://hooks.zapier.com/hooks/catch/...',
      n8n: 'https://votre-instance.n8n.cloud/webhook/...'
    };

    if (webhookProvider && webhookUrl) {
      webhookProvider.addEventListener('change', function () {
        webhookUrl.placeholder = placeholders[webhookProvider.value] || '';
      });
    }

    if (!webhookSave) return;
    webhookSave.addEventListener('click', function (event) {
      event.preventDefault();
      var url = webhookUrl ? String(webhookUrl.value || '').trim() : '';
      if (!url) {
        if (webhookErrorText) webhookErrorText.textContent = "Veuillez saisir l'URL de votre webhook.";
        setMessage(webhookError, '', true);
        setMessage(webhookSuccess, '', false);
        return;
      }
      var email = getEmailNow();
      if (!email) {
        if (webhookErrorText) webhookErrorText.textContent = 'Email non trouvé. Veuillez rafraîchir la page.';
        setMessage(webhookError, '', true);
        setMessage(webhookSuccess, '', false);
        return;
      }
      withButtonLoading(webhookSave, 'Test en cours...', function () {
        return getSessionToken(email).then(function (token) {
          if (!token) throw new Error('Session expirée. Veuillez vous reconnecter.');
          var edition = getEdition();
          var provider = PROVIDER_MAP[(webhookProvider && webhookProvider.value) || 'Make'] || 'MAKE_PROVIDER';
          return retryIfInvalidToken(email, function () {
            return postForm('/webhookCreate', {
              username: email,
              token: window.globalToken || token,
              edition: edition,
              automationProvider: provider,
              webhookMakeUrl: url
            });
          }).then(function (data) {
            if (data && data.status === 'OK') {
              localStorage.setItem('agilo:webhookUrl:' + String(email).toLowerCase(), url);
              localStorage.setItem('agilo:webhookProvider:' + String(email).toLowerCase(), (webhookProvider && webhookProvider.value) || 'Make');
              setMessage(webhookSuccess, '', true);
              setMessage(webhookError, '', false);
              return;
            }
            throw new Error((data && data.errorMessage) || 'Erreur lors du test du webhook');
          });
        });
      }).catch(function (err) {
        if (webhookErrorText) webhookErrorText.textContent = err && err.message ? err.message : "Erreur lors de l'enregistrement.";
        setMessage(webhookError, '', true);
        setMessage(webhookSuccess, '', false);
      });
    });
  }

  function bindBlueprintDownloads() {
    var downloadMakeBtn = $('#download-make-blueprint');
    var downloadMakeReceptionBtn = $('#download-make-reception');
    var downloadN8nBtn = $('#download-n8n-blueprint');

    if (downloadMakeBtn) {
      downloadMakeBtn.addEventListener('click', function () {
        var email = getEmailNow();
        var automationToken = getStoredAutomationToken(email);
        downloadJsonFile('agilotext-make-envoi.json', getMakeBlueprint(email, automationToken));
      });
    }

    if (downloadMakeReceptionBtn) {
      downloadMakeReceptionBtn.addEventListener('click', function () {
        downloadJsonFile('agilotext-make-reception.json', getMakeBlueprintReception());
      });
    }

    if (downloadN8nBtn) {
      downloadN8nBtn.addEventListener('click', function () {
        var email = getEmailNow();
        var automationToken = getStoredAutomationToken(email);
        downloadJsonFile('agilotext-n8n-workflow.json', getN8nBlueprint(email, automationToken));
      });
    }
  }

  function initUiFromStorage(email) {
    var tokenInput = $('#automation-token');
    var displayEmail = $('#display-email');
    var generateBtn = $('#generate-automation-token');
    var webhookUrl = $('#webhook-url');
    var webhookProvider = $('#webhook-provider');

    if (generateBtn) generateBtn.disabled = !email;
    if (displayEmail && email) displayEmail.textContent = email;
    if (tokenInput) tokenInput.placeholder = email ? "Cliquez sur 'Générer ma clé'" : 'Erreur: utilisateur non connecté';

    if (email) {
      localStorage.setItem('agilo:username', email);
      var storedToken = getStoredAutomationToken(email);
      if (storedToken && tokenInput) tokenInput.value = storedToken;
      setTokenUiState(!!storedToken);

      if (webhookUrl) {
        var savedUrl = localStorage.getItem('agilo:webhookUrl:' + String(email).toLowerCase());
        if (savedUrl) webhookUrl.value = savedUrl;
      }
      if (webhookProvider) {
        var savedProvider = localStorage.getItem('agilo:webhookProvider:' + String(email).toLowerCase());
        if (savedProvider) webhookProvider.value = savedProvider;
      }
    } else {
      setTokenUiState(false);
    }
  }

  onReady(function () {
    bindNotionButtons();
    bindCopyApiEndpoint();
    bindTokenActions();
    bindWebhookActions();
    bindBlueprintDownloads();

    waitForEmail(5000).then(function (email) {
      initUiFromStorage(email);
    });

    window.AgiloIntegrations = {
      version: window.__agiloIntegrationsUiVersion,
      getEmail: getEmailNow,
      getEdition: getEdition,
      getSessionToken: getSessionToken,
      downloadMakeBlueprint: function () {
        var email = getEmailNow();
        downloadJsonFile('agilotext-make-envoi.json', getMakeBlueprint(email, getStoredAutomationToken(email)));
      },
      downloadMakeNotionBlueprint: function () {
        downloadJsonFile('agilotext-make-notion-blueprint.json', getMakeNotionBlueprint(getEmailNow()));
      },
      downloadZapierNotionGuide: function () {
        var email = getEmailNow();
        downloadTextFile('agilotext-zapier-notion-guide.html', getZapierNotionGuideHtml(email, getStoredAutomationToken(email)), 'text/html;charset=utf-8');
      }
    };

    log('Script chargé', window.__agiloIntegrationsUiVersion);
  });
})();
