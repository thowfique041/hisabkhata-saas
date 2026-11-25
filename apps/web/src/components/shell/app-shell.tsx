'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useQueryClient } from '@tanstack/react-query';
import * as D from '@radix-ui/react-dialog';
import {
  Bell,
  Check,
  CheckCheck,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  MailWarning,
  X,
  ChevronsUpDown,
  LogOut,
  Menu as MenuIcon,
  Monitor,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  Sun,
  UserRound,
} from 'lucide-react';
import { Logo, LogoMark } from '@/components/logo';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from '@/components/ui/dropdown';
import { Badge } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toBnDigits as toBn } from '@/lib/i18n/digits';
import { useCan, useSession, useSwitchTenant } from '@/hooks/use-session';
import { useApi, useAction } from '@/hooks/use-api';
import { ADMIN_NAV, LABELS, NAV, type NavItem } from './nav';
import { usePosFullscreen } from '@/lib/pos-fullscreen';
import { useI18n } from '@/lib/i18n/client';
import { useLocalState } from '@/lib/local-store';
import { Tooltip } from '@/components/ui/tooltip';
import { useMoney } from '@/components/money';
import { CommandPalette, openCommandPalette } from './command-palette';

/** Collapsed desktop sidebar (icons only), remembered per browser. */
function useSidebarCollapsed() {
  return useLocalState<boolean>('hk_sidebar_collapsed', false);
}

