import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Features' };

const SECTIONS: { title: string; intro: string; items: string[] }[] = [
  {
    title: 'Point of sale',
    intro: 'A counter screen made for speed, on a laptop, tablet or a phone.',
    items: ['Barcode scanning and search by name or SKU', 'Line and order discounts, configurable tax', 'Cash, card, bKash, Nagad, Rocket and split payments', 'Change calculated automatically', 'Credit sales added to the customer’s dues', 'Returns and cancellations that restock automatically'],
  },
  {
    title: 'Inventory',
    intro: 'Stock levels you can trust, because every change has a reason.',
    items: ['Products with SKU, barcode, unit, cost and selling price', 'Categories, photos and bulk actions', 'Stock history for every product', 'Adjustments for damage, expiry, loss or recount', 'Low and out-of-stock alerts', 'Stock value at cost and at retail'],
  },
  {
    title: 'Purchases and suppliers',
    intro: 'Record what comes in and what you owe for it.',
    items: ['Purchases add stock immediately', 'Partial payments and supplier dues', 'Pay suppliers against the oldest bills first', 'Cancel a purchase and reverse its stock'],
  },
  {
    title: 'Customers and dues',
    intro: 'Replace the baki notebook.',
    items: ['Customer profiles with purchase history', 'Outstanding balance on every profile', 'Collect payments that settle the oldest invoices first', 'Statements you can download'],
  },
  {
    title: 'Invoices',
    intro: 'Numbered, professional and in taka.',
    items: ['Your logo, address and BIN on every invoice', 'Sequential numbers per business with your own prefix', 'Download as PDF or email to the customer'],
  },
  {
    title: 'Reports',
    intro: 'Clear definitions, so the numbers mean the same thing every time.',
    items: ['Daily, weekly, monthly and annual sales', 'Profit and loss: revenue, cost of goods, gross profit, expenses, net profit', 'Inventory, low stock, purchases, customers, expenses, payments and dues', 'Export any report as CSV or PDF'],
  },
  {
    title: 'Team and security',
    intro: 'Everyone signs in as themselves.',
    items: ['Owner, manager, cashier and staff roles, plus custom roles', 'Every sensitive action is logged', 'Each business’s data is isolated from every other business', 'Run more than one business from one account'],
  },
];

export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Everything a shop needs to keep its accounts straight</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">HisabKhata covers the full loop: buy stock, sell it, collect what you are owed, and see what you earned.</p>
      <div className="mt-14 divide-y border-y">
        {SECTIONS.map((s) => (
          <section key={s.title} className="grid gap-6 py-10 lg:grid-cols-[320px_1fr]">
            <div>
              <h2 className="text-xl font-semibold">{s.title}</h2>
              <p className="mt-2 text-muted-foreground">{s.intro}</p>
            </div>
            <ul className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              {s.items.map((i) => (
                <li key={i} className="border-l-2 border-emerald pl-3">
                  {i}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="mt-12 flex gap-3">
        <Button asChild size="lg">
          <Link href="/register">Start free</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/pricing">Compare plans</Link>
        </Button>
      </div>
    </div>
  );
}
