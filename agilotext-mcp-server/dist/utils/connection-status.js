/**
 * Connection status utilities
 * Checks which services are connected/configured
 */
import { config } from "../config.js";
/**
 * Checks which services are currently connected/configured
 *
 * @returns Object indicating which services are available
 */
export function checkConnectionStatus() {
    return {
        email: !!config.MCP_EMAIL_THREAD_WEBHOOK,
        calendar: !!config.MCP_CALENDAR_WEBHOOK,
        crm: !!config.MCP_CRM_WEBHOOK,
        emailDraft: !!config.MCP_EMAIL_DRAFT_WEBHOOK,
    };
}
/**
 * Gets a user-friendly message about connection status
 *
 * @param serviceName - Name of the service (e.g., "email", "calendar")
 * @param isConnected - Whether the service is connected
 * @returns User-friendly message
 */
export function getConnectionStatusMessage(serviceName, isConnected) {
    if (isConnected) {
        return `Your ${serviceName} is connected.`;
    }
    const serviceDisplayName = serviceName === 'email' ? 'email' :
        serviceName === 'calendar' ? 'calendar' :
            serviceName === 'crm' ? 'CRM' :
                serviceName === 'emailDraft' ? 'email' :
                    serviceName;
    return `Your ${serviceDisplayName} isn't connected yet. Please connect it to continue.`;
}
/**
 * Gets a list of missing connections for error messages
 *
 * @param status - Connection status object
 * @returns Array of service names that are not connected
 */
export function getMissingConnections(status) {
    const missing = [];
    if (!status.email)
        missing.push('email');
    if (!status.calendar)
        missing.push('calendar');
    if (!status.crm)
        missing.push('CRM');
    if (!status.emailDraft)
        missing.push('email draft');
    return missing;
}
/**
 * Formats a user-friendly error message with connection status context
 *
 * @param baseMessage - Base error message
 * @param toolName - Name of the tool that failed
 * @returns Enhanced error message with connection context
 */
export function enhanceErrorMessageWithStatus(baseMessage, toolName) {
    const status = checkConnectionStatus();
    // Determine which service this tool needs
    let requiredService = null;
    if (toolName?.includes('email') && toolName?.includes('thread')) {
        requiredService = 'email';
    }
    else if (toolName?.includes('calendar')) {
        requiredService = 'calendar';
    }
    else if (toolName?.includes('crm')) {
        requiredService = 'crm';
    }
    else if (toolName?.includes('draft') || toolName?.includes('followup')) {
        requiredService = 'emailDraft';
    }
    // If we know which service is needed and it's not connected, enhance the message
    if (requiredService && !status[requiredService]) {
        const serviceName = requiredService === 'emailDraft' ? 'email' : requiredService;
        return `${baseMessage} Your ${serviceName} connection is required for this action.`;
    }
    return baseMessage;
}
