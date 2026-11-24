'use client';
import * as React from 'react';
import * as M from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export function MenuContent({ className, align = 'end', ...props }: React.ComponentPropsWithoutRef<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content align={align} sideOffset={6} className={cn('z-50 min-w-[200px] rounded-md border bg-surface p-1 shadow-lg animate-fade-in', className)} {...props} />
    </M.Portal>
  );
}
export function MenuItem({ className, ...props }: React.ComponentPropsWithoutRef<typeof M.Item>) {
  return <M.Item className={cn('flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted [&_svg]:size-4', className)} {...props} />;
}
export function MenuLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof M.Label>) {
  return <M.Label className={cn('px-2 py-1.5 text-xs text-muted-foreground', className)} {...props} />;
}
export const MenuSeparator = () => <M.Separator className="my-1 h-px bg-border" />;
