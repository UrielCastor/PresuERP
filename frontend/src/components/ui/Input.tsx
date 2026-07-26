import React, { forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { LucideIcon } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  leftIcon?: React.ReactNode | LucideIcon;
  rightIcon?: React.ReactNode | LucideIcon;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, leftIcon, rightIcon, error, helperText, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

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
          <label htmlFor={inputId} className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {label} {props.required && <span className="text-red-500">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none z-10">
              {renderIcon(leftIcon)}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              "flex w-full rounded-lg border bg-white dark:bg-slate-900 px-3 py-2 text-xs md:text-sm text-slate-900 dark:text-white transition-all shadow-2xs file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-75 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:border-slate-200 dark:disabled:border-slate-800 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 dark:[&::-webkit-calendar-picker-indicator]:invert",
              error 
                ? "border-red-500 focus:ring-red-500/20 focus:border-red-500" 
                : "border-slate-300 dark:border-slate-700 focus:ring-primary-500/20 focus:border-primary-500",
              leftIcon && "pl-8.5",
              rightIcon && "pr-8.5",
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none z-10">
              {renderIcon(rightIcon)}
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
