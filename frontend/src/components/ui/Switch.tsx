import React from 'react';
import { cn } from '../../utils/cn';

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, description, id, checked, onChange, ...props }, ref) => {
    return (
      <div className="flex items-center justify-between gap-4 w-full">
        {(label || description) && (
          <div className="flex flex-col flex-1">
            {label && (
              <label htmlFor={id} className="text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                {label}
              </label>
            )}
            {description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug mt-0.5">{description}</p>
            )}
          </div>
        )}
        <div className="relative inline-flex items-center cursor-pointer shrink-0">
          <input 
            type="checkbox" 
            id={id} 
            ref={ref}
            checked={checked}
            onChange={onChange}
            className="sr-only peer" 
            {...props} 
          />
          <div className={cn(
            "w-11 h-6 bg-slate-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-primary-500/20 dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary-600 dark:peer-checked:bg-primary-500",
            className
          )}></div>
        </div>
      </div>
    );
  }
);

Switch.displayName = 'Switch';
