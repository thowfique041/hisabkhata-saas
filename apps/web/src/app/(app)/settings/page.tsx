'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { BUSINESS_TYPES, PERMISSIONS, tenantSettingsSchema } from '@hisabkhata/shared';
import { api, errorMessage } from '@/lib/api';
import { useAction, useApi, useList } from '@/hooks/use-api';
import { useCan } from '@/hooks/use-session';
import { PageHeader, Pagination, Panel, TableSkeleton } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Switch, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { FormError } from '@/components/auth-form';
import { RequirePermission } from '@/components/shell/guards';
import { formatDate, titleCase } from '@/lib/utils';

type Values = z.input<typeof tenantSettingsSchema>;
const TIMEZONES = ['Asia/Dhaka', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'UTC'];
const CURRENCIES = ['BDT', 'USD', 'EUR', 'GBP', 'INR'];

function Logo({ url }: { url?: string | null }) {
  const qc = useQueryClient();
  const [busy, setBusy] = React.useState(false);
  async function upload(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api('/files', { method: 'POST', body: fd, query: { kind: 'BUSINESS_LOGO' } });
      toast.success('Logo updated. It appears on new invoices.');
      qc.invalidateQueries();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex items-center gap-4">
      <div className="flex size-16 items-center justify-center overflow-hidden rounded-md border bg-muted/50 text-muted-foreground">{url ? <img src={url} alt="Business logo" className="size-full object-contain" /> : <ImagePlus className="size-5" />}</div>
      <div>
        <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
          {busy ? 'Uploading' : url ? 'Replace logo' : 'Upload logo'}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        <p className="mt-1 text-xs text-muted-foreground">PNG, JPEG or WebP up to 2 MB. Shown on invoices.</p>
      </div>
    </div>
  );
}

function BusinessForm({ t }: { t: any }) {
  const qc = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(tenantSettingsSchema),
    defaultValues: { ...t, email: t.email ?? '', phone: t.phone ?? '', address: t.address ?? '', taxId: t.taxId ?? '', invoiceFooter: t.invoiceFooter ?? '', defaultTaxRate: String(t.defaultTaxRate) },
  });
  const save = useAction((v: Values) => api('/tenant/settings', { method: 'PUT', body: v }), {
    success: 'Settings saved',
    invalidate: [['/tenant/settings']],
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session'] }),
  });
  const e = form.formState.errors;
  return (
    <form onSubmit={form.handleSubmit((v) => save.mutateAsync(v).catch((err) => setError(errorMessage(err))))} className="space-y-6" noValidate>
      <FormError message={error} />
      <Panel title="Business profile" bodyClass="grid gap-4 p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Logo url={t.logoUrl} />
        </div>
        <Field label="Business name" htmlFor="name" error={e.name?.message}>
          <Input id="name" {...form.register('name')} />
        </Field>
        <Field label="Business type" htmlFor="businessType">
          <Select id="businessType" {...form.register('businessType')}>
            {BUSINESS_TYPES.map((b) => (
              <option key={b} value={b}>
                {titleCase(b)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Phone" htmlFor="phone" error={e.phone?.message}>
          <Input id="phone" {...form.register('phone')} />
        </Field>
        <Field label="Email" htmlFor="email" error={e.email?.message}>
          <Input id="email" type="email" {...form.register('email')} />
        </Field>
        <Field label="Address" htmlFor="address" className="sm:col-span-2">
          <Textarea id="address" rows={2} {...form.register('address')} />
        </Field>
        <Field label="BIN / VAT registration" htmlFor="taxId">
          <Input id="taxId" {...form.register('taxId')} />
        </Field>
      </Panel>
      <Panel title="Money and invoices" bodyClass="grid gap-4 p-4 sm:grid-cols-2">
        <Field label="Currency" htmlFor="currency">
          <Select id="currency" {...form.register('currency')}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Time zone" htmlFor="timezone" error={e.timezone?.message} hint="Used for daily totals and invoice dates.">
          <Select id="timezone" {...form.register('timezone')}>
            {TIMEZONES.map((z) => (
              <option key={z}>{z}</option>
            ))}
          </Select>
        </Field>
        <Field label="Invoice number prefix" htmlFor="invoicePrefix" error={e.invoicePrefix?.message} hint="For example INV gives INV-2600001.">
          <Input id="invoicePrefix" className="uppercase" {...form.register('invoicePrefix')} />
        </Field>
        <Field label="Default tax %" htmlFor="defaultTaxRate" error={e.defaultTaxRate?.message} hint="Applied at the POS; can be changed per sale.">
          <Input id="defaultTaxRate" className="num" {...form.register('defaultTaxRate')} />
        </Field>
        <Field label="Invoice footer" htmlFor="invoiceFooter" className="sm:col-span-2" hint="Return policy, bank details or a thank-you note.">
          <Textarea id="invoiceFooter" rows={2} {...form.register('invoiceFooter')} />
        </Field>
      </Panel>
      <Panel title="Stock and alerts" bodyClass="divide-y">
        <label className="flex items-center justify-between gap-4 p-4">
          <span>
            <span className="block text-sm font-medium">Allow selling below zero stock</span>
            <span className="block text-sm text-muted-foreground">Turn on only if you often sell before recording a purchase. Stock will show negative numbers.</span>
          </span>
          <Switch checked={form.watch('allowNegativeStock')} onCheckedChange={(v) => form.setValue('allowNegativeStock', v, { shouldDirty: true })} />
        </label>
        <label className="flex items-center justify-between gap-4 p-4">
          <span>
            <span className="block text-sm font-medium">Daily low-stock email</span>
            <span className="block text-sm text-muted-foreground">Owners and managers get one email each morning listing products to restock.</span>
          </span>
          <Switch checked={form.watch('lowStockEmail')} onCheckedChange={(v) => form.setValue('lowStockEmail', v, { shouldDirty: true })} />
        </label>
      </Panel>
      <div className="flex justify-end">
        <Button type="submit" loading={save.isPending}>
          Save settings
        </Button>
      </div>
    </form>
  );
}

function Activity() {
  const list = useList<any>('/audit-logs', { pageSize: 30 });
  return (
    <div className="rounded-lg border bg-surface">
      {list.isLoading ? (
        <TableSkeleton />
      ) : (
        <table className="ledger">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap text-muted-foreground">{formatDate(a.createdAt, undefined, true)}</td>
                <td>{a.user?.name ?? 'System'}</td>
                <td>{a.action.replace('.', ': ').replace(/_/g, ' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {list.data && <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} onPage={list.setPage} />}
    </div>
  );
}

export default function SettingsPage() {
  const { data } = useApi<any>('/tenant/settings');
  const can = useCan();
  return (
    <RequirePermission permission={PERMISSIONS.SETTINGS_MANAGE}>
      <PageHeader title="Settings" description="Business details, invoice options and stock rules." />
      <Tabs defaultValue="business">
        <TabsList className="mb-6">
          <TabsTrigger value="business">Business</TabsTrigger>
          {can(PERMISSIONS.AUDIT_VIEW) && <TabsTrigger value="activity">Activity log</TabsTrigger>}
        </TabsList>
        <TabsContent value="business" className="max-w-3xl">
          {data ? <BusinessForm t={data} /> : <TableSkeleton />}
        </TabsContent>
        <TabsContent value="activity">
          <Activity />
        </TabsContent>
      </Tabs>
    </RequirePermission>
  );
}
