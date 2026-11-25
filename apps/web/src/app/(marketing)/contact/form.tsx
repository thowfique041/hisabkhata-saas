'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import { contactSchema } from '@hisabkhata/shared';
import { api, errorMessage } from '@/lib/api';
import { whenApiReady } from '@/lib/wake';
import { useI18n } from '@/lib/i18n/client';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { ConnectingNotice, FormError } from '@/components/auth-form';

type Values = { name: string; email: string; message: string };

export function ContactForm() {
  const { t, tr } = useI18n();
  const c = t.contact;
  const [sent, setSent] = React.useState(false);
  const [connecting, setConnecting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(contactSchema),
    // Validate as the visitor types once they have tried to submit, and on leaving a field.
    mode: 'onTouched',
    defaultValues: { name: '', email: '', message: '' },
  });
  const e = form.formState.errors;

  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await whenApiReady(() => api('/public/contact', { method: 'POST', body: v }), setConnecting);
      setSent(true);
      form.reset();
    } catch (err) {
      setError(tr(errorMessage(err)) ?? null);
    }
  });

  if (sent) {
    return (
      <div role="status" className="flex flex-col items-start gap-3 py-4">
        <CheckCircle2 className="size-8 text-positive" aria-hidden />
        <h2 className="text-lg font-semibold">{c.sentTitle}</h2>
        <p className="text-sm text-muted-foreground">{c.sentBody}</p>
        <Button variant="outline" size="sm" onClick={() => setSent(false)}>
          {c.sendAnother}
        </Button>
      </div>
    );
  }

  return (
    <form className="space-y-4" noValidate onSubmit={onSubmit} method="post">
      <FormError message={error} />
      <ConnectingNotice show={connecting} />
      <Field label={c.name} htmlFor="name" error={tr(e.name?.message)}>
        <Input id="name" autoComplete="name" aria-invalid={!!e.name} {...form.register('name')} />
      </Field>
      <Field label={c.yourEmail} htmlFor="email" error={tr(e.email?.message)}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!e.email}
          {...form.register('email')}
        />
      </Field>
      <Field
        label={c.message}
        htmlFor="message"
        error={tr(e.message?.message)}
        hint={c.messageHint}
      >
        <Textarea id="message" rows={5} aria-invalid={!!e.message} {...form.register('message')} />
      </Field>
      <Button type="submit" loading={form.formState.isSubmitting} className="w-full sm:w-auto">
        {c.send}
      </Button>
    </form>
  );
}
