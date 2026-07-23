import React from 'react';
import { cn } from '../../utils/cn';
import { HelpButton } from './HelpButton';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, action, className }) => {
  return (
    <div className={cn('flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8', className)}>
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h1>
          <HelpButton showText={false} className="p-1 px-1 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 border-0 shadow-none text-slate-400 dark:text-slate-500" />
        </div>
        {subtitle && (
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex items-center gap-3">{action}</div>}
    </div>
  );
};
