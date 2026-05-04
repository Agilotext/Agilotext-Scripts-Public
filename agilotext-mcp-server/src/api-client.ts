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

export class AgilotextClient {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: config.AGILOTEXT_API_URL,
            timeout: 60000,
        });
    }

    private getAuthParams() {
        return {
            username: config.AGILOTEXT_USERNAME,
            token: config.AGILOTEXT_TOKEN,
            edition: config.AGILOTEXT_EDITION,
        };
    }

    async post<T>(endpoint: string, params: Record<string, any> = {}, files: Record<string, any> = {}): Promise<T> {
        return this.postWithRetry<T>(endpoint, params, files, 3);
    }

    async postWithRetry<T>(
        endpoint: string,
        params: Record<string, any> = {},
        files: Record<string, any> = {},
        maxRetries: number = 3
    ): Promise<T> {
        let lastError: any;

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
                if (value) formData.append(key, value);
            });

            try {
                const response = await this.client.post(endpoint, formData, {
                    headers: { ...formData.getHeaders() },
                });
                const data = response.data as any;
                if (data && data.status === "KO") {
                    throw new Error(`Agilotext API Error: ${data.errorMessage || "Unknown error"}`);
                }
                return data;
            } catch (error: any) {
                lastError = error;

                // Check if we should retry (handles 429 and 5xx)
                if (shouldRetry(error, attempt, maxRetries)) {
                    // Check for Retry-After header (for 429)
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
                    continue;
                }

                // Don't retry - throw error
                if (error.response) {
                    throw new Error(
                        `HTTP Error ${error.response.status}: ${JSON.stringify(error.response.data)}`
                    );
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
    async get<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
        return this.getWithRetry<T>(endpoint, params, 3);
    }

    async getWithRetry<T>(
        endpoint: string,
        params: Record<string, any> = {},
        maxRetries: number = 3
    ): Promise<T> {
        let lastError: any;
        const auth = this.getAuthParams();
        const query: Record<string, string> = {};
        for (const [key, value] of Object.entries({ ...auth, ...params })) {
            if (value !== undefined && value !== null) {
                query[key] = String(value);
            }
        }

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await this.client.get<T>(endpoint, { params: query });
                const data = response.data as any;
                if (data && data.status === "KO") {
                    throw new Error(`Agilotext API Error: ${data.errorMessage || "Unknown error"}`);
                }
                return data as T;
            } catch (error: any) {
                lastError = error;
                if (shouldRetry(error, attempt, maxRetries)) {
                    const retryAfter = getRetryAfterDelay(error);
                    const delay = retryAfter || calculateRetryDelay(attempt);
                    logger.warn(
                        `[Retry GET] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${Math.ceil(delay)}ms...`,
                        { status: error.response?.status, endpoint }
                    );
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    continue;
                }
                if (error.response) {
                    throw new Error(
                        `HTTP Error ${error.response.status}: ${JSON.stringify(error.response.data)}`
                    );
                }
                throw error;
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

    async getJobsInfo(limit: number = 20, offset: number = 0): Promise<JobsResponse> {
        const response = await this.post<any>("/getJobsInfo", { limit, offset });
        return validateJobsResponse(response);
    }

    async getTranscriptStatus(jobId: string): Promise<any> {
        const response = await this.get<any>("/getTranscriptStatus", { jobId });
        return validateTranscriptStatus(response);
    }

    // ============ SECTION 3: DOWNLOADS ============

    async receiveText(jobId: string, format: "txt" | "rtf" | "docx" | "pdf" = "txt"): Promise<any> {
        const response = await this.post<any>("/receiveText", { jobId, format });
        return validateTextResponse(response);
    }

    async receiveSummary(jobId: string, format: "txt" | "html" | "rtf" | "docx" | "pdf" = "html"): Promise<any> {
        const response = await this.post<any>("/receiveSummary", { jobId, format });
        return validateSummaryResponse(response);
    }

    async receiveAudio(jobId: string): Promise<any> {
        return this.post("/receiveAudio", { jobId });
    }

    // ============ SECTION 4: TRANSCRIPT MANAGEMENT ============

    async renameTranscriptFile(jobId: string, newName: string): Promise<any> {
        return this.post("/renameTranscriptFile", { jobId, newName });
    }

    async updateTranscriptFile(jobId: string, transcriptContent: string): Promise<any> {
        const buffer = Buffer.from(transcriptContent, 'utf-8');
        return this.post("/updateTranscriptFile", { jobId }, { fileUpload: buffer });
    }

    async redoSummary(jobId: string, promptId?: string): Promise<any> {
        const params: Record<string, any> = { jobId };
        if (promptId !== undefined && promptId !== null && String(promptId).trim() !== "") {
            params.promptId = promptId;
        }
        return this.get("/redoSummary", params);
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
        return this.post("/renamePromptModel", { promptId, newName });
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

    async setWordBoost2(wordBoostName: string, words: string[]): Promise<any> {
        const wordsJson = JSON.stringify(words);
        return this.post("/setWordBoost2", { wordBoostName, words: wordsJson });
    }

    async getWordBoost2(wordBoostId: string): Promise<any> {
        return this.post("/getWordBoost2", { wordBoostId });
    }

    async getWordBoostInfo2(): Promise<any> {
        return this.post("/getWordBoostInfo2");
    }

    async getStatusWordBoost2(wordBoostId: string): Promise<any> {
        return this.post("/getStatusWordBoost2", { wordBoostId });
    }

    async renameWordBoost2(wordBoostId: string, newName: string): Promise<any> {
        return this.post("/renameWordBoost2", { wordBoostId, newName });
    }

    async deleteWordBoost2(wordBoostId: string): Promise<any> {
        return this.post("/deleteWordBoost2", { wordBoostId });
    }

    async setWordBoostDefault2(wordBoostId: string): Promise<any> {
        return this.post("/setWordBoostDefault2", { wordBoostId });
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

    async getVersion(): Promise<any> {
        return this.post("/getVersion");
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
