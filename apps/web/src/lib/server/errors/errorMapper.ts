import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError, ValidationError } from '@hack/shared';
import { logger } from '../logger';

export function toErrorResponse(err: unknown, requestId?: string): NextResponse {
  if (err instanceof ZodError) {
    const fields = err.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    const ve = new ValidationError('Datos inválidos', { fields });
    return NextResponse.json(ve.toJSON(), { status: ve.httpStatus });
  }

  if (err instanceof AppError) {
    if (err.httpStatus >= 500) {
      logger.error(
        { err: { code: err.code, message: err.message, details: err.details }, requestId },
        'AppError 5xx',
      );
    }
    return NextResponse.json(err.toJSON(), { status: err.httpStatus });
  }

  logger.error(
    {
      err: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
      requestId,
    },
    'unhandled error',
  );
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } },
    { status: 500 },
  );
}
