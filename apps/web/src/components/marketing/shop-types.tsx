import { Pill, ShoppingBasket, Smartphone, Truck, Warehouse } from 'lucide-react';
import type { Dictionary } from '@/lib/i18n';

const TYPES = [
  ['grocery', ShoppingBasket],
  ['pharmacy', Pill],
  ['electronics', Smartphone],
  ['wholesale', Warehouse],
  ['distributor', Truck],
] as const;

export function ShopTypes({ labels }: { labels: Dictionary['home']['shopTypes'] }) {
  return (
    <ul className="mt-6 flex flex-wrap gap-2">
      {TYPES.map(([key, Icon]) => (
        <li
          key={key}
          className="inline-flex items-center gap-2 rounded-full border bg-surface px-3 py-1.5 text-sm shadow-sm"
        >
          <Icon className="size-4 text-emerald" aria-hidden />
          {labels[key]}
        </li>
      ))}
    </ul>
  );
}
