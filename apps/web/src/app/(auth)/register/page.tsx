'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { BUSINESS_TYPES, registerSchema } from '@hisabkhata/shared';
import { api, errorMessage } from '@/lib/api';
import { titleCase } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, PasswordInput, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { AuthCard, ConnectingNotice, FormError } from '@/components/auth-form';
import { whenApiReady } from '@/lib/wake';
import { useI18n } from '@/lib/i18n/client';

const formSchema = registerSchema
  .extend({ confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type Values = z.input<typeof formSchema>;

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const { t, tr } = useI18n();
  const r = t.auth.register;
  const [connecting, setConnecting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      businessName: '',
      businessType: 'RETAIL',
      phone: '',
    },
  });
  const e = form.formState.errors;

  const onSubmit = form.handleSubmit(async ({ confirmPassword: _confirm, ...values }) => {
    setError(null);
    try {
      await whenApiReady(
        () => api('/auth/register', { method: 'POST', body: values }),
        setConnecting,
      );
      qc.clear();
      router.replace('/dashboard?welcome=1');
    } catch (err) {
      setError(tr(errorMessage(err)) ?? null);
    }
  });

  return (
    <AuthCard
      title={r.title}
      description={params.get('plan') ? r.descriptionPlan : r.description}
      footer={
        <>
          {r.haveAccount}{' '}
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
            {r.signIn}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} method="post" className="space-y-4" noValidate>
        <FormError message={error} />
        <ConnectingNotice show={connecting} />
        <Field label={r.name} htmlFor="name" error={tr(e.name?.message)}>
          <Input id="name" autoComplete="name" {...form.register('name')} aria-invalid={!!e.name} />
        </Field>
        <Field label={r.email} htmlFor="email" error={tr(e.email?.message)}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            {...form.register('email')}
            aria-invalid={!!e.email}
          />
        </Field>
        <Field
          label={r.password}
          htmlFor="password"
          error={tr(e.password?.message)}
          hint={r.passwordHint}
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
            {...form.register('password')}
            aria-invalid={!!e.password}
          />
        </Field>
        <Field label={r.confirm} htmlFor="confirmPassword" error={tr(e.confirmPassword?.message)}>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            {...form.register('confirmPassword')}
            aria-invalid={!!e.confirmPassword}
          />
        </Field>
        <div className="border-t pt-4" />
        <Field label={r.business} htmlFor="businessName" error={tr(e.businessName?.message)}>
          <Input
            id="businessName"
            placeholder={r.businessPlaceholder}
            {...form.register('businessName')}
            aria-invalid={!!e.businessName}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={r.businessType} htmlFor="businessType">
            <Select id="businessType" {...form.register('businessType')}>
              {BUSINESS_TYPES.map((b) => (
                <option key={b} value={b}>
                  {t.auth.businessTypes[b] ?? titleCase(b)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={r.mobile} htmlFor="phone" error={tr(e.phone?.message)}>
            <Input
              id="phone"
              type="tel"
              placeholder="01XXXXXXXXX"
              {...form.register('phone')}
              aria-invalid={!!e.phone}
            />
          </Field>
        </div>
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
          {r.submit}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function RegisterPage() {
  return (
    <React.Suspense>
      <RegisterForm />
    </React.Suspense>
  );
}
