import React from 'react';
import { cn } from '../../utils/cn';

export interface FormFieldProps {
  label?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  required,
  error,
  helperText,
  htmlFor,
  className,
  children,
}) => {
  return (
    <div className={cn('w-full flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      {children}
      {(error || helperText) && (
        <p className={cn('text-xs font-medium', error ? 'text-red-500' : 'text-slate-500 dark:text-slate-400')}>
          {error || helperText}
        </p>
      )}
    </div>
  );
};
