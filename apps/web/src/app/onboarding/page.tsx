'use client';
import * as React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { BUSINESS_TYPES, createTenantSchema } from '@hisabkhata/shared';
import { api, errorMessage } from '@/lib/api';
import { titleCase } from '@/lib/utils';
import { useSession, useSwitchTenant } from '@/hooks/use-session';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Badge } from '@/components/ui/misc';
import { FormError } from '@/components/auth-form';

export default function OnboardingPage() {
  const { data } = useSession();
  const switchTenant = useSwitchTenant();
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<z.input<typeof createTenantSchema>>({ resolver: zodResolver(createTenantSchema), defaultValues: { name: '', businessType: 'RETAIL' } });

  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      const t = await api<{ id: string }>('/tenants', { method: 'POST', body: v });
      await switchTenant(t.id);
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  const active = data?.tenants.filter((t) => t.status === 'ACTIVE') ?? [];
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-lg">
        <Logo />
        <h1 className="mt-10 text-xl font-semibold">{active.length ? 'Choose a business' : 'Set up your business'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {active.length ? 'You are a member of these businesses. Pick one to open, or add another.' : 'Your account is not linked to a business yet. Create one to start recording stock and sales.'}
        </p>

        {!!data?.tenants.length && (
          <ul className="mt-6 divide-y rounded-lg border bg-surface">
            {data.tenants.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
                {t.status === 'ACTIVE' ? (
                  <Button size="sm" variant="outline" onClick={() => switchTenant(t.id)}>
                    Open
                  </Button>
                ) : (
                  <Badge tone="negative">Suspended</Badge>
                )}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-lg border bg-surface p-6" noValidate>
          <h2 className="text-sm font-semibold">New business</h2>
          <FormError message={error} />
          <Field label="Business name" htmlFor="name" error={form.formState.errors.name?.message}>
            <Input id="name" {...form.register('name')} placeholder="e.g. Shapla Pharmacy" />
          </Field>
          <Field label="Business type" htmlFor="businessType">
            <Select id="businessType" {...form.register('businessType')}>
              {BUSINESS_TYPES.map((t) => (
                <option key={t} value={t}>
                  {titleCase(t)}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" loading={form.formState.isSubmitting}>
            Create business
          </Button>
        </form>
        {data?.user.isSuperAdmin && (
          <p className="mt-6 text-sm">
            <Link href="/super-admin" className="underline underline-offset-4">
              Go to platform admin
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
