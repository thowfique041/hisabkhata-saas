import Link from 'next/link';
import { Button } from '@/components/ui/button';

/** A page from a shop's khata, rendered with the same ledger rules as the app. */
function LedgerPage() {
  const rows: [string, string, string, string][] = [
    ['Miniket Rice 25 kg', '2', '1,850.00', '3,700.00'],
    ['Rupchanda Soybean Oil 5 L', '1', '880.00', '880.00'],
    ['চানাচুর (300 g)', '3', '80.00', '240.00'],
    ['Ispahani Tea 400 g', '1', '240.00', '240.00'],
  ];
  return (
    <figure className="relative mx-auto mb-12 w-full max-w-md" aria-label="Example invoice and customer balance in HisabKhata">
      <div className="rounded-lg border bg-surface shadow-[0_1px_0_hsl(var(--border)),0_24px_48px_-24px_rgba(15,30,61,0.25)]">
        <div className="flex items-start justify-between border-b px-5 py-4">
          <div>
            <p className="text-sm font-semibold">Rahman General Store</p>
            <p className="text-xs text-muted-foreground">Zindabazar, Sylhet</p>
          </div>
          <div className="text-right">
            <p className="num text-sm font-medium">RGS-2600568</p>
            <p className="text-xs text-muted-foreground">21 Nov 2026</p>
          </div>
        </div>
        <table className="ledger">
          <thead>
            <tr>
              <th>Item</th>
              <th className="r">Qty</th>
              <th className="r">Amount</th>
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
            <dt className="text-muted-foreground">Total</dt>
            <dd className="num font-semibold">৳5,060.00</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Paid by bKash</dt>
            <dd className="num text-positive">৳3,000.00</dd>
          </div>
          <div className="flex justify-between">
            <dt>Added to Farzana Begum&rsquo;s dues</dt>
            <dd className="num font-semibold text-negative">৳2,060.00</dd>
          </div>
        </dl>
      </div>
      <div className="absolute -bottom-16 right-4 hidden w-56 rounded-md border bg-surface px-4 py-3 text-xs shadow-sm sm:block lg:-right-8">
        <p className="text-muted-foreground">Stock after this sale</p>
        <p className="mt-1 flex justify-between">
          <span>Miniket Rice 25 kg</span>
          <span className="num font-medium text-warning">4 left</span>
        </p>
      </div>
    </figure>
  );
}

const STEPS = [
  ['Scan or search at the counter', 'Barcode scanners work out of the box. Cash, card, bKash, Nagad and Rocket, split however the customer pays.'],
  ['Stock and dues update in the same moment', 'Every sale reduces stock and records the payment in one step. If a customer pays later, their balance is waiting for you.'],
  ['The invoice is ready', 'A numbered PDF invoice with your logo, in taka, ready to print or email.'],
];

export default function HomePage() {
  return (
    <>
      <section className="border-b bg-background">
        <div className="mx-auto grid max-w-6xl items-center gap-16 px-6 py-16 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div>
            <h1 className="max-w-xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">Your shop&rsquo;s khata, kept straight.</h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
              HisabKhata records every sale, purchase and baki in one place, so the stock on your shelf, the money in your drawer and what customers owe you always agree.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/register">Start your 14-day trial</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/features">See how it works</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Free plan for up to 50 products. No card needed.</p>
          </div>
          <LedgerPage />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="max-w-xl text-2xl font-semibold tracking-tight">One sale, recorded once</h2>
        <p className="mt-2 max-w-xl text-muted-foreground">No more writing the same sale in a notebook, a stock register and a dues book.</p>
        <ol className="mt-10 grid gap-10 md:grid-cols-3">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="border-t-2 border-primary pt-5">
              <p className="num text-sm text-muted-foreground">Step {i + 1}</p>
              <h3 className="mt-1 font-semibold">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y bg-background">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Built for how shops here actually run</h2>
            <p className="mt-3 text-muted-foreground">Grocery stores, pharmacies, electronics shops, wholesalers and distributors.</p>
          </div>
          <dl className="divide-y border-y">
            {[
              ['Taka first', 'Amounts in ৳ with lakh grouping, Asia/Dhaka dates, Bangla product names on invoices.'],
              ['Baki without the notebook', 'Sell on credit, collect in parts, print a customer statement any time.'],
              ['A login for every staff member', 'Cashiers sell. Managers handle stock. Only owners see profit and settings.'],
              ['Know what to reorder', 'Low-stock alerts each morning, and purchase records that track what you owe suppliers.'],
              ['Your numbers, not estimates', 'Profit and loss built from real sales, cost of goods and expenses.'],
            ].map(([t, d]) => (
              <div key={t} className="grid gap-1 py-4 sm:grid-cols-[220px_1fr]">
                <dt className="font-medium">{t}</dt>
                <dd className="text-sm text-muted-foreground">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="flex flex-col items-start justify-between gap-6 rounded-lg bg-navy px-8 py-10 text-white md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-semibold">Open your khata today</h2>
            <p className="mt-2 text-slate-300">Set up takes about a minute. Bring your product list; we will handle the rest.</p>
          </div>
          <Button asChild size="lg" className="bg-white text-navy hover:bg-slate-100">
            <Link href="/register">Create free account</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
