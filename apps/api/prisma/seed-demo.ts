import type { INestApplicationContext } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { TenantProvisioningService } from '../src/modules/tenants/tenant-provisioning.service';
import { ProductsService } from '../src/modules/inventory/products.service';
import { CategoriesService } from '../src/modules/inventory/categories.service';
import { CustomersService } from '../src/modules/parties/customers.service';
import { SuppliersService } from '../src/modules/parties/suppliers.service';
import { PurchasesService } from '../src/modules/purchases/purchases.service';
import { SalesService } from '../src/modules/sales/sales.service';
import { DEFAULT_ROLE_PERMISSIONS } from '@hisabkhata/shared';
import type { TenantContext } from '../src/common/types';

const DEMO_PASSWORD = 'Demo12345';

// Deterministic pseudo-random so the demo looks the same on every machine.
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T>(a: T[]) => a[Math.floor(rand() * a.length)];

const CATALOGUE: { cat: string; items: [string, string, string, string, string, number][] }[] = [
  // [name, unit, cost, price, barcode, minStock]
  {
    cat: 'Rice & Grains',
    items: [
      ['Miniket Rice (25 kg bag)', 'pcs', '1650.00', '1850.00', '8941100500011', 5],
      ['Najirshail Rice', 'kg', '72.00', '82.00', '8941100500028', 40],
      ['Chinigura Aromatic Rice', 'kg', '120.00', '140.00', '8941100500035', 20],
      ['Red Lentils (Masoor Dal)', 'kg', '105.00', '125.00', '8941100500042', 30],
      ['Atta (Teer, 2 kg)', 'pcs', '118.00', '135.00', '8941100500059', 15],
    ],
  },
  {
    cat: 'Oil & Spices',
    items: [
      ['Soybean Oil (Rupchanda, 5 L)', 'pcs', '820.00', '880.00', '8941100500066', 10],
      ['Mustard Oil (Radhuni, 1 L)', 'pcs', '255.00', '290.00', '8941100500073', 10],
      ['Turmeric Powder (Radhuni, 200 g)', 'pcs', '78.00', '95.00', '8941100500080', 12],
      ['Chilli Powder (Pran, 200 g)', 'pcs', '82.00', '100.00', '8941100500097', 12],
      ['Iodised Salt (Molla, 1 kg)', 'pcs', '36.00', '42.00', '8941100500103', 25],
    ],
  },
  {
    cat: 'Beverages',
    items: [
      ['Ispahani Mirzapore Tea (400 g)', 'pcs', '210.00', '240.00', '8941100500110', 10],
      ['Nescafe Classic (50 g)', 'pcs', '245.00', '285.00', '8941100500127', 6],
      ['Mojo (250 ml)', 'pcs', '20.00', '25.00', '8941100500134', 48],
      ['Mineral Water (Mum, 1.5 L)', 'pcs', '25.00', '30.00', '8941100500141', 36],
    ],
  },
  {
    cat: 'Dairy & Snacks',
    items: [
      ['Pran UHT Milk (1 L)', 'pcs', '95.00', '110.00', '8941100500158', 20],
      ['Dano Full Cream Milk Powder (500 g)', 'pcs', '440.00', '495.00', '8941100500165', 8],
      ['Olympic Energy Plus Biscuit', 'pcs', '18.00', '22.00', '8941100500172', 40],
      ['Chanachur (Bombay Sweets, 300 g)', 'pcs', '68.00', '80.00', '8941100500189', 15],
    ],
  },
  {
    cat: 'Household',
    items: [
      ['Wheel Washing Powder (1 kg)', 'pcs', '125.00', '145.00', '8941100500196', 12],
      ['Lux Soap (100 g)', 'pcs', '52.00', '62.00', '8941100500202', 24],
      ['Harpic Toilet Cleaner (500 ml)', 'pcs', '138.00', '160.00', '8941100500219', 8],
      ['Vim Dishwashing Bar', 'pcs', '22.00', '28.00', '8941100500226', 30],
    ],
  },
];

