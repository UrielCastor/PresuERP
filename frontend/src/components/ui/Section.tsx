import React from 'react';
import { cn } from '../../utils/cn';

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export const Section = React.forwardRef<HTMLElement, SectionProps>(
  ({ className, title, description, action, children, ...props }, ref) => {
    return (
      <section 
        ref={ref} 
        className={cn('flex flex-col gap-4 w-full mb-8 last:mb-0', className)} 
        {...props}
      >
        {(title || description || action) && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex flex-col gap-1">
              {title && (
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {description}
                </p>
              )}
            </div>
            {action && (
              <div className="shrink-0 flex items-center">
                {action}
              </div>
            )}
          </div>
        )}
        <div className="w-full">
          {children}
        </div>
      </section>
    );
  }
);

Section.displayName = 'Section';
