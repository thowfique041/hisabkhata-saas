'use client';
import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { AuthCard } from '@/components/auth-form';

function Verify() {
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = React.useState<{
    status: 'working' | 'ok' | 'error';
    message?: string;
  }>({ status: 'working' });
  const ran = React.useRef(false);
  // Real tokens are long random strings; anything shorter is a cut-off or hand-typed link.
  const usable = token.length >= 20;
  React.useEffect(() => {
    if (ran.current || !usable) return;
    ran.current = true;
    api('/auth/verify-email', { method: 'POST', body: { token } })
      .then(() => setState({ status: 'ok' }))
      .catch((err) => setState({ status: 'error', message: errorMessage(err) }));
  }, [token, usable]);

  if (!usable) {
    return (
      <AuthCard title="This link is incomplete">
        <p className="mb-5 text-sm text-muted-foreground">
          Open the link from your email again. You can also send a new one from the banner after
          signing in.
        </p>
        <Button asChild className="w-full">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </AuthCard>
    );
  }

  if (state.status === 'working') {
    return (
      <AuthCard title="Confirming your email">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </AuthCard>
    );
  }
  return (
    <AuthCard title={state.status === 'ok' ? 'Email confirmed' : 'We could not confirm your email'}>
      <p className="mb-5 text-sm text-muted-foreground">
        {state.status === 'ok'
          ? 'Thanks. Your account is fully set up.'
          : `${state.message} You can request a new link from the banner after signing in.`}
      </p>
      <Button asChild className="w-full">
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <React.Suspense>
      <Verify />
    </React.Suspense>
  );
}
