import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getI18n } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.featuresTitle, description: t.meta.featuresDescription };
}

export default async function FeaturesPage() {
  const { t } = await getI18n();
  const f = t.features;
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">{f.title}</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{f.intro}</p>
      <div className="mt-14 divide-y border-y">
        {f.sections.map((s) => (
          <section key={s.key} className="grid gap-6 py-10 lg:grid-cols-[320px_1fr]">
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
