/**
 * Logger for Agilotext MCP Server
 * Structured logging with levels and secret sanitization
 */

import { sanitizeObjectForLogging, sanitizeForLogging } from "./security/secret-sanitizer.js";

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
}

const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

class Logger {
    private level: LogLevel;

    constructor(level: LogLevel = LogLevel.INFO) {
        this.level = level;
    }

    private log(level: LogLevel, message: string, data?: any) {
        if (level >= this.level) {
            const timestamp = new Date().toISOString();
            const prefix = `[${timestamp}] [${levelNames[level]}]`;
            
            // Sanitize message and data to prevent secret exposure
            const sanitizedMessage = sanitizeForLogging(message);
            const sanitizedData = data ? sanitizeObjectForLogging(data) : undefined;
            
            if (sanitizedData) {
                console.error(`${prefix} ${sanitizedMessage}`, JSON.stringify(sanitizedData));
            } else {
                console.error(`${prefix} ${sanitizedMessage}`);
            }
        }
    }

    debug(message: string, data?: any) { this.log(LogLevel.DEBUG, message, data); }
    info(message: string, data?: any) { this.log(LogLevel.INFO, message, data); }
    warn(message: string, data?: any) { this.log(LogLevel.WARN, message, data); }
    error(message: string, data?: any) { this.log(LogLevel.ERROR, message, data); }

    setLevel(level: LogLevel) { this.level = level; }
}

export const logger = new Logger(
    process.env.LOG_LEVEL === 'debug' ? LogLevel.DEBUG : LogLevel.INFO
);
