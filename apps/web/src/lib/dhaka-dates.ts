/**
 * Calendar maths in Bangladesh time. A shop's "today" is Dhaka's today, whatever timezone the
 * browser is set to, so presets and day boundaries are computed here and sent as exact instants.
 */
export const DHAKA_TZ = 'Asia/Dhaka';
const OFFSET = '+06:00'; // Bangladesh has no daylight saving.

/** YYYY-MM-DD for the given instant in Dhaka. */
export function dhakaDay(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: DHAKA_TZ }).format(d);
}

function shift(day: string, days: number) {
  const d = new Date(`${day}T12:00:00${OFFSET}`);
  d.setUTCDate(d.getUTCDate() + days);
  return dhakaDay(d);
}

export type RangePreset =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'custom';

export interface DateRange {
  preset: RangePreset;
  /** Inclusive Dhaka calendar days, YYYY-MM-DD. Empty for "all". */
  from?: string;
  to?: string;
}

export function presetRange(preset: RangePreset, now = new Date()): DateRange {
  const today = dhakaDay(now);
  const [y, m] = today.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  switch (preset) {
    case 'today':
      return { preset, from: today, to: today };
    case 'yesterday': {
      const d = shift(today, -1);
      return { preset, from: d, to: d };
    }
    case 'last7':
      return { preset, from: shift(today, -6), to: today };
    case 'last30':
      return { preset, from: shift(today, -29), to: today };
    case 'thisMonth':
      return { preset, from: `${y}-${pad(m)}-01`, to: today };
    case 'lastMonth': {
      const ly = m === 1 ? y - 1 : y;
      const lm = m === 1 ? 12 : m - 1;
      const last = shift(`${y}-${pad(m)}-01`, -1);
      return { preset, from: `${ly}-${pad(lm)}-01`, to: last };
    }
    case 'thisYear':
      return { preset, from: `${y}-01-01`, to: today };
    default:
      return { preset: 'all' };
  }
}

/** Exact instants for the API: start of the first day to the end of the last, Dhaka time. */
export function rangeToQuery(r: DateRange): { from?: string; to?: string } {
  return {
    from: r.from ? new Date(`${r.from}T00:00:00${OFFSET}`).toISOString() : undefined,
    to: r.to ? new Date(`${r.to}T23:59:59.999${OFFSET}`).toISOString() : undefined,
  };
}

/** "3 Nov to 9 Nov 2026" style label for a custom range. */
export function formatRangeLabel(r: DateRange, locale: 'en' | 'bn') {
  if (!r.from && !r.to) return '';
  const fmt = (day: string, withYear: boolean) =>
    new Intl.DateTimeFormat(locale === 'bn' ? 'bn-BD' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' } : {}),
      timeZone: DHAKA_TZ,
    }).format(new Date(`${day}T12:00:00${OFFSET}`));
  const join = locale === 'bn' ? ' থেকে ' : ' to ';
  if (r.from && r.to)
    return r.from === r.to ? fmt(r.from, true) : fmt(r.from, false) + join + fmt(r.to, true);
  return fmt((r.from ?? r.to)!, true);
}
