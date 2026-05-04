#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AgilotextClient, type AuthOverride } from "./api-client.js";
import { config } from "./config.js";
import { formatError, logError } from "./error-handler.js";
import { logger } from "./logger.js";
import { deriveMeetingInsightsFromText } from "./utils/meeting-insights.js";
import { handleFileUpload } from "./performance/file-upload-handler.js";
import { emailRateLimiter } from "./resilience/rate-limiter.js";
import { validateEmailDraftResponse } from "./utils/email-validators.js";
import { sanitizeHtml } from "./utils/html-sanitizer.js";
import {
  validateEmailGenerationInputs,
  sanitizeForLlm,
  validateJobId,
} from "./security/input-validator.js";
import { detectEmailProvider, detectCalendarSource } from "./utils/provider-detector.js";
import { translateWebhookError } from "./utils/user-friendly-errors.js";
import { enhanceErrorMessageWithStatus } from "./utils/connection-status.js";
import { promptsCache, wordboostsCache, jobStatusCache } from "./performance/cache.js";
import { metrics } from "./metrics.js";
import dotenv from "dotenv";

dotenv.config();

const server = new McpServer({
  name: "agilotext-mcp-server",
  version: "2.0.0",
});

const client = new AgilotextClient();

// Helper for consistent error handling with structured logging and metrics
const handleTool = async (fn: () => Promise<any>, toolName?: string) => {
  const startTime = Date.now();
  const tool = toolName || 'unknown';
  
  try {
    logger.debug(`Executing tool: ${tool}`);
    const response = await fn();
    const duration = Date.now() - startTime;
    
    metrics.recordToolExecution(tool, duration, true);
    logger.info(`Tool ${tool} completed successfully in ${duration}ms`);
    
    return {
      content: [{ type: "text" as const, text: JSON.stringify(response, null, 2) }],
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorDetails = formatError(error);
    
    metrics.recordToolExecution(tool, duration, false);
    logError(errorDetails, tool);
    
    return {
      content: [{ type: "text" as const, text: `❌ ${errorDetails.message}` }],
      isError: true,
    };
  }
};

// Helper to validate jobId before API calls
const validateJobIdWrapper = (jobId: string, fn: () => Promise<any>, toolName?: string) => {
  try {
    validateJobId(jobId);
    return handleTool(fn, toolName);
  } catch (error: any) {
    return {
      content: [{ type: "text" as const, text: `❌ Invalid jobId: ${error.message}` }],
      isError: true,
    };
  }
};

const WEBHOOK_TIMEOUT_MS = 15000;

const buildWebhookHeaders = () => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.MCP_WEBHOOK_TOKEN) headers["Authorization"] = "Bearer " + config.MCP_WEBHOOK_TOKEN;
  return headers;
};

async function callWebhook(url: string | undefined, payload: any, toolName: string, envName: string) {
  if (!url) {
    const friendlyError = translateWebhookError(
      "Webhook non configuré pour " + toolName + ". Définissez " + envName + " dans .env",
      { toolName, envName, isWebhook: true }
    );
    // Enhance with connection status context
    const enhancedError = enhanceErrorMessageWithStatus(friendlyError, toolName);
    throw new Error(enhancedError);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: buildWebhookHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await resp.text();
    let data: any = text;
    try { data = JSON.parse(text); } catch {}
    if (!resp.ok) {
      const technicalError = "Webhook " + toolName + " HTTP " + resp.status + ": " + (typeof data === 'string' ? data : JSON.stringify(data));
      const friendlyError = translateWebhookError(technicalError, {
        toolName,
        envName,
        isWebhook: true,
        statusCode: resp.status
      });
      throw new Error(friendlyError);
    }
    return data;
    } catch (error: any) {
      // If it's already a translated error, enhance it with connection status
      if (error.message && !error.message.includes('Webhook') && !error.message.includes('HTTP')) {
        const enhancedError = enhanceErrorMessageWithStatus(error.message, toolName);
        throw new Error(enhancedError);
      }
      // Otherwise, translate it first, then enhance
      const friendlyError = translateWebhookError(error, {
        toolName,
        envName,
        isWebhook: true
      });
      const enhancedError = enhanceErrorMessageWithStatus(friendlyError, toolName);
      throw new Error(enhancedError);
    } finally {
    clearTimeout(timeout);
  }
}

// deriveMeetingInsightsFromText is now imported from utils/meeting-insights.ts

function deriveEmailStyleFingerprint(raw: string) {
  const text = String(raw || '');
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);

  const greet = lines.find(l => /^(bonjour|bonsoir|salut|hello|hi)\b/i.test(l)) || '';
  const sign = lines.slice().reverse().find(l => /(cordialement|bien\s+à\s+vous|sinc[eè]res?\s+salutations|best\s+regards|merci|thanks)\b/i.test(l)) || '';

  const hasSubject = /^objet\s*:/im.test(text);
  const usesBullets = lines.some(l => /^(?:[-*•]|→|➜|➔|➤|➡|▶|►|▸|▹|»)\s+/.test(l));
  const questionRate = lines.length ? (lines.filter(l => /\?$/.test(l)).length / lines.length) : 0;
  const avgLineLength = lines.length ? (lines.reduce((a, b) => a + b.length, 0) / lines.length) : 0;
  const avgParagraphLength = paragraphs.length ? (paragraphs.reduce((a, b) => a + b.length, 0) / paragraphs.length) : 0;

  return {
    hasSubject,
    greetingExample: greet || null,
    signoffExample: sign || null,
    avgLineLength: Math.round(avgLineLength),
    avgParagraphLength: Math.round(avgParagraphLength),
    usesBullets,
    questionRate: Number(questionRate.toFixed(2)),
    paragraphCount: paragraphs.length,
  };
}

/** Surcharge d’authentification par appel (n’alimente pas d’e-mail/édition figés dans le serveur). */
const authOverrideSchema = {
  username: z
    .string()
    .email()
    .optional()
    .describe("Optionnel: email du compte Agilotext (défaut: AGILOTEXT_USERNAME du .env)"),
  edition: z
    .enum(["free", "pro", "ent"])
    .optional()
    .describe("Optionnel: free | pro | ent (défaut: AGILOTEXT_EDITION)"),
  token: z
    .string()
    .optional()
    .describe("Optionnel: jeton API pour ce compte (sinon .env + getAuthToken)"),
} satisfies Record<string, z.ZodTypeAny>;

function pickAuthOverride(args: {
  username?: string;
  edition?: "free" | "pro" | "ent";
  token?: string;
}): AuthOverride | undefined {
  if (!args.username && !args.edition && !args.token) return undefined;
  return {
    username: args.username,
    edition: args.edition,
    token: args.token,
  };
}

// ============ JOBS & STATUS ============

