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
