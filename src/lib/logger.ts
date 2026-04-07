type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
}

const formatEntry = (level: LogLevel, context: string, message: string, meta?: Record<string, unknown>) => {
  const timestamp = new Date().toISOString();
  const payload = meta ? ` ${JSON.stringify(meta)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message}${payload}`;
};

export function createLogger(context: string): Logger {
  return {
    debug: (message, meta) => console.debug(formatEntry("debug", context, message, meta)),
    info: (message, meta) => console.info(formatEntry("info", context, message, meta)),
    warn: (message, meta) => console.warn(formatEntry("warn", context, message, meta)),
    error: (message, meta) => console.error(formatEntry("error", context, message, meta)),
  };
}
