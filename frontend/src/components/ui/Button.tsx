import React from 'react';
import { cn } from '../../utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'warning' | 'success' | 'ghost' | 'link';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]',
          {
            // Variants
            'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 shadow-sm shadow-primary-500/10': variant === 'primary',
            'bg-slate-100 text-slate-900 hover:bg-slate-200 focus:ring-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700': variant === 'secondary',
            'border border-slate-300 bg-transparent text-slate-700 hover:bg-slate-50 focus:ring-slate-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800': variant === 'outline',
            'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-sm shadow-red-500/10': variant === 'danger',
            'bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-500 shadow-sm shadow-amber-500/10': variant === 'warning',
            'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500 shadow-sm shadow-emerald-500/10': variant === 'success',
            'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100': variant === 'ghost',
            'text-primary-600 underline-offset-4 hover:underline focus:ring-primary-500': variant === 'link',
            
            // Sizes
            'h-7.5 px-2.5 text-xs': size === 'sm',
            'h-9 px-3.5 text-xs font-semibold': size === 'md',
            'h-10 px-4 text-sm font-bold': size === 'lg',
            'h-9 w-9 p-0': size === 'icon',
          },
          className
        )}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {!isLoading && leftIcon && <span className="mr-2 inline-flex">{leftIcon}</span>}
        {children}
        {!isLoading && rightIcon && <span className="ml-2 inline-flex">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
