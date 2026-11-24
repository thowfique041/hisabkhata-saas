import { BadGatewayException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AppConfig } from '../../../config/app-config.service';
import { safeEqual } from '../../../common/utils/crypto';
import type { InitiateContext, InitiateResult, PaymentProvider, VerifiedEvent } from './payment-provider';

const md5 = (s: string) => createHash('md5').update(s).digest('hex');

/**
 * SSLCommerz (Bangladesh): cards, bKash, Nagad, Rocket, internet banking.
 * Verification is two-step: (1) verify_sign over verify_key fields using md5(store_password),
 * (2) server-to-server Validation API call. Only VALID/VALIDATED with a matching amount succeeds.
 */
@Injectable()
export class SslCommerzProvider implements PaymentProvider {
  readonly name = 'sslcommerz';
  readonly label = 'SSLCommerz (card, bKash, Nagad, Rocket)';
  private readonly logger = new Logger(SslCommerzProvider.name);

  constructor(private readonly config: AppConfig) {}

  private get base() {
    return this.config.get('SSLCOMMERZ_SANDBOX') ? 'https://sandbox.sslcommerz.com' : 'https://securepay.sslcommerz.com';
  }

  isConfigured() {
    return Boolean(this.config.get('SSLCOMMERZ_STORE_ID') && this.config.get('SSLCOMMERZ_STORE_PASSWORD'));
  }

  async initiate({ payment, plan, customer }: InitiateContext): Promise<InitiateResult> {
    if (!this.isConfigured()) throw new BadGatewayException('SSLCommerz is not configured');
    const api = this.config.get('API_URL');
    const app = this.config.get('APP_URL');
    const form = new URLSearchParams({
      store_id: this.config.get('SSLCOMMERZ_STORE_ID')!,
      store_passwd: this.config.get('SSLCOMMERZ_STORE_PASSWORD')!,
      total_amount: payment.amount.toFixed(2),
      currency: payment.currency,
      tran_id: payment.providerRef,
      success_url: `${app}/subscription?payment=processing`,
      fail_url: `${app}/subscription?payment=failed`,
      cancel_url: `${app}/subscription?payment=cancelled`,
      ipn_url: `${api}/api/billing/webhooks/sslcommerz`,
      product_name: `HisabKhata ${plan.name} (${payment.interval.toLowerCase()})`,
      product_category: 'SaaS subscription',
      product_profile: 'non-physical-goods',
      shipping_method: 'NO',
      cus_name: customer.name,
      cus_email: customer.email,
      cus_add1: 'N/A',
      cus_city: 'N/A',
      cus_country: 'Bangladesh',
      cus_phone: 'N/A',
      value_a: payment.id,
    });
    const res = await fetch(`${this.base}/gwprocess/v4/api.php`, { method: 'POST', body: form });
    const data = (await res.json().catch(() => ({}))) as Record<string, string>;
    if (data.status !== 'SUCCESS' || !data.GatewayPageURL) {
      this.logger.warn({ reason: data.failedreason }, 'SSLCommerz session failed');
      throw new BadGatewayException('Could not start the payment. Please try again later.');
    }
    return { redirectUrl: data.GatewayPageURL };
  }

  /** Validates the IPN signature as documented by SSLCommerz. */
  verifySignature(body: Record<string, unknown>): boolean {
    const sign = String(body.verify_sign ?? '');
    const keys = String(body.verify_key ?? '')
      .split(',')
      .filter(Boolean);
    if (!sign || !keys.length) return false;
    const params: Record<string, string> = {};
    for (const k of keys) params[k] = String(body[k] ?? '');
    params.store_passwd = md5(this.config.get('SSLCOMMERZ_STORE_PASSWORD') ?? '');
    const data = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');
    return safeEqual(md5(data), sign);
  }

  async verifyWebhook(body: Record<string, unknown>): Promise<VerifiedEvent> {
    if (!this.isConfigured()) throw new UnauthorizedException('Provider not configured');
    if (!this.verifySignature(body)) throw new UnauthorizedException('Invalid signature');
    const valId = String(body.val_id ?? '');
    if (!valId) throw new UnauthorizedException('Missing validation id');

    const url = new URL(`${this.base}/validator/api/validationserverAPI.php`);
    url.searchParams.set('val_id', valId);
    url.searchParams.set('store_id', this.config.get('SSLCOMMERZ_STORE_ID')!);
    url.searchParams.set('store_passwd', this.config.get('SSLCOMMERZ_STORE_PASSWORD')!);
    url.searchParams.set('format', 'json');
    const res = await fetch(url);
    const v = (await res.json().catch(() => ({}))) as Record<string, string>;
    const ok = v.status === 'VALID' || v.status === 'VALIDATED';
    return {
      eventId: valId,
      providerRef: String(v.tran_id ?? body.tran_id ?? ''),
      status: ok ? 'SUCCEEDED' : 'FAILED',
      amount: String(v.currency_amount ?? v.amount ?? '0'),
      currency: String(v.currency_type ?? v.currency ?? 'BDT'),
      raw: { ipn: body, validation: v },
    };
  }
}
