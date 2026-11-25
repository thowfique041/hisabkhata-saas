'use client';
import * as React from 'react';
import * as D from '@radix-ui/react-dialog';
import {
  Barcode,
  ChevronDown,
  Maximize2,
  Minimize2,
  Minus,
  PauseCircle,
  Plus,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  formatMoney,
  formatQty,
  PAYMENT_METHODS,
  PERMISSIONS,
  type PaymentMethod,
} from '@hisabkhata/shared';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useApi, useAction } from '@/hooks/use-api';
import { useCan, useSession } from '@/hooks/use-session';
import { fromPaisa, lineTotal, percentOf, toMilli, toPaisa } from '@/lib/paisa';
import { useI18n } from '@/lib/i18n/client';
import { useHeldBills, type HeldBill, type HeldLine } from '@/lib/held-bills';
import { usePosFullscreen } from '@/lib/pos-fullscreen';
import { useConfirm } from '@/components/confirm';
import { Money } from '@/components/money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CustomerPicker } from '@/components/customer-picker';
import { ProductPicker } from '@/components/product-picker';
import { RequirePermission } from '@/components/shell/guards';
import { cn } from '@/lib/utils';
import { HeldBillsDialog, HoldDialog } from './held-bills';
import { Receipt } from './receipt';
import { ShortcutsPopover } from './shortcuts';

type Line = HeldLine;
interface PayLine {
  method: PaymentMethod;
  amount: string;
}

const QUICK_METHODS: PaymentMethod[] = ['CASH', 'BKASH', 'NAGAD', 'ROCKET', 'CARD'];
const NOTES = [100, 500, 1000];

const newKey = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random()
  ).slice(0, 36);

