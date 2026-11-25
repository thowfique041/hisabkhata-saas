import { formatMoney, formatQty } from '@hisabkhata/shared';
import {
  COLORS,
  createDoc,
  docToBuffer,
  FONTS,
  mixedText,
  moneyText,
} from '../invoices/pdf-kit.helpers';
import type { Report } from './reports.service';

const fmtDate = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));

/** Renders any tabular report as a landscape A4 PDF. */
export async function renderReportPdf(
  report: Report,
  tenant: { name: string; currency: string; timezone: string },
): Promise<Buffer> {
  const doc = await createDoc(
    { title: report.title, author: tenant.name },
    { layout: 'landscape', margin: 36 },
  );
  const left = 36;
  const right = doc.page.width - 36;
  const width = right - left;
  const cur = tenant.currency;

  mixedText(doc, tenant.name, left, 36, { size: 10, color: COLORS.muted, width: 400 });
  doc.font(FONTS.bold).fontSize(16).fillColor(COLORS.navy).text(report.title, left, 52);
  doc
    .font(FONTS.regular)
    .fontSize(8.5)
    .fillColor(COLORS.muted)
    .text(
      `${fmtDate(report.period.from, tenant.timezone)} to ${fmtDate(report.period.to, tenant.timezone)}  ·  Generated ${fmtDate(new Date().toISOString(), tenant.timezone)}`,
      left,
      74,
    );

  let y = 96;
  if (report.summary.length) {
    const boxW = Math.min(150, width / report.summary.length);
    report.summary.forEach((s, i) => {
      const x = left + i * boxW;
      doc
        .font(FONTS.regular)
        .fontSize(7.5)
        .fillColor(COLORS.muted)
        .text(s.label.toUpperCase(), x, y, { width: boxW - 8 });
      if (s.type === 'money')
        moneyText(doc, formatMoney(s.value, cur), cur, x + boxW - 12, y + 12, {
          size: 11,
          bold: !!s.emphasis,
          color: COLORS.navy,
        });
      else
        doc
          .font(FONTS.semibold)
          .fontSize(11)
          .fillColor(COLORS.navy)
          .text(s.type === 'percent' ? `${s.value}%` : s.value, x, y + 12, {
            width: boxW - 12,
            align: 'right',
          });
    });
    y += 40;
  }

  const n = report.columns.length;
  const weights = report.columns.map((c) => (c.type === 'text' ? 2 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  const xs: number[] = [];
  let acc = left;
  weights.forEach((w) => {
    xs.push(acc);
    acc += (width * w) / total;
  });
  const colW = (i: number) => (i < n - 1 ? xs[i + 1] - xs[i] : right - xs[i]);

  const header = (yy: number) => {
    doc.rect(left, yy, width, 18).fill(COLORS.soft);
    report.columns.forEach((c, i) => {
      doc
        .font(FONTS.semibold)
        .fontSize(7.5)
        .fillColor(COLORS.muted)
        .text(c.label.toUpperCase(), xs[i] + 4, yy + 5, {
          width: colW(i) - 8,
          align: c.type === 'text' ? 'left' : 'right',
          lineBreak: false,
        });
    });
    return yy + 22;
  };
  y = header(y);

  if (!report.rows.length) {
    doc
      .font(FONTS.regular)
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text('No records in this period.', left + 4, y + 4);
  }
  for (const row of report.rows) {
    if (y > doc.page.height - 50) {
      doc.addPage({ size: 'A4', layout: 'landscape', margin: 36 });
      y = header(36);
    }
    report.columns.forEach((c, i) => {
      const v = row[c.key];
      const x = xs[i];
      const w = colW(i);
      if (c.type === 'money')
        moneyText(doc, formatMoney(String(v ?? '0'), cur), cur, x + w - 4, y, { size: 8.5 });
      else if (c.type === 'text')
        mixedText(doc, String(v ?? ''), x + 4, y, { size: 8.5, width: w - 8 });
      else
        doc
          .font(FONTS.regular)
          .fontSize(8.5)
          .fillColor(COLORS.ink)
          .text(
            c.type === 'qty'
              ? formatQty(String(v ?? '0'))
              : c.type === 'percent'
                ? `${v}%`
                : String(v ?? ''),
            x + 4,
            y,
            { width: w - 8, align: 'right', lineBreak: false },
          );
    });
    y += 16;
    doc
      .moveTo(left, y - 4)
      .lineTo(right, y - 4)
      .lineWidth(0.4)
      .strokeColor(COLORS.line)
      .stroke();
  }

  return docToBuffer(doc);
}
