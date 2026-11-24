import { BadRequestException, Injectable } from '@nestjs/common';
import { ManualPaymentProvider } from './manual.provider';
import { SslCommerzProvider } from './sslcommerz.provider';
import type { PaymentProvider } from './payment-provider';

@Injectable()
export class PaymentProviderRegistry {
  private readonly providers: Map<string, PaymentProvider>;

  constructor(manual: ManualPaymentProvider, sslcommerz: SslCommerzProvider) {
    this.providers = new Map<string, PaymentProvider>([
      [manual.name, manual],
      [sslcommerz.name, sslcommerz],
    ]);
  }

  get(name: string): PaymentProvider {
    const p = this.providers.get(name);
    if (!p || !p.isConfigured()) throw new BadRequestException('This payment method is not available');
    return p;
  }

  available() {
    return [...this.providers.values()].filter((p) => p.isConfigured()).map((p) => ({ name: p.name, label: p.label }));
  }
}
