'use client';
import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';
import { formatRangeLabel, presetRange, type DateRange, type RangePreset } from '@/lib/dhaka-dates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const PRESETS: RangePreset[] = [
  'today',
  'yesterday',
  'last7',
  'last30',
  'thisMonth',
  'lastMonth',
  'thisYear',
];

/**
 * One date filter for every list and report: quick presets in Dhaka time plus a custom range.
 * `allowAll` adds "All time" for lists that default to showing everything.
 */
export function DateRangePicker({
  value,
  onChange,
  allowAll = false,
  className,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
  allowAll?: boolean;
  className?: string;
}) {
  const { t, locale } = useI18n();
  const d = t.panel.dates;
  const [open, setOpen] = React.useState(false);
  const [from, setFrom] = React.useState(value.from ?? '');
  const [to, setTo] = React.useState(value.to ?? '');
  React.useEffect(() => {
    if (open) {
      setFrom(value.from ?? '');
      setTo(value.to ?? '');
    }
  }, [open, value.from, value.to]);

  const label =
    value.preset === 'custom'
      ? formatRangeLabel(value, locale)
      : value.preset === 'all'
        ? d.presets.all
        : d.presets[value.preset];
  const options = allowAll ? (['all', ...PRESETS] as RangePreset[]) : PRESETS;
  const invalid = !!from && !!to && from > to;
  const pick = (p: RangePreset) => {
    onChange(presetRange(p));
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="outline"
          className={cn('h-9 justify-between gap-2 font-normal', className)}
          aria-label={`${d.label}: ${label}`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{label}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[min(92vw,20rem)] rounded-lg border bg-surface p-2 shadow-lg"
        >
          <div role="listbox" aria-label={d.label} className="grid grid-cols-2 gap-1">
            {options.map((p) => (
              <button
                key={p}
                role="option"
                aria-selected={value.preset === p}
                onClick={() => pick(p)}
                className={cn(
                  'flex items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted coarse:py-3',
                  value.preset === p && 'bg-accent font-medium text-accent-foreground',
                )}
              >
                {d.presets[p]}
                {value.preset === p && <Check className="size-3.5" />}
              </button>
            ))}
          </div>
          <form
            className="mt-2 space-y-2 border-t pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (invalid || (!from && !to)) return;
              onChange({ preset: 'custom', from: from || to, to: to || from });
              setOpen(false);
            }}
          >
            <p className="px-0.5 text-xs font-medium text-muted-foreground">{d.custom}</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">{d.from}</span>
                <Input
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-9"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">{d.to}</span>
                <Input
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-9"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              {allowAll && value.preset !== 'all' && (
                <Button type="button" variant="ghost" size="sm" onClick={() => pick('all')}>
                  {d.clear}
                </Button>
              )}
              <Button type="submit" size="sm" disabled={invalid || (!from && !to)}>
                {d.apply}
              </Button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
