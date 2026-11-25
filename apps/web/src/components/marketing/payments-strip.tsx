import { Banknote, CreditCard, Landmark, Wallet } from 'lucide-react';
import type { Dictionary } from '@/lib/i18n';

// Text badges only: no third-party logos are copied into this repo.
const METHODS = [
  ['cash', Banknote],
  ['bkash', Wallet],
  ['nagad', Wallet],
  ['rocket', Wallet],
  ['card', CreditCard],
  ['bank', Landmark],
] as const;

export function PaymentsStrip({
  label,
  names,
}: {
  label: string;
  names: Dictionary['home']['payments'];
}) {
  return (
    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
      <p className="shrink-0 text-sm font-medium text-muted-foreground">{label}</p>
      <ul className="flex flex-wrap gap-2" aria-label={label}>
        {METHODS.map(([key, Icon]) => (
          <li
            key={key}
            className="inline-flex items-center gap-1.5 rounded-md border bg-surface px-2.5 py-1 text-sm font-medium"
          >
            <Icon className="size-3.5 text-muted-foreground" aria-hidden />
            {names[key]}
          </li>
        ))}
      </ul>
    </div>
  );
}
