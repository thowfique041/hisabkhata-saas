import { cn } from '@/lib/utils';

/** The HisabKhata mark: two ledger columns joined by a rising emerald bar. */
export function LogoMark({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-7 shrink-0', className)} aria-hidden>
      <rect width="64" height="64" rx="14" fill={inverted ? '#FFFFFF' : '#0F1E3D'} />
      <rect x="14" y="47" width="36" height="2.5" rx="1.25" fill={inverted ? '#3B6FC4' : '#7FA7E6'} opacity={inverted ? 0.45 : 0.55} />
      <rect x="16" y="22" width="8" height="22" rx="2" fill={inverted ? '#0F1E3D' : '#FFFFFF'} />
      <rect x="40" y="13" width="8" height="31" rx="2" fill={inverted ? '#0F1E3D' : '#FFFFFF'} />
      <path d="M22.5 35.5 L41.5 26.5 L41.5 33.2 L22.5 42.2 Z" fill="#10B981" />
    </svg>
  );
}

export function Logo({ className, onDark }: { className?: string; onDark?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark inverted={onDark} />
      <span className="text-[17px] tracking-tight">
        <span className={cn('font-semibold', onDark ? 'text-white' : 'text-navy dark:text-white')}>Hisab</span>
        <span className={cn('font-medium', onDark ? 'text-[#34D399]' : 'text-emerald dark:text-[#34D399]')}>Khata</span>
      </span>
    </span>
  );
}
