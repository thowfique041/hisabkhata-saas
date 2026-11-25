import type { Metadata } from 'next';
import { Clock, Mail, MessageCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { site } from '@/config/site';
import { getI18n } from '@/lib/i18n/server';
import { pageMetadata } from '@/lib/seo';
import { ContactForm } from './form';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return pageMetadata(t.meta.contactTitle, t.meta.contactDescription, '/contact');
}

export default async function ContactPage() {
  const { t } = await getI18n();
  const c = t.contact;
  const { whatsapp, phone, email } = site.contact;
  return (
    <div className="mx-auto grid max-w-5xl gap-12 px-6 py-16 md:grid-cols-[1fr_1.2fr]">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{c.title}</h1>
        <p className="mt-4 text-muted-foreground">{c.intro}</p>
        {whatsapp && (
          <Button asChild size="lg" variant="positive" className="mt-6">
            <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden />
              {c.whatsapp}
            </a>
          </Button>
        )}
        <dl className="mt-8 space-y-5 text-sm">
          {phone && (
            <div className="flex gap-3">
              <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <dt className="text-muted-foreground">{c.phone}</dt>
                <dd>
                  <a
                    href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                    className="font-medium hover:underline"
                  >
                    {phone}
                  </a>
                </dd>
              </div>
            </div>
          )}
          {email && (
            <div className="flex gap-3">
              <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <dt className="text-muted-foreground">{c.email}</dt>
                <dd>
                  <a href={`mailto:${email}`} className="font-medium hover:underline">
                    {email}
                  </a>
                </dd>
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <dt className="text-muted-foreground">{c.hours}</dt>
              <dd>{c.hoursValue}</dd>
            </div>
          </div>
        </dl>
      </div>
      <div className="rounded-lg border bg-surface p-6 shadow-sm">
        <ContactForm />
      </div>
    </div>
  );
}
