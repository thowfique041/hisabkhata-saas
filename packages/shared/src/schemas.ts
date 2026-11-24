import { z } from 'zod';
import {
  ADJUSTMENT_REASONS,
  BUSINESS_TYPES,
  PAYMENT_METHODS,
  PLAN_FEATURES,
} from './enums';
import { MONEY_REGEX, QTY_REGEX } from './money';
import { isValidPhone, toE164 } from './phone';
import { ALL_PERMISSIONS } from './permissions';

// ---------- primitives ----------
export const money = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => MONEY_REGEX.test(v), 'Enter a valid amount (max 2 decimals)');
export const nonNegMoney = money.refine((v) => !v.startsWith('-'), 'Amount cannot be negative');
export const qty = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => QTY_REGEX.test(v) && Number(v) > 0, 'Enter a valid quantity');
export const percent = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => /^\d{1,3}(\.\d{1,2})?$/.test(v) && Number(v) <= 100, 'Enter 0 to 100');

export const phone = z
  .string()
  .trim()
  .refine(isValidPhone, 'Enter a valid phone number (e.g. 01712345678 or +44...)')
  .transform(toE164);
export const optionalPhone = z
  .union([phone, z.literal('')])
  .optional()
  .transform((v) => (v ? v : undefined));
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === '' ? undefined : v));
const optionalEmail = z
  .union([z.string().trim().toLowerCase().email(), z.literal('')])
  .optional()
  .transform((v) => (v ? v : undefined));
export const id = z.string().min(1).max(40);
export const isoDate = z.coerce.date();

export const password = z
  .string()
  .min(8, 'At least 8 characters')
  .max(128)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Use letters and numbers');

// ---------- pagination ----------
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  sort: z.string().max(40).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export const dateRangeSchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
});

// ---------- auth ----------
export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password,
  businessName: z.string().trim().min(2).max(120),
  businessType: z.enum(BUSINESS_TYPES).default('RETAIL'),
  phone: optionalPhone,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().email() });
export const resetPasswordSchema = z.object({ token: z.string().min(20).max(200), password });
export const verifyEmailSchema = z.object({ token: z.string().min(20).max(200) });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: password });
export const switchTenantSchema = z.object({ tenantId: id });
export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: optionalPhone,
});

// ---------- tenant ----------
export const createTenantSchema = z.object({
  name: z.string().trim().min(2).max(120),
  businessType: z.enum(BUSINESS_TYPES).default('RETAIL'),
});
export const tenantSettingsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  businessType: z.enum(BUSINESS_TYPES),
  email: optionalEmail,
  phone: optionalPhone,
  address: optionalText(300),
  taxId: optionalText(40),
  currency: z.string().length(3).toUpperCase().default('BDT'),
  timezone: z
    .string()
    .max(60)
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'Unknown time zone')
    .default('Asia/Dhaka'),
  invoicePrefix: z
    .string()
    .trim()
    .regex(/^[A-Z0-9-]{1,10}$/, 'Uppercase letters, numbers and dashes only')
    .default('INV'),
  invoiceFooter: optionalText(300),
  defaultTaxRate: percent.default('0'),
  allowNegativeStock: z.boolean().default(false),
  lowStockEmail: z.boolean().default(true),
});
export type TenantSettingsInput = z.infer<typeof tenantSettingsSchema>;

// ---------- employees / roles ----------
export const inviteEmployeeSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  roleId: id,
});
export const updateMembershipSchema = z.object({
  roleId: id.optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
});
export const roleSchema = z.object({
  name: z.string().trim().min(2).max(40),
  description: optionalText(200),
  permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).min(1),
});

// ---------- inventory ----------
export const categorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: optionalText(200),
});
export const productSchema = z.object({
  name: z.string().trim().min(1).max(160),
  sku: z
    .string()
    .trim()
    .max(60)
    .regex(/^[A-Za-z0-9._-]*$/, 'Letters, numbers, dot, dash, underscore')
    .optional()
    .transform((v) => (v ? v.toUpperCase() : undefined)),
  barcode: optionalText(64),
  categoryId: id.optional().nullable(),
  unit: z.string().trim().min(1).max(20).default('pcs'),
  purchasePrice: nonNegMoney,
  sellingPrice: nonNegMoney,
  taxRate: percent.default('0'),
  minStock: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .refine((v) => QTY_REGEX.test(v), 'Invalid threshold')
    .default('0'),
  openingStock: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .refine((v) => QTY_REGEX.test(v), 'Invalid stock')
    .optional(),
  description: optionalText(1000),
  imageId: id.optional().nullable(),
});
export type ProductInput = z.infer<typeof productSchema>;
export const productUpdateSchema = productSchema.omit({ openingStock: true }).partial();
export const productListQuerySchema = listQuerySchema.extend({
  categoryId: z.string().optional(),
  stock: z.enum(['all', 'low', 'out']).default('all'),
  archived: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});
