'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

export function AuthCard({ title, description, children, footer }: { title: string; description?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <>
      <div className="rounded-lg border bg-surface p-6 sm:p-8">
        <h1 className="text-lg font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <p className="mt-5 text-center text-sm text-muted-foreground">{footer}</p>}
    </>
  );
}

export function FormError({ message, className }: { message?: string | null; className?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className={cn('rounded-md border border-negative/30 bg-negative/5 px-3 py-2 text-sm text-negative', className)}>
      {message}
    </p>
  );
}
