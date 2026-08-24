/** Use pill tabs for compact peer views and underline tabs for section-level navigation. */
import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type Orientation = 'horizontal' | 'vertical';
type Variant = 'pill' | 'underline';
type Context = { value: string; setValue: (value: string) => void; orientation: Orientation; variant: Variant; id: string; values: string[]; register: (value: string, element: HTMLButtonElement | null) => void; unregister: (value: string) => void; move: (value: string, direction: number) => void; boundary: (last: boolean) => void; };
const TabsContext = React.createContext<Context | null>(null);
const useTabs = () => { const context = React.useContext(TabsContext); if (!context) throw new Error('Tabs components must be used within Tabs.'); return context; };

export interface TabsProps { children: React.ReactNode; value?: string; defaultValue?: string; onValueChange?: (value: string) => void; orientation?: Orientation; variant?: Variant; className?: string; }
export function Tabs({ children, value: controlled, defaultValue = '', onValueChange, orientation = 'horizontal', variant = 'pill', className }: TabsProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
  const [values, setValues] = React.useState<string[]>([]);
  const refs = React.useRef(new Map<string, HTMLButtonElement>());
  const id = React.useId().replace(/:/g, '');
  const value = controlled ?? uncontrolled;
  const setValue = React.useCallback((next: string) => { if (controlled === undefined) setUncontrolled(next); onValueChange?.(next); }, [controlled, onValueChange]);
  const register = React.useCallback((next: string, element: HTMLButtonElement | null) => { if (element) refs.current.set(next, element); setValues((current) => current.includes(next) ? current : [...current, next]); }, []);
  const unregister = React.useCallback((next: string) => { refs.current.delete(next); setValues((current) => current.filter((item) => item !== next)); }, []);
  const enabled = React.useCallback(() => values.filter((item) => !refs.current.get(item)?.disabled), [values]);
  const move = React.useCallback((current: string, direction: number) => { const items = enabled(); const index = items.indexOf(current); if (index >= 0 && items.length) refs.current.get(items[(index + direction + items.length) % items.length])?.focus(); }, [enabled]);
  const boundary = React.useCallback((last: boolean) => { const items = enabled(); if (items.length) refs.current.get(last ? items[items.length - 1] : items[0])?.focus(); }, [enabled]);
  return <TabsContext.Provider value={{ value, setValue, orientation, variant, id, values, register, unregister, move, boundary }}><div className={className}>{children}</div></TabsContext.Provider>;
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { orientation, variant } = useTabs();
  return <div role="tablist" aria-orientation={orientation} className={cn('relative', orientation === 'horizontal' ? 'inline-flex items-center' : 'inline-flex flex-col items-stretch', variant === 'pill' ? 'gap-1 rounded-xl bg-surface p-1' : orientation === 'horizontal' ? 'gap-1 border-b border-subtle' : 'gap-1 border-l border-subtle', className)} {...props} />;
}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { value: string; }
export function TabsTrigger({ value, children, className, onKeyDown, ...props }: TabsTriggerProps) {
  const { value: active, setValue, orientation, variant, id, register, unregister, move, boundary } = useTabs();
  const ref = React.useRef<HTMLButtonElement | null>(null);
  const selected = active === value;
  React.useEffect(() => { register(value, ref.current); return () => unregister(value); }, [register, unregister, value]);
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => { onKeyDown?.(event); if (event.defaultPrevented) return; const previous = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp'; const next = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown'; if (event.key === previous) { event.preventDefault(); move(value, -1); } else if (event.key === next) { event.preventDefault(); move(value, 1); } else if (event.key === 'Home') { event.preventDefault(); boundary(false); } else if (event.key === 'End') { event.preventDefault(); boundary(true); } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setValue(value); } };
  return <button ref={ref} type="button" role="tab" id={`${id}-tab-${value}`} aria-controls={`${id}-panel-${value}`} aria-selected={selected} tabIndex={selected ? 0 : -1} onClick={() => setValue(value)} onKeyDown={handleKeyDown} className={cn('relative z-0 inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-body-sm font-semibold transition-colors duration-150 ease-swift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-app disabled:pointer-events-none disabled:opacity-50', selected ? 'text-primary' : 'text-secondary hover:text-primary', variant === 'underline' && (orientation === 'horizontal' ? '-mb-px rounded-b-none' : '-ml-px rounded-l-none'), className)} {...props}>
    {selected && <motion.span layoutId={`${id}-${variant}`} className={cn('absolute -z-10', variant === 'pill' ? 'inset-0 rounded-lg bg-app' : orientation === 'horizontal' ? 'bottom-0 left-2 right-2 h-0.5 bg-accent' : 'bottom-2 left-0 top-2 w-0.5 bg-accent')} transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }} />}
    <span className="relative">{children}</span>
  </button>;
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> { value: string; }
export function TabsContent({ value, children, className, ...props }: TabsContentProps) {
  const { value: active, id } = useTabs();
  return <div role="tabpanel" id={`${id}-panel-${value}`} aria-labelledby={`${id}-tab-${value}`} hidden={active !== value} tabIndex={0} className={cn('mt-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-app', className)} {...props}>{children}</div>;
}
