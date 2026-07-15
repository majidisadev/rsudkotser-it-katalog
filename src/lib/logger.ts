import pino from "pino";

/**
 * Logger terstruktur JSON (SDD *Error Handling and Logging*).
 * Di Vercel → ditangkap log platform; self-host → stdout (ditangkap Docker).
 * `pino-pretty` hanya di development untuk keterbacaan.
 */
const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" },
        },
      }
    : {}),
});

export type Logger = typeof logger;