server.tool(
  "list_jobs",
  "List transcription jobs with optional filters. Returns filtered results based on status, date range, and filename.",
  {
    limit: z.number().default(50).describe("Max jobs to fetch (will filter from these)"),
    offset: z.number().default(0),
    status: z.enum(["PENDING", "READY", "READY_SUMMARY_READY", "ON_ERROR", "ALL"]).default("ALL").describe("Filter by transcript status"),
    dateFrom: z.string().optional().describe("Filter jobs from this date (ISO format YYYY-MM-DD)"),
    dateTo: z.string().optional().describe("Filter jobs until this date (ISO format YYYY-MM-DD)"),
    filenameContains: z.string().optional().describe("Filter jobs where filename contains this text"),
    ...authOverrideSchema,
  },
  async ({ limit, offset, status, dateFrom, dateTo, filenameContains, username, edition, token }) => {
    try {
      const response = await client.getJobsInfo(limit, offset, pickAuthOverride({ username, edition, token }));
      let jobs = response.jobsInfoDtos || [];

      // Apply filters
      if (status && status !== "ALL") {
        jobs = jobs.filter((j: any) => j.transcriptStatus === status);
      }
      if (dateFrom) {
        const from = new Date(dateFrom);
        jobs = jobs.filter((j: any) => new Date(j.creationDate) >= from);
      }
      if (dateTo) {
        const to = new Date(dateTo);
        jobs = jobs.filter((j: any) => new Date(j.creationDate) <= to);
      }
      if (filenameContains) {
        const search = filenameContains.toLowerCase();
        jobs = jobs.filter((j: any) => j.filename?.toLowerCase().includes(search));
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            total: jobs.length,
            filters: { status, dateFrom, dateTo, filenameContains },
            jobs: jobs.map((j: any) => ({
              id: j.jobId,
              file: j.filename,
              date: j.creationDate,
              status: j.transcriptStatus,
              summaryStatus: j.summaryStatus,
            })),
          }, null, 2),
        }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_transcript_status",
  "Get detailed status of a specific job (PENDING, READY_SUMMARY_READY, ON_ERROR, etc.)",
  { jobId: z.string(), ...authOverrideSchema },
  async ({ jobId, username, edition, token }) => {
    const auth = pickAuthOverride({ username, edition, token });
    const useCache = !auth;
    if (useCache) {
      const cacheKey = `job_status_${jobId}`;
      const cached = jobStatusCache.get(cacheKey);
      if (cached) {
        metrics.recordCacheHit();
        logger.debug(`Returning cached job status for ${jobId}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(cached, null, 2) }] };
      }
      metrics.recordCacheMiss();
    }
    return validateJobIdWrapper(jobId, async () => {
      const result = await client.getTranscriptStatus(jobId, auth);
      if (useCache) {
        jobStatusCache.set(`job_status_${jobId}`, result, 10 * 1000);
      }
      return result;
    }, "get_transcript_status");
  }
);

server.tool(
  "delete_job",
  "Delete a transcription job",
  { jobId: z.string() },
  async ({ jobId }) => {
    const result = await validateJobIdWrapper(jobId, () => client.deleteJob(jobId), "delete_job");
    // Invalidate cache
    jobStatusCache.delete(`job_status_${jobId}`);
    return result;
  }
);

server.tool(
  "rename_transcript",
  "Rename a transcript file",
  { jobId: z.string(), newName: z.string() },
  async ({ jobId, newName }) => validateJobIdWrapper(jobId, () => client.renameTranscriptFile(jobId, newName), "rename_transcript")
);

server.tool(
  "update_transcript",
  "Update/modify the transcript content for a job",
  {
    jobId: z.string().describe("The job ID"),
    transcriptContent: z.string().describe("The new transcript content"),
    ...authOverrideSchema,
  },
  async ({ jobId, transcriptContent, username, edition, token }) =>
    validateJobIdWrapper(
      jobId,
      () => client.updateTranscriptFile(jobId, transcriptContent, pickAuthOverride({ username, edition, token })),
      "update_transcript"
    )
);

// ============ DOWNLOADS ============

server.tool(
  "download_transcript",
  "Download transcript text in various formats",
  { jobId: z.string(), format: z.enum(["txt", "rtf", "docx", "pdf"]).default("txt"), ...authOverrideSchema },
  async ({ jobId, format, username, edition, token }) =>
    validateJobIdWrapper(
      jobId,
      () => client.receiveText(jobId, format, pickAuthOverride({ username, edition, token })),
      "download_transcript"
    )
);

server.tool(
  "download_summary",
  "Download summary/compte-rendu in various formats",
  {
    jobId: z.string(),
    format: z.enum(["txt", "html", "rtf", "docx", "pdf"]).default("html"),
    ...authOverrideSchema,
  },
  async ({ jobId, format, username, edition, token }) =>
    validateJobIdWrapper(
      jobId,
      () => client.receiveSummary(jobId, format, pickAuthOverride({ username, edition, token })),
      "download_summary"
    )
);

server.tool(
  "redo_summary",
  "Regenerate summary for a job, optionally with a different prompt",
  { jobId: z.string(), promptId: z.string().optional(), ...authOverrideSchema },
  async ({ jobId, promptId, username, edition, token }) =>
    validateJobIdWrapper(
      jobId,
      () => client.redoSummary(jobId, promptId, pickAuthOverride({ username, edition, token })),
      "redo_summary"
    )
);

server.tool(
  "get_shared_url",
  "Get a shareable URL for a transcript",
  { jobId: z.string() },
  async ({ jobId }) => validateJobIdWrapper(jobId, () => client.getSharedUrl(jobId), "get_shared_url")
);

server.tool(
  "download_audio",
  "Download the original audio file for a job",
  { jobId: z.string() },
  async ({ jobId }) => validateJobIdWrapper(jobId, () => client.receiveAudio(jobId), "download_audio")
);

server.tool(
  "batch_delete_jobs",
  "Delete multiple jobs at once. Returns success/failure count.",
  { jobIds: z.array(z.string()).describe("Array of job IDs to delete") },
  async ({ jobIds }) => {
    try {
      const results = await Promise.allSettled(
        jobIds.map(id => client.deleteJob(id))
      );

      const success = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      const failures = results
        .map((r, i) => r.status === 'rejected' ? { jobId: jobIds[i], error: (r as PromiseRejectedResult).reason?.message } : null)
        .filter(Boolean);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success,
            failed,
            total: jobIds.length,
            failures,
          }, null, 2),
        }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// ============ TRANSCRIPTION ============

server.tool(
  "upload_audio",
  "Upload and transcribe an audio file. Supports: local path, URL, or base64 encoded content.",
  {
    filePath: z.string().optional().describe("Absolute path to a local audio file"),
    fileUrl: z.string().url().optional().describe("URL to download the audio file from"),
    fileBase64: z.string().optional().describe("Base64 encoded audio file content"),
    filename: z.string().optional().describe("Filename (required for URL/base64, optional for path)"),
    timestampTranscript: z.boolean().default(true).describe("Include timestamps and speaker diarization"),
    doSummary: z.boolean().default(true).describe("Generate summary/compte-rendu after transcription"),
    formatTranscript: z.boolean().default(false).describe("Format transcript with GPT-4o"),
    speakersExpected: z.number().default(0).describe("Expected number of speakers (0 = auto-detect)"),
    promptId: z.string().optional().describe("Prompt model ID to use for summary"),
  },
  async ({ filePath, fileUrl, fileBase64, filename, timestampTranscript, doSummary, formatTranscript, speakersExpected, promptId }) => {
    try {
      logger.info("upload_audio called", { filePath, fileUrl, hasBase64: !!fileBase64 });

      // Use centralized file upload handler with validation
      const { fileBuffer, filename: finalFilename } = await handleFileUpload(
        filePath,
        fileUrl,
        fileBase64,
        filename
      );

      logger.info(`Uploading audio: ${finalFilename} (${fileBuffer.length} bytes)`);

      const response = await client.sendMultipleAudio(fileBuffer, finalFilename, {
        timestampTranscript,
        doSummary,
        formatTranscript,
        speakersExpected,
        promptId,
      });

      logger.info(`Upload successful, jobId: ${response?.jobId || 'unknown'}`);

      return {
        content: [{ type: "text" as const, text: JSON.stringify(response, null, 2) }],
      };
    } catch (error: any) {
      const errorDetails = formatError(error);
      logError(errorDetails, "upload_audio");
      return {
        content: [{ type: "text" as const, text: `❌ ${errorDetails.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "transcribe_youtube",
  "Transcribe a YouTube video",
  {
    url: z.string().url(),
    timestampTranscript: z.boolean().default(true),
    doSummary: z.boolean().default(true),
    speakersExpected: z.number().default(0),
  },
  async ({ url, timestampTranscript, doSummary, speakersExpected }) =>
    handleTool(() => client.sendYoutubeUrl(url, { timestampTranscript, doSummary, speakersExpected }))
);

// ============ PROMPTS ============

server.tool(
  "list_prompts",
  "List all user prompt models",
  {},
  async () => {
      const cacheKey = "user_prompts";
      const cached = promptsCache.get(cacheKey);
      if (cached) {
        metrics.recordCacheHit();
        logger.debug("Returning cached user prompts");
        return { content: [{ type: "text" as const, text: JSON.stringify(cached, null, 2) }] };
      }
      metrics.recordCacheMiss();
    return handleTool(async () => {
      const result = await client.getPromptModelsUserInfo();
      promptsCache.set(cacheKey, result, 5 * 60 * 1000); // 5 minutes
      return result;
    }, "list_prompts");
  }
);

server.tool(
  "list_standard_prompts",
  "List standard/default prompt models provided by Agilotext",
  {},
  async () => {
      const cacheKey = "standard_prompts";
      const cached = promptsCache.get(cacheKey);
      if (cached) {
        metrics.recordCacheHit();
        logger.debug("Returning cached standard prompts");
        return { content: [{ type: "text" as const, text: JSON.stringify(cached, null, 2) }] };
      }
      metrics.recordCacheMiss();
    return handleTool(async () => {
      const result = await client.getPromptModelsStandardInfo();
      promptsCache.set(cacheKey, result, 5 * 60 * 1000); // 5 minutes
      return result;
    }, "list_standard_prompts");
  }
);

server.tool(
  "get_prompt_content",
  "Get the full text content of a prompt model",
  { promptId: z.string() },
  async ({ promptId }) => handleTool(() => client.getPromptModelContent(promptId))
);

server.tool(
  "get_prompt_status",
  "Statut de **préparation** d’un prompt **utilisateur** (`UserPromptModel`) — pas les seuls modèles catalogue. Si l’id n’existe pas en base utilisateur, statut souvent UNKNOWN.",
  { promptId: z.string() },
  async ({ promptId }) => handleTool(() => client.getPromptModelUserStatus(promptId))
);

server.tool(
  "create_prompt",
  "Create a new prompt model with name and content",
  { name: z.string(), content: z.string() },
  async ({ name, content }) => {
    const result = await handleTool(() => client.createPromptModelUser(name, content), "create_prompt");
    // Invalidate prompts cache
    promptsCache.delete("user_prompts");
    return result;
  }
);

server.tool(
  "update_prompt",
  "Update an existing prompt model content",
  { promptId: z.string(), content: z.string() },
  async ({ promptId, content }) => {
    const result = await handleTool(() => client.updatePromptModelUser(promptId, content), "update_prompt");
    promptsCache.delete("user_prompts");
    return result;
  }
);

server.tool(
  "rename_prompt",
  "Rename a prompt model",
  { promptId: z.string(), newName: z.string() },
  async ({ promptId, newName }) => {
    const result = await handleTool(() => client.renamePromptModel(promptId, newName), "rename_prompt");
    promptsCache.delete("user_prompts");
    return result;
  }
);

server.tool(
  "set_default_prompt",
  "Définir le prompt **par défaut pour ce compte**. Le doc UI indique souvent un **promptId standard (catalogue)** ; le backend peut accepter aussi un id **utilisateur** selon version. Pas un réglage « pour tous les comptes ».",
  { promptId: z.string() },
  async ({ promptId }) => {
    const result = await handleTool(() => client.setPromptModelUserDefault(promptId), "set_default_prompt");
    promptsCache.delete("user_prompts");
    return result;
  }
);

server.tool(
  "create_standard_prompt_admin",
  "⚠️ **Admin / compte système uniquement** (API `createPromptModelStandard`). Crée un nouveau prompt **catalogue** global. Les comptes normaux reçoivent une erreur. Invalide le cache `list_standard_prompts`.",
  { promptName: z.string(), content: z.string() },
  async ({ promptName, content }) => {
    const result = await handleTool(
      () => client.createPromptModelStandard(promptName, content),
      "create_standard_prompt_admin"
    );
    promptsCache.delete("standard_prompts");
    return result;
  }
);

server.tool(
  "update_standard_prompt_admin",
  "⚠️ **Admin / compte système uniquement** (`updatePromptModelStandard`). Met à jour nom + contenu d’un **prompt standard** existant (`promptId` catalogue valide). Invalide le cache `list_standard_prompts`.",
  {
    promptId: z.string(),
    promptName: z.string(),
    content: z.string(),
  },
  async ({ promptId, promptName, content }) => {
    const result = await handleTool(
      () => client.updatePromptModelStandard(promptId, promptName, content),
      "update_standard_prompt_admin"
    );
    promptsCache.delete("standard_prompts");
    return result;
  }
);

server.tool(
  "delete_prompt",
  "Delete a prompt model",
  { promptId: z.string() },
  async ({ promptId }) => {
    const result = await handleTool(() => client.deletePromptModel(promptId), "delete_prompt");
    promptsCache.delete("user_prompts");
    return result;
  }
);

server.tool(
  "get_prompt_template",
  "Get the template file for a prompt model",
  { promptId: z.string() },
  async ({ promptId }) => handleTool(() => client.receivePromptModelTemplate(promptId))
);

// ============ REPROMPT ============

server.tool(
  "reprompt_transcript",
  "Apply a different prompt to an existing transcript to generate a new summary",
  { jobId: z.string(), promptId: z.string() },
  async ({ jobId, promptId }) => handleTool(() => client.rePromptTranscript(jobId, promptId))
);

server.tool(
  "get_reprompt_status",
  "Get status of a reprompt operation",
  { jobId: z.string(), promptId: z.string() },
  async ({ jobId, promptId }) => validateJobIdWrapper(jobId, () => client.getRePromptStatus(jobId, promptId), "get_reprompt_status")
);

server.tool(
  "download_reprompt",
  "Download the result of a reprompt operation",
  { jobId: z.string(), promptId: z.string(), format: z.enum(["txt", "html"]).default("html") },
  async ({ jobId, promptId, format }) => validateJobIdWrapper(jobId, () => client.receiveRepromptText(jobId, promptId, format), "download_reprompt")
);

// ============ WORD BOOST / LEXICON ============

server.tool(
  "list_wordboosts",
  "List all word boost dictionaries",
  {},
  async () => {
      const cacheKey = "wordboosts";
      const cached = wordboostsCache.get(cacheKey);
      if (cached) {
        metrics.recordCacheHit();
        logger.debug("Returning cached wordboosts");
        return { content: [{ type: "text" as const, text: JSON.stringify(cached, null, 2) }] };
      }
      metrics.recordCacheMiss();
    return handleTool(async () => {
      const result = await client.getWordBoostInfo2();
      wordboostsCache.set(cacheKey, result, 5 * 60 * 1000); // 5 minutes
      return result;
    }, "list_wordboosts");
  }
);

server.tool(
  "get_wordboost",
  "Get words in a specific word boost dictionary",
  { wordBoostId: z.string() },
  async ({ wordBoostId }) => handleTool(() => client.getWordBoost2(wordBoostId))
);

server.tool(
  "create_wordboost",
  "Create or update a word boost dictionary with custom words",
  { name: z.string(), words: z.array(z.string()) },
  async ({ name, words }) => {
    const result = await handleTool(() => client.setWordBoost2(name, words), "create_wordboost");
    wordboostsCache.delete("wordboosts");
    return result;
  }
);

server.tool(
  "rename_wordboost",
  "Rename a word boost dictionary",
  { wordBoostId: z.string(), newName: z.string() },
  async ({ wordBoostId, newName }) => {
    const result = await handleTool(() => client.renameWordBoost2(wordBoostId, newName), "rename_wordboost");
    wordboostsCache.delete("wordboosts");
    return result;
  }
);

server.tool(
  "set_default_wordboost",
  "Set a word boost dictionary as default for new transcriptions",
  { wordBoostId: z.string() },
  async ({ wordBoostId }) => {
    const result = await handleTool(() => client.setWordBoostDefault2(wordBoostId), "set_default_wordboost");
    wordboostsCache.delete("wordboosts");
    return result;
  }
);

server.tool(
  "delete_wordboost",
  "Delete a word boost dictionary",
  { wordBoostId: z.string() },
  async ({ wordBoostId }) => {
    const result = await handleTool(() => client.deleteWordBoost2(wordBoostId), "delete_wordboost");
    wordboostsCache.delete("wordboosts");
    return result;
  }
);

// ============ USER PREFERENCES ============

server.tool(
  "get_user_preferences",
  "Get user model preferences (AI model, etc.)",
  {},
  async () => handleTool(() => client.getUserModelPreference())
);

server.tool(
  "set_user_model_preference",
  "Set preferred AI model for transcription/summary",
  { modelPreference: z.string() },
  async ({ modelPreference }) => handleTool(() => client.setUserModelPreference(modelPreference))
);

server.tool(
  "get_send_defaults",
  "Get default settings for audio uploads",
  {},
  async () => handleTool(() => client.getUserSendDefaults())
);

server.tool(
  "get_mail_notifications",
  "Get email notification preferences",
  {},
  async () => handleTool(() => client.getMailNotifyType())
);

server.tool(
  "set_mail_notifications",
  "Set email notification preferences",
  { notifyType: z.string() },
  async ({ notifyType }) => handleTool(() => client.setMailNotifyType(notifyType))
);

// ============ WEBHOOKS ============

server.tool(
  "create_webhook",
  "Create a webhook for job completion notifications",
  { webhookUrl: z.string().url(), eventType: z.string() },
  async ({ webhookUrl, eventType }) => handleTool(() => client.webhookCreate(webhookUrl, eventType))
);

server.tool(
  "get_webhook_status",
  "Get current webhook configuration status",
  {},
  async () => handleTool(() => client.webhookGetStatus())
);

server.tool(
  "resend_webhook",
  "Resend webhook notification for a specific job",
  { jobId: z.string() },
  async ({ jobId }) => handleTool(() => client.webhookResend(jobId))
);

// ============ CONCATENATION ============

server.tool(
  "concatenate_jobs",
  "Merge multiple transcription jobs into one",
  { jobIds: z.array(z.string()), newName: z.string() },
  async ({ jobIds, newName }) => handleTool(() => client.sendForConcatenation(jobIds, newName))
);

server.tool(
  "get_concat_status",
  "Get status of a concatenation job",
  { concatJobId: z.string() },
  async ({ concatJobId }) => handleTool(() => client.getConcatStatus(concatJobId))
);

server.tool(
  "list_concat_jobs",
  "List concatenation jobs",
  { limit: z.number().default(20), offset: z.number().default(0) },
  async ({ limit, offset }) => handleTool(() => client.getConcatJobsInfo(limit, offset))
);

// ============ UTILITIES ============

server.tool(
  "anonymize_text",
  "Anonymize personal data in text (names, addresses, etc.)",
  { text: z.string() },
  async ({ text }) => handleTool(() => client.anonText(text))
);

server.tool(
  "get_usage_stats",
  "Get number of uploads for a period (day, week, month)",
  { period: z.enum(["day", "week", "month"]).default("month") },
  async ({ period }) => handleTool(() => client.getNumberOfUploadsForPeriod(period))
);

server.tool(
  "get_api_version",
  "Get Agilotext API version",
  {},
  async () => handleTool(() => client.getVersion())
);

server.tool(
  "cleanup_old_jobs",
  "Delete jobs older than specified days",
  { daysOld: z.number().default(30) },
  async ({ daysOld }) => handleTool(() => client.cleanupOldJobs(daysOld))
);

server.tool(
  "get_automation_token",
  "Generate a new automation token for external integrations",
  {},
  async () => handleTool(() => client.getNewAutomationToken())
);

server.tool(
  "set_google_drive_url",
  "Configure Google Drive integration URL",
  { googleDriveUrl: z.string().url() },
  async ({ googleDriveUrl }) => handleTool(() => client.setGoogleDriveUrl(googleDriveUrl), "set_google_drive_url")
);

// ============ UNEXPOSED API METHODS ============

server.tool(
  "get_wordboost_status",
  "Get the processing status of a wordboost",
  { wordBoostId: z.string() },
  async ({ wordBoostId }) => handleTool(() => client.getStatusWordBoost2(wordBoostId), "get_wordboost_status")
);

server.tool(
  "set_send_defaults",
  "Set default options for new transcriptions",
  {
    timestampTranscript: z.boolean().optional().describe("Include timestamps by default"),
    doSummary: z.boolean().optional().describe("Generate summary by default"),
    speakersExpected: z.number().optional().describe("Default expected speakers"),
    formatTranscript: z.boolean().optional().describe("Format transcript with GPT-4o by default"),
  },
  async (defaults) => handleTool(() => client.setUserSendDefaults(defaults), "set_send_defaults")
);

// ============ WRAPPER UTILITIES ============

server.tool(
  "wait_for_job",
  "Wait until a job reaches a specific status (polls every 10s). Returns when READY, READY_SUMMARY_READY, or ON_ERROR.",
  {
    jobId: z.string().describe("The job ID to wait for"),
    maxWaitSeconds: z.number().default(300).describe("Maximum time to wait (default 5 minutes)"),
    targetStatus: z.enum(["READY", "READY_SUMMARY_READY", "ON_ERROR", "ANY_READY"]).default("READY_SUMMARY_READY").describe("Status to wait for"),
  },
  async ({ jobId, maxWaitSeconds, targetStatus }) => {
    try {
      const startTime = Date.now();
      const pollInterval = 10000; // 10 seconds

      while ((Date.now() - startTime) < maxWaitSeconds * 1000) {
        const status = await client.getTranscriptStatus(jobId);
        const currentStatus = status.transcriptStatus;

        logger.debug(`wait_for_job: ${jobId} status = ${currentStatus}`);

        // Check if target reached
        if (targetStatus === "ANY_READY" && (currentStatus === "READY" || currentStatus === "READY_SUMMARY_READY")) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ ready: true, status: currentStatus, jobId }, null, 2) }] };
        }
        if (currentStatus === targetStatus) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ ready: true, status: currentStatus, jobId }, null, 2) }] };
        }
        if (currentStatus === "ON_ERROR") {
          return { content: [{ type: "text" as const, text: JSON.stringify({ ready: false, status: "ON_ERROR", error: status.errorMessage, jobId }, null, 2) }], isError: true };
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      return {
        content: [{ type: "text" as const, text: `❌ Timeout: Job ${jobId} did not reach ${targetStatus} within ${maxWaitSeconds}s` }],
        isError: true
      };
    } catch (error: any) {
      const errorDetails = formatError(error);
      logError(errorDetails, "wait_for_job");
      return { content: [{ type: "text" as const, text: `❌ ${errorDetails.message}` }], isError: true };
    }
  }
);

