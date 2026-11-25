'use client';
import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { PRODUCT_IMPORT_COLUMNS } from '@hisabkhata/shared';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';

type Row = Record<string, unknown>;
interface Report {
  total: number;
  valid: number;
  errors: { row: number; field: string; message: string }[];
  newCategories: string[];
  created?: number;
}

/** Header cells are matched loosely: "Selling price", "selling_price" and "SellingPrice" all work. */
const ALIASES: Record<string, (typeof PRODUCT_IMPORT_COLUMNS)[number]> = {
  name: 'name',
  productname: 'name',
  sku: 'sku',
  barcode: 'barcode',
  category: 'category',
  unit: 'unit',
  purchaseprice: 'purchasePrice',
  costprice: 'purchasePrice',
  cost: 'purchasePrice',
  sellingprice: 'sellingPrice',
  saleprice: 'sellingPrice',
  price: 'sellingPrice',
  taxrate: 'taxRate',
  tax: 'taxRate',
  taxpercent: 'taxRate',
  openingstock: 'openingStock',
  stock: 'openingStock',
  minstock: 'minStock',
  lowstockalert: 'minStock',
  reorderlevel: 'minStock',
};
const norm = (h: unknown) =>
  String(h ?? '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

function toRows(table: unknown[][]): Row[] {
  const [header, ...body] = table;
  if (!header) return [];
  const keys = header.map((h) => ALIASES[norm(h)]);
  return body
    .filter((r) => r.some((c) => String(c ?? '').trim() !== ''))
    .map((r) => {
      const out: Row = {};
      keys.forEach((k, i) => {
        if (k && r[i] !== null && r[i] !== undefined && String(r[i]).trim() !== '') out[k] = r[i];
      });
      return out;
    });
}

async function parseFile(file: File): Promise<Row[]> {
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import('read-excel-file/browser');
    return toRows((await readSheet(file)) as unknown[][]);
  }
  const Papa = (await import('papaparse')).default;
  return new Promise((resolve, reject) =>
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (r) => resolve(toRows(r.data)),
      error: reject,
    }),
  );
}

