'use client';
import * as React from 'react';
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from '@hisabkhata/shared';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { useMoney } from '@/components/money';

/** Amount + method + reference. Used for customer dues, sale dues and supplier payments. */
export function PaymentForm({ max, submitLabel, onSubmit, pending, defaultMethod = 'CASH' }: { max: string; submitLabel: string; onSubmit: (v: { method: PaymentMethod; amount: string; reference?: string; note?: string }) => void; pending?: boolean; defaultMethod?: PaymentMethod }) {
  const fmt = useMoney();
  const [method, setMethod] = React.useState<PaymentMethod>(defaultMethod);
  const [amount, setAmount] = React.useState(max);
  const [reference, setReference] = React.useState('');
  const invalid = !/^\d{1,12}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!invalid) onSubmit({ method, amount, reference: reference || undefined });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount" htmlFor="pay-amount" hint={`Outstanding ${fmt(max)}`}>
          <Input id="pay-amount" className="num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <Field label="Method" htmlFor="pay-method">
          <Select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Reference (optional)" htmlFor="pay-ref" hint="Transaction ID for bKash, Nagad, card or bank.">
        <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
      </Field>
      <Button type="submit" className="w-full" disabled={invalid} loading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