function useIsDesktop() {
  const [desktop, setDesktop] = React.useState(true);
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setDesktop(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return desktop;
}

const isTypingTarget = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/** Round amounts a customer is likely to hand over: the next 100, 500 and 1000 above the total. */
function nextRound(totalPaisa: number) {
  const taka = totalPaisa / 100;
  const candidates = [100, 500, 1000].map((step) => Math.ceil((taka + 0.001) / step) * step);
  return [...new Set(candidates)]
    .filter((v) => v > taka && !NOTES.includes(v))
    .sort((a, b) => a - b)[0];
}

function QtyInput({
  value,
  onChange,
  name,
}: {
  value: string;
  onChange: (v: string) => void;
  name: string;
}) {
  const { t } = useI18n();
  const p = t.panel.pos;
  const step = (d: number) => onChange(String(Math.max(0, toMilli(value) + d * 1000) / 1000));
  return (
    <div className="flex items-center rounded-md border bg-surface">
      <button
        type="button"
        className="p-1.5 text-muted-foreground hover:text-foreground coarse:p-2.5"
        onClick={() => step(-1)}
        aria-label={p.decrease(name)}
      >
        <Minus className="size-3.5" />
      </button>
      <input
        value={value}
        onChange={(e) => /^\d{0,6}(\.\d{0,3})?$/.test(e.target.value) && onChange(e.target.value)}
        className="num w-12 bg-transparent text-center text-sm outline-none"
        inputMode="decimal"
        aria-label={p.qtyOf(name)}
        onClick={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        className="p-1.5 text-muted-foreground hover:text-foreground coarse:p-2.5"
        onClick={() => step(1)}
        aria-label={p.increase(name)}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

function Pos() {
  const can = useCan();
  const session = useSession().data;
  const tenantId = session?.activeTenant?.id;
  const cur = session?.activeTenant?.currency ?? 'BDT';
  const money = (paisa: number) => formatMoney(fromPaisa(paisa), cur);
  const { t, tr } = useI18n();
  const p = t.panel.pos;
  const methodLabel = (m: string) => t.panel.common.methods[m] ?? m;
  const confirm = useConfirm();
  const desktop = useIsDesktop();
  const [fullscreen, setFullscreen] = usePosFullscreen();
  const held = useHeldBills(tenantId);

  const categories = useApi<any[]>('/categories');
  const [category, setCategory] = React.useState('');
  const quick = useApi<any>('/products', {
    pageSize: 60,
    sort: 'name',
    order: 'asc',
    categoryId: category || undefined,
  });
  const settings = useApi<any>('/tenant/settings');

  const [lines, setLines] = React.useState<Line[]>([]);
  const [selected, setSelected] = React.useState(0);
  const [customer, setCustomer] = React.useState<any | null>(null);
  const [discount, setDiscount] = React.useState('');
  const [taxRate, setTaxRate] = React.useState<string | null>(null);
  const [showAdjust, setShowAdjust] = React.useState(false);
  const [payments, setPayments] = React.useState<PayLine[]>([{ method: 'CASH', amount: '' }]);
  const [key, setKey] = React.useState(newKey);
  const [done, setDone] = React.useState<any | null>(null);
  const [scan, setScan] = React.useState('');
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [holdOpen, setHoldOpen] = React.useState(false);
  const [heldOpen, setHeldOpen] = React.useState(false);
  const scanRef = React.useRef<HTMLInputElement>(null);

  const allowNegative = settings.data?.allowNegativeStock;
  const rate = taxRate ?? settings.data?.defaultTaxRate ?? '0';

  const add = React.useCallback(
    (prod: any) => {
      if (Number(prod.stock) <= 0 && !allowNegative) {
        toast.error(p.outOfStock(prod.name));
        return;
      }
      setLines((ls) => {
        const i = ls.findIndex((l) => l.productId === prod.id);
        if (i >= 0) {
          const next = [...ls];
          next[i] = { ...next[i], quantity: String((toMilli(next[i].quantity) + 1000) / 1000) };
          setSelected(i);
          return next;
        }
        setSelected(ls.length);
        return [
          ...ls,
          {
            productId: prod.id,
            name: prod.name,
            sku: prod.sku,
            unit: prod.unit,
            price: String(prod.sellingPrice),
            stock: String(prod.stock),
            quantity: '1',
            discount: '0',
          },
        ];
      });
    },
    [allowNegative, p],
  );

  // Barcode scanners type the code and press Enter.
  const lookup = async (code: string) => {
    if (!code.trim()) return;
    try {
      add(await api(`/products/lookup`, { query: { code } }));
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.status === 404 ? p.noCode(code) : tr(errorMessage(err)),
      );
    }
    setScan('');
  };

  const subtotal = lines.reduce((a, l) => a + lineTotal(l.quantity, l.price, l.discount || '0'), 0);
  const orderDiscount = toPaisa(discount || '0');
  const taxable = Math.max(0, subtotal - orderDiscount);
  const tax = percentOf(taxable, rate);
  const total = taxable + tax;
  // An untouched payment box means "paid exactly", which is how most counter sales go.
  const untouched = payments.every((x) => !x.amount);
  const effectivePayments: PayLine[] = untouched
    ? [{ method: payments[0].method, amount: fromPaisa(total) }]
    : payments.filter((x) => toPaisa(x.amount) > 0);
  const tendered = effectivePayments.reduce((a, x) => a + toPaisa(x.amount || '0'), 0);
  const change = Math.max(0, tendered - total);
  const due = Math.max(0, total - tendered);
  const overStock = lines.filter((l) => !allowNegative && toMilli(l.quantity) > toMilli(l.stock));
  const itemCount = lines.length;

  const reset = React.useCallback(() => {
    setLines([]);
    setSelected(0);
    setCustomer(null);
    setDiscount('');
    setTaxRate(null);
    setShowAdjust(false);
    setPayments([{ method: 'CASH', amount: '' }]);
    setKey(newKey());
    setDone(null);
    setSheetOpen(false);
    setTimeout(() => scanRef.current?.focus(), 50);
  }, []);

  const checkout = useAction(
    () =>
      api('/sales', {
        method: 'POST',
        body: {
          customerId: customer?.id ?? null,
          items: lines
            .filter((l) => toMilli(l.quantity) > 0)
            .map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
              discount: l.discount || '0',
            })),
          discount: discount || '0',
          taxRate: rate,
          payments: total > 0 ? effectivePayments : [],
          idempotencyKey: key,
        },
      }),
    {
      invalidate: [['/products'], ['/dashboard'], ['/sales'], ['/invoices'], ['/customers']],
      onSuccess: (sale) => {
        setSheetOpen(false);
        setDone(sale);
      },
    },
  );

  const blockReason = !lines.length
    ? p.whyAddItems
    : overStock.length
      ? p.whyStock(overStock[0].name)
      : due > 0 && !customer
        ? p.whyCustomer
        : null;
  const canCharge = !blockReason && !checkout.isPending;
  const charge = () => {
    if (canCharge) checkout.mutate(undefined);
    else if (blockReason) toast.error(blockReason);
  };

  const holdCurrent = (label: string) => {
    held.hold({
      label,
      lines,
      customer: customer
        ? {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            outstanding: customer.outstanding,
          }
        : null,
      discount,
      taxRate,
    });
  };
  const resume = (b: HeldBill) => {
    if (lines.length) {
      holdCurrent('');
      toast.message(p.heldReplaced);
    }
    held.remove(b.id);
    setLines(b.lines);
    setSelected(0);
    setCustomer(b.customer);
    setDiscount(b.discount);
    setTaxRate(b.taxRate);
    setShowAdjust(!!b.discount || b.taxRate !== null);
    setPayments([{ method: 'CASH', amount: '' }]);
    setKey(newKey());
    setHeldOpen(false);
  };
  const askClear = async () => {
    if (!lines.length) return;
    if (
      await confirm({
        title: p.clearCart,
        description: p.clearCartBody,
        confirmLabel: p.clear,
        destructive: true,
      })
    )
      reset();
  };
  const setQty = (i: number, delta: number) =>
    setLines((ls) =>
      ls.map((x, j) =>
        j === i
          ? { ...x, quantity: String(Math.max(0, toMilli(x.quantity) + delta * 1000) / 1000) }
          : x,
      ),
    );
  const removeLine = (i: number) => {
    setLines((ls) => ls.filter((_, j) => j !== i));
    setSelected((s) => Math.max(0, Math.min(s, lines.length - 2)));
  };

  // Keyboard map for the counter. Handlers read the latest state through a ref.
  const keys = React.useRef<(e: KeyboardEvent) => void>(() => undefined);
  keys.current = (e: KeyboardEvent) => {
    const dialogOpen = !!document.querySelector('[role="dialog"], [role="alertdialog"]');
    const typing = isTypingTarget(e.target);
    // The scan box keeps focus most of the time; while it is empty, line keys still work.
    const freeKeys = !typing || (e.target === scanRef.current && !scan);
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === 'F2') {
      e.preventDefault();
      scanRef.current?.focus();
      return;
    }
    if (dialogOpen) return;
    if (e.key === 'F4') {
      e.preventDefault();
      charge();
    } else if (mod && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      if (lines.length) setHoldOpen(true);
    } else if (e.key === 'Escape' && (!typing || e.target === scanRef.current)) {
      e.preventDefault();
      if (scan) setScan('');
      else void askClear();
    } else if (freeKeys && lines.length) {
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setQty(selected, 1);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setQty(selected, -1);
      } else if (e.key === 'Delete') {
        e.preventDefault();
        removeLine(selected);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, lines.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      }
    }
  };
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const cash = payments.length === 1 && payments[0].method === 'CASH';
  const round = nextRound(total);
  const setFirstAmount = (amount: string) =>
    setPayments((ps) => ps.map((x, j) => (j === 0 ? { ...x, amount } : x)));

  const cart = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b p-3 sm:p-4">
        <CustomerPicker value={customer} onChange={setCustomer} />
      </div>
      <div className="min-h-[120px] flex-1 overflow-y-auto">
        {lines.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 py-8 text-center text-sm text-muted-foreground">
            <ShoppingCart className="mb-2 size-5" />
            {p.emptyCart}
          </div>
        ) : (
          <ul className="divide-y" aria-label={p.currentSale}>
            {lines.map((l, i) => {
              const short = !allowNegative && toMilli(l.quantity) > toMilli(l.stock);
              return (
                <li
                  key={l.productId}
                  onClick={() => setSelected(i)}
                  aria-current={i === selected ? 'true' : undefined}
                  className={cn(
                    'cursor-pointer border-l-2 px-3 py-2.5 sm:px-4',
                    i === selected ? 'border-l-emerald bg-accent/50' : 'border-l-transparent',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{l.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.perUnit(formatMoney(l.price, cur), l.unit)}
                      </p>
                    </div>
                    <span className="num text-sm font-medium">
                      {money(lineTotal(l.quantity, l.price, l.discount || '0'))}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <QtyInput
                      name={l.name}
                      value={l.quantity}
                      onChange={(v) =>
                        setLines((ls) => ls.map((x, j) => (j === i ? { ...x, quantity: v } : x)))
                      }
                    />
                    <Input
                      className="num h-8 w-24 text-xs coarse:h-10"
                      placeholder={p.discount}
                      inputMode="decimal"
                      value={l.discount === '0' ? '' : l.discount}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        /^\d{0,9}(\.\d{0,2})?$/.test(e.target.value) &&
                        setLines((ls) =>
                          ls.map((x, j) =>
                            j === i ? { ...x, discount: e.target.value || '0' } : x,
                          ),
                        )
                      }
                      aria-label={p.discountOn(l.name)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-auto size-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeLine(i);
                      }}
                      aria-label={p.removeLine(l.name)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  {short && (
                    <p className="mt-1 text-xs text-negative">
                      {p.onlyInStock(formatQty(l.stock))}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t p-3 sm:p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground coarse:min-h-11 coarse:text-sm"
          onClick={() => setShowAdjust((v) => !v)}
          aria-expanded={showAdjust}
        >
          {p.discountAndTax}
          <ChevronDown
            className={cn('size-3.5 transition-transform', showAdjust && 'rotate-180')}
          />
        </button>
        {showAdjust && (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted-foreground">
              {p.orderDiscount}
              <Input
                className="num mt-1 h-8"
                inputMode="decimal"
                value={discount}
                onChange={(e) =>
                  /^\d{0,9}(\.\d{0,2})?$/.test(e.target.value) && setDiscount(e.target.value)
                }
                placeholder="0.00"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              {p.taxPct}
              <Input
                className="num mt-1 h-8"
                inputMode="decimal"
                value={rate}
                onChange={(e) =>
                  /^\d{0,3}(\.\d{0,2})?$/.test(e.target.value) && setTaxRate(e.target.value)
                }
              />
            </label>
          </div>
        )}
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{p.subtotal}</dt>
            <dd className="num">{money(subtotal)}</dd>
          </div>
          {orderDiscount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{p.discount}</dt>
              <dd className="num">-{money(orderDiscount)}</dd>
            </div>
          )}
          {tax > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{p.tax(rate)}</dt>
              <dd className="num">{money(tax)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 text-lg font-semibold">
            <dt>{p.total}</dt>
            <dd className="num">{money(total)}</dd>
          </div>
        </dl>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={p.paymentMethod}>
            {QUICK_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={payments[0].method === m}
                onClick={() =>
                  setPayments((ps) => ps.map((x, j) => (j === 0 ? { ...x, method: m } : x)))
                }
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors coarse:min-h-11 coarse:px-3.5 coarse:text-sm',
                  payments[0].method === m
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-surface hover:bg-muted',
                )}
              >
                {methodLabel(m)}
              </button>
            ))}
          </div>
          {payments.map((pay, i) => (
            <div key={i} className="flex gap-2">
              {i > 0 && (
                <select
                  className="h-9 rounded-md border border-input bg-surface px-2 text-sm coarse:h-11"
                  value={pay.method}
                  onChange={(e) =>
                    setPayments((ps) =>
                      ps.map((x, j) =>
                        j === i ? { ...x, method: e.target.value as PaymentMethod } : x,
                      ),
                    )
                  }
                  aria-label={p.paymentMethod}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {methodLabel(m)}
                    </option>
                  ))}
                </select>
              )}
              <label className="relative flex-1">
                {i === 0 && (
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {cash ? p.received : methodLabel(pay.method)}
                  </span>
                )}
                <Input
                  className={cn('num coarse:h-11', i === 0 && 'pl-28 text-right font-medium')}
                  inputMode="decimal"
                  placeholder={i === 0 ? fromPaisa(total) : '0.00'}
                  value={pay.amount}
                  onChange={(e) =>
                    /^\d{0,9}(\.\d{0,2})?$/.test(e.target.value) &&
                    setPayments((ps) =>
                      ps.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)),
                    )
                  }
                  aria-label={p.amount(methodLabel(pay.method))}
                />
              </label>
              {i > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPayments((ps) => ps.filter((_, j) => j !== i))}
                  aria-label={p.removePayment}
                >
                  <X />
                </Button>
              )}
            </div>
          ))}
          {cash && total > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setFirstAmount(fromPaisa(total))}
              >
                {p.exact}
              </Button>
              {[...NOTES, round]
                .filter((v): v is number => !!v && v * 100 >= total)
                .filter((v, i, a) => a.indexOf(v) === i)
                .sort((a, b) => a - b)
                .map((v) => (
                  <Button
                    key={v}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="num"
                    onClick={() => setFirstAmount(String(v))}
                  >
                    ৳{v.toLocaleString('en-IN')}
                  </Button>
                ))}
            </div>
          )}
          {payments.length < 3 && (
            <button
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground coarse:min-h-11 coarse:text-sm"
              onClick={() =>
                setPayments((ps) => [
                  ...ps,
                  { method: ps[0].method === 'CASH' ? 'BKASH' : 'CASH', amount: '' },
                ])
              }
            >
              {p.split}
            </button>
          )}
        </div>

        {change > 0 && (
          <div
            className="flex items-baseline justify-between rounded-md bg-positive/10 px-3 py-2"
            aria-live="polite"
          >
            <span className="text-sm font-medium text-positive">{p.change}</span>
            <span className="num text-3xl font-semibold text-positive">{money(change)}</span>
          </div>
        )}
        {due > 0 && lines.length > 0 && (
          <p className={cn('text-sm', !customer && 'text-negative')}>
            {customer ? p.dueAdded(money(due), customer.name) : p.chooseCustomer}
          </p>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void askClear()} disabled={!lines.length}>
            {p.clear}
          </Button>
          <Button
            className="flex-1"
            size="lg"
            variant="positive"
            disabled={!canCharge}
            disabledReason={checkout.isPending ? null : blockReason}
            loading={checkout.isPending}
            onClick={charge}
          >
            {p.charge(money(total))}
            <kbd className="ml-1 hidden rounded bg-white/20 px-1 text-2xs font-normal xl:inline">
              F4
            </kbd>
          </Button>
        </div>
        {!can(PERMISSIONS.PRODUCT_MANAGE) && (
          <p className="text-2xs text-muted-foreground">{p.pricesFromList}</p>
        )}
      </div>
    </div>
  );

  const inCart = new Map(lines.map((l) => [l.productId, l.quantity]));

  return (
    <div
      className={cn(
        'grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_420px] xl:gap-6',
        !desktop && 'pb-24',
      )}
    >
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <form
            className="relative w-full sm:w-56"
            onSubmit={(e) => {
              e.preventDefault();
              void lookup(scan);
            }}
          >
            <Barcode className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={scanRef}
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              placeholder={p.scan}
              className="pl-8 coarse:h-11"
              autoFocus={desktop}
              aria-label={p.scanLabel}
            />
          </form>
          <div className="min-w-[12rem] flex-1">
            <ProductPicker onPick={add} placeholder={p.searchProducts} />
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              onClick={() => setHeldOpen(true)}
              className={cn(held.bills.length === 0 && 'text-muted-foreground')}
            >
              <PauseCircle /> <span className="hidden sm:inline">{p.held(held.bills.length)}</span>
              <span className="sm:hidden">{held.bills.length}</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setHoldOpen(true)}
              disabled={!lines.length}
              disabledReason={p.whyAddItems}
            >
              {p.hold}
            </Button>
            <ShortcutsPopover />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setFullscreen(!fullscreen)}
              aria-label={fullscreen ? p.exitFullscreen : p.fullscreen}
              title={fullscreen ? p.exitFullscreen : p.fullscreen}
            >
              {fullscreen ? <Minimize2 /> : <Maximize2 />}
            </Button>
          </div>
        </div>

        <div
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
          role="tablist"
          aria-label={p.categories}
        >
          {[{ id: '', name: t.panel.common.all }, ...(categories.data ?? [])].map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={category === c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                'whitespace-nowrap rounded-full border px-3 py-1 text-sm coarse:py-2',
                category === c.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-surface hover:bg-muted',
              )}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {quick.data?.items.map((prod: any) => {
            const out = Number(prod.stock) <= 0;
            const qty = inCart.get(prod.id);
            return (
              <button
                key={prod.id}
                onClick={() => add(prod)}
                disabled={out && !allowNegative}
                className="relative flex min-h-[88px] flex-col justify-between rounded-md border bg-surface p-3 text-left transition-colors enabled:hover:border-primary/40 enabled:hover:bg-accent/40 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 coarse:min-h-[104px]"
              >
                {qty && (
                  <span className="num absolute -right-1.5 -top-1.5 rounded-full bg-emerald px-1.5 text-xs font-semibold text-white">
                    {formatQty(qty)}
                  </span>
                )}
                <span className="line-clamp-2 text-sm font-medium leading-snug">{prod.name}</span>
                <span className="mt-2 flex items-baseline justify-between gap-2 text-xs">
                  <Money value={prod.sellingPrice} className="text-sm font-semibold" />
                  <span
                    className={cn(
                      'num',
                      out
                        ? 'text-negative'
                        : Number(prod.stock) <= Number(prod.minStock)
                          ? 'text-warning'
                          : 'text-muted-foreground',
                    )}
                  >
                    {out ? p.out : p.left(formatQty(prod.stock))}
                  </span>
                </span>
              </button>
            );
          })}
          {quick.data && quick.data.items.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
              {p.noProducts}
            </p>
          )}
        </div>
      </div>

      {desktop ? (
        <aside
          className={cn(
            'flex flex-col overflow-hidden rounded-lg border bg-surface lg:sticky',
            fullscreen
              ? 'lg:top-3 lg:h-[calc(100vh-1.5rem)]'
              : 'lg:top-[4.5rem] lg:h-[calc(100vh-5.5rem)]',
          )}
          aria-label={p.currentSale}
        >
          {cart}
        </aside>
      ) : (
        <>
          <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-surface/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(15,30,61,0.25)] backdrop-blur">
            <div className="mx-auto flex max-w-3xl items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{p.items(itemCount)}</p>
                <p className="num text-lg font-semibold">{money(total)}</p>
              </div>
              <Button
                size="lg"
                variant={lines.length ? 'positive' : 'outline'}
                onClick={() => setSheetOpen(true)}
              >
                <ShoppingCart /> {p.viewCart}
              </Button>
            </div>
          </div>
          <D.Root open={sheetOpen} onOpenChange={setSheetOpen}>
            <D.Portal>
              <D.Overlay className="fixed inset-0 z-40 bg-navy-900/40 animate-fade-in" />
              <D.Content
                className="fixed inset-x-0 bottom-0 z-50 flex h-[92vh] flex-col overflow-hidden rounded-t-xl border-t bg-surface shadow-2xl focus:outline-none"
                aria-describedby={undefined}
              >
                <div className="flex items-center justify-between border-b px-4 py-2.5">
                  <D.Title className="text-sm font-semibold">{p.currentSale}</D.Title>
                  <D.Close
                    className="rounded-md p-2 hover:bg-muted"
                    aria-label={t.panel.common.close}
                  >
                    <X className="size-4" />
                  </D.Close>
                </div>
                <div className="min-h-0 flex-1">{cart}</div>
              </D.Content>
            </D.Portal>
          </D.Root>
        </>
      )}

      <HoldDialog
        open={holdOpen}
        onOpenChange={setHoldOpen}
        onHold={(label) => {
          holdCurrent(label);
          setHoldOpen(false);
          toast.success(p.heldSaved);
          reset();
        }}
      />
      <HeldBillsDialog
        open={heldOpen}
        onOpenChange={setHeldOpen}
        bills={held.bills}
        onResume={resume}
        onDiscard={held.remove}
      />
      <Dialog open={!!done} onOpenChange={(o) => !o && reset()}>
        {done && (
          <DialogContent
            title={p.done.title}
            description={
              done.customer ? p.done.billedTo(done.customer.name) : t.panel.common.walkIn
            }
          >
            <Receipt sale={done} onNew={reset} />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

export default function PosPage() {
  const { t } = useI18n();
  return (
    <RequirePermission permission={PERMISSIONS.SALE_CREATE}>
      <h1 className="sr-only">{t.panel.pos.title}</h1>
      <Pos />
    </RequirePermission>
  );
}
