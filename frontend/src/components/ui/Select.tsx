import React, { forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { ChevronDown, LucideIcon } from 'lucide-react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  leftIcon?: React.ReactNode | LucideIcon;
  error?: string;
  helperText?: string;
  options?: { value: string | number; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, leftIcon, error, helperText, id, children, options, ...props }, ref) => {
    const generatedId = React.useId();
    const selectId = id || generatedId;

    const renderIcon = (icon: React.ReactNode | LucideIcon) => {
      if (!icon) return null;
      if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null && 'render' in icon)) {
        const IconComp = icon as LucideIcon;
        return <IconComp className="h-4.5 w-4.5 text-slate-400" />;
      }
      return <span className="text-slate-400">{icon}</span>;
    };

    return (
      <div className="w-full flex flex-col gap-1">
        {label && (
          <label htmlFor={selectId} className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {label} {props.required && <span className="text-red-500">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none z-10">
              {renderIcon(leftIcon)}
            </div>
          )}
          <select
            id={selectId}
            ref={ref}
            className={cn(
              "flex w-full appearance-none rounded-lg border bg-white dark:bg-slate-900 px-3 py-2 pr-9 text-xs md:text-sm text-slate-900 dark:text-white transition-all shadow-2xs focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-75 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:border-slate-200 dark:disabled:border-slate-800",
              error 
                ? "border-red-500 focus:ring-red-500/20 focus:border-red-500" 
                : "border-slate-300 dark:border-slate-700 focus:ring-primary-500/20 focus:border-primary-500",
              leftIcon && "pl-8.5",
              className
            )}
            {...props}
          >
            {options && options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-1">
                {opt.label}
              </option>
            ))}
            {children}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-slate-400 dark:text-slate-500">
            <ChevronDown className="h-4 w-4" />
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
