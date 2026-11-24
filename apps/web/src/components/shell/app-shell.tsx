'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useQueryClient } from '@tanstack/react-query';
import * as D from '@radix-ui/react-dialog';
import { Bell, Check, ChevronsUpDown, LogOut, Menu as MenuIcon, Monitor, Moon, Plus, Search, ShieldCheck, Sun, UserRound } from 'lucide-react';
import { Logo } from '@/components/logo';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/dropdown';
import { Badge } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { cn, formatRelative } from '@/lib/utils';
import { useCan, useSession, useSwitchTenant } from '@/hooks/use-session';
import { useApi, useAction } from '@/hooks/use-api';
import { ADMIN_NAV, LABELS, NAV, type NavItem } from './nav';

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = item.href === '/super-admin' ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/');
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-slate-300 hover:bg-white/5 hover:text-white',
        active && 'bg-white/10 font-medium text-white',
      )}
    >
      <Icon className="size-4 shrink-0" />
      {item.label}
    </Link>
  );
}

function SidebarContent({ admin, onNavigate }: { admin?: boolean; onNavigate?: () => void }) {
  const can = useCan();
  const { data } = useSession();
  return (
    <div className="flex h-full flex-col bg-navy text-white">
      <div className="flex h-14 items-center px-4">
        <Link href={admin ? '/super-admin' : '/dashboard'} onClick={onNavigate}>
          <Logo onDark />
        </Link>
      </div>
      {!admin && <TenantSwitcher />}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Main">
        {admin ? (
          <div className="space-y-0.5">
            {ADMIN_NAV.map((i) => (
              <NavLink key={i.href} item={i} onNavigate={onNavigate} />
            ))}
          </div>
        ) : (
          NAV.map((group) => {
            const items = group.items.filter((i) => !i.permission || can(i.permission));
            if (!items.length) return null;
            return (
              <div key={group.label}>
                <p className="mb-1 px-2.5 text-xs text-slate-400">{group.label}</p>
                <div className="space-y-0.5">
                  {items.map((i) => (
                    <NavLink key={i.href} item={i} onNavigate={onNavigate} />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </nav>
      {data?.user.isSuperAdmin && (
        <div className="border-t border-white/10 p-3">
          <Link href={admin ? '/dashboard' : '/super-admin'} onClick={onNavigate} className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-slate-300 hover:bg-white/5 hover:text-white">
            <ShieldCheck className="size-4" />
            {admin ? 'Back to my business' : 'Platform admin'}
          </Link>
        </div>
      )}
    </div>
  );
}

function TenantSwitcher() {
  const { data } = useSession();
  const switchTenant = useSwitchTenant();
  const router = useRouter();
  if (!data?.activeTenant) return null;
  return (
    <div className="px-3">
      <Menu>
        <MenuTrigger className="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/5 px-2.5 py-2 text-left text-sm hover:bg-white/10">
          <span className="min-w-0">
            <span className="block truncate font-medium">{data.activeTenant.name}</span>
            <span className="block text-xs text-slate-400">
              {data.activeTenant.role}
              {data.plan ? `, ${data.plan.name} plan` : ''}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-slate-400" />
        </MenuTrigger>
        <MenuContent align="start" className="w-60">
          <MenuLabel>Your businesses</MenuLabel>
          {data.tenants.map((t) => (
            <MenuItem key={t.id} onSelect={() => t.id !== data.activeTenant?.id && switchTenant(t.id)} disabled={t.status !== 'ACTIVE'}>
              <span className="flex-1 truncate">{t.name}</span>
              {t.id === data.activeTenant?.id && <Check className="text-positive" />}
              {t.status !== 'ACTIVE' && <Badge tone="negative">Suspended</Badge>}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem onSelect={() => router.push('/onboarding?new=1')}>
            <Plus /> Add a business
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}

function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split('/').filter(Boolean);
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm md:flex">
      {parts.map((p, i) => {
        const href = '/' + parts.slice(0, i + 1).join('/');
        const label = LABELS[p] ?? (p.length > 16 ? 'Details' : p);
        const last = i === parts.length - 1;
        return (
          <React.Fragment key={href}>
            {i > 0 && <span className="text-muted-foreground">/</span>}
            {last ? (
              <span className="truncate font-medium">{label}</span>
            ) : (
              <Link href={href} className="truncate text-muted-foreground hover:text-foreground">
                {label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

function QuickSearch() {
  const router = useRouter();
  const can = useCan();
  const [q, setQ] = React.useState('');
  if (!can('product.view')) return null;
  return (
    <form
      role="search"
      className="relative ml-auto hidden w-64 lg:block"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/products?search=${encodeURIComponent(q.trim())}`);
      }}
    >
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Find a product, SKU or barcode"
        aria-label="Find a product"
        className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground"
      />
    </form>
  );
}

function Notifications() {
  const { data } = useApi<{ items: any[]; unread: number }>('/notifications');
  const read = useAction(() => api('/notifications/read-all', { method: 'POST' }), { invalidate: [['/notifications']] });
  const router = useRouter();
  return (
    <Menu onOpenChange={(o) => !o && data?.unread && read.mutate(undefined)}>
      <MenuTrigger className="relative rounded-md p-2 hover:bg-muted" aria-label={`Notifications${data?.unread ? `, ${data.unread} unread` : ''}`}>
        <Bell className="size-4" />
        {!!data?.unread && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-negative" />}
      </MenuTrigger>
      <MenuContent className="w-80 p-0">
        <div className="border-b px-3 py-2 text-sm font-medium">Notifications</div>
        <div className="max-h-96 overflow-y-auto">
          {!data?.items.length && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nothing new. Stock alerts and billing notices appear here.</p>}
          {data?.items.map((n) => (
            <MenuItem key={n.id} className="block rounded-none border-b px-3 py-2.5 last:border-0" onSelect={() => n.link && router.push(n.link)}>
              <div className="flex items-start gap-2">
                {!n.readAt && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sky-soft" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                  <p className="mt-0.5 text-2xs text-muted-foreground">{formatRelative(n.createdAt)}</p>
                </div>
              </div>
            </MenuItem>
          ))}
        </div>
      </MenuContent>
    </Menu>
  );
}

function UserMenu() {
  const { data } = useSession();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    qc.clear();
    router.replace('/login');
  };
  const initials = (data?.user.name ?? '?')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('');
  return (
    <Menu>
      <MenuTrigger className="flex items-center gap-2 rounded-md p-1 hover:bg-muted" aria-label="Account menu">
        <span className="flex size-7 items-center justify-center overflow-hidden rounded-full bg-navy text-xs font-medium text-white">
          {data?.user.avatarUrl ? <img src={data.user.avatarUrl} alt="" className="size-full object-cover" /> : initials}
        </span>
      </MenuTrigger>
      <MenuContent className="w-60">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{data?.user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{data?.user.email}</p>
        </div>
        <MenuSeparator />
        <MenuItem onSelect={() => router.push('/profile')}>
          <UserRound /> Profile and password
        </MenuItem>
        <MenuSeparator />
        <MenuLabel>Theme</MenuLabel>
        {(
          [
            ['light', 'Light', Sun],
            ['dark', 'Dark', Moon],
            ['system', 'Match system', Monitor],
          ] as const
        ).map(([v, l, Icon]) => (
          <MenuItem key={v} onSelect={() => setTheme(v)}>
            <Icon /> <span className="flex-1">{l}</span>
            {theme === v && <Check className="text-positive" />}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem onSelect={logout}>
          <LogOut /> Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function VerifyBanner() {
  const { data } = useSession();
  const resend = useAction(() => api('/auth/resend-verification', { method: 'POST' }), { success: 'Verification email sent' });
  if (!data || data.user.emailVerified) return null;
  return (
    <div className="no-print border-b bg-warning/10 px-4 py-2 text-sm text-warning sm:px-6">
      Confirm your email address to secure your account.{' '}
      <button className="font-medium underline underline-offset-2" onClick={() => resend.mutate(undefined)} disabled={resend.isPending}>
        Resend the email
      </button>
    </div>
  );
}

function Announcements() {
  const { data } = useApi<any[]>('/announcements');
  const [hidden, setHidden] = React.useState<string[]>([]);
  const items = (data ?? []).filter((a) => !hidden.includes(a.id));
  if (!items.length) return null;
  const a = items[0];
  return (
    <div className={cn('no-print flex items-center justify-between gap-4 border-b px-4 py-2 text-sm sm:px-6', a.level === 'CRITICAL' ? 'bg-negative/10 text-negative' : a.level === 'WARNING' ? 'bg-warning/10 text-warning' : 'bg-accent text-accent-foreground')}>
      <span>
        <strong className="font-medium">{a.title}.</strong> {a.body}
      </span>
      <button className="shrink-0 text-xs underline" onClick={() => setHidden((h) => [...h, a.id])}>
        Dismiss
      </button>
    </div>
  );
}

export function AppShell({ children, admin }: { children: React.ReactNode; admin?: boolean }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 dark:border-r dark:border-white/10 lg:block">
        <SidebarContent admin={admin} />
      </aside>
      <D.Root open={open} onOpenChange={setOpen}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-40 bg-navy-900/50 lg:hidden" />
          <D.Content className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden" aria-describedby={undefined}>
            <D.Title className="sr-only">Navigation</D.Title>
            <SidebarContent admin={admin} onNavigate={() => setOpen(false)} />
          </D.Content>
        </D.Portal>
      </D.Root>
      <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-surface/95 px-4 backdrop-blur sm:px-6">
        <button className="rounded-md p-2 hover:bg-muted lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
          <MenuIcon className="size-5" />
        </button>
        <Breadcrumbs />
        {!admin && <QuickSearch />}
        <div className={cn('flex items-center gap-1', admin && 'ml-auto')}>
          {!admin && <Notifications />}
          <UserMenu />
        </div>
      </header>
      <VerifyBanner />
      {!admin && <Announcements />}
      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </div>
  );
}
