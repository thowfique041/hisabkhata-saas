import type { MetadataRoute } from 'next';
import { site } from '@/config/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/features', '/pricing', '/about', '/contact', '/register'].map((p) => ({
    url: `${site.url}${p}`,
    changeFrequency: 'monthly',
    priority: p === '' ? 1 : 0.7,
  }));
}
