/**
 * Tests — URLs popup empreinte + re-offre après hide
 * Exécution : node scripts/shared/agilo-voice-popup-urls.test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, 'agilo-voice-popup-urls.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const sandbox = { window: {}, globalThis: null };
sandbox.window.window = sandbox.window;
sandbox.globalThis = sandbox.window;
vm.runInNewContext(src, sandbox);

const U = sandbox.window.AgiloVoicePopupUrls;
assert(U, 'AgiloVoicePopupUrls exposé');

assert(
  U.profileUrlFromPath('/app/business/dashboard') === '/app/business/profile#agilo-voice-settings',
  'business dashboard → profile hash'
);
assert(
  U.profileUrlFromPath('/app/premium/dashboard/') === '/app/premium/profile#agilo-voice-settings',
  'premium slash trailing'
);
assert(U.profileUrlFromPath('/app/free/dashboard') === null, 'free pas de profileUrl');
assert(U.profileUrlFromPath('/app/business/dashboard').indexOf('/voice') === -1, 'jamais /voice business');

const freeCta = U.primaryCtaFromPath('/app/free/dashboard');
assert(freeCta.url === U.TARIFS_URL, 'free → tarifs');
assert(freeCta.openInNewTab === true, 'free nouvel onglet');
assert(freeCta.url.indexOf('/voice') === -1, 'free pas /voice');
assert(freeCta.url.indexOf('/profile') === -1, 'free pas /profile');

const bizCta = U.primaryCtaFromPath('/app/business/dashboard');
assert(bizCta.url === '/app/business/profile#agilo-voice-settings', 'business CTA');
assert(bizCta.openInNewTab === false, 'business même onglet');

assert(U.inferEditionFromPath('/inconnu') === 'free', 'pathname inconnu → free');
assert(U.inferEditionFromPath('/app/pro/dashboard') === 'premium', 'pro alias');

assert(
  U.shouldReofferAfterRemoval({ dismissed: true, tourHide: false }) === false,
  'dismiss utilisateur : pas de re-offre'
);
assert(
  U.shouldReofferAfterRemoval({ dismissed: false, tourHide: true }) === true,
  'hide tour : re-offre'
);
assert(
  U.shouldReofferAfterRemoval({ dismissed: true, tourHide: true }) === false,
  'dismiss gagne sur hide tour'
);

console.log('agilo-voice-popup-urls.test.mjs OK');
