import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ChartColumn,
  HandCoins,
  PackageSearch,
  ReceiptText,
  ScanBarcode,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/marketing/reveal';
import { getI18n } from '@/lib/i18n/server';
import { pageMetadata } from '@/lib/seo';
import { cn } from '@/lib/utils';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return pageMetadata(t.meta.featuresTitle, t.meta.featuresDescription, '/features');
}

const ICONS: Record<string, LucideIcon> = {
  pos: ScanBarcode,
  inventory: PackageSearch,
  purchases: Truck,
  customers: HandCoins,
  invoices: ReceiptText,
  reports: ChartColumn,
  team: ShieldCheck,
};

/** A small ledger card with example figures for the module, in the app's own table style. */
function DemoCard({
  title,
  rows,
  icon: Icon,
}: {
  title: string;
  rows: string[][];
  icon: LucideIcon;
}) {
  return (
    <div
      className="rounded-lg border bg-surface shadow-[0_1px_0_hsl(var(--border)),0_20px_40px_-28px_rgba(15,30,61,0.35)] transition-transform duration-300 hover:-translate-y-0.5 dark:shadow-none"
      aria-hidden
    >
      <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-medium">
        <Icon className="size-4 text-emerald" />
        {title}
      </div>
      <dl className="divide-y text-sm">
        {rows.map(([label, value], i) => (
          <div
            key={label}
            className={cn(
              'flex items-center justify-between gap-4 px-4 py-2.5',
              i === rows.length - 1 && 'font-semibold',
            )}
          >
            <dt className={cn(i !== rows.length - 1 && 'text-muted-foreground')}>{label}</dt>
            <dd className="num whitespace-nowrap">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default async function FeaturesPage() {
  const { t } = await getI18n();
  const f = t.features;
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">{f.title}</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{f.intro}</p>

      <nav aria-label={f.title} className="mt-8 flex flex-wrap gap-2">
        {f.sections.map((s) => {
          const Icon = ICONS[s.key];
          return (
            <a
              key={s.key}
              href={`#${s.key}`}
              className="inline-flex items-center gap-1.5 rounded-full border bg-surface px-3 py-1.5 text-sm transition-colors hover:border-foreground/30"
            >
              <Icon className="size-3.5 text-muted-foreground" aria-hidden />
              {s.title}
            </a>
          );
        })}
      </nav>

      <div className="mt-14 divide-y border-y">
        {f.sections.map((s, i) => {
          const Icon = ICONS[s.key];
          return (
            <section
              key={s.key}
              id={s.key}
              className="scroll-mt-24 py-14"
              aria-labelledby={`${s.key}-title`}
            >
              <Reveal className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                <div className={cn(i % 2 === 1 && 'lg:order-2')}>
                  <span className="inline-flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h2 id={`${s.key}-title`} className="mt-4 text-xl font-semibold sm:text-2xl">
                    {s.title}
                  </h2>
                  <p className="mt-2 text-muted-foreground">{s.intro}</p>
                  <ul className="mt-6 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                    {s.items.map((item) => (
                      <li key={item} className="border-l-2 border-emerald pl-3">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={cn('mx-auto w-full max-w-sm', i % 2 === 1 && 'lg:order-1')}>
                  <DemoCard title={s.demo.title} rows={s.demo.rows} icon={Icon} />
                </div>
              </Reveal>
            </section>
          );
        })}
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/register">{f.start}</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/pricing">{f.compare}</Link>
        </Button>
      </div>
    </div>
  );
}
