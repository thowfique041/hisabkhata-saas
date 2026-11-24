'use client';
import * as React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';

type ConfirmOptions = { title: string; description: string; confirmLabel: string; destructive?: boolean; withReason?: boolean };
type Pending = ConfirmOptions & { resolve: (v: { reason?: string } | null) => void };

const Ctx = React.createContext<(o: ConfirmOptions) => Promise<{ reason?: string } | null>>(async () => null);

/** Promise-based confirmation, required before every destructive action. */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [reason, setReason] = React.useState('');
  const confirm = React.useCallback(
    (o: ConfirmOptions) =>
      new Promise<{ reason?: string } | null>((resolve) => {
        setReason('');
        setPending({ ...o, resolve });
      }),
    [],
  );
  const close = (v: { reason?: string } | null) => {
    pending?.resolve(v);
    setPending(null);
  };
  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Dialog open={!!pending} onOpenChange={(o) => !o && close(null)}>
        {pending && (
          <DialogContent title={pending.title} description={pending.description}>
            {pending.withReason && <Textarea placeholder="Reason (optional, kept in the audit log)" value={reason} onChange={(e) => setReason(e.target.value)} className="mb-4" maxLength={300} />}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => close(null)}>
                Keep it
              </Button>
              <Button variant={pending.destructive ? 'destructive' : 'default'} onClick={() => close({ reason: reason || undefined })}>
                {pending.confirmLabel}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </Ctx.Provider>
  );
}

export const useConfirm = () => React.useContext(Ctx);
