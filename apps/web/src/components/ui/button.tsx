import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from './tooltip';

/**
 * Hover and lift styles only apply to enabled buttons (`enabled:`), so a disabled button never
 * looks pressable. Filled variants turn muted grey when disabled instead of a paler version of
 * their colour, which read as "clickable" at the counter.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150 enabled:active:translate-y-0 disabled:cursor-not-allowed aria-disabled:cursor-not-allowed [&_svg]:size-4 [&_svg]:shrink-0 coarse:min-h-11',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-sm enabled:hover:-translate-y-px enabled:hover:bg-primary/90 enabled:hover:shadow-md disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none',
        positive:
          'bg-emerald text-white shadow-sm enabled:hover:-translate-y-px enabled:hover:bg-emerald/90 enabled:hover:shadow-md disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none',
        destructive:
          'bg-negative text-white enabled:hover:bg-negative/90 disabled:bg-muted disabled:text-muted-foreground',
        outline:
          'border border-input bg-surface enabled:hover:-translate-y-px enabled:hover:bg-muted enabled:hover:shadow-sm disabled:border-dashed disabled:text-muted-foreground',
        ghost: 'enabled:hover:bg-muted disabled:text-muted-foreground/70',
        link: 'px-0 text-foreground underline-offset-4 enabled:hover:underline disabled:text-muted-foreground',
      },
      size: {
        default: 'h-9 px-4',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-6 text-base',
        icon: 'h-9 w-9 coarse:min-w-11',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  /** Shown as a tooltip while the button is disabled, so people know what to do next. */
  disabledReason?: string | null;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild, loading, children, disabled, disabledReason, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';
    const isDisabled = disabled || loading;
    const button = (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={isDisabled}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="animate-spin" aria-hidden />}
            {children}
          </>
        )}
      </Comp>
    );
    if (!disabled || loading || !disabledReason) return button;
    // Disabled buttons swallow pointer events, so the tooltip hangs off a focusable wrapper.
    return (
      <Tooltip content={disabledReason}>
        <span
          tabIndex={0}
          className={cn(
            'inline-flex rounded-md',
            className?.includes('w-full') && 'w-full',
            className?.includes('flex-1') && 'flex-1',
          )}
          aria-label={disabledReason}
        >
          {button}
        </span>
      </Tooltip>
    );
  },
);
Button.displayName = 'Button';
export { buttonVariants };
