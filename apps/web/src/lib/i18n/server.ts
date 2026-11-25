import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, getDictionary, isLocale, LOCALE_COOKIE, type Locale } from './index';

/** The visitor's language: their saved choice, else a Bangla browser, else English. */
export async function getLocale(): Promise<Locale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  const accept = (await headers()).get('accept-language') ?? '';
  return /^bn\b/i.test(accept.trim()) ? 'bn' : DEFAULT_LOCALE;
}

export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: getDictionary(locale) };
}
