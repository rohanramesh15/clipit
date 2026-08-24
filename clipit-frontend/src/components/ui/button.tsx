/** Use primary for one clear action, secondary for a contained alternative, ghost for quiet actions, and destructive only for irreversible actions. */
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-body-sm font-semibold transition-colors duration-150 ease-swift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-app disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-on-accent hover:bg-accent-hover',
        secondary: 'border border-subtle bg-surface text-primary hover:bg-surface-hover',
        ghost: 'bg-transparent text-secondary hover:bg-surface-hover hover:text-primary',
        destructive: 'bg-error text-white hover:bg-error/90',
      },
      size: {
        sm: 'h-8 px-3 text-meta',
        default: 'h-10 px-4',
        lg: 'h-11 px-5 text-body',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
)

type ButtonBaseProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean };
type IconButtonProps = ButtonBaseProps & { size: 'icon'; 'aria-label': string };
type StandardButtonProps = ButtonBaseProps & { size?: Exclude<VariantProps<typeof buttonVariants>['size'], 'icon'> };
export type ButtonProps = IconButtonProps | StandardButtonProps;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        type={asChild ? undefined : type ?? 'button'}
        {...props}
      />
    )
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
