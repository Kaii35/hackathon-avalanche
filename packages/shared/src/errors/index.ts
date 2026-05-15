export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTH_REQUIRED'
  | 'AUTH_INVALID'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'COMPLIANCE_REJECTED'
  | 'RATE_LIMITED'
  | 'CHAIN_ERROR'
  | 'INTERNAL_ERROR';

export interface ErrorDetails {
  field?: string;
  reason?: string;
  [key: string]: unknown;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly details?: ErrorDetails;
  public readonly userMessage: string;

  constructor(params: {
    code: ErrorCode;
    httpStatus: number;
    message: string;
    userMessage?: string;
    details?: ErrorDetails;
  }) {
    super(params.message);
    this.name = this.constructor.name;
    this.code = params.code;
    this.httpStatus = params.httpStatus;
    this.userMessage = params.userMessage ?? params.message;
    this.details = params.details;
  }

  toJSON(): { error: { code: ErrorCode; message: string; details?: ErrorDetails } } {
    return {
      error: {
        code: this.code,
        message: this.userMessage,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: ErrorDetails) {
    super({
      code: 'VALIDATION_ERROR',
      httpStatus: 400,
      message,
      userMessage: message,
      details,
    });
  }
}

export class AuthError extends AppError {
  constructor(
    message = 'Credenciales inválidas',
    code: 'AUTH_REQUIRED' | 'AUTH_INVALID' = 'AUTH_INVALID',
  ) {
    super({
      code,
      httpStatus: code === 'AUTH_REQUIRED' ? 401 : 401,
      message,
      userMessage: message,
    });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'No tienes permisos para esta acción') {
    super({ code: 'FORBIDDEN', httpStatus: 403, message, userMessage: message });
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super({
      code: 'NOT_FOUND',
      httpStatus: 404,
      message: `${resource} no encontrado`,
      userMessage: `${resource} no encontrado`,
    });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: ErrorDetails) {
    super({ code: 'CONFLICT', httpStatus: 409, message, userMessage: message, details });
  }
}

export class ComplianceError extends AppError {
  constructor(message: string, details?: ErrorDetails) {
    super({
      code: 'COMPLIANCE_REJECTED',
      httpStatus: 422,
      message,
      userMessage: message,
      details,
    });
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSec: number) {
    super({
      code: 'RATE_LIMITED',
      httpStatus: 429,
      message: 'Demasiadas solicitudes',
      userMessage: 'Demasiadas solicitudes. Intenta de nuevo en unos segundos.',
      details: { retryAfterSec },
    });
  }
}

export class ChainError extends AppError {
  constructor(message: string, details?: ErrorDetails) {
    super({
      code: 'CHAIN_ERROR',
      httpStatus: 502,
      message,
      userMessage: 'Error en la blockchain. Intenta nuevamente.',
      details,
    });
  }
}

export class NotImplementedError extends AppError {
  constructor(feature: string) {
    super({
      code: 'INTERNAL_ERROR',
      httpStatus: 501,
      message: `Not implemented: ${feature}`,
      userMessage: 'Funcionalidad no disponible aún.',
    });
  }
}
