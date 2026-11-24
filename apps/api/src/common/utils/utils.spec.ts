import { formatMoney, isValidPhone, toE164, createSaleSchema } from '@hisabkhata/shared';
import { dec, money, paymentStatusFor, pct } from './decimal';
import { toCsv } from './csv';
import { sniffImage } from '../../modules/files/storage.service';

describe('money helpers', () => {
  it('formats BDT with South Asian grouping without floating point', () => {
    expect(formatMoney('1234567.5')).toBe('৳12,34,567.50');
    expect(formatMoney('-950')).toBe('-৳950.00');
    expect(formatMoney('0.1')).toBe('৳0.10');
    expect(formatMoney('1234567.5', 'USD')).toBe('$1,234,567.50');
  });

  it('does decimal arithmetic exactly', () => {
    expect(dec('0.1').plus('0.2').toString()).toBe('0.3');
    expect(money('2.005').toFixed(2)).toBe('2.01');
    expect(pct('330', '5').toFixed(2)).toBe('16.50');
  });

  it('derives payment status', () => {
    expect(paymentStatusFor(dec(100), dec(100))).toBe('PAID');
    expect(paymentStatusFor(dec(100), dec(40))).toBe('PARTIAL');
    expect(paymentStatusFor(dec(100), dec(0))).toBe('DUE');
  });
});

describe('phone validation', () => {
  it('accepts Bangladesh mobiles in any common form and international E.164', () => {
    expect(isValidPhone('01712345678')).toBe(true);
    expect(isValidPhone('+880 1712-345678')).toBe(true);
    expect(isValidPhone('+447700900123')).toBe(true);
    expect(isValidPhone('01212345678')).toBe(false);
    expect(toE164('01712345678')).toBe('+8801712345678');
  });
});

describe('shared schemas', () => {
  it('rejects money with more than 2 decimals and empty carts', () => {
    expect(createSaleSchema.safeParse({ items: [] }).success).toBe(false);
    const bad = createSaleSchema.safeParse({ items: [{ productId: 'p1', quantity: '1' }], discount: '1.001' });
    expect(bad.success).toBe(false);
  });
});

describe('csv', () => {
  it('escapes quotes and neutralises spreadsheet formulas', () => {
    const out = toCsv(['a', 'b'], [['=HYPERLINK("x")', 'say "hi"'], ['-12.5', '@cmd']]);
    expect(out).toContain(`"'=HYPERLINK(""x"")"`);
    expect(out).toContain('-12.5');
    expect(out).toContain("'@cmd");
  });
});

describe('upload sniffing', () => {
  it('detects real image types from magic bytes', () => {
    expect(sniffImage(Buffer.from('89504e470d0a1a0a00000000', 'hex'))?.mime).toBe('image/png');
    expect(sniffImage(Buffer.from('ffd8ffe000104a464946', 'hex'))?.mime).toBe('image/jpeg');
    expect(sniffImage(Buffer.from('<svg onload=alert(1)>'))).toBeNull();
  });
});
