(function () {
  'use strict';

  if (window.__agiloReferralTrackingDashboard) return;
  window.__agiloReferralTrackingDashboard = true;

  var VERSION = '1.5.7';
  var REFRESH_INTERVAL_MS = 15000;

  function q(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function asText(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  function setNodeText(selector, value) {
    qa(selector).forEach(function (node) {
      node.textContent = String(value);
    });
  }

  function setNodeTextIn(root, selectors, value) {
    if (!root || !selectors || !selectors.length) return;
    selectors.forEach(function (selector) {
      qa(selector, root).forEach(function (node) {
        node.textContent = String(value);
      });
    });
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function toSafeInt(value, fallback) {
    var n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.floor(n));
  }

  function readBodyConfig(name, fallback) {
    var value = asText(document.body && document.body.getAttribute(name));
    return value || fallback;
  }

  function readBodyConfigInt(name, fallback) {
    return toSafeInt(readBodyConfig(name, String(fallback)), fallback);
  }

  function computeRewardState(registered, paid, target) {
    var safeTarget = Math.max(1, toSafeInt(target, 3));
    var progress = clamp(toSafeInt(paid, 0), 0, safeTarget);
    var conversionPct = registered > 0 ? Math.round((paid / registered) * 100) : 0;
    var rewardPct = Math.round((progress / safeTarget) * 100);
    var status;

    if (progress >= safeTarget) {
      status = 'unlocked';
    } else if (progress === safeTarget - 1) {
      status = 'almost';
    } else if (progress > 0) {
      status = 'started';
    } else {
      status = 'empty';
    }

    return {
      target: safeTarget,
      progress: progress,
      rewardPct: clamp(rewardPct, 0, 100),
      conversionPct: clamp(conversionPct, 0, 100),
      status: status
    };
  }

  function computeRewardHint(rewardState, registered, paid) {
    if (!rewardState || rewardState.status === 'empty') {
      if (registered > 0) {
        return 'Vous avez déjà des inscrits. Prochaine étape : les accompagner vers Pro / Business pour débloquer la récompense.';
      }
      return 'Partagez votre lien pour obtenir vos premiers inscrits et démarrer la progression vers 1 mois offert.';
    }

    if (rewardState.status === 'started') {
      return 'Bon rythme : continuez à accompagner vos filleuls jusqu\'au plan Pro / Business pour accélérer la progression.';
    }

    if (rewardState.status === 'almost') {
      return 'Vous êtes à une étape du mois offert. Un filleul payant supplémentaire débloque la récompense.';
    }

    if (rewardState.status === 'unlocked') {
      return 'Bravo, objectif atteint. Votre récompense est débloquée et en cours de validation.';
    }

    if (paid > 0) {
      return 'Excellent : votre programme ambassadeur convertit déjà en abonnements Pro / Business.';
    }

    return 'Partagez votre lien pour démarrer vos premiers parrainages.';
  }

  function buildClaimMailto(state, rewardState, rewardLabel) {
    var toEmail = readBodyConfig('data-agilo-ref-reward-claim-email', 'contact@agilotext.com');
    var subjectBase = readBodyConfig('data-agilo-ref-reward-claim-subject', 'Réclamation mois offert ambassadeur');
    var memberId = asText(state && state.currentMemberId) || '-';
    var inviteCode = asText(state && state.inviteCode) || '-';
    var paid = toSafeInt(state && state.referralsPaid, 0);
    var registered = toSafeInt(state && state.referralsRegistered, 0);
    var target = toSafeInt(rewardState && rewardState.target, 3);
    var rewardName = asText(rewardLabel) || '1 mois offert';
    var subject = subjectBase + ' - ' + memberId;
    var body = [
      'Bonjour équipe Agilotext,',
      '',
      'Je souhaite réclamer ma récompense ambassadeur : ' + rewardName + '.',
      '',
      'Infos:',
      '- Member ID: ' + memberId,
      '- Invite code: ' + inviteCode,
      '- Progression payants: ' + String(paid) + '/' + String(target),
      '- Conversion: ' + String(registered > 0 ? Math.round((paid / registered) * 100) : 0) + '% (' + String(paid) + '/' + String(registered) + ')',
      '',
      'Merci !'
    ].join('\n');
    var safeTo = asText(toEmail) || 'contact@agilotext.com';
    return 'mailto:' + safeTo + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }

  function computeSecondaryHint(rewardState, registered, paid, pending, rewardTarget) {
    var target = Math.max(1, toSafeInt(rewardTarget, 3));
    if ((rewardState && rewardState.status === 'unlocked') || paid >= target) {
      return 'Récompense débloquée : utilisez le bouton ci-dessous pour envoyer votre demande à notre équipe.';
    }
    if (registered <= 0) {
      return 'Partagez votre lien d\'invitation pour lancer vos premiers parrainages.';
    }
    if (pending > 0) {
      return String(pending) + ' contact(s) à convertir vers Pro / Business. Une relance peut débloquer votre progression.';
    }
    if (paid > 0) {
      return 'Votre base convertit déjà. Continuez pour atteindre le seuil de 3 payants.';
    }
    return 'Vous avez des inscrits. Prochaine étape : les aider à activer un abonnement Pro / Business.';
  }

  async function copyToClipboard(text) {
    var value = asText(text);
    if (!value) return false;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch (_errClipboard) {
        // Fallback below.
      }
    }
    try {
      var input = document.createElement('input');
      input.value = value;
      input.setAttribute('readonly', 'readonly');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      input.setSelectionRange(0, value.length);
      var ok = document.execCommand('copy');
      document.body.removeChild(input);
      return Boolean(ok);
    } catch (_errExec) {
      return false;
    }
  }

  function parseReferralsLeadsJson(raw) {
    if (raw !== null && raw !== undefined && typeof raw === 'object') {
      try {
        raw = JSON.stringify(raw);
      } catch (_errStringifyLeads) {
        raw = '';
      }
    }
    var text = asText(raw);
    if (!text) return [];
    try {
      var data = JSON.parse(text);
      if (!Array.isArray(data)) return [];
      var rows = data
        .filter(function (row) {
          return row && typeof row === 'object' && asText(row.id);
        })
        .map(function (row) {
          return {
            id: asText(row.id),
            email: asText(row.email),
            firstName: asText(row.firstName),
            lastName: asText(row.lastName),
            paid: Boolean(row.paid),
            capturedAt: asText(row.capturedAt)
          };
        });
      rows.sort(function (a, b) {
        return String(b.capturedAt || '').localeCompare(String(a.capturedAt || ''));
      });
      return rows;
    } catch (_errParseLeads) {
      return [];
    }
  }

  function formatLeadCapturedAt(iso) {
    var raw = asText(iso);
    if (!raw) return '—';
    try {
      var d = new Date(raw);
      if (!Number.isFinite(d.getTime())) return '—';
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (_errDate) {
      return '—';
    }
  }

  function getLeadReminderDraft(lead) {
    var email = asText(lead && lead.email);
    if (!email || email.indexOf('@') < 0) return null;
    var subject = readBodyConfig(
      'data-agilo-ref-lead-remind-subject',
      'Agilotext — apps mobiles, Chrome et offres Pro / Business'
    );
    var loginUrl = readBodyConfig(
      'data-agilo-ref-lead-remind-login-url',
      'https://www.agilotext.com/auth/login'
    );
    var first = asText(lead && lead.firstName);
    var greet = first ? 'Bonjour ' + first + ',' : 'Bonjour,';
    var body =
      greet +
      '\n\n' +
      'J’espère que vous allez bien.\n\n' +
      'Merci encore pour votre inscription via mon lien de parrainage. Agilotext a encore évolué depuis : nous avons une extension Chrome, des applications mobiles, et la reconnaissance des intervenants qui fonctionne très bien sur les enregistrements du quotidien.\n\n' +
      'Pour vous reconnecter et tout retrouver dans votre espace :\n' +
      loginUrl +
      '\n\n' +
      'Si vous envisagez une offre payante, Pro et Business sont celles qui débloquent le plus de confort et de précision.\n' +
      '— Pro : idéal pour un usage régulier avec déjà beaucoup de fonctionnalités avancées.\n' +
      '— Business : encore au-dessus pour les usages exigeants ; nous nous appuyons sur Mistral AI, particulièrement pertinent pour le français et les réunions avec plusieurs intervenants (prise en compte fine des tours de parole et du vocabulaire métier).\n\n' +
      'Je reste disponible avec plaisir si vous souhaitez qu’on regarde ensemble ce qui vous correspond le mieux.\n\n' +
      'Bien cordialement';
    return { email: email, subject: subject, body: body };
  }

  function formatLeadReminderForClipboard(draft) {
    if (!draft) return '';
    return (
      'A : ' +
      draft.email +
      '\nObjet : ' +
      draft.subject +
      '\n\n---\n\n' +
      draft.body
    );
  }

  function buildLeadComposeUrls(draft) {
    if (!draft || !asText(draft.email)) return null;
    var email = asText(draft.email);
    var subject = draft.subject != null ? String(draft.subject) : '';
    var body = draft.body != null ? String(draft.body) : '';
    var su = encodeURIComponent(subject);
    var bt = encodeURIComponent(body);
    var toEnc = encodeURIComponent(email);
    return {
      gmail:
        'https://mail.google.com/mail/?view=cm&fs=1&to=' +
        toEnc +
        '&su=' +
        su +
        '&body=' +
        bt,
      outlook:
        'https://outlook.office.com/mail/deeplink/compose?to=' +
        toEnc +
        '&subject=' +
        su +
        '&body=' +
        bt,
      mailto:
        'mailto:' +
        encodeURIComponent(email) +
        '?subject=' +
        su +
        '&body=' +
        bt
    };
  }

  function attachLeadReminderMessageToolbar(tdRemind, lead) {
    var draft = getLeadReminderDraft(lead);
    if (!draft) return;
    var urls = buildLeadComposeUrls(draft);
    if (!urls) return;

    var copyIconDefault =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" class="agilo-ref-leads-icon"><path fill="none" d="M0 0h24v24H0z"></path><rect fill="none" height="24" width="24"></rect><path fill="currentColor" d="M18,2H9C7.9,2,7,2.9,7,4v12c0,1.1,0.9,2,2,2h9c1.1,0,2-0.9,2-2V4C20,2.9,19.1,2,18,2z M18,16H9V4h9V16z M3,15v-2h2v2H3z M3,9.5h2v2H3V9.5z M10,20h2v2h-2V20z M3,18.5v-2h2v2H3z M5,22c-1.1,0-2-0.9-2-2h2V22z M8.5,22h-2v-2h2V22z M13.5,22L13.5,22l0-2h2v0C15.5,21.1,14.6,22,13.5,22z M5,6L5,6l0,2H3v0C3,6.9,3.9,6,5,6z"></path></svg>';
    var copyIconChecked =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" class="agilo-ref-leads-icon"><path fill="none" d="M0 0h24v24H0z"></path><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path></svg>';
    var gmailSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="52 42 88 66" width="20" height="20" class="agilo-ref-leads-logo-gmail"><path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6"/><path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15"/><path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2"/><path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92"/><path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2"/></svg>';
    var outlookSvg =
      '<img src="https://cdn.prod.website-files.com/6815bee5a9c0b57da18354fb/6995e36911a4849150741ca6_Microsoft_Office_Outlook_(2018%E2%80%932024).svg" width="20" height="20" alt="" class="agilo-ref-leads-logo-outlook">';
    var defaultMailSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" class="agilo-ref-leads-logo-default"><path fill-rule="evenodd" clip-rule="evenodd" fill="currentColor" d="M3.75 5.25L3 6V18L3.75 18.75H20.25L21 18V6L20.25 5.25H3.75ZM4.5 7.6955V17.25H19.5V7.69525L11.9999 14.5136L4.5 7.6955ZM18.3099 6.75H5.68986L11.9999 12.4864L18.3099 6.75Z"/></svg>';

    var tools = document.createElement('div');
    tools.className = 'agilo-referral-leads__msg-tools';

    var copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'agilo-referral-leads__msg-tool-btn agilo-referral-leads__msg-tool-btn--copy';
    copyBtn.setAttribute(
      'aria-label',
      'Copier un brouillon de relance pour ' + (asText(lead.email) || 'ce contact')
    );
    copyBtn.setAttribute('title', 'Copier le mail');
    copyBtn.innerHTML = copyIconDefault;
    copyBtn.addEventListener('click', function () {
      var d = getLeadReminderDraft(lead);
      if (!d) return;
      copyToClipboard(formatLeadReminderForClipboard(d)).then(function (ok) {
        if (ok) {
          copyBtn.classList.add('is-copied');
          copyBtn.innerHTML = copyIconChecked;
          setTimeout(function () {
            copyBtn.classList.remove('is-copied');
            copyBtn.innerHTML = copyIconDefault;
          }, 2000);
        }
      });
    });

    var openWrap = document.createElement('div');
    openWrap.className = 'agilo-referral-leads__open-wrap';
    var openTrigger = document.createElement('button');
    openTrigger.type = 'button';
    openTrigger.className = 'agilo-referral-leads__msg-tool-btn agilo-referral-leads__msg-tool-btn--open';
    openTrigger.setAttribute('aria-label', 'Ouvrir dans Gmail, Outlook ou l’app mail');
    openTrigger.setAttribute('title', 'Ouvrir dans Gmail, Outlook ou l’app mail');
    openTrigger.setAttribute('aria-haspopup', 'menu');
    openTrigger.setAttribute('aria-expanded', 'false');
    openTrigger.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="agilo-ref-leads-icon agilo-ref-leads-send-icon"><path d="M10.3009 13.6949L20.102 3.89742M10.5795 14.1355L12.8019 18.5804C13.339 19.6545 13.6075 20.1916 13.9458 20.3356C14.2394 20.4606 14.575 20.4379 14.8492 20.2747C15.1651 20.0866 15.3591 19.5183 15.7472 18.3818L19.9463 6.08434C20.2845 5.09409 20.4535 4.59896 20.3378 4.27142C20.2371 3.98648 20.013 3.76234 19.7281 3.66167C19.4005 3.54595 18.9054 3.71502 17.9151 4.05315L5.61763 8.2523C4.48114 8.64037 3.91289 8.83441 3.72478 9.15032C3.56153 9.42447 3.53891 9.76007 3.66389 10.0536C3.80791 10.3919 4.34498 10.6605 5.41912 11.1975L9.86397 13.42C10.041 13.5085 10.1295 13.5527 10.2061 13.6118C10.2742 13.6643 10.3352 13.7253 10.3876 13.7933C10.4468 13.87 10.491 13.9585 10.5795 14.1355Z"/></svg>';

    var dropdown = document.createElement('div');
    dropdown.className = 'agilo-referral-leads__dropdown';
    dropdown.hidden = true;
    dropdown.setAttribute('role', 'menu');

    var menuItems = [
      { label: 'Gmail', url: urls.gmail, external: true, icon: gmailSvg },
      { label: 'Outlook', url: urls.outlook, external: true, icon: outlookSvg },
      { label: 'App mail par défaut', url: urls.mailto, external: false, icon: defaultMailSvg }
    ];

    var scrollRoots = [];
    function pushScrollRoot(el) {
      if (!el || scrollRoots.indexOf(el) >= 0) return;
      scrollRoots.push(el);
    }
    pushScrollRoot(openWrap.closest('.agilo-referral-modal'));
    pushScrollRoot(openWrap.closest('.agilo-referral-modal__panel'));
    pushScrollRoot(openWrap.closest('.agilo-referral-leads__scroll'));

    function clearDropdownFixedStyles() {
      dropdown.style.position = '';
      dropdown.style.left = '';
      dropdown.style.top = '';
      dropdown.style.right = '';
      dropdown.style.bottom = '';
      dropdown.style.zIndex = '';
      dropdown.style.margin = '';
    }

    function measureAndPlaceDropdown() {
      if (dropdown.hidden) return;
      var rect = openWrap.getBoundingClientRect();
      var gap = 6;
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      var mw = dropdown.offsetWidth || 200;
      var mh = dropdown.offsetHeight || 140;
      var left = rect.right - mw;
      if (left < gap) left = gap;
      if (left + mw > vw - gap) left = Math.max(gap, vw - mw - gap);
      var top = rect.top - mh - gap;
      if (top < gap) {
        top = rect.bottom + gap;
      }
      if (top + mh > vh - gap) {
        top = Math.max(gap, vh - mh - gap);
      }
      dropdown.style.position = 'fixed';
      dropdown.style.left = left + 'px';
      dropdown.style.top = top + 'px';
      dropdown.style.right = 'auto';
      dropdown.style.bottom = 'auto';
      dropdown.style.margin = '0';
      dropdown.style.zIndex = '2147483647';
    }

    function onScrollOrResizeReposition() {
      measureAndPlaceDropdown();
    }

    function bindDropdownScrollReposition() {
      scrollRoots.forEach(function (el) {
        el.addEventListener('scroll', onScrollOrResizeReposition, true);
      });
      window.addEventListener('scroll', onScrollOrResizeReposition, true);
      window.addEventListener('resize', onScrollOrResizeReposition);
    }

    function unbindDropdownScrollReposition() {
      scrollRoots.forEach(function (el) {
        el.removeEventListener('scroll', onScrollOrResizeReposition, true);
      });
      window.removeEventListener('scroll', onScrollOrResizeReposition, true);
      window.removeEventListener('resize', onScrollOrResizeReposition);
    }

    function closeDropdown() {
      dropdown.hidden = true;
      openTrigger.setAttribute('aria-expanded', 'false');
      clearDropdownFixedStyles();
      unbindDropdownScrollReposition();
      document.removeEventListener('click', closeDropdown);
      document.removeEventListener('keydown', onEscape);
    }

    function openDropdownUi() {
      dropdown.hidden = false;
      requestAnimationFrame(function () {
        measureAndPlaceDropdown();
        requestAnimationFrame(measureAndPlaceDropdown);
      });
      bindDropdownScrollReposition();
      setTimeout(function () {
        document.addEventListener('click', closeDropdown);
        document.addEventListener('keydown', onEscape);
      }, 0);
    }

    function onEscape(ev) {
      if (ev.key === 'Escape' || ev.keyCode === 27) {
        closeDropdown();
      }
    }

    menuItems.forEach(function (item) {
      var a = document.createElement('a');
      a.href = item.url;
      if (item.external) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
      a.className = 'agilo-referral-leads__dropdown-item';
      a.setAttribute('role', 'menuitem');
      a.innerHTML =
        '<span class="agilo-referral-leads__dropdown-icon">' +
        item.icon +
        '</span><span>' +
        item.label +
        '</span>';
      a.addEventListener('click', function () {
        closeDropdown();
      });
      dropdown.appendChild(a);
    });

    openTrigger.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var willShow = dropdown.hidden;
      if (!willShow) {
        closeDropdown();
        return;
      }
      openTrigger.setAttribute('aria-expanded', 'true');
      openDropdownUi();
    });

    dropdown.addEventListener('click', function (e) {
      e.stopPropagation();
    });

    openWrap.appendChild(openTrigger);
    openWrap.appendChild(dropdown);
    tools.appendChild(copyBtn);
    tools.appendChild(openWrap);
    tdRemind.appendChild(tools);
  }

  function leadsPanelDefaultOpen() {
    return /^true$/i.test(readBodyConfig('data-agilo-ref-leads-default-open', ''));
  }

  function renderReferralsLeads(modal, leads) {
    var section = q('[data-agilo-ref-leads-section]', modal);
    var tbody = q('[data-agilo-ref-leads-tbody]', modal);
    var toggle = q('[data-agilo-ref-leads-toggle]', modal);
    var panel = q('[data-agilo-ref-leads-panel]', modal);
    var countEl = q('[data-agilo-ref-leads-count]', modal);
    if (!section || !tbody) return;
    while (tbody.firstChild) {
      tbody.removeChild(tbody.firstChild);
    }
    if (!leads || !leads.length) {
      section.hidden = true;
      return;
    }
    section.hidden = false;
    var n = leads.length;
    if (countEl) countEl.textContent = '(' + String(n) + ')';

    var userPref = modal && modal.__agiloLeadsUserExpanded;
    var openFirst = typeof userPref === 'boolean' ? userPref : leadsPanelDefaultOpen();
    if (toggle) {
      toggle.setAttribute('aria-expanded', openFirst ? 'true' : 'false');
    }
    if (panel) {
      panel.hidden = !openFirst;
      section.classList.toggle('is-open', openFirst);
    }

    leads.forEach(function (lead) {
      var tr = document.createElement('tr');
      var tdName = document.createElement('td');
      var tdEmail = document.createElement('td');
      var tdDate = document.createElement('td');
      var tdStat = document.createElement('td');
      var tdRemind = document.createElement('td');
      var labelName = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim();
      tdName.textContent = labelName || '—';
      tdEmail.textContent = lead.email || '—';
      tdDate.textContent = formatLeadCapturedAt(lead.capturedAt);
      var badge = document.createElement('span');
      badge.className = 'agilo-referral-leads__badge ' + (lead.paid ? 'is-paid' : 'is-free');
      badge.textContent = lead.paid ? 'Payant' : 'Gratuit · à convertir';
      tdStat.appendChild(badge);
      if (!lead.paid) {
        attachLeadReminderMessageToolbar(tdRemind, lead);
      }
      tr.appendChild(tdName);
      tr.appendChild(tdEmail);
      tr.appendChild(tdDate);
      tr.appendChild(tdStat);
      tr.appendChild(tdRemind);
      tbody.appendChild(tr);
    });
  }

  function buildLeadsSectionHtml() {
    return '' +
      '<section class="agilo-referral-leads" data-agilo-ref-leads-section hidden>' +
      '<button type="button" class="agilo-referral-leads__toggle" data-agilo-ref-leads-toggle aria-expanded="false" aria-controls="agiloReferralLeadsPanel" id="agiloReferralLeadsToggle">' +
      '<span class="agilo-referral-leads__toggle-inner">' +
      '<span class="agilo-referral-leads__toggle-label">Voir mes invitations</span>' +
      '<span class="agilo-referral-leads__toggle-count" data-agilo-ref-leads-count></span>' +
      '</span>' +
      '<span class="agilo-referral-leads__toggle-chevron" aria-hidden="true"></span>' +
      '</button>' +
      '<div class="agilo-referral-leads__panel" id="agiloReferralLeadsPanel" data-agilo-ref-leads-panel hidden role="region" aria-labelledby="agiloReferralLeadsToggle">' +
      '<p class="agilo-referral-leads__hint">Comptes créés via votre lien. Tri du plus récent au plus ancien. Les lignes « Gratuit » : copier le brouillon ou l’ouvrir dans Gmail, Outlook ou votre application mail (icône avion).</p>' +
      '<div class="agilo-referral-leads__scroll">' +
      '<table class="agilo-referral-leads__table" role="grid">' +
      '<thead><tr><th scope="col">Nom</th><th scope="col">Email</th><th scope="col">Inscription</th><th scope="col">Statut</th><th scope="col">Message</th></tr></thead>' +
      '<tbody data-agilo-ref-leads-tbody></tbody>' +
      '</table></div></div></section>';
  }

  function ensureLeadsSection(panel) {
    if (!panel || q('[data-agilo-ref-leads-section]', panel)) return;
    var copyWrap = q('.agilo-referral-copy', panel);
    if (copyWrap) {
      copyWrap.insertAdjacentHTML('beforebegin', buildLeadsSectionHtml());
    } else {
      var conv = q('#agiloReferralConversionSecondary', panel);
      if (conv) {
        conv.insertAdjacentHTML('beforebegin', buildLeadsSectionHtml());
      }
    }
  }

  function extractInviteCodeFromUrl(urlLike) {
    var raw = asText(urlLike);
    if (!raw) return '';
    try {
      var full = new URL(raw, window.location.origin);
      return asText(full.searchParams.get('inviteCode'));
    } catch (_error) {
      var match = raw.match(/[?&]inviteCode=([^&#]+)/i);
      if (!match || !match[1]) return '';
      try {
        return decodeURIComponent(match[1]).trim();
      } catch (_decodeError) {
        return String(match[1]).trim();
      }
    }
  }

  function readInviteFromDom() {
    var inviteNode = q('#invite-link') || q('[ms-code-invite-link]');
    if (!inviteNode) {
      return { inviteCode: '', inviteUrl: '', source: 'none' };
    }

    var inviteUrl = asText(inviteNode.getAttribute('href')) || asText(inviteNode.textContent) || asText(inviteNode.getAttribute('ms-code-copy-subject'));
    var inviteCode = extractInviteCodeFromUrl(inviteUrl);

    return {
      inviteCode: inviteCode,
      inviteUrl: inviteUrl,
      source: '#invite-link'
    };
  }

  function readMemberIdFromDom() {
    var fromInput = q('[name="memberId"]');
    var fromDataset = q('[data-ms-member="id"]');
    var fromClass = q('.data-member-id');

    var candidates = [
      fromInput && (fromInput.value || fromInput.getAttribute('src')),
      fromDataset && (fromDataset.value || fromDataset.textContent || fromDataset.getAttribute('src')),
      fromClass && (fromClass.value || fromClass.textContent || fromClass.getAttribute('src'))
    ];

    for (var i = 0; i < candidates.length; i += 1) {
      var maybe = asText(candidates[i]);
      if (maybe) return maybe;
    }
    return '';
  }

  async function readMemberFromMemberstack() {
    var ms = window.$memberstackDom;
    if (!ms) return null;

    if (typeof ms.getMember === 'function') {
      try {
        var getMemberResult = await ms.getMember();
        if (getMemberResult && getMemberResult.data) return getMemberResult.data;
      } catch (_errorGetMember) {
        // Fallback below.
      }
    }

    if (typeof ms.getCurrentMember === 'function') {
      try {
        var currentResult = await ms.getCurrentMember({ cache: 'reload' });
        if (currentResult && currentResult.data) return currentResult.data;
      } catch (_errorCurrentMember) {
        // Silent fallback.
      }
    }

    return null;
  }

  function readFieldValue(member, fieldNames) {
    if (!member) return null;
    for (var i = 0; i < fieldNames.length; i += 1) {
      var name = fieldNames[i];
      if (member[name] !== undefined && member[name] !== null) return member[name];
    }
    var customFields = member.customFields || member.custom_fields || {};
    for (var j = 0; j < fieldNames.length; j += 1) {
      var cfName = fieldNames[j];
      if (customFields[cfName] !== undefined && customFields[cfName] !== null) return customFields[cfName];
    }
    var metaData = member.metaData || member.metadata || {};
    for (var k = 0; k < fieldNames.length; k += 1) {
      var mdName = fieldNames[k];
      if (metaData[mdName] !== undefined && metaData[mdName] !== null) return metaData[mdName];
    }
    return null;
  }

  function readDomBoundValue(fieldNames) {
    for (var i = 0; i < fieldNames.length; i += 1) {
      var node = q('[data-ms-member="' + fieldNames[i] + '"]');
      if (!node) continue;
      var value = asText(node.value || node.textContent || node.getAttribute('src'));
      if (!value) continue;
      return value;
    }
    return null;
  }

  function emitState(state) {
    window.dispatchEvent(new CustomEvent('agilo:referral-state', { detail: state }));
  }

  function renderStatus(state) {
    var status = state.inviteOwnerMatchesCurrentMember ? 'ok' : 'needs_check';
    var statusLabel = status === 'ok' ? 'Lien d\'invitation valide' : 'Vérification manuelle requise';
    setNodeText('[data-agilo-referral-status-label]', statusLabel);
    setNodeText('[data-agilo-referral-status-code]', status);
  }

  function renderCounters(state) {
    setNodeText('[data-agilo-referrals-total]', state.referralsTotal);
    setNodeText('[data-agilo-referrals-month]', state.referralsMonth);
    setNodeText('[data-agilo-referrals-registered]', state.referralsRegistered);
    setNodeText('[data-agilo-referrals-paid]', state.referralsPaid);
    setNodeText('[data-agilo-referrals-pending]', state.referralsPending);
    setNodeText('[data-agilo-referrals-last-at]', state.referralsLastAt || '-');
    setNodeText('[data-agilo-referral-parent-id]', state.currentMemberId || '-');
    setNodeText('[data-agilo-referral-invite-code]', state.inviteCode || '-');
  }

  function ensureUiStyles() {
    var id = 'agilo-referral-stats-modal-style';
    var existing = q('#' + id);
    if (existing && existing.getAttribute('data-agilo-css') === VERSION) return;
    if (existing) {
      existing.remove();
    }
    var style = document.createElement('style');
    style.id = id;
    style.setAttribute('data-agilo-css', VERSION);
    style.textContent = '' +
      '.agilo-referral-widget{font-size:clamp(14px,2.8vw,16px);}' +
      '.agilo-referral-cta{margin-top:.5rem;display:inline-flex;align-items:center;justify-content:center;width:auto!important;min-height:2.125rem;padding:.4375rem .75rem!important;border-radius:.5625rem;font-size:.8125rem!important;line-height:1.2;max-width:16.25rem;}' +
      '.agilo-referral-cta.is-primary{background:#174a96;color:#fff;}' +
      '.agilo-referral-cta.is-secondary{background:#eff4fb;color:#174a96;border:1px solid rgba(23,74,150,.18);}' +
      '.agilo-referral-modal[hidden]{display:none!important;}' +
      '.agilo-referral-modal{position:fixed;inset:0;z-index:2147483000;display:flex;justify-content:center;align-items:flex-start;padding:max(1rem,env(safe-area-inset-top)) min(4vw,1rem) max(1.25rem,env(safe-area-inset-bottom));overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;}' +
      '.agilo-referral-modal__backdrop{position:absolute;inset:0;background:rgba(9,20,44,.28);min-height:100%;}' +
      '.agilo-referral-modal__panel{position:relative;z-index:1;box-sizing:border-box;width:min(94vw,42rem);max-width:100%;max-height:min(calc(100dvh - max(2rem,env(safe-area-inset-top) + env(safe-area-inset-bottom))),45rem);overflow-y:auto;-webkit-overflow-scrolling:touch;margin-bottom:auto;border-radius:1rem;background:#fff;padding:clamp(.75rem,3vw,1rem);box-shadow:0 1.25rem 3rem rgba(0,0,0,.22);border:1px solid #e6ecf5;color:#1b2430;font-family:Inter,Arial,sans-serif;font-size:1rem;line-height:1.45;}' +
      '.agilo-referral-modal__close{position:absolute;top:.5rem;right:.625rem;border:0;background:transparent;font-size:1.375rem;line-height:1;cursor:pointer;color:#526076;padding:.25rem;}' +
      '.agilo-referral-modal__title{margin:0 1.75rem .25rem 0;font-size:clamp(1.0625rem,2.8vw,1.1875rem);font-weight:700;letter-spacing:-.01em;line-height:1.2;}' +
      '.agilo-referral-modal__desc{margin:0 0 .75rem;font-size:.8125rem;color:#5b677a;line-height:1.4;}' +
      '.agilo-referral-hero{padding:.75rem;border-radius:.75rem;border:1px solid #dbe7ff;background:linear-gradient(180deg,#f6f9ff 0,#ffffff 100%);}' +
      '.agilo-referral-hero__meta{margin:0 0 .375rem;font-size:.75rem;color:#5b677a;font-weight:600;text-align:center;}' +
      '.agilo-referral-hero__progress{margin:0;text-align:center;font-size:clamp(1.5rem,5vw,1.875rem);line-height:1.05;font-weight:800;color:#174a96;}' +
      '.agilo-referral-hero__suffix{font-size:.875rem;color:#5b677a;font-weight:600;}' +
      '.agilo-referral-reward-bar{margin-top:.625rem;height:.625rem;border-radius:999px;background:#dfe8f8;overflow:hidden;}' +
      '.agilo-referral-reward-bar__fill{height:100%;width:0;background:linear-gradient(90deg,#174a96 0,#2f64bd 100%);transition:width .45s ease;}' +
      '.agilo-referral-reward-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.5rem;margin-top:.5rem;}' +
      '.agilo-referral-reward-step{padding:.3125rem 0;border:1px solid #d8e3fa;border-radius:.5rem;text-align:center;font-size:.6875rem;font-weight:700;color:#6b7890;background:#fff;}' +
      '.agilo-referral-reward-step.is-active{border-color:#174a96;color:#174a96;background:#eaf1ff;}' +
      '.agilo-referral-hero__status{margin:.625rem 0 0;font-size:.75rem;color:#2f3f57;line-height:1.45;text-align:center;font-weight:600;}' +
      '.agilo-referral-secondary{margin-top:.75rem;padding-top:.625rem;border-top:1px solid #edf2fb;}' +
      '.agilo-referral-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.5rem;}' +
      '.agilo-referral-kpi{border:1px solid #e7edf8;border-radius:.625rem;padding:.5rem .375rem;text-align:center;background:linear-gradient(180deg,#f8fbff 0,#fff 100%);}' +
      '.agilo-referral-kpi__label{font-size:.6875rem;color:#6c7890;margin:0 0 .25rem;text-transform:uppercase;letter-spacing:.03em;font-weight:600;}' +
      '.agilo-referral-kpi__value{margin:0;font-size:1.25rem;color:#174a96;font-weight:700;line-height:1.1;}' +
      '.agilo-referral-conversion-secondary{margin:.5rem 0 0;text-align:center;font-size:.75rem;color:#5b677a;font-weight:600;}' +
      '.agilo-referral-copy{margin-top:.75rem;display:flex;justify-content:center;}' +
      '.agilo-referral-copy__btn{border:1px solid rgba(23,74,150,.2);background:#f3f7ff;color:#174a96;border-radius:.625rem;padding:.5rem .75rem;font-weight:600;font-size:.8125rem;cursor:pointer;max-width:100%;}' +
      '.agilo-referral-copy__btn:disabled{opacity:.7;cursor:default;}' +
      '.agilo-referral-claim{margin-top:.5rem;display:flex;justify-content:center;}' +
      '.agilo-referral-claim[hidden]{display:none!important;}' +
      '.agilo-referral-claim__link{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border-radius:.625rem;padding:.5rem .75rem;font-weight:700;font-size:.8125rem;line-height:1.2;background:#174a96;color:#fff;border:1px solid rgba(23,74,150,.24);max-width:100%;}' +
      '.agilo-referral-claim__link:hover{background:#123a75;}' +
      '.agilo-referral-modal__hint{margin:.625rem 0 0;font-size:.75rem;color:#5b677a;line-height:1.45;}' +
      '.agilo-referral-leads{margin-top:.75rem;padding-top:.75rem;border-top:1px solid #edf2fb;}' +
      '.agilo-referral-leads__toggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:.625rem;padding:.625rem .75rem;border-radius:.6875rem;border:1px solid #d8e6fc;background:linear-gradient(180deg,#f5f8ff 0,#fff 55%);cursor:pointer;font:inherit;text-align:left;color:#174a96;font-weight:700;font-size:.8125rem;line-height:1.3;transition:background .2s,border-color .2s;}' +
      '.agilo-referral-leads__toggle:hover{background:#eaf1ff;border-color:#b8cef5;}' +
      '.agilo-referral-leads__toggle:focus{outline:2px solid rgba(23,74,150,.35);outline-offset:2px;}' +
      '.agilo-referral-leads__toggle-inner{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;}' +
      '.agilo-referral-leads__toggle-count{font-weight:600;color:#526076;font-size:.75rem;}' +
      '.agilo-referral-leads__toggle-chevron{flex-shrink:0;width:.5625rem;height:.5625rem;border-right:2px solid #174a96;border-bottom:2px solid #174a96;transform:rotate(-45deg);margin-top:-.25rem;transition:transform .25s ease;}' +
      '.agilo-referral-leads.is-open .agilo-referral-leads__toggle-chevron{transform:rotate(135deg);margin-top:.125rem;}' +
      '.agilo-referral-leads__panel{margin-top:.5rem;min-width:0;}' +
      '.agilo-referral-leads__hint{margin:0 0 .5rem;font-size:.6875rem;color:#5b677a;line-height:1.45;}' +
      '.agilo-referral-leads__scroll{overflow-x:auto;overflow-y:visible;-webkit-overflow-scrolling:touch;border:1px solid #e7edf8;border-radius:.625rem;background:#fafcff;}' +
      '.agilo-referral-leads__table{width:100%;min-width:36rem;border-collapse:collapse;font-size:.75rem;table-layout:auto;}' +
      '.agilo-referral-leads__table th,.agilo-referral-leads__table td{padding:.4375rem .5rem;text-align:left;border-bottom:1px solid #edf2fb;vertical-align:middle;}' +
      '.agilo-referral-leads__table th{font-size:.625rem;text-transform:uppercase;color:#6c7890;font-weight:700;white-space:nowrap;}' +
      '.agilo-referral-leads__table td:last-child{white-space:nowrap;text-align:right;}' +
      '.agilo-referral-leads__table th:last-child{text-align:right;}' +
      '.agilo-referral-leads__badge{display:inline-flex;align-items:center;padding:.1875rem .5rem;border-radius:999px;font-size:.6875rem;font-weight:700;max-width:100%;white-space:normal;}' +
      '.agilo-referral-leads__badge.is-paid{background:#e6f4ea;color:#13693a;}' +
      '.agilo-referral-leads__badge.is-free{background:#fff4e5;color:#8a5a00;}' +
      '.agilo-referral-leads__msg-tools{display:inline-flex;align-items:center;gap:.3125rem;flex-shrink:0;justify-content:flex-end;}' +
      '.agilo-referral-leads__open-wrap{position:relative;display:inline-flex;}' +
      '.agilo-referral-leads__msg-tool-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;width:2.25rem;height:2.25rem;padding:0;border-radius:.5rem;border:1px solid rgba(23,74,150,.22);background:#eff4fb;color:#526076;cursor:pointer;font:inherit;line-height:1;flex-shrink:0;}' +
      '.agilo-referral-leads__msg-tool-btn:hover{background:#dbe7ff;color:#123a75;border-color:rgba(23,74,150,.35);}' +
      '.agilo-referral-leads__msg-tool-btn:focus-visible{outline:2px solid rgba(23,74,150,.35);outline-offset:2px;}' +
      '.agilo-referral-leads__msg-tool-btn--open .agilo-ref-leads-send-icon{color:inherit;}' +
      '.agilo-referral-leads__msg-tool-btn--copy.is-copied{color:#13693a;background:#e6f4ea;border-color:rgba(19,105,58,.35);}' +
      '.agilo-ref-leads-icon,.agilo-ref-leads-send-icon{display:block;width:1.125rem;height:1.125rem;}' +
      '.agilo-referral-leads__dropdown{position:absolute;right:0;bottom:100%;margin-bottom:.25rem;min-width:11.25rem;padding:.375rem;border-radius:.5rem;background:#fff;border:1px solid rgba(52,58,64,.25);box-shadow:0 .125rem .5rem rgba(0,0,0,.1);z-index:2147483646;list-style:none;}' +
      '.agilo-referral-leads__dropdown[hidden]{display:none!important;}' +
      '.agilo-referral-leads__dropdown-item{display:flex;align-items:center;gap:.625rem;width:100%;padding:.5rem .625rem;border:none;border-radius:.375rem;background:transparent;color:#1b2430;font:500 .8125rem/1.3 system-ui,-apple-system,Segoe UI,Roboto;text-decoration:none;cursor:pointer;transition:background .12s;text-align:left;box-sizing:border-box;}' +
      '.agilo-referral-leads__dropdown-item:hover{background:rgba(11,18,34,.06);color:#020202;}' +
      '.agilo-referral-leads__dropdown-item:focus-visible{outline:2px solid rgba(23,74,150,.35);outline-offset:1px;}' +
      '.agilo-referral-leads__dropdown-icon{display:inline-flex;align-items:center;justify-content:center;width:1.25rem;height:1.25rem;flex-shrink:0;}' +
      '.agilo-referral-leads__dropdown-icon svg,.agilo-referral-leads__dropdown-icon img{width:1.25rem;height:1.25rem;display:block;object-fit:contain;}' +
      '.agilo-referral-leads__dropdown-icon .agilo-ref-leads-logo-default{color:#1b2430;}' +
      '.agilo-referral-gauge{display:none;}' +
      '@media (max-width:29rem){.agilo-referral-kpis{grid-template-columns:1fr;}.agilo-referral-leads__table{min-width:100%;}.agilo-referral-leads__table td:last-child,.agilo-referral-leads__table th:last-child{text-align:left;white-space:normal;}.agilo-referral-leads__msg-tools{flex-wrap:wrap;justify-content:flex-start;}}';
    document.head.appendChild(style);
  }

  function buildClaimBlockHtml() {
    return '<div class="agilo-referral-claim" data-agilo-ref-claim-wrap hidden><a class="agilo-referral-claim__link" data-agilo-ref-claim-link href="#">Réclamer mon mois offert</a></div>';
  }

  function ensureClaimBlock(panel) {
    if (!panel || q('[data-agilo-ref-claim-wrap]', panel)) return;
    var copyWrap = q('.agilo-referral-copy', panel);
    if (copyWrap) {
      copyWrap.insertAdjacentHTML('afterend', buildClaimBlockHtml());
    } else {
      panel.insertAdjacentHTML('beforeend', buildClaimBlockHtml());
    }
  }

  function buildModalPanelHtml() {
    return '' +
      '<button class="agilo-referral-modal__close" type="button" aria-label="Fermer" data-agilo-ref-close>&times;</button>' +
      '<h3 class="agilo-referral-modal__title" id="agiloReferralStatsTitle">Mes stats ambassadeur</h3>' +
      '<p class="agilo-referral-modal__desc">Objectif : 3 filleuls payants = 1 mois offert.</p>' +
      '<section class="agilo-referral-hero" data-agilo-ref-reward-status="empty">' +
      '<p class="agilo-referral-hero__meta" data-agilo-ref-reward-label-line>Objectif : 3 filleuls payants = 1 mois offert</p>' +
      '<p class="agilo-referral-hero__progress"><span data-agilo-ref-reward-progress>0</span> <span class="agilo-referral-hero__suffix">/ <span data-agilo-ref-reward-target>3</span> payants</span></p>' +
      '<div class="agilo-referral-reward-bar" role="progressbar" aria-valuemin="0" aria-valuemax="3" aria-valuenow="0">' +
      '<div class="agilo-referral-reward-bar__fill" data-agilo-ref-reward-fill></div>' +
      '</div>' +
      '<div class="agilo-referral-reward-steps">' +
      '<div class="agilo-referral-reward-step" data-agilo-ref-reward-step="1">1</div>' +
      '<div class="agilo-referral-reward-step" data-agilo-ref-reward-step="2">2</div>' +
      '<div class="agilo-referral-reward-step" data-agilo-ref-reward-step="3">3</div>' +
      '</div>' +
      '<p class="agilo-referral-hero__status" data-agilo-ref-reward-status-label>Partagez votre lien pour démarrer vos premiers parrainages.</p>' +
      '</section>' +
      '<section class="agilo-referral-secondary">' +
      '<div class="agilo-referral-kpis">' +
      '<article class="agilo-referral-kpi"><p class="agilo-referral-kpi__label">Inscrits</p><p class="agilo-referral-kpi__value" data-agilo-ref-registered data-agilo-referrals-registered>0</p></article>' +
      '<article class="agilo-referral-kpi"><p class="agilo-referral-kpi__label">Filleuls payants</p><p class="agilo-referral-kpi__value" data-agilo-ref-paid data-agilo-referrals-paid>0</p></article>' +
      '<article class="agilo-referral-kpi"><p class="agilo-referral-kpi__label">À convertir</p><p class="agilo-referral-kpi__value" data-agilo-ref-pending data-agilo-referrals-pending>0</p></article>' +
      '</div>' +
      '<p class="agilo-referral-conversion-secondary" id="agiloReferralConversionSecondary" data-agilo-ref-conversion-secondary>Conversion : 0%</p>' +
      '<p class="agilo-referral-modal__hint" data-agilo-ref-hint-business>Partagez votre lien pour augmenter vos statistiques.</p>' +
      '<p class="agilo-referral-modal__hint" data-agilo-referral-status-label style="margin-top:4px;">Vérification manuelle requise</p>' +
      '</section>' +
      '<div class="agilo-referral-copy"><button type="button" class="agilo-referral-copy__btn" data-agilo-ref-copy-link>Copier mon lien d\'invitation</button></div>' +
      buildClaimBlockHtml();
  }

  function ensureModal() {
    var modal = q('#agiloReferralStatsModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'agiloReferralStatsModal';
      modal.className = 'agilo-referral-modal';
      modal.hidden = true;
      modal.innerHTML = '' +
        '<div class="agilo-referral-modal__backdrop" data-agilo-ref-close></div>' +
        '<section class="agilo-referral-modal__panel" role="dialog" aria-modal="true" aria-labelledby="agiloReferralStatsTitle"></section>';
      document.body.appendChild(modal);
    } else if (modal.parentNode !== document.body) {
      document.body.appendChild(modal);
    }

    if (!q('.agilo-referral-modal__backdrop', modal)) {
      modal.insertAdjacentHTML('afterbegin', '<div class="agilo-referral-modal__backdrop" data-agilo-ref-close></div>');
    }

    var panel = q('.agilo-referral-modal__panel', modal);
    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'agilo-referral-modal__panel';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-labelledby', 'agiloReferralStatsTitle');
      modal.appendChild(panel);
    }

    if (!q('[data-agilo-ref-reward-progress]', panel)) {
      panel.innerHTML = buildModalPanelHtml();
    }

    ensureClaimBlock(panel);
    ensureLeadsSection(panel);

    if (isModalWantedOpen()) {
      modal.hidden = false;
    }

    wireModalEvents(modal);
    return modal;
  }

  function wireModalEvents(modal) {
    if (!modal || modal.__agiloReferralWired) return;
    modal.__agiloReferralWired = true;
    modal.addEventListener('click', function (ev) {
      var target = ev.target;
      var backdrop = q('.agilo-referral-modal__backdrop', modal);
      var toggleBtn = target && target.closest && target.closest('[data-agilo-ref-leads-toggle]');
      if (toggleBtn && modal.contains(toggleBtn)) {
        var leadSection = toggleBtn.closest('[data-agilo-ref-leads-section]');
        var leadPanel = leadSection && q('[data-agilo-ref-leads-panel]', leadSection);
        var expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
        var next = expanded ? 'false' : 'true';
        toggleBtn.setAttribute('aria-expanded', next);
        if (leadPanel) leadPanel.hidden = expanded;
        if (leadSection) leadSection.classList.toggle('is-open', !expanded);
        modal.__agiloLeadsUserExpanded = !expanded;
        return;
      }

      if (target && target.hasAttribute && target.hasAttribute('data-agilo-ref-copy-link')) {
        var button = target;
        if (button.disabled) return;
        var inviteUrl = asText(button.getAttribute('data-invite-url'));
        button.disabled = true;
        copyToClipboard(inviteUrl).then(function (ok) {
          button.textContent = ok ? 'Lien copie' : 'Copie impossible';
        }).finally(function () {
          window.setTimeout(function () {
            button.textContent = 'Copier mon lien d\'invitation';
            button.disabled = false;
          }, 1500);
        });
        return;
      }
      if (
        (target && target.classList && target.classList.contains('agilo-referral-modal__close')) ||
        (target && target.closest && target.closest('.agilo-referral-modal__close'))
      ) {
        closeModal();
      }
    });
    if (!window.__agiloReferralEscWired) {
      window.__agiloReferralEscWired = true;
      document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape') return;
      });
    }
  }

  function setLegacyGauge(modal, state) {
    var gaugeFill = q('[data-agilo-ref-gauge-fill]', modal);
    var gaugePct = q('[data-agilo-ref-gauge-pct]', modal);
    var gaugeLabelNode = q('[data-agilo-ref-gauge-label]', modal);
    if (!gaugeFill && !gaugePct && !gaugeLabelNode) return;

    var gaugeMode = asText(readBodyConfig('data-agilo-referrals-gauge-mode', 'conversion')).toLowerCase();
    var monthlyGoal = Math.max(1, readBodyConfigInt('data-agilo-referrals-month-goal', 5));
    var pct = state.referralsRegistered > 0 ? Math.round((state.referralsPaid / state.referralsRegistered) * 100) : 0;
    var label = 'Taux de conversion';

    if (gaugeMode === 'monthly') {
      pct = Math.round((state.referralsMonth / monthlyGoal) * 100);
      label = 'Objectif mensuel';
    }

    pct = clamp(pct, 0, 100);
    if (gaugeFill) gaugeFill.style.strokeDashoffset = String(126 - (126 * pct / 100));
    if (gaugePct) gaugePct.textContent = String(pct) + '%';
    if (gaugeLabelNode) gaugeLabelNode.textContent = label;
  }


  function isModalWantedOpen() {
    return window.__agiloReferralModalWantedOpen === true;
  }

  function setModalData(state) {
    var modal = ensureModal();
    var registered = toSafeInt(state.referralsRegistered, 0);
    var paid = toSafeInt(state.referralsPaid, 0);
    var pending = toSafeInt(state.referralsPending, 0);
    var total = toSafeInt(state.referralsTotal, 0);
    var month = toSafeInt(state.referralsMonth, 0);
    var lastAt = state.referralsLastAt || '-';

    var rewardTarget = Math.max(1, readBodyConfigInt('data-agilo-ref-reward-target', 3));
    var rewardLabel = readBodyConfig('data-agilo-ref-reward-label', '1 mois offert');
    var rewardState = computeRewardState(registered, paid, rewardTarget);
    var rewardHint = computeRewardHint(rewardState, registered, paid);
    var secondaryHint = computeSecondaryHint(rewardState, registered, paid, pending, rewardTarget);

    var panel = q('.agilo-referral-modal__panel', modal);
    var copyButton = q('[data-agilo-ref-copy-link]', modal);
    var claimWrap = q('[data-agilo-ref-claim-wrap]', modal);
    var claimLink = q('[data-agilo-ref-claim-link]', modal);
    var rewardFill = q('[data-agilo-ref-reward-fill]', modal);
    var rewardBar = q('.agilo-referral-reward-bar', modal);

    if (copyButton) copyButton.setAttribute('data-invite-url', state.inviteUrl || '');
    if (rewardFill) rewardFill.style.width = String(rewardState.rewardPct) + '%';
    if (rewardBar) {
      rewardBar.setAttribute('aria-valuemin', '0');
      rewardBar.setAttribute('aria-valuemax', String(rewardState.target));
      rewardBar.setAttribute('aria-valuenow', String(rewardState.progress));
    }

    setNodeTextIn(modal, ['[data-agilo-ref-reward-progress]'], String(rewardState.progress));
    setNodeTextIn(modal, ['[data-agilo-ref-reward-target]'], String(rewardState.target));
    setNodeTextIn(modal, ['[data-agilo-ref-reward-label-line]'], 'Objectif : ' + String(rewardState.target) + ' filleuls payants = ' + rewardLabel);
    setNodeTextIn(modal, ['[data-agilo-ref-reward-status-label]'], rewardHint);
    var conversionNode = q('#agiloReferralConversionSecondary', modal);
    if (conversionNode) conversionNode.textContent = 'Conversion : ' + String(rewardState.conversionPct) + '% (' + String(paid) + '/' + String(registered) + ')';

    var hero = q('.agilo-referral-hero', modal);
    if (hero) hero.setAttribute('data-agilo-ref-reward-status', rewardState.status);

    qa('[data-agilo-ref-reward-step]', modal).forEach(function (stepNode) {
      var stepValue = toSafeInt(stepNode.getAttribute('data-agilo-ref-reward-step'), 0);
      if (stepValue > 0 && rewardState.progress >= stepValue) {
        stepNode.classList.add('is-active');
      } else {
        stepNode.classList.remove('is-active');
      }
    });

    setNodeTextIn(modal, ['[data-agilo-ref-total]', '[data-agilo-referrals-total]'], String(total));
    setNodeTextIn(modal, ['[data-agilo-ref-month]', '[data-agilo-referrals-month]'], String(month));
    setNodeTextIn(modal, ['[data-agilo-ref-registered]', '[data-agilo-referrals-registered]'], String(registered));
    setNodeTextIn(modal, ['[data-agilo-ref-paid]', '[data-agilo-referrals-paid]'], String(paid));
    setNodeTextIn(modal, ['[data-agilo-ref-pending]', '[data-agilo-referrals-pending]'], String(pending));
    setNodeTextIn(modal, ['[data-agilo-ref-hint-business]', '[data-agilo-ref-hint]'], secondaryHint);
    setNodeTextIn(modal, ['[data-agilo-referrals-last-at]'], lastAt);

    renderReferralsLeads(modal, state.referralsLeads || []);

    if (claimWrap && claimLink) {
      var unlocked = rewardState.status === 'unlocked' || paid >= rewardTarget;
      claimWrap.hidden = !unlocked;
      if (unlocked) {
        claimLink.setAttribute('href', buildClaimMailto(state, rewardState, rewardLabel));
      } else {
        claimLink.setAttribute('href', '#');
      }
    }

    if (isModalWantedOpen()) {
      modal.hidden = false;
    }

    setLegacyGauge(modal, state);
  }

  function openModal() {
    window.__agiloReferralModalWantedOpen = true;
    var modal = ensureModal();
    modal.hidden = false;
  }

  function closeModal() {
    window.__agiloReferralModalWantedOpen = false;
    var modal = q('#agiloReferralStatsModal');
    if (!modal) return;
    modal.hidden = true;
  }

  function bindEmbedOpenButtons() {
    qa('[data-agilo-referral-open]').forEach(function (button) {
      if (button.__agiloReferralBound) return;
      button.__agiloReferralBound = true;
      button.addEventListener('click', openModal);
    });
  }

  function renderSidebarWidget(state) {
    var card = q('.modal_small');
    if (!card) return;
    var ambassadorBtn = q('a.button.ambassador', card) || q('a.button.ambassador');
    if (!ambassadorBtn) return;
    var scope = ambassadorBtn.parentElement || card;
    var ambassadorText = q('p.text-size-xsmall.text-align-center', scope) || ambassadorBtn.nextElementSibling;
    var statsBtn = q('.agilo-referral-cta', scope);
    if (!statsBtn) {
      statsBtn = document.createElement('button');
      statsBtn.type = 'button';
      statsBtn.className = 'button agilo-referral-cta is-secondary';
      statsBtn.textContent = 'Voir le suivi parrainage';
      ambassadorBtn.insertAdjacentElement('afterend', statsBtn);
    }
    if (!statsBtn.__agiloReferralBound) {
      statsBtn.__agiloReferralBound = true;
      statsBtn.addEventListener('click', openModal);
    }
    if (state.referralsRegistered > 0 || state.referralsPaid > 0 || state.referralsTotal > 0) {
      ambassadorBtn.style.display = 'none';
      if (ambassadorText && ambassadorText.tagName) ambassadorText.style.display = 'none';
      statsBtn.classList.remove('is-secondary');
      statsBtn.classList.add('is-primary');
      statsBtn.textContent = 'Voir mes stats parrainage';
    } else {
      ambassadorBtn.style.display = '';
      if (ambassadorText && ambassadorText.tagName) ambassadorText.style.display = '';
      statsBtn.classList.remove('is-primary');
      statsBtn.classList.add('is-secondary');
      statsBtn.textContent = 'Voir le suivi parrainage';
    }
    setModalData(state);
  }

  async function computeState() {
    var invite = readInviteFromDom();
    var memberFromApi = await readMemberFromMemberstack();
    var memberIdFromDom = readMemberIdFromDom();
    var currentMemberId = asText((memberFromApi && memberFromApi.id) || memberIdFromDom);

    var referralsTotal = readFieldValue(memberFromApi, ['referrals-total', 'referrals_total']);
    if (referralsTotal === null) referralsTotal = readDomBoundValue(['referrals-total', 'referrals_total']);
    if (referralsTotal === null) referralsTotal = 0;
    referralsTotal = toSafeInt(referralsTotal, 0);

    var referralsMonth = readFieldValue(memberFromApi, ['referrals-month', 'referrals_month']);
    if (referralsMonth === null) referralsMonth = readDomBoundValue(['referrals-month', 'referrals_month']);
    if (referralsMonth === null) referralsMonth = 0;
    referralsMonth = toSafeInt(referralsMonth, 0);

    var referralsLastAt = asText(readFieldValue(memberFromApi, ['referrals-last-at', 'referrals_last_at']) || readDomBoundValue(['referrals-last-at', 'referrals_last_at']) || '');

    // Preferred model: referrals-total = total invites (registered), referrals-paid = paid invites.
    // Keep legacy fallbacks for old members that may still use referrals-registered or total-as-paid.
    var referralsRegistered = readFieldValue(memberFromApi, ['referrals-total', 'referrals_total']);
    if (referralsRegistered === null) referralsRegistered = readDomBoundValue(['referrals-total', 'referrals_total']);
    if (referralsRegistered === null) referralsRegistered = readFieldValue(memberFromApi, ['referrals-registered', 'referrals_registered']);
    if (referralsRegistered === null) referralsRegistered = readDomBoundValue(['referrals-registered', 'referrals_registered']);
    referralsRegistered = toSafeInt(referralsRegistered === null ? referralsTotal : referralsRegistered, 0);

    var referralsPaid = readFieldValue(memberFromApi, ['referrals-paid', 'referrals_paid']);
    if (referralsPaid === null) referralsPaid = readDomBoundValue(['referrals-paid', 'referrals_paid']);
    referralsPaid = toSafeInt(referralsPaid === null ? referralsTotal : referralsPaid, 0);

    var referralsPending = readFieldValue(memberFromApi, ['referrals-pending', 'referrals_pending']);
    if (referralsPending === null) referralsPending = readDomBoundValue(['referrals-pending', 'referrals_pending']);
    if (referralsPending === null) referralsPending = Math.max(0, referralsRegistered - referralsPaid);
    referralsPending = toSafeInt(referralsPending, 0);

    var referralsLeadsRaw = readFieldValue(memberFromApi, ['referrals-leads-json', 'referrals_leads_json']);
    if (referralsLeadsRaw === null) referralsLeadsRaw = readDomBoundValue(['referrals-leads-json', 'referrals_leads_json']);
    var referralsLeads = parseReferralsLeadsJson(referralsLeadsRaw);

    return {
      version: VERSION,
      currentMemberId: currentMemberId,
      inviteCode: invite.inviteCode,
      inviteUrl: invite.inviteUrl,
      inviteOwnerMatchesCurrentMember: Boolean(invite.inviteCode && currentMemberId && invite.inviteCode === currentMemberId),
      referralsTotal: toSafeInt(referralsTotal, 0),
      referralsMonth: toSafeInt(referralsMonth, 0),
      referralsRegistered: toSafeInt(referralsRegistered, 0),
      referralsPaid: toSafeInt(referralsPaid, 0),
      referralsPending: toSafeInt(referralsPending, 0),
      referralsLastAt: referralsLastAt,
      referralsLeadsJson: referralsLeadsRaw === null || referralsLeadsRaw === undefined ? '' : String(referralsLeadsRaw),
      referralsLeads: referralsLeads,
      computedAt: new Date().toISOString()
    };
  }

  async function refresh() {
    try {
      var state = await computeState();
      renderCounters(state);
      renderStatus(state);
      renderSidebarWidget(state);
      emitState(state);
    } catch (error) {
      if (window.agiloDashboardDebug) {
        console.warn('[agilo:referral-tracking] refresh failed', error);
      }
    }
  }

  function boot() {
    ensureUiStyles();
    ensureModal();
    bindEmbedOpenButtons();
    refresh();
    window.setInterval(refresh, REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) refresh();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