function downloadTemplate() {
  const lines = [
    PRODUCT_IMPORT_COLUMNS.join(','),
    'Miniket Rice 25 kg,RICE-25,8941000000011,Rice & Grains,bag,1720,1850,0,12,3',
    '"চানাচুর 300 g",,,Snacks,pack,68,80,0,40,10',
  ];
  // BOM so Excel opens the Bangla text as UTF-8.
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'hisabkhata-products-template.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Stage = 'pick' | 'reading' | 'preview' | 'importing' | 'done';

export function ImportProductsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t, tr } = useI18n();
  const im = t.panel.onboarding.import;
  const qc = useQueryClient();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [stage, setStage] = React.useState<Stage>('pick');
  const [fileName, setFileName] = React.useState('');
  const [rows, setRows] = React.useState<Row[]>([]);
  const [report, setReport] = React.useState<Report | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setStage('pick');
      setRows([]);
      setReport(null);
      setError(null);
      setFileName('');
    }
  }, [open]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setFileName(file.name);
    setStage('reading');
    try {
      const parsed = await parseFile(file);
      if (!parsed.length) throw new Error(im.empty);
      if (parsed.length > 1000) throw new Error(im.tooMany);
      setRows(parsed);
      setReport(
        await api<Report>('/products/import', {
          method: 'POST',
          body: { rows: parsed, dryRun: true },
        }),
      );
      setStage('preview');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (tr(errorMessage(err)) ?? null)
          : err instanceof Error && [im.empty, im.tooMany].includes(err.message)
            ? err.message
            : im.badFile,
      );
      setStage('pick');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const runImport = async () => {
    setStage('importing');
    try {
      const res = await api<Report>('/products/import', {
        method: 'POST',
        body: { rows, dryRun: false },
      });
      setReport(res);
      setStage('done');
      await qc.invalidateQueries({ queryKey: ['/products'] });
      await qc.invalidateQueries({ queryKey: ['/categories'] });
      await qc.invalidateQueries({ queryKey: ['/dashboard'] });
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as any) : null;
      if (body?.errors) setReport(body);
      setError(tr(errorMessage(err)) ?? null);
      setStage('preview');
    }
  };

  const invalidRows = report ? new Set(report.errors.map((e) => e.row)).size : 0;
  const fieldLabel = (f: string) => f;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent title={im.title} description={stage === 'done' ? undefined : im.intro} wide>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
            aria-label={im.choose}
          />
          {error && (
            <p
              role="alert"
              className="mb-4 rounded-md border border-negative/30 bg-negative/5 px-3 py-2 text-sm text-negative"
            >
              {error}
            </p>
          )}

          {(stage === 'pick' || stage === 'reading') && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={stage === 'reading'}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void onFile(e.dataTransfer.files?.[0]);
                }}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors enabled:hover:border-primary/40 enabled:hover:bg-accent/40 disabled:cursor-wait"
              >
                {stage === 'reading' ? (
                  <FileSpreadsheet className="size-8 animate-pulse text-muted-foreground" />
                ) : (
                  <Upload className="size-8 text-muted-foreground" />
                )}
                <span className="font-medium">{stage === 'reading' ? im.checking : im.choose}</span>
                <span className="text-xs text-muted-foreground">
                  {stage === 'reading' ? fileName : im.hint}
                </span>
              </button>
              <p className="text-xs text-muted-foreground">{im.required}</p>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download /> {im.template}
              </Button>
            </div>
          )}

          {(stage === 'preview' || stage === 'importing') && report && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="font-medium">
                  <FileSpreadsheet className="mr-1 inline size-4 align-text-bottom" />
                  {fileName}
                </span>
                <span className="text-muted-foreground">{im.found(report.total)}</span>
                <span className="text-positive">{im.valid(report.valid)}</span>
                {invalidRows > 0 && (
                  <span className="text-negative">{im.invalid(invalidRows)}</span>
                )}
              </div>
              {report.newCategories.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {im.newCategories(report.newCategories.join(', '))}
                </p>
              )}

              {report.errors.length > 0 ? (
                <>
                  <p className="flex items-start gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {im.fixFirst}
                  </p>
                  <div className="max-h-64 overflow-auto rounded-md border">
                    <table className="ledger">
                      <thead>
                        <tr>
                          <th className="w-16">{im.row}</th>
                          <th className="w-32">{im.column}</th>
                          <th>{im.problem}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.errors.map((e, i) => (
                          <tr key={i}>
                            <td className="num">{e.row}</td>
                            <td className="font-mono text-xs">{fieldLabel(e.field)}</td>
                            <td className="text-negative">{tr(e.message)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="max-h-64 overflow-auto rounded-md border">
                  <table className="ledger">
                    <thead>
                      <tr>
                        <th>name</th>
                        <th>category</th>
                        <th className="r">purchasePrice</th>
                        <th className="r">sellingPrice</th>
                        <th className="r">openingStock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 50).map((r, i) => (
                        <tr key={i}>
                          <td>{String(r.name ?? '')}</td>
                          <td className="text-muted-foreground">{String(r.category ?? '')}</td>
                          <td className="r num">{String(r.purchasePrice ?? '')}</td>
                          <td className="r num">{String(r.sellingPrice ?? '')}</td>
                          <td className="r num">{String(r.openingStock ?? '')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  disabled={stage === 'importing'}
                >
                  {im.another}
                </Button>
                <Button
                  onClick={runImport}
                  disabled={report.errors.length > 0}
                  disabledReason={im.fixFirst}
                  loading={stage === 'importing'}
                >
                  {im.importN(report.valid)}
                </Button>
              </div>
            </div>
          )}

          {stage === 'done' && report && (
            <div className="flex flex-col items-center gap-3 py-6 text-center" role="status">
              <CheckCircle2 className="size-10 text-positive" />
              <p className="text-lg font-semibold">{im.doneTitle}</p>
              <p className="text-sm text-muted-foreground">
                {im.doneBody(report.created ?? report.valid, report.newCategories.length)}
              </p>
              <Button onClick={() => onOpenChange(false)} autoFocus>
                {t.panel.common.done}
              </Button>
            </div>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
