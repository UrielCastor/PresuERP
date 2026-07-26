import React from 'react';
import { cn } from '../../utils/cn';
import { Card, CardHeader, CardTitle, CardContent } from './Card';

export interface SectionCardProps {
  title: React.ReactNode;
  subtitle?: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  className,
  contentClassName,
}) => {
  return (
    <Card className={cn('bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800/80 px-6 py-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="h-9 w-9 rounded-xl bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div>
            <CardTitle className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100">
              {title}
            </CardTitle>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-normal">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </CardHeader>
      <CardContent className={cn('p-6', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
};
