import axios, { AxiosInstance } from "axios";
import FormData from "form-data";
import { config } from "./config.js";
import {
  shouldRetry,
  calculateRetryDelay,
  getRetryAfterDelay,
} from "./resilience/retry-strategy.js";
import { logger } from "./logger.js";
import {
  validateJobsResponse,
  validateTranscriptStatus,
  validateSummaryResponse,
  validateTextResponse,
} from "./utils/api-response-validators.js";

// Common response types
export interface AgilotextResponse {
    status: "OK" | "KO";
    errorMessage?: string;
    exceptionStackTrace?: string;
}

export interface JobInfo {
    jobId: string;
    filename: string;
    creationDate: string;
    transcriptStatus: string;
    summaryStatus?: string;
    promptId?: number;
}

export interface JobsResponse extends AgilotextResponse {
    jobsInfoDtos?: JobInfo[];
}

/**
 * Surcharge d’authentification par appel d’outil (MCP) : n’alimente pas d’e-mail/édition « figés » dans le binaire.
 * Si `token` est fourni, il est utilisé tel quel. Sinon, pour un autre compte / édition que le .env, il faut le mot de passe en `env` (getAuthToken) ou un `token` explicite.
 */
export type AuthOverride = {
    username?: string;
    edition?: "free" | "pro" | "ent";
    /** Jeton explicite ; court-circuite getAuthToken / le cache de session. */
    token?: string;
};

export class AgilotextClient {
    private client: AxiosInstance;
    /** Jeton issu d’AGILOTEXT_TOKEN ou d’un appel /getAuthToken (username + password). */
    private resolvedToken: string | null = null;
    /**
     * Après un `error_invalid_token`, on n’utilise plus le jeton figé du .env pour cette session :
     * prochaine auth = POST /getAuthToken avec le mot de passe (si présent).
     */
    private envTokenDisabled = false;

    constructor() {
        this.client = axios.create({
            baseURL: config.AGILOTEXT_API_URL,
            timeout: 60000,
        });
    }

    /** Détecte les réponses API liées à un jeton expiré / invalide. */
    private isInvalidTokenMessage(msg: string | undefined): boolean {
        if (!msg) return false;
        const m = String(msg).toLowerCase();
        return (
            m.includes("invalid_token") ||
            m.includes("invalid token") ||
            m.includes("error_invalid_token") ||
            (m.includes("token") && m.includes("invalid"))
        );
    }

    /**
     * POST /getAuthToken (urlencoded) — ne met **pas** à jour `resolvedToken` (réservé à l’appelant).
     */
    private async fetchTokenWithPasswordFor(username: string, edition: string): Promise<string | null> {
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
        const data = response.data as any;
        if (!data || data.status !== "OK" || !data.token) {
            return null;
        }
        return String(data.token);
    }

    /**
     * Obtient un jeton via POST /getAuthToken (urlencoded) et alimente le cache de session.
     */
    private async ensureTokenFromPassword(): Promise<string> {
        const t = await this.fetchTokenWithPasswordFor(
            config.AGILOTEXT_USERNAME,
            config.AGILOTEXT_EDITION
        );
        if (!t) {
            throw new Error(
                "AGILOTEXT_TOKEN expiré ou absent : renseigner l’un de AGILOTEXT_PASSWORD / AGILOTEXT_APP_PASSWORD / AGILOTEXT_ADMIN_PASSWORD (POST getAuthToken, urlencoded)."
            );
        }
        this.resolvedToken = t;
        return this.resolvedToken;
    }

    private async ensureToken(): Promise<string> {
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
    private async getAuthParams(override?: AuthOverride) {
        const username = (override?.username?.trim() || config.AGILOTEXT_USERNAME) as string;
        const edition = (override?.edition ?? config.AGILOTEXT_EDITION) as string;
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
            throw new Error(
                "Pour un autre compte (username/édition), fournir `token` dans l’appel d’outil, ou le mot de passe du compte dans l’`env` pour getAuthToken."
            );
        }
        return { username, token: t, edition };
    }

