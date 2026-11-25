const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

/** Bangla numerals for counts in running text ("৫০টি পণ্য"). Amounts keep Latin digits with ৳. */
export function toBnDigits(n: number | string) {
  return String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}
