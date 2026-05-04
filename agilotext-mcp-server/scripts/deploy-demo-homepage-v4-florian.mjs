#!/usr/bin/env node
/**
 * Déploie sur florian.bauer@agilotext.com (ent) :
 * - Prompt « Démo HP — CR interne Agilotext V4 » (Marketing/Pack_Video_Homepage_2026/assets/prompt_….txt)
 * - Template HTML : Marketing/Pack_Video_Homepage_2026/12_template_compte_rendu_agilotext_demo.html
 * - Transcript fictif sur un job existant (TARGET_JOB_ID)
 *
 * Usage (depuis ce dossier) :
 *   node scripts/deploy-demo-homepage-v4-florian.mjs
 *   TARGET_JOB_ID=1000026685 node scripts/deploy-demo-homepage-v4-florian.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import axios from "axios";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MCP_ROOT = path.resolve(__dirname, "..");
const PACK_ROOT = path.resolve(MCP_ROOT, "../../Marketing/Pack_Video_Homepage_2026");

import dotenv from "dotenv";
dotenv.config({ path: path.join(MCP_ROOT, ".env") });

const API_BASE = (process.env.AGILOTEXT_API_URL || "https://api.agilotext.com/api/v1").replace(/\/+$/, "");
const USER = "florian.bauer@agilotext.com";
const EDITION = "ent";
const PROMPT_NAME = "Démo HP — CR interne Agilotext V4";

const PATH_PROMPT = path.join(PACK_ROOT, "assets/prompt_agilotext_interne_homepage_v4.txt");
const PATH_TEMPLATE = path.join(PACK_ROOT, "12_template_compte_rendu_agilotext_demo.html");
const PATH_TRANSCRIPT = path.join(PACK_ROOT, "assets/transcript_demo_reunion_produit.txt");

const TARGET_JOB_ID = String(process.env.TARGET_JOB_ID || "1000026685");

function pickPassword() {
  return (
    process.env.AGILOTEXT_PASSWORD ||
    process.env.AGILOTEXT_APP_PASSWORD ||
    process.env.AGILOTEXT_ADMIN_PASSWORD ||
    ""
  );
}

async function postForm(endpoint, fields) {
  const body = new URLSearchParams();
  Object.entries(fields).forEach(([k, v]) => {
    if (v !== undefined && v !== null) body.append(k, String(v));
  });
  const { data } = await axios.post(`${API_BASE}${endpoint}`, body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    validateStatus: () => true,
    timeout: 180000,
  });
  return data;
}

async function fetchMultipart(endpoint, form) {
  const { data } = await axios.post(`${API_BASE}${endpoint}`, form, {
    headers: form.getHeaders ? form.getHeaders() : {},
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    validateStatus: () => true,
    timeout: 300000,
  });
  return data;
}

/** Format identique à TranscriptSaveDTOUtil (speaker / HH:mm:ss --> HH:mm:ss / texte). */
function parsePlainTranscriptToSegments(plain) {
  const lines = plain.split(/\r?\n/);
  const segments = [];
  let i = 0;
  while (i < lines.length) {
    while (i < lines.length && lines[i].trim() === "") i++;
    if (i >= lines.length) break;
    const speaker = lines[i].trim();
    i++;
    if (i >= lines.length || !lines[i].includes("-->")) continue;
    const rangeParts = lines[i].split("-->").map((s) => s.trim());
    i++;
    const body = [];
    while (i < lines.length && lines[i].trim() !== "") {
      body.push(lines[i]);
      i++;
    }
    const startMs = hhmmssToMs(rangeParts[0]);
    const endMs = hhmmssToMs(rangeParts[1]);
    segments.push({
      id: `s${segments.length}`,
      milli_start: startMs,
      milli_end: endMs,
      speaker,
      text: body.join("\n").trim(),
    });
  }
  return segments;
}

function hhmmssToMs(hms) {
  const p = String(hms || "").trim().split(":");
  if (p.length !== 3) return 0;
  const h = parseInt(p[0], 10) || 0;
  const m = parseInt(p[1], 10) || 0;
  const secRaw = p[2];
  const secParts = secRaw.split(/[.,]/);
  const s = parseInt(secParts[0], 10) || 0;
  const frac = secParts[1] ? parseFloat(`0.${secParts[1]}`) : 0;
  return Math.round((h * 3600 + m * 60 + s + frac) * 1000);
}

function buildTranscriptSaveJson(jobId, segments) {
  const lastEnd = segments.length ? segments[segments.length - 1].milli_end : 0;
  const speakers = new Set(segments.map((s) => s.speaker));
  const dto = {
    version: "1",
    job_meta: {
      jobId: Number(jobId),
      milli_duration: lastEnd,
      speakerLabels: speakers.size > 1,
    },
    segments,
  };
  return JSON.stringify(dto);
}

