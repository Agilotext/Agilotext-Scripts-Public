import dotenv from "dotenv";
import { z } from "zod";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
// Load .env from the project root (not the current working directory)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, "..", ".env");
dotenv.config({ path: envPath });
const envSchema = z
    .object({
    AGILOTEXT_USERNAME: z.string().email(),
    /** Jeton longue durée (recommandé pour la prod). */
    AGILOTEXT_TOKEN: z.string().optional(),
    /** Mot de passe compte : si renseigné sans token, le client appelle POST /getAuthToken (urlencoded). */
    AGILOTEXT_PASSWORD: z.string().optional(),
    /** Alias (scripts, smoke) — priorité après AGILOTEXT_PASSWORD. */
    AGILOTEXT_APP_PASSWORD: z.string().optional(),
    /** Alias (admin) — en dernier recours. */
    AGILOTEXT_ADMIN_PASSWORD: z.string().optional(),
    AGILOTEXT_EDITION: z.enum(["free", "pro", "ent"]).default("free"),
    AGILOTEXT_API_URL: z.string().default("https://api.agilotext.com/api/v1"),
    // Optional MCP connectors (webhooks)
    MCP_EMAIL_THREAD_WEBHOOK: z.string().url().optional(),
    MCP_EMAIL_DRAFT_WEBHOOK: z.string().url().optional(),
    MCP_CRM_WEBHOOK: z.string().url().optional(),
    MCP_CALENDAR_WEBHOOK: z.string().url().optional(),
    MCP_WEBHOOK_TOKEN: z.string().optional(),
})
    .refine((d) => {
    const hasToken = typeof d.AGILOTEXT_TOKEN === "string" && d.AGILOTEXT_TOKEN.length > 0;
    const pwd = (d.AGILOTEXT_PASSWORD && d.AGILOTEXT_PASSWORD.length > 0 && d.AGILOTEXT_PASSWORD) ||
        (d.AGILOTEXT_APP_PASSWORD && d.AGILOTEXT_APP_PASSWORD.length > 0 && d.AGILOTEXT_APP_PASSWORD) ||
        (d.AGILOTEXT_ADMIN_PASSWORD && d.AGILOTEXT_ADMIN_PASSWORD.length > 0 && d.AGILOTEXT_ADMIN_PASSWORD);
    return hasToken || !!pwd;
}, {
    message: "Définir AGILOTEXT_TOKEN, ou l’un de AGILOTEXT_PASSWORD / AGILOTEXT_APP_PASSWORD / AGILOTEXT_ADMIN_PASSWORD (post https://api.agilotext.com/api/v1/getAuthToken)",
});
const parseResult = envSchema.safeParse(process.env);
if (!parseResult.success) {
    console.error("❌ Invalid environment variables:", parseResult.error.format());
    console.error("Please ensure .env file is created and populated based on .env.example");
    process.exit(1);
}
const raw = parseResult.data;
function pickAccountPassword() {
    if (raw.AGILOTEXT_PASSWORD && raw.AGILOTEXT_PASSWORD.length > 0) {
        return raw.AGILOTEXT_PASSWORD;
    }
    if (raw.AGILOTEXT_APP_PASSWORD && raw.AGILOTEXT_APP_PASSWORD.length > 0) {
        return raw.AGILOTEXT_APP_PASSWORD;
    }
    if (raw.AGILOTEXT_ADMIN_PASSWORD && raw.AGILOTEXT_ADMIN_PASSWORD.length > 0) {
        return raw.AGILOTEXT_ADMIN_PASSWORD;
    }
    return undefined;
}
/**
 * Config MCP : `.env` à la racine de `agilotext-mcp-server/`, et/ou variables injectées
 * par `~/.cursor/agilotext-mcp.env` (lanceur Cursor).
 */
export const config = {
    ...raw,
    /** Mot de passe compte résolu pour POST /getAuthToken (hors token direct). */
    accountPassword: pickAccountPassword(),
};
