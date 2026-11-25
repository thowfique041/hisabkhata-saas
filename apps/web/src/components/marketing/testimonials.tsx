import Image from 'next/image';
import { TESTIMONIALS } from '@/config/testimonials';
import type { Locale } from '@/lib/i18n';

/** Renders nothing until config/testimonials.ts has real entries. */
export function Testimonials({ title, locale }: { title: string; locale: Locale }) {
  if (TESTIMONIALS.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-6 py-20" aria-labelledby="testimonials-title">
      <h2 id="testimonials-title" className="text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      <ul className="mt-10 grid gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <li key={t.name} className="flex flex-col rounded-lg border bg-surface p-6">
            <blockquote className="flex-1 leading-relaxed">“{t.quote[locale]}”</blockquote>
            <div className="mt-5 flex items-center gap-3">
              {t.photo && (
                <Image
                  src={t.photo}
                  alt=""
                  width={40}
                  height={40}
                  className="size-10 rounded-full object-cover"
                />
              )}
              <div className="text-sm">
                <p className="font-medium">{t.name}</p>
                <p className="text-muted-foreground">{t.role[locale]}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
