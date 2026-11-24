import { createHash } from 'node:crypto';
import { SslCommerzProvider } from './sslcommerz.provider';

const md5 = (s: string) => createHash('md5').update(s).digest('hex');

describe('SslCommerzProvider.verifySignature', () => {
  const values: Record<string, unknown> = { SSLCOMMERZ_STORE_PASSWORD: 'store-secret', SSLCOMMERZ_SANDBOX: true };
  const config = { get: (k: string) => values[k] } as any;
  const provider = new SslCommerzProvider(config);

  function signed(body: Record<string, string>) {
    const keys = Object.keys(body);
    const params: Record<string, string> = { ...body, store_passwd: md5('store-secret') };
    const data = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
    return { ...body, verify_key: keys.join(','), verify_sign: md5(data) };
  }

  it('accepts an authentic IPN', () => {
    expect(provider.verifySignature(signed({ tran_id: 'HK1', val_id: 'V1', amount: '499.00', status: 'VALID' }))).toBe(true);
  });

  it('rejects a tampered IPN', () => {
    const body = signed({ tran_id: 'HK1', val_id: 'V1', amount: '499.00', status: 'VALID' });
    expect(provider.verifySignature({ ...body, amount: '1.00' })).toBe(false);
    expect(provider.verifySignature({ ...body, verify_sign: '' })).toBe(false);
  });
});
