import { BadRequestException, Injectable } from '@nestjs/common';
import type { InitiateContext, InitiateResult, PaymentProvider, VerifiedEvent } from './payment-provider';
import { formatMoney } from '@hisabkhata/shared';

/**
 * Offline payment (bank transfer / mobile banking to a merchant number).
 * The plan is activated only when a platform admin confirms the payment was received.
 */
@Injectable()
export class ManualPaymentProvider implements PaymentProvider {
  readonly name = 'manual';
  readonly label = 'Bank transfer or mobile banking (manual confirmation)';

  isConfigured() {
    return true;
  }

  async initiate({ payment, plan }: InitiateContext): Promise<InitiateResult> {
    return {
      instructions:
        `Send ${formatMoney(payment.amount.toString(), payment.currency)} for the ${plan.name} plan and use ` +
        `reference ${payment.providerRef}. Your plan activates as soon as our team confirms the payment.`,
    };
  }

  async verifyWebhook(): Promise<VerifiedEvent> {
    throw new BadRequestException('Manual payments are confirmed by an administrator, not by webhook');
  }
}