export const bulkProductActionSchema = z.object({
  ids: z.array(id).min(1).max(200),
  action: z.enum(['archive', 'restore', 'setCategory']),
  categoryId: id.optional().nullable(),
});

export const stockAdjustmentSchema = z.object({
  productId: id,
  direction: z.enum(['IN', 'OUT']),
  quantity: qty,
  reason: z.enum(ADJUSTMENT_REASONS),
  note: optionalText(300),
});

// ---------- parties ----------
export const customerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: optionalPhone,
  email: optionalEmail,
  address: optionalText(300),
  notes: optionalText(500),
});
export const supplierSchema = customerSchema.extend({
  company: optionalText(120),
});

// ---------- payments ----------
export const paymentLineSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  amount: nonNegMoney,
  reference: optionalText(80),
});

// ---------- sales ----------
export const saleItemInputSchema = z.object({
  productId: id,
  quantity: qty,
  unitPrice: nonNegMoney.optional(),
  discount: nonNegMoney.default('0'),
});
export const createSaleSchema = z.object({
  customerId: id.optional().nullable(),
  items: z.array(saleItemInputSchema).min(1).max(200),
  discount: nonNegMoney.default('0'),
  taxRate: percent.optional(),
  payments: z.array(paymentLineSchema).max(5).default([]),
  note: optionalText(300),
  idempotencyKey: z.string().min(8).max(64).optional(),
});
export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const refundSaleSchema = z.object({
  items: z.array(z.object({ saleItemId: id, quantity: qty })).min(1),
  method: z.enum(PAYMENT_METHODS).default('CASH'),
  reason: optionalText(300),
});
export const cancelSchema = z.object({ reason: optionalText(300) });

export const receivePaymentSchema = paymentLineSchema.extend({
  note: optionalText(200),
});

export const salesListQuerySchema = listQuerySchema.extend({
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  customerId: z.string().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

// ---------- purchases ----------
export const purchaseItemInputSchema = z.object({
  productId: id,
  quantity: qty,
  unitCost: nonNegMoney,
});
export const createPurchaseSchema = z.object({
  supplierId: id,
  reference: optionalText(60),
  purchaseDate: isoDate.optional(),
  items: z.array(purchaseItemInputSchema).min(1).max(200),
  discount: nonNegMoney.default('0'),
  shippingCost: nonNegMoney.default('0'),
  payments: z.array(paymentLineSchema).max(5).default([]),
  note: optionalText(300),
});

// ---------- expenses ----------
export const expenseCategorySchema = categorySchema;
export const expenseSchema = z.object({
  categoryId: id,
  amount: nonNegMoney.refine((v) => Number(v) > 0, 'Amount must be greater than zero'),
  method: z.enum(PAYMENT_METHODS).default('CASH'),
  description: optionalText(300),
  expenseDate: isoDate,
  reference: optionalText(60),
});
export const expenseListQuerySchema = listQuerySchema.extend({
  categoryId: z.string().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

// ---------- reports ----------
export const reportQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  period: z.enum(['daily', 'weekly', 'monthly', 'annual']).optional(),
  format: z.enum(['json', 'csv', 'pdf']).default('json'),
});

// ---------- subscription / admin ----------
export const planSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_]{2,20}$/),
  name: z.string().trim().min(2).max(40),
  description: optionalText(300),
  priceMonthly: nonNegMoney,
  priceYearly: nonNegMoney,
  currency: z.string().length(3).default('BDT'),
  maxProducts: z.number().int().min(-1),
  maxEmployees: z.number().int().min(-1),
  trialDays: z.number().int().min(0).max(90).default(0),
  features: z.array(z.enum(PLAN_FEATURES)).default([]),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});
export const changePlanSchema = z.object({
  planCode: z.string().min(2).max(20),
  interval: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY'),
  provider: z.enum(['manual', 'sslcommerz']).default('manual'),
});
export const tenantStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
  reason: optionalText(300),
});
export const announcementSchema = z.object({
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(2).max(2000),
  level: z.enum(['INFO', 'WARNING', 'CRITICAL']).default('INFO'),
  isActive: z.boolean().default(true),
});
export const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  message: z.string().trim().min(10).max(2000),
});
