/**
 * Test live API Confidence V2 — PLAN_CONFIDENCE_CLIENT_v2
 *
 * Usage :
 *   AGILOTEXT_USERNAME=email@domain.com \
 *   AGILOTEXT_TOKEN=v2.xxx \
 *   AGILOTEXT_EDITION=ent \
 *   AGILOTEXT_JOB_ID=1000032216 \
 *   node scripts/pages/editor/confidence-v1/test-confidence-api-live.mjs
 *
 * Token : récupérable dans la console éditeur via localStorage `agilo:token:ent`
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_BASE = process.env.AGILOTEXT_API_BASE || 'https://api.agilotext.com/api/v1';
const USERNAME = process.env.AGILOTEXT_USERNAME || '';
const TOKEN = process.env.AGILOTEXT_TOKEN || '';
const EDITION = process.env.AGILOTEXT_EDITION || 'ent';
const JOB_ID = process.env.AGILOTEXT_JOB_ID || '';

const src = readFileSync(path.join(__dirname, 'agilo-confidence.js'), 'utf8');
const sandbox = { window: { __agiloConfidence: false, AGILOTEXT_ENABLE_CONFIDENCE: true, addEventListener() {} }, document: { readyState: 'complete', head: { appendChild() {} }, getElementById: () => null, querySelector: () => null, createElement: () => ({ classList: { add() {} }, setAttribute() {}, textContent: '', appendChild() {} }), addEventListener() {} } };
sandbox.window.window = sandbox.window;
vm.runInNewContext(src, sandbox);
const AC = sandbox.window.AgiloConfidence;

let ok = 0;
let fail = 0;
const issues = [];

function pass(msg) { ok++; console.log('✓', msg); }
function failMsg(msg) { fail++; issues.push(msg); console.error('✗', msg); }

async function postForm(endpoint, params) {
  const body = new URLSearchParams(params);
  const r = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: body.toString(),
    credentials: 'omit',
    cache: 'no-store'
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* ignore */ }
  return { status: r.status, json, text: text.slice(0, 500) };
}

function validateV2Contract(json, label) {
  if (!json || typeof json !== 'object') {
    failMsg(`${label}: réponse non-JSON`);
    return false;
  }

  if (json.status === 'KO') {
    failMsg(`${label}: erreur API — ${json.errorMessage || 'KO'}`);
    return false;
  }

  if (json.available === false) {
    pass(`${label}: available:false (job legacy ou pas de sidecar)`);
    if (!Array.isArray(json.segmentsConfidence)) {
      failMsg(`${label}: segmentsConfidence manquant quand available:false`);
    }
    return true;
  }

  if (json.available !== true) {
    failMsg(`${label}: champ available absent ou invalide (${json.available})`);
    return false;
  }

  pass(`${label}: available:true`);

  if (json.version !== '2.0') {
    failMsg(`${label}: version attendue 2.0, reçu ${json.version}`);
  } else {
    pass(`${label}: version 2.0`);
  }

  if (json.jobId != null && String(json.jobId) !== String(JOB_ID)) {
    failMsg(`${label}: jobId mismatch (${json.jobId} vs ${JOB_ID})`);
  } else {
    pass(`${label}: jobId cohérent`);
  }

  if (!Array.isArray(json.segmentsConfidence)) {
    failMsg(`${label}: segmentsConfidence n'est pas un tableau`);
    return false;
  }

  pass(`${label}: segmentsConfidence[${json.segmentsConfidence.length}]`);

  if (json.summary && typeof json.summary.globalScore === 'number') {
    pass(`${label}: summary.globalScore = ${Math.round(json.summary.globalScore * 100)}%`);
  } else {
    failMsg(`${label}: summary.globalScore absent`);
  }

  if (json.thresholds) {
    pass(`${label}: thresholds présents (normalMin=${json.thresholds.normalMin}, verifyMin=${json.thresholds.verifyMin})`);
  } else {
    failMsg(`${label}: thresholds absents (optionnel mais recommandé)`);
  }

  const sample = json.segmentsConfidence[0];
  if (sample) {
    const required = ['segmentId', 'score', 'level'];
    for (const k of required) {
      if (sample[k] == null) failMsg(`${label}: segment[0].${k} manquant`);
    }
    if (typeof sample.score === 'number' && sample.score >= 0 && sample.score <= 1) {
      pass(`${label}: segment[0].score valide (${sample.score})`);
    }
    if (['normal', 'verify', 'low'].includes(sample.level)) {
      pass(`${label}: segment[0].level = ${sample.level}`);
    }
  }

  return true;
}

