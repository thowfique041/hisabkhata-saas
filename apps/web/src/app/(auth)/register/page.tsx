'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { BUSINESS_TYPES, registerSchema } from '@hisabkhata/shared';
import { api, errorMessage } from '@/lib/api';
import { titleCase } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { AuthCard, FormError } from '@/components/auth-form';

type Values = z.input<typeof registerSchema>;

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', businessName: '', businessType: 'RETAIL', phone: '' },
  });
  const e = form.formState.errors;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await api('/auth/register', { method: 'POST', body: values });
      qc.clear();
      router.replace('/dashboard?welcome=1');
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  return (
    <AuthCard
      title="Create your account"
      description={params.get('plan') ? 'Start with a 14-day Basic trial. No card needed.' : 'Set up your business in under a minute. Every new account starts with a 14-day Basic trial.'}
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} method="post" className="space-y-4" noValidate>
        <FormError message={error} />
        <Field label="Your name" htmlFor="name" error={e.name?.message}>
          <Input id="name" autoComplete="name" {...form.register('name')} aria-invalid={!!e.name} />
        </Field>
        <Field label="Email" htmlFor="email" error={e.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...form.register('email')} aria-invalid={!!e.email} />
        </Field>
        <Field label="Password" htmlFor="password" error={e.password?.message} hint="At least 8 characters with letters and numbers.">
          <Input id="password" type="password" autoComplete="new-password" {...form.register('password')} aria-invalid={!!e.password} />
        </Field>
        <div className="border-t pt-4" />
        <Field label="Business name" htmlFor="businessName" error={e.businessName?.message}>
          <Input id="businessName" placeholder="e.g. Rahman General Store" {...form.register('businessName')} aria-invalid={!!e.businessName} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business type" htmlFor="businessType">
            <Select id="businessType" {...form.register('businessType')}>
              {BUSINESS_TYPES.map((t) => (
                <option key={t} value={t}>
                  {titleCase(t)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Mobile (optional)" htmlFor="phone" error={e.phone?.message}>
            <Input id="phone" type="tel" placeholder="01XXXXXXXXX" {...form.register('phone')} aria-invalid={!!e.phone} />
          </Field>
        </div>
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
          Create account
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
