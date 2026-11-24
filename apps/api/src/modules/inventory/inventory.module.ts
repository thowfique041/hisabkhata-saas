import { Global, Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { ProductsService } from './products.service';
import { CategoriesService } from './categories.service';
import { StockService } from './stock.service';
import { LowStockJob } from './low-stock.job';

@Global()
@Module({
  controllers: [InventoryController],
  providers: [ProductsService, CategoriesService, StockService, LowStockJob],
  exports: [StockService, ProductsService, LowStockJob],
})
export class InventoryModule {}
