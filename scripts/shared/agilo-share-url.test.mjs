/**
 * Tests — conversion URL de partage
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

console.log('agilo-share-url.test.mjs OK');
