import type { BillingPayment, SubscriptionPlan } from '../../../generated/prisma/client';

export interface InitiateContext {
  payment: BillingPayment;
  plan: SubscriptionPlan;
  customer: { name: string; email: string };
}

export interface InitiateResult {
  /** Hosted checkout URL to redirect the browser to (card / mobile banking providers). */
  redirectUrl?: string;
  /** Human-readable instructions for offline methods (bank transfer, bKash merchant). */
  instructions?: string;
}

export interface VerifiedEvent {
  /** Unique id of this notification at the provider, used for idempotency. */
  eventId: string;
  /** Our BillingPayment.providerRef. */
  providerRef: string;
  status: 'SUCCEEDED' | 'FAILED';
  amount: string;
  currency: string;
  raw: Record<string, unknown>;
}

/**
 * A payment provider adapter. Adding bKash, Nagad or Stripe means implementing this interface
 * and registering it in PaymentProviderRegistry; no billing logic changes.
 */
export interface PaymentProvider {
  readonly name: string;
  readonly label: string;
  isConfigured(): boolean;
  initiate(ctx: InitiateContext): Promise<InitiateResult>;
  /** Must verify authenticity (signature and/or server-side validation). Throws if not authentic. */
  verifyWebhook(body: Record<string, unknown>, headers: Record<string, string | string[] | undefined>): Promise<VerifiedEvent>;
}
