import {
  applyDecorators,
  Body,
  createParamDecorator,
  ExecutionContext,
  Query,
  SetMetadata,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBody, ApiQuery, ApiCookieAuth, ApiBearerAuth, ApiForbiddenResponse } from '@nestjs/swagger';
import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { Permission } from '@hisabkhata/shared';
import { ZodPipe } from '../pipes/zod.pipe';
import type { AppRequest, AuthUser, TenantContext } from '../types';

export const IS_PUBLIC = 'hk:public';
export const REQUIRE_TENANT = 'hk:tenant';
export const REQUIRED_PERMISSIONS = 'hk:permissions';
export const SUPER_ADMIN_ONLY = 'hk:superadmin';

/** Route does not require authentication. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Route requires an active tenant membership (no specific permission). */
export const TenantScoped = () =>
  applyDecorators(SetMetadata(REQUIRE_TENANT, true), ApiCookieAuth('hk_at'), ApiBearerAuth());

/** Route requires an active tenant membership whose role grants ALL listed permissions. */
export const RequirePermissions = (...permissions: Permission[]) =>
  applyDecorators(
    SetMetadata(REQUIRE_TENANT, true),
    SetMetadata(REQUIRED_PERMISSIONS, permissions),
    ApiCookieAuth('hk_at'),
    ApiBearerAuth(),
    ApiForbiddenResponse({ description: `Requires: ${permissions.join(', ')}` }),
  );

/** Platform administration. Tenant owners do not pass this check. */
export const SuperAdminOnly = () =>
  applyDecorators(SetMetadata(SUPER_ADMIN_ONLY, true), ApiCookieAuth('hk_at'), ApiBearerAuth());

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest<AppRequest>();
  if (!req.user) throw new UnauthorizedException();
  return req.user;
});

export const Tenant = createParamDecorator((_: unknown, ctx: ExecutionContext): TenantContext => {
  const req = ctx.switchToHttp().getRequest<AppRequest>();
  if (!req.tenantCtx) throw new ForbiddenException('No active business selected');
  return req.tenantCtx;
});

export const ClientMeta = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<AppRequest>();
  return { ip: req.ip ?? null, userAgent: (req.headers['user-agent'] ?? '').slice(0, 255) || null };
});
export type ClientMetaInfo = { ip: string | null; userAgent: string | null };

function jsonSchema(schema: ZodTypeAny) {
  return zodToJsonSchema(schema, { target: 'openApi3', $refStrategy: 'none' }) as Record<string, any>;
}

/** Validates the request body with a shared Zod schema and documents it in Swagger. */
export function ZBody(schema: ZodTypeAny): ParameterDecorator {
  return (target, key, index) => {
    Body(new ZodPipe(schema))(target, key, index);
    if (key) {
      const descriptor = Object.getOwnPropertyDescriptor(target, key)!;
      ApiBody({ schema: jsonSchema(schema) })(target, key, descriptor);
    }
  };
}

/** Validates query parameters with a shared Zod schema and documents them in Swagger. */
export function ZQuery(schema: ZodTypeAny): ParameterDecorator {
  return (target, key, index) => {
    Query(new ZodPipe(schema))(target, key, index);
    if (key) {
      const descriptor = Object.getOwnPropertyDescriptor(target, key)!;
      const props = (jsonSchema(schema).properties ?? {}) as Record<string, any>;
      for (const [name, s] of Object.entries(props)) {
        ApiQuery({ name, required: false, schema: s })(target, key, descriptor);
      }
    }
  };
}
