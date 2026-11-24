'use client';
import * as React from 'react';
import { Search } from 'lucide-react';
import { formatQty } from '@hisabkhata/shared';
import { useApi } from '@/hooks/use-api';
import { Money } from '@/components/money';
import { Input } from '@/components/ui/input';

/** Type-ahead product search; Enter picks an exact barcode/SKU match or the first result. */
export function ProductPicker({ onPick, placeholder = 'Search by name, SKU or barcode', autoFocus }: { onPick: (p: any) => void; placeholder?: string; autoFocus?: boolean }) {
  const [q, setQ] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);
  const { data } = useApi<any>(debounced ? '/products' : null, { search: debounced, pageSize: 8 });
  const items: any[] = data?.items ?? [];
  const pick = (p: any) => {
    onPick(p);
    setQ('');
    setOpen(false);
  };
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className="pl-8"
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-autocomplete="list"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, items.length - 1));
          if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
          if (e.key === 'Enter') {
            e.preventDefault();
            const exact = items.find((p) => p.barcode === q.trim() || p.sku === q.trim().toUpperCase());
            if (exact || items[active]) pick(exact ?? items[active]);
          }
        }}
      />
      {open && items.length > 0 && (
        <ul role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-surface py-1 shadow-lg">
          {items.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm ${i === active ? 'bg-muted' : ''}`}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">
                  {p.sku}, {formatQty(p.stock)} {p.unit} in stock
                </span>
              </span>
              <Money value={p.sellingPrice} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
