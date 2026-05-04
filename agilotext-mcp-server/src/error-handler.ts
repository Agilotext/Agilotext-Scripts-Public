/**
 * Gestionnaire d'erreurs amélioré pour le serveur MCP Agilotext
 */

import { translateWebhookError, isWebhookConfigError } from "./utils/user-friendly-errors.js";

export interface ErrorDetails {
  message: string;
  status?: number;
  statusText?: string;
  data?: any;
  endpoint?: string;
  timestamp: string;
  stack?: string;
}

export class AgilotextError extends Error {
  public readonly status?: number;
  public readonly statusText?: string;
  public readonly data?: any;
  public readonly endpoint?: string;

  constructor(
    message: string,
    status?: number,
    statusText?: string,
    data?: any,
    endpoint?: string
  ) {
    super(message);
    this.name = 'AgilotextError';
    this.status = status;
    this.statusText = statusText;
    this.data = data;
    this.endpoint = endpoint;
  }
}

export function formatError(error: any, endpoint?: string, toolName?: string): ErrorDetails {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const errorDetails: ErrorDetails = {
    message: error.message || 'Unknown error',
    timestamp: new Date().toISOString(),
  };

  // Check if this is a webhook error (user-friendly translation)
  const errorMessage = error.message || '';
  if (isWebhookConfigError(error) || 
      errorMessage.includes('Webhook') || 
      errorMessage.includes('webhook') ||
      (toolName && (toolName.includes('email') || toolName.includes('calendar') || toolName.includes('crm')))) {
    const friendlyMessage = translateWebhookError(error, {
      toolName,
      isWebhook: true,
      statusCode: error.response?.status || error.status
    });
    errorDetails.message = friendlyMessage;
    
    // In development, keep technical details in stack/data
    if (isDevelopment) {
      errorDetails.data = error;
    }
    
    return errorDetails;
  }

  // Erreur HTTP (axios)
  if (error.response) {
    errorDetails.status = error.response.status;
    errorDetails.statusText = error.response.statusText;
    errorDetails.data = error.response.data;
    errorDetails.endpoint = endpoint || error.config?.url;
    
    // Message spécifique selon le code HTTP
    switch (error.response.status) {
      case 400:
        errorDetails.message = `Bad Request: ${error.response.data?.errorMessage || error.message}`;
        break;
      case 401:
        errorDetails.message =
            "Unauthorized: AGILOTEXT_USERNAME + AGILOTEXT_TOKEN, ou un mot de passe (AGILOTEXT_PASSWORD / AGILOTEXT_APP_PASSWORD / AGILOTEXT_ADMIN_PASSWORD + POST getAuthToken urlencoded).";
        break;
      case 403:
        errorDetails.message = 'Forbidden: You don\'t have permission to access this resource';
        break;
      case 404:
        errorDetails.message = `Not Found: ${endpoint || 'Resource'} does not exist`;
        break;
      case 429:
        errorDetails.message = 'Rate Limited: Too many requests, please wait before retrying';
        break;
      case 500:
        errorDetails.message = 'Server Error: Agilotext API is experiencing issues';
        break;
      case 503:
        errorDetails.message = 'Service Unavailable: Agilotext API is temporarily unavailable';
        break;
      default:
        errorDetails.message = `HTTP ${error.response.status}: ${error.response.data?.errorMessage || error.message}`;
    }
  }
  // Erreur réseau (pas de réponse)
  else if (error.request) {
    errorDetails.message = 'Network Error: Unable to reach Agilotext API. Check your internet connection.';
    errorDetails.endpoint = endpoint;
  }
  // Erreur Agilotext API (status KO)
  else if (error.status === 'KO') {
    errorDetails.message = `Agilotext API Error: ${error.errorMessage || error.message}`;
    errorDetails.data = error;
  }
  // Autre erreur
  else {
    errorDetails.message = error.message || 'Unknown error occurred';
  }

  // Stack trace en développement seulement
  if (isDevelopment && error.stack) {
    errorDetails.stack = error.stack;
  }

  return errorDetails;
}

import { sanitizeObjectForLogging, sanitizeErrorForLogging } from "./security/secret-sanitizer.js";
import { logger } from "./logger.js";

export function logError(error: ErrorDetails, toolName?: string) {
  const prefix = toolName ? `[${toolName}]` : '[MCP]';
  
  // Sanitize error data to prevent secret exposure
  const sanitizedError = sanitizeObjectForLogging({
    message: error.message,
    status: error.status,
    endpoint: error.endpoint,
    timestamp: error.timestamp,
  });
  
  logger.error(`${prefix} Error:`, sanitizedError);
  
  // Log complet en développement (sanitized)
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Full error:', sanitizeObjectForLogging(error));
  }
}
