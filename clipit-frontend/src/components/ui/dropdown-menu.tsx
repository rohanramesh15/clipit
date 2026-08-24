/** Use for a compact menu of related actions; use filters for selecting data. */
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

import { cn } from '@/lib/utils';
import { Button } from './button';

type FocusTarget = 'first' | 'last';

interface DropdownMenuContextValue {
  contentId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  contentRef: React.MutableRefObject<HTMLDivElement | null>;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
  focusItem: (target: FocusTarget) => void;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenu() {
  const context = React.useContext(DropdownMenuContext);
  if (!context) throw new Error('Dropdown menu parts must be used inside DropdownMenu.');
  return context;
}

function menuItems(container: HTMLElement | null) {
  if (!container) return [];
  return [...container.querySelectorAll<HTMLElement>('[role="menuitem"]')].filter((item) => !item.hasAttribute('disabled') && item.getAttribute('aria-disabled') !== 'true');
}

export interface DropdownMenuProps {
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}

export function DropdownMenu({ children, className, defaultOpen = false, onOpenChange, open: controlledOpen }: DropdownMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const rootRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLElement>(null);
  const contentId = React.useId();
  const setOpen = React.useCallback((nextOpen: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }, [controlledOpen, onOpenChange]);
  const focusItem = React.useCallback((target: FocusTarget) => {
    window.requestAnimationFrame(() => {
      const items = menuItems(contentRef.current);
      const item = target === 'first' ? items[0] : items[items.length - 1];
      item?.focus();
    });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, setOpen]);

  return <DropdownMenuContext.Provider value={{ contentId, open, setOpen, contentRef, triggerRef, focusItem }}><div ref={rootRef} className={cn('relative inline-block', className)}>{children}</div></DropdownMenuContext.Provider>;
}

export interface DropdownMenuTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export const DropdownMenuTrigger = React.forwardRef<HTMLElement, DropdownMenuTriggerProps>(({ asChild = false, children, onClick, onKeyDown, ...props }, forwardedRef) => {
  const { contentId, focusItem, open, setOpen, triggerRef } = useDropdownMenu();
  const setRefs = (node: HTMLElement | null) => {
    triggerRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLElement | null>).current = node;
  };
  const triggerProps = {
    ...props,
    ref: setRefs,
    'aria-controls': contentId,
    'aria-expanded': open,
    'aria-haspopup': 'menu' as const,
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (!event.defaultPrevented) setOpen(!open);
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setOpen(true);
        focusItem(event.key === 'ArrowDown' ? 'first' : 'last');
      } else if (event.key === 'Escape' && open) {
        event.preventDefault();
        setOpen(false);
      }
    },
  };
  if (asChild) return <Slot {...triggerProps}>{children}</Slot>;
  return <Button {...triggerProps}>{children}</Button>;
});
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

export interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: 'start' | 'end';
}

export const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(({ align = 'end', children, className, onKeyDown, ...props }, forwardedRef) => {
  const { contentId, contentRef, focusItem, open, setOpen, triggerRef } = useDropdownMenu();
  const setRefs = (node: HTMLDivElement | null) => {
    contentRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  };
  if (!open) return null;
  return <div {...props} ref={setRefs} id={contentId} role="menu" onKeyDown={(event) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    const items = menuItems(contentRef.current);
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      items[(currentIndex + direction + items.length) % items.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      focusItem(event.key === 'Home' ? 'first' : 'last');
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  }} className={cn('absolute top-full z-50 mt-2 min-w-48 origin-top-right rounded-xl border border-subtle bg-app p-2 shadow-pop', align === 'start' ? 'left-0' : 'right-0', className)}>{children}</div>;
});
DropdownMenuContent.displayName = 'DropdownMenuContent';

export interface DropdownMenuItemProps extends React.HTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}

export const DropdownMenuItem = React.forwardRef<HTMLElement, DropdownMenuItemProps>(({ asChild = false, children, className, disabled, onClick, onSelect, ...props }, forwardedRef) => {
  const { setOpen, triggerRef } = useDropdownMenu();
  const itemProps = {
    ...props,
    ref: forwardedRef,
    role: 'menuitem',
    disabled,
    'aria-disabled': disabled || undefined,
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (event.defaultPrevented || disabled) return;
      onSelect?.();
      setOpen(false);
      triggerRef.current?.focus();
    },
    className: cn('w-full justify-start gap-3', className),
  };
  if (asChild) return <Slot {...itemProps}>{children}</Slot>;
  return <Button variant="ghost" size="sm" {...itemProps}>{children}</Button>;
});
DropdownMenuItem.displayName = 'DropdownMenuItem';

export function DropdownMenuLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-3 pb-3 pt-2', className)}>{children}</div>;
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div role="separator" className={cn('my-2 h-px bg-border-subtle', className)} />;
}
