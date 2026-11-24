/**
 * Bangladesh mobile numbers: 01[3-9]XXXXXXXX, optionally prefixed by +880 / 880.
 * International numbers are accepted in E.164-ish form so foreign customers are not blocked.
 */
const BD_MOBILE = /^(?:\+?880|0)1[3-9]\d{8}$/;
const INTERNATIONAL = /^\+[1-9]\d{6,14}$/;

export function normalizePhone(input: string): string {
  return input.replace(/[\s\-()]/g, '');
}

export function isValidPhone(input: string): boolean {
  const n = normalizePhone(input);
  return BD_MOBILE.test(n) || INTERNATIONAL.test(n);
}

/** Returns +8801XXXXXXXXX for BD numbers, the cleaned input otherwise. */
export function toE164(input: string): string {
  const n = normalizePhone(input);
  if (/^01[3-9]\d{8}$/.test(n)) return '+88' + n;
  if (/^8801[3-9]\d{8}$/.test(n)) return '+' + n;
  return n;
}
