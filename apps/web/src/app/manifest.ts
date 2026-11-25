import type { MetadataRoute } from 'next';

/** Lets shops add HisabKhata to a tablet or phone home screen and open it like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HisabKhata',
    short_name: 'HisabKhata',
    description: 'Inventory, point of sale and invoicing for shops in Bangladesh.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#F6F8FB',
    theme_color: '#0F1E3D',
    lang: 'en',
    categories: ['business', 'finance', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'New sale', url: '/pos', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      {
        name: 'Products',
        url: '/products',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
  };
}
