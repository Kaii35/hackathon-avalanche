import pino from 'pino';

export const logger = pino({
  name: 'indexer',
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: ['email', '*.email', 'rfc', '*.rfc', 'curp', '*.curp', 'fullName', '*.fullName'],
    censor: '[REDACTED]',
  },
});

export type Logger = typeof logger;
