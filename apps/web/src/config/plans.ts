/**
 * Plan catalogue shown on the marketing site. It mirrors the plans seeded by
 * `apps/api/prisma/seed.ts`, so pricing renders even when the API is asleep or down.
 * When the API answers, its `/api/plans` response replaces these values.
 * If you change a price in the admin panel, update it here too.
 */

export type PlanFeature =
  'ADVANCED_REPORTS' | 'ADVANCED_ANALYTICS' | 'PRIORITY_SUPPORT' | 'INVOICE_EMAIL';

export interface PublicPlan {
  code: 'FREE' | 'BASIC' | 'PREMIUM' | string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  /** -1 means unlimited. */
  maxProducts: number;
  /** -1 means unlimited. */
  maxEmployees: number;
  features: PlanFeature[] | string[];
}

export const STATIC_PLANS: PublicPlan[] = [
  {
    code: 'FREE',
    name: 'Free',
    description: 'For a single shop getting started.',
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'BDT',
    maxProducts: 50,
    maxEmployees: 1,
    features: [],
  },
  {
    code: 'BASIC',
    name: 'Basic',
    description: 'For growing shops with a small team.',
    priceMonthly: 499,
    priceYearly: 4990,
    currency: 'BDT',
    maxProducts: 500,
    maxEmployees: 5,
    features: ['ADVANCED_REPORTS', 'INVOICE_EMAIL'],
  },
  {
    code: 'PREMIUM',
    name: 'Premium',
    description: 'For wholesalers, distributors and multi-counter stores.',
    priceMonthly: 1499,
    priceYearly: 14990,
    currency: 'BDT',
    maxProducts: -1,
    maxEmployees: -1,
    features: ['ADVANCED_REPORTS', 'ADVANCED_ANALYTICS', 'PRIORITY_SUPPORT', 'INVOICE_EMAIL'],
  },
];

/** The plan we point most visitors to. */
export const POPULAR_PLAN = 'BASIC';

/** Normalises an `/api/plans` row (Decimal strings) into the static shape. */
export function toPublicPlan(row: any): PublicPlan {
  return {
    code: String(row.code),
    name: String(row.name),
    description: String(row.description ?? ''),
    priceMonthly: Number(row.priceMonthly),
    priceYearly: Number(row.priceYearly),
    currency: String(row.currency ?? 'BDT'),
    maxProducts: Number(row.maxProducts),
    maxEmployees: Number(row.maxEmployees),
    features: Array.isArray(row.features) ? row.features : [],
  };
}
