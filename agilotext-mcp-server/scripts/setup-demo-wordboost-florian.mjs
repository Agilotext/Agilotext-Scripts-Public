/**
 * Crée ou met à jour le Word Boost « Démo vidéo » pour florian.bauer@agilotext.com (ent),
 * liste de termes pour la démo (nom, marque, stack), puis définit ce jeu comme défaut.
 *
 * Usage : depuis agilotext-mcp-server/
 *   node scripts/setup-demo-wordboost-florian.mjs
 *
 * Dépend du .env MCP (getAuthToken).
 */
import dotenv from "dotenv";
import axios from "axios";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const baseURL = (process.env.AGILOTEXT_API_URL || "https://api.agilotext.com/api/v1").replace(/\/$/, "");
const username = "florian.bauer@agilotext.com";
const edition = "ent";
const BOOST_LABEL = "Démo vidéo";

/** Lettres / chiffres / espaces / apostrophe / tiret — aligné AssemblyAiWordBoostValidator */
const WORDS = [
  "BAUER",
  "Florian Bauer",
  "Agilotext",
  "AgiloShield",
  "Speechmatics",
  "HDS",
  "RGPD",
  "Teams",
  "Memberstack",
  "Zapier",
  "n8n",
  "Maestro",
  "AssemblyAI",
];

function pickPassword() {
  const p = process.env.AGILOTEXT_PASSWORD;
  const a = process.env.AGILOTEXT_APP_PASSWORD;
  const ad = process.env.AGILOTEXT_ADMIN_PASSWORD;
  if (p && String(p).length > 0) return String(p);
  if (a && String(a).length > 0) return String(a);
  if (ad && String(ad).length > 0) return String(ad);
  return undefined;
}

async function getToken() {
  const password = pickPassword();
  if (!password) throw new Error("Mot de passe manquant (.env)");
  const body = new URLSearchParams({ username, password, edition });
  const { data } = await axios.post(`${baseURL}/getAuthToken`, body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!data || data.status !== "OK" || !data.token) throw new Error(data?.errorMessage || "getAuthToken KO");
  return data.token;
}

async function getWordBoostInfo(token) {
  const qs = new URLSearchParams({ username, token, edition }).toString();
  const { data } = await axios.get(`${baseURL}/getWordBoostInfo2?${qs}`, { validateStatus: () => true });
  return data;
}

function postForm(endpoint, fields) {
  const body = new URLSearchParams();
  Object.entries(fields).forEach(([k, v]) => {
    if (v !== undefined && v !== null) body.append(k, String(v));
  });
  return axios.post(`${baseURL}${endpoint}`, body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    validateStatus: () => true,
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getBoostStatus(token, boostId) {
  const qs = new URLSearchParams({ username, token, edition, boostId: String(boostId) }).toString();
  const { data } = await axios.get(`${baseURL}/getStatusWordBoost2?${qs}`, { validateStatus: () => true });
  return data;
}

/** Attend que le jeu soit READY avant mise à jour (sinon `error_word_boost_not_ready`). */
async function waitUntilBoostReady(token, boostId, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const st = await getBoostStatus(token, boostId);
    const ws = String(st.wordboostStatus || st.wordBoostStatus || "");
    if (ws === "READY") return true;
    if (st.status === "KO") return false;
    await sleep(3500);
  }
  return false;
}

/** Après création : quelques POST si le backend répond `error_word_boost_not_ready`. */
async function setWordBoostWithRetry(token, fields) {
  let last;
  for (let i = 0; i < 10; i++) {
    last = await postForm("/setWordBoost2", fields);
    const d = last.data;
    if (d.status !== "KO" || String(d.errorMessage || "").indexOf("error_word_boost_not_ready") === -1) {
      return last;
    }
    await sleep(3500);
  }
  return last;
}

async function main() {
  const token = await getToken();

  const info = await getWordBoostInfo(token);
  const boostNamesDTOList = info.boostNamesDTOList || [];

  let boostId = "0";
  const existing = boostNamesDTOList.find(
    (b) =>
      String(b.boostName || "").trim() === BOOST_LABEL ||
      /^démo/i.test(String(b.boostName || "").trim())
  );
  if (existing && existing.boostId != null) {
    boostId = String(existing.boostId);
    console.error(`Word Boost existant trouvé : id=${boostId} (« ${existing.boostName} ») → mise à jour si READY.`);
  } else {
    console.error("Aucun Word Boost « Démo » trouvé → création (boostId 0).");
  }

  const wordBoost = JSON.stringify({ wordBoost: WORDS });

  if (existing && boostId !== "0") {
    const ready = await waitUntilBoostReady(token, boostId);
    if (!ready) {
      console.error(
        "[SKIP] Word Boost encore en traitement serveur (PENDING). Liste des mots inchangée ; réessaie le script dans quelques minutes."
      );
      const afterSkip = await getWordBoostInfo(token);
      console.log(JSON.stringify(afterSkip, null, 2));
      process.exit(0);
    }
  }

  const setRes = await setWordBoostWithRetry(token, {
    username,
    token,
    edition,
    boostId,
    boostName: BOOST_LABEL,
    wordBoost,
  });
  const dataSet = setRes.data;
  if (dataSet.boostId != null && dataSet.boostId !== undefined) {
    boostId = String(dataSet.boostId);
  }
  if (dataSet.status === "KO") {
    console.error("setWordBoost2 KO:", JSON.stringify(dataSet));
    process.exit(1);
  }

  console.error("setWordBoost2 OK, boostId =", boostId);

  const defRes = await postForm("/setWordBoostDefault2", {
    username,
    token,
    edition,
    boostId,
  });
  if (defRes.data.status === "KO") {
    console.error("setWordBoostDefault2 KO:", JSON.stringify(defRes.data));
    process.exit(1);
  }

  console.error("Word Boost par défaut →", boostId);

  const after = await getWordBoostInfo(token);
  console.log(JSON.stringify(after, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
