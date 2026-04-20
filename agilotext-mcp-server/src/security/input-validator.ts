/**
 * Input validation utilities for security
 * Validates user inputs, prevents injection attacks, enforces length limits
 */

const MAX_EMAIL_THREAD_LENGTH = 500 * 1024; // 500KB
const MAX_TRANSCRIPT_TEXT_LENGTH = 10 * 1024 * 1024; // 10MB
const MAX_JOB_ID_LENGTH = 100;
const MAX_FILENAME_LENGTH = 255;
const MAX_URL_LENGTH = 2048;

// Job ID pattern: alphanumeric, hyphens, underscores, UUID format
const JOB_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// URL pattern for validation
const URL_PATTERN = /^https?:\/\/.+/i;

// Patterns that might indicate injection attempts
const INJECTION_PATTERNS = [
  /ignore\s+previous\s+instructions/i,
  /system\s*:\s*you\s+are/i,
  /<script/i,
  /javascript:/i,
  /on\w+\s*=/i, // Event handlers like onclick=
  /data:text\/html/i,
];

/**
 * Validates a job ID format
 */
export function validateJobId(jobId: string): void {
  if (!jobId || typeof jobId !== "string") {
    throw new Error("Invalid jobId: must be a non-empty string");
  }

  if (jobId.length > MAX_JOB_ID_LENGTH) {
    throw new Error(
      `Invalid jobId: length ${jobId.length} exceeds maximum of ${MAX_JOB_ID_LENGTH}`
    );
  }

  // Check if it's a UUID or alphanumeric ID
  const isUUID = UUID_PATTERN.test(jobId);
  const isAlphanumeric = JOB_ID_PATTERN.test(jobId);

  if (!isUUID && !isAlphanumeric) {
    throw new Error(
      "Invalid jobId format: must be alphanumeric, UUID, or contain only hyphens/underscores"
    );
  }
}

/**
 * Validates string length against maximum
 */
export function validateStringLength(
  value: string,
  maxLength: number,
  fieldName: string
): void {
  if (typeof value !== "string") {
    throw new Error(`Invalid ${fieldName}: must be a string`);
  }

  const byteLength = Buffer.byteLength(value, "utf8");
  if (byteLength > maxLength) {
    const maxLengthKB = (maxLength / 1024).toFixed(2);
    const actualLengthKB = (byteLength / 1024).toFixed(2);
    throw new Error(
      `Invalid ${fieldName}: size ${actualLengthKB}KB exceeds maximum of ${maxLengthKB}KB`
    );
  }
}

/**
 * Validates email thread content
 */
export function validateEmailThread(emailThread: string): void {
  if (!emailThread) {
    return; // Empty is allowed
  }

  validateStringLength(emailThread, MAX_EMAIL_THREAD_LENGTH, "emailThread");
  detectInjectionAttempts(emailThread, "emailThread");
}

/**
 * Validates transcript text content
 */
export function validateTranscriptText(transcriptText: string): void {
  if (!transcriptText) {
    return; // Empty is allowed
  }

  validateStringLength(
    transcriptText,
    MAX_TRANSCRIPT_TEXT_LENGTH,
    "transcriptText"
  );
  detectInjectionAttempts(transcriptText, "transcriptText");
}

/**
 * Validates a URL
 */
export function validateUrl(url: string, fieldName: string = "url"): void {
  if (!url || typeof url !== "string") {
    throw new Error(`Invalid ${fieldName}: must be a non-empty string`);
  }

  if (url.length > MAX_URL_LENGTH) {
    throw new Error(
      `Invalid ${fieldName}: length exceeds maximum of ${MAX_URL_LENGTH}`
    );
  }

  if (!URL_PATTERN.test(url)) {
    throw new Error(`Invalid ${fieldName}: must be a valid HTTP/HTTPS URL`);
  }

  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid ${fieldName}: malformed URL`);
  }
}

/**
 * Detects potential injection attempts in user input
 */
export function detectInjectionAttempts(
  input: string,
  fieldName: string
): void {
  if (!input || typeof input !== "string") {
    return;
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      // Log warning but don't block (might be false positive)
      // Note: Using console.warn here as logger might not be initialized yet
      // In production, consider using a proper logger
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          `Potential injection attempt detected in ${fieldName}: ${pattern.toString()}`
        );
      }
      // In production, you might want to sanitize or block
      // For now, we just warn
    }
  }
}

/**
 * Sanitizes user input by escaping special characters
 * Useful before sending to LLM or external APIs
 */
export function sanitizeForLlm(input: string): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  // Remove null bytes
  let sanitized = input.replace(/\0/g, "");

  // Escape control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, "");

  // Limit length to prevent DoS
  const maxLength = 10 * 1024 * 1024; // 10MB
  if (Buffer.byteLength(sanitized, "utf8") > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Validates filename
 */
export function validateFilename(filename: string): void {
  if (!filename || typeof filename !== "string") {
    throw new Error("Invalid filename: must be a non-empty string");
  }

  if (filename.length > MAX_FILENAME_LENGTH) {
    throw new Error(
      `Invalid filename: length exceeds maximum of ${MAX_FILENAME_LENGTH}`
    );
  }

  // Check for path traversal
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    throw new Error("Invalid filename: path components not allowed");
  }

  // Check for dangerous characters
  if (/[<>:"|?*\x00-\x1f]/.test(filename)) {
    throw new Error("Invalid filename: contains illegal characters");
  }
}

/**
 * Comprehensive input validation for email generation
 */
export function validateEmailGenerationInputs(inputs: {
  jobId?: string;
  emailThread?: string;
  transcriptText?: string;
  recipientEmail?: string;
  fileUrl?: string;
}): void {
  if (inputs.jobId) {
    validateJobId(inputs.jobId);
  }

  if (inputs.emailThread) {
    validateEmailThread(inputs.emailThread);
  }

  if (inputs.transcriptText) {
    validateTranscriptText(inputs.transcriptText);
  }

  if (inputs.recipientEmail) {
    validateEmailAddress(inputs.recipientEmail);
  }

  if (inputs.fileUrl) {
    validateUrl(inputs.fileUrl, "fileUrl");
  }
}

/**
 * Validates email address format
 */
export function validateEmailAddress(email: string): void {
  if (!email || typeof email !== "string") {
    throw new Error("Invalid email: must be a non-empty string");
  }

  // Basic email validation
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    throw new Error("Invalid email: malformed email address");
  }

  // Length check
  if (email.length > 254) {
    throw new Error("Invalid email: length exceeds maximum of 254 characters");
  }
}
