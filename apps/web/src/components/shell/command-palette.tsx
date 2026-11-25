'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import * as D from '@radix-ui/react-dialog';
import {
  ClipboardList,
  Loader2,
  PackageSearch,
  Plus,
  Receipt,
  Search,
  Store,
  Truck,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { formatQty, PERMISSIONS, type Paginated } from '@hisabkhata/shared';
import { useApi } from '@/hooks/use-api';
import { useCan } from '@/hooks/use-session';
import { useI18n } from '@/lib/i18n/client';
import { Money } from '@/components/money';
import { NAV } from './nav';

const OPEN_EVENT = 'hk:palette';

/** Opens the palette from anywhere (the top bar search, the POS shortcut list). */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

function useDebounced<T>(value: T, ms = 200) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function Row({
  icon: Icon,
  children,
  meta,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <>
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {meta && <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>}
    </>
  );
}

const itemClass =
  'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground coarse:py-3';
const groupClass =
  '[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground';

/**
 * Ctrl/Cmd+K: jump to any page the user may open, find a product, customer, supplier or invoice,
 * or start a common task. Every result comes from the same permission-checked list endpoints the
 * pages use, so the palette never shows what the user could not open anyway.
 */
export function CommandPalette() {
  const { t } = useI18n();
  const p = t.panel.palette;
  const can = useCan();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const query = useDebounced(q.trim());

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);
  React.useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  const searching = open && query.length >= 2;
  const lookup = { search: query, pageSize: 5 };
  const products = useApi<Paginated<any>>(
    searching && can(PERMISSIONS.PRODUCT_VIEW) ? '/products' : null,
    { ...lookup, archived: 'false' },
  );
  const customers = useApi<Paginated<any>>(
    searching && can(PERMISSIONS.CUSTOMER_VIEW) ? '/customers' : null,
    lookup,
  );
  const suppliers = useApi<Paginated<any>>(
    searching && can(PERMISSIONS.SUPPLIER_VIEW) ? '/suppliers' : null,
    lookup,
  );
  const invoices = useApi<Paginated<any>>(
    searching && can(PERMISSIONS.SALE_VIEW) ? '/sales' : null,
    lookup,
  );
  const loading = searching && [products, customers, suppliers, invoices].some((r) => r.isFetching);
  // Results from a previous query stay visible while the next one loads (keepPreviousData).
  const fresh = (r: { data?: Paginated<any> }) => (searching ? (r.data?.items ?? []) : []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const match = (label: string) =>
    !q.trim() || label.toLowerCase().includes(q.trim().toLowerCase());
  const actions = (
    [
      { label: p.newSale, href: '/pos', icon: Store, perm: PERMISSIONS.SALE_CREATE },
      {
        label: p.recordPurchase,
        href: '/purchases/new',
        icon: ClipboardList,
        perm: PERMISSIONS.PURCHASE_MANAGE,
      },
      {
        label: p.recordExpense,
        href: '/expenses?new=1',
        icon: Wallet,
        perm: PERMISSIONS.EXPENSE_MANAGE,
      },
      {
        label: p.addProduct,
        href: '/products?new=1',
        icon: Plus,
        perm: PERMISSIONS.PRODUCT_MANAGE,
      },
      {
        label: p.addCustomer,
        href: '/customers?new=1',
        icon: UserPlus,
        perm: PERMISSIONS.CUSTOMER_MANAGE,
      },
    ] as const
  ).filter((a) => can(a.perm) && match(a.label));
  const pages = NAV.flatMap((g) => g.items)
    .filter((i) => !i.permission || can(i.permission))
    .map((i) => ({ ...i, label: t.panel.nav.items[i.href.slice(1)] ?? i.label }))
    .filter((i) => match(i.label));

  const productItems = fresh(products);
  const customerItems = fresh(customers);
  const supplierItems = fresh(suppliers);
  const invoiceItems = fresh(invoices);
  const nothing =
    !actions.length &&
    !pages.length &&
    !productItems.length &&
    !customerItems.length &&
    !supplierItems.length &&
    !invoiceItems.length;

  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-navy-900/40 backdrop-blur-[1px]" />
        <D.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[12vh] z-50 w-[min(94vw,36rem)] -translate-x-1/2 overflow-hidden rounded-xl border bg-surface shadow-2xl"
        >
          <D.Title className="sr-only">{p.placeholder}</D.Title>
          <Command shouldFilter={false} loop label={p.placeholder}>
            <div className="flex items-center gap-2 border-b px-3">
              {loading ? (
                <Loader2
                  className="size-4 shrink-0 animate-spin text-muted-foreground"
                  aria-label={p.searching}
                />
              ) : (
                <Search className="size-4 shrink-0 text-muted-foreground" />
              )}
              <Command.Input
                value={q}
                onValueChange={setQ}
                placeholder={p.placeholder}
                className="h-12 w-full bg-transparent text-sm shadow-none outline-none ring-0 placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <kbd className="hidden rounded border px-1.5 py-0.5 text-2xs text-muted-foreground sm:block">
                Esc
              </kbd>
            </div>
            <Command.List className="max-h-[min(60vh,26rem)] overflow-y-auto p-1.5">
              {nothing && !loading && (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">{p.empty}</p>
              )}
              {!!actions.length && (
                <Command.Group heading={p.actions} className={groupClass}>
                  {actions.map((a) => (
                    <Command.Item
                      key={a.href}
                      value={`action:${a.href}`}
                      onSelect={() => go(a.href)}
                      className={itemClass}
                    >
                      <Row icon={a.icon}>{a.label}</Row>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {!!productItems.length && (
                <Command.Group heading={p.products} className={groupClass}>
                  {productItems.map((x) => (
                    <Command.Item
                      key={x.id}
                      value={`product:${x.id}`}
                      onSelect={() => go(`/products?open=${x.id}`)}
                      className={itemClass}
                    >
                      <Row icon={PackageSearch} meta={p.inStock(`${formatQty(x.stock)} ${x.unit}`)}>
                        {x.name} <span className="text-muted-foreground">{x.sku}</span>
                      </Row>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {!!customerItems.length && (
                <Command.Group heading={p.customers} className={groupClass}>
                  {customerItems.map((x) => (
                    <Command.Item
                      key={x.id}
                      value={`customer:${x.id}`}
                      onSelect={() => go(`/customers?open=${x.id}`)}
                      className={itemClass}
                    >
                      <Row icon={Users} meta={x.phone}>
                        {x.name}
                      </Row>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {!!supplierItems.length && (
                <Command.Group heading={p.suppliers} className={groupClass}>
                  {supplierItems.map((x) => (
                    <Command.Item
                      key={x.id}
                      value={`supplier:${x.id}`}
                      onSelect={() => go(`/suppliers?open=${x.id}`)}
                      className={itemClass}
                    >
                      <Row icon={Truck} meta={x.phone}>
                        {x.name}
                      </Row>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {!!invoiceItems.length && (
                <Command.Group heading={p.invoices} className={groupClass}>
                  {invoiceItems.map((x) => (
                    <Command.Item
                      key={x.id}
                      value={`sale:${x.id}`}
                      onSelect={() => go(`/sales?open=${x.id}`)}
                      className={itemClass}
                    >
                      <Row icon={Receipt} meta={<Money value={x.total} />}>
                        {x.invoiceNo}{' '}
                        <span className="text-muted-foreground">
                          {x.customer?.name ?? t.panel.common.walkIn}
                        </span>
                      </Row>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {!!pages.length && (
                <Command.Group heading={p.pages} className={groupClass}>
                  {pages.map((i) => (
                    <Command.Item
                      key={i.href}
                      value={`page:${i.href}`}
                      onSelect={() => go(i.href)}
                      className={itemClass}
                    >
                      <Row icon={i.icon}>{i.label}</Row>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
