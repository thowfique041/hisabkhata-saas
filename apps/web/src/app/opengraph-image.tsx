import { ImageResponse } from 'next/og';

export const alt = 'HisabKhata: inventory, POS and invoicing for Bangladeshi shops';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Shared social card: the mark, the promise, and a slice of the khata. */
export default function OpengraphImage() {
  const rows: [string, string][] = [
    ['Miniket Rice 25 kg  x2', '3,700.00'],
    ['Soybean Oil 5 L  x1', '880.00'],
    ['Ispahani Tea 400 g  x1', '240.00'],
  ];
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background: '#0F1E3D',
        color: 'white',
        padding: 72,
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flex: 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="14" fill="#FFFFFF" />
            <rect x="16" y="22" width="8" height="22" rx="2" fill="#0F1E3D" />
            <rect x="40" y="13" width="8" height="31" rx="2" fill="#0F1E3D" />
            <path d="M22.5 35.5 L41.5 26.5 L41.5 33.2 L22.5 42.2 Z" fill="#10B981" />
          </svg>
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 600 }}>
            <span>Hisab</span>
            <span style={{ color: '#34D399' }}>Khata</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 560 }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.05 }}>
            Your shop&apos;s khata, kept straight.
          </div>
          <div style={{ fontSize: 28, color: '#CBD5E1', lineHeight: 1.35 }}>
            Stock, sales, baki and invoices in one place. Built for shops in Bangladesh.
          </div>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: 420,
          alignSelf: 'center',
          background: 'white',
          color: '#0F1E3D',
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: '20px 26px',
            borderBottom: '2px solid #E3E8EF',
          }}
        >
          <span style={{ fontSize: 22, fontWeight: 600 }}>Rahman General Store</span>
          <span style={{ fontSize: 17, color: '#475569' }}>Invoice RGS-2600568</span>
        </div>
        {rows.map(([n, a]) => (
          <div
            key={n}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '14px 26px',
              borderBottom: '1px solid #E3E8EF',
              fontSize: 20,
            }}
          >
            <span>{n}</span>
            <span>Tk {a}</span>
          </div>
        ))}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '18px 26px',
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          <span>Added to dues</span>
          <span style={{ color: '#B91C1C' }}>Tk 2,060.00</span>
        </div>
      </div>
    </div>,
    size,
  );
}
