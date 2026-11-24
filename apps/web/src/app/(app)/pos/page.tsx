'use client';
import * as React from 'react';
import { Barcode, Mail, Minus, Plus, Printer, ShoppingCart, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, formatQty, PAYMENT_METHOD_LABELS, PAYMENT_METHODS, PERMISSIONS, type PaymentMethod } from '@hisabkhata/shared';
import { api, ApiError, errorMessage, openPdf } from '@/lib/api';
import { useApi, useAction } from '@/hooks/use-api';
import { useCan, useSession } from '@/hooks/use-session';
import { fromPaisa, lineTotal, percentOf, toMilli, toPaisa } from '@/lib/paisa';
import { Money, useMoney } from '@/components/money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CustomerPicker } from '@/components/customer-picker';
import { ProductPicker } from '@/components/product-picker';
import { RequirePermission } from '@/components/shell/guards';
import { cn } from '@/lib/utils';

interface Line {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  price: string;
  stock: string;
  quantity: string;
  discount: string;
}
interface PayLine {
  method: PaymentMethod;
  amount: string;
  reference?: string;
}

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random()).slice(0, 36);

function QtyInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const step = (d: number) => {
    const next = Math.max(0, toMilli(value) + d * 1000);
    onChange(String(next / 1000));
  };
  return (
    <div className="flex items-center rounded-md border">
      <button type="button" className="p-1.5 text-muted-foreground hover:text-foreground" onClick={() => step(-1)} aria-label={`Decrease ${label}`}>
        <Minus className="size-3.5" />
      </button>
      <input
        value={value}
        onChange={(e) => /^\d{0,6}(\.\d{0,3})?$/.test(e.target.value) && onChange(e.target.value)}
        className="num w-12 bg-transparent text-center text-sm outline-none"
        inputMode="decimal"
        aria-label={`Quantity of ${label}`}
      />
      <button type="button" className="p-1.5 text-muted-foreground hover:text-foreground" onClick={() => step(1)} aria-label={`Increase ${label}`}>
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

function Receipt({ sale, onNew }: { sale: any; onNew: () => void }) {
  const can = useCan();
  const [email, setEmail] = React.useState(sale.customer?.email ?? '');
  const send = useAction(() => api(`/invoices/${sale.id}/email`, { method: 'POST', body: email ? { to: email } : {} }), { success: (r: any) => `Invoice sent to ${r.to}` });
  return (
    <div className="space-y-5">
      <div className="rounded-md border bg-muted/40 p-4 text-center">
        <p className="text-sm text-muted-foreground">Invoice {sale.invoiceNo}</p>
        <p className="mt-1 text-2xl font-semibold">
          <Money value={sale.total} />
        </p>
        {Number(sale.change) > 0 && (
          <p className="mt-2 text-base">
            Give change <Money value={sale.change} className="font-semibold text-positive" />
          </p>
        )}
        {Number(sale.dueAmount) > 0 && (
          <p className="mt-2 text-sm">
            Added to {sale.customer?.name}&rsquo;s dues: <Money value={sale.dueAmount} signed="negative" className="font-medium" />
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => openPdf(`/invoices/${sale.id}/pdf`).catch((e) => toast.error(errorMessage(e)))}>
          <Printer /> Print invoice
        </Button>
        <Button onClick={onNew} autoFocus>
          <ShoppingCart /> New sale
        </Button>
      </div>
      {can(PERMISSIONS.INVOICE_SEND) && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate(undefined);
          }}
        >
          <Input type="email" placeholder="Customer email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email invoice to" />
          <Button type="submit" variant="outline" loading={send.isPending} disabled={!email}>
            <Mail /> Email
          </Button>
        </form>
      )}
    </div>
  );
}

