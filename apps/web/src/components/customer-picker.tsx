'use client';
import * as React from 'react';
import { UserPlus, X } from 'lucide-react';
import { useApi, useAction } from '@/hooks/use-api';
import { useCan } from '@/hooks/use-session';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field } from '@/components/ui/label';
import { Money } from '@/components/money';
import { cn } from '@/lib/utils';

const looksLikePhone = (s: string) => /^[+\d][\d\s-]{6,}$/.test(s.trim());

/** Add a customer without leaving the current screen; the typed text pre-fills name or phone. */
function QuickAddCustomer({
  seed,
  open,
  onOpenChange,
  onAdded,
}: {
  seed: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdded: (c: any) => void;
}) {
  const { t, tr } = useI18n();
  const c = t.panel.pos.customer;
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!open) return;
    setError(null);
    if (looksLikePhone(seed)) {
      setName('');
      setPhone(seed.trim());
    } else {
      setName(seed.trim());
      setPhone('');
    }
  }, [open, seed]);
  const create = useAction(
    () =>
      api('/customers', {
        method: 'POST',
        body: { name: name.trim(), phone: phone.trim() || undefined },
      }),
    {
      success: c.added,
      invalidate: [['/customers']],
      onSuccess: (customer) => {
        onAdded(customer);
        onOpenChange(false);
      },
    },
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent title={c.newTitle}>
          <form
            className="space-y-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) {
                setError(t.validation.required);
                return;
              }
              create.mutate(undefined, {
                onError: (err: any) => setError(tr(err?.message) ?? null),
              });
            }}
          >
            <Field label={t.panel.common.name} htmlFor="qc-name" error={error ?? undefined}>
              <Input
                id="qc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus={!name}
                autoComplete="off"
              />
            </Field>
            <Field
              label={`${t.panel.common.phone} (${t.panel.common.optional})`}
              htmlFor="qc-phone"
            >
              <Input
                id="qc-phone"
                type="tel"
                inputMode="tel"
                placeholder="01XXXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoFocus={!!name}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t.panel.common.cancel}
              </Button>
              <Button type="submit" loading={create.isPending}>
                <UserPlus /> {c.addAndUse}
              </Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

export function CustomerPicker({
  value,
  onChange,
  inputRef,
}: {
  value: any | null;
  onChange: (c: any | null) => void;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const { t } = useI18n();
  const c = t.panel.pos.customer;
  const can = useCan();
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [adding, setAdding] = React.useState(false);
  const [debounced, setDebounced] = React.useState('');
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(id);
  }, [q]);
  const { data, isFetching } = useApi<any>(open ? '/customers' : null, {
    search: debounced,
    pageSize: 6,
  });
  const items: any[] = data?.items ?? [];
  const canAdd = can('customer.manage') && q.trim().length >= 2;
  const pick = (cust: any) => {
    onChange(cust);
    setQ('');
    setOpen(false);
  };

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md border bg-surface px-3 py-2 text-sm">
        <div className="min-w-0">
          <p className="truncate font-medium">{value.name}</p>
          <p className="text-xs text-muted-foreground">
            {value.phone ?? c.noPhone}
            {value.outstanding && Number(value.outstanding) > 0 && (
              <>
                , {c.owes} <Money value={value.outstanding} signed="negative" />
              </>
            )}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onChange(null)}
          aria-label={c.removeCustomer}
        >
          <X />
        </Button>
      </div>
    );
  }
  const options = items.length + (canAdd ? 1 : 0);
  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={q}
        placeholder={c.placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, options - 1));
          if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
          if (e.key === 'Enter' && options > 0) {
            e.preventDefault();
            if (active < items.length) pick(items[active]);
            else setAdding(true);
          }
        }}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-label={c.label}
      />
      {open && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border bg-surface py-1 text-sm shadow-lg"
        >
          {items.map((cust, i) => (
            <li
              key={cust.id}
              role="option"
              aria-selected={i === active}
              className={cn(
                'cursor-pointer px-3 py-2 coarse:py-3',
                i === active ? 'bg-muted' : 'hover:bg-muted',
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(cust);
              }}
            >
              <span className="font-medium">{cust.name}</span>{' '}
              <span className="text-xs text-muted-foreground">{cust.phone}</span>
            </li>
          ))}
          {debounced && !isFetching && items.length === 0 && (
            <li className="px-3 py-2 text-muted-foreground">{t.panel.common.noResults}</li>
          )}
          {canAdd && (
            <li
              role="option"
              aria-selected={active === items.length}
              className={cn(
                'flex cursor-pointer items-center gap-2 border-t px-3 py-2 font-medium coarse:py-3',
                active === items.length ? 'bg-muted' : 'hover:bg-muted',
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                setAdding(true);
              }}
            >
              <UserPlus className="size-4 text-emerald" /> {c.addAs(q.trim())}
            </li>
          )}
          {!items.length && q.trim().length < 2 && (
            <li className="px-3 py-2 text-muted-foreground">{c.typeToSearch}</li>
          )}
        </ul>
      )}
      <QuickAddCustomer
        seed={q}
        open={adding}
        onOpenChange={setAdding}
        onAdded={(cust) => {
          pick(cust);
        }}
      />
    </div>
  );
}
