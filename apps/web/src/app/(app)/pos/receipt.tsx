'use client';
import * as React from 'react';
import { Download, Mail, Printer, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS } from '@hisabkhata/shared';
import { api, download, errorMessage, openPdf } from '@/lib/api';
import { useAction } from '@/hooks/use-api';
import { useCan } from '@/hooks/use-session';
import { useI18n } from '@/lib/i18n/client';
import { Money } from '@/components/money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** Shown after a successful sale. "New sale" has focus so Enter starts the next customer. */
export function Receipt({ sale, onNew }: { sale: any; onNew: () => void }) {
  const can = useCan();
  const { t, tr } = useI18n();
  const d = t.panel.pos.done;
  const [email, setEmail] = React.useState(sale.customer?.email ?? '');
  const send = useAction(
    () => api(`/invoices/${sale.id}/email`, { method: 'POST', body: email ? { to: email } : {} }),
    { success: (r: any) => d.sent(r.to) },
  );
  const fail = (e: unknown) => toast.error(tr(errorMessage(e)));
  return (
    <div className="space-y-5">
      <div className="rounded-md border bg-muted/40 p-4 text-center">
        <p className="text-sm text-muted-foreground">{d.invoice(sale.invoiceNo)}</p>
        <p className="mt-1 text-2xl font-semibold">
          <Money value={sale.total} />
        </p>
        {Number(sale.change) > 0 && (
          <p className="mt-3 text-base">
            {d.giveChange}{' '}
            <Money value={sale.change} className="text-2xl font-semibold text-positive" />
          </p>
        )}
        {Number(sale.dueAmount) > 0 && (
          <p className="mt-2 text-sm">
            {d.addedToDues(sale.customer?.name ?? '')}{' '}
            <Money value={sale.dueAmount} signed="negative" className="font-medium" />
          </p>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Button variant="outline" onClick={() => openPdf(`/invoices/${sale.id}/pdf`).catch(fail)}>
          <Printer /> {d.print}
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            download(`/invoices/${sale.id}/pdf`, undefined, `${sale.invoiceNo}.pdf`).catch(fail)
          }
        >
          <Download /> {d.download}
        </Button>
        <Button onClick={onNew} autoFocus>
          <ShoppingCart /> {d.newSale}
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
          <Input
            type="email"
            placeholder={d.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label={d.emailLabel}
          />
          <Button type="submit" variant="outline" loading={send.isPending} disabled={!email}>
            <Mail /> {d.email}
          </Button>
        </form>
      )}
    </div>
  );
}