function Pos() {
  const can = useCan();
  const session = useSession().data;
  const fmt = useMoney();
  const cur = session?.activeTenant?.currency ?? 'BDT';
  const categories = useApi<any[]>('/categories');
  const [category, setCategory] = React.useState('');
  const quick = useApi<any>('/products', { pageSize: 24, sort: 'name', order: 'asc', categoryId: category || undefined });
  const settings = useApi<any>('/tenant/settings');
  const [lines, setLines] = React.useState<Line[]>([]);
  const [customer, setCustomer] = React.useState<any | null>(null);
  const [discount, setDiscount] = React.useState('');
  const [taxRate, setTaxRate] = React.useState<string | null>(null);
  const [payments, setPayments] = React.useState<PayLine[]>([{ method: 'CASH', amount: '' }]);
  const [key, setKey] = React.useState(newKey);
  const [done, setDone] = React.useState<any | null>(null);
  const [scan, setScan] = React.useState('');
  const scanRef = React.useRef<HTMLInputElement>(null);
  const allowNegative = settings.data?.allowNegativeStock;
  const rate = taxRate ?? settings.data?.defaultTaxRate ?? '0';

  const add = React.useCallback(
    (p: any) => {
      if (Number(p.stock) <= 0 && !allowNegative) {
        toast.error(`${p.name} is out of stock`);
        return;
      }
      setLines((ls) => {
        const i = ls.findIndex((l) => l.productId === p.id);
        if (i >= 0) {
          const next = [...ls];
          next[i] = { ...next[i], quantity: String((toMilli(next[i].quantity) + 1000) / 1000) };
          return next;
        }
        return [...ls, { productId: p.id, name: p.name, sku: p.sku, unit: p.unit, price: String(p.sellingPrice), stock: String(p.stock), quantity: '1', discount: '0' }];
      });
    },
    [allowNegative],
  );

  // Barcode scanners type the code and press Enter.
  const lookup = async (code: string) => {
    if (!code.trim()) return;
    try {
      add(await api(`/products/lookup`, { query: { code } }));
    } catch (err) {
      toast.error(err instanceof ApiError && err.status === 404 ? `No product with code ${code}` : errorMessage(err));
    }
    setScan('');
  };

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        scanRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const subtotal = lines.reduce((a, l) => a + lineTotal(l.quantity, l.price, l.discount || '0'), 0);
  const orderDiscount = toPaisa(discount || '0');
  const taxable = Math.max(0, subtotal - orderDiscount);
  const tax = percentOf(taxable, rate);
  const total = taxable + tax;
  // An untouched payment box means "paid exactly", which is how most counter sales go.
  const untouched = payments.every((p) => !p.amount);
  const effectivePayments: PayLine[] = untouched ? [{ method: payments[0].method, amount: fromPaisa(total) }] : payments.filter((p) => toPaisa(p.amount) > 0);
  const tendered = effectivePayments.reduce((a, p) => a + toPaisa(p.amount || '0'), 0);
  const change = Math.max(0, tendered - total);
  const due = Math.max(0, total - tendered);
  const overStock = lines.filter((l) => !allowNegative && toMilli(l.quantity) > toMilli(l.stock));

  const reset = () => {
    setLines([]);
    setCustomer(null);
    setDiscount('');
    setTaxRate(null);
    setPayments([{ method: 'CASH', amount: '' }]);
    setKey(newKey());
    setDone(null);
    setTimeout(() => scanRef.current?.focus(), 50);
  };

  const checkout = useAction(
    () =>
      api('/sales', {
        method: 'POST',
        body: {
          customerId: customer?.id ?? null,
          items: lines.filter((l) => toMilli(l.quantity) > 0).map((l) => ({ productId: l.productId, quantity: l.quantity, discount: l.discount || '0' })),
          discount: discount || '0',
          taxRate: rate,
          payments: total > 0 ? effectivePayments : [],
          idempotencyKey: key,
        },
      }),
    { invalidate: [['/products'], ['/dashboard'], ['/sales'], ['/invoices']], onSuccess: (sale) => setDone(sale) },
  );

  const canCharge = lines.length > 0 && overStock.length === 0 && (due === 0 || customer) && !checkout.isPending;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <form
            className="relative sm:w-64"
            onSubmit={(e) => {
              e.preventDefault();
              lookup(scan);
            }}
          >
            <Barcode className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input ref={scanRef} value={scan} onChange={(e) => setScan(e.target.value)} placeholder="Scan barcode (F2)" className="pl-8" autoFocus aria-label="Scan barcode or enter SKU" />
          </form>
          <div className="flex-1">
            <ProductPicker onPick={add} placeholder="Search products by name" />
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Categories">
          {[{ id: '', name: 'All' }, ...(categories.data ?? [])].map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={category === c.id}
              onClick={() => setCategory(c.id)}
              className={cn('whitespace-nowrap rounded-full border px-3 py-1 text-sm', category === c.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-surface hover:bg-muted')}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {quick.data?.items.map((p: any) => {
            const out = Number(p.stock) <= 0;
            return (
              <button
                key={p.id}
                onClick={() => add(p)}
                disabled={out && !allowNegative}
                className="flex min-h-[84px] flex-col justify-between rounded-md border bg-surface p-3 text-left hover:border-primary/40 hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="line-clamp-2 text-sm font-medium leading-snug">{p.name}</span>
                <span className="mt-2 flex items-baseline justify-between gap-2 text-xs">
                  <Money value={p.sellingPrice} className="text-sm font-semibold" />
                  <span className={cn('num', out ? 'text-negative' : Number(p.stock) <= Number(p.minStock) ? 'text-warning' : 'text-muted-foreground')}>
                    {out ? 'Out' : `${formatQty(p.stock)} left`}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* The bill: reads top to bottom like a paper receipt. */}
      <aside className="flex flex-col rounded-lg border bg-surface xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)]" aria-label="Current sale">
        <div className="border-b p-4">
          <CustomerPicker value={customer} onChange={setCustomer} />
        </div>
        <div className="min-h-[160px] flex-1 overflow-y-auto">
          {lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center text-sm text-muted-foreground">
              <ShoppingCart className="mb-2 size-5" />
              Scan a barcode or tap a product to start the bill.
            </div>
          ) : (
            <ul className="divide-y">
              {lines.map((l, i) => {
                const short = !allowNegative && toMilli(l.quantity) > toMilli(l.stock);
                return (
                  <li key={l.productId} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{l.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmt(l.price)} / {l.unit}
                        </p>
                      </div>
                      <span className="num text-sm font-medium">{formatMoney(fromPaisa(lineTotal(l.quantity, l.price, l.discount || '0')), cur)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <QtyInput label={l.name} value={l.quantity} onChange={(v) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, quantity: v } : x)))} />
                      <Input
                        className="num h-8 w-24 text-xs"
                        placeholder="Discount"
                        inputMode="decimal"
                        value={l.discount === '0' ? '' : l.discount}
                        onChange={(e) => /^\d{0,9}(\.\d{0,2})?$/.test(e.target.value) && setLines((ls) => ls.map((x, j) => (j === i ? { ...x, discount: e.target.value || '0' } : x)))}
                        aria-label={`Discount on ${l.name}`}
                      />
                      <Button variant="ghost" size="icon" className="ml-auto size-8" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label={`Remove ${l.name}`}>
                        <Trash2 />
                      </Button>
                    </div>
                    {short && <p className="mt-1 text-xs text-negative">Only {formatQty(l.stock)} in stock</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-3 border-t p-4">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted-foreground">
              Order discount
              <Input className="num mt-1 h-8" inputMode="decimal" value={discount} onChange={(e) => /^\d{0,9}(\.\d{0,2})?$/.test(e.target.value) && setDiscount(e.target.value)} placeholder="0.00" />
            </label>
            <label className="text-xs text-muted-foreground">
              Tax %
              <Input className="num mt-1 h-8" inputMode="decimal" value={rate} onChange={(e) => /^\d{0,3}(\.\d{0,2})?$/.test(e.target.value) && setTaxRate(e.target.value)} />
            </label>
          </div>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="num">{formatMoney(fromPaisa(subtotal), cur)}</dd>
            </div>
            {orderDiscount > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Discount</dt>
                <dd className="num">-{formatMoney(fromPaisa(orderDiscount), cur)}</dd>
              </div>
            )}
            {tax > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tax ({rate}%)</dt>
                <dd className="num">{formatMoney(fromPaisa(tax), cur)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="num">{formatMoney(fromPaisa(total), cur)}</dd>
            </div>
          </dl>

          <div className="space-y-2">
            {payments.map((p, i) => (
              <div key={i} className="flex gap-2">
                <select
                  className="h-9 rounded-md border border-input bg-surface px-2 text-sm"
                  value={p.method}
                  onChange={(e) => setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, method: e.target.value as PaymentMethod } : x)))}
                  aria-label="Payment method"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABELS[m]}
                    </option>
                  ))}
                </select>
                <Input
                  className="num"
                  inputMode="decimal"
                  placeholder={i === 0 ? fromPaisa(total) : '0.00'}
                  value={p.amount}
                  onChange={(e) => /^\d{0,9}(\.\d{0,2})?$/.test(e.target.value) && setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                  aria-label={`${PAYMENT_METHOD_LABELS[p.method]} amount`}
                />
                {i > 0 ? (
                  <Button variant="ghost" size="icon" onClick={() => setPayments((ps) => ps.filter((_, j) => j !== i))} aria-label="Remove payment">
                    <X />
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => setPayments((ps) => ps.map((x, j) => (j === 0 ? { ...x, amount: fromPaisa(Math.max(0, total - ps.slice(1).reduce((a, y) => a + toPaisa(y.amount), 0))) } : x)))}>
                    Exact
                  </Button>
                )}
              </div>
            ))}
            {payments.length < 3 && (
              <button className="text-xs text-muted-foreground underline underline-offset-2" onClick={() => setPayments((ps) => [...ps, { method: 'BKASH', amount: '' }])}>
                Split payment
              </button>
            )}
          </div>

          {change > 0 && (
            <p className="flex justify-between text-sm">
              <span>Change</span>
              <span className="num font-semibold text-positive">{formatMoney(fromPaisa(change), cur)}</span>
            </p>
          )}
          {due > 0 && lines.length > 0 && (
            <p className={cn('text-sm', customer ? '' : 'text-negative')}>
              {customer ? (
                <>
                  <span className="num font-medium">{formatMoney(fromPaisa(due), cur)}</span> will be added to {customer.name}&rsquo;s dues.
                </>
              ) : (
                'Choose a customer to leave an amount due, or take full payment.'
              )}
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={reset} disabled={!lines.length}>
              Clear
            </Button>
            <Button className="flex-1" size="lg" variant="positive" disabled={!canCharge} loading={checkout.isPending} onClick={() => checkout.mutate(undefined)}>
              Charge {formatMoney(fromPaisa(total), cur)}
            </Button>
          </div>
          {!can(PERMISSIONS.PRODUCT_MANAGE) && <p className="text-2xs text-muted-foreground">Prices come from the product list.</p>}
        </div>
      </aside>

      <Dialog open={!!done} onOpenChange={(o) => !o && reset()}>
        {done && (
          <DialogContent title="Sale complete" description={done.customer ? `Billed to ${done.customer.name}` : 'Walk-in customer'}>
            <Receipt sale={done} onNew={reset} />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

export default function PosPage() {
  return (
    <RequirePermission permission={PERMISSIONS.SALE_CREATE}>
      <h1 className="sr-only">Point of sale</h1>
      <Pos />
    </RequirePermission>
  );
}

