import axios from "axios";
import FormData from "form-data";
import { config } from "./config.js";
import { shouldRetry, calculateRetryDelay, getRetryAfterDelay, } from "./resilience/retry-strategy.js";
import { logger } from "./logger.js";
import { validateJobsResponse, validateTranscriptStatus, validateSummaryResponse, validateTextResponse, } from "./utils/api-response-validators.js";
export class AgilotextClient {
    client;
    constructor() {
        this.client = axios.create({
            baseURL: config.AGILOTEXT_API_URL,
            timeout: 60000,
        });
    }
    getAuthParams() {
        return {
            username: config.AGILOTEXT_USERNAME,
            token: config.AGILOTEXT_TOKEN,
            edition: config.AGILOTEXT_EDITION,
        };
    }
    async post(endpoint, params = {}, files = {}) {
        return this.postWithRetry(endpoint, params, files, 3);
    }
    async postWithRetry(endpoint, params = {}, files = {}, maxRetries = 3) {
        let lastError;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const formData = new FormData();
            const auth = this.getAuthParams();
            Object.entries(auth).forEach(([key, value]) => formData.append(key, value));
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    formData.append(key, String(value));
                }
            });
            Object.entries(files).forEach(([key, value]) => {
                if (value)
                    formData.append(key, value);
            });
            try {
                const response = await this.client.post(endpoint, formData, {
                    headers: { ...formData.getHeaders() },
                });
                const data = response.data;
                if (data && data.status === "KO") {
                    throw new Error(`Agilotext API Error: ${data.errorMessage || "Unknown error"}`);
                }
                return data;
            }
            catch (error) {
                lastError = error;
                // Check if we should retry (handles 429 and 5xx)
                if (shouldRetry(error, attempt, maxRetries)) {
                    // Check for Retry-After header (for 429)
                    const retryAfter = getRetryAfterDelay(error);
                    const delay = retryAfter || calculateRetryDelay(attempt);
                    logger.warn(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${Math.ceil(delay)}ms...`, {
                        status: error.response?.status,
                        endpoint: endpoint,
                    });
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    continue;
                }
                // Don't retry - throw error
                if (error.response) {
                    throw new Error(`HTTP Error ${error.response.status}: ${JSON.stringify(error.response.data)}`);
                }
                throw error;
            }
        }
        throw lastError;
    }
    /**
     * GET avec auth en query (même contrat que webapp / mobile) — certains endpoints
     * n’acceptent pas correctement le POST multipart (ex. getTranscriptStatus, redoSummary).
     */
    async get(endpoint, params = {}) {
        return this.getWithRetry(endpoint, params, 3);
    }
    async getWithRetry(endpoint, params = {}, maxRetries = 3) {
        let lastError;
        const auth = this.getAuthParams();
        const query = {};
        for (const [key, value] of Object.entries({ ...auth, ...params })) {
            if (value !== undefined && value !== null) {
                query[key] = String(value);
            }
        }
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await this.client.get(endpoint, { params: query });
                const data = response.data;
                if (data && data.status === "KO") {
                    throw new Error(`Agilotext API Error: ${data.errorMessage || "Unknown error"}`);
                }
                return data;
            }
            catch (error) {
                lastError = error;
                if (shouldRetry(error, attempt, maxRetries)) {
                    const retryAfter = getRetryAfterDelay(error);
                    const delay = retryAfter || calculateRetryDelay(attempt);
                    logger.warn(`[Retry GET] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${Math.ceil(delay)}ms...`, { status: error.response?.status, endpoint });
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    continue;
                }
                if (error.response) {
                    throw new Error(`HTTP Error ${error.response.status}: ${JSON.stringify(error.response.data)}`);
                }
                throw error;
            }
        }
        throw lastError;
    }
    // ============ SECTION 1: UPLOAD & TRANSCRIPTION ============
    async sendMultipleAudio(fileBuffer, filename, options = {}) {
        return this.post("/sendMultipleAudio", {
            timestampTranscript: options.timestampTranscript ?? true,
            doSummary: options.doSummary ?? true,
            formatTranscript: options.formatTranscript ?? false,
            speakersExpected: options.speakersExpected ?? 0,
            personsCited: options.personsCited ?? false,
            promptId: options.promptId,
        }, { fileUpload1: { value: fileBuffer, options: { filename } } });
    }
    async sendYoutubeUrl(url, options = {}) {
        return this.post("/sendYoutubeUrl", {
            url,
            timestampTranscript: options.timestampTranscript ?? true,
            doSummary: options.doSummary ?? true,
            speakersExpected: options.speakersExpected ?? 0,
        });
    }
    // ============ SECTION 2: JOB TRACKING ============
    async getJobsInfo(limit = 20, offset = 0) {
        const response = await this.post("/getJobsInfo", { limit, offset });
        return validateJobsResponse(response);
    }
    async getTranscriptStatus(jobId) {
        const response = await this.get("/getTranscriptStatus", { jobId });
        return validateTranscriptStatus(response);
    }
    // ============ SECTION 3: DOWNLOADS ============
    async receiveText(jobId, format = "txt") {
        const response = await this.post("/receiveText", { jobId, format });
        return validateTextResponse(response);
    }
    async receiveSummary(jobId, format = "html") {
        const response = await this.post("/receiveSummary", { jobId, format });
        return validateSummaryResponse(response);
    }
    async receiveAudio(jobId) {
        return this.post("/receiveAudio", { jobId });
    }
    // ============ SECTION 4: TRANSCRIPT MANAGEMENT ============
    async renameTranscriptFile(jobId, newName) {
        return this.post("/renameTranscriptFile", { jobId, newName });
    }
    async updateTranscriptFile(jobId, transcriptContent) {
        const buffer = Buffer.from(transcriptContent, 'utf-8');
        return this.post("/updateTranscriptFile", { jobId }, { fileUpload: buffer });
    }
    async redoSummary(jobId, promptId) {
        const params = { jobId };
        if (promptId !== undefined && promptId !== null && String(promptId).trim() !== "") {
            params.promptId = promptId;
        }
        return this.get("/redoSummary", params);
    }
    async deleteJob(jobId) {
        return this.post("/deleteJob", { jobId });
    }
    // ============ SECTION 5: PROMPTS ============
    async getPromptModelsStandardInfo() {
        return this.post("/getPromptModelsStandardInfo");
    }
    async getPromptModelsUserInfo() {
        return this.post("/getPromptModelsUserInfo");
    }
    async getPromptModelContent(promptId) {
        return this.post("/getPromptModelContent", { promptId });
    }
    async getPromptModelUserStatus(promptId) {
        return this.post("/getPromptModelUserStatus", { promptId });
    }
    async createPromptModelUser(promptName, promptContent) {
        const buffer = Buffer.from(promptContent, 'utf-8');
        return this.post("/createPromptModelUser", { promptName }, { fileUpload: buffer });
    }
    async updatePromptModelUser(promptId, promptContent) {
        const buffer = Buffer.from(promptContent, 'utf-8');
        return this.post("/updatePromptModelUser", { promptId }, { fileUpload: buffer });
    }
    async renamePromptModel(promptId, newName) {
        return this.post("/renamePromptModel", { promptId, newName });
    }
    async setPromptModelUserDefault(promptId) {
        return this.post("/setPromptModelUserDefault", { promptId });
    }
    async deletePromptModel(promptId) {
        return this.post("/deletePromptModel", { promptId });
    }
    async receivePromptModelTemplate(promptId) {
        return this.post("/receivePromptModelTemplate", { promptId });
    }
    // ============ SECTION 6: REPROMPT ============
    async rePromptTranscript(jobId, promptId) {
        return this.post("/rePromptTranscript", { jobId, promptId });
    }
    async getRePromptStatus(jobId, promptId) {
        return this.post("/getRePromptStatus", { jobId, promptId });
    }
    async receiveRepromptText(jobId, promptId, format = "html") {
        return this.post("/receiveRepromptText", { jobId, promptId, format });
    }
    // ============ SECTION 7: WORD BOOST ============
    async setWordBoost2(wordBoostName, words) {
        const wordsJson = JSON.stringify(words);
        return this.post("/setWordBoost2", { wordBoostName, words: wordsJson });
    }
    async getWordBoost2(wordBoostId) {
        return this.post("/getWordBoost2", { wordBoostId });
    }
    async getWordBoostInfo2() {
        return this.post("/getWordBoostInfo2");
    }
    async getStatusWordBoost2(wordBoostId) {
        return this.post("/getStatusWordBoost2", { wordBoostId });
    }
    async renameWordBoost2(wordBoostId, newName) {
        return this.post("/renameWordBoost2", { wordBoostId, newName });
    }
    async deleteWordBoost2(wordBoostId) {
        return this.post("/deleteWordBoost2", { wordBoostId });
    }
    async setWordBoostDefault2(wordBoostId) {
        return this.post("/setWordBoostDefault2", { wordBoostId });
    }
    // ============ SECTION 8: USER PREFERENCES ============
    async getUserModelPreference() {
        return this.post("/getUserModelPreference");
    }
    async setUserModelPreference(modelPreference) {
        return this.post("/setUserModelPreference", { modelPreference });
    }
    async getUserSendDefaults() {
        return this.post("/getUserSendDefaults");
    }
    async setUserSendDefaults(defaults) {
        return this.post("/setUserSendDefaults", defaults);
    }
    async getMailNotifyType() {
        return this.post("/getMailNotifyType");
    }
    async setMailNotifyType(notifyType) {
        return this.post("/setMailNotifyType", { notifyType });
    }
    // ============ SECTION 9: WEBHOOKS ============
    async webhookCreate(webhookUrl, eventType) {
        return this.post("/webhookCreate", { webhookUrl, eventType });
    }
    async webhookGetStatus() {
        return this.post("/webhookGetStatus");
    }
    async webhookResend(jobId) {
        return this.post("/webhookResend", { jobId });
    }
    // ============ SECTION 10: CONCATENATION ============
    async sendForConcatenation(jobIds, newName) {
        return this.post("/sendForConcatenation", { jobIds: JSON.stringify(jobIds), newName });
    }
    async getConcatStatus(concatJobId) {
        return this.post("/getConcatStatus", { concatJobId });
    }
    async getConcatJobsInfo(limit = 20, offset = 0) {
        return this.post("/getConcatJobsInfo", { limit, offset });
    }
    // ============ SECTION 11: UTILITIES ============
    async getSharedUrl(jobId) {
        return this.post("/getSharedUrl", { jobId });
    }
    async anonText(text) {
        return this.post("/anonText", { text });
    }
    async getNumberOfUploadsForPeriod(period = "month") {
        return this.post("/getNumberOfUploadsForPeriod", { period });
    }
    async getVersion() {
        return this.post("/getVersion");
    }
    async cleanupOldJobs(daysOld = 30) {
        return this.post("/cleanupOldJobs", { daysOld });
    }
    // ============ SECTION 12: AUTOMATION ============
    async getNewAutomationToken() {
        return this.post("/getNewAutomationToken");
    }
    // ============ SECTION 13: CONNECTORS ============
    async setGoogleDriveUrl(googleDriveUrl) {
        return this.post("/setGoogleDriveUrl", { googleDriveUrl });
    }
}
