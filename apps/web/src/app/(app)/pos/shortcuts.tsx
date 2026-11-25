'use client';
import * as Popover from '@radix-ui/react-popover';
import { Keyboard } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { Button } from '@/components/ui/button';

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** The counter's keyboard map, one click away. */
export function ShortcutsPopover() {
  const { t } = useI18n();
  const k = t.panel.pos.keys;
  const mod = isMac() ? '⌘' : 'Ctrl';
  const rows: [string[], string][] = [
    [['F2'], k.scan],
    [['F4'], k.charge],
    [['Esc'], k.clear],
    [['+', '-'], k.qty],
    [['↑', '↓'], k.lines],
    [['Del'], k.del],
    [[mod, 'H'], k.hold],
    [[mod, 'K'], k.palette],
  ];
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={t.panel.pos.shortcuts}
          title={t.panel.pos.shortcuts}
        >
          <Keyboard />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-72 rounded-lg border bg-surface p-3 text-sm shadow-lg animate-fade-in"
        >
          <p className="mb-2 font-medium">{t.panel.pos.shortcuts}</p>
          <dl className="space-y-1.5">
            {rows.map(([keys, label]) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="flex shrink-0 gap-1">
                  {keys.map((key) => (
                    <kbd
                      key={key}
                      className="min-w-6 rounded border bg-muted px-1.5 py-0.5 text-center font-sans text-xs font-medium"
                    >
                      {key}
                    </kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
          <Popover.Arrow className="fill-surface" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
