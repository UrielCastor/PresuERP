import React from 'react';
import { cn } from '../../utils/cn';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {label}
          </label>
        )}
        <textarea
          id={id}
          ref={ref}
          className={cn(
            'flex w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs md:text-sm text-slate-900 dark:text-white transition-all shadow-2xs placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-75 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:border-slate-200 dark:disabled:border-slate-800 min-h-[80px] resize-y',
            {
              'border-red-500 focus:ring-red-500/20 focus:border-red-500 dark:border-red-500': error,
            },
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-red-650 dark:text-red-400 font-medium">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
