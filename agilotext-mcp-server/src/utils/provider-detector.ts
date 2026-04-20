/**
 * Provider detection utilities
 * Automatically detects email/calendar provider from configuration
 */

import { config } from "../config.js";

export type EmailProvider = 'gmail' | 'outlook' | 'imap' | 'other';
export type CalendarSource = 'google' | 'outlook' | 'ics' | 'other';

/**
 * Detects email provider automatically from configuration
 * Checks webhook URLs and environment variables to infer provider
 * 
 * @returns Detected provider or 'gmail' as default fallback
 */
export function detectEmailProvider(): EmailProvider {
  // Check if webhook URL contains provider hints
  const emailWebhook = config.MCP_EMAIL_THREAD_WEBHOOK;
  
  if (emailWebhook) {
    const webhookLower = emailWebhook.toLowerCase();
    
    // Check for Outlook/Microsoft indicators
    if (webhookLower.includes('outlook') || 
        webhookLower.includes('microsoft') || 
        webhookLower.includes('graph.microsoft.com')) {
      return 'outlook';
    }
    
    // Check for Gmail/Google indicators
    if (webhookLower.includes('gmail') || 
        webhookLower.includes('google') ||
        webhookLower.includes('gmail.com')) {
      return 'gmail';
    }
    
    // Check for IMAP indicators
    if (webhookLower.includes('imap') || 
        webhookLower.includes('exchange')) {
      return 'imap';
    }
  }
  
  // Check for Microsoft Graph credentials (if added in future)
  if (process.env.MICROSOFT_CLIENT_ID || process.env.MICROSOFT_TENANT_ID) {
    return 'outlook';
  }
  
  // Check for Google OAuth credentials (if added in future)
  if (process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_SECRET) {
    return 'gmail';
  }
  
  // Default fallback to Gmail (most common)
  return 'gmail';
}

/**
 * Detects calendar source automatically from configuration
 * Checks webhook URLs and environment variables to infer source
 * 
 * @returns Detected source or 'google' as default fallback
 */
export function detectCalendarSource(): CalendarSource {
  // Check if webhook URL contains source hints
  const calendarWebhook = config.MCP_CALENDAR_WEBHOOK;
  
  if (calendarWebhook) {
    const webhookLower = calendarWebhook.toLowerCase();
    
    // Check for Outlook/Microsoft indicators
    if (webhookLower.includes('outlook') || 
        webhookLower.includes('microsoft') || 
        webhookLower.includes('graph.microsoft.com')) {
      return 'outlook';
    }
    
    // Check for Google Calendar indicators
    if (webhookLower.includes('google') || 
        webhookLower.includes('calendar') ||
        webhookLower.includes('gmail.com')) {
      return 'google';
    }
    
    // Check for ICS/calendar file indicators
    if (webhookLower.includes('ics') || 
        webhookLower.includes('ical')) {
      return 'ics';
    }
  }
  
  // Check for Microsoft Graph credentials (if added in future)
  if (process.env.MICROSOFT_CLIENT_ID || process.env.MICROSOFT_TENANT_ID) {
    return 'outlook';
  }
  
  // Check for Google OAuth credentials (if added in future)
  if (process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_SECRET) {
    return 'google';
  }
  
  // Default fallback to Google Calendar (most common)
  return 'google';
}
