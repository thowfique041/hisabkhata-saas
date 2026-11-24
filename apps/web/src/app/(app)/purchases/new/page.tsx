'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { formatMoney, PAYMENT_METHOD_LABELS, PAYMENT_METHODS, PERMISSIONS, type PaymentMethod } from '@hisabkhata/shared';
import { api } from '@/lib/api';
import { useAction, useApi } from '@/hooks/use-api';
import { useSession } from '@/hooks/use-session';
import { fromPaisa, lineTotal, toPaisa } from '@/lib/paisa';
import { PageHeader, Panel } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { ProductPicker } from '@/components/product-picker';
import { RequirePermission } from '@/components/shell/guards';
import { isoDay } from '@/lib/utils';

const money = /^\d{0,10}(\.\d{0,2})?$/;

function NewPurchase() {
  const router = useRouter();
  const cur = useSession().data?.activeTenant?.currency ?? 'BDT';
  const suppliers = useApi<any>('/suppliers', { pageSize: 100 });
  const [supplierId, setSupplierId] = React.useState('');
  const [reference, setReference] = React.useState('');
  const [date, setDate] = React.useState(isoDay(new Date()));
  const [lines, setLines] = React.useState<{ productId: string; name: string; unit: string; quantity: string; unitCost: string }[]>([]);
  const [discount, setDiscount] = React.useState('');
  const [shipping, setShipping] = React.useState('');
  const [paid, setPaid] = React.useState('');
  const [method, setMethod] = React.useState<PaymentMethod>('CASH');
  const [note, setNote] = React.useState('');

  const subtotal = lines.reduce((a, l) => a + lineTotal(l.quantity || '0', l.unitCost || '0', '0'), 0);
  const total = subtotal - toPaisa(discount) + toPaisa(shipping);
  const due = total - toPaisa(paid);

  const save = useAction(
    () =>
      api('/purchases', {
        method: 'POST',
        body: {
          supplierId,
          reference: reference || undefined,
          purchaseDate: new Date(date + 'T12:00:00').toISOString(),
          items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitCost: l.unitCost })),
          discount: discount || '0',
          shippingCost: shipping || '0',
          payments: toPaisa(paid) > 0 ? [{ method, amount: paid }] : [],
          note: note || undefined,
        },
      }),
    { success: (p: any) => `${p.purchaseNo} saved. Stock updated.`, invalidate: [['/purchases'], ['/products'], ['/suppliers'], ['/dashboard']], onSuccess: (p) => router.push(`/purchases?open=${p.id}`) },
  );
  const valid = supplierId && lines.length > 0 && lines.every((l) => Number(l.quantity) > 0 && l.unitCost !== '') && due >= 0 && total >= 0;

  return (
    <>
      <PageHeader title="Record purchase" description="Items you add here are received into stock when you save." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Panel title="Supplier" bodyClass="grid gap-4 p-4 sm:grid-cols-3">
            <Field label="Supplier" htmlFor="supplier" className="sm:col-span-1">
              <Select id="supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Choose supplier</option>
                {suppliers.data?.items.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.company || s.name}
                  </option>
                ))}
              </Select>
              {suppliers.data && !suppliers.data.items.length && (
                <Link href="/suppliers" className="text-xs underline">
                  Add a supplier first
                </Link>
              )}
            </Field>
            <Field label="Supplier invoice / challan" htmlFor="ref">
              <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
            <Field label="Date received" htmlFor="date">
              <Input id="date" type="date" value={date} max={isoDay(new Date())} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </Panel>
          <Panel title="Items">
            <div className="border-b p-3">
              <ProductPicker
                placeholder="Add a product by name, SKU or barcode"
                onPick={(p) =>
                  setLines((ls) => (ls.some((l) => l.productId === p.id) ? ls : [...ls, { productId: p.id, name: p.name, unit: p.unit, quantity: '1', unitCost: String(p.purchasePrice) }]))
                }
              />
            </div>
            {lines.length ? (
              <table className="ledger">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="r w-28">Quantity</th>
                    <th className="r w-32">Unit cost</th>
                    <th className="r w-32">Amount</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l.productId}>
                      <td className="font-medium">{l.name}</td>
                      <td className="r">
                        <Input className="num h-8 text-right" inputMode="decimal" value={l.quantity} onChange={(e) => /^\d{0,9}(\.\d{0,3})?$/.test(e.target.value) && setLines((ls) => ls.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} aria-label={`Quantity of ${l.name}`} />
                      </td>
                      <td className="r">
                        <Input className="num h-8 text-right" inputMode="decimal" value={l.unitCost} onChange={(e) => money.test(e.target.value) && setLines((ls) => ls.map((x, j) => (j === i ? { ...x, unitCost: e.target.value } : x)))} aria-label={`Unit cost of ${l.name}`} />
                      </td>
                      <td className="r">{formatMoney(fromPaisa(lineTotal(l.quantity || '0', l.unitCost || '0', '0')), cur)}</td>
                      <td>
                        <Button variant="ghost" size="icon" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label={`Remove ${l.name}`}>
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">Search above to add the products you received.</p>
            )}
          </Panel>
        </div>
        <Panel title="Payment" className="self-start" bodyClass="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Discount" htmlFor="disc">
              <Input id="disc" className="num" inputMode="decimal" value={discount} onChange={(e) => money.test(e.target.value) && setDiscount(e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Transport" htmlFor="ship">
              <Input id="ship" className="num" inputMode="decimal" value={shipping} onChange={(e) => money.test(e.target.value) && setShipping(e.target.value)} placeholder="0.00" />
            </Field>
          </div>
          <dl className="space-y-1 border-y py-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="num">{formatMoney(fromPaisa(subtotal), cur)}</dd>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <dt>Total</dt>
              <dd className="num">{formatMoney(fromPaisa(total), cur)}</dd>
            </div>
          </dl>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Paid now" htmlFor="paid">
              <Input id="paid" className="num" inputMode="decimal" value={paid} onChange={(e) => money.test(e.target.value) && setPaid(e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Method" htmlFor="method">
              <Select id="method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <button type="button" className="text-xs underline underline-offset-2" onClick={() => setPaid(fromPaisa(Math.max(0, total)))}>
            Paid in full
          </button>
          <p className="text-sm">
            {due > 0 ? (
              <>
                You will owe <span className="num font-medium text-negative">{formatMoney(fromPaisa(due), cur)}</span>
              </>
            ) : due < 0 ? (
              <span className="text-negative">Paid amount is more than the total.</span>
            ) : (
              'Fully paid.'
            )}
          </p>
          <Field label="Note" htmlFor="note">
            <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <Button className="w-full" disabled={!valid} loading={save.isPending} onClick={() => save.mutate(undefined)}>
            Save and receive stock
          </Button>
        </Panel>
      </div>
    </>
  );
}

export default function NewPurchasePage() {
  return (
    <RequirePermission permission={PERMISSIONS.PURCHASE_MANAGE}>
      <NewPurchase />
    </RequirePermission>
  );
}
