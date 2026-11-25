'use client';
import * as React from 'react';
import { useI18n, useSetLocale } from '@/lib/i18n/client';
import type { Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const OPTIONS: { value: Locale; label: string; full: string }[] = [
  { value: 'en', label: 'EN', full: 'English' },
  { value: 'bn', label: 'বাং', full: 'বাংলা' },
];

/** Two-option toggle. Each option is labelled in its own language so either reader can find it. */
export function LanguageSwitcher({
  className,
  size = 'sm',
}: {
  className?: string;
  size?: 'sm' | 'md';
}) {
  const { locale, t } = useI18n();
  const setLocale = useSetLocale();
  return (
    <div
      role="radiogroup"
      aria-label={t.prefs.language}
      className={cn('inline-flex rounded-md border bg-surface p-0.5', className)}
    >
      {OPTIONS.map((o) => {
        const active = o.value === locale;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.full}
            lang={o.value}
            onClick={() => !active && setLocale(o.value)}
            className={cn(
              'rounded px-2 font-medium transition-colors',
              size === 'sm' ? 'h-7 text-xs' : 'h-9 px-3 text-sm',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {size === 'md' ? o.full : o.label}
          </button>
        );
      })}
    </div>
  );
}
