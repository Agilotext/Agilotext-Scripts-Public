/**
 * API response validation schemas
 * Ensures type safety and catches API structure changes
 */

import { z } from "zod";

/**
 * Job Info schema
 */
export const JobInfoSchema = z.object({
  jobId: z.string(),
  filename: z.string(),
  creationDate: z.string(),
  transcriptStatus: z.enum(["PENDING", "READY", "READY_SUMMARY_READY", "ON_ERROR"]),
  summaryStatus: z.string().optional(),
  promptId: z.number().optional(),
});

export type JobInfo = z.infer<typeof JobInfoSchema>;

/**
 * Jobs Response schema
 */
export const JobsResponseSchema = z.object({
  status: z.enum(["OK", "KO"]),
  errorMessage: z.string().optional(),
  exceptionStackTrace: z.string().optional(),
  jobsInfoDtos: z.array(JobInfoSchema).optional(),
});

export type JobsResponse = z.infer<typeof JobsResponseSchema>;

/**
 * Transcript Status schema
 */
export const TranscriptStatusSchema = z.object({
  jobId: z.string(),
  filename: z.string().optional(),
  creationDate: z.string().optional(),
  transcriptStatus: z.enum(["PENDING", "READY", "READY_SUMMARY_READY", "ON_ERROR"]),
  summaryStatus: z.string().optional(),
  errorMessage: z.string().optional(),
});

export type TranscriptStatus = z.infer<typeof TranscriptStatusSchema>;

/**
 * Summary Response schema
 */
export const SummaryResponseSchema = z.object({
  content: z.string().optional(),
  summary: z.string().optional(),
  status: z.string().optional(),
}).passthrough(); // Allow additional fields

export type SummaryResponse = z.infer<typeof SummaryResponseSchema>;

/**
 * Text Response schema
 */
export const TextResponseSchema = z.object({
  content: z.string().optional(),
  status: z.string().optional(),
}).passthrough(); // Allow additional fields

export type TextResponse = z.infer<typeof TextResponseSchema>;

/**
 * Validates a jobs response
 */
export function validateJobsResponse(data: any): JobsResponse {
  try {
    return JobsResponseSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Invalid jobs response structure", { errors: error.errors });
      // Return partial data if validation fails (graceful degradation)
      return data as JobsResponse;
    }
    throw error;
  }
}

/**
 * Validates a transcript status response
 */
export function validateTranscriptStatus(data: any): TranscriptStatus {
  try {
    return TranscriptStatusSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Invalid transcript status structure", { errors: error.errors });
      return data as TranscriptStatus;
    }
    throw error;
  }
}

/**
 * Validates a summary response
 */
export function validateSummaryResponse(data: any): SummaryResponse {
  try {
    return SummaryResponseSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Invalid summary response structure", { errors: error.errors });
      return data as SummaryResponse;
    }
    throw error;
  }
}

/**
 * Validates a text response
 */
export function validateTextResponse(data: any): TextResponse {
  try {
    return TextResponseSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Invalid text response structure", { errors: error.errors });
      return data as TextResponse;
    }
    throw error;
  }
}

// Import logger for warnings
import { logger } from "../logger.js";
