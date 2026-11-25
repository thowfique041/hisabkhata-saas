import { en, type Dictionary } from './en';
import { bn } from './bn';

export type Locale = 'en' | 'bn';
export const LOCALES: Locale[] = ['en', 'bn'];
export const DEFAULT_LOCALE: Locale = 'en';
/** Cookie that remembers the visitor's language for a year. */
export const LOCALE_COOKIE = 'hk_lang';

export function isLocale(v: unknown): v is Locale {
  return v === 'en' || v === 'bn';
}

export function getDictionary(locale: Locale): Dictionary {
  return locale === 'bn' ? bn : en;
}

/**
 * Turns validation and API messages into friendly text in the current language.
 * Handles zod's default English messages by pattern and our own messages by exact text.
 */
export function translateMessage(
  t: Dictionary,
  message: string | null | undefined,
): string | undefined {
  if (!message) return undefined;
  if (t.validation.known[message]) return t.validation.known[message];
  if (message === 'Required') return t.validation.required;
  if (message === 'Invalid email') return t.validation.email;
  if (message === 'Passwords do not match') return t.validation.mismatch;
  const min = message.match(/at least (\d+) character/);
  if (min) return Number(min[1]) <= 1 ? t.validation.required : t.validation.min(Number(min[1]));
  const max = message.match(/at most (\d+) character/);
  if (max) return t.validation.max(Number(max[1]));
  return message;
}

export type { Dictionary };
export { toBnDigits } from './bn';
