import { AppShell } from '@/components/shell/app-shell';
import { TenantGate } from '@/components/shell/guards';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantGate>
      <AppShell>{children}</AppShell>
    </TenantGate>
  );
}
