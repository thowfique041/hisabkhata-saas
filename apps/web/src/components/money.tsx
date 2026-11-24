'use client';
import { formatMoney } from '@hisabkhata/shared';
import { useSession } from '@/hooks/use-session';
import { cn } from '@/lib/utils';

/** Renders a decimal string as currency. Never converts to a float. */
export function Money({ value, signed, className, currency }: { value: string | number | null | undefined; signed?: 'positive' | 'negative' | 'auto'; className?: string; currency?: string }) {
  const { data } = useSession();
  const cur = currency ?? data?.activeTenant?.currency ?? 'BDT';
  const str = value === null || value === undefined ? '0' : String(value);
  const negative = str.trim().startsWith('-');
  const tone =
    signed === 'positive' ? 'text-positive' : signed === 'negative' ? 'text-negative' : signed === 'auto' ? (negative ? 'text-negative' : '') : '';
  return <span className={cn('num whitespace-nowrap', tone, className)}>{formatMoney(str, cur)}</span>;
}

export function useMoney() {
  const { data } = useSession();
  const cur = data?.activeTenant?.currency ?? 'BDT';
  return (v: string | number | null | undefined) => formatMoney(v === null || v === undefined ? '0' : String(v), cur);
}