function NavLink({
  item,
  onNavigate,
  collapsed,
}: {
  item: NavItem;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const active =
    item.href === '/super-admin'
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(item.href + '/');
  const Icon = item.icon;
  const label = item.href.startsWith('/super-admin')
    ? item.label
    : (t.panel.nav.items[item.href.slice(1)] ?? item.label);
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-slate-300 hover:bg-white/5 hover:text-white coarse:py-2.5',
        active && 'bg-white/10 font-medium text-white',
        collapsed && 'justify-center px-0 py-2',
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && label}
    </Link>
  );
  return collapsed ? (
    <Tooltip content={label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

function SidebarContent({
  admin,
  onNavigate,
  collapsed,
}: {
  admin?: boolean;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const can = useCan();
  const { data } = useSession();
  const { t } = useI18n();
  const n = t.panel.nav;
  const [, setCollapsed] = useSidebarCollapsed();
  // The drawer on small screens never collapses; only the fixed desktop sidebar has the toggle.
  const desktop = !onNavigate;
  return (
    <div className="flex h-full flex-col bg-navy text-white">
      <div className={cn('flex h-14 items-center px-4', collapsed && 'justify-center px-0')}>
        <Link
          href={admin ? '/super-admin' : '/dashboard'}
          onClick={onNavigate}
          aria-label="HisabKhata"
        >
          {collapsed ? <LogoMark inverted className="size-8" /> : <Logo onDark />}
        </Link>
      </div>
      {!admin && !collapsed && <TenantSwitcher />}
      {!admin && <TrialBadge collapsed={collapsed} />}
      <nav
        className={cn('flex-1 space-y-5 overflow-y-auto py-4', collapsed ? 'px-2' : 'px-3')}
        aria-label={n.main}
      >
        {admin ? (
          <div className="space-y-0.5">
            {ADMIN_NAV.map((i) => (
              <NavLink key={i.href} item={i} onNavigate={onNavigate} collapsed={collapsed} />
            ))}
          </div>
        ) : (
          NAV.map((group) => {
            const items = group.items.filter((i) => !i.permission || can(i.permission));
            if (!items.length) return null;
            return (
              <div key={group.label}>
                {collapsed ? (
                  <div className="mx-2 mb-2 border-t border-white/10" aria-hidden />
                ) : (
                  <p className="mb-1 px-2.5 text-xs text-slate-400">
                    {n.groups[group.key] ?? group.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {items.map((i) => (
                    <NavLink key={i.href} item={i} onNavigate={onNavigate} collapsed={collapsed} />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </nav>
      {data?.user.isSuperAdmin && (
        <div className={cn('border-t border-white/10', collapsed ? 'p-2' : 'p-3')}>
          <NavLink
            item={{
              href: admin ? '/dashboard' : '/super-admin',
              label: admin ? n.backToBusiness : n.platformAdmin,
              icon: ShieldCheck,
            }}
            onNavigate={onNavigate}
            collapsed={collapsed}
          />
        </div>
      )}
      {desktop && (
        <div className={cn('border-t border-white/10', collapsed ? 'p-2' : 'p-3')}>
          <Tooltip content={collapsed ? n.expand : null} side="right">
            <button
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? n.expand : n.collapse}
              aria-expanded={!collapsed}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-slate-400 hover:bg-white/5 hover:text-white',
                collapsed && 'justify-center px-0 py-2',
              )}
            >
              {collapsed ? (
                <ChevronsRight className="size-4" />
              ) : (
                <ChevronsLeft className="size-4" />
              )}
              {!collapsed && n.collapse}
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

/** "Trial: n days left" under the shop switcher, for people who can act on it. */
function TrialBadge({ collapsed }: { collapsed?: boolean }) {
  const { data } = useSession();
  const can = useCan();
  const { t } = useI18n();
  const plan = data?.plan;
  if (!plan || plan.status !== 'TRIALING' || !plan.endsAt || !can('subscription.manage'))
    return null;
  const days = Math.ceil((new Date(plan.endsAt).getTime() - Date.now()) / 86_400_000);
  const label = days < 0 ? t.panel.nav.trialEnded : t.panel.nav.trialLeft(days);
  const urgent = days <= 3;
  const badge = (
    <Link
      href="/subscription"
      aria-label={`${label}. ${t.panel.nav.choosePlan}`}
      title={t.panel.nav.choosePlan}
      className={cn(
        'flex items-center gap-2 rounded-md text-xs font-medium',
        urgent
          ? 'bg-warning/20 text-amber-200 hover:bg-warning/30'
          : 'bg-white/5 text-slate-300 hover:bg-white/10',
        collapsed ? 'mx-2 mt-2 justify-center py-2' : 'mx-3 mt-2 px-2.5 py-1.5',
      )}
    >
      <Clock className="size-3.5 shrink-0" />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && urgent && (
        <span className="shrink-0 underline underline-offset-2">{t.panel.nav.choosePlan}</span>
      )}
    </Link>
  );
  return collapsed ? (
    <Tooltip content={label} side="right">
      {badge}
    </Tooltip>
  ) : (
    badge
  );
}

function TenantSwitcher() {
  const { data } = useSession();
  const switchTenant = useSwitchTenant();
  const router = useRouter();
  const { t: i18n } = useI18n();
  const n = i18n.panel.nav;
  if (!data?.activeTenant) return null;
  return (
    <div className="px-3">
      <Menu>
        <MenuTrigger className="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/5 px-2.5 py-2 text-left text-sm hover:bg-white/10">
          <span className="min-w-0">
            <span className="block truncate font-medium">{data.activeTenant.name}</span>
            <span className="block text-xs text-slate-400">
              {data.activeTenant.role}
              {data.plan ? `, ${n.planSuffix(data.plan.name)}` : ''}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-slate-400" />
        </MenuTrigger>
        <MenuContent align="start" className="w-60">
          <MenuLabel>{n.yourBusinesses}</MenuLabel>
          {data.tenants.map((t) => (
            <MenuItem
              key={t.id}
              onSelect={() => t.id !== data.activeTenant?.id && switchTenant(t.id)}
              disabled={t.status !== 'ACTIVE'}
            >
              <span className="flex-1 truncate">{t.name}</span>
              {t.id === data.activeTenant?.id && <Check className="text-positive" />}
              {t.status !== 'ACTIVE' && <Badge tone="negative">{n.suspended}</Badge>}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem onSelect={() => router.push('/onboarding?new=1')}>
            <Plus /> {n.addBusiness}
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}

function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split('/').filter(Boolean);
  const { t } = useI18n();
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm md:flex">
      {parts.map((p, i) => {
        const href = '/' + parts.slice(0, i + 1).join('/');
        const label =
          t.panel.nav.items[p] ?? LABELS[p] ?? (p.length > 16 ? t.panel.nav.items.details : p);
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

/** The top-bar search opens the command palette. */
function QuickSearch() {
  const { t } = useI18n();
  const [mac, setMac] = React.useState(false);
  React.useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  return (
    <>
      <button
        onClick={openCommandPalette}
        className="ml-auto hidden h-8 w-64 items-center gap-2 rounded-md border border-input bg-background px-2.5 text-left text-sm text-muted-foreground hover:bg-muted lg:flex"
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1 truncate">{t.panel.nav.search}</span>
        <kbd className="rounded border bg-surface px-1.5 text-2xs">{mac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>
      <button
        onClick={openCommandPalette}
        className="ml-auto rounded-md p-2 hover:bg-muted lg:hidden"
        aria-label={t.panel.nav.searchHint}
      >
        <Search className="size-4" />
      </button>
    </>
  );
}

interface Note {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  data: any;
  readAt: string | null;
  createdAt: string;
}

/** Live alerts are stored with structured data so they read naturally in either language. */
function useNoteText() {
  const { t, locale, tr } = useI18n();
  const money = useMoney();
  const a = t.panel.alerts;
  return (n: Note): { title: string; body: string } => {
    const raw = { title: n.title, body: n.body };
    const d = n.data ?? {};
    const names = (list: string[] | undefined, count: number) =>
      (list ?? []).join(', ') + (count > (list?.length ?? 0) ? ` ${a.andMore}` : '');
    switch (n.type) {
      case 'low-stock':
        return d.count ? { title: a.lowStock(d.count), body: names(d.names, d.count) } : raw;
      case 'out-of-stock':
        return d.count ? { title: a.outOfStock(d.count), body: names(d.names, d.count) } : raw;
      case 'customer-dues':
        return d.count
          ? { title: a.customerDues(d.count), body: a.customerDuesBody(money(d.amount)) }
          : raw;
      case 'supplier-dues':
        return d.count
          ? { title: a.supplierDues(d.count), body: a.supplierDuesBody(money(d.amount)) }
          : raw;
      case 'trial-ending':
        return typeof d.days === 'number'
          ? { title: a.trialEnding(d.days), body: a.trialEndingBody }
          : raw;
      default:
        return locale === 'bn'
          ? { title: tr(n.title) ?? n.title, body: tr(n.body) ?? n.body }
          : raw;
    }
  };
}

function relative(value: string, locale: 'en' | 'bn') {
  const diff = (new Date(value).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale === 'bn' ? 'bn-BD' : 'en', { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

function Notifications() {
  const { t, locale } = useI18n();
  const a = t.panel.alerts;
  const text = useNoteText();
  const { data } = useApi<{ items: Note[]; unread: number }>('/notifications');
  const readAll = useAction(() => api('/notifications/read-all', { method: 'POST' }), {
    invalidate: [['/notifications']],
  });
  const readOne = useAction((id: string) => api(`/notifications/${id}/read`, { method: 'POST' }), {
    invalidate: [['/notifications']],
  });
  const router = useRouter();
  // The tick button sits inside a menu item; this keeps the menu open when it is pressed.
  const tick = React.useRef(false);
  const unread = data?.unread ?? 0;
  const count = unread > 9 ? '9+' : String(locale === 'bn' ? toBn(unread) : unread);
  return (
    <Menu>
      <MenuTrigger
        className="relative rounded-md p-2 hover:bg-muted"
        aria-label={`${a.title}${unread ? `, ${a.unread(unread)}` : ''}`}
      >
        <Bell className="size-4" />
        {!!unread && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-negative px-1 text-[10px] font-semibold leading-none text-white">
            {count}
          </span>
        )}
      </MenuTrigger>
      <MenuContent className="w-[min(92vw,22rem)] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">
            {a.title}
            {!!unread && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {a.unread(unread)}
              </span>
            )}
          </p>
          {!!unread && (
            <button
              onClick={() => readAll.mutate(undefined)}
              className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <CheckCheck className="size-3.5" /> {a.markAll}
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {!data?.items.length && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{a.empty}</p>
          )}
          {data?.items.map((n) => {
            const { title, body } = text(n);
            return (
              <MenuItem
                key={n.id}
                className={cn(
                  'group block rounded-none border-b px-3 py-2.5 last:border-0',
                  !n.readAt && 'bg-accent/40',
                )}
                onSelect={(e) => {
                  if (tick.current) {
                    tick.current = false;
                    e.preventDefault();
                    readOne.mutate(n.id);
                    return;
                  }
                  if (!n.readAt) readOne.mutate(n.id);
                  if (n.link) router.push(n.link);
                }}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      'mt-1.5 size-1.5 shrink-0 rounded-full',
                      n.readAt ? 'bg-transparent' : 'bg-sky-soft',
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm', !n.readAt && 'font-medium')}>{title}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{body}</p>
                    <p className="mt-0.5 text-2xs text-muted-foreground">
                      {relative(n.createdAt, locale)}
                    </p>
                  </div>
                  {!n.readAt && (
                    <span
                      role="button"
                      tabIndex={-1}
                      onPointerDown={() => (tick.current = true)}
                      aria-label={a.markRead}
                      title={a.markRead}
                      className="shrink-0 rounded p-1 text-muted-foreground opacity-60 hover:bg-muted hover:text-foreground group-hover:opacity-100 coarse:opacity-100"
                    >
                      <Check className="size-3.5" />
                    </span>
                  )}
                </div>
              </MenuItem>
            );
          })}
        </div>
      </MenuContent>
    </Menu>
  );
}

function UserMenu() {
  const { data } = useSession();
  const { t } = useI18n();
  const [verifyDismissed] = useVerifyDismissed();
  const resend = useResendVerification();
  const needsVerify = !!data && !data.user.emailVerified && verifyDismissed;
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
      <MenuTrigger
        className="flex items-center gap-2 rounded-md p-1 hover:bg-muted"
        aria-label="Account menu"
      >
        <span className="flex size-7 items-center justify-center overflow-hidden rounded-full bg-navy text-xs font-medium text-white">
          {data?.user.avatarUrl ? (
            <img src={data.user.avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            initials
          )}
        </span>
      </MenuTrigger>
      <MenuContent className="w-60">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{data?.user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{data?.user.email}</p>
        </div>
        <MenuSeparator />
        {needsVerify && (
          <MenuItem onSelect={() => resend.mutate(undefined)}>
            <MailWarning className="text-warning" />{' '}
            <span className="flex-1">{t.panel.onboarding.confirmEmail}</span>
            <span className="size-2 rounded-full bg-warning" aria-hidden />
          </MenuItem>
        )}
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

/** Dismissing the verify banner lasts for this browser session; the account menu keeps a reminder. */
const verifyListeners = new Set<() => void>();
function useVerifyDismissed(): [boolean, () => void] {
  const subscribe = React.useCallback((cb: () => void) => {
    verifyListeners.add(cb);
    return () => verifyListeners.delete(cb);
  }, []);
  const read = () => {
    try {
      return window.sessionStorage.getItem('hk_verify_dismissed') === '1';
    } catch {
      return false;
    }
  };
  const dismissed = React.useSyncExternalStore(subscribe, read, () => false);
  const dismiss = React.useCallback(() => {
    try {
      window.sessionStorage.setItem('hk_verify_dismissed', '1');
    } catch {
      /* ignore */
    }
    verifyListeners.forEach((l) => l());
  }, []);
  return [dismissed, dismiss];
}

function useResendVerification() {
  const { t } = useI18n();
  return useAction(() => api('/auth/resend-verification', { method: 'POST' }), {
    success: t.panel.onboarding.resent,
  });
}

function VerifyBanner() {
  const { data } = useSession();
  const { t } = useI18n();
  const o = t.panel.onboarding;
  const resend = useResendVerification();
  const [dismissed, dismiss] = useVerifyDismissed();
  if (!data || data.user.emailVerified || dismissed) return null;
  return (
    <div className="no-print flex items-center gap-3 border-b bg-warning/10 px-4 py-2 text-sm text-warning sm:px-6">
      <p className="flex-1">
        {o.verifyBanner}{' '}
        <button
          className="font-medium underline underline-offset-2"
          onClick={() => resend.mutate(undefined)}
          disabled={resend.isPending}
        >
          {o.resend}
        </button>
      </p>
      <button
        className="shrink-0 rounded-md p-1 hover:bg-warning/15"
        onClick={dismiss}
        aria-label={o.dismiss}
        title={o.dismiss}
      >
        <X className="size-4" />
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
    <div
      className={cn(
        'no-print flex items-center justify-between gap-4 border-b px-4 py-2 text-sm sm:px-6',
        a.level === 'CRITICAL'
          ? 'bg-negative/10 text-negative'
          : a.level === 'WARNING'
            ? 'bg-warning/10 text-warning'
            : 'bg-accent text-accent-foreground',
      )}
    >
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
  const pathname = usePathname();
  const [posFullscreen] = usePosFullscreen();
  const [collapsed] = useSidebarCollapsed();
  const { t } = useI18n();
  // Full-screen POS: no sidebar, no top bar, every pixel for the counter.
  if (!admin && posFullscreen && pathname === '/pos') {
    return (
      <>
        <main className="min-h-screen bg-background p-3 sm:p-4">{children}</main>
        <CommandPalette />
      </>
    );
  }
  return (
    <div
      className={cn(
        'min-h-screen transition-[padding] duration-200',
        collapsed ? 'lg:pl-16' : 'lg:pl-60',
      )}
    >
      <aside
        className={cn(
          'no-print fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-200 dark:border-r dark:border-white/10 lg:block',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <SidebarContent admin={admin} collapsed={collapsed} />
      </aside>
      <D.Root open={open} onOpenChange={setOpen}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-40 bg-navy-900/50 lg:hidden" />
          <D.Content
            className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden"
            aria-describedby={undefined}
          >
            <D.Title className="sr-only">{t.panel.nav.navigation}</D.Title>
            <SidebarContent admin={admin} onNavigate={() => setOpen(false)} />
          </D.Content>
        </D.Portal>
      </D.Root>
      <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-surface/95 px-4 backdrop-blur sm:px-6">
        <button
          className="rounded-md p-2 hover:bg-muted lg:hidden"
          onClick={() => setOpen(true)}
          aria-label={t.panel.nav.openNav}
        >
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
      {!admin && <CommandPalette />}
    </div>
  );
}