const CUSTOMERS: [string, string, string?][] = [
  ['Abdul Karim', '01711234567', 'karim.store@example.com'],
  ['Nusrat Jahan', '01819876543'],
  ['Mohammad Rafiq', '01911223344', 'rafiq.m@example.com'],
  ['Shirin Akter', '01556677889'],
  ['Tanvir Hasan', '01675544332', 'tanvir.h@example.com'],
  ['Farzana Begum', '01799887766'],
  ['Kamrul Islam', '01310203040'],
  ['Sylhet Tea Stall (Rubel)', '01722334455'],
];

const SUPPLIERS: [string, string, string][] = [
  ['Jamal Uddin', 'Meghna Traders', '01712000111'],
  ['Selim Reza', 'City Group Distribution (Sylhet)', '01815000222'],
  ['Habibur Rahman', 'Pran-RFL Dealer, Zindabazar', '01916000333'],
];

function ctxFor(tenant: { id: string; name: string; currency: string; timezone: string; allowNegativeStock: boolean; invoicePrefix: string }, userId: string, roleId: string, membershipId: string): TenantContext {
  return {
    tenantId: tenant.id,
    userId,
    roleId,
    membershipId,
    roleKey: 'OWNER',
    permissions: new Set(DEFAULT_ROLE_PERMISSIONS.OWNER),
    tenant: { ...tenant, defaultTaxRate: '0' },
  };
}

