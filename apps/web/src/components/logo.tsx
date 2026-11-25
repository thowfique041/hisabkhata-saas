import { cn } from '@/lib/utils';

/** The HisabKhata mark: two ledger columns joined by a rising emerald bar. */
export function LogoMark({ className, inverted }: { className?: string; inverted?: boolean }) {
  // `inverted` is for the always-dark app sidebar. Elsewhere the tile follows the colour scheme:
  // navy on light pages, white on dark pages, so it never disappears into the background.
  const tile = inverted ? 'fill-white' : 'fill-navy dark:fill-white';
  const ink = inverted ? 'fill-navy' : 'fill-white dark:fill-navy';
  const rule = inverted
    ? 'fill-[#3B6FC4] opacity-45'
    : 'fill-sky-soft opacity-55 dark:fill-[#3B6FC4] dark:opacity-45';
  return (
    <svg viewBox="0 0 64 64" className={cn('size-7 shrink-0', className)} aria-hidden>
      <rect width="64" height="64" rx="14" className={tile} />
      <rect x="14" y="47" width="36" height="2.5" rx="1.25" className={rule} />
      <rect x="16" y="22" width="8" height="22" rx="2" className={ink} />
      <rect x="40" y="13" width="8" height="31" rx="2" className={ink} />
      <path d="M22.5 35.5 L41.5 26.5 L41.5 33.2 L22.5 42.2 Z" fill="#10B981" />
    </svg>
  );
}

export function Logo({ className, onDark }: { className?: string; onDark?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark inverted={onDark} />
      <span className="text-[17px] tracking-tight">
        <span className={cn('font-semibold', onDark ? 'text-white' : 'text-navy dark:text-white')}>
          Hisab
        </span>
        <span
          className={cn(
            'font-medium',
            onDark ? 'text-[#34D399]' : 'text-emerald dark:text-[#34D399]',
          )}
        >
          Khata
        </span>
      </span>
    </span>
  );
}
