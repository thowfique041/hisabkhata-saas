'use client';
import * as React from 'react';
import { animate, AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { useI18n } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

const ROWS = [
  { qty: 2, amount: 3700 },
  { qty: 1, amount: 880 },
  { qty: 3, amount: 240 },
  { qty: 1, amount: 240 },
];
const TOTAL = 5060;
const PAID = 3000;
const DUE = TOTAL - PAID;

/** Lakh grouping (1,00,000) with two decimals: how amounts are written here. */
const taka = (n: number) =>
  `৳${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// One timeline for the whole card, in seconds from the moment it scrolls into view.
const T = {
  row: (i: number) => 0.25 + i * 0.32,
  total: 1.65,
  paid: 2.55,
  due: 2.95,
  badge: 3.45,
  tick: [4.0, 4.45],
};

/**
 * The hero's khata page. It "writes itself" once, the first time it is seen: items, a total that
 * counts up, the bKash payment, the remainder going to dues, then the stock badge ticking down.
 * With reduced motion it simply shows the finished page.
 */
export function HeroInvoice() {
  const { t } = useI18n();
  const inv = t.home.invoice;
  const ref = React.useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduce = useReducedMotion();
  const play = inView && !reduce;

  const [total, setTotal] = React.useState(reduce ? TOTAL : 0);
  const [stock, setStock] = React.useState(reduce ? 4 : 6);

  React.useEffect(() => {
    if (reduce) {
      setTotal(TOTAL);
      setStock(4);
      return;
    }
    if (!inView) return;
    const count = animate(0, TOTAL, {
      delay: T.total,
      duration: 0.8,
      ease: 'easeOut',
      onUpdate: (v) => setTotal(Math.round(v)),
    });
    const timers = T.tick.map((at, i) => setTimeout(() => setStock(5 - i), at * 1000));
    return () => {
      count.stop();
      timers.forEach(clearTimeout);
    };
  }, [inView, reduce]);

  const appear = (delay: number, y = 6) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y },
          animate: play ? { opacity: 1, y: 0 } : undefined,
          transition: { delay, duration: 0.35, ease: 'easeOut' as const },
        };

  return (
    <figure ref={ref} className="relative mx-auto mb-14 w-full max-w-md" aria-label={inv.label}>
      <div className="rounded-lg border bg-surface shadow-[0_1px_0_hsl(var(--border)),0_24px_48px_-24px_rgba(15,30,61,0.28)] dark:shadow-[0_24px_48px_-24px_rgba(0,0,0,0.6)]">
        <div className="flex items-start justify-between border-b px-5 py-4">
          <div>
            <p className="text-sm font-semibold">{inv.store}</p>
            <p className="text-xs text-muted-foreground">{inv.address}</p>
          </div>
          <div className="text-right">
            <p className="num text-sm font-medium">RGS-2600568</p>
            <p className="text-xs text-muted-foreground">{inv.date}</p>
          </div>
        </div>
        <table className="ledger">
          <thead>
            <tr>
              <th>{inv.item}</th>
              <th className="r">{inv.qty}</th>
              <th className="r">{inv.amount}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r, i) => (
              <motion.tr key={inv.items[i]} {...appear(T.row(i), 4)}>
                <td>{inv.items[i]}</td>
                <td className="r text-muted-foreground">{r.qty}</td>
                <td className="r">{taka(r.amount)}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        <dl className="space-y-1.5 border-t px-5 py-4 text-sm">
          <motion.div className="flex justify-between" {...appear(T.total - 0.1, 0)}>
            <dt className="text-muted-foreground">{inv.total}</dt>
            <dd className="num font-semibold" aria-live="off">
              {taka(total)}
            </dd>
          </motion.div>
          <motion.div className="flex justify-between" {...appear(T.paid)}>
            <dt className="text-muted-foreground">{inv.paidBy}</dt>
            <dd className="num text-positive">{taka(PAID)}</dd>
          </motion.div>
          <motion.div className="flex justify-between" {...appear(T.due)}>
            <dt>{inv.dues}</dt>
            <dd className="num font-semibold text-negative">{taka(DUE)}</dd>
          </motion.div>
        </dl>
      </div>

      <motion.div
        className="absolute -bottom-16 right-4 w-56 rounded-md border bg-surface px-4 py-3 text-xs shadow-md sm:block lg:-right-8"
        {...appear(T.badge, 10)}
      >
        <p className="text-muted-foreground">{inv.stockAfter}</p>
        <p className="mt-1 flex items-center justify-between gap-3">
          <span>{inv.rice}</span>
          <span
            className={cn(
              'num relative inline-flex min-w-[4.5rem] justify-end overflow-hidden font-medium',
              stock <= 4 ? 'text-warning' : 'text-foreground',
            )}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={stock}
                initial={reduce ? false : { y: -12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reduce ? undefined : { y: 12, opacity: 0 }}
                transition={{ duration: 0.22 }}
              >
                {inv.left(stock)}
              </motion.span>
            </AnimatePresence>
          </span>
        </p>
      </motion.div>
    </figure>
  );
}
