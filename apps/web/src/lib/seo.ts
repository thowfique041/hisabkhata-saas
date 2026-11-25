import type { Metadata } from 'next';

/** Title, description and matching Open Graph/Twitter tags for a public page. */
export function pageMetadata(title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    // A page-level openGraph replaces the root one, so the shared card is listed again here.
    openGraph: {
      title: `${title} | HisabKhata`,
      description,
      url: path,
      images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | HisabKhata`,
      description,
      images: ['/opengraph-image'],
    },
  };
}
