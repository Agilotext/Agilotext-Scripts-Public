(function () {
  'use strict';

  if (window.__agiloReferralTrackingDashboard) return;
  window.__agiloReferralTrackingDashboard = true;

  var VERSION = '1.0.0';
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

  function readNumericField(member, fieldName) {
    if (!member) return null;
    if (member[fieldName] !== undefined && member[fieldName] !== null) return toSafeInt(member[fieldName], 0);

    var customFields = member.customFields || member.custom_fields || {};
    if (customFields[fieldName] !== undefined && customFields[fieldName] !== null) return toSafeInt(customFields[fieldName], 0);

    var metaData = member.metaData || member.metadata || {};
    if (metaData[fieldName] !== undefined && metaData[fieldName] !== null) return toSafeInt(metaData[fieldName], 0);

    return null;
  }

  function readDomBoundValue(fieldName) {
    var node = q('[data-ms-member="' + fieldName + '"]');
    if (!node) return null;
    var value = asText(node.value || node.textContent);
    if (!value) return null;
    return toSafeInt(value, 0);
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

  async function computeState() {
    var invite = readInviteFromDom();
    var memberFromApi = await readMemberFromMemberstack();
    var memberIdFromDom = readMemberIdFromDom();
    var currentMemberId = asText((memberFromApi && memberFromApi.id) || memberIdFromDom);

    var referralsTotal = readNumericField(memberFromApi, 'referrals_total');
    if (referralsTotal === null) referralsTotal = readDomBoundValue('referrals_total');
    if (referralsTotal === null) referralsTotal = 0;

    var referralsMonth = readNumericField(memberFromApi, 'referrals_month');
    if (referralsMonth === null) referralsMonth = readDomBoundValue('referrals_month');
    if (referralsMonth === null) referralsMonth = 0;

    var referralsLastAt = asText(
      (memberFromApi && (
        memberFromApi.referrals_last_at ||
        (memberFromApi.customFields && memberFromApi.customFields.referrals_last_at) ||
        (memberFromApi.custom_fields && memberFromApi.custom_fields.referrals_last_at) ||
        (memberFromApi.metaData && memberFromApi.metaData.referrals_last_at)
      )) || ''
    );

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
      emitState(state);
    } catch (error) {
      if (window.agiloDashboardDebug) {
        console.warn('[agilo:referral-tracking] refresh failed', error);
      }
    }
  }

  function boot() {
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
