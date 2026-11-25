'use client';
import * as React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoney } from '@hisabkhata/shared';
import Link from 'next/link';
import { useSession } from '@/hooks/use-session';
import { Button } from '@/components/ui/button';

/**
 * Shown instead of empty axes: a faint sketch of a chart, one line of text and the next step.
 * Purely decorative SVG; the message carries the meaning.
 */
export function ChartEmpty({
  message,
  action,
  kind = 'line',
  height = 240,
}: {
  message: string;
  action?: { label: string; href: string };
  kind?: 'line' | 'bar';
  height?: number;
}) {
  return (
    <div
      className="relative flex flex-col items-center justify-center overflow-hidden rounded-md text-center"
      style={{ height }}
    >
      <svg
        aria-hidden
        viewBox="0 0 400 160"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-3/4 w-full text-muted-foreground/15"
      >
        {[40, 80, 120].map((y) => (
          <line key={y} x1="0" x2="400" y1={y} y2={y} stroke="currentColor" strokeDasharray="4 6" />
        ))}
        {kind === 'line' ? (
          <path
            d="M0 130 C 40 110, 70 120, 100 95 S 160 70, 200 85 S 260 40, 300 55 S 360 20, 400 30 L400 160 L0 160 Z"
            fill="currentColor"
          />
        ) : (
          [20, 70, 120, 170, 220, 270, 320, 360].map((x, i) => (
            <rect
              key={x}
              x={x}
              y={150 - [40, 70, 55, 90, 75, 110, 95, 120][i]}
              width="26"
              height={[40, 70, 55, 90, 75, 110, 95, 120][i]}
              rx="2"
              fill="currentColor"
            />
          ))
        )}
      </svg>
      <p className="relative max-w-xs text-sm text-muted-foreground">{message}</p>
      {action && (
        <Button asChild size="sm" className="relative mt-3">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}

const short = (v: number) =>
  Math.abs(v) >= 100000
    ? `${(v / 100000).toFixed(1)}L`
    : Math.abs(v) >= 1000
      ? `${(v / 1000).toFixed(0)}k`
      : String(v);
const axis = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };

function useCur() {
  return useSession().data?.activeTenant?.currency ?? 'BDT';
}

export function SalesChart({
  data,
  empty,
}: {
  data: { date: string; sales: string; orders: number }[];
  empty?: React.ReactNode;
}) {
  const cur = useCur();
  if (empty && data.every((d) => Number(d.sales) === 0)) return <>{empty}</>;
  const rows = data.map((d) => ({
    ...d,
    value: Number(d.sales),
    label: d.date.slice(8) + '/' + d.date.slice(5, 7),
  }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="sales" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#059669" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#059669" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval={4} />
        <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={short} width={40} />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--surface))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 6,
            fontSize: 12,
          }}
          formatter={(v: any, _n: any, p: any) => [
            `${formatMoney(String(v), cur)} from ${p.payload.orders} orders`,
            'Sales',
          ]}
          labelFormatter={(_, p: any) => p?.[0]?.payload.date ?? ''}
        />
        <Area type="monotone" dataKey="value" stroke="#059669" strokeWidth={2} fill="url(#sales)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function RevenueChart({
  data,
  empty,
}: {
  data: { month: string; revenue: string; grossProfit: string; expenses: string }[];
  empty?: React.ReactNode;
}) {
  const cur = useCur();
  if (empty && data.every((d) => Number(d.revenue) === 0 && Number(d.expenses) === 0))
    return <>{empty}</>;
  const rows = data.map((d) => ({
    label: new Date(d.month + '-01T00:00:00Z').toLocaleString('en', {
      month: 'short',
      timeZone: 'UTC',
    }),
    Revenue: Number(d.revenue),
    'Gross profit': Number(d.grossProfit),
    Expenses: Number(d.expenses),
  }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
        <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={short} width={40} />
        <Tooltip
          cursor={{ fill: 'hsl(var(--muted))' }}
          contentStyle={{
            background: 'hsl(var(--surface))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 6,
            fontSize: 12,
          }}
          formatter={(v: any, n: any) => [formatMoney(String(v), cur), n]}
        />
        <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Revenue" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
        <Bar dataKey="Gross profit" fill="#059669" radius={[2, 2, 0, 0]} />
        <Bar dataKey="Expenses" fill="#7FA7E6" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
