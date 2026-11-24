'use client';
import * as React from 'react';
import { Mail, Printer, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS } from '@hisabkhata/shared';
import { api, errorMessage, openPdf } from '@/lib/api';
import { useAction, useList } from '@/hooks/use-api';
import { useCan, useSession } from '@/hooks/use-session';
import { Money } from '@/components/money';
import { EmptyState, ErrorState, PageHeader, Pagination, SearchInput, TableSkeleton } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field } from '@/components/ui/label';
import { SaleStatusBadge } from '@/components/status';
import { RequirePermission } from '@/components/shell/guards';
import { formatDate } from '@/lib/utils';

function Invoices() {
  const can = useCan();
  const tz = useSession().data?.activeTenant?.timezone;
  const list = useList<any>('/invoices', { pageSize: 25 });
  const [emailFor, setEmailFor] = React.useState<any | null>(null);
  const [to, setTo] = React.useState('');
  const send = useAction(() => api(`/invoices/${emailFor.saleId}/email`, { method: 'POST', body: { to } }), {
    success: (r: any) => `Invoice queued for ${r.to}`,
    invalidate: [['/invoices']],
    onSuccess: () => setEmailFor(null),
  });
  const items = list.data?.items ?? [];
  return (
    <>
      <PageHeader title="Invoices" description="An invoice is created for every sale. Download or email it from here." />
      <div className="rounded-lg border bg-surface">
        <div className="border-b p-3">
          <SearchInput value={String(list.params.search ?? '')} onChange={(v) => list.set({ search: v })} placeholder="Invoice no. or customer" />
        </div>
        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : list.isLoading ? (
          <TableSkeleton />
        ) : !items.length ? (
          <EmptyState icon={Receipt} title="No invoices yet" description="Invoices appear automatically when you make a sale." />
        ) : (
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th className="hidden md:table-cell">Issued</th>
                  <th>Status</th>
                  <th className="r">Total</th>
                  <th className="r hidden sm:table-cell">Due</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td className="font-medium">
                      {i.invoiceNo}
                      {i.emailedTo && <p className="text-xs font-normal text-muted-foreground">Emailed {formatDate(i.emailedAt, tz)}</p>}
                    </td>
                    <td>{i.sale.customer?.name ?? <span className="text-muted-foreground">Walk-in</span>}</td>
                    <td className="hidden text-muted-foreground md:table-cell">{formatDate(i.issuedAt, tz)}</td>
                    <td>
                      <SaleStatusBadge status={i.sale.status} paymentStatus={i.sale.paymentStatus} />
                    </td>
                    <td className="r">
                      <Money value={i.sale.total} />
                    </td>
                    <td className="r hidden sm:table-cell">{Number(i.sale.dueAmount) > 0 ? <Money value={i.sale.dueAmount} signed="negative" /> : <span className="text-muted-foreground">-</span>}</td>
                    <td className="whitespace-nowrap text-right">
                      <Button variant="ghost" size="icon" aria-label={`Open ${i.invoiceNo}`} onClick={() => openPdf(`/invoices/${i.saleId}/pdf`).catch((e) => toast.error(errorMessage(e)))}>
                        <Printer />
                      </Button>
                      {can(PERMISSIONS.INVOICE_SEND) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Email ${i.invoiceNo}`}
                          onClick={() => {
                            setTo(i.sale.customer?.email ?? '');
                            setEmailFor(i);
                          }}
                        >
                          <Mail />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.data && <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} onPage={list.setPage} />}
      </div>
      <Dialog open={!!emailFor} onOpenChange={(o) => !o && setEmailFor(null)}>
        {emailFor && (
          <DialogContent title={`Email ${emailFor.invoiceNo}`} description="The invoice PDF is attached to the email.">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                send.mutate(undefined);
              }}
            >
              <Field label="Send to" htmlFor="to">
                <Input id="to" type="email" required value={to} onChange={(e) => setTo(e.target.value)} autoFocus />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" loading={send.isPending}>
                  Send invoice
                </Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

export default function InvoicesPage() {
  return (
    <RequirePermission permission={PERMISSIONS.INVOICE_VIEW}>
      <Invoices />
    </RequirePermission>
  );
}
