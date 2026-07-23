import React from 'react';
import { cn } from '../../utils/cn';

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
  error?: string;
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className, label, description, error, id, ...props }, ref) => {
    return (
      <div className="flex items-start gap-3">
        <div className="relative flex items-center justify-center mt-0.5">
          <input
            type="radio"
            id={id}
            ref={ref}
            className={cn(
              'peer h-4 w-4 shrink-0 rounded-full border border-slate-300 bg-white text-primary-600 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 appearance-none transition-all duration-200 checked:border-[5px] checked:border-primary-600',
              {
                'border-red-500 text-red-600 focus:ring-red-500': error,
              },
              className
            )}
            {...props}
          />
        </div>
        {(label || description) && (
          <div className="flex flex-col gap-1">
            {label && (
              <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                {label}
              </label>
            )}
            {description && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
            )}
            {error && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1">{error}</p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Radio.displayName = 'Radio';
