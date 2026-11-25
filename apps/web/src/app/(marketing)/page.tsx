import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Faq } from '@/components/marketing/faq';
import { HeroBackdrop } from '@/components/marketing/hero-backdrop';
import { HeroInvoice } from '@/components/marketing/hero-invoice';
import { PaymentsStrip } from '@/components/marketing/payments-strip';
import { ProductPreview } from '@/components/marketing/product-preview';
import { Reveal } from '@/components/marketing/reveal';
import { ShopTypes } from '@/components/marketing/shop-types';
import { InvoiceVisual, LedgerVisual, ScanVisual } from '@/components/marketing/step-visuals';
import { Testimonials } from '@/components/marketing/testimonials';
import { getI18n } from '@/lib/i18n/server';

const STEP_VISUALS = [ScanVisual, LedgerVisual, InvoiceVisual];

export default async function HomePage() {
  const { t, locale } = await getI18n();
  const h = t.home;
  return (
    <>
      <section className="relative isolate overflow-hidden border-b bg-background">
        <HeroBackdrop />
        <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-6 pb-20 pt-14 lg:grid-cols-[1.1fr_1fr] lg:pb-28 lg:pt-24">
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
          <HeroInvoice />
        </div>
        <div className="relative border-t bg-surface/70 backdrop-blur-sm">
          <div className="mx-auto max-w-6xl px-6 py-5">
            <PaymentsStrip label={h.paymentsLabel} names={h.payments} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <h2 className="max-w-xl text-2xl font-semibold tracking-tight">{h.stepsTitle}</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">{h.stepsBody}</p>
        </Reveal>
        <ol className="mt-10 grid gap-10 md:grid-cols-3">
          {h.steps.map(({ title, body }, i) => {
            const Visual = STEP_VISUALS[i];
            return (
              <Reveal
                as="li"
                key={title}
                delay={i * 0.08}
                className="flex flex-col border-t-2 border-primary pt-5"
              >
                <p className="num text-sm text-muted-foreground">
                  {t.common.step} {locale === 'bn' ? ['১', '২', '৩'][i] : i + 1}
                </p>
                <h3 className="mt-1 font-semibold">{title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
                <Visual v={h.stepVisual} />
              </Reveal>
            );
          })}
        </ol>
      </section>

      <section className="border-y bg-background">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Reveal className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight">{h.previewTitle}</h2>
            <p className="mt-3 text-muted-foreground">{h.previewBody}</p>
          </Reveal>
          <div className="mt-12">
            <ProductPreview alt={h.previewAlt} url={h.invoice.browserUrl} />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1fr_1.4fr]">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight">{h.builtTitle}</h2>
          <p className="mt-3 text-muted-foreground">{h.builtBody}</p>
          <ShopTypes labels={h.shopTypes} />
        </Reveal>
        <Reveal delay={0.1}>
          <dl className="divide-y border-y">
            {h.built.map(({ title, body }) => (
              <div key={title} className="grid gap-1 py-4 sm:grid-cols-[220px_1fr]">
                <dt className="font-medium">{title}</dt>
                <dd className="text-sm text-muted-foreground">{body}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </section>

      <Testimonials title={h.testimonialsTitle} locale={locale} />

      <div className="border-t bg-background">
        <Reveal className="mx-auto max-w-3xl px-6 py-20">
          <Faq id="home-faq" title={h.faqTitle} items={h.faq} />
        </Reveal>
      </div>

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
