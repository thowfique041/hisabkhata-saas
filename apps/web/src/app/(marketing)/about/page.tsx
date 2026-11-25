import type { Metadata } from 'next';
import { getI18n } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.aboutTitle, description: t.meta.aboutDescription };
}

export default async function AboutPage() {
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{t.about.title}</h1>
      <div className="mt-8 space-y-5 text-[17px] leading-[1.75] text-muted-foreground">
        {t.about.story.map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
      </div>
    </div>
  );
}
