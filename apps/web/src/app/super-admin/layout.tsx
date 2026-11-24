import type { Metadata } from 'next';
import { AppShell } from '@/components/shell/app-shell';
import { SuperAdminGate } from '@/components/shell/guards';

export const metadata: Metadata = { title: 'Platform admin' };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SuperAdminGate>
      <AppShell admin>{children}</AppShell>
    </SuperAdminGate>
  );
}
