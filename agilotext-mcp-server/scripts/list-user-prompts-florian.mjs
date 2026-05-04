/**
 * Liste les prompts utilisateur pour florian.bauer@agilotext.com (ent).
 * Usage : depuis agilotext-mcp-server/ — charge .env (mot de passe).
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import axios from "axios";
import FormData from "form-data";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const baseURL = (process.env.AGILOTEXT_API_URL || "https://api.agilotext.com/api/v1").replace(/\/$/, "");
const username = process.argv[2] || "florian.bauer@agilotext.com";
const edition = process.argv[3] || "ent";

function pickPassword() {
  const p = process.env.AGILOTEXT_PASSWORD;
  const a = process.env.AGILOTEXT_APP_PASSWORD;
  const ad = process.env.AGILOTEXT_ADMIN_PASSWORD;
  if (p && String(p).length > 0) return String(p);
  if (a && String(a).length > 0) return String(a);
  if (ad && String(ad).length > 0) return String(ad);
  return undefined;
}

const password = pickPassword();
if (!password) {
  console.error("Mot de passe manquant dans .env");
  process.exit(1);
}

const authBody = new URLSearchParams({ username, password, edition });
const { data: authRes } = await axios.post(`${baseURL}/getAuthToken`, authBody.toString(), {
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  validateStatus: () => true,
});

if (!authRes || authRes.status !== "OK" || !authRes.token) {
  console.error("getAuthToken KO:", authRes?.errorMessage || JSON.stringify(authRes));
  process.exit(1);
}

const token = authRes.token;
const qs = new URLSearchParams({
  username,
  token,
  edition,
}).toString();

/** Backend expose souvent getPromptModelsUserInfo en GET query string */
let { data } = await axios.get(`${baseURL}/getPromptModelsUserInfo?${qs}`, {
  validateStatus: () => true,
});

if (!data || data.status === "KO") {
  const fd = new FormData();
  fd.append("username", username);
  fd.append("token", token);
  fd.append("edition", edition);
  const postRes = await axios.post(`${baseURL}/getPromptModelsUserInfo`, fd, {
    headers: fd.getHeaders(),
    validateStatus: () => true,
  });
  data = postRes.data;
}

console.log(JSON.stringify(data, null, 2));
