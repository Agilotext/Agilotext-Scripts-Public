/**
 * Tests — agilo-api-error-format.js (upload audio vide)
 * Exécution : node scripts/shared/agilo-api-error-format.test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, 'agilo-api-error-format.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const sandbox = { window: {} };
sandbox.window.window = sandbox.window;
sandbox.globalThis = sandbox.window;
vm.runInNewContext(src, sandbox);

const w = sandbox.window;
assert(w.__agiloUploadErrorVersion === '1.10.0', 'version 1.10.0');
assert(w.agiloClassifyUploadError, 'classifier exposé');
assert(w.agiloMapUploadErrorResponse, 'mapUploadErrorResponse exposé');

const codeCase = w.agiloClassifyUploadError({ errorMessage: 'error_invalid_audio_file_content' });
assert(codeCase && codeCase.kind === 'audio_empty', 'code API → audio_empty');

const durationCase = w.agiloClassifyUploadError({
  errorMessage: 'Could not get duration of /home/admin/transcripts/x.mp3. Wrong value returned:'
});
assert(durationCase && durationCase.kind === 'audio_empty', 'Could not get duration → audio_empty');
assert(durationCase.userPlain.indexOf('/home/admin') === -1, 'pas de chemin serveur dans userPlain');

const frCase = w.agiloClassifyUploadError({
  userErrorMessage: 'Le fichier audio est vide, trop court ou silencieux.'
});
assert(frCase && frCase.kind === 'audio_empty', 'message FR backend → audio_empty');

const onErrorParts = w.agiloJobErrorParts({
  transcriptStatus: 'ON_ERROR',
  javaException: 'java.io.IOException: error_invalid_audio_file_content: {"job":{"duration":0}}'
}, '');
assert(onErrorParts.primary.indexOf('vide') !== -1 || onErrorParts.primary.indexOf('silencieux') !== -1, 'jobErrorParts ON_ERROR friendly');

const formatCase = w.agiloClassifyUploadError({ errorMessage: 'error_audio_format_not_supported' });
assert(formatCase && formatCase.kind === 'audio_format', 'format inchangé');

const falsePositive = w.agiloClassifyUploadError({ userErrorMessage: 'Service client disponible' });
assert(!falsePositive || falsePositive.kind !== 'audio_empty', 'pas de faux positif service client');

const mapped = w.agiloMapUploadErrorResponse({ errorMessage: 'error_invalid_audio_file_content' });
assert(mapped.action === 'business', 'map upload → business pour audio vide');

const nonRetry = w.agiloIsNonRetryableUploadErrorMessage('Could not get duration of /home/admin/x.mp3');
assert(nonRetry === true, 'fail-fast could not get duration');

const html = w.agiloBuildBusinessErrorHtml('Could not get duration of /home/admin/x.mp3', '<div>default</div>');
assert(html.indexOf('Audio non exploitable') !== -1, 'buildBusinessErrorHtml friendly');
assert(html.indexOf('/home/admin') === -1, 'html sans chemin serveur');

const stubSandbox = { window: { agiloJobErrorParts: function () { return { primary: 'stub' }; } } };
stubSandbox.window.window = stubSandbox.window;
stubSandbox.globalThis = stubSandbox.window;
vm.runInNewContext(src, stubSandbox);
const overwritten = stubSandbox.window.agiloJobErrorParts({
  javaException: 'error_invalid_audio_file_content'
}, '');
assert(overwritten.primary.indexOf('vide') !== -1 || overwritten.primary.indexOf('silencieux') !== -1, 'ensureInstall écrase le stub v2');

console.log('agilo-api-error-format.test.mjs OK');
