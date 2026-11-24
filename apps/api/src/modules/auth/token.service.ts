import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { randomToken, sha256 } from '../../common/utils/crypto';
import type { AccessTokenPayload } from '../../common/guards/jwt.strategy';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  csrfToken: string;
}

/**
 * Access tokens: short-lived JWT (HS256). Refresh tokens: random opaque values stored only as
 * SHA-256 hashes, rotated on every use. Re-use of a rotated token revokes the whole family.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  signAccess(payload: AccessTokenPayload): string {
    return this.jwt.sign(payload, {
      expiresIn: this.config.get('JWT_ACCESS_TTL') as any,
      issuer: 'hisabkhata',
      audience: 'hisabkhata-api',
    });
  }

  async issue(
    user: { id: string; email: string; isSuperAdmin: boolean },
    tenantId: string | null,
    meta: { ip?: string | null; userAgent?: string | null },
    familyId?: string,
  ): Promise<IssuedTokens & { tokenId: string }> {
    const refreshToken = randomToken(48);
    const refreshExpiresAt = new Date(Date.now() + this.config.get('REFRESH_TOKEN_TTL_DAYS') * 86_400_000);
    const row = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId: familyId ?? randomToken(16),
        tokenHash: sha256(refreshToken),
        tenantId,
        expiresAt: refreshExpiresAt,
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
      },
    });
    return {
      tokenId: row.id,
      accessToken: this.signAccess({ sub: user.id, email: user.email, sa: user.isSuperAdmin, tid: tenantId }),
      refreshToken,
      refreshExpiresAt,
      csrfToken: randomToken(24),
    };
  }

  /** Validates and consumes a refresh token, returning its row. Detects replay. */
  async consume(raw: string) {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(raw) } });
    if (!row) throw new UnauthorizedException('Session expired');
    if (row.revokedAt) {
      // A rotated token was presented again: assume theft and kill the whole session family.
      await this.revokeFamily(row.familyId);
      throw new UnauthorizedException('Session expired');
    }
    if (row.expiresAt < new Date()) throw new UnauthorizedException('Session expired');
    const updated = await this.prisma.refreshToken.updateMany({
      where: { id: row.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (updated.count === 0) {
      await this.revokeFamily(row.familyId);
      throw new UnauthorizedException('Session expired');
    }
    return row;
  }

  async linkReplacement(oldId: string, newId: string) {
    await this.prisma.refreshToken.update({ where: { id: oldId }, data: { replacedById: newId } });
  }

  async revokeFamily(familyId: string) {
    await this.prisma.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async revokeAllForUser(userId: string) {
    await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async revokeByRaw(raw: string | undefined) {
    if (!raw) return;
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(raw) } });
    if (row) await this.revokeFamily(row.familyId);
  }
}
