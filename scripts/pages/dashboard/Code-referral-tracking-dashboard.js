(function () {
  'use strict';

  if (window.__agiloReferralTrackingDashboard) return;
  window.__agiloReferralTrackingDashboard = true;

  var VERSION = '1.2.0';
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

  function computeReferralHint(registered, paid) {
    if (registered <= 0) {
      return 'Partagez votre lien pour demarrer vos premiers parrainages.';
    }
    if (paid <= 0) {
      return 'Bonne nouvelle : vous avez deja des inscrits. Prochaine etape : les aider a passer PRO/Biz.';
    }
    return 'Excellent : votre programme ambassadeur convertit deja en abonnements PRO/Biz.';
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

  function toSafeInt(value, fallback) {
    var n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.floor(n));
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
    var statusLabel = status === 'ok' ? 'Lien invitation valide' : 'Vérification manuelle requise';
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
      '.agilo-referral-cta{margin-top:10px;display:inline-flex;align-items:center;justify-content:center;}' +
      '.agilo-referral-cta.is-primary{background:#174a96;color:#fff;}' +
      '.agilo-referral-cta.is-secondary{background:#eff4fb;color:#174a96;border:1px solid rgba(23,74,150,.18);}' +
      '.agilo-referral-modal[hidden]{display:none!important;}' +
      '.agilo-referral-modal{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:16px;}' +
      '.agilo-referral-modal__backdrop{position:absolute;inset:0;background:rgba(9,20,44,.28);}' +
      '.agilo-referral-modal__panel{position:relative;z-index:1;width:min(460px,100%);border-radius:14px;background:#fff;padding:16px 16px 14px;box-shadow:0 20px 50px rgba(0,0,0,.22);border:1px solid #e6ecf5;color:#1b2430;font-family:Inter,Arial,sans-serif;}' +
      '.agilo-referral-modal__close{position:absolute;top:8px;right:10px;border:0;background:transparent;font-size:22px;line-height:1;cursor:pointer;color:#526076;}' +
      '.agilo-referral-modal__title{margin:0 30px 4px 0;font-size:18px;font-weight:700;letter-spacing:-.01em;}' +
      '.agilo-referral-modal__desc{margin:0 0 12px;font-size:13px;color:#5b677a;line-height:1.4;}' +
      '.agilo-referral-gauge{width:160px;height:82px;margin:0 auto 6px;position:relative;}' +
      '.agilo-referral-gauge svg{width:100%;height:100%;display:block;}' +
      '.agilo-referral-gauge .track{stroke:#dfe8f8;stroke-width:8;fill:none;stroke-linecap:round;}' +
      '.agilo-referral-gauge .fill{stroke:#174a96;stroke-width:8;fill:none;stroke-linecap:round;stroke-dasharray:126;stroke-dashoffset:126;transition:stroke-dashoffset .55s ease;}' +
      '.agilo-referral-gauge__label{text-align:center;margin:0 0 2px;font-size:11px;font-weight:600;color:#6c7890;text-transform:uppercase;letter-spacing:.04em;}' +
      '.agilo-referral-gauge__pct{text-align:center;margin:-6px 0 8px;font-weight:700;color:#174a96;}' +
      '.agilo-referral-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}' +
      '.agilo-referral-kpi{border:1px solid #e7edf8;border-radius:10px;padding:8px 6px;text-align:center;background:linear-gradient(180deg,#f8fbff 0,#fff 100%);}' +
      '.agilo-referral-kpi__label{font-size:11px;color:#6c7890;margin:0 0 4px;text-transform:uppercase;letter-spacing:.03em;font-weight:600;}' +
      '.agilo-referral-kpi__value{margin:0;font-size:20px;color:#174a96;font-weight:700;line-height:1.1;}' +
      '.agilo-referral-copy{margin-top:12px;display:flex;justify-content:center;}' +
      '.agilo-referral-copy__btn{border:1px solid rgba(23,74,150,.2);background:#f3f7ff;color:#174a96;border-radius:10px;padding:8px 12px;font-weight:600;cursor:pointer;}' +
      '.agilo-referral-copy__btn:disabled{opacity:.7;cursor:default;}' +
      '.agilo-referral-modal__hint{margin:10px 0 0;font-size:12px;color:#5b677a;line-height:1.45;}' +
      '@media (max-width:460px){.agilo-referral-kpis{grid-template-columns:1fr;}}';
    document.head.appendChild(style);
  }

  function ensureModal() {
    var modal = q('#agiloReferralStatsModal');
    if (modal) {
      if (modal.parentNode !== document.body) {
        document.body.appendChild(modal);
      }
      var existingFill = q('[data-agilo-ref-gauge-fill]', modal);
      if (!existingFill) {
        var descNode = q('.agilo-referral-modal__desc', modal);
        if (descNode) {
          descNode.insertAdjacentHTML('afterend', '' +
            '<div class="agilo-referral-gauge">' +
            '<svg viewBox="0 0 100 55" aria-hidden="true">' +
            '<path class="track" d="M 10 50 A 40 40 0 0 1 90 50"></path>' +
            '<path class="fill" data-agilo-ref-gauge-fill d="M 10 50 A 40 40 0 0 1 90 50"></path>' +
            '</svg>' +
            '</div>' +
            '<p class="agilo-referral-gauge__label" data-agilo-ref-gauge-label>Taux de conversion</p>' +
            '<p class="agilo-referral-gauge__pct" data-agilo-ref-gauge-pct>0%</p>');
        }
      }
      wireModalEvents(modal);
      return modal;
    }
    modal = document.createElement('div');
    modal.id = 'agiloReferralStatsModal';
    modal.className = 'agilo-referral-modal';
    modal.hidden = true;
    modal.innerHTML = '' +
      '<div class="agilo-referral-modal__backdrop" data-agilo-ref-close></div>' +
      '<section class="agilo-referral-modal__panel" role="dialog" aria-modal="true" aria-labelledby="agiloReferralStatsTitle">' +
      '<button class="agilo-referral-modal__close" type="button" aria-label="Fermer" data-agilo-ref-close>&times;</button>' +
      '<h3 class="agilo-referral-modal__title" id="agiloReferralStatsTitle">Mes statistiques ambassadeur</h3>' +
      '<p class="agilo-referral-modal__desc">Suivez vos inscrits, vos abonnements PRO/Biz et les conversions en temps reel.</p>' +
      '<div class="agilo-referral-gauge">' +
      '<svg viewBox="0 0 100 55" aria-hidden="true">' +
      '<path class="track" d="M 10 50 A 40 40 0 0 1 90 50"></path>' +
      '<path class="fill" data-agilo-ref-gauge-fill d="M 10 50 A 40 40 0 0 1 90 50"></path>' +
      '</svg>' +
      '</div>' +
      '<p class="agilo-referral-gauge__label" data-agilo-ref-gauge-label>Taux de conversion</p>' +
      '<p class="agilo-referral-gauge__pct" data-agilo-ref-gauge-pct>0%</p>' +
      '<div class="agilo-referral-kpis">' +
      '<article class="agilo-referral-kpi"><p class="agilo-referral-kpi__label">Inscrits</p><p class="agilo-referral-kpi__value" data-agilo-ref-registered data-agilo-referrals-registered>0</p></article>' +
      '<article class="agilo-referral-kpi"><p class="agilo-referral-kpi__label">PRO/Biz comptes</p><p class="agilo-referral-kpi__value" data-agilo-ref-paid data-agilo-referrals-paid>0</p></article>' +
      '<article class="agilo-referral-kpi"><p class="agilo-referral-kpi__label">En attente</p><p class="agilo-referral-kpi__value" data-agilo-ref-pending data-agilo-referrals-pending>0</p></article>' +
      '</div>' +
      '<div class="agilo-referral-copy"><button type="button" class="agilo-referral-copy__btn" data-agilo-ref-copy-link>Copier mon lien d\'invitation</button></div>' +
      '<p class="agilo-referral-modal__hint" data-agilo-ref-hint>Partagez votre lien pour augmenter vos statistiques.</p>' +
      '</section>';
    document.body.appendChild(modal);
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
            button.textContent = 'Copier mon lien d\'invitation';
            button.disabled = false;
          }, 1500);
        });
        return;
      }
      if (
        target === modal ||
        target === backdrop ||
        (target && target.hasAttribute && target.hasAttribute('data-agilo-ref-close')) ||
        (target && target.closest && target.closest('[data-agilo-ref-close]'))
      ) {
        closeModal();
      }
    });
    if (!window.__agiloReferralEscWired) {
      window.__agiloReferralEscWired = true;
      document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape') closeModal();
      });
    }
  }

  function setModalData(state) {
    var modal = ensureModal();
    var registered = toSafeInt(state.referralsRegistered, 0);
    var paid = toSafeInt(state.referralsPaid, 0);
    var pending = toSafeInt(state.referralsPending, 0);
    var total = toSafeInt(state.referralsTotal, 0);
    var month = toSafeInt(state.referralsMonth, 0);
    var lastAt = state.referralsLastAt || '-';
    var gaugeMode = asText((document.body && document.body.getAttribute('data-agilo-referrals-gauge-mode')) || 'conversion').toLowerCase();
    var goal = toSafeInt((document.body && document.body.getAttribute('data-agilo-referrals-month-goal')) || 5, 5);
    if (goal < 1) goal = 5;
    var pct;
    var gaugeLabel;
    if (gaugeMode === 'monthly') {
      pct = Math.max(0, Math.min(100, Math.round((month / goal) * 100)));
      gaugeLabel = 'Objectif mensuel';
    } else {
      pct = registered > 0 ? Math.max(0, Math.min(100, Math.round((paid / registered) * 100))) : 0;
      gaugeLabel = 'Taux de conversion';
    }
    var gaugeFill = q('[data-agilo-ref-gauge-fill]', modal);
    var gaugePct = q('[data-agilo-ref-gauge-pct]', modal);
    var gaugeLabelNode = q('[data-agilo-ref-gauge-label]', modal);
    var hint = computeReferralHint(registered, paid);
    var copyButton = q('[data-agilo-ref-copy-link]', modal);
    if (gaugeFill) gaugeFill.style.strokeDashoffset = String(126 - (126 * pct / 100));
    if (gaugePct) gaugePct.textContent = String(pct) + '%';
    if (gaugeLabelNode) gaugeLabelNode.textContent = gaugeLabel;
    if (copyButton) copyButton.setAttribute('data-invite-url', state.inviteUrl || '');
    setNodeTextIn(modal, ['[data-agilo-ref-total]', '[data-agilo-referrals-total]'], String(total));
    setNodeTextIn(modal, ['[data-agilo-ref-month]', '[data-agilo-referrals-month]'], String(month));
    setNodeTextIn(modal, ['[data-agilo-ref-registered]', '[data-agilo-referrals-registered]'], String(registered));
    setNodeTextIn(modal, ['[data-agilo-ref-paid]', '[data-agilo-referrals-paid]'], String(paid));
    setNodeTextIn(modal, ['[data-agilo-ref-pending]', '[data-agilo-referrals-pending]'], String(pending));
    setNodeTextIn(modal, ['[data-agilo-ref-hint]', '[data-agilo-referral-status-label]'], hint);
    setNodeTextIn(modal, ['[data-agilo-referrals-last-at]'], lastAt);
  }

  function openModal() {
    var modal = ensureModal();
    modal.hidden = false;
  }

  function closeModal() {
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
      statsBtn.textContent = 'Suivre mes statistiques';
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
      statsBtn.textContent = 'Voir mes stats ambassadeur';
    } else {
      ambassadorBtn.style.display = '';
      if (ambassadorText && ambassadorText.tagName) ambassadorText.style.display = '';
      statsBtn.classList.remove('is-primary');
      statsBtn.classList.add('is-secondary');
      statsBtn.textContent = 'Suivre mes statistiques';
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

    var referralsRegistered = readFieldValue(memberFromApi, ['referrals-registered', 'referrals_registered']);
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
