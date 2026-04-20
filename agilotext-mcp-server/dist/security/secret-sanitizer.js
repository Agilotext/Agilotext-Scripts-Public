/**
 * Secret sanitization utilities
 * Prevents accidental exposure of tokens, passwords, and credentials in logs
 */
const SECRET_PATTERNS = [
    /(?:^|\s)(token|password|secret|key|api[_-]?key|auth[_-]?token|bearer)\s*[:=]\s*([a-zA-Z0-9_\-]{20,})/gi,
    /(?:^|\s)(AGILOTEXT_TOKEN|MCP_WEBHOOK_TOKEN|API_KEY|SECRET_KEY)\s*[:=]\s*([^\s]+)/gi,
    /bearer\s+[a-zA-Z0-9_\-]{20,}/gi,
    /[a-zA-Z0-9_\-]{32,}/g, // Long alphanumeric strings (potential tokens)
];
const URL_CREDENTIAL_PATTERN = /(https?:\/\/)([^:]+):([^@]+)@/gi;
/**
 * Masks a secret value, showing only first and last few characters
 */
function maskSecret(secret, visibleChars = 4) {
    if (!secret || secret.length <= visibleChars * 2) {
        return "***";
    }
    return `${secret.substring(0, visibleChars)}...${secret.substring(secret.length - visibleChars)}`;
}
/**
 * Sanitizes a string by masking potential secrets
 */
export function sanitizeForLogging(input) {
    if (!input || typeof input !== "string") {
        return input;
    }
    let sanitized = input;
    // Mask URLs with credentials
    sanitized = sanitized.replace(URL_CREDENTIAL_PATTERN, (match, protocol, user, pass) => {
        return `${protocol}${maskSecret(user)}:${maskSecret(pass)}@`;
    });
    // Mask common secret patterns
    for (const pattern of SECRET_PATTERNS) {
        sanitized = sanitized.replace(pattern, (match, label, value) => {
            if (label && value) {
                return `${label}=${maskSecret(value)}`;
            }
            // For patterns without capture groups
            return maskSecret(match);
        });
    }
    // Mask environment variable values that might contain secrets
    const envVarPattern = /(AGILOTEXT_TOKEN|MCP_WEBHOOK_TOKEN|API_KEY|SECRET_KEY)\s*[:=]\s*([^\s,}]+)/gi;
    sanitized = sanitized.replace(envVarPattern, (match, varName, value) => {
        return `${varName}=${maskSecret(value)}`;
    });
    return sanitized;
}
/**
 * Sanitizes an object by recursively masking secrets in string values
 */
export function sanitizeObjectForLogging(obj, depth = 5) {
    if (depth <= 0) {
        return "[Max depth reached]";
    }
    if (obj === null || obj === undefined) {
        return obj;
    }
    if (typeof obj === "string") {
        return sanitizeForLogging(obj);
    }
    if (typeof obj !== "object") {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map((item) => sanitizeObjectForLogging(item, depth - 1));
    }
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        // Never log these keys
        if (key.toLowerCase().includes("token") ||
            key.toLowerCase().includes("password") ||
            key.toLowerCase().includes("secret") ||
            key.toLowerCase().includes("key") ||
            key === "AGILOTEXT_TOKEN" ||
            key === "MCP_WEBHOOK_TOKEN") {
            sanitized[key] = "[REDACTED]";
            continue;
        }
        if (typeof value === "string") {
            sanitized[key] = sanitizeForLogging(value);
        }
        else if (typeof value === "object") {
            sanitized[key] = sanitizeObjectForLogging(value, depth - 1);
        }
        else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}
/**
 * Checks if a string contains potential secrets
 */
export function containsSecrets(input) {
    if (!input || typeof input !== "string") {
        return false;
    }
    for (const pattern of SECRET_PATTERNS) {
        if (pattern.test(input)) {
            return true;
        }
    }
    if (URL_CREDENTIAL_PATTERN.test(input)) {
        return true;
    }
    return false;
}
/**
 * Removes secrets from error messages before logging
 */
export function sanitizeErrorForLogging(error) {
    if (!error) {
        return error;
    }
    if (typeof error === "string") {
        return sanitizeForLogging(error);
    }
    if (error instanceof Error) {
        const sanitized = new Error(sanitizeForLogging(error.message));
        sanitized.name = error.name;
        sanitized.stack = error.stack ? sanitizeForLogging(error.stack) : undefined;
        return sanitized;
    }
    if (typeof error === "object") {
        return sanitizeObjectForLogging(error);
    }
    return error;
}
