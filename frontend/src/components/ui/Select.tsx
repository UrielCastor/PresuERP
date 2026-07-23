import React, { forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { ChevronDown, LucideIcon } from 'lucide-react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  leftIcon?: LucideIcon;
  error?: string;
  helperText?: string;
  options?: { value: string | number; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, leftIcon: LeftIcon, error, helperText, id, children, options, ...props }, ref) => {
    const generatedId = React.useId();
    const selectId = id || generatedId;

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {label} {props.required && <span className="text-red-500">*</span>}
          </label>
        )}
        <div className="relative">
          {LeftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
              <LeftIcon className="h-4.5 w-4.5 text-slate-400" />
            </div>
          )}
          <select
            id={selectId}
            ref={ref}
            className={cn(
              "flex w-full appearance-none rounded-lg border bg-white dark:bg-slate-900 px-3 py-2 pr-10 text-sm text-slate-900 dark:text-white transition-all focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
              error 
                ? "border-red-500 focus:ring-red-500" 
                : "border-slate-300 dark:border-slate-700 focus:ring-primary-500",
              LeftIcon && "pl-10",
              className
            )}
            {...props}
          >
            {options && options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
            {children}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </div>
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
Select.displayName = "Select";
