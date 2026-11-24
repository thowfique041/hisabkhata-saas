import { Badge } from '@/components/ui/misc';
import { titleCase } from '@/lib/utils';

export function PaymentBadge({ status }: { status: string }) {
  const tone = status === 'PAID' ? 'positive' : status === 'DUE' ? 'negative' : 'warning';
  return <Badge tone={tone}>{titleCase(status)}</Badge>;
}

export function SaleStatusBadge({ status, paymentStatus }: { status: string; paymentStatus?: string }) {
  if (status === 'COMPLETED' && paymentStatus) return <PaymentBadge status={paymentStatus} />;
  const tone = status === 'CANCELLED' ? 'neutral' : status === 'REFUNDED' ? 'neutral' : 'warning';
  return <Badge tone={tone}>{titleCase(status)}</Badge>;
}

export function StockBadge({ stock, min }: { stock: string; min: string }) {
  const s = Number(stock);
  if (s <= 0) return <Badge tone="negative">Out of stock</Badge>;
  if (s <= Number(min)) return <Badge tone="warning">Low</Badge>;
  return null;
}
