import { Global, Module } from '@nestjs/common';
import { InvoiceEmailJob, InvoicesController } from './invoices.controller';
import { InvoicePdfService } from './invoice-pdf.service';

@Global()
@Module({
  controllers: [InvoicesController],
  providers: [InvoicePdfService, InvoiceEmailJob],
  exports: [InvoicePdfService],
})
export class InvoicesModule {}
