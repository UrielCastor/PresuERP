import React from 'react';
import { cn } from '../../utils/cn';
import { Search } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: React.ElementType;
  actionLabel?: string;
  onAction?: () => void;
  illustration?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  className,
  title,
  description,
  icon: Icon = Search,
  actionLabel,
  onAction,
  illustration,
  ...props 
}) => {
  return (
    <div 
      className={cn(
        'flex flex-col items-center justify-center p-8 md:p-12 text-center rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 max-w-2xl mx-auto w-full',
        className
      )}
      {...props}
    >
      {illustration ? (
        <div className="mb-6 pointer-events-none select-none opacity-80">{illustration}</div>
      ) : (
        <div className="w-16 h-16 mb-5 rounded-full bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 shadow-sm">
          <Icon className="w-8 h-8" />
        </div>
      )}
      
      <h3 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
        {title}
      </h3>
      
      {description && (
        <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
          {description}
        </p>
      )}
      
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
