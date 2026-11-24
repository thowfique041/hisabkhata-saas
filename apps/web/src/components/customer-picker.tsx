'use client';
import * as React from 'react';
import { UserPlus, X } from 'lucide-react';
import { useApi, useAction } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/money';

export function CustomerPicker({ value, onChange }: { value: any | null; onChange: (c: any | null) => void }) {
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [debounced, setDebounced] = React.useState('');
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);
  const { data } = useApi<any>(open ? '/customers' : null, { search: debounced, pageSize: 6 });
  const quickAdd = useAction((name: string) => api('/customers', { method: 'POST', body: /^[+\d\s-]{7,}$/.test(name) ? { name: 'Customer ' + name.slice(-4), phone: name } : { name } }), {
    success: 'Customer added',
    invalidate: [['/customers']],
    onSuccess: (c) => {
      onChange(c);
      setQ('');
      setOpen(false);
    },
  });

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md border bg-surface px-3 py-2 text-sm">
        <div className="min-w-0">
          <p className="truncate font-medium">{value.name}</p>
          <p className="text-xs text-muted-foreground">
            {value.phone ?? 'No phone'}
            {value.outstanding && Number(value.outstanding) > 0 && (
              <>
                , owes <Money value={value.outstanding} signed="negative" />
              </>
            )}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onChange(null)} aria-label="Remove customer">
          <X />
        </Button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Input
        value={q}
        placeholder="Walk-in customer, or search name or phone"
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Customer"
      />
      {open && (
        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border bg-surface py-1 text-sm shadow-lg">
          {data?.items.map((c: any) => (
            <li
              key={c.id}
              className="cursor-pointer px-3 py-2 hover:bg-muted"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(c);
                setQ('');
                setOpen(false);
              }}
            >
              <span className="font-medium">{c.name}</span> <span className="text-xs text-muted-foreground">{c.phone}</span>
            </li>
          ))}
          {q.trim().length >= 2 && (
            <li
              className="flex cursor-pointer items-center gap-2 border-t px-3 py-2 text-muted-foreground hover:bg-muted"
              onMouseDown={(e) => {
                e.preventDefault();
                quickAdd.mutate(q.trim());
              }}
            >
              <UserPlus className="size-4" /> Add “{q.trim()}” as a new customer
            </li>
          )}
          {!data?.items.length && q.trim().length < 2 && <li className="px-3 py-2 text-muted-foreground">Type a name or phone number</li>}
        </ul>
      )}
    </div>
  );
}
