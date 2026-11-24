import { Global, Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { PaymentProviderRegistry } from './providers/provider.registry';
import { ManualPaymentProvider } from './providers/manual.provider';
import { SslCommerzProvider } from './providers/sslcommerz.provider';

@Global()
@Module({
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, PaymentProviderRegistry, ManualPaymentProvider, SslCommerzProvider],
  exports: [SubscriptionsService, PaymentProviderRegistry, SslCommerzProvider],
})
export class SubscriptionsModule {}
