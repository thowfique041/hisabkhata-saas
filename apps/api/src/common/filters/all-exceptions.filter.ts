import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client';
import type { AppRequest } from '../types';

/**
 * Normalises every error into { statusCode, error, message, details?, requestId }.
 * Internal errors are logged with full detail but never leaked to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<AppRequest>();
    const requestId = req.id ? String(req.id) : undefined;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, unknown> = { message: 'Something went wrong. Please try again.' };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      body = typeof r === 'string' ? { message: r } : { ...(r as Record<string, unknown>) };
      if (Array.isArray(body.message)) body.message = (body.message as string[]).join(', ');
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        const target = (exception.meta?.target as string[] | string | undefined) ?? '';
        const fields = (Array.isArray(target) ? target : [target]).filter((f) => f !== 'tenantId');
        body = { message: `A record with this ${fields.join(', ') || 'value'} already exists` };
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        body = { message: 'Record not found' };
      } else if (exception.code === 'P2003') {
        status = HttpStatus.CONFLICT;
        body = { message: 'This record is in use and cannot be removed' };
      } else {
        this.logger.error({ err: exception, requestId }, 'Database error');
      }
    } else {
      this.logger.error({ err: exception, requestId }, 'Unhandled error');
    }

    res.status(status).json({
      statusCode: status,
      error: HttpStatus[status] ?? 'Error',
      ...body,
      requestId,
    });
  }
}