    /**
     * Après `error_invalid_token` : nouveau jeton via POST /getAuthToken pour le contexte effectif (override ou .env).
     */
    private async refreshAfterInvalidToken(workingOverride?: AuthOverride): Promise<AuthOverride | null> {
        this.resolvedToken = null;
        this.envTokenDisabled = true;
        const u = (workingOverride?.username?.trim() || config.AGILOTEXT_USERNAME) as string;
        const e = (workingOverride?.edition ?? config.AGILOTEXT_EDITION) as string;
        const t = await this.fetchTokenWithPasswordFor(u, e);
        if (!t) {
            logger.warn("Impossible de renouveler le jeton (getAuthToken) pour la requête en cours.");
            return null;
        }
        if (!workingOverride) {
            this.resolvedToken = t;
        }
        return { username: u, edition: e as "free" | "pro" | "ent", token: t };
    }

    async post<T>(
        endpoint: string,
        params: Record<string, any> = {},
        files: Record<string, any> = {},
        maxRetries: number = 3,
        authOverride?: AuthOverride
    ): Promise<T> {
        return this.postWithRetry<T>(endpoint, params, files, maxRetries, authOverride);
    }

    async postWithRetry<T>(
        endpoint: string,
        params: Record<string, any> = {},
        files: Record<string, any> = {},
        maxRetries: number = 3,
        authOverride?: AuthOverride
    ): Promise<T> {
        let lastError: any;
        let workingOverride: AuthOverride | undefined = authOverride;

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
                    if (value) formData.append(key, value);
                });

                try {
                    const response = await this.client.post(endpoint, formData, {
                        headers: { ...formData.getHeaders() },
                    });
                    const data = response.data as any;
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
                } catch (error: any) {
                    lastError = error;
                    const bodyData = error.response?.data;
                    const bodyMsg =
                        typeof bodyData === "object" && bodyData?.errorMessage
                            ? String(bodyData.errorMessage)
                            : String(error.message ?? "");
                    if (
                        allowAuthRefresh &&
                        (this.isInvalidTokenMessage(bodyMsg) || this.isInvalidTokenMessage(String(bodyData)))
                    ) {
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

                        logger.warn(
                            `[Retry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${Math.ceil(delay)}ms...`,
                            {
                                status: error.response?.status,
                                endpoint: endpoint,
                            }
                        );

                        await new Promise((resolve) => setTimeout(resolve, delay));
                        break;
                    }

                    if (error.response) {
                        throw new Error(
                            `HTTP Error ${error.response.status}: ${JSON.stringify(error.response.data)}`
                        );
                    }
                    throw error;
                }
            }
        }

        throw lastError;
    }

    /**
     * POST `application/x-www-form-urlencoded` avec auth.
     * Plusieurs routes Agilotext attendent des paramètres classiques (`req.getParameter`) —
     * en pratique, le multipart du `post()` ne remplit pas toujours les mêmes paramètres selon le déploiement.
     */
    async postUrlEncoded<T>(
        endpoint: string,
        params: Record<string, any> = {},
        maxRetries: number = 3,
        authOverride?: AuthOverride
    ): Promise<T> {
        let lastError: any;
        let workingOverride: AuthOverride | undefined = authOverride;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            let allowAuthRefresh = true;
            let doRequest = true;

            while (doRequest) {
                doRequest = false;
                try {
                    const auth = await this.getAuthParams(workingOverride);
                    const body = new URLSearchParams();
                    Object.entries(auth).forEach(([key, value]) => {
                        body.append(key, String(value));
                    });
                    Object.entries(params).forEach(([key, value]) => {
                        if (value !== undefined && value !== null) {
                            body.append(key, String(value));
                        }
                    });

                    const response = await this.client.post(endpoint, body.toString(), {
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    });
                    const data = response.data as any;
                    if (data && data.status === "KO") {
                        const errMsg = data.errorMessage || "";
                        if (allowAuthRefresh && this.isInvalidTokenMessage(errMsg)) {
                            allowAuthRefresh = false;
                            const next = await this.refreshAfterInvalidToken(workingOverride);
                            if (next) {
                                workingOverride = next;
                                doRequest = true;
                                continue;
                            }
                        }
                        throw new Error(`Agilotext API Error: ${errMsg || "Unknown error"}`);
                    }
                    return data as T;
                } catch (error: any) {
                    lastError = error;
                    const bodyData = error.response?.data;
                    const bodyMsg =
                        typeof bodyData === "object" && bodyData?.errorMessage
                            ? String(bodyData.errorMessage)
                            : String(error.message ?? "");
                    if (
                        allowAuthRefresh &&
                        (this.isInvalidTokenMessage(bodyMsg) || this.isInvalidTokenMessage(String(bodyData)))
                    ) {
                        allowAuthRefresh = false;
                        const next = await this.refreshAfterInvalidToken(workingOverride);
                        if (next) {
                            workingOverride = next;
                            doRequest = true;
                            continue;
                        }
                    }

                    if (shouldRetry(error, attempt, maxRetries)) {
                        const retryAfter = getRetryAfterDelay(error);
                        const delay = retryAfter || calculateRetryDelay(attempt);
                        logger.warn(
                            `[Retry urlencoded] Attempt ${attempt + 1}/${maxRetries} failed in ${Math.ceil(delay)}ms`,
                            { endpoint }
                        );
                        await new Promise((resolve) => setTimeout(resolve, delay));
                        break;
                    }

                    if (error.response) {
                        throw new Error(
                            `HTTP Error ${error.response.status}: ${JSON.stringify(error.response.data)}`
                        );
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
    async get<T>(
        endpoint: string,
        params: Record<string, any> = {},
        maxRetries: number = 3,
        authOverride?: AuthOverride
    ): Promise<T> {
        return this.getWithRetry<T>(endpoint, params, maxRetries, authOverride);
    }

    async getWithRetry<T>(
        endpoint: string,
        params: Record<string, any> = {},
        maxRetries: number = 3,
        authOverride?: AuthOverride
    ): Promise<T> {
        let lastError: any;
        let workingOverride: AuthOverride | undefined = authOverride;

        const buildQuery = async () => {
            const auth = await this.getAuthParams(workingOverride);
            const q: Record<string, string> = {};
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
                    const response = await this.client.get<T>(endpoint, { params: query });
                    const data = response.data as any;
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
                    return data as T;
                } catch (error: any) {
                    lastError = error;
                    const bodyData = error.response?.data;
                    const bodyMsg =
                        typeof bodyData === "object" && bodyData?.errorMessage
                            ? String(bodyData.errorMessage)
                            : String(error.message ?? "");
                    if (
                        allowAuthRefresh &&
                        (this.isInvalidTokenMessage(bodyMsg) || this.isInvalidTokenMessage(String(bodyData)))
                    ) {
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
                        logger.warn(
                            `[Retry GET] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${Math.ceil(delay)}ms...`,
                            { status: error.response?.status, endpoint }
                        );
                        await new Promise((resolve) => setTimeout(resolve, delay));
                        break;
                    }
                    if (error.response) {
                        throw new Error(
                            `HTTP Error ${error.response.status}: ${JSON.stringify(error.response.data)}`
                        );
                    }
                    throw error;
                }
            }
        }

        throw lastError;
    }

    // ============ SECTION 1: UPLOAD & TRANSCRIPTION ============

    async sendMultipleAudio(
        fileBuffer: Buffer,
        filename: string,
        options: {
            timestampTranscript?: boolean;
            doSummary?: boolean;
            formatTranscript?: boolean;
            speakersExpected?: number;
            personsCited?: boolean;
            promptId?: string;
        } = {}
    ): Promise<any> {
        return this.post("/sendMultipleAudio", {
            timestampTranscript: options.timestampTranscript ?? true,
            doSummary: options.doSummary ?? true,
            formatTranscript: options.formatTranscript ?? false,
            speakersExpected: options.speakersExpected ?? 0,
            personsCited: options.personsCited ?? false,
            promptId: options.promptId,
        }, { fileUpload1: { value: fileBuffer, options: { filename } } });
    }

    async sendYoutubeUrl(
        url: string,
        options: {
            timestampTranscript?: boolean;
            doSummary?: boolean;
            speakersExpected?: number;
        } = {}
    ): Promise<any> {
        return this.post("/sendYoutubeUrl", {
            url,
            timestampTranscript: options.timestampTranscript ?? true,
            doSummary: options.doSummary ?? true,
            speakersExpected: options.speakersExpected ?? 0,
        });
    }

    // ============ SECTION 2: JOB TRACKING ============

    async getJobsInfo(limit: number = 20, offset: number = 0, auth?: AuthOverride): Promise<JobsResponse> {
        const response = await this.post<any>("/getJobsInfo", { limit, offset }, {}, 3, auth);
        return validateJobsResponse(response);
    }

    async getTranscriptStatus(jobId: string, auth?: AuthOverride): Promise<any> {
        const response = await this.get<any>("/getTranscriptStatus", { jobId }, 3, auth);
        return validateTranscriptStatus(response);
    }

    // ============ SECTION 3: DOWNLOADS ============

    async receiveText(
        jobId: string,
        format: "txt" | "rtf" | "docx" | "pdf" = "txt",
        auth?: AuthOverride
    ): Promise<any> {
        const response = await this.post<any>("/receiveText", { jobId, format }, {}, 3, auth);
        return validateTextResponse(response);
    }

    async receiveSummary(
        jobId: string,
        format: "txt" | "html" | "rtf" | "docx" | "pdf" = "html",
        auth?: AuthOverride
    ): Promise<any> {
        const response = await this.post<any>("/receiveSummary", { jobId, format }, {}, 3, auth);
        return validateSummaryResponse(response);
    }

    async receiveAudio(jobId: string): Promise<any> {
        return this.post("/receiveAudio", { jobId });
    }

    // ============ SECTION 4: TRANSCRIPT MANAGEMENT ============

    async renameTranscriptFile(jobId: string, newName: string): Promise<any> {
        return this.post("/renameTranscriptFile", { jobId, newName });
    }

    async updateTranscriptFile(jobId: string, transcriptContent: string, auth?: AuthOverride): Promise<any> {
        const buffer = Buffer.from(transcriptContent, "utf-8");
        return this.post("/updateTranscriptFile", { jobId }, { fileUpload: buffer }, 3, auth);
    }

    async redoSummary(jobId: string, promptId?: string, auth?: AuthOverride): Promise<any> {
        const params: Record<string, any> = { jobId };
        if (promptId !== undefined && promptId !== null && String(promptId).trim() !== "") {
            params.promptId = promptId;
        }
        return this.get("/redoSummary", params, 3, auth);
    }

    async deleteJob(jobId: string): Promise<any> {
        return this.post("/deleteJob", { jobId });
    }

    // ============ SECTION 5: PROMPTS ============

    async getPromptModelsStandardInfo(): Promise<any> {
        return this.post("/getPromptModelsStandardInfo");
    }

    async getPromptModelsUserInfo(): Promise<any> {
        return this.post("/getPromptModelsUserInfo");
    }

    async getPromptModelContent(promptId: string): Promise<any> {
        return this.post("/getPromptModelContent", { promptId });
    }

    async getPromptModelUserStatus(promptId: string): Promise<any> {
        return this.post("/getPromptModelUserStatus", { promptId });
    }

    async createPromptModelUser(promptName: string, promptContent: string): Promise<any> {
        const buffer = Buffer.from(promptContent, 'utf-8');
        return this.post("/createPromptModelUser", { promptName }, { fileUpload: buffer });
    }

    async updatePromptModelUser(promptId: string, promptContent: string): Promise<any> {
        const buffer = Buffer.from(promptContent, 'utf-8');
        return this.post("/updatePromptModelUser", { promptId }, { fileUpload: buffer });
    }

    async renamePromptModel(promptId: string, newName: string): Promise<any> {
        /** Backend Java attend `promptName`, pas `newName` (ApiRenamePromptModel). */
        return this.post("/renamePromptModel", { promptId, promptName: newName });
    }

    async setPromptModelUserDefault(promptId: string): Promise<any> {
        return this.post("/setPromptModelUserDefault", { promptId });
    }

    async deletePromptModel(promptId: string): Promise<any> {
        return this.post("/deletePromptModel", { promptId });
    }

    async receivePromptModelTemplate(promptId: string): Promise<any> {
        return this.post("/receivePromptModelTemplate", { promptId });
    }

    /**
     * Crée un **prompt catalogue / standard** (`standard_prompt_model`).
     * ⚠️ Restreint côté serveur au **compte système** (`ParmsAgilotUtil.isSystemUsername`) — sinon erreur type
     * « Only System user cannot set prompt model ».
     * Réponse typique : `{ promptModelId }` (JSON sans enveloppe `status` pour la création réussie dans certaines versions).
     */
    async createPromptModelStandard(
        promptName: string,
        promptContent: string,
        auth?: AuthOverride
    ): Promise<any> {
        return this.postUrlEncoded(
            "/createPromptModelStandard",
            { promptName, promptContent },
            3,
            auth
        );
    }

    /**
     * Met à jour un prompt **standard** existant (id catalogue valide).
     * ⚠️ Même restriction **compte système** que `createPromptModelStandard`.
     */
    async updatePromptModelStandard(
        promptId: string,
        promptName: string,
        promptContent: string,
        auth?: AuthOverride
    ): Promise<any> {
        return this.postUrlEncoded(
            "/updatePromptModelStandard",
            { promptId, promptName, promptContent },
            3,
            auth
        );
    }

    // ============ SECTION 6: REPROMPT ============

    async rePromptTranscript(jobId: string, promptId: string): Promise<any> {
        return this.post("/rePromptTranscript", { jobId, promptId });
    }

    async getRePromptStatus(jobId: string, promptId: string): Promise<any> {
        return this.post("/getRePromptStatus", { jobId, promptId });
    }

    async receiveRepromptText(jobId: string, promptId: string, format: "txt" | "html" = "html"): Promise<any> {
        return this.post("/receiveRepromptText", { jobId, promptId, format });
    }

    // ============ SECTION 7: WORD BOOST ============

    /**
     * Corps attendu par l’API Java : `boostName`, `wordBoost` = JSON `{"wordBoost":[...]}` (voir WordBoostDTO2).
     * `boostId` : `"0"` pour création ; sinon id existant pour mise à jour.
     */
    async setWordBoost2(wordBoostName: string, words: string[], boostId: string = "0"): Promise<any> {
        const wordBoost = JSON.stringify({ wordBoost: words });
        return this.post("/setWordBoost2", { boostId, boostName: wordBoostName, wordBoost });
    }

    async getWordBoost2(wordBoostId: string): Promise<any> {
        return this.post("/getWordBoost2", { boostId: wordBoostId });
    }

    async getWordBoostInfo2(): Promise<any> {
        return this.post("/getWordBoostInfo2");
    }

    async getStatusWordBoost2(wordBoostId: string): Promise<any> {
        return this.post("/getStatusWordBoost2", { wordBoostId });
    }

    async renameWordBoost2(wordBoostId: string, newName: string): Promise<any> {
        /** ApiRenameWordBoost2 attend `boostName`, pas `newName`. */
        return this.post("/renameWordBoost2", { boostId: wordBoostId, boostName: newName });
    }

    async deleteWordBoost2(wordBoostId: string): Promise<any> {
        return this.post("/deleteWordBoost2", { boostId: wordBoostId });
    }

    async setWordBoostDefault2(wordBoostId: string): Promise<any> {
        return this.post("/setWordBoostDefault2", { boostId: wordBoostId });
    }

    // ============ SECTION 8: USER PREFERENCES ============

    async getUserModelPreference(): Promise<any> {
        return this.post("/getUserModelPreference");
    }

    async setUserModelPreference(modelPreference: string): Promise<any> {
        return this.post("/setUserModelPreference", { modelPreference });
    }

    async getUserSendDefaults(): Promise<any> {
        return this.post("/getUserSendDefaults");
    }

    async setUserSendDefaults(defaults: Record<string, any>): Promise<any> {
        /** Servlet : paramètre unique `userSendDefaultsJson` (chaîne JSON), pas champs aplatis. */
        return this.post("/setUserSendDefaults", {
            userSendDefaultsJson: JSON.stringify(defaults),
        });
    }

    async getMailNotifyType(): Promise<any> {
        return this.post("/getMailNotifyType");
    }

    async setMailNotifyType(notifyType: string): Promise<any> {
        return this.post("/setMailNotifyType", { notifyType });
    }

    // ============ SECTION 9: WEBHOOKS ============

    async webhookCreate(webhookUrl: string, eventType: string): Promise<any> {
        return this.post("/webhookCreate", { webhookUrl, eventType });
    }

    async webhookGetStatus(): Promise<any> {
        return this.post("/webhookGetStatus");
    }

    async webhookResend(jobId: string): Promise<any> {
        return this.post("/webhookResend", { jobId });
    }

    // ============ SECTION 10: CONCATENATION ============

    async sendForConcatenation(jobIds: string[], newName: string): Promise<any> {
        return this.post("/sendForConcatenation", { jobIds: JSON.stringify(jobIds), newName });
    }

    async getConcatStatus(concatJobId: string): Promise<any> {
        return this.post("/getConcatStatus", { concatJobId });
    }

    async getConcatJobsInfo(limit: number = 20, offset: number = 0): Promise<any> {
        return this.post("/getConcatJobsInfo", { limit, offset });
    }

    // ============ SECTION 11: UTILITIES ============

    async getSharedUrl(jobId: string): Promise<any> {
        return this.post("/getSharedUrl", { jobId });
    }

    async anonText(text: string): Promise<any> {
        return this.post("/anonText", { text });
    }

    async getNumberOfUploadsForPeriod(period: "day" | "week" | "month" = "month"): Promise<any> {
        return this.post("/getNumberOfUploadsForPeriod", { period });
    }

    /**
     * getVersion : GET sans auth ni paramètres (contrat API public — voir doc).
     * Ne pas utiliser post() + multipart : le serveur peut répondre "username token" manquants.
     */
    async getVersion(): Promise<any> {
        const response = await this.client.get<any>("/getVersion");
        const data = response.data as any;
        if (data && data.status === "KO") {
            throw new Error(`Agilotext API Error: ${data.errorMessage || "Unknown error"}`);
        }
        return data;
    }

    async cleanupOldJobs(daysOld: number = 30): Promise<any> {
        return this.post("/cleanupOldJobs", { daysOld });
    }

    // ============ SECTION 12: AUTOMATION ============

    async getNewAutomationToken(): Promise<any> {
        return this.post("/getNewAutomationToken");
    }

    // ============ SECTION 13: CONNECTORS ============

    async setGoogleDriveUrl(googleDriveUrl: string): Promise<any> {
        return this.post("/setGoogleDriveUrl", { googleDriveUrl });
    }
}
