import type { Metadata } from 'next';
import { BadgeCheck, MapPin, Scale, Store, UserRound, type LucideIcon } from 'lucide-react';
import { Reveal } from '@/components/marketing/reveal';
import { getI18n } from '@/lib/i18n/server';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return pageMetadata(t.meta.aboutTitle, t.meta.aboutDescription, '/about');
}

const VALUE_ICONS: LucideIcon[] = [Store, BadgeCheck, Scale];

/**
 * TODO(founder): replace the placeholder with a real photo (e.g. /public/about/founder.jpg) and
 * name. Set FOUNDER below; while it is null the block shows a neutral placeholder.
 */
const FOUNDER: { name: string; photo: string } | null = null;

export default async function AboutPage() {
  const { t } = await getI18n();
  const a = t.about;
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{a.title}</h1>
          <div className="mt-8 space-y-5 text-[17px] leading-[1.75] text-muted-foreground">
            {a.story.map((p, i) => (
              <p key={i} className={i === 0 ? 'text-foreground' : undefined}>
                {p}
              </p>
            ))}
          </div>
        </div>
        <aside className="space-y-6 lg:pt-16">
          <figure className="rounded-lg border bg-surface p-5">
            {FOUNDER ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={FOUNDER.photo}
                alt={FOUNDER.name}
                className="aspect-[4/3] w-full rounded-md object-cover"
              />
            ) : (
              <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-muted/50 text-center text-sm text-muted-foreground">
                <UserRound className="size-8" aria-hidden />
                <span className="px-6">{a.founderPlaceholder}</span>
              </div>
            )}
            <figcaption className="mt-3 text-sm">
              {FOUNDER && <span className="font-medium">{FOUNDER.name}, </span>}
              <span className="text-muted-foreground">{a.founderRole}</span>
            </figcaption>
          </figure>
          <div className="rounded-lg bg-navy p-5 text-white dark:bg-navy-700 dark:ring-1 dark:ring-white/10">
            <p className="flex items-center gap-2 font-semibold">
              <MapPin className="size-4 text-[#34D399]" aria-hidden />
              {a.madeTitle}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{a.madeBody}</p>
          </div>
        </aside>
      </div>

      <section className="mt-20 border-t pt-14" aria-labelledby="values-title">
        <h2 id="values-title" className="text-2xl font-semibold tracking-tight">
          {a.valuesTitle}
        </h2>
        <ul className="mt-8 grid gap-6 md:grid-cols-3">
          {a.values.map((v, i) => {
            const Icon = VALUE_ICONS[i];
            return (
              <Reveal
                as="li"
                key={v.title}
                delay={i * 0.08}
                className="rounded-lg border bg-surface p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="inline-flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-semibold">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.body}</p>
              </Reveal>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