server.tool(
  "upload_and_wait",
  "Upload audio, wait for completion, and return the transcript + summary. All-in-one workflow.",
  {
    filePath: z.string().optional().describe("Local file path"),
    fileUrl: z.string().url().optional().describe("URL to download from"),
    fileBase64: z.string().optional().describe("Base64 encoded content"),
    filename: z.string().optional().describe("Filename (required for URL/base64)"),
    timestampTranscript: z.boolean().default(true),
    doSummary: z.boolean().default(true),
    maxWaitSeconds: z.number().default(300).describe("Max wait time for completion"),
  },
  async ({ filePath, fileUrl, fileBase64, filename, timestampTranscript, doSummary, maxWaitSeconds }) => {
    try {
      logger.info("upload_and_wait: Starting");

      // Step 1: Upload using centralized handler with validation
      const { fileBuffer, filename: finalFilename } = await handleFileUpload(
        filePath,
        fileUrl,
        fileBase64,
        filename
      );

      const uploadResult = await client.sendMultipleAudio(fileBuffer, finalFilename, { timestampTranscript, doSummary });
      const jobId = uploadResult.jobId;
      logger.info(`upload_and_wait: Uploaded, jobId = ${jobId}`);

      // Step 2: Wait for completion
      const startTime = Date.now();
      const pollInterval = 10000;

      while ((Date.now() - startTime) < maxWaitSeconds * 1000) {
        const status = await client.getTranscriptStatus(jobId);
        const currentStatus = status.transcriptStatus;

        if (currentStatus === "READY_SUMMARY_READY" || (currentStatus === "READY" && !doSummary)) {
          // Step 3: Download results
          const transcript = await client.receiveText(jobId, "txt");
          const summary = doSummary ? await client.receiveSummary(jobId, "txt") : null;
          const sharedUrl = await client.getSharedUrl(jobId);

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                jobId,
                filename: finalFilename,
                sharedUrl: sharedUrl.sharedUrl,
                transcript: transcript.content || transcript,
                summary: summary?.content || summary || null,
              }, null, 2)
            }]
          };
        }

        if (currentStatus === "ON_ERROR") {
          return { content: [{ type: "text" as const, text: `❌ Job failed: ${status.errorMessage}` }], isError: true };
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      return { content: [{ type: "text" as const, text: `❌ Timeout waiting for job ${jobId}` }], isError: true };
    } catch (error: any) {
      const errorDetails = formatError(error);
      logError(errorDetails, "upload_and_wait");
      return { content: [{ type: "text" as const, text: `❌ ${errorDetails.message}` }], isError: true };
    }
  }
);

