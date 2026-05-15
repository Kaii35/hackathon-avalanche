import pino from 'pino';

const REDACT_PATHS = [
  'email',
  '*.email',
  'password',
  '*.password',
  'passwordHash',
  '*.passwordHash',
  'rfc',
  '*.rfc',
  'curp',
  '*.curp',
  'fullName',
  '*.fullName',
  'authorization',
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie',
];

export const logger = pino({
  name: 'web',
  level: process.env.LOG_LEVEL ?? 'info',
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  base: { env: process.env.NODE_ENV ?? 'development' },
});

export type Logger = typeof logger;
