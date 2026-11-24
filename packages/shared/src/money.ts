/**
 * Money values travel over the wire as decimal strings (e.g. "1250.50"),
 * never as JS floats. Arithmetic happens on the server with Prisma.Decimal.
 * These helpers only format for display.
 */
export const DEFAULT_CURRENCY = 'BDT';
export const DEFAULT_TIMEZONE = 'Asia/Dhaka';
export const DEFAULT_LOCALE = 'en-BD';

/** Decimal string with up to 2 fraction digits, optional leading minus. */
export const MONEY_REGEX = /^-?\d{1,12}(\.\d{1,2})?$/;
/** Quantity: up to 3 fraction digits (kg, litre). */
export const QTY_REGEX = /^\d{1,9}(\.\d{1,3})?$/;

const SYMBOLS: Record<string, string> = { BDT: '৳', USD: '$', EUR: '€', INR: '₹', GBP: '£' };

export function currencySymbol(currency = DEFAULT_CURRENCY): string {
  return SYMBOLS[currency] ?? currency + ' ';
}

/**
 * Formats a decimal string with South Asian digit grouping for BDT/INR
 * (1,23,45,678.00) and western grouping otherwise. Pure string math, no floats.
 */
export function formatMoney(
  value: string | number | null | undefined,
  currency = DEFAULT_CURRENCY,
): string {
  const raw = value === null || value === undefined || value === '' ? '0' : String(value);
  const negative = raw.trim().startsWith('-');
  const unsigned = raw.replace('-', '').trim();
  const [intPartRaw, fracRaw = ''] = unsigned.split('.');
  const intPart = (intPartRaw || '0').replace(/^0+(?=\d)/, '');
  const frac = (fracRaw + '00').slice(0, 2);
  const grouped =
    currency === 'BDT' || currency === 'INR' ? groupSouthAsian(intPart) : groupWestern(intPart);
  return `${negative ? '-' : ''}${currencySymbol(currency)}${grouped}.${frac}`;
}

function groupWestern(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function groupSouthAsian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
}

export function formatQty(value: string | number): string {
  const s = String(value);
  if (!s.includes('.')) return s;
  return s.replace(/\.?0+$/, '');
}
