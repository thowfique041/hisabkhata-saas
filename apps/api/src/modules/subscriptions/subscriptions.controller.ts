import { Body, Controller, Get, Headers, HttpCode, Logger, Param, Post } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { changePlanSchema, PERMISSIONS } from '@hisabkhata/shared';
import { CurrentUser, Public, RequirePermissions, Tenant, ZBody } from '../../common/decorators';
import type { AuthUser, TenantContext } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import { sha256 } from '../../common/utils/crypto';
import { dec } from '../../common/utils/decimal';
import { SubscriptionsService } from './subscriptions.service';
import { PaymentProviderRegistry } from './providers/provider.registry';

@ApiTags('Subscription')
@Controller()
export class SubscriptionsController {
  private readonly logger = new Logger(SubscriptionsController.name);

  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly providers: PaymentProviderRegistry,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('plans')
  plans() {
    return this.subscriptions.listPublicPlans();
  }

  @Get('subscription')
  @RequirePermissions(PERMISSIONS.SUBSCRIPTION_MANAGE)
  overview(@Tenant() t: TenantContext) {
    return this.subscriptions.overview(t.tenantId);
  }

  @Post('subscription/change')
  @RequirePermissions(PERMISSIONS.SUBSCRIPTION_MANAGE)
  async change(@Tenant() t: TenantContext, @CurrentUser() u: AuthUser, @ZBody(changePlanSchema) body: any) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    return this.subscriptions.changePlan(t.tenantId, u.id, body, { name: user.name, email: user.email });
  }

  /**
   * Provider notifications (IPN). Authenticity is verified by the provider adapter; each event id
   * is processed at most once; the amount must match what we asked for.
   */
  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @ApiExcludeEndpoint()
  @Post('billing/webhooks/:provider')
  async webhook(
    @Param('provider') providerName: string,
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string>,
  ) {
    const provider = this.providers.get(providerName);
    const event = await provider.verifyWebhook(body, headers);

    const inserted = await this.prisma.webhookEvent.createMany({
      data: [{ provider: provider.name, eventId: event.eventId, payloadHash: sha256(JSON.stringify(body)) }],
      skipDuplicates: true,
    });
    if (inserted.count === 0) return { ok: true, duplicate: true };

    const payment = await this.prisma.billingPayment.findUnique({
      where: { provider_providerRef: { provider: provider.name, providerRef: event.providerRef } },
    });
    if (!payment) {
      this.logger.warn({ ref: event.providerRef }, 'Webhook for unknown payment');
      return { ok: true };
    }
    const amountMatches = dec(event.amount).equals(payment.amount) && event.currency === payment.currency;
    if (event.status === 'SUCCEEDED' && amountMatches) {
      await this.subscriptions.confirmPayment(payment.id, event.raw, `webhook:${provider.name}`);
    } else {
      await this.subscriptions.markPaymentFailed(payment.id, { ...event.raw, amountMatches });
    }
    return { ok: true };
  }
}