export async function seedDemo(app: INestApplicationContext) {
  const prisma = app.get(PrismaService);
  const auth = app.get(AuthService);
  const ownerEmail = 'owner@rahmanstore.demo';
  if (await prisma.user.findUnique({ where: { email: ownerEmail } })) {
    console.log('Demo data already present, skipping.');
    return;
  }
  const passwordHash = await auth.hashPassword(DEMO_PASSWORD);
  const provisioning = app.get(TenantProvisioningService);

  // ---- users
  const [owner, manager, cashier, pharmacist] = await Promise.all([
    prisma.user.create({ data: { email: ownerEmail, name: 'Mizanur Rahman', passwordHash, phone: '+8801711000001', emailVerifiedAt: new Date() } }),
    prisma.user.create({ data: { email: 'manager@rahmanstore.demo', name: 'Sabina Yasmin', passwordHash, emailVerifiedAt: new Date() } }),
    prisma.user.create({ data: { email: 'cashier@rahmanstore.demo', name: 'Arif Hossain', passwordHash, emailVerifiedAt: new Date() } }),
    prisma.user.create({ data: { email: 'owner@shaplapharmacy.demo', name: 'Dr. Farhana Chowdhury', passwordHash, emailVerifiedAt: new Date() } }),
  ]);

  const { tenant, roles } = await prisma.$transaction((tx) =>
    provisioning.provision(tx, { name: 'Rahman General Store', businessType: 'GROCERY', ownerUserId: owner.id, email: 'hello@rahmanstore.demo', phone: '+8801711000001' }),
  );
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { address: 'Shop 12, Zindabazar, Sylhet 3100', invoicePrefix: 'RGS', invoiceFooter: 'Thank you for shopping with us. Goods once sold are exchangeable within 7 days with receipt.' },
  });
  // Give the demo business the Premium plan so every feature is visible.
  const premium = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { code: 'PREMIUM' } });
  await prisma.subscription.updateMany({ where: { tenantId: tenant.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
  const yearEnd = new Date();
  yearEnd.setUTCFullYear(yearEnd.getUTCFullYear() + 1);
  await prisma.subscription.create({ data: { tenantId: tenant.id, planId: premium.id, status: 'ACTIVE', interval: 'YEARLY', startsAt: new Date(), endsAt: yearEnd } });

  await prisma.membership.createMany({
    data: [
      { tenantId: tenant.id, userId: manager.id, roleId: roles.MANAGER, status: 'ACTIVE', joinedAt: new Date() },
      { tenantId: tenant.id, userId: cashier.id, roleId: roles.CASHIER, status: 'ACTIVE', joinedAt: new Date() },
    ],
  });
  const membership = await prisma.membership.findFirstOrThrow({ where: { tenantId: tenant.id, userId: owner.id } });
  const t = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
  const ctx = ctxFor(t, owner.id, roles.OWNER, membership.id);

  const categories = app.get(CategoriesService);
  const products = app.get(ProductsService);
  const customers = app.get(CustomersService);
  const suppliers = app.get(SuppliersService);
  const purchases = app.get(PurchasesService);
  const sales = app.get(SalesService);

  // ---- catalogue (no opening stock: stock arrives through purchases)
  const productIds: { id: string; cost: string; price: string }[] = [];
  let skuN = 1001;
  for (const group of CATALOGUE) {
    const c = await categories.create(ctx, { name: group.cat });
    for (const [name, unit, cost, price, barcode, minStock] of group.items) {
      const p = await products.create(ctx, {
        name,
        unit,
        sku: `RGS-${skuN++}`,
        barcode,
        categoryId: c.id,
        purchasePrice: cost,
        sellingPrice: price,
        taxRate: '0',
        minStock: String(minStock),
      } as any);
      productIds.push({ id: p.id, cost, price });
    }
  }

  const supplierRows = [];
  for (const [name, company, phone] of SUPPLIERS) supplierRows.push(await suppliers.create(ctx, { name, company, phone: '+88' + phone }));
  const customerRows = [];
  for (const [name, phone, email] of CUSTOMERS) customerRows.push(await customers.create(ctx, { name, phone: '+88' + phone, email }));

  const DAY = 86_400_000;
  const backdate = async (model: 'sale' | 'purchase', id: string, when: Date) => {
    if (model === 'sale') {
      await prisma.sale.update({ where: { id }, data: { createdAt: when } });
      await prisma.invoice.updateMany({ where: { saleId: id }, data: { issuedAt: when, createdAt: when } });
      await prisma.payment.updateMany({ where: { saleId: id }, data: { createdAt: when } });
      await prisma.stockMovement.updateMany({ where: { referenceId: id }, data: { createdAt: when } });
    } else {
      await prisma.purchase.update({ where: { id }, data: { createdAt: when, purchaseDate: when } });
      await prisma.payment.updateMany({ where: { purchaseId: id }, data: { createdAt: when } });
      await prisma.stockMovement.updateMany({ where: { referenceId: id }, data: { createdAt: when } });
    }
  };

  // ---- stock in: three purchase rounds over the last 75 days
  for (const [round, daysAgo] of [[0, 75], [1, 45], [2, 15]] as const) {
    const supplier = supplierRows[round];
    const items = productIds
      .filter((_, i) => (i + round) % 3 !== 2 || round === 0)
      .map((p) => ({ productId: p.id, quantity: String(80 + Math.floor(rand() * 120)), unitCost: p.cost }));
    const subtotal = items.reduce((a, i) => a + Number(i.quantity) * Number(i.unitCost), 0);
    const paid = round === 2 ? Math.round(subtotal * 0.6) : Math.round(subtotal);
    const po = await purchases.create(ctx, {
      supplierId: supplier.id,
      reference: `CH-${2400 + round * 17}`,
      items,
      discount: '0',
      shippingCost: round === 0 ? '500.00' : '300.00',
      payments: [{ method: round === 1 ? 'BANK' : 'CASH', amount: String(Math.min(paid, subtotal)) }],
    } as any);
    await backdate('purchase', po.id, new Date(Date.now() - daysAgo * DAY));
  }

  // ---- sales: ~3 to 7 per day for 60 days
  const methods = ['CASH', 'CASH', 'CASH', 'BKASH', 'NAGAD', 'CARD'] as const;
  for (let d = 60; d >= 0; d--) {
    const count = 7 + Math.floor(rand() * 7);
    for (let k = 0; k < count; k++) {
      const lines = Array.from({ length: 1 + Math.floor(rand() * 4) }, () => ({ productId: pick(productIds).id, quantity: String(1 + Math.floor(rand() * 3)), discount: '0' }));
      const unique = [...new Map(lines.map((l) => [l.productId, l])).values()];
      const customer = rand() < 0.45 ? pick(customerRows) : null;
      const onCredit = customer && rand() < 0.25;
      const discount = rand() < 0.15 ? 10 : 0;
      // Integer paisa arithmetic for the expected total (tax is 0 for this shop).
      const paisa = unique.reduce((a, l) => a + Math.round(Number(productIds.find((p) => p.id === l.productId)!.price) * 100) * Number(l.quantity), 0) - discount * 100;
      const pay = onCredit ? Math.floor(paisa / 200) * 100 : paisa;
      try {
        const sale = await sales.create(ctx, {
          customerId: customer?.id ?? null,
          items: unique,
          discount: String(discount),
          payments: pay > 0 ? [{ method: pick([...methods]), amount: (pay / 100).toFixed(2) }] : [],
        } as any);
        const when = new Date(Date.now() - d * DAY - Math.floor(rand() * 9) * 3600_000);
        await backdate('sale', sale.id, when);
      } catch {
        // Out of stock for a random basket: skip, just as a cashier would.
      }
    }
  }

  // ---- a few expenses
  const expCats = await prisma.expenseCategory.findMany({ where: { tenantId: tenant.id } });
  const byName = (n: string) => expCats.find((c) => c.name === n)!.id;
  for (let m = 2; m >= 0; m--) {
    const date = new Date();
    date.setUTCMonth(date.getUTCMonth() - m, 3);
    await prisma.expense.createMany({
      data: [
        { tenantId: tenant.id, categoryId: byName('Rent'), amount: '6000.00', method: 'BANK', description: 'Shop rent', expenseDate: date, userId: owner.id },
        { tenantId: tenant.id, categoryId: byName('Salaries'), amount: '8000.00', method: 'CASH', description: 'Salary: shop assistant', expenseDate: new Date(date.getTime() + 2 * DAY), userId: owner.id },
        { tenantId: tenant.id, categoryId: byName('Utilities'), amount: (1400 + Math.floor(rand() * 500)).toFixed(2), method: 'BKASH', description: 'Electricity bill', expenseDate: new Date(date.getTime() + 8 * DAY), userId: owner.id },
        { tenantId: tenant.id, categoryId: byName('Transport'), amount: (500 + Math.floor(rand() * 400)).toFixed(2), method: 'CASH', description: 'Van rent for stock pickup', expenseDate: new Date(date.getTime() + 12 * DAY), userId: owner.id },
      ].filter((e) => e.expenseDate <= new Date()),
    });
  }

  // ---- second, independent tenant to demonstrate isolation
  const { tenant: pharmacy } = await prisma.$transaction((tx) =>
    provisioning.provision(tx, { name: 'Shapla Pharmacy', businessType: 'PHARMACY', ownerUserId: pharmacist.id, email: 'info@shaplapharmacy.demo' }),
  );
  const ph = await prisma.tenant.findUniqueOrThrow({ where: { id: pharmacy.id } });
  const phRoles = await prisma.role.findFirstOrThrow({ where: { tenantId: ph.id, systemKey: 'OWNER' } });
  const phMember = await prisma.membership.findFirstOrThrow({ where: { tenantId: ph.id, userId: pharmacist.id } });
  const phCtx = ctxFor(ph, pharmacist.id, phRoles.id, phMember.id);
  const meds = await categories.create(phCtx, { name: 'Medicines' });
  for (const [name, cost, price, stock] of [
    ['Napa 500 mg (strip of 10)', '9.50', '12.00', '200'],
    ['Seclo 20 mg (strip of 10)', '52.00', '60.00', '80'],
    ['Fexo 120 mg (strip of 10)', '85.00', '100.00', '60'],
    ['Orsaline-N (sachet)', '5.00', '6.00', '300'],
  ] as const) {
    await products.create(phCtx, { name, unit: 'strip', categoryId: meds.id, purchasePrice: cost, sellingPrice: price, taxRate: '0', minStock: '20', openingStock: stock } as any);
  }

  console.log('Demo businesses created:');
  console.log(`  Rahman General Store  owner ${ownerEmail} / ${DEMO_PASSWORD}  (manager@rahmanstore.demo, cashier@rahmanstore.demo)`);
  console.log(`  Shapla Pharmacy       owner owner@shaplapharmacy.demo / ${DEMO_PASSWORD}`);
}
