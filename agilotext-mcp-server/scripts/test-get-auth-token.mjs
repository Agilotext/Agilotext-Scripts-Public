/**
 * Vérifie que POST /getAuthToken répond OK avec le .env actuel.
 * N’affiche jamais le mot de passe ni le jeton (seulement la longueur du jeton si OK).
 *
 * Usage : depuis agilotext-mcp-server/
 *   node scripts/test-get-auth-token.mjs
 * ou : npm run test:getAuthToken
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import axios from "axios";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

function pickPassword() {
    const p = process.env.AGILOTEXT_PASSWORD;
    const a = process.env.AGILOTEXT_APP_PASSWORD;
    const ad = process.env.AGILOTEXT_ADMIN_PASSWORD;
    if (p && String(p).length > 0) return String(p);
    if (a && String(a).length > 0) return String(a);
    if (ad && String(ad).length > 0) return String(ad);
    return undefined;
}

const username = process.env.AGILOTEXT_USERNAME;
const edition = process.env.AGILOTEXT_EDITION || "free";
const baseURL = process.env.AGILOTEXT_API_URL || "https://api.agilotext.com/api/v1";
const password = pickPassword();

if (!username) {
    console.error("KO : AGILOTEXT_USERNAME manquant dans .env");
    process.exit(1);
}
if (!password) {
    console.error(
        "KO : aucun mot de passe (AGILOTEXT_PASSWORD / AGILOTEXT_APP_PASSWORD / AGILOTEXT_ADMIN_PASSWORD) — getAuthToken nécessite un mot de passe."
    );
    process.exit(1);
}

const body = new URLSearchParams({ username, password, edition });

try {
    const { data } = await axios.post(`${baseURL.replace(/\/$/, "")}/getAuthToken`, body.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 30000,
        validateStatus: () => true,
    });

    if (data && data.status === "OK" && data.token) {
        const len = String(data.token).length;
        console.log(`OK : getAuthToken a renvoyé un jeton (${len} caractères). Les identifiants sont valides.`);
        process.exit(0);
    }

    const msg = data?.errorMessage || data?.status || JSON.stringify(data);
    console.error(`KO : getAuthToken — ${msg}`);
    process.exit(1);
} catch (e) {
    console.error("KO : erreur réseau ou HTTP", e.message);
    process.exit(1);
}