server.tool(
  "batch_download",
  "Download transcripts for multiple jobs in parallel",
  {
    jobIds: z.array(z.string()).describe("Array of job IDs"),
    format: z.enum(["txt", "rtf", "docx", "pdf"]).default("txt"),
    includesSummary: z.boolean().default(false).describe("Also download summaries"),
  },
  async ({ jobIds, format, includesSummary }) => {
    try {
      logger.info(`batch_download: ${jobIds.length} jobs, format=${format}`);

      // Validate all jobIds first
      for (const jobId of jobIds) {
        try {
          validateJobId(jobId);
        } catch (error: any) {
          return {
            content: [{ type: "text" as const, text: `❌ Invalid jobId: ${jobId} - ${error.message}` }],
            isError: true,
          };
        }
      }

      // Limit concurrency to 5 simultaneous requests
      const maxConcurrent = 5;
      const results: Array<PromiseSettledResult<any>> = [];

      for (let i = 0; i < jobIds.length; i += maxConcurrent) {
        const batch = jobIds.slice(i, i + maxConcurrent);
        const batchResults = await Promise.allSettled(
          batch.map(async (jobId) => {
            const transcript = await client.receiveText(jobId, format);
            const summary = includesSummary ? await client.receiveSummary(jobId, "txt") : null;
            return { jobId, transcript: transcript.content || transcript, summary: summary?.content || null };
          })
        );
        results.push(...batchResults);
      }

      const successes = results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<any>).value);
      const failures = results.map((r, i) => r.status === 'rejected' ? { jobId: jobIds[i], error: (r as PromiseRejectedResult).reason?.message } : null).filter(Boolean);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: successes.length,
            failed: failures.length,
            results: successes,
            failures,
          }, null, 2)
        }]
      };
    } catch (error: any) {
      const errorDetails = formatError(error);
      logError(errorDetails, "batch_download");
      return { content: [{ type: "text" as const, text: `❌ ${errorDetails.message}` }], isError: true };
    }
  }
);

server.tool(
  "health_check",
  "Check if Agilotext API is reachable and credentials are valid",
  {},
  async () => {
    try {
      const startTime = Date.now();
      /** GET public : selon l’environnement API peut échouer — ne bloque pas le health. */
      let apiVersion: any = null;
      try {
        apiVersion = await client.getVersion();
      } catch {
        apiVersion = { note: "getVersion non disponible (ignoré pour le statut)" };
      }
      /** Vérif authentifiée (POST multipart + token) — requis pour « healthy ». */
      const jobsProbe = await client.getJobsInfo(1, 0);
      let prefs: any = null;
      try {
        prefs = await client.getUserModelPreference();
      } catch {
        prefs = { note: "getUserModelPreference indisponible (non bloquant)" };
      }
      const latency = Date.now() - startTime;

      // Check webhook configuration (optional)
      const webhooksConfigured = {
        emailThread: !!config.MCP_EMAIL_THREAD_WEBHOOK,
        emailDraft: !!config.MCP_EMAIL_DRAFT_WEBHOOK,
        crm: !!config.MCP_CRM_WEBHOOK,
        calendar: !!config.MCP_CALENDAR_WEBHOOK,
      };

      // Get system metrics
      const memUsage = process.memoryUsage();
      const uptime = process.uptime();

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "healthy",
            apiVersion: apiVersion?.version ?? apiVersion,
            jobsProbeOk: jobsProbe?.status === "OK",
            latencyMs: latency,
            modelPreference: prefs?.modelPreference ?? prefs,
            webhooks: webhooksConfigured,
            system: {
              memoryMB: Math.round(memUsage.heapUsed / 1024 / 1024),
              uptimeSeconds: Math.round(uptime),
            },
            metrics: metrics.getSummary(),
            timestamp: new Date().toISOString(),
          }, null, 2)
        }]
      };
    } catch (error: any) {
      const errorDetails = formatError(error);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "unhealthy",
            error: errorDetails.message,
            timestamp: new Date().toISOString(),
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

// ============ 🚀 2026 KILLER FEATURES ============

// ============ SEMANTIC SEARCH ============

server.tool(
  "search_transcripts",
  "🔍 Search across all transcripts for specific content, keywords, or topics. Returns matching jobs with context.",
  {
    query: z.string().describe("Search query (keywords, phrases, or natural language)"),
    limit: z.number().default(10).describe("Max results to return"),
    dateFrom: z.string().optional().describe("Filter from date (YYYY-MM-DD)"),
    dateTo: z.string().optional().describe("Filter to date (YYYY-MM-DD)"),
  },
  async ({ query, limit, dateFrom, dateTo }) => {
    try {
      logger.info(`search_transcripts: "${query}" limit=${limit}`);

      // Get all jobs
      const jobs = await client.getJobsInfo(100, 0);
      let jobsList = jobs.jobsInfoDtos || [];

      // Apply date filters
      if (dateFrom) {
        const from = new Date(dateFrom);
        jobsList = jobsList.filter((j: any) => new Date(j.creationDate) >= from);
      }
      if (dateTo) {
        const to = new Date(dateTo);
        jobsList = jobsList.filter((j: any) => new Date(j.creationDate) <= to);
      }

      // Only search ready jobs
      jobsList = jobsList.filter((j: any) =>
        j.transcriptStatus === "READY" || j.transcriptStatus === "READY_SUMMARY_READY"
      );

      // Search in transcripts (parallel)
      const searchResults = await Promise.allSettled(
        jobsList.slice(0, 30).map(async (job: any) => {
          try {
            const transcript = await client.receiveText(job.jobId, "txt");
            const content = transcript.content || transcript || "";
            const queryLower = query.toLowerCase();

            // Simple keyword matching + context extraction
            if (content.toLowerCase().includes(queryLower)) {
              const index = content.toLowerCase().indexOf(queryLower);
              const start = Math.max(0, index - 100);
              const end = Math.min(content.length, index + query.length + 100);
              const context = content.substring(start, end);

              return {
                jobId: job.jobId,
                filename: job.filename,
                date: job.creationDate,
                matchContext: `...${context}...`,
                matchCount: (content.toLowerCase().match(new RegExp(queryLower, 'g')) || []).length,
              };
            }
            return null;
          } catch {
            return null;
          }
        })
      );

      const matches = searchResults
        .filter(r => r.status === 'fulfilled' && r.value !== null)
        .map(r => (r as PromiseFulfilledResult<any>).value)
        .sort((a, b) => b.matchCount - a.matchCount)
        .slice(0, limit);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            query,
            totalMatches: matches.length,
            results: matches,
          }, null, 2)
        }]
      };
    } catch (error: any) {
      const errorDetails = formatError(error);
      logError(errorDetails, "search_transcripts");
      return { content: [{ type: "text" as const, text: `❌ ${errorDetails.message}` }], isError: true };
    }
  }
);

