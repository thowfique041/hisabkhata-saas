import { Prisma } from '../../generated/prisma/client';

export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;
type DecValue = string | number | Prisma.Decimal;

// All money math is done with decimal.js under the hood; round half-up to 2 dp.
Prisma.Decimal.set({ precision: 30, rounding: Prisma.Decimal.ROUND_HALF_UP });

export const ZERO = new Prisma.Decimal(0);

export function dec(v: DecValue | null | undefined): Prisma.Decimal {
  if (v === null || v === undefined || v === '') return new Prisma.Decimal(0);
  return new Prisma.Decimal(v);
}

export function money(v: DecValue): Prisma.Decimal {
  return dec(v).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function qty(v: DecValue): Prisma.Decimal {
  return dec(v).toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP);
}

export function sum(values: DecValue[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>((acc, v) => acc.plus(dec(v)), new Prisma.Decimal(0));
}

/** Percentage of an amount, rounded to 2 dp. */
export function pct(amount: DecValue, rate: DecValue): Prisma.Decimal {
  return money(dec(amount).times(dec(rate)).dividedBy(100));
}

export function minDec(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
  return a.lessThan(b) ? a : b;
}

export function paymentStatusFor(total: Prisma.Decimal, paid: Prisma.Decimal): 'PAID' | 'PARTIAL' | 'DUE' {
  if (paid.greaterThanOrEqualTo(total)) return 'PAID';
  if (paid.greaterThan(0)) return 'PARTIAL';
  return 'DUE';
}
