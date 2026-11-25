import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getI18n } from '@/lib/i18n/server';
import type { Dictionary } from '@/lib/i18n';

/** A page from a shop's khata, rendered with the same ledger rules as the app. */
function LedgerPage({ t, left }: { t: Dictionary['home']['invoice']; left: string }) {
  const rows: [string, string, string, string][] = [
    [t.rice, '2', '1,850.00', '3,700.00'],
    ['Rupchanda Soybean Oil 5 L', '1', '880.00', '880.00'],
    ['চানাচুর (300 g)', '3', '80.00', '240.00'],
    ['Ispahani Tea 400 g', '1', '240.00', '240.00'],
  ];
  return (
    <figure className="relative mx-auto mb-12 w-full max-w-md" aria-label={t.label}>
      <div className="rounded-lg border bg-surface shadow-[0_1px_0_hsl(var(--border)),0_24px_48px_-24px_rgba(15,30,61,0.25)]">
        <div className="flex items-start justify-between border-b px-5 py-4">
          <div>
            <p className="text-sm font-semibold">{t.store}</p>
            <p className="text-xs text-muted-foreground">{t.address}</p>
          </div>
          <div className="text-right">
            <p className="num text-sm font-medium">RGS-2600568</p>
            <p className="text-xs text-muted-foreground">{t.date}</p>
          </div>
        </div>
        <table className="ledger">
          <thead>
            <tr>
              <th>{t.item}</th>
              <th className="r">{t.qty}</th>
              <th className="r">{t.amount}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([n, q, , a]) => (
              <tr key={n}>
                <td>{n}</td>
                <td className="r text-muted-foreground">{q}</td>
                <td className="r">৳{a}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="space-y-1 border-t px-5 py-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t.total}</dt>
            <dd className="num font-semibold">৳5,060.00</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t.paidBy}</dt>
            <dd className="num text-positive">৳3,000.00</dd>
          </div>
          <div className="flex justify-between">
            <dt>{t.dues}</dt>
            <dd className="num font-semibold text-negative">৳2,060.00</dd>
          </div>
        </dl>
      </div>
      <div className="absolute -bottom-16 right-4 hidden w-56 rounded-md border bg-surface px-4 py-3 text-xs shadow-sm sm:block lg:-right-8">
        <p className="text-muted-foreground">{t.stockAfter}</p>
        <p className="mt-1 flex justify-between">
          <span>{t.rice}</span>
          <span className="num font-medium text-warning">4 {left}</span>
        </p>
      </div>
    </figure>
  );
}

export default async function HomePage() {
  const { t } = await getI18n();
  const h = t.home;
  return (
    <>
      <section className="border-b bg-background">
        <div className="mx-auto grid max-w-6xl items-center gap-16 px-6 py-16 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div>
            <h1 className="max-w-xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
              {h.heroTitle}
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
              {h.heroBody}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/register">{h.heroCta}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/features">{h.heroSecondary}</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{h.heroNote}</p>
          </div>
          <LedgerPage t={h.invoice} left={t.common.left} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="max-w-xl text-2xl font-semibold tracking-tight">{h.stepsTitle}</h2>
        <p className="mt-2 max-w-xl text-muted-foreground">{h.stepsBody}</p>
        <ol className="mt-10 grid gap-10 md:grid-cols-3">
          {h.steps.map(({ title, body }, i) => (
            <li key={title} className="border-t-2 border-primary pt-5">
              <p className="num text-sm text-muted-foreground">
                {t.common.step} {i + 1}
              </p>
              <h3 className="mt-1 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y bg-background">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{h.builtTitle}</h2>
            <p className="mt-3 text-muted-foreground">{h.builtBody}</p>
          </div>
          <dl className="divide-y border-y">
            {h.built.map(({ title: bt, body: bd }) => (
              <div key={bt} className="grid gap-1 py-4 sm:grid-cols-[220px_1fr]">
                <dt className="font-medium">{bt}</dt>
                <dd className="text-sm text-muted-foreground">{bd}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="flex flex-col items-start justify-between gap-6 rounded-lg bg-navy px-8 py-10 text-white md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-semibold">{h.ctaTitle}</h2>
            <p className="mt-2 text-slate-300">{h.ctaBody}</p>
          </div>
          <Button asChild size="lg" className="bg-white text-navy hover:bg-slate-100">
            <Link href="/register">{h.ctaButton}</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
