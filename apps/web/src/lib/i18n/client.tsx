'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  getDictionary,
  LOCALE_COOKIE,
  translateMessage,
  type Dictionary,
  type Locale,
} from './index';

const I18nContext = React.createContext<{ locale: Locale; t: Dictionary }>({
  locale: 'en',
  t: getDictionary('en'),
});

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = React.useMemo(() => ({ locale, t: getDictionary(locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = React.useContext(I18nContext);
  const tr = React.useCallback(
    (msg: string | null | undefined) => translateMessage(ctx.t, msg),
    [ctx.t],
  );
  return { ...ctx, tr };
}

/** Saves the language for a year and re-renders server components in it. */
export function useSetLocale() {
  const router = useRouter();
  return React.useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = next;
      router.refresh();
    },
    [router],
  );
}
