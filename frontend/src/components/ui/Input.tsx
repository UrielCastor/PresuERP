import React, { forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { LucideIcon } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, leftIcon: LeftIcon, rightIcon: RightIcon, error, helperText, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {label} {props.required && <span className="text-red-500">*</span>}
          </label>
        )}
        <div className="relative">
          {LeftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <LeftIcon className="h-4.5 w-4.5 text-slate-400" />
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              "flex w-full rounded-lg border bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
              error 
                ? "border-red-500 focus-visible:ring-red-500" 
                : "border-slate-300 dark:border-slate-700 focus-visible:ring-primary-500",
              LeftIcon && "pl-10",
              RightIcon && "pr-10",
              className
            )}
            {...props}
          />
          {RightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <RightIcon className="h-4.5 w-4.5 text-slate-400" />
            </div>
          )}
        </div>
        {(error || helperText) && (
          <p className={cn("text-xs font-medium", error ? "text-red-500" : "text-slate-500")}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