// ============ MEETING INTELLIGENCE ============

server.tool(
  "extract_meeting_insights",
  "🧠 Extract action items, decisions, questions, and key topics from a transcript. AI-powered meeting intelligence.",
  {
    jobId: z.string().describe("The job ID to analyze"),
  },
  async ({ jobId }) => {
    try {
      validateJobId(jobId);
      logger.info(`extract_meeting_insights: ${jobId}`);

      const transcript = await client.receiveText(jobId, "txt");
      const content = transcript.content || transcript || "";

      // Use centralized meeting insights extraction
      const insights = deriveMeetingInsightsFromText(content);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            jobId,
            ...insights,
          }, null, 2)
        }]
      };
    } catch (error: any) {
      const errorDetails = formatError(error);
      logError(errorDetails, "extract_meeting_insights");
      return { content: [{ type: "text" as const, text: `❌ ${errorDetails.message}` }], isError: true };
    }
  }
);

// ============ CONTEXT CONNECTORS & PACKS ============

server.tool(
  "fetch_email_thread",
  "Find emails in your inbox",
  {
    provider: z.enum(["auto", "gmail", "outlook", "imap", "other"]).default("auto").optional().describe("Email provider (auto-detected if not specified)"),
    threadId: z.string().optional(),
    subject: z.string().optional(),
    participants: z.array(z.string()).optional(),
    fromEmail: z.string().optional(),
    toEmail: z.string().optional(),
    sinceDays: z.number().default(30),
    maxMessages: z.number().default(10),
    query: z.string().optional(),
  },
  async ({ provider = "auto", threadId, subject, participants, fromEmail, toEmail, sinceDays, maxMessages, query }) => {
    try {
      // Auto-detect provider if not specified
      const detectedProvider = provider === "auto" ? detectEmailProvider() : provider;
      
      const data = await callWebhook(
        config.MCP_EMAIL_THREAD_WEBHOOK,
        {
          action: "fetch_email_thread",
          provider: detectedProvider, threadId, subject, participants, fromEmail, toEmail, sinceDays, maxMessages, query,
        },
        "fetch_email_thread",
        "MCP_EMAIL_THREAD_WEBHOOK"
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (error: any) {
      const errorDetails = formatError(error, undefined, "fetch_email_thread");
      logError(errorDetails, "fetch_email_thread");
      return { content: [{ type: "text" as const, text: "❌ " + errorDetails.message }], isError: true };
    }
  }
);

server.tool(
  "fetch_calendar_context",
  "Find meetings in your calendar",
  {
    source: z.enum(["auto", "google", "outlook", "ics", "other"]).default("auto").optional().describe("Calendar source (auto-detected if not specified)"),
    eventId: z.string().optional(),
    title: z.string().optional(),
    date: z.string().optional(),
    participants: z.array(z.string()).optional(),
    timezone: z.string().optional(),
  },
  async ({ source = "auto", eventId, title, date, participants, timezone }) => {
    try {
      // Auto-detect source if not specified
      const detectedSource = source === "auto" ? detectCalendarSource() : source;
      
      const data = await callWebhook(
        config.MCP_CALENDAR_WEBHOOK,
        { action: "fetch_calendar_context", source: detectedSource, eventId, title, date, participants, timezone },
        "fetch_calendar_context",
        "MCP_CALENDAR_WEBHOOK"
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (error: any) {
      const errorDetails = formatError(error, undefined, "fetch_calendar_context");
      logError(errorDetails, "fetch_calendar_context");
      return { content: [{ type: "text" as const, text: "❌ " + errorDetails.message }], isError: true };
    }
  }
);

// ============ USER-FRIENDLY WRAPPER TOOLS ============

server.tool(
  "find_my_emails",
  "Search and find emails in your inbox (read-only)",
  {
    query: z.string().optional().describe("Search for emails containing this text"),
    subject: z.string().optional().describe("Search by email subject"),
    participants: z.array(z.string()).optional().describe("Filter by email participants"),
    fromEmail: z.string().optional().describe("Filter by sender email address"),
    toEmail: z.string().optional().describe("Filter by recipient email address"),
    sinceDays: z.number().default(30).describe("Search emails from the last N days"),
    maxResults: z.number().default(10).describe("Maximum number of results to return"),
  },
  async ({ query, subject, participants, fromEmail, toEmail, sinceDays, maxResults }) => {
    try {
      // Auto-detect provider
      const detectedProvider = detectEmailProvider();
      
      const data = await callWebhook(
        config.MCP_EMAIL_THREAD_WEBHOOK,
        {
          action: "fetch_email_thread",
          provider: detectedProvider,
          subject,
          participants,
          fromEmail,
          toEmail,
          sinceDays,
          maxMessages: maxResults,
          query,
        },
        "find_my_emails",
        "MCP_EMAIL_THREAD_WEBHOOK"
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (error: any) {
      const errorDetails = formatError(error, undefined, "find_my_emails");
      logError(errorDetails, "find_my_emails");
      return { content: [{ type: "text" as const, text: "❌ " + errorDetails.message }], isError: true };
    }
  }
);

server.tool(
  "find_my_meetings",
  "Find meetings in your calendar (read-only)",
  {
    date: z.string().optional().describe("Find meetings on this date (YYYY-MM-DD)"),
    title: z.string().optional().describe("Search by meeting title"),
    participants: z.array(z.string()).optional().describe("Filter by meeting participants"),
    timezone: z.string().optional().describe("Timezone for date filtering (e.g., 'Europe/Paris')"),
  },
  async ({ date, title, participants, timezone }) => {
    try {
      // Auto-detect source
      const detectedSource = detectCalendarSource();
      
      const data = await callWebhook(
        config.MCP_CALENDAR_WEBHOOK,
        { 
          action: "fetch_calendar_context", 
          source: detectedSource, 
          date, 
          title, 
          participants, 
          timezone 
        },
        "find_my_meetings",
        "MCP_CALENDAR_WEBHOOK"
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (error: any) {
      const errorDetails = formatError(error, undefined, "find_my_meetings");
      logError(errorDetails, "find_my_meetings");
      return { content: [{ type: "text" as const, text: "❌ " + errorDetails.message }], isError: true };
    }
  }
);

server.tool(
  "crm_upsert_contact",
  "Add or update a contact in your CRM",
  {
    email: z.string().email(),
    name: z.string().optional(),
    company: z.string().optional(),
    phone: z.string().optional(),
    externalId: z.string().optional(),
    tags: z.array(z.string()).optional(),
    metadata: z.record(z.any()).optional(),
  },
  async ({ email, name, company, phone, externalId, tags, metadata }) => {
    try {
      const data = await callWebhook(
        config.MCP_CRM_WEBHOOK,
        { action: "upsert_contact", email, name, company, phone, externalId, tags, metadata },
        "crm_upsert_contact",
        "MCP_CRM_WEBHOOK"
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (error: any) {
      const errorDetails = formatError(error);
      logError(errorDetails, "crm_upsert_contact");
      return { content: [{ type: "text" as const, text: "❌ " + errorDetails.message }], isError: true };
    }
  }
);

server.tool(
  "crm_attach_transcript",
  "Link a transcript to a contact in your CRM",
  {
    jobId: z.string().describe("Job ID"),
    contactId: z.string().optional(),
    email: z.string().optional(),
    title: z.string().optional(),
    includeSummary: z.boolean().default(true),
    summaryFormat: z.enum(["txt", "html", "rtf", "docx", "pdf"]).default("txt"),
    includeSharedUrl: z.boolean().default(true),
  },
  async ({ jobId, contactId, email, title, includeSummary, summaryFormat, includeSharedUrl }) => {
    try {
      let summary: any = null;
      let sharedUrl: any = null;

      if (includeSummary) {
        const s = await client.receiveSummary(jobId, summaryFormat);
        summary = (s && (s.content || s.summary || s)) || null;
      }
      if (includeSharedUrl) {
        const u = await client.getSharedUrl(jobId);
        sharedUrl = (u && (u.sharedUrl || u.url || u)) || null;
      }

      const data = await callWebhook(
        config.MCP_CRM_WEBHOOK,
        { action: "attach_transcript", jobId, contactId, email, title, summary, summaryFormat, sharedUrl },
        "crm_attach_transcript",
        "MCP_CRM_WEBHOOK"
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (error: any) {
      const errorDetails = formatError(error, undefined, "crm_attach_transcript");
      logError(errorDetails, "crm_attach_transcript");
      return { content: [{ type: "text" as const, text: "❌ " + errorDetails.message }], isError: true };
    }
  }
);

server.tool(
  "extract_email_style",
  "Extract a style fingerprint from an email thread",
  {
    emailThread: z.string().describe("Full email thread")
  },
  async ({ emailThread }) => {
    try {
      const raw = String(emailThread || '');
      const fingerprint = deriveEmailStyleFingerprint(raw);

      return { content: [{ type: "text" as const, text: JSON.stringify(fingerprint, null, 2) }] };
    } catch (error: any) {
      const errorDetails = formatError(error);
      logError(errorDetails, "extract_email_style");
      return { content: [{ type: "text" as const, text: "❌ " + errorDetails.message }], isError: true };
    }
  }
);

server.tool(
  "build_context_pack",
  "Build a unified context pack for follow-up tasks (email/CRM)",
  {
    jobId: z.string(),
    includeSummary: z.boolean().default(true),
    includeTranscript: z.boolean().default(false),
    includeInsights: z.boolean().default(true),
    includeSharedUrl: z.boolean().default(true),
    includeEmailStyle: z.boolean().default(true),
    emailThread: z.string().optional(),
    crmContext: z.string().optional(),
    calendarContext: z.string().optional(),
  },
  async ({ jobId, includeSummary, includeTranscript, includeInsights, includeSharedUrl, includeEmailStyle, emailThread, crmContext, calendarContext }) => {
    try {
      validateJobId(jobId);
      const pack: any = { jobId, emailThread, crmContext, calendarContext };

      if (emailThread && includeEmailStyle) {
        pack.emailStyle = deriveEmailStyleFingerprint(emailThread);
      }

      let transcriptText = '';
      if (includeTranscript || includeInsights) {
        const t = await client.receiveText(jobId, "txt");
        transcriptText = (t && (t.content || t)) || '';
        if (includeTranscript) pack.transcript = transcriptText;
      }

      if (includeSummary) {
        const s = await client.receiveSummary(jobId, "txt");
        pack.summary = (s && (s.content || s)) || '';
      }

      if (includeSharedUrl) {
        const u = await client.getSharedUrl(jobId);
        pack.sharedUrl = (u && (u.sharedUrl || u.url || u)) || null;
      }

      if (includeInsights) {
        pack.meetingInsights = deriveMeetingInsightsFromText(transcriptText || '');
      }

      return { content: [{ type: "text" as const, text: JSON.stringify(pack, null, 2) }] };
    } catch (error: any) {
      const errorDetails = formatError(error);
      logError(errorDetails, "build_context_pack");
      return { content: [{ type: "text" as const, text: "❌ " + errorDetails.message }], isError: true };
    }
  }
);

server.tool(
  "sync_contact_and_attach",
  "Upsert a CRM contact then attach transcript/summary in one call",
  {
    jobId: z.string(),
    email: z.string().email(),
    name: z.string().optional(),
    company: z.string().optional(),
    phone: z.string().optional(),
    contactId: z.string().optional(),
    title: z.string().optional(),
    includeSummary: z.boolean().default(true),
    summaryFormat: z.enum(["txt", "html", "rtf", "docx", "pdf"]).default("txt"),
    includeSharedUrl: z.boolean().default(true),
    tags: z.array(z.string()).optional(),
    metadata: z.record(z.any()).optional(),
  },
    async ({ jobId, email, name, company, phone, contactId, title, includeSummary, summaryFormat, includeSharedUrl, tags, metadata }) => {
    try {
      validateJobId(jobId);
      let upsertResp: any = null;
      let resolvedId = contactId || null;

      if (!resolvedId) {
        upsertResp = await callWebhook(
          config.MCP_CRM_WEBHOOK,
          { action: "upsert_contact", email, name, company, phone, tags, metadata },
          "sync_contact_and_attach",
          "MCP_CRM_WEBHOOK"
        );
        resolvedId = (upsertResp && (upsertResp.contactId || upsertResp.id || upsertResp.recordId)) || null;
      }

      let summary: any = null;
      let sharedUrl: any = null;
      if (includeSummary) {
        const s = await client.receiveSummary(jobId, summaryFormat);
        summary = (s && (s.content || s.summary || s)) || null;
      }
      if (includeSharedUrl) {
        const u = await client.getSharedUrl(jobId);
        sharedUrl = (u && (u.sharedUrl || u.url || u)) || null;
      }

      const attachResp = await callWebhook(
        config.MCP_CRM_WEBHOOK,
        { action: "attach_transcript", jobId, contactId: resolvedId, email, title, summary, summaryFormat, sharedUrl },
        "sync_contact_and_attach",
        "MCP_CRM_WEBHOOK"
      );

      return { content: [{ type: "text" as const, text: JSON.stringify({ upsert: upsertResp, attach: attachResp }, null, 2) }] };
    } catch (error: any) {
      const errorDetails = formatError(error);
      logError(errorDetails, "sync_contact_and_attach");
      return { content: [{ type: "text" as const, text: "❌ " + errorDetails.message }], isError: true };
    }
  }
);

server.tool(
  "generate_followup_email",
  "Create a follow-up email draft (draft only)",
  {
    jobId: z.string(),
    language: z.string().optional(),
    recipientName: z.string().optional(),
    recipientEmail: z.string().optional(),
    tone: z.string().optional(),
    emailThread: z.string().optional(),
    crmContext: z.string().optional(),
    calendarContext: z.string().optional(),
    includeSummary: z.boolean().default(true),
    includeInsights: z.boolean().default(true),
    includeEmailStyle: z.boolean().default(true),
    includeSharedUrl: z.boolean().default(true),
    extraInstructions: z.string().optional(),
    // Thread management parameters
    threadId: z.string().optional().describe("Gmail thread ID for reply threading"),
    replyToMessageId: z.string().optional().describe("Message ID to reply to"),
    originalSubject: z.string().optional().describe("Original subject for 'Re:' prefix"),
    sendAsDraft: z.boolean().default(false).describe("Save as draft instead of sending"),
  },
  async ({ jobId, language, recipientName, recipientEmail, tone, emailThread, crmContext, calendarContext, includeSummary, includeInsights, includeEmailStyle, includeSharedUrl, extraInstructions, threadId, replyToMessageId, originalSubject, sendAsDraft }) => {
    try {
      // Validate inputs
      validateEmailGenerationInputs({
        jobId,
        emailThread,
        transcriptText: "", // Will be loaded later if needed
        recipientEmail,
      });

      // Rate limiting check
      const userId = config.AGILOTEXT_USERNAME; // Use authenticated user as ID
      const rateLimitCheck = emailRateLimiter.checkLimit(userId);
      if (!rateLimitCheck.allowed) {
        metrics.recordRateLimitHit();
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: "Rate limit exceeded",
              retryAfter: rateLimitCheck.retryAfter,
              message: `Too many emails sent. Please wait ${rateLimitCheck.retryAfter} seconds before retrying.`,
            }, null, 2),
          }],
          isError: true,
        };
      }

      // Sanitize user inputs before sending to LLM
      const sanitizedEmailThread = emailThread ? sanitizeForLlm(emailThread) : undefined;
      const sanitizedExtraInstructions = extraInstructions ? sanitizeForLlm(extraInstructions) : undefined;

      const pack: any = { 
        jobId, 
        emailThread: sanitizedEmailThread, 
        crmContext, 
        calendarContext 
      };

      if (sanitizedEmailThread && includeEmailStyle) {
        pack.emailStyle = deriveEmailStyleFingerprint(sanitizedEmailThread);
      }

      let transcriptText = '';
      if (includeInsights) {
        const t = await client.receiveText(jobId, "txt");
        transcriptText = (t && (t.content || t)) || '';
        pack.meetingInsights = deriveMeetingInsightsFromText(transcriptText || '');
      }

      if (includeSummary) {
        const s = await client.receiveSummary(jobId, "txt");
        pack.summary = (s && (s.content || s)) || '';
      }

      if (includeSharedUrl) {
        const u = await client.getSharedUrl(jobId);
        pack.sharedUrl = (u && (u.sharedUrl || u.url || u)) || null;
      }

      // Prepare threading headers
      const threadingHeaders: any = {};
      if (threadId) {
        threadingHeaders.threadId = threadId;
      }
      if (replyToMessageId) {
        threadingHeaders.inReplyTo = replyToMessageId;
        threadingHeaders.references = replyToMessageId;
      }
      if (originalSubject) {
        threadingHeaders.originalSubject = originalSubject;
      }

      // Record rate limit action
      emailRateLimiter.recordAction(userId);

      const data = await callWebhook(
        config.MCP_EMAIL_DRAFT_WEBHOOK,
        {
          action: "generate_followup_email",
          jobId,
          pack,
          options: {
            language,
            recipientName,
            recipientEmail,
            tone,
            extraInstructions: sanitizedExtraInstructions,
            sendAsDraft,
          },
          threading: threadingHeaders,
        },
        "generate_followup_email",
        "MCP_EMAIL_DRAFT_WEBHOOK"
      );

      // Validate and sanitize webhook response
      const validatedData = validateEmailDraftResponse(data);
      
      // Sanitize HTML if present
      if (validatedData.html) {
        validatedData.html = sanitizeHtml(validatedData.html);
      }

      // Release rate limit
      emailRateLimiter.releaseAction(userId);

      return { content: [{ type: "text" as const, text: JSON.stringify(validatedData, null, 2) }] };
    } catch (error: any) {
      const errorDetails = formatError(error);
      logError(errorDetails, "generate_followup_email");
      
      // Release rate limit on error
      const userId = config.AGILOTEXT_USERNAME;
      emailRateLimiter.releaseAction(userId);
      
      return { content: [{ type: "text" as const, text: "❌ " + errorDetails.message }], isError: true };
    }
  }
);

// ============ AI PROMPT SUGGESTION ============

server.tool(
  "suggest_prompt",
  "💡 Analyze a transcript and suggest the best prompt model to use. AI-powered recommendation.",
  {
    jobId: z.string().describe("The job ID to analyze"),
  },
  async ({ jobId }) => {
    try {
      validateJobId(jobId);
      logger.info(`suggest_prompt: ${jobId}`);

      // Get transcript and available prompts
      const transcript = await client.receiveText(jobId, "txt");
      const content = (transcript.content || transcript || "").toLowerCase();
      const prompts = await client.getPromptModelsUserInfo();
      const standardPrompts = await client.getPromptModelsStandardInfo();

      const allPrompts = [
        ...(prompts.promptModelsUserInfoDtos || []),
        ...(standardPrompts.promptModelsStandardInfoDtos || [])
      ];

      // Content analysis for suggestion
      const patterns = {
        meeting: /\b(réunion|meeting|agenda|action|point|discussion|participants)\b/g,
        interview: /\b(entretien|interview|candidat|poste|compétences|expérience|recrutement)\b/g,
        medical: /\b(patient|médecin|diagnostic|symptôme|traitement|prescription|consultation)\b/g,
        legal: /\b(client|avocat|dossier|procédure|tribunal|jugement|contrat|attestation)\b/g,
        sales: /\b(client|vente|produit|prix|offre|négociation|prospect|deal)\b/g,
        podcast: /\b(épisode|podcast|auditeur|émission|invité|sujet|thème)\b/g,
        education: /\b(cours|étudiant|professeur|examen|formation|apprentissage|module)\b/g,
      };

      const scores: Record<string, number> = {};
      for (const [type, pattern] of Object.entries(patterns)) {
        const matches = content.match(pattern) || [];
        scores[type] = matches.length;
      }

      const bestType = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

      // Map type to prompt suggestion
      const typeToPromptKeywords: Record<string, string[]> = {
        meeting: ['réunion', 'meeting', 'compte-rendu', 'cr'],
        interview: ['entretien', 'interview', 'rh', 'recrutement'],
        medical: ['médical', 'consultation', 'patient'],
        legal: ['juridique', 'avocat', 'legal'],
        sales: ['commercial', 'vente', 'sales'],
        podcast: ['podcast', 'interview', 'épisode'],
        education: ['formation', 'cours', 'éducation'],
      };

      const suggestedPrompts = allPrompts.filter((p: any) => {
        const promptName = (p.promptName || p.name || '').toLowerCase();
        const keywords = typeToPromptKeywords[bestType[0]] || [];
        return keywords.some(kw => promptName.includes(kw));
      });

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            jobId,
            detectedType: bestType[0],
            confidence: bestType[1] > 10 ? "high" : bestType[1] > 5 ? "medium" : "low",
            allScores: scores,
            suggestedPrompts: suggestedPrompts.length > 0
              ? suggestedPrompts.map((p: any) => ({ id: p.promptId || p.id, name: p.promptName || p.name }))
              : [{ suggestion: "Aucun prompt spécifique trouvé, utilisez le prompt par défaut" }],
            recommendation: `Ce transcript ressemble à un ${bestType[0]}. ${suggestedPrompts.length > 0 ? `Utilisez le prompt "${suggestedPrompts[0]?.promptName || suggestedPrompts[0]?.name}"` : "Créez un prompt spécialisé pour ce type de contenu."}`,
          }, null, 2)
        }]
      };
    } catch (error: any) {
      const errorDetails = formatError(error);
      logError(errorDetails, "suggest_prompt");
      return { content: [{ type: "text" as const, text: `❌ ${errorDetails.message}` }], isError: true };
    }
  }
);

// ============ CROSS-JOB INSIGHTS ============

server.tool(
  "get_job_analytics",
  "📊 Get advanced analytics across all your transcription jobs: trends, patterns, usage stats.",
  {
    period: z.enum(["week", "month", "quarter", "year"]).default("month"),
  },
  async ({ period }) => {
    try {
      logger.info(`get_job_analytics: period=${period}`);

      const jobs = await client.getJobsInfo(500, 0);
      const jobsList = jobs.jobsInfoDtos || [];

      // Calculate period start
      const now = new Date();
      const periodDays = { week: 7, month: 30, quarter: 90, year: 365 };
      const periodStart = new Date(now.getTime() - periodDays[period] * 24 * 60 * 60 * 1000);

      const periodJobs = jobsList.filter((j: any) => new Date(j.creationDate) >= periodStart);

      // Status distribution
      const statusCounts: Record<string, number> = {};
      periodJobs.forEach((j: any) => {
        statusCounts[j.transcriptStatus] = (statusCounts[j.transcriptStatus] || 0) + 1;
      });

      // Jobs per day
      const jobsPerDay: Record<string, number> = {};
      periodJobs.forEach((j: any) => {
        const day = j.creationDate.split('T')[0];
        jobsPerDay[day] = (jobsPerDay[day] || 0) + 1;
      });

      // Most active days
      const sortedDays = Object.entries(jobsPerDay).sort((a, b) => b[1] - a[1]);

      // File type analysis
      const fileTypes: Record<string, number> = {};
      periodJobs.forEach((j: any) => {
        const ext = (j.filename || '').split('.').pop()?.toLowerCase() || 'unknown';
        fileTypes[ext] = (fileTypes[ext] || 0) + 1;
      });

      // Success rate
      const completed = periodJobs.filter((j: any) =>
        j.transcriptStatus === "READY" || j.transcriptStatus === "READY_SUMMARY_READY"
      ).length;
      const failed = periodJobs.filter((j: any) => j.transcriptStatus === "ON_ERROR").length;
      const pending = periodJobs.filter((j: any) => j.transcriptStatus === "PENDING").length;

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            period,
            periodStart: periodStart.toISOString().split('T')[0],
            periodEnd: now.toISOString().split('T')[0],
            summary: {
              totalJobs: periodJobs.length,
              completed,
              failed,
              pending,
              successRate: `${Math.round((completed / periodJobs.length) * 100)}%`,
              avgJobsPerDay: Math.round(periodJobs.length / periodDays[period] * 10) / 10,
            },
            statusDistribution: statusCounts,
            fileTypes,
            mostActiveDays: sortedDays.slice(0, 5).map(([day, count]) => ({ day, count })),
            trends: {
              peakDay: sortedDays[0]?.[0] || 'N/A',
              peakCount: sortedDays[0]?.[1] || 0,
            }
          }, null, 2)
        }]
      };
    } catch (error: any) {
      const errorDetails = formatError(error);
      logError(errorDetails, "get_job_analytics");
      return { content: [{ type: "text" as const, text: `❌ ${errorDetails.message}` }], isError: true };
    }
  }
);

