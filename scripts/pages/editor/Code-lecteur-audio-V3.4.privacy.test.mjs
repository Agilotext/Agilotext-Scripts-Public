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

assert(src.includes("__agiloAudioLite = '3.4-privacy-vis'"), 'version privacy');
assert(src.includes('function pageIsObscured'), 'pageIsObscured');
assert(src.includes('function forcePauseForPrivacy'), 'forcePauseForPrivacy');
assert(src.includes('function bindPrivacyPauseGuards'), 'bindPrivacyPauseGuards');
assert(src.includes("addEventListener('visibilitychange'"), 'listener visibilitychange');
assert(src.includes("addEventListener('pagehide'"), 'listener pagehide');
assert(src.includes("addEventListener('freeze'"), 'listener freeze');
assert(src.includes("forcePauseForPrivacy('play-while-hidden')"), 're-pause si play pendant hidden');
assert(src.includes('AgiloAudioPrivacy'), 'API debug AgiloAudioPrivacy');
assert(src.includes('navigator.mediaSession'), 'MediaSession paused');
assert(src.includes('isTranscriptText'), 'Enter-texte conservé');
assert(src.includes('playFromText'), 'playFromText conservé');
assert(src.includes("jump(-10)"), 'sauts 10s conservés');
assert(src.includes("backBtn.textContent = '10s'"), 'libellé 10s');
assert(!/visibilitychange[\s\S]{0,400}audio\.play\(/.test(src), 'pas de play() dans le flux visibility');
assert(src.includes('else updatePlayUI()'), 'resync UI au retour visible sans play');
assert(src.includes('seekLocked || pageIsObscured()'), 'espace ignore si obscured');
assert(src.includes('wasPlaying && !pageIsObscured()'), 'agilo:load sans autoplay si hidden');

console.log('OK privacy smoke Code-lecteur-audio-V3.4 (base text-play-pause)');
