import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { AppConfig } from '../../config/app-config.service';
import type { AuthUser } from '../types';

export const ACCESS_COOKIE = 'hk_at';
export const REFRESH_COOKIE = 'hk_rt';
export const CSRF_COOKIE = 'hk_csrf';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  sa: boolean;
  tid: string | null;
}

const fromCookie = (req: Request): string | null => req?.cookies?.[ACCESS_COOKIE] ?? null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: AppConfig) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([ExtractJwt.fromAuthHeaderAsBearerToken(), fromCookie]),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET'),
      algorithms: ['HS256'],
      issuer: 'hisabkhata',
      audience: 'hisabkhata-api',
    });
  }

  validate(payload: AccessTokenPayload): AuthUser {
    return { id: payload.sub, email: payload.email, isSuperAdmin: !!payload.sa, tid: payload.tid ?? null };
  }
}
