/**
 * Tests logique login Google SSO v7
 * Exécution : node --test tests/login-google-sso.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

function classifyError(err) {
  const raw = String(err && err.message ? err.message : err)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (raw.includes('no account') || raw.includes('member not found')) return 'no_account';
  if (raw.includes('signup not allowed')) return 'signup_not_allowed';
  if (raw.includes('popup') && raw.includes('closed')) return 'popup_closed';
  if (raw.includes('network')) return 'network';
  return 'generic';
}

function googleLoginErrorLabel(err, kind) {
  const MSG = {
    no_account_google: 'no_account_google',
    popup_closed: 'popup_closed',
    network: 'network',
    generic: 'generic'
  };

  if (
    kind === 'no_account' ||
    kind === 'signup_not_allowed' ||
    (kind === 'generic' && String(err && err.message || '').toLowerCase().includes('signup'))
  ) return MSG.no_account_google;
  if (kind === 'popup_closed') return MSG.popup_closed;
  if (kind === 'network') return MSG.network;
  return MSG.generic;
}

function getMemberstackForOAuth(cache, global) {
  return cache || global || null;
}

function neutralizeBrokenPasswordTabs(doc) {
  const wrap = doc.querySelector('.show-password-wrap.w-tabs');
  if (!wrap) return false;
  wrap.classList.remove('w-tabs');
  const menu = wrap.querySelector('.w-tab-menu');
  if (menu) menu.classList.remove('w-tab-menu');
  wrap.querySelectorAll('.w-tab-link').forEach((link) => link.classList.remove('w-tab-link'));
  return true;
}

describe('login Google SSO v7', () => {
  it('getMemberstackForOAuth préfère le cache eager', () => {
    const eager = { loginWithProvider: () => {} };
    const global = { loginWithProvider: () => {} };
    assert.equal(getMemberstackForOAuth(eager, global), eager);
    assert.equal(getMemberstackForOAuth(null, global), global);
    assert.equal(getMemberstackForOAuth(null, null), null);
  });

  it('googleLoginErrorLabel mappe popup fermée', () => {
    const err = new Error('popup closed by user');
    assert.equal(googleLoginErrorLabel(err, classifyError(err)), 'popup_closed');
  });

  it('googleLoginErrorLabel mappe compte Google introuvable', () => {
    const err = new Error('no account found');
    assert.equal(googleLoginErrorLabel(err, classifyError(err)), 'no_account_google');
  });

  it('neutralizeBrokenPasswordTabs retire les classes Webflow Tabs', () => {
    function makeEl(classes) {
      return {
        classList: {
          _set: new Set(classes.split(/\s+/).filter(Boolean)),
          remove(cls) { this._set.delete(cls); },
          toggle() {}
        },
        querySelector(sel) {
          if (sel === '.w-tab-menu') return menu;
          return null;
        },
        querySelectorAll(sel) {
          if (sel === '.w-tab-link') return tabLinks;
          return [];
        }
      };
    }

    const tabLinks = [
      { classList: { _set: new Set(['show-password', 'w-tab-link']), remove(cls) { this._set.delete(cls); } } },
      { classList: { _set: new Set(['show-password', 'w-tab-link']), remove(cls) { this._set.delete(cls); } } }
    ];
    const menu = { classList: { _set: new Set(['w-tab-menu']), remove(cls) { this._set.delete(cls); } } };
    const wrap = makeEl('show-password-wrap w-tabs');
    const doc = { querySelector(sel) { return sel === '.show-password-wrap.w-tabs' ? wrap : null; } };

    assert.equal(neutralizeBrokenPasswordTabs(doc), true);
    assert.ok(!wrap.classList._set.has('w-tabs'));
    assert.ok(!menu.classList._set.has('w-tab-menu'));
    assert.equal(tabLinks.filter((l) => l.classList._set.has('w-tab-link')).length, 0);
  });
});
