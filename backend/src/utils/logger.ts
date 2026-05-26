/**
 * Structured logger utility.
 * 
 * Wraps console.* with structured JSON output in production
 * and human-readable output in development. This is a drop-in
 * replacement that can be swapped for pino when npm permissions allow.
 */

const isProduction = process.env.NODE_ENV === "production";

interface LogContext {
  [key: string]: unknown;
}

function formatMessage(
  level: string,
  message: string,
  context?: LogContext
): string {
  if (isProduction) {
    return JSON.stringify({
      level,
      msg: message,
      timestamp: new Date().toISOString(),
      ...context,
    });
  }
  // Development: human-readable with emoji prefixes
  const prefix =
    level === "info"
      ? "ℹ️ "
      : level === "warn"
        ? "⚠️ "
        : level === "error"
          ? "❌"
          : "🔍";
  const ctx = context ? ` ${JSON.stringify(context)}` : "";
  return `${prefix} ${message}${ctx}`;
}

export const logger = {
  info(message: string, context?: LogContext): void {
    console.log(formatMessage("info", message, context));
  },

  warn(message: string, context?: LogContext): void {
    console.warn(formatMessage("warn", message, context));
  },

  error(message: string, context?: LogContext): void {
    console.error(formatMessage("error", message, context));
  },

  debug(message: string, context?: LogContext): void {
    if (!isProduction) {
      console.debug(formatMessage("debug", message, context));
    }
  },

  /** Creates a child logger with preset context fields */
  child(baseContext: LogContext) {
    return {
      info: (msg: string, ctx?: LogContext) =>
        logger.info(msg, { ...baseContext, ...ctx }),
      warn: (msg: string, ctx?: LogContext) =>
        logger.warn(msg, { ...baseContext, ...ctx }),
      error: (msg: string, ctx?: LogContext) =>
        logger.error(msg, { ...baseContext, ...ctx }),
      debug: (msg: string, ctx?: LogContext) =>
        logger.debug(msg, { ...baseContext, ...ctx }),
    };
  },
};
