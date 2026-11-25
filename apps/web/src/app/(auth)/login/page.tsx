'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { loginSchema, type LoginInput } from '@hisabkhata/shared';
import { api, errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, PasswordInput } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { AuthCard, ConnectingNotice, FormError } from '@/components/auth-form';
import { whenApiReady } from '@/lib/wake';
import { useI18n } from '@/lib/i18n/client';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const { t, tr } = useI18n();
  const [connecting, setConnecting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(() =>
    params.get('offline') ? t.common.offline : null,
  );
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await whenApiReady(() => api('/auth/login', { method: 'POST', body: values }), setConnecting);
      qc.clear();
      const next = params.get('next');
      router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard');
    } catch (err) {
      setError(tr(errorMessage(err)) ?? null);
    }
  });

  return (
    <AuthCard
      title={t.auth.login.title}
      description={t.auth.login.description}
      footer={
        <>
          {t.auth.login.newHere}{' '}
          <Link
            href="/register"
            className="font-medium text-foreground underline underline-offset-4"
          >
            {t.auth.login.create}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} method="post" className="space-y-4" noValidate>
        <FormError message={error} />
        <ConnectingNotice show={connecting} />
        <Field
          label={t.auth.login.email}
          htmlFor="email"
          error={tr(form.formState.errors.email?.message)}
        >
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            {...form.register('email')}
            aria-invalid={!!form.formState.errors.email}
          />
        </Field>
        <Field
          label={t.auth.login.password}
          htmlFor="password"
          error={tr(form.formState.errors.password?.message)}
        >
          <PasswordInput
            id="password"
            autoComplete="current-password"
            {...form.register('password')}
            aria-invalid={!!form.formState.errors.password}
          />
        </Field>
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t.auth.login.forgot}
          </Link>
        </div>
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
          {t.auth.login.submit}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense>
      <LoginForm />
    </React.Suspense>
  );
}
