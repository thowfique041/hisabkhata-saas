export const PAYMENT_METHODS = ['CASH', 'CARD', 'BKASH', 'NAGAD', 'ROCKET', 'BANK', 'OTHER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  BKASH: 'bKash',
  NAGAD: 'Nagad',
  ROCKET: 'Rocket',
  BANK: 'Bank transfer',
  OTHER: 'Other',
};

export const PAYMENT_STATUSES = ['PAID', 'PARTIAL', 'DUE'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const SALE_STATUSES = ['COMPLETED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

export const PURCHASE_STATUSES = ['RECEIVED', 'CANCELLED'] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export const STOCK_MOVEMENT_TYPES = [
  'OPENING',
  'PURCHASE',
  'SALE',
  'SALE_RETURN',
  'PURCHASE_CANCEL',
  'SALE_CANCEL',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const ADJUSTMENT_REASONS = ['DAMAGE', 'EXPIRED', 'LOST', 'FOUND', 'RECOUNT', 'OTHER'] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

export const SUBSCRIPTION_STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const TENANT_STATUSES = ['ACTIVE', 'SUSPENDED'] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const USER_STATUSES = ['ACTIVE', 'DISABLED'] as const;

export const BUSINESS_TYPES = [
  'RETAIL',
  'GROCERY',
  'PHARMACY',
  'ELECTRONICS',
  'WHOLESALE',
  'DISTRIBUTOR',
  'OTHER',
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const PRODUCT_UNITS = ['pcs', 'kg', 'g', 'litre', 'ml', 'box', 'pack', 'dozen', 'strip', 'metre'] as const;

export const PLAN_FEATURES = ['ADVANCED_REPORTS', 'ADVANCED_ANALYTICS', 'PRIORITY_SUPPORT', 'INVOICE_EMAIL'] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number];
