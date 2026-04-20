/**
 * Logger for Agilotext MCP Server
 * Structured logging with levels and secret sanitization
 */
import { sanitizeObjectForLogging, sanitizeForLogging } from "./security/secret-sanitizer.js";
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (LogLevel = {}));
const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
class Logger {
    level;
    constructor(level = LogLevel.INFO) {
        this.level = level;
    }
    log(level, message, data) {
        if (level >= this.level) {
            const timestamp = new Date().toISOString();
            const prefix = `[${timestamp}] [${levelNames[level]}]`;
            // Sanitize message and data to prevent secret exposure
            const sanitizedMessage = sanitizeForLogging(message);
            const sanitizedData = data ? sanitizeObjectForLogging(data) : undefined;
            if (sanitizedData) {
                console.error(`${prefix} ${sanitizedMessage}`, JSON.stringify(sanitizedData));
            }
            else {
                console.error(`${prefix} ${sanitizedMessage}`);
            }
        }
    }
    debug(message, data) { this.log(LogLevel.DEBUG, message, data); }
    info(message, data) { this.log(LogLevel.INFO, message, data); }
    warn(message, data) { this.log(LogLevel.WARN, message, data); }
    error(message, data) { this.log(LogLevel.ERROR, message, data); }
    setLevel(level) { this.level = level; }
}
export const logger = new Logger(process.env.LOG_LEVEL === 'debug' ? LogLevel.DEBUG : LogLevel.INFO);
