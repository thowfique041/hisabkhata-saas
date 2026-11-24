'use client';
import * as React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema } from '@hisabkhata/shared';
import { api, errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { AuthCard, FormError } from '@/components/auth-form';

export default function ForgotPasswordPage() {
  const [sent, setSent] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<{ email: string }>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: values });
      setSent(values.email);
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  if (sent) {
    return (
      <AuthCard title="Check your email" footer={<Link href="/login" className="font-medium text-foreground underline underline-offset-4">Back to sign in</Link>}>
        <p className="text-sm text-muted-foreground">
          If an account exists for <span className="font-medium text-foreground">{sent}</span>, we sent a link to reset the password. The link expires in 30 minutes.
        </p>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Reset your password" description="Enter the email you sign in with and we will send you a reset link." footer={<Link href="/login" className="font-medium text-foreground underline underline-offset-4">Back to sign in</Link>}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={error} />
        <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" autoFocus {...form.register('email')} />
        </Field>
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
          Send reset link
        </Button>
      </form>
    </AuthCard>
  );
}
