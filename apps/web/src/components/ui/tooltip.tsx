'use client';
import * as React from 'react';
import * as T from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

export const TooltipProvider = T.Provider;

/** Small dark label on hover or keyboard focus. Wrap the app in <TooltipProvider>. */
export function Tooltip({
  content,
  children,
  side = 'top',
  className,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}) {
  if (!content) return <>{children}</>;
  return (
    <T.Root delayDuration={200}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className={cn(
            'z-[60] max-w-xs rounded-md bg-navy px-2.5 py-1.5 text-xs text-white shadow-lg animate-fade-in dark:bg-slate-100 dark:text-navy',
            className,
          )}
        >
          {content}
          <T.Arrow className="fill-navy dark:fill-slate-100" />
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
