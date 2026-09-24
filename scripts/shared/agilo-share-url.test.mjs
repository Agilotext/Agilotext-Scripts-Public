/**
 * Tests — conversion URL de partage (d8478 + guestRead 11.0.5)
 * Exécution : node scripts/shared/agilo-share-url.test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, 'agilo-share-url.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const sandbox = { window: {}, module: { exports: {} } };
sandbox.window.window = sandbox.window;
sandbox.globalThis = sandbox.window;
vm.runInNewContext(src, sandbox);

const S = sandbox.window.AgiloShareUrl;
assert(S, 'AgiloShareUrl exposé');

const SAMPLE = 'https://api.agilotext.com/api/d8478fa34a594b71f6e5ec42e9a83b290928f78c46';
const TOKEN = 'd8478fa34a594b71f6e5ec42e9a83b290928f78c46';
const GUEST = 'AbCdefGhIjkLmnOpqRstUvwxyz0123456789-_ABC12';
assert(GUEST.length === 43, 'fixture guest 43 chars');

assert(S.parseShareToken(SAMPLE) === TOKEN, 'parse URL API');
assert(S.parseShareToken(SAMPLE + '-download') === TOKEN, 'parse ignore -download');
assert(S.parseShareToken(TOKEN) === TOKEN, 'parse token nu');
assert(S.parseShareToken('https://www.agilotext.com/auth/share?token=' + TOKEN) === TOKEN, 'parse query');
assert(S.toApiShareUrl(SAMPLE) === SAMPLE, 'toApiShareUrl');
assert(S.toApiDownloadUrl(SAMPLE) === SAMPLE + '-download', 'toApiDownloadUrl');
assert(
  S.toWebflowShareUrl(SAMPLE, 'www.agilotext.com') ===
    'https://www.agilotext.com/auth/share?token=' + encodeURIComponent(TOKEN),
  'www share url'
);
assert(
  S.toWebflowShareUrl(SAMPLE, 'agilotext-test.webflow.io') ===
    'https://agilotext-test.webflow.io/auth/share?token=' + encodeURIComponent(TOKEN),
  'staging share url'
);
assert(S.parseShareToken('') === '', 'vide');
assert(S.toWebflowShareUrl('not-a-token') === '', 'token invalide');
assert(S.parseShareToken(GUEST) === '', 'guest nu n’est pas d8478');
assert(S.parseShareToken('https://www.agilotext.com/auth/share#token=' + GUEST) === '', 'hash guest n’est pas d8478');

assert(S.isGuestToken(GUEST) === true, 'isGuestToken 43');
assert(S.isGuestToken(TOKEN) === false, 'd8478 n’est pas guest');
assert(S.parseGuestToken(GUEST) === GUEST, 'parse guest nu');
assert(
  S.parseGuestToken('https://www.agilotext.com/auth/share#token=' + GUEST) === GUEST,
  'parse hash'
);
assert(
  S.parseGuestToken('https://www.agilotext.com/auth/share?token=' + GUEST) === GUEST,
  'parse query 43 (clients qui strip le hash)'
);
assert(
  S.parseGuestTokenFromLocation({
    href: 'https://www.agilotext.com/auth/share#token=' + GUEST,
    hash: '#token=' + GUEST,
    search: ''
  }) === GUEST,
  'parse location hash'
);
assert(
  S.toGuestPageUrl(GUEST, 'www.agilotext.com') ===
    'https://www.agilotext.com/auth/share#token=' + GUEST,
  'www guest page'
);
assert(
  S.toGuestPageUrl(GUEST, 'agilotext-test.webflow.io') ===
    'https://agilotext-test.webflow.io/auth/share#token=' + GUEST,
  'staging guest page'
);

const prodHash = 'https://www.agilotext.com/auth/share#token=' + GUEST;
assert(
  S.rewriteSharePageOrigin(prodHash, 'agilotext-test.webflow.io') ===
    'https://agilotext-test.webflow.io/auth/share#token=' + GUEST,
  'rewrite www → staging'
);
assert(
  S.rewriteSharePageOrigin(prodHash, 'www.agilotext.com') === prodHash,
  'rewrite www reste www'
);

console.log('agilo-share-url.test.mjs OK');
