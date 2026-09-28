/**
 * Smoke privacy veille Windows — Code-lecteur-audio-V3.4.js
 * Exécution : node scripts/pages/editor/Code-lecteur-audio-V3.4.privacy.test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, 'Code-lecteur-audio-V3.4.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(src.includes("__agiloAudioLite = '3.4-privacy-play'"), 'version privacy-play');
assert(src.includes('function pageIsObscured'), 'pageIsObscured');
assert(src.includes('function forcePauseForPrivacy'), 'forcePauseForPrivacy');
assert(src.includes('function bindPrivacyPauseGuards'), 'bindPrivacyPauseGuards');
assert(src.includes('function tryPlayFromUserGesture'), 'tryPlayFromUserGesture');
assert(src.includes('userPlayIntentUntil'), 'userPlayIntentUntil');
assert(src.includes("addEventListener('visibilitychange'"), 'listener visibilitychange');
assert(src.includes("addEventListener('pagehide'"), 'listener pagehide');
assert(src.includes("addEventListener('freeze'"), 'listener freeze');
assert(src.includes("addEventListener('pageshow'"), 'listener pageshow');
assert(src.includes("forcePauseForPrivacy('play-while-hidden')"), 're-pause si play pendant hidden hors intent');
assert(src.includes('Date.now() > userPlayIntentUntil'), 'play-while-hidden conditionné à intent');
assert(src.includes('pageIsObscured()'), 'garde pageIsObscured utilisée');
assert(src.includes('AgiloAudioPrivacy'), 'API debug AgiloAudioPrivacy');
assert(src.includes('tryPlayFromUserGesture'), 'AgiloAudioPrivacy expose tryPlay');
assert(src.includes('navigator.mediaSession'), 'MediaSession paused');
assert(!src.includes("setActionHandler('play'"), 'pas de MediaSession play handler');

// Pas de reprise auto au retour visible
assert(!/visibilitychange[\s\S]{0,400}audio\.play\(/.test(src), 'pas de play() dans le flux visibility');
assert(!/pageshow[\s\S]{0,200}audio\.play\(/.test(src), 'pas de play() sur pageshow');
assert(src.includes('else updatePlayUI()'), 'resync UI au retour visible sans play');

// Geste user : bouton + Espace via helper
assert(src.includes('await tryPlayFromUserGesture()'), 'playClick utilise tryPlayFromUserGesture');
assert(src.includes('tryPlayFromUserGesture()'), 'Espace / Enter texte utilisent tryPlay');
assert(src.includes('Lecture impossible, réessayez'), 'hint UI si play échoue');

// load job : pas d’autoplay si obscured
assert(src.includes('wasPlaying && !pageIsObscured()'), 'agilo:load sans autoplay si hidden');
assert(src.includes('autoplay: wantPlay && !pageIsObscured()'), 'ensureSeekableFor sans autoplay hidden');

console.log('OK privacy-play smoke Code-lecteur-audio-V3.4');
