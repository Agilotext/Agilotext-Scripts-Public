import dotenv from "dotenv";
import { z } from "zod";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
// Load .env from the project root (not the current working directory)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, "..", ".env");
dotenv.config({ path: envPath });
const envSchema = z.object({
    AGILOTEXT_USERNAME: z.string().email(),
    AGILOTEXT_TOKEN: z.string().min(1),
    AGILOTEXT_EDITION: z.enum(["free", "pro", "ent"]).default("free"),
    AGILOTEXT_API_URL: z.string().default("https://api.agilotext.com/api/v1"),
    // Optional MCP connectors (webhooks)
    MCP_EMAIL_THREAD_WEBHOOK: z.string().url().optional(),
    MCP_EMAIL_DRAFT_WEBHOOK: z.string().url().optional(),
    MCP_CRM_WEBHOOK: z.string().url().optional(),
    MCP_CALENDAR_WEBHOOK: z.string().url().optional(),
    MCP_WEBHOOK_TOKEN: z.string().optional(),
});
const parseResult = envSchema.safeParse(process.env);
if (!parseResult.success) {
    console.error("❌ Invalid environment variables:", parseResult.error.format());
    console.error("Please ensure .env file is created and populated based on .env.example");
    process.exit(1);
}
export const config = parseResult.data;