// ============ TIME-BASED QUERIES ============

server.tool(
  "query_by_time",
  "🕒 Natural language time queries: 'What was discussed last week?', 'Jobs from yesterday', etc.",
  {
    timeQuery: z.enum([
      "today", "yesterday", "this_week", "last_week",
      "this_month", "last_month", "last_7_days", "last_30_days"
    ]).describe("Time period to query"),
    includeContent: z.boolean().default(false).describe("Include transcript previews"),
  },
  async ({ timeQuery, includeContent }) => {
    try {
      const now = new Date();
      let startDate: Date;
      let endDate = now;

      switch (timeQuery) {
        case "today":
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case "yesterday":
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
          break;
        case "this_week":
          const dayOfWeek = now.getDay();
          startDate = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
          startDate.setHours(0, 0, 0, 0);
          break;
        case "last_week":
          const lastWeekEnd = new Date(now.getTime() - now.getDay() * 24 * 60 * 60 * 1000);
          startDate = new Date(lastWeekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
          endDate = lastWeekEnd;
          break;
        case "this_month":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case "last_month":
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case "last_7_days":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "last_30_days":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      const jobs = await client.getJobsInfo(100, 0);
      const filtered = (jobs.jobsInfoDtos || []).filter((j: any) => {
        const jobDate = new Date(j.creationDate);
        return jobDate >= startDate && jobDate <= endDate;
      });

      let results = filtered.map((j: any) => ({
        jobId: j.jobId,
        filename: j.filename,
        date: j.creationDate,
        status: j.transcriptStatus,
      }));

      // Optionally add content previews
      if (includeContent && results.length <= 5) {
        results = await Promise.all(results.map(async (job: any) => {
          try {
            if (job.status === "READY" || job.status === "READY_SUMMARY_READY") {
              const transcript = await client.receiveText(job.jobId, "txt");
              const content = transcript.content || transcript || "";
              return { ...job, preview: content.substring(0, 200) + "..." };
            }
          } catch { }
          return job;
        }));
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            timeQuery,
            period: {
              from: startDate.toISOString().split('T')[0],
              to: endDate.toISOString().split('T')[0],
            },
            totalJobs: results.length,
            jobs: results,
          }, null, 2)
        }]
      };
    } catch (error: any) {
      const errorDetails = formatError(error);
      logError(errorDetails, "query_by_time");
      return { content: [{ type: "text" as const, text: `❌ ${errorDetails.message}` }], isError: true };
    }
  }
);

