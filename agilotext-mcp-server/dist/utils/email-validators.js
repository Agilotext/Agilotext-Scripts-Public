/**
 * Email validation schemas and utilities for Gmail compliance
 */
import { z } from "zod";
/**
 * Schema for email draft response from webhook
 */
export const EmailDraftResponseSchema = z.object({
    subject: z.string().max(200).describe("Email subject line"),
    body: z.string().max(100000).describe("Plain text email body (max 100KB)"),
    html: z.string().max(100000).optional().describe("HTML email body (max 100KB)"),
    threadId: z.string().optional().describe("Gmail thread ID"),
    messageId: z.string().optional().describe("Gmail message ID"),
});
/**
 * Schema for email thread response from webhook
 */
export const EmailThreadResponseSchema = z.object({
    threadId: z.string().optional().describe("Gmail thread ID"),
    messages: z.array(z.object({
        from: z.string().email(),
        to: z.array(z.string().email()),
        date: z.string(),
        body: z.string(),
        messageId: z.string().optional(),
        subject: z.string().optional(),
    })),
});
/**
 * Validates email draft response from webhook
 */
export function validateEmailDraftResponse(data) {
    try {
        return EmailDraftResponseSchema.parse(data);
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            throw new Error(`Invalid email draft response: ${error.errors.map((e) => e.message).join(", ")}`);
        }
        throw error;
    }
}
/**
 * Validates email thread response from webhook
 */
export function validateEmailThreadResponse(data) {
    try {
        return EmailThreadResponseSchema.parse(data);
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            throw new Error(`Invalid email thread response: ${error.errors.map((e) => e.message).join(", ")}`);
        }
        throw error;
    }
}
/**
 * Validates email address format
 */
export function validateEmailAddress(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
}
/**
 * Validates that From email matches authenticated account
 */
export function validateSenderIdentity(fromEmail, authenticatedEmail) {
    if (!validateEmailAddress(fromEmail)) {
        throw new Error(`Invalid From email address: ${fromEmail}`);
    }
    if (fromEmail.toLowerCase() !== authenticatedEmail.toLowerCase()) {
        throw new Error(`From email ${fromEmail} does not match authenticated account ${authenticatedEmail}`);
    }
}
/**
 * Preserves subject line with "Re:" prefix for replies
 */
export function preserveReplySubject(originalSubject) {
    if (!originalSubject) {
        return "";
    }
    // Already has Re: prefix
    if (/^re:\s*/i.test(originalSubject)) {
        return originalSubject;
    }
    // Add Re: prefix
    return `Re: ${originalSubject}`;
}
