(function () {
  'use strict';

  if (window.__agiloReferralTrackingDashboard) return;
  window.__agiloReferralTrackingDashboard = true;

  var VERSION = '1.3.7';
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
        return 'Vous avez deja des inscrits. Prochaine etape : les accompagner vers PRO/Biz pour debloquer la recompense.';
      }
      return 'Partagez votre lien pour obtenir vos premiers inscrits et demarrer la progression vers 1 mois offert.';
    }

    if (rewardState.status === 'started') {
      return 'Bon rythme : continuez a accompagner vos filleuls jusqu au plan PRO/Biz pour accelerer la progression.';
    }

    if (rewardState.status === 'almost') {
      return 'Vous etes a une etape du mois offert. Un filleul payant supplementaire debloque la recompense.';
    }

    if (rewardState.status === 'unlocked') {
      return 'Bravo, objectif atteint. Votre recompense est debloquee et en cours de validation.';
    }

    if (paid > 0) {
      return 'Excellent : votre programme ambassadeur convertit deja en abonnements PRO/Biz.';
    }

    return 'Partagez votre lien pour demarrer vos premiers parrainages.';
  }

  function buildClaimMailto(state, rewardState, rewardLabel) {
    var toEmail = readBodyConfig('data-agilo-ref-reward-claim-email', 'contact@agilotext.com');
    var subjectBase = readBodyConfig('data-agilo-ref-reward-claim-subject', 'Reclamation mois offert ambassadeur');
    var memberId = asText(state && state.currentMemberId) || '-';
    var inviteCode = asText(state && state.inviteCode) || '-';
    var paid = toSafeInt(state && state.referralsPaid, 0);
    var registered = toSafeInt(state && state.referralsRegistered, 0);
    var target = toSafeInt(rewardState && rewardState.target, 3);
    var rewardName = asText(rewardLabel) || '1 mois offert';
    var subject = subjectBase + ' - ' + memberId;
    var body = [
      'Bonjour equipe Agilotext,',
      '',
      'Je souhaite reclamer ma recompense ambassadeur : ' + rewardName + '.',
      '',
      'Infos:',
      '- Member ID: ' + memberId,
      '- Invite code: ' + inviteCode,
      '- Progression payants: ' + String(paid) + '/' + String(target),
      '- Conversion: ' + String(registered > 0 ? Math.round((paid / registered) * 100) : 0) + '% (' + String(paid) + '/' + String(registered) + ')',
      '',
      'Merci !'
    ].join('\n');
    return 'mailto:' + encodeURIComponent(toEmail) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }

  function computeSecondaryHint(rewardState, registered, paid, pending) {
    if (rewardState && rewardState.status === 'unlocked') {
      return 'Recompense debloquee : utilisez le bouton ci-dessous pour envoyer votre demande a notre equipe.';
    }
    if (registered <= 0) {
      return 'Partagez votre lien d invitation pour lancer vos premiers parrainages.';
    }
    if (pending > 0) {
      return String(pending) + ' filleul(s) en attente de passage PRO/Biz. Accompagnez-les pour debloquer votre recompense.';
    }
    if (paid > 0) {
      return 'Votre base convertit deja. Continuez pour atteindre le seuil de 3 payants.';
    }
    return 'Vous avez des inscrits. Prochaine etape : les aider a activer un abonnement PRO/Biz.';
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
    var statusLabel = status === 'ok' ? 'Lien invitation valide' : 'Verification manuelle requise';
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
    if (q('#agilo-referral-stats-modal-style')) return;
    var style = document.createElement('style');
    style.id = 'agilo-referral-stats-modal-style';
    style.textContent = '' +
      '.agilo-referral-cta{margin-top:8px;display:inline-flex;align-items:center;justify-content:center;width:auto!important;min-height:34px;padding:7px 12px!important;border-radius:9px;font-size:13px!important;line-height:1.2;max-width:260px;}' +
      '.agilo-referral-cta.is-primary{background:#174a96;color:#fff;}' +
      '.agilo-referral-cta.is-secondary{background:#eff4fb;color:#174a96;border:1px solid rgba(23,74,150,.18);}' +
      '.agilo-referral-modal[hidden]{display:none!important;}' +
      '.agilo-referral-modal{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:16px;}' +
      '.agilo-referral-modal__backdrop{position:absolute;inset:0;background:rgba(9,20,44,.28);}' +
      '.agilo-referral-modal__panel{position:relative;z-index:1;width:min(480px,100%);border-radius:16px;background:#fff;padding:16px;box-shadow:0 20px 50px rgba(0,0,0,.22);border:1px solid #e6ecf5;color:#1b2430;font-family:Inter,Arial,sans-serif;}' +
      '.agilo-referral-modal__close{position:absolute;top:8px;right:10px;border:0;background:transparent;font-size:22px;line-height:1;cursor:pointer;color:#526076;}' +
      '.agilo-referral-modal__title{margin:0 30px 4px 0;font-size:19px;font-weight:700;letter-spacing:-.01em;}' +
      '.agilo-referral-modal__desc{margin:0 0 12px;font-size:13px;color:#5b677a;line-height:1.4;}' +
      '.agilo-referral-hero{padding:12px;border-radius:12px;border:1px solid #dbe7ff;background:linear-gradient(180deg,#f6f9ff 0,#ffffff 100%);}' +
      '.agilo-referral-hero__meta{margin:0 0 6px;font-size:12px;color:#5b677a;font-weight:600;text-align:center;}' +
      '.agilo-referral-hero__progress{margin:0;text-align:center;font-size:30px;line-height:1.05;font-weight:800;color:#174a96;}' +
      '.agilo-referral-hero__suffix{font-size:14px;color:#5b677a;font-weight:600;}' +
      '.agilo-referral-reward-bar{margin-top:10px;height:10px;border-radius:999px;background:#dfe8f8;overflow:hidden;}' +
      '.agilo-referral-reward-bar__fill{height:100%;width:0;background:linear-gradient(90deg,#174a96 0,#2f64bd 100%);transition:width .45s ease;}' +
      '.agilo-referral-reward-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:8px;}' +
      '.agilo-referral-reward-step{padding:5px 0;border:1px solid #d8e3fa;border-radius:8px;text-align:center;font-size:11px;font-weight:700;color:#6b7890;background:#fff;}' +
      '.agilo-referral-reward-step.is-active{border-color:#174a96;color:#174a96;background:#eaf1ff;}' +
      '.agilo-referral-hero__status{margin:10px 0 0;font-size:12px;color:#2f3f57;line-height:1.45;text-align:center;font-weight:600;}' +
      '.agilo-referral-secondary{margin-top:12px;padding-top:10px;border-top:1px solid #edf2fb;}' +
      '.agilo-referral-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}' +
      '.agilo-referral-kpi{border:1px solid #e7edf8;border-radius:10px;padding:8px 6px;text-align:center;background:linear-gradient(180deg,#f8fbff 0,#fff 100%);}' +
      '.agilo-referral-kpi__label{font-size:11px;color:#6c7890;margin:0 0 4px;text-transform:uppercase;letter-spacing:.03em;font-weight:600;}' +
      '.agilo-referral-kpi__value{margin:0;font-size:20px;color:#174a96;font-weight:700;line-height:1.1;}' +
      '.agilo-referral-conversion-secondary{margin:8px 0 0;text-align:center;font-size:12px;color:#5b677a;font-weight:600;}' +
      '.agilo-referral-copy{margin-top:12px;display:flex;justify-content:center;}' +
      '.agilo-referral-copy__btn{border:1px solid rgba(23,74,150,.2);background:#f3f7ff;color:#174a96;border-radius:10px;padding:8px 12px;font-weight:600;cursor:pointer;}' +
      '.agilo-referral-copy__btn:disabled{opacity:.7;cursor:default;}' +
      '.agilo-referral-claim{margin-top:8px;display:flex;justify-content:center;}' +
      '.agilo-referral-claim[hidden]{display:none!important;}' +
      '.agilo-referral-claim__link{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border-radius:10px;padding:8px 12px;font-weight:700;font-size:13px;line-height:1.2;background:#174a96;color:#fff;border:1px solid rgba(23,74,150,.24);}' +
      '.agilo-referral-claim__link:hover{background:#123a75;}' +
      '.agilo-referral-modal__hint{margin:10px 0 0;font-size:12px;color:#5b677a;line-height:1.45;}' +
      '.agilo-referral-gauge{display:none;}' +
      '@media (max-width:460px){.agilo-referral-kpis{grid-template-columns:1fr;}.agilo-referral-hero__progress{font-size:26px;}}';
    document.head.appendChild(style);
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
      '<p class="agilo-referral-hero__status" data-agilo-ref-reward-status-label>Partagez votre lien pour demarrer vos premiers parrainages.</p>' +
      '</section>' +
      '<section class="agilo-referral-secondary">' +
      '<div class="agilo-referral-kpis">' +
      '<article class="agilo-referral-kpi"><p class="agilo-referral-kpi__label">Inscrits</p><p class="agilo-referral-kpi__value" data-agilo-ref-registered data-agilo-referrals-registered>0</p></article>' +
      '<article class="agilo-referral-kpi"><p class="agilo-referral-kpi__label">Payants comptes</p><p class="agilo-referral-kpi__value" data-agilo-ref-paid data-agilo-referrals-paid>0</p></article>' +
      '<article class="agilo-referral-kpi"><p class="agilo-referral-kpi__label">En attente</p><p class="agilo-referral-kpi__value" data-agilo-ref-pending data-agilo-referrals-pending>0</p></article>' +
      '</div>' +
      '<p class="agilo-referral-conversion-secondary" id="agiloReferralConversionSecondary" data-agilo-ref-conversion-secondary>Conversion : 0%</p>' +
      '<p class="agilo-referral-modal__hint" data-agilo-ref-hint-business>Partagez votre lien pour augmenter vos statistiques.</p>' +
      '<p class="agilo-referral-modal__hint" data-agilo-referral-status-label style="margin-top:4px;">Verification manuelle requise</p>' +
      '</section>' +
      '<div class="agilo-referral-copy"><button type="button" class="agilo-referral-copy__btn" data-agilo-ref-copy-link>Copier mon lien d invitation</button></div>' +
      '<div class="agilo-referral-claim" data-agilo-ref-claim-wrap hidden><a class="agilo-referral-claim__link" data-agilo-ref-claim-link href="#">Reclamer mon mois offert</a></div>';
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
      if (target && target.hasAttribute && target.hasAttribute('data-agilo-ref-copy-link')) {
        var button = target;
        if (button.disabled) return;
        var inviteUrl = asText(button.getAttribute('data-invite-url'));
        button.disabled = true;
        copyToClipboard(inviteUrl).then(function (ok) {
          button.textContent = ok ? 'Lien copie' : 'Copie impossible';
        }).finally(function () {
          window.setTimeout(function () {
            button.textContent = 'Copier mon lien d invitation';
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
    var secondaryHint = computeSecondaryHint(rewardState, registered, paid, pending);

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

    if (claimWrap && claimLink) {
      var unlocked = rewardState.status === 'unlocked';
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
