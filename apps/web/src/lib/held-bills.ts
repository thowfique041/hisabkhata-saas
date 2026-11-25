'use client';
import { useLocalState } from './local-store';

/**
 * Held (parked) bills live in localStorage, keyed by business, on this device only.
 * They never touch stock or the server: a held bill is just a cart someone will come back to.
 * See docs/panel-upgrade-report.md for why this is local rather than a backend model.
 */
export interface HeldLine {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  price: string;
  stock: string;
  quantity: string;
  discount: string;
}
export interface HeldBill {
  id: string;
  label: string;
  createdAt: string;
  lines: HeldLine[];
  customer: { id: string; name: string; phone?: string | null; outstanding?: string | null } | null;
  discount: string;
  taxRate: string | null;
}

const MAX_HELD = 20;

export function useHeldBills(tenantId: string | undefined) {
  const [bills, setBills] = useLocalState<HeldBill[]>(tenantId ? `hk_held:${tenantId}` : null, []);
  return {
    bills,
    hold: (b: Omit<HeldBill, 'id' | 'createdAt'>) =>
      setBills((prev) =>
        [
          {
            ...b,
            id: Math.random().toString(36).slice(2, 10),
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, MAX_HELD),
      ),
    remove: (id: string) => setBills((prev) => prev.filter((b) => b.id !== id)),
  };
}
