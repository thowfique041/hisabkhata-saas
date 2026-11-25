'use client';
import * as React from 'react';
import { PauseCircle, PlayCircle, Trash2 } from 'lucide-react';
import type { HeldBill } from '@/lib/held-bills';
import { useI18n } from '@/lib/i18n/client';
import { useConfirm } from '@/components/confirm';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { fromPaisa, lineTotal } from '@/lib/paisa';
import { useMoney } from '@/components/money';

export function HoldDialog({
  open,
  onOpenChange,
  onHold,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onHold: (label: string) => void;
}) {
  const { t } = useI18n();
  const p = t.panel.pos;
  const [label, setLabel] = React.useState('');
  React.useEffect(() => {
    if (open) setLabel('');
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent title={p.holdTitle} description={p.holdDescription}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              onHold(label.trim());
            }}
          >
            <Field label={p.holdLabel} htmlFor="hold-label">
              <Input
                id="hold-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={p.holdPlaceholder}
                maxLength={60}
                autoFocus
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t.panel.common.cancel}
              </Button>
              <Button type="submit">
                <PauseCircle /> {p.holdConfirm}
              </Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

export function HeldBillsDialog({
  open,
  onOpenChange,
  bills,
  onResume,
  onDiscard,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  bills: HeldBill[];
  onResume: (b: HeldBill) => void;
  onDiscard: (id: string) => void;
}) {
  const { t, locale } = useI18n();
  const p = t.panel.pos;
  const fmt = useMoney();
  const confirm = useConfirm();
  const time = (iso: string) =>
    new Intl.DateTimeFormat(locale === 'bn' ? 'bn-BD' : 'en-GB', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Dhaka',
    }).format(new Date(iso));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent title={p.heldTitle} description={p.heldDescription}>
          {bills.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{p.heldEmpty}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {bills.map((b) => {
                const total = b.lines.reduce(
                  (a, l) => a + lineTotal(l.quantity, l.price, l.discount || '0'),
                  0,
                );
                return (
                  <li key={b.id} className="flex items-center gap-3 px-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {b.label || b.customer?.name || t.panel.common.walkIn}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.items(b.lines.length)},{' '}
                        <span className="num">{fmt(fromPaisa(total))}</span>,{' '}
                        {p.heldAt(time(b.createdAt))}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => onResume(b)}>
                      <PlayCircle /> {p.resume}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t.panel.common.discard}
                      onClick={async () => {
                        if (
                          await confirm({
                            title: p.discardHeld,
                            description: p.discardHeldBody,
                            confirmLabel: t.panel.common.discard,
                            destructive: true,
                          })
                        )
                          onDiscard(b.id);
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
