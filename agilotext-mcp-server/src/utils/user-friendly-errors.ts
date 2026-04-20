/**
 * User-friendly error translation
 * Converts technical error messages into plain language for non-technical users
 */

export type ErrorContext = {
  toolName?: string;
  envName?: string;
  isWebhook?: boolean;
  statusCode?: number;
};

/**
 * Translates technical webhook errors into user-friendly messages
 * 
 * @param error - The error object or message
 * @param context - Context about the error (tool name, env name, etc.)
 * @returns User-friendly error message
 */
export function translateWebhookError(error: any, context: ErrorContext = {}): string {
  const errorMessage = typeof error === 'string' ? error : error?.message || 'Unknown error';
  const { toolName, envName, isWebhook = true, statusCode } = context;
  
  // Check if this is a webhook configuration error
  if (errorMessage.includes('Webhook non configuré') || 
      errorMessage.includes('non configuré pour') ||
      errorMessage.includes(envName || 'WEBHOOK')) {
    
    // Determine which service based on tool name
    let serviceName = 'this service';
    if (toolName?.includes('email') || toolName?.includes('thread')) {
      serviceName = 'your email';
    } else if (toolName?.includes('calendar')) {
      serviceName = 'your calendar';
    } else if (toolName?.includes('crm')) {
      serviceName = 'your CRM';
    }
    
    return `Your ${serviceName} isn't connected yet. Please connect it to continue.`;
  }
  
  // HTTP status code errors
  if (statusCode) {
    switch (statusCode) {
      case 401:
        return 'Authentication failed. Please check your connection settings.';
      case 403:
        return 'Access denied. Your IT team may need to approve this connection.';
      case 404:
        if (toolName?.includes('email') || toolName?.includes('thread')) {
          return "Couldn't find the email you're looking for. Try a different search.";
        } else if (toolName?.includes('calendar')) {
          return "Couldn't find the meeting you're looking for. Try a different date or search.";
        }
        return "Couldn't find what you're looking for. Try a different search.";
      case 408:
      case 504:
        return 'The request took too long. Please try again.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
      case 502:
      case 503:
        return 'The service is temporarily unavailable. Please try again in a few moments.';
      default:
        if (statusCode >= 400 && statusCode < 500) {
          return 'There was a problem with your request. Please check your input and try again.';
        } else if (statusCode >= 500) {
          return 'The service is experiencing issues. Please try again later.';
        }
    }
  }
  
  // Network/timeout errors
  if (errorMessage.includes('timeout') || 
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('network') ||
      errorMessage.includes('ECONNREFUSED')) {
    return 'Connection timeout. Please check your internet connection and try again.';
  }
  
  // Webhook-specific errors
  if (isWebhook && errorMessage.includes('HTTP')) {
    // Extract status code from message if present
    const httpMatch = errorMessage.match(/HTTP (\d+)/);
    if (httpMatch) {
      const code = parseInt(httpMatch[1]);
      return translateWebhookError(error, { ...context, statusCode: code });
    }
    
    return 'There was a problem connecting to your service. Please try again.';
  }
  
  // Generic webhook errors
  if (isWebhook && (
      errorMessage.includes('webhook') ||
      errorMessage.includes('Webhook'))) {
    return 'There was a problem connecting to your service. Please check your connection settings.';
  }
  
  // Fallback: return original message but sanitized
  // Remove technical details
  let sanitized = errorMessage
    .replace(/MCP_\w+_WEBHOOK/g, 'connection')
    .replace(/Définissez \w+ dans \.env/g, 'configure your connection')
    .replace(/\.env/g, 'settings')
    .replace(/webhook/gi, 'connection')
    .replace(/HTTP \d+/g, 'error')
    .replace(/status code \d+/gi, 'error');
  
  // If message is still too technical, provide generic message
  if (sanitized.includes('config') && sanitized.includes('env')) {
    return 'Please configure your connection settings to continue.';
  }
  
  return sanitized || 'An error occurred. Please try again.';
}

/**
 * Determines if an error is a webhook configuration error
 */
export function isWebhookConfigError(error: any): boolean {
  const errorMessage = typeof error === 'string' ? error : error?.message || '';
  return errorMessage.includes('Webhook non configuré') || 
         errorMessage.includes('non configuré pour') ||
         errorMessage.includes('MCP_') && errorMessage.includes('WEBHOOK');
}

/**
 * Gets a user-friendly service name from tool name
 */
export function getServiceNameFromTool(toolName?: string): string {
  if (!toolName) return 'service';
  
  if (toolName.includes('email') || toolName.includes('thread')) {
    return 'email';
  } else if (toolName.includes('calendar')) {
    return 'calendar';
  } else if (toolName.includes('crm')) {
    return 'CRM';
  } else if (toolName.includes('draft') || toolName.includes('followup')) {
    return 'email';
  }
  
  return 'service';
}
