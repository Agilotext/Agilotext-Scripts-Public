import axios from "axios";
import FormData from "form-data";
import { config } from "./config.js";
import { shouldRetry, calculateRetryDelay, getRetryAfterDelay, } from "./resilience/retry-strategy.js";
import { logger } from "./logger.js";
import { validateJobsResponse, validateTranscriptStatus, validateSummaryResponse, validateTextResponse, } from "./utils/api-response-validators.js";
export class AgilotextClient {
    client;
    /** Jeton issu d’AGILOTEXT_TOKEN ou d’un appel /getAuthToken (username + password). */
    resolvedToken = null;
    /**
     * Après un `error_invalid_token`, on n’utilise plus le jeton figé du .env pour cette session :
     * prochaine auth = POST /getAuthToken avec le mot de passe (si présent).
     */
    envTokenDisabled = false;
    constructor() {
        this.client = axios.create({
            baseURL: config.AGILOTEXT_API_URL,
            timeout: 60000,
        });
    }
    /** Détecte les réponses API liées à un jeton expiré / invalide. */
    isInvalidTokenMessage(msg) {
        if (!msg)
            return false;
        const m = String(msg).toLowerCase();
        return (m.includes("invalid_token") ||
            m.includes("invalid token") ||
            m.includes("error_invalid_token") ||
            (m.includes("token") && m.includes("invalid")));
    }
    /**
     * POST /getAuthToken (urlencoded) — ne met **pas** à jour `resolvedToken` (réservé à l’appelant).
     */
    async fetchTokenWithPasswordFor(username, edition) {
        const pwd = config.accountPassword;
        if (!pwd) {
            return null;
        }
        const body = new URLSearchParams({
            username,
            password: pwd,
            edition,
        });
        const response = await this.client.post("/getAuthToken", body.toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        const data = response.data;
        if (!data || data.status !== "OK" || !data.token) {
            return null;
        }
        return String(data.token);
    }
    /**
     * Obtient un jeton via POST /getAuthToken (urlencoded) et alimente le cache de session.
     */
    async ensureTokenFromPassword() {
        const t = await this.fetchTokenWithPasswordFor(config.AGILOTEXT_USERNAME, config.AGILOTEXT_EDITION);
        if (!t) {
            throw new Error("AGILOTEXT_TOKEN expiré ou absent : renseigner l’un de AGILOTEXT_PASSWORD / AGILOTEXT_APP_PASSWORD / AGILOTEXT_ADMIN_PASSWORD (POST getAuthToken, urlencoded).");
        }
        this.resolvedToken = t;
        return this.resolvedToken;
    }
    async ensureToken() {
        if (this.resolvedToken) {
            return this.resolvedToken;
        }
        if (config.AGILOTEXT_TOKEN && config.AGILOTEXT_TOKEN.length > 0 && !this.envTokenDisabled) {
            this.resolvedToken = config.AGILOTEXT_TOKEN;
            return this.resolvedToken;
        }
        return this.ensureTokenFromPassword();
    }
    /**
     * Résout username / token / edition pour un appel, avec surcharges optionnelles.
     */
    async getAuthParams(override) {
        const username = (override?.username?.trim() || config.AGILOTEXT_USERNAME);
        const edition = (override?.edition ?? config.AGILOTEXT_EDITION);
        if (override?.token && String(override.token).length > 0) {
            return { username, token: String(override.token), edition };
        }
        if (username === config.AGILOTEXT_USERNAME && edition === config.AGILOTEXT_EDITION) {
            return {
                username,
                token: await this.ensureToken(),
                edition,
            };
        }
        const t = await this.fetchTokenWithPasswordFor(username, edition);
        if (!t) {
            throw new Error("Pour un autre compte (username/édition), fournir `token` dans l’appel d’outil, ou le mot de passe du compte dans l’`env` pour getAuthToken.");
        }
        return { username, token: t, edition };
    }
    /**
     * Après `error_invalid_token` : nouveau jeton via POST /getAuthToken pour le contexte effectif (override ou .env).
     */
    async refreshAfterInvalidToken(workingOverride) {
        this.resolvedToken = null;
        this.envTokenDisabled = true;
        const u = (workingOverride?.username?.trim() || config.AGILOTEXT_USERNAME);
        const e = (workingOverride?.edition ?? config.AGILOTEXT_EDITION);
        const t = await this.fetchTokenWithPasswordFor(u, e);
        if (!t) {
            logger.warn("Impossible de renouveler le jeton (getAuthToken) pour la requête en cours.");
            return null;
        }
        if (!workingOverride) {
            this.resolvedToken = t;
        }
        return { username: u, edition: e, token: t };
    }
    async post(endpoint, params = {}, files = {}, maxRetries = 3, authOverride) {
        return this.postWithRetry(endpoint, params, files, maxRetries, authOverride);
    }
    async postWithRetry(endpoint, params = {}, files = {}, maxRetries = 3, authOverride) {
        let lastError;
        let workingOverride = authOverride;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            let allowAuthRefresh = true;
            let postFormData = true;
            while (postFormData) {
                postFormData = false;
                const formData = new FormData();
                const auth = await this.getAuthParams(workingOverride);
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
                        const errMsg = data.errorMessage || "";
                        if (allowAuthRefresh && this.isInvalidTokenMessage(errMsg)) {
                            allowAuthRefresh = false;
                            const next = await this.refreshAfterInvalidToken(workingOverride);
                            if (next) {
                                workingOverride = next;
                                postFormData = true;
                                continue;
                            }
                        }
                        throw new Error(`Agilotext API Error: ${errMsg || "Unknown error"}`);
                    }
                    return data;
                }
                catch (error) {
                    lastError = error;
                    const bodyData = error.response?.data;
                    const bodyMsg = typeof bodyData === "object" && bodyData?.errorMessage
                        ? String(bodyData.errorMessage)
                        : String(error.message ?? "");
                    if (allowAuthRefresh &&
                        (this.isInvalidTokenMessage(bodyMsg) || this.isInvalidTokenMessage(String(bodyData)))) {
                        allowAuthRefresh = false;
                        const next = await this.refreshAfterInvalidToken(workingOverride);
                        if (next) {
                            workingOverride = next;
                            postFormData = true;
                            continue;
                        }
                    }
                    if (shouldRetry(error, attempt, maxRetries)) {
                        const retryAfter = getRetryAfterDelay(error);
                        const delay = retryAfter || calculateRetryDelay(attempt);
                        logger.warn(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${Math.ceil(delay)}ms...`, {
                            status: error.response?.status,
                            endpoint: endpoint,
                        });
                        await new Promise((resolve) => setTimeout(resolve, delay));
                        break;
                    }
                    if (error.response) {
                        throw new Error(`HTTP Error ${error.response.status}: ${JSON.stringify(error.response.data)}`);
                    }
                    throw error;
                }
            }
        }
        throw lastError;
    }
    /**
     * GET avec auth en query (même contrat que webapp / mobile) — certains endpoints
     * n’acceptent pas correctement le POST multipart (ex. getTranscriptStatus, redoSummary).
     */
    async get(endpoint, params = {}, maxRetries = 3, authOverride) {
        return this.getWithRetry(endpoint, params, maxRetries, authOverride);
    }
    async getWithRetry(endpoint, params = {}, maxRetries = 3, authOverride) {
        let lastError;
        let workingOverride = authOverride;
        const buildQuery = async () => {
            const auth = await this.getAuthParams(workingOverride);
            const q = {};
            for (const [key, value] of Object.entries({ ...auth, ...params })) {
                if (value !== undefined && value !== null) {
                    q[key] = String(value);
                }
            }
            return q;
        };
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            let allowAuthRefresh = true;
            let doRequest = true;
            let query = await buildQuery();
            while (doRequest) {
                doRequest = false;
                try {
                    const response = await this.client.get(endpoint, { params: query });
                    const data = response.data;
                    if (data && data.status === "KO") {
                        const errMsg = data.errorMessage || "";
                        if (allowAuthRefresh && this.isInvalidTokenMessage(errMsg)) {
                            allowAuthRefresh = false;
                            const next = await this.refreshAfterInvalidToken(workingOverride);
                            if (next) {
                                workingOverride = next;
                                query = await buildQuery();
                                doRequest = true;
                                continue;
                            }
                        }
                        throw new Error(`Agilotext API Error: ${errMsg || "Unknown error"}`);
                    }
                    return data;
                }
                catch (error) {
                    lastError = error;
                    const bodyData = error.response?.data;
                    const bodyMsg = typeof bodyData === "object" && bodyData?.errorMessage
                        ? String(bodyData.errorMessage)
                        : String(error.message ?? "");
                    if (allowAuthRefresh &&
                        (this.isInvalidTokenMessage(bodyMsg) || this.isInvalidTokenMessage(String(bodyData)))) {
                        allowAuthRefresh = false;
                        const next = await this.refreshAfterInvalidToken(workingOverride);
                        if (next) {
                            workingOverride = next;
                            query = await buildQuery();
                            doRequest = true;
                            continue;
                        }
                    }
                    if (shouldRetry(error, attempt, maxRetries)) {
                        const retryAfter = getRetryAfterDelay(error);
                        const delay = retryAfter || calculateRetryDelay(attempt);
                        logger.warn(`[Retry GET] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${Math.ceil(delay)}ms...`, { status: error.response?.status, endpoint });
                        await new Promise((resolve) => setTimeout(resolve, delay));
                        break;
                    }
                    if (error.response) {
                        throw new Error(`HTTP Error ${error.response.status}: ${JSON.stringify(error.response.data)}`);
                    }
                    throw error;
                }
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
    async getJobsInfo(limit = 20, offset = 0, auth) {
        const response = await this.post("/getJobsInfo", { limit, offset }, {}, 3, auth);
        return validateJobsResponse(response);
    }
    async getTranscriptStatus(jobId, auth) {
        const response = await this.get("/getTranscriptStatus", { jobId }, 3, auth);
        return validateTranscriptStatus(response);
    }
    // ============ SECTION 3: DOWNLOADS ============
    async receiveText(jobId, format = "txt", auth) {
        const response = await this.post("/receiveText", { jobId, format }, {}, 3, auth);
        return validateTextResponse(response);
    }
    async receiveSummary(jobId, format = "html", auth) {
        const response = await this.post("/receiveSummary", { jobId, format }, {}, 3, auth);
        return validateSummaryResponse(response);
    }
    async receiveAudio(jobId) {
        return this.post("/receiveAudio", { jobId });
    }
    // ============ SECTION 4: TRANSCRIPT MANAGEMENT ============
    async renameTranscriptFile(jobId, newName) {
        return this.post("/renameTranscriptFile", { jobId, newName });
    }
    async updateTranscriptFile(jobId, transcriptContent, auth) {
        const buffer = Buffer.from(transcriptContent, "utf-8");
        return this.post("/updateTranscriptFile", { jobId }, { fileUpload: buffer }, 3, auth);
    }
    async redoSummary(jobId, promptId, auth) {
        const params = { jobId };
        if (promptId !== undefined && promptId !== null && String(promptId).trim() !== "") {
            params.promptId = promptId;
        }
        return this.get("/redoSummary", params, 3, auth);
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
        return this.post("/renamePromptModel", { promptId, promptName: newName });
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
    async setWordBoost2(wordBoostName, words, boostId = "0") {
        const wordBoost = JSON.stringify({ wordBoost: words });
        return this.post("/setWordBoost2", { boostId, boostName: wordBoostName, wordBoost });
    }
    async getWordBoost2(wordBoostId) {
        return this.post("/getWordBoost2", { boostId: wordBoostId });
    }
    async getWordBoostInfo2() {
        return this.post("/getWordBoostInfo2");
    }
    async getStatusWordBoost2(wordBoostId) {
        return this.post("/getStatusWordBoost2", { boostId: wordBoostId });
    }
    async renameWordBoost2(wordBoostId, newName) {
        return this.post("/renameWordBoost2", { boostId: wordBoostId, boostName: newName });
    }
    async deleteWordBoost2(wordBoostId) {
        return this.post("/deleteWordBoost2", { boostId: wordBoostId });
    }
    async setWordBoostDefault2(wordBoostId) {
        return this.post("/setWordBoostDefault2", { boostId: wordBoostId });
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
        return this.post("/setUserSendDefaults", {
            userSendDefaultsJson: JSON.stringify(defaults),
        });
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
    /**
     * getVersion : GET sans auth ni paramètres (contrat API public — voir doc).
     * Ne pas utiliser post() + multipart : le serveur peut répondre "username token" manquants.
     */
    async getVersion() {
        const response = await this.client.get("/getVersion");
        const data = response.data;
        if (data && data.status === "KO") {
            throw new Error(`Agilotext API Error: ${data.errorMessage || "Unknown error"}`);
        }
        return data;
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
