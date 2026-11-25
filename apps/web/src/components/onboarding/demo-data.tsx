'use client';
import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useApi } from '@/hooks/use-api';
import { useSession } from '@/hooks/use-session';
import { useI18n } from '@/lib/i18n/client';
import { useConfirm } from '@/components/confirm';
import { Button, type ButtonProps } from '@/components/ui/button';

export function useDemoStatus() {
  return useApi<{ loaded: boolean; products: number; sales: number; customers: number }>('/demo');
}

function useIsOwner() {
  return useSession().data?.activeTenant?.roleKey === 'OWNER';
}

/** Everything on screen depends on demo rows, so refresh every cached list afterwards. */
function useDemoAction() {
  const qc = useQueryClient();
  const { t, tr } = useI18n();
  const o = t.panel.onboarding;
  const confirm = useConfirm();
  const [busy, setBusy] = React.useState(false);
  const run = async (kind: 'load' | 'remove') => {
    const ok = await confirm(
      kind === 'load'
        ? { title: o.demoLoadTitle, description: o.demoLoadBody, confirmLabel: o.demoLoad }
        : {
            title: o.demoRemoveTitle,
            description: o.demoRemoveBody,
            confirmLabel: o.demoRemove,
            destructive: true,
          },
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res: any = await api('/demo', { method: kind === 'load' ? 'POST' : 'DELETE' });
      await qc.invalidateQueries();
      if (kind === 'load') toast.success(o.demoLoaded(res.sales));
      else {
        toast.success(o.demoRemoved);
        const kept =
          (res.kept?.products ?? 0) + (res.kept?.customers ?? 0) + (res.kept?.suppliers ?? 0);
        if (kept) toast.message(o.demoKept(kept));
      }
    } catch (err) {
      toast.error(tr(errorMessage(err)));
    } finally {
      setBusy(false);
    }
  };
  return { run, busy };
}

export function LoadDemoButton(props: Omit<ButtonProps, 'onClick'>) {
  const { t } = useI18n();
  const owner = useIsOwner();
  const { data } = useDemoStatus();
  const { run, busy } = useDemoAction();
  if (!owner || !data || data.loaded) return null;
  return (
    <Button variant="outline" {...props} loading={busy} onClick={() => run('load')}>
      <FlaskConical /> {t.panel.onboarding.demoLoad}
    </Button>
  );
}

/** Slim notice while demo rows exist, with the one-click way out (owners only). */
export function DemoBanner() {
  const { t } = useI18n();
  const o = t.panel.onboarding;
  const owner = useIsOwner();
  const { data } = useDemoStatus();
  const { run, busy } = useDemoAction();
  if (!data?.loaded) return null;
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-lg border border-sky-soft/60 bg-accent px-4 py-3 text-sm text-accent-foreground sm:flex-row sm:items-center">
      <FlaskConical className="hidden size-5 shrink-0 sm:block" aria-hidden />
      <p className="flex-1">
        <span className="font-medium">{o.demoBanner}</span> {o.demoBannerBody}
      </p>
      {owner && (
        <Button size="sm" variant="outline" loading={busy} onClick={() => run('remove')}>
          <Trash2 /> {o.demoRemove}
        </Button>
      )}
    </div>
  );
}
