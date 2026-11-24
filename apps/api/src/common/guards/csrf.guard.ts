import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE } from './jwt.strategy';
import { safeEqual } from '../utils/crypto';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit CSRF protection for cookie-authenticated requests.
 * Bearer-token clients (Swagger, scripts) are not exposed to CSRF and are skipped.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (SAFE.has(req.method)) return true;
    if (req.headers.authorization?.startsWith('Bearer ')) return true;
    const cookies = req.cookies ?? {};
    const cookieAuth = Boolean(cookies[ACCESS_COOKIE] || cookies[REFRESH_COOKIE]);
    if (!cookieAuth) return true;

    const header = req.headers['x-csrf-token'];
    const cookie = cookies[CSRF_COOKIE];
    if (typeof header !== 'string' || !cookie || !safeEqual(header, cookie)) {
      throw new ForbiddenException('Invalid CSRF token');
    }
    return true;
  }
}
