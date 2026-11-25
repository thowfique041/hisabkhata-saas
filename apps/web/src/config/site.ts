/**
 * Public contact details and social links. Each one is read from a NEXT_PUBLIC_ variable and the
 * matching UI is hidden when it is empty, so nothing placeholder-looking ever ships.
 * See apps/web/.env.example.
 */
function env(v: string | undefined) {
  const s = v?.trim();
  return s ? s : undefined;
}

export const site = {
  name: 'HisabKhata',
  url: env(process.env.NEXT_PUBLIC_SITE_URL) ?? 'https://hisabkhata-omega.vercel.app',
  contact: {
    /** Digits only with country code, e.g. 8801712345678. Powers the wa.me link. */
    whatsapp: env(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER)?.replace(/\D/g, ''),
    /** As you want it shown and dialled, e.g. +880 1712-345678. */
    phone: env(process.env.NEXT_PUBLIC_CONTACT_PHONE),
    email: env(process.env.NEXT_PUBLIC_CONTACT_EMAIL),
  },
  social: [
    { key: 'facebook', label: 'Facebook', href: env(process.env.NEXT_PUBLIC_FACEBOOK_URL) },
    { key: 'youtube', label: 'YouTube', href: env(process.env.NEXT_PUBLIC_YOUTUBE_URL) },
    { key: 'linkedin', label: 'LinkedIn', href: env(process.env.NEXT_PUBLIC_LINKEDIN_URL) },
  ].filter((s): s is { key: string; label: string; href: string } => !!s.href),
};
