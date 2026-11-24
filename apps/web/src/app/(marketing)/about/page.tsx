import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'About' };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Why we built HisabKhata</h1>
      <div className="mt-8 space-y-5 text-[17px] leading-[1.75] text-muted-foreground">
        <p>
          Walk into almost any shop in Bangladesh and you will find a <span className="text-foreground">khata</span>: a bound notebook where the owner writes down who bought what, who still owes money, and what needs to be ordered. It works, until the shop grows, a second person starts working the counter, or the notebook goes missing.
        </p>
        <p>Most software built for shops was designed somewhere else. Prices in dollars, no idea what bKash is, invoices that do not show the taka sign, and no way to track baki the way shopkeepers actually do it.</p>
        <p>HisabKhata keeps the idea of the khata and makes it reliable. Each sale updates stock, payments and dues in one step. Each change is recorded with who made it and why. Owners see their real profit; cashiers see only what they need.</p>
        <p>We build for grocery stores, pharmacies, electronics shops, wholesalers and distributors, and we start from how they already work.</p>
      </div>
    </div>
  );
}
