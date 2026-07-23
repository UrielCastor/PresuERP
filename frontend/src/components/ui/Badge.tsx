import React from 'react';
import { cn } from '../../utils/cn';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'outline';
export type BadgeStatus = 'active' | 'inactive' | 'open' | 'closed' | 'pending' | 'canceled' | 'paid' | 'overdue' | 'draft';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  status?: BadgeStatus;
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
}

const statusVariantMap: Record<BadgeStatus, BadgeVariant> = {
  active: 'success',
  inactive: 'default',
  open: 'info',
  closed: 'default',
  pending: 'warning',
  canceled: 'default',
  paid: 'success',
  overdue: 'error',
  draft: 'outline',
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, status, size = 'md', dot = false, children, ...props }, ref) => {
    
    const finalVariant = status ? statusVariantMap[status] : (variant || 'default');

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-colors border',
          {
            // Variants
            'bg-slate-100 text-slate-800 border-transparent dark:bg-slate-800 dark:text-slate-300': finalVariant === 'default',
            'bg-emerald-100/80 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30': finalVariant === 'success',
            'bg-amber-100/80 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30': finalVariant === 'warning',
            'bg-red-100/80 text-red-800 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30': finalVariant === 'error',
            'bg-blue-100/80 text-blue-800 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30': finalVariant === 'info',
            'bg-transparent text-slate-700 border-slate-300 dark:text-slate-400 dark:border-slate-700': finalVariant === 'outline',

            // Sizes
            'px-2 py-0.5 text-xs rounded': size === 'sm',
            'px-2.5 py-1 text-xs rounded-md': size === 'md',
            'px-3 py-1.5 text-sm rounded-lg': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', {
              'bg-slate-500': finalVariant === 'default' || finalVariant === 'outline',
              'bg-emerald-500': finalVariant === 'success',
              'bg-amber-500': finalVariant === 'warning',
              'bg-red-500': finalVariant === 'error',
              'bg-blue-500': finalVariant === 'info',
            })}
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
