/**
 * Integer arithmetic for on-screen previews (cart totals). Amounts are kept in paisa and
 * quantities in thousandths so no floating-point error can creep in. The API recomputes
 * everything with PostgreSQL decimals and is the source of truth.
 */
export function toPaisa(v: string | number | null | undefined): number {
  const s = String(v ?? '0').trim() || '0';
  const neg = s.startsWith('-');
  const [i, f = ''] = s.replace('-', '').split('.');
  const n = Number(i || '0') * 100 + Number((f + '00').slice(0, 2));
  return neg ? -n : n;
}

export function toMilli(v: string | number): number {
  const [i, f = ''] = String(v || '0').split('.');
  return Number(i || '0') * 1000 + Number((f + '000').slice(0, 3));
}

export function fromPaisa(p: number): string {
  const neg = p < 0;
  const a = Math.abs(Math.round(p));
  return `${neg ? '-' : ''}${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`;
}

/** Half-up division for non-negative integers. */
export function divRound(a: number, b: number) {
  return Math.floor((a * 2 + b) / (2 * b));
}

export function lineTotal(qty: string, price: string, discount: string) {
  return divRound(toMilli(qty) * toPaisa(price), 1000) - toPaisa(discount);
}

/** rate is a percentage string like "5" or "7.5" */
export function percentOf(amountPaisa: number, rate: string) {
  return divRound(amountPaisa * toPaisa(rate), 10000);
}