// ============ SPEAKER ANALYSIS ============

server.tool(
  "analyze_speakers",
  "👥 Analyze speakers in a transcript: talk time, patterns, speaking order.",
  {
    jobId: z.string().describe("The job ID to analyze"),
  },
  async ({ jobId }) => {
    try {
      validateJobId(jobId);
      logger.info(`analyze_speakers: ${jobId}`);

      const transcript = await client.receiveText(jobId, "txt");
      const content = transcript.content || transcript || "";
      const lines = content.split('\n');

      const speakerStats: Record<string, { wordCount: number; lineCount: number; firstAppearance: number }> = {};

      lines.forEach((line: string, index: number) => {
        const speakerMatch = line.match(/^(Speaker \d+|Intervenant \d+|[A-Z][a-z]+ [A-Z][a-z]+):/);
        if (speakerMatch) {
          const speaker = speakerMatch[1];
          const text = line.replace(speakerMatch[0], '').trim();
          const wordCount = text.split(/\s+/).length;

          if (!speakerStats[speaker]) {
            speakerStats[speaker] = { wordCount: 0, lineCount: 0, firstAppearance: index };
          }
          speakerStats[speaker].wordCount += wordCount;
          speakerStats[speaker].lineCount += 1;
        }
      });

      const totalWords = Object.values(speakerStats).reduce((sum, s) => sum + s.wordCount, 0);

      const speakers = Object.entries(speakerStats)
        .map(([name, stats]) => ({
          name,
          wordCount: stats.wordCount,
          lineCount: stats.lineCount,
          talkTimePercent: `${Math.round((stats.wordCount / totalWords) * 100)}%`,
          avgWordsPerTurn: Math.round(stats.wordCount / stats.lineCount),
          firstAppearance: stats.firstAppearance,
        }))
        .sort((a, b) => b.wordCount - a.wordCount);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            jobId,
            totalSpeakers: speakers.length,
            totalWords,
            speakers,
            dominantSpeaker: speakers[0]?.name || 'N/A',
            balance: speakers.length > 1
              ? (speakers[0].wordCount / speakers[1].wordCount < 2 ? "Balanced" : "Unbalanced")
              : "Single speaker",
          }, null, 2)
        }]
      };
    } catch (error: any) {
      const errorDetails = formatError(error);
      logError(errorDetails, "analyze_speakers");
      return { content: [{ type: "text" as const, text: `❌ ${errorDetails.message}` }], isError: true };
    }
  }
);