async function main() {
  for (const p of [PATH_PROMPT, PATH_TEMPLATE, PATH_TRANSCRIPT]) {
    if (!fs.existsSync(p)) {
      console.error("Fichier manquant:", p);
      process.exit(1);
    }
  }

  const password = pickPassword();
  if (!password) {
    console.error("Définir AGILOTEXT_PASSWORD dans agilotext-mcp-server/.env");
    process.exit(1);
  }

  const { data: auth } = await axios.post(
    `${API_BASE}/getAuthToken`,
    new URLSearchParams({ username: USER, password, edition: EDITION }).toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  if (auth.status !== "OK" || !auth.token) {
    console.error("getAuthToken KO:", auth);
    process.exit(1);
  }
  const token = auth.token;
  console.error("Auth OK.");

  const promptContent = fs.readFileSync(PATH_PROMPT, "utf8");
  const templateBuf = fs.readFileSync(PATH_TEMPLATE);
  const transcriptText = fs.readFileSync(PATH_TRANSCRIPT, "utf8");

  const qs = new URLSearchParams({ username: USER, token, edition: EDITION }).toString();
  const { data: listDto } = await axios.get(`${API_BASE}/getPromptModelsUserInfo?${qs}`, { validateStatus: () => true });
  if (listDto.status === "KO") {
    console.error("getPromptModelsUserInfo KO:", listDto);
    process.exit(1);
  }
  const models = listDto.promptModeInfoDTOList || [];
  let promptId = null;
  const match = models.find((p) => String(p.promptModelName || "").trim() === PROMPT_NAME);
  if (match) promptId = String(match.promptModelId);

  if (!promptId) {
    console.error("Création du modèle utilisateur…");
    const created = await postForm("/createPromptModelUser", {
      username: USER,
      token,
      edition: EDITION,
      promptModelName: PROMPT_NAME,
      promptName: PROMPT_NAME,
      promptObjective:
        "Compte-rendu interne Agilotext brandé (HTML + gabarit démo homepage V4). Corps poussé via updatePromptModelUser.",
      promptSpecificInfo: " ",
      promptStructure: " ",
    });
    promptId = String(created.promptModelId ?? created.id ?? "");
    if (!promptId || promptId === "undefined") {
      const list2 = await axios.get(`${API_BASE}/getPromptModelsUserInfo?${qs}`);
      const found = (list2.data.promptModeInfoDTOList || []).find(
        (p) => String(p.promptModelName || "").trim() === PROMPT_NAME
      );
      promptId = found ? String(found.promptModelId) : null;
    }
    if (!promptId) {
      console.error("Impossible d'obtenir promptId après création:", created);
      process.exit(1);
    }
    console.error("Créé promptId=", promptId);
  } else {
    console.error("Modèle existant promptId=", promptId);
  }

  const up = await postForm("/updatePromptModelUser", {
    username: USER,
    token,
    edition: EDITION,
    promptId,
    promptName: PROMPT_NAME,
    promptModelName: PROMPT_NAME,
    promptContent,
  });
  if (up.status !== "OK") {
    console.error("updatePromptModelUser KO:", JSON.stringify(up));
    process.exit(1);
  }
  console.error("Prompt texte OK.");

  const FormData = (await import("form-data")).default;
  const formTpl = new FormData();
  formTpl.append("username", USER);
  formTpl.append("token", token);
  formTpl.append("edition", EDITION);
  formTpl.append("promptId", promptId);
  formTpl.append("promptContent", promptContent);
  formTpl.append("promptName", PROMPT_NAME);
  formTpl.append("fileUpload", templateBuf, {
    filename: "template_agilotext_demo_interne.html",
    contentType: "text/html",
  });

  const tplRes = await fetchMultipart("/updatePromptModelFileUser", formTpl);
  if (tplRes.status === "KO") {
    console.error("updatePromptModelFileUser KO:", JSON.stringify(tplRes));
    process.exit(1);
  }
  console.error("Template HTML OK.");

  const segments = parsePlainTranscriptToSegments(transcriptText);
  if (!segments.length) {
    console.error("Aucun segment parsé depuis", PATH_TRANSCRIPT);
    process.exit(1);
  }
  const transcriptJson = buildTranscriptSaveJson(TARGET_JOB_ID, segments);

  const txRes = await postForm("/updateTranscriptFile", {
    username: USER,
    token,
    edition: EDITION,
    jobId: TARGET_JOB_ID,
    transcriptContent: transcriptJson,
  });
  if (txRes.status !== "OK") {
    console.error("updateTranscriptFile KO:", JSON.stringify(txRes));
    process.exit(1);
  }
  console.error("Transcription du job", TARGET_JOB_ID, "mise à jour OK (JSON segments=", segments.length + ").");

  const out = {
    username: USER,
    edition: EDITION,
    promptId,
    promptName: PROMPT_NAME,
    templateFile: PATH_TEMPLATE,
    jobId: TARGET_JOB_ID,
    transcriptSource: PATH_TRANSCRIPT,
    editorUrl: `https://www.agilotext.com/app/business/editor?jobId=${TARGET_JOB_ID}&edition=${EDITION}`,
    nextStep:
      "Dans l’éditeur : sélectionner le modèle « Démo HP — CR interne Agilotext V4 » puis Régénérer le compte-rendu.",
    at: new Date().toISOString(),
  };

  const metaPath = path.join(PACK_ROOT, "assets", "last_deploy_demo_interne_florian.json");
  fs.writeFileSync(metaPath, JSON.stringify(out, null, 2), "utf8");

  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
