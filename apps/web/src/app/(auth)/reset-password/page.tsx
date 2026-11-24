'use client';
import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { password } from '@hisabkhata/shared';
import { api, errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { AuthCard, FormError } from '@/components/auth-form';

const schema = z.object({ password, confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

function ResetForm() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const invite = params.get('invite') === '1';
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } });

  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, password: v.password } });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  if (!token) {
    return (
      <AuthCard title="This link is incomplete" footer={<Link href="/forgot-password" className="font-medium text-foreground underline underline-offset-4">Request a new link</Link>}>
        <p className="text-sm text-muted-foreground">Open the link from your email again, or request a new one.</p>
      </AuthCard>
    );
  }
  if (done) {
    return (
      <AuthCard title={invite ? 'Your account is ready' : 'Password updated'}>
        <p className="mb-5 text-sm text-muted-foreground">{invite ? 'You can now sign in with your new password.' : 'For your security, you were signed out on all devices.'}</p>
        <Button asChild className="w-full">
          <Link href="/login">Sign in</Link>
        </Button>
      </AuthCard>
    );
  }
  return (
    <AuthCard title={invite ? 'Set your password' : 'Choose a new password'} description={invite ? 'You were invited to a business on HisabKhata. Choose a password to finish setting up your account.' : undefined}>
      <form onSubmit={onSubmit} method="post" className="space-y-4" noValidate>
        <FormError message={error} />
        <Field label="New password" htmlFor="password" error={form.formState.errors.password?.message} hint="At least 8 characters with letters and numbers.">
          <Input id="password" type="password" autoComplete="new-password" autoFocus {...form.register('password')} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={form.formState.errors.confirm?.message}>
          <Input id="confirm" type="password" autoComplete="new-password" {...form.register('confirm')} />
        </Field>
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
          {invite ? 'Set password' : 'Update password'}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense>
      <ResetForm />
    </React.Suspense>
  );
}
