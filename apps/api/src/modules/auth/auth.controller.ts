import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  switchTenantSchema,
  verifyEmailSchema,
} from '@hisabkhata/shared';
import { ClientMeta, CurrentUser, Public, ZBody, type ClientMetaInfo } from '../../common/decorators';
import type { AppRequest, AuthUser } from '../../common/types';
import { ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE } from '../../common/guards/jwt.strategy';
import { AppConfig } from '../../config/app-config.service';
import { AuthService } from './auth.service';
import type { IssuedTokens } from './token.service';

const AUTH_LIMIT = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfig,
  ) {}

  private setCookies(res: Response, t: IssuedTokens) {
    const base = {
      secure: this.config.isProd,
      sameSite: this.config.get('COOKIE_SAMESITE'),
      domain: this.config.get('COOKIE_DOMAIN'),
    } as const;
    res.cookie(ACCESS_COOKIE, t.accessToken, { ...base, httpOnly: true, path: '/', maxAge: 15 * 60_000 });
    res.cookie(REFRESH_COOKIE, t.refreshToken, { ...base, httpOnly: true, path: '/api/auth', expires: t.refreshExpiresAt });
    // Readable by the web app, echoed back in the X-CSRF-Token header (double-submit).
    res.cookie(CSRF_COOKIE, t.csrfToken, { ...base, httpOnly: false, path: '/', expires: t.refreshExpiresAt });
  }

  private clearCookies(res: Response) {
    const opts = { domain: this.config.get('COOKIE_DOMAIN') };
    res.clearCookie(ACCESS_COOKIE, { ...opts, path: '/' });
    res.clearCookie(REFRESH_COOKIE, { ...opts, path: '/api/auth' });
    res.clearCookie(CSRF_COOKIE, { ...opts, path: '/' });
  }

  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('register')
  @ApiOperation({ summary: 'Create an account and a new business (tenant)' })
  async register(@ZBody(registerSchema) body: any, @ClientMeta() meta: ClientMetaInfo, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.auth.register(body, meta);
    this.setCookies(res, tokens);
    return { ok: true };
  }

  @Public()
  @Throttle(AUTH_LIMIT)
  @HttpCode(200)
  @Post('login')
  async login(@ZBody(loginSchema) body: any, @ClientMeta() meta: ClientMetaInfo, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.auth.login(body, meta);
    this.setCookies(res, tokens);
    return { ok: true };
  }

  @Public()
  @Throttle(AUTH_LIMIT)
  @HttpCode(200)
  @Post('token')
  @ApiOperation({ summary: 'Bearer access token for API clients and Swagger (no cookies)' })
  async token(@ZBody(loginSchema) body: any, @ClientMeta() meta: ClientMetaInfo) {
    const tokens = await this.auth.login(body, meta);
    await this.auth.logout(tokens.refreshToken);
    return { accessToken: tokens.accessToken, tokenType: 'Bearer', expiresIn: this.config.get('JWT_ACCESS_TTL') };
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: AppRequest, @ClientMeta() meta: ClientMetaInfo, @Res({ passthrough: true }) res: Response) {
    try {
      const tokens = await this.auth.refresh(req.cookies?.[REFRESH_COOKIE], meta);
      this.setCookies(res, tokens);
      return { ok: true };
    } catch (err) {
      this.clearCookies(res);
      throw err;
    }
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  async logout(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    this.clearCookies(res);
    return { ok: true };
  }

  @Get('session')
  session(@CurrentUser() user: AuthUser) {
    return this.auth.session(user.id, user.tid);
  }

  @HttpCode(200)
  @Post('switch-tenant')
  async switchTenant(
    @CurrentUser() user: AuthUser,
    @ZBody(switchTenantSchema) body: { tenantId: string },
    @Req() req: AppRequest,
    @ClientMeta() meta: ClientMetaInfo,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.switchTenant(user, body.tenantId, req.cookies?.[REFRESH_COOKIE], meta);
    this.setCookies(res, tokens);
    return { ok: true };
  }

  @Public()
  @HttpCode(200)
  @Post('verify-email')
  verifyEmail(@ZBody(verifyEmailSchema) body: { token: string }) {
    return this.auth.verifyEmail(body.token);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(200)
  @Post('resend-verification')
  resend(@CurrentUser() user: AuthUser) {
    return this.auth.resendVerification(user.id);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('forgot-password')
  forgot(@ZBody(forgotPasswordSchema) body: { email: string }, @ClientMeta() meta: ClientMetaInfo) {
    return this.auth.forgotPassword(body.email, meta);
  }

  @Public()
  @Throttle(AUTH_LIMIT)
  @HttpCode(200)
  @Post('reset-password')
  reset(@ZBody(resetPasswordSchema) body: { token: string; password: string }, @ClientMeta() meta: ClientMetaInfo) {
    return this.auth.resetPassword(body.token, body.password, meta);
  }

  @HttpCode(200)
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: AuthUser,
    @ZBody(changePasswordSchema) body: { currentPassword: string; newPassword: string },
    @ClientMeta() meta: ClientMetaInfo,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.changePassword(user.id, body.currentPassword, body.newPassword, meta);
    this.clearCookies(res);
    return result;
  }
}

