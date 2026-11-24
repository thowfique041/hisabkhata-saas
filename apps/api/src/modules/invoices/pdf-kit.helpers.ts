import path from 'node:path';
import fs from 'node:fs';
import PDFDocument from 'pdfkit';
import { currencySymbol } from '@hisabkhata/shared';

const FONT_DIR = path.resolve(__dirname, '../../../assets/fonts');
const fontPath = (f: string) => path.join(FONT_DIR, f);

export const FONTS = {
  regular: 'Inter',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
  bn: 'NotoBengali',
  bnBold: 'NotoBengali-Bold',
};

export const COLORS = {
  navy: '#0F1E3D',
  ink: '#1E293B',
  muted: '#64748B',
  line: '#E2E8F0',
  soft: '#F1F5F9',
  emerald: '#059669',
  amber: '#B45309',
  red: '#B91C1C',
};

export function createDoc(meta: { title: string; author: string }, opts: { layout?: 'portrait' | 'landscape'; margin?: number } = {}) {
  const doc = new PDFDocument({ size: 'A4', layout: opts.layout ?? 'portrait', margin: opts.margin ?? 40, info: { Title: meta.title, Author: meta.author, Creator: 'HisabKhata' }, bufferPages: true });
  doc.registerFont(FONTS.regular, fontPath('inter-latin-400-normal.woff'));
  doc.registerFont(FONTS.semibold, fontPath('inter-latin-600-normal.woff'));
  doc.registerFont(FONTS.bold, fontPath('inter-latin-700-normal.woff'));
  doc.registerFont(FONTS.bn, fontPath('noto-sans-bengali-bengali-400-normal.woff'));
  doc.registerFont(FONTS.bnBold, fontPath('noto-sans-bengali-bengali-700-normal.woff'));
  doc.font(FONTS.regular);
  return doc;
}

const BENGALI = /[ঀ-৿]+/g;

/** Splits text into Latin and Bengali runs so each is drawn with a font that has the glyphs. */
function runs(text: string): { text: string; bn: boolean }[] {
  const out: { text: string; bn: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(BENGALI)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index), bn: false });
    out.push({ text: m[0], bn: true });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), bn: false });
  return out.length ? out : [{ text: '', bn: false }];
}

export function mixedText(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  opts: { width?: number; size?: number; bold?: boolean; color?: string; align?: 'left' | 'right' } = {},
) {
  const parts = runs(text);
  doc.fontSize(opts.size ?? 9).fillColor(opts.color ?? COLORS.ink);
  if (opts.align === 'right' && opts.width) {
    const total = parts.reduce((w, p) => w + doc.font(fontFor(p.bn, opts.bold)).widthOfString(p.text), 0);
    let cx = x + opts.width - total;
    for (const p of parts) {
      doc.font(fontFor(p.bn, opts.bold)).text(p.text, cx, y, { lineBreak: false });
      cx += doc.widthOfString(p.text);
    }
    return;
  }
  parts.forEach((p, i) => {
    doc.font(fontFor(p.bn, opts.bold));
    const continued = i < parts.length - 1;
    if (i === 0) doc.text(p.text, x, y, { width: opts.width, continued });
    else doc.text(p.text, { continued });
  });
}

function fontFor(bn: boolean, bold?: boolean) {
  if (bn) return bold ? FONTS.bnBold : FONTS.bn;
  return bold ? FONTS.semibold : FONTS.regular;
}

/** Right-aligned money, e.g. "৳1,25,000.00". The taka sign comes from the Bengali font. */
export function moneyText(
  doc: PDFKit.PDFDocument,
  formatted: string,
  currency: string,
  rightX: number,
  y: number,
  opts: { size?: number; bold?: boolean; color?: string } = {},
) {
  const symbol = currencySymbol(currency);
  const negative = formatted.startsWith('-');
  const number = formatted.replace('-', '').replace(symbol, '');
  doc.fontSize(opts.size ?? 9).fillColor(opts.color ?? COLORS.ink);
  const symFont = currency === 'BDT' ? (opts.bold ? FONTS.bnBold : FONTS.bn) : opts.bold ? FONTS.semibold : FONTS.regular;
  const numFont = opts.bold ? FONTS.semibold : FONTS.regular;
  const wSign = negative ? doc.font(numFont).widthOfString('-') : 0;
  const wSym = doc.font(symFont).widthOfString(symbol);
  const wNum = doc.font(numFont).widthOfString(number);
  let x = rightX - (wSign + wSym + wNum);
  if (negative) {
    doc.font(numFont).text('-', x, y, { lineBreak: false });
    x += wSign;
  }
  doc.font(symFont).text(symbol, x, y - (currency === 'BDT' ? 1 : 0), { lineBreak: false });
  doc.font(numFont).text(number, x + wSym, y, { lineBreak: false });
}

export function docToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

export function readLocalFile(p: string): Buffer | null {
  try {
    return fs.readFileSync(p);
  } catch {
    return null;
  }
}