async function main() {
  console.log('\n=== Test API Confidence V2 ===\n');
  console.log('API:', API_BASE);

  // 1. Endpoint reachable (sans auth)
  const anon = await postForm('receiveConfidenceTextJson', { jobId: '1', username: 'x', token: 'x', edition: 'ent' });
  if (anon.status === 200) {
    pass(`Endpoint POST reachable (HTTP ${anon.status})`);
  } else {
    failMsg(`Endpoint POST HTTP ${anon.status}`);
  }

  if (!USERNAME || !TOKEN || !JOB_ID) {
    console.log('\n⚠ Credentials manquants — tests anonymes uniquement.');
    console.log('Pour test complet, fournir :');
    console.log('  AGILOTEXT_USERNAME, AGILOTEXT_TOKEN, AGILOTEXT_JOB_ID');
    console.log('\nToken éditeur : localStorage.getItem("agilo:token:ent")');
    console.log(`\nRésultat partiel : ${ok} ok, ${fail} échec(s)`);
    process.exit(fail > 0 ? 1 : 0);
  }

  console.log('Job:', JOB_ID, '| User:', USERNAME, '| Edition:', EDITION);

  // 2. POST confidence (méthode V2)
  const confPost = await postForm('receiveConfidenceTextJson', {
    username: USERNAME,
    token: TOKEN,
    edition: EDITION,
    jobId: String(JOB_ID)
  });

  if (confPost.status !== 200) {
    failMsg(`POST confidence HTTP ${confPost.status}`);
  } else {
    pass(`POST confidence HTTP 200`);
    validateV2Contract(confPost.json, 'POST');
  }

  // 3. GET confidence (legacy — doit aussi répondre)
  const confGetUrl = `${API_BASE}/receiveConfidenceTextJson?jobId=${encodeURIComponent(JOB_ID)}&username=${encodeURIComponent(USERNAME)}&token=${encodeURIComponent(TOKEN)}&edition=${encodeURIComponent(EDITION)}`;
  const confGet = await fetch(confGetUrl, { credentials: 'omit', cache: 'no-store' });
  const confGetJson = await confGet.json().catch(() => null);
  if (confGet.status === 200) {
    pass(`GET confidence HTTP 200 (legacy supporté)`);
  }

  // 4. Transcript principal (pour réconciliation)
  const txPost = await postForm('receiveTextJson', {
    username: USERNAME,
    token: TOKEN,
    edition: EDITION,
    jobId: String(JOB_ID)
  });

  let mainSegments = [];
  if (txPost.status === 200 && txPost.json?.segments) {
    mainSegments = txPost.json.segments.map((s, i) => ({
      id: String(s.id || `s${i}`),
      text: String(s.text || '')
    }));
    pass(`receiveTextJson OK — ${mainSegments.length} segments`);
  } else {
    failMsg(`receiveTextJson échoué ou sans segments`);
  }

  // 5. Réconciliation client
  if (confPost.json && mainSegments.length) {
    const map = AC.reconcileConfidenceSegments(mainSegments, confPost.json);
    pass(`Réconciliation client : ${map.size} segment(s) matchés`);

    if (confPost.json.available === true && map.size === 0) {
      failMsg('available:true mais aucun segment réconcilié — vérifier segmentId');
    }

    // Vérifier ordre backend
    const ids = confPost.json.segmentsConfidence?.map(s => s.segmentId).filter(Boolean) || [];
    const sorted = [...ids].sort((a, b) => {
      const ia = confPost.json.segmentsConfidence.find(x => x.segmentId === a)?.segmentIndex ?? 0;
      const ib = confPost.json.segmentsConfidence.find(x => x.segmentId === b)?.segmentIndex ?? 0;
      return ia - ib;
    });
    if (JSON.stringify(ids) === JSON.stringify(sorted)) {
      pass('segmentsConfidence trié par segmentIndex');
    } else {
      failMsg('segmentsConfidence pas trié par segmentIndex');
    }
  }

  // 6. Job legacy optionnel
  const LEGACY_JOB = process.env.AGILOTEXT_LEGACY_JOB_ID;
  if (LEGACY_JOB) {
    const legacy = await postForm('receiveConfidenceTextJson', {
      username: USERNAME,
      token: TOKEN,
      edition: EDITION,
      jobId: String(LEGACY_JOB)
    });
    if (legacy.json?.available === false) {
      pass(`Job legacy ${LEGACY_JOB}: available:false OK`);
    } else {
      failMsg(`Job legacy ${LEGACY_JOB}: attendu available:false`);
    }
  }

  console.log(`\n=== Résultat : ${ok} ok, ${fail} échec(s) ===`);
  if (issues.length) {
    console.log('\nPoints à corriger :');
    issues.forEach(i => console.log(' -', i));
  }
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Erreur fatale:', e);
  process.exit(1);
});
