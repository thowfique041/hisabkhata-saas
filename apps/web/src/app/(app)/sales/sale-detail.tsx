'use client';
import * as React from 'react';
import { Ban, Mail, Printer, RotateCcw, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { formatQty, PAYMENT_METHOD_LABELS, PAYMENT_METHODS, PERMISSIONS, type PaymentMethod } from '@hisabkhata/shared';
import { api, errorMessage, openPdf } from '@/lib/api';
import { useAction, useApi } from '@/hooks/use-api';
import { useCan, useSession } from '@/hooks/use-session';
import { Money } from '@/components/money';
import { Stat, TableSkeleton } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { SaleStatusBadge } from '@/components/status';
import { PaymentForm } from '@/components/payment-form';
import { useConfirm } from '@/components/confirm';
import { formatDate, titleCase } from '@/lib/utils';

const INV = [['/sales'], ['/products'], ['/dashboard'], ['/invoices'], ['/customers']];

function RefundForm({ sale, onDone }: { sale: any; onDone: () => void }) {
  const [qty, setQty] = React.useState<Record<string, string>>({});
  const [method, setMethod] = React.useState<PaymentMethod>('CASH');
  const [reason, setReason] = React.useState('');
  const refund = useAction(
    () => api(`/sales/${sale.id}/refunds`, { method: 'POST', body: { items: Object.entries(qty).filter(([, q]) => Number(q) > 0).map(([saleItemId, quantity]) => ({ saleItemId, quantity })), method, reason: reason || undefined } }),
    { success: (r: any) => (Number(r.cashBack) > 0 ? `Return recorded. Pay back ${r.cashBack}` : 'Return recorded against the amount due'), invalidate: INV, onSuccess: onDone },
  );
  const any = Object.values(qty).some((q) => Number(q) > 0);
  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-sm font-medium">Return items</p>
      {sale.items.map((it: any) => {
        const left = Number(it.quantity) - Number(it.refundedQty);
        if (left <= 0) return null;
        return (
          <div key={it.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 flex-1 truncate">{it.productName}</span>
            <span className="text-xs text-muted-foreground">of {formatQty(String(left))}</span>
            <Input className="num h-8 w-20" inputMode="decimal" placeholder="0" value={qty[it.id] ?? ''} onChange={(e) => setQty((q) => ({ ...q, [it.id]: e.target.value }))} aria-label={`Return quantity for ${it.productName}`} />
          </div>
        );
      })}
      <div className="grid grid-cols-2 gap-2">
        <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} aria-label="Refund method">
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              Refund by {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </Select>
        <Input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <p className="text-xs text-muted-foreground">Returned items go back into stock. The refund first reduces any amount the customer still owes.</p>
      <Button size="sm" disabled={!any} loading={refund.isPending} onClick={() => refund.mutate(undefined)}>
        Record return
      </Button>
    </div>
  );
}

export function SaleDetail({ id }: { id: string }) {
  const { data: s, refetch } = useApi<any>(`/sales/${id}`);
  const can = useCan();
  const tz = useSession().data?.activeTenant?.timezone;
  const confirm = useConfirm();
  const [mode, setMode] = React.useState<'pay' | 'refund' | null>(null);
  const pay = useAction((v: any) => api(`/sales/${id}/payments`, { method: 'POST', body: v }), { success: 'Payment recorded', invalidate: INV, onSuccess: () => setMode(null) });
  const cancel = useAction((reason?: string) => api(`/sales/${id}/cancel`, { method: 'POST', body: { reason } }), { success: 'Sale cancelled and stock restored', invalidate: INV });
  const email = useAction(() => api(`/invoices/${id}/email`, { method: 'POST', body: {} }), { success: (r: any) => `Invoice sent to ${r.to}` });
  if (!s) return <TableSkeleton rows={6} cols={2} />;
  const open = s.status !== 'CANCELLED' && s.status !== 'REFUNDED';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => openPdf(`/invoices/${id}/pdf`).catch((e) => toast.error(errorMessage(e)))}>
          <Printer /> Invoice PDF
        </Button>
        {can(PERMISSIONS.INVOICE_SEND) && s.customer?.email && (
          <Button variant="outline" size="sm" onClick={() => email.mutate(undefined)} loading={email.isPending}>
            <Mail /> Email invoice
          </Button>
        )}
        {open && Number(s.dueAmount) > 0 && can(PERMISSIONS.PAYMENT_RECEIVE) && (
          <Button size="sm" onClick={() => setMode(mode === 'pay' ? null : 'pay')}>
            <Wallet /> Receive payment
          </Button>
        )}
        {open && can(PERMISSIONS.SALE_REFUND) && (
          <Button variant="outline" size="sm" onClick={() => setMode(mode === 'refund' ? null : 'refund')}>
            <RotateCcw /> Return items
          </Button>
        )}
        {s.status === 'COMPLETED' && can(PERMISSIONS.SALE_CANCEL) && (
          <Button
            variant="outline"
            size="sm"
            className="text-negative"
            onClick={async () => {
              const ok = await confirm({ title: `Cancel ${s.invoiceNo}?`, description: 'All items go back into stock and anything paid is recorded as refunded. This cannot be undone.', confirmLabel: 'Cancel sale', destructive: true, withReason: true });
              if (ok) cancel.mutate(ok.reason);
            }}
          >
            <Ban /> Cancel sale
          </Button>
        )}
      </div>
      {mode === 'pay' && <PaymentForm max={String(s.dueAmount)} submitLabel="Record payment" pending={pay.isPending} onSubmit={(v) => pay.mutate(v)} />}
      {mode === 'refund' && (
        <RefundForm
          sale={s}
          onDone={() => {
            setMode(null);
            refetch();
          }}
        />
      )}

      <div>
        <Stat label="Status">
          <SaleStatusBadge status={s.status} paymentStatus={s.paymentStatus} />
        </Stat>
        <Stat label="Date">{formatDate(s.createdAt, tz, true)}</Stat>
        <Stat label="Customer">{s.customer?.name ?? 'Walk-in'}</Stat>
        {s.cancelReason && <Stat label="Cancel reason">{s.cancelReason}</Stat>}
      </div>

      <table className="ledger rounded-md border">
        <thead>
          <tr>
            <th>Item</th>
            <th className="r">Qty</th>
            <th className="r">Price</th>
            <th className="r">Amount</th>
          </tr>
        </thead>
        <tbody>
          {s.items.map((it: any) => (
            <tr key={it.id}>
              <td>
                {it.productName}
                {Number(it.refundedQty) > 0 && <p className="text-xs text-negative">Returned {formatQty(it.refundedQty)}</p>}
                {Number(it.discount) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Discount <Money value={it.discount} />
                  </p>
                )}
              </td>
              <td className="r">
                {formatQty(it.quantity)} {it.unit}
              </td>
              <td className="r">
                <Money value={it.unitPrice} />
              </td>
              <td className="r">
                <Money value={it.lineTotal} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto max-w-xs">
        <Stat label="Subtotal">
          <Money value={s.subtotal} />
        </Stat>
        {Number(s.discount) > 0 && (
          <Stat label="Discount">
            -<Money value={s.discount} />
          </Stat>
        )}
        {Number(s.tax) > 0 && (
          <Stat label={`Tax (${s.taxRate}%)`}>
            <Money value={s.tax} />
          </Stat>
        )}
        <Stat label="Total">
          <Money value={s.total} className="text-base font-semibold" />
        </Stat>
        {Number(s.refundedAmount) > 0 && (
          <Stat label="Returned">
            <Money value={s.refundedAmount} signed="negative" />
          </Stat>
        )}
        <Stat label="Paid">
          <Money value={s.paidAmount} signed="positive" />
        </Stat>
        <Stat label="Due">
          <Money value={s.dueAmount} signed={Number(s.dueAmount) > 0 ? 'negative' : undefined} />
        </Stat>
      </div>

      {s.payments.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Payments</h3>
          <table className="ledger rounded-md border">
            <tbody>
              {s.payments.map((p: any) => (
                <tr key={p.id}>
                  <td className="text-xs text-muted-foreground">{formatDate(p.createdAt, tz, true)}</td>
                  <td>
                    {PAYMENT_METHOD_LABELS[p.method as PaymentMethod]}
                    <span className="text-xs text-muted-foreground"> {titleCase(p.kind)}</span>
                    {p.reference && <p className="text-xs text-muted-foreground">{p.reference}</p>}
                  </td>
                  <td className="r">
                    <Money value={p.direction === 'OUT' ? `-${p.amount}` : p.amount} signed={p.direction === 'OUT' ? 'negative' : 'positive'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
