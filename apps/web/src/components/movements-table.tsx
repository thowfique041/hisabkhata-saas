'use client';
import { formatQty } from '@hisabkhata/shared';
import { Money } from '@/components/money';
import { cn, formatDate, titleCase } from '@/lib/utils';

export function MovementsTable({ items, showProduct = true }: { items: any[]; showProduct?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="ledger">
        <thead>
          <tr>
            <th>Date</th>
            {showProduct && <th>Product</th>}
            <th>Movement</th>
            <th className="hidden lg:table-cell">Reference</th>
            <th className="r hidden md:table-cell">Unit cost</th>
            <th className="r">Change</th>
            <th className="r">Balance</th>
          </tr>
        </thead>
        <tbody>
          {items.map((m) => (
            <tr key={m.id}>
              <td className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(m.createdAt, undefined, true)}</td>
              {showProduct && (
                <td>
                  <p className="font-medium">{m.product?.name}</p>
                  <p className="text-xs text-muted-foreground">{m.product?.sku}</p>
                </td>
              )}
              <td>
                {titleCase(m.type)}
                {m.reason && <span className="text-muted-foreground">, {titleCase(m.reason)}</span>}
              </td>
              <td className="hidden text-muted-foreground lg:table-cell">{m.note}</td>
              <td className="r hidden text-muted-foreground md:table-cell">{m.unitCost ? <Money value={m.unitCost} /> : ''}</td>
              <td className={cn('r font-medium', Number(m.quantity) < 0 ? 'text-negative' : 'text-positive')}>
                {Number(m.quantity) > 0 ? '+' : ''}
                {formatQty(m.quantity)}
              </td>
              <td className="r">{formatQty(m.balanceAfter)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
