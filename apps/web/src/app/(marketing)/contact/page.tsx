'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { contactSchema } from '@hisabkhata/shared';
import { api, errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { FormError } from '@/components/auth-form';

export default function ContactPage() {
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<{ name: string; email: string; message: string }>({ resolver: zodResolver(contactSchema), defaultValues: { name: '', email: '', message: '' } });
  const e = form.formState.errors;
  return (
    <div className="mx-auto grid max-w-5xl gap-12 px-6 py-16 md:grid-cols-[1fr_1.2fr]">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Talk to us</h1>
        <p className="mt-4 text-muted-foreground">Questions about plans, moving from another system, or setting up a barcode scanner? Send a message and we will reply by email within one working day.</p>
        <dl className="mt-8 space-y-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Hours</dt>
            <dd>Saturday to Thursday, 10am to 7pm (Dhaka time)</dd>
          </div>
        </dl>
      </div>
      <div className="rounded-lg border bg-surface p-6">
        {sent ? (
          <p className="text-sm">Thanks, your message is in. We will reply to the email address you gave us.</p>
        ) : (
          <form
            className="space-y-4"
            noValidate
            onSubmit={form.handleSubmit(async (v) => {
              setError(null);
              try {
                await api('/public/contact', { method: 'POST', body: v });
                setSent(true);
              } catch (err) {
                setError(errorMessage(err));
              }
            })}
          >
            <FormError message={error} />
            <Field label="Your name" htmlFor="name" error={e.name?.message}>
              <Input id="name" {...form.register('name')} />
            </Field>
            <Field label="Email" htmlFor="email" error={e.email?.message}>
              <Input id="email" type="email" {...form.register('email')} />
            </Field>
            <Field label="Message" htmlFor="message" error={e.message?.message}>
              <Textarea id="message" rows={5} {...form.register('message')} />
            </Field>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Send message
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
