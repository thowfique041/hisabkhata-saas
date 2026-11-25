import { ArrowRight, FileText, ScanBarcode } from 'lucide-react';
import type { Dictionary } from '@/lib/i18n';

type V = Dictionary['home']['stepVisual'];

const frame = 'mt-5 rounded-md border bg-background/60 p-3 text-xs shadow-sm';

/** Step 1: the counter search box, mid-scan. */
export function ScanVisual({ v }: { v: V }) {
  return (
    <div className={frame} aria-hidden>
      <div className="flex h-8 items-center gap-2 rounded border bg-surface px-2.5 text-muted-foreground">
        <ScanBarcode className="size-4 text-foreground" />
        <span className="truncate">{v.search}</span>
        <span className="ml-auto h-3.5 w-px animate-pulse bg-foreground" />
      </div>
      <div className="mt-2 flex items-center justify-between rounded bg-accent px-2.5 py-2 text-accent-foreground">
        <span className="font-medium">{v.found}</span>
        <span className="text-muted-foreground">{v.inStock}</span>
      </div>
    </div>
  );
}

/** Step 2: stock goes down and the customer's dues go up, together. */
export function LedgerVisual({ v }: { v: V }) {
  return (
    <div className={frame} aria-hidden>
      <div className="flex items-center justify-between py-1">
        <span className="text-muted-foreground">{v.stock}</span>
        <span className="num inline-flex items-center gap-1.5 font-medium">
          6 <ArrowRight className="size-3 text-muted-foreground" />{' '}
          <span className="rounded bg-warning/10 px-1.5 py-0.5 text-warning">4</span>
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 border-t py-1 pt-2">
        <span className="text-muted-foreground">{v.dues}</span>
        <span className="num whitespace-nowrap rounded bg-negative/10 px-1.5 py-0.5 font-medium text-negative">
          +৳2,060.00
        </span>
      </div>
    </div>
  );
}

/** Step 3: a thumbnail of the printed invoice. */
export function InvoiceVisual({ v }: { v: V }) {
  return (
    <div className={`${frame} flex items-center gap-3`} aria-hidden>
      <div className="relative h-20 w-16 shrink-0 rounded-sm border bg-surface p-1.5 shadow">
        <div className="h-1.5 w-7 rounded-sm bg-navy dark:bg-slate-300" />
        <div className="mt-2 space-y-1">
          {[10, 8, 9, 7].map((w, i) => (
            <div key={i} className="flex justify-between">
              <div
                className="h-0.5 rounded bg-muted-foreground/40"
                style={{ width: `${w * 3}px` }}
              />
              <div className="h-0.5 w-2 rounded bg-muted-foreground/40" />
            </div>
          ))}
        </div>
        <div className="absolute inset-x-1.5 bottom-2 flex justify-end">
          <div className="h-1 w-5 rounded-sm bg-emerald" />
        </div>
        <span className="absolute -right-2 -top-2 rounded bg-negative px-1 text-[9px] font-semibold text-white">
          {v.pdf}
        </span>
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 font-medium">
          <FileText className="size-3.5 shrink-0" />
          <span className="truncate">{v.invoiceNo}</span>
        </p>
        <p className="num mt-1 text-muted-foreground">৳5,060.00</p>
      </div>
    </div>
  );
}