// ============ COMPARE TRANSCRIPTS ============

server.tool(
  "compare_transcripts",
  "🔄 Compare two transcripts or two prompt outputs. Find differences and similarities.",
  {
    jobId1: z.string().describe("First job ID"),
    jobId2: z.string().describe("Second job ID"),
    compareType: z.enum(["transcript", "summary"]).default("summary"),
  },
  async ({ jobId1, jobId2, compareType }) => {
    try {
      validateJobId(jobId1);
      validateJobId(jobId2);
      logger.info(`compare_transcripts: ${jobId1} vs ${jobId2}`);

      let content1: string, content2: string;

      if (compareType === "summary") {
        const s1 = await client.receiveSummary(jobId1, "txt");
        const s2 = await client.receiveSummary(jobId2, "txt");
        content1 = s1.content || s1 || "";
        content2 = s2.content || s2 || "";
      } else {
        const t1 = await client.receiveText(jobId1, "txt");
        const t2 = await client.receiveText(jobId2, "txt");
        content1 = t1.content || t1 || "";
        content2 = t2.content || t2 || "";
      }

      // Basic comparison metrics
      const words1 = content1.split(/\s+/);
      const words2 = content2.split(/\s+/);
      const set1 = new Set(words1.map(w => w.toLowerCase()));
      const set2 = new Set(words2.map(w => w.toLowerCase()));

      const intersection = new Set([...set1].filter(x => set2.has(x)));
      const union = new Set([...set1, ...set2]);
      const similarity = Math.round((intersection.size / union.size) * 100);

      // Unique words in each
      const unique1 = [...set1].filter(x => !set2.has(x) && x.length > 4).slice(0, 20);
      const unique2 = [...set2].filter(x => !set1.has(x) && x.length > 4).slice(0, 20);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            comparison: {
              job1: jobId1,
              job2: jobId2,
              type: compareType,
            },
            metrics: {
              wordCount1: words1.length,
              wordCount2: words2.length,
              similarityPercent: `${similarity}%`,
              commonWords: intersection.size,
              uniqueVocabulary: union.size,
            },
            uniqueToJob1: unique1,
            uniqueToJob2: unique2,
            interpretation: similarity > 80
              ? "Very similar content"
              : similarity > 50
                ? "Moderately similar content"
                : "Significantly different content",
          }, null, 2)
        }]
      };
    } catch (error: any) {
      const errorDetails = formatError(error);
      logError(errorDetails, "compare_transcripts");
      return { content: [{ type: "text" as const, text: `❌ ${errorDetails.message}` }], isError: true };
    }
  }
);

// ============ SMART BULK OPERATIONS ============

server.tool(
  "bulk_reprompt",
  "⚡ Apply a prompt to multiple jobs at once. Great for reprocessing with a new/updated prompt.",
  {
    jobIds: z.array(z.string()).describe("Array of job IDs"),
    promptId: z.string().describe("Prompt ID to apply"),
    maxConcurrent: z.number().default(3).describe("Max parallel operations"),
  },
  async ({ jobIds, promptId, maxConcurrent }) => {
    try {
      logger.info(`bulk_reprompt: ${jobIds.length} jobs with prompt ${promptId}`);

      // Validate all jobIds first
      for (const jobId of jobIds) {
        try {
          validateJobId(jobId);
        } catch (error: any) {
          return {
            content: [{ type: "text" as const, text: `❌ Invalid jobId: ${jobId} - ${error.message}` }],
            isError: true,
          };
        }
      }

      // Limit maxConcurrent to reasonable value
      const actualMaxConcurrent = Math.min(maxConcurrent, 5);

      const results: Array<{ jobId: string; status: string; error?: string }> = [];

      // Process in batches to respect rate limits
      for (let i = 0; i < jobIds.length; i += actualMaxConcurrent) {
        const batch = jobIds.slice(i, i + actualMaxConcurrent);
        const batchResults = await Promise.allSettled(
          batch.map(async (jobId) => {
            await client.rePromptTranscript(jobId, promptId);
            return { jobId, status: "started" };
          })
        );

        batchResults.forEach((r, idx) => {
          if (r.status === 'fulfilled') {
            results.push(r.value);
          } else {
            results.push({ jobId: batch[idx], status: "failed", error: (r as PromiseRejectedResult).reason?.message });
          }
        });

        // Small delay between batches to avoid overwhelming API
        if (i + actualMaxConcurrent < jobIds.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const success = results.filter(r => r.status === "started").length;

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            promptId,
            totalJobs: jobIds.length,
            started: success,
            failed: jobIds.length - success,
            results,
            note: "Use get_reprompt_status to check progress",
          }, null, 2)
        }]
      };
    } catch (error: any) {
      const errorDetails = formatError(error);
      logError(errorDetails, "bulk_reprompt");
      return { content: [{ type: "text" as const, text: `❌ ${errorDetails.message}` }], isError: true };
    }
  }
);

// ============ EXPORT & INTEGRATION ============

server.tool(
  "export_to_json",
  "📦 Export multiple jobs to a structured JSON file with all metadata, transcripts, and summaries.",
  {
    jobIds: z.array(z.string()).describe("Array of job IDs to export"),
    includeTranscript: z.boolean().default(true),
    includeSummary: z.boolean().default(true),
  },
  async ({ jobIds, includeTranscript, includeSummary }) => {
    try {
      logger.info(`export_to_json: ${jobIds.length} jobs`);

      // Validate all jobIds first
      for (const jobId of jobIds) {
        validateJobId(jobId);
      }

      const exports = await Promise.allSettled(
        jobIds.map(async (jobId) => {
          const status = await client.getTranscriptStatus(jobId);
          const data: any = {
            jobId,
            status: status.transcriptStatus,
            filename: status.filename,
            createdAt: status.creationDate,
          };

          if (includeTranscript && (status.transcriptStatus === "READY" || status.transcriptStatus === "READY_SUMMARY_READY")) {
            const transcript = await client.receiveText(jobId, "txt");
            data.transcript = transcript.content || transcript;
          }

          if (includeSummary && status.transcriptStatus === "READY_SUMMARY_READY") {
            const summary = await client.receiveSummary(jobId, "txt");
            data.summary = summary.content || summary;
          }

          return data;
        })
      );

      const successful = exports
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<any>).value);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            exportDate: new Date().toISOString(),
            totalExported: successful.length,
            failed: jobIds.length - successful.length,
            data: successful,
          }, null, 2)
        }]
      };
    } catch (error: any) {
      const errorDetails = formatError(error);
      logError(errorDetails, "export_to_json");
      return { content: [{ type: "text" as const, text: `❌ ${errorDetails.message}` }], isError: true };
    }
  }
);

// ============ START SERVER ============

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("🚀 Agilotext MCP Server v2.0.0 running on stdio - 65 tools available (incl. AI-powered features)");
}

main().catch((error) => {
  logger.error("Server error:", error);
  process.exit(1);
});
