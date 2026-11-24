import { Module } from '@nestjs/common';
import { PartiesController } from './parties.controller';
import { CustomersService } from './customers.service';
import { SuppliersService } from './suppliers.service';

@Module({
  controllers: [PartiesController],
  providers: [CustomersService, SuppliersService],
  exports: [CustomersService],
})
export class PartiesModule {}
