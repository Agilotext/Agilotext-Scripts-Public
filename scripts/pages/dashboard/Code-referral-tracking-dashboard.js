(function () {
  'use strict';

  if (window.__agiloReferralTrackingDashboard) return;
  window.__agiloReferralTrackingDashboard = true;

  var VERSION = '1.1.0';
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
      var value = asText(node.value || node.textContent);
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
      '.agilo-referral-modal{position:fixed;inset:0;z-index:10050;display:grid;place-items:center;padding:16px;}' +
      '.agilo-referral-modal__backdrop{position:absolute;inset:0;background:rgba(9,20,44,.58);backdrop-filter:blur(4px);}' +
      '.agilo-referral-modal__panel{position:relative;z-index:1;width:min(460px,100%);border-radius:14px;background:#fff;padding:16px 16px 14px;box-shadow:0 20px 50px rgba(0,0,0,.22);border:1px solid #e6ecf5;color:#1b2430;font-family:Inter,Arial,sans-serif;}' +
      '.agilo-referral-modal__close{position:absolute;top:8px;right:10px;border:0;background:transparent;font-size:22px;line-height:1;cursor:pointer;color:#526076;}' +
      '.agilo-referral-modal__title{margin:0 30px 4px 0;font-size:18px;font-weight:700;letter-spacing:-.01em;}' +
      '.agilo-referral-modal__desc{margin:0 0 12px;font-size:13px;color:#5b677a;line-height:1.4;}' +
      '.agilo-referral-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}' +
      '.agilo-referral-kpi{border:1px solid #e7edf8;border-radius:10px;padding:8px 6px;text-align:center;background:linear-gradient(180deg,#f8fbff 0,#fff 100%);}' +
      '.agilo-referral-kpi__label{font-size:11px;color:#6c7890;margin:0 0 4px;text-transform:uppercase;letter-spacing:.03em;font-weight:600;}' +
      '.agilo-referral-kpi__value{margin:0;font-size:20px;color:#174a96;font-weight:700;line-height:1.1;}' +
      '.agilo-referral-modal__hint{margin:10px 0 0;font-size:12px;color:#5b677a;line-height:1.45;}' +
      'body.agilo-referral-modal-open{overflow:hidden;}' +
      '@media (max-width:460px){.agilo-referral-kpis{grid-template-columns:1fr;}}';
    document.head.appendChild(style);
  }

  function ensureModal() {
    var modal = q('#agiloReferralStatsModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'agiloReferralStatsModal';
    modal.className = 'agilo-referral-modal';
    modal.hidden = true;
    modal.innerHTML = '' +
      '<div class="agilo-referral-modal__backdrop" data-agilo-ref-close></div>' +
      '<section class="agilo-referral-modal__panel" role="dialog" aria-modal="true" aria-labelledby="agiloReferralStatsTitle">' +
      '<button class="agilo-referral-modal__close" type="button" aria-label="Fermer" data-agilo-ref-close>&times;</button>' +
      '<h3 class="agilo-referral-modal__title" id="agiloReferralStatsTitle">Mes statistiques ambassadeur</h3>' +
      '<p class="agilo-referral-modal__desc">Suivez vos performances de parrainage en direct.</p>' +
      '<div class="agilo-referral-kpis">' +
      '<article class="agilo-referral-kpi"><p class="agilo-referral-kpi__label">Total</p><p class="agilo-referral-kpi__value" data-agilo-ref-total>0</p></article>' +
      '<article class="agilo-referral-kpi"><p class="agilo-referral-kpi__label">Ce mois</p><p class="agilo-referral-kpi__value" data-agilo-ref-month>0</p></article>' +
      '<article class="agilo-referral-kpi"><p class="agilo-referral-kpi__label">Statut</p><p class="agilo-referral-kpi__value" data-agilo-ref-status>Nouveau</p></article>' +
      '</div>' +
      '<p class="agilo-referral-modal__hint" data-agilo-ref-hint>Partagez votre lien pour augmenter vos statistiques.</p>' +
      '</section>';
    document.body.appendChild(modal);
    if (!window.__agiloReferralModalWired) {
      window.__agiloReferralModalWired = true;
      modal.addEventListener('click', function (ev) {
        if (ev.target && ev.target.hasAttribute('data-agilo-ref-close')) closeModal();
      });
      document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape') closeModal();
      });
    }
    return modal;
  }

  function setModalData(state) {
    var modal = ensureModal();
    var total = toSafeInt(state.referralsTotal, 0);
    var month = toSafeInt(state.referralsMonth, 0);
    var status = total > 0 ? 'Actif' : 'Nouveau';
    var hint = total > 0 ? 'Excellent : vous avez deja ' + total + ' parrainage(s).' : 'Aucun parrainage detecte pour le moment.';
    q('[data-agilo-ref-total]', modal).textContent = String(total);
    q('[data-agilo-ref-month]', modal).textContent = String(month);
    q('[data-agilo-ref-status]', modal).textContent = status;
    q('[data-agilo-ref-hint]', modal).textContent = hint;
  }

  function openModal() {
    var modal = ensureModal();
    modal.hidden = false;
    document.body.classList.add('agilo-referral-modal-open');
  }

  function closeModal() {
    var modal = q('#agiloReferralStatsModal');
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('agilo-referral-modal-open');
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
    if (state.referralsTotal > 0) {
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

    return {
      version: VERSION,
      currentMemberId: currentMemberId,
      inviteCode: invite.inviteCode,
      inviteUrl: invite.inviteUrl,
      inviteOwnerMatchesCurrentMember: Boolean(invite.inviteCode && currentMemberId && invite.inviteCode === currentMemberId),
      referralsTotal: toSafeInt(referralsTotal, 0),
      referralsMonth: toSafeInt(referralsMonth, 0),
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
