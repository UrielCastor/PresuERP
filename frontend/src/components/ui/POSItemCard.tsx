import React from 'react';
import { cn } from '../../utils/cn';

export interface POSItemCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode;
  badge?: React.ReactNode;
  variant?: 'emerald' | 'amber' | 'indigo' | 'slate' | 'rose' | 'default';
  description?: React.ReactNode;
  code?: string;
  dotColor?: 'emerald' | 'amber' | 'indigo' | 'slate' | 'rose' | 'none';
  active?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

export const POSItemCard: React.FC<POSItemCardProps> = ({
  title,
  badge,
  variant = 'emerald',
  description,
  code,
  dotColor,
  active = true,
  selected = false,
  onClick,
  className,
  children,
  ...props
}) => {
  const actualDotColor = dotColor || (variant === 'amber' ? 'amber' : variant === 'indigo' ? 'indigo' : variant === 'slate' ? 'slate' : 'emerald');

  const dotClasses = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    indigo: 'bg-indigo-500',
    slate: 'bg-slate-400',
    rose: 'bg-rose-500',
    none: '',
  };

  const bgClasses = {
    emerald: 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/60',
    amber: 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-200/60 dark:border-amber-900/40',
    indigo: 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200/60 dark:border-indigo-900/40',
    slate: 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-700/40',
    rose: 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-200/60 dark:border-rose-900/40',
    default: 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/60',
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-2.5 rounded-xl border space-y-1 transition-all whitespace-normal break-words text-xs',
        bgClasses[variant] || bgClasses.default,
        {
          'cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-xs': !!onClick,
          'ring-2 ring-primary-500 border-primary-500 bg-primary-50/30 dark:bg-primary-950/30': selected,
        },
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between font-bold text-slate-900 dark:text-slate-100 gap-1.5">
        <span className="flex items-center gap-1.5 whitespace-normal break-words">
          {active && actualDotColor !== 'none' && (
            <span className={cn('h-2 w-2 rounded-full shrink-0', dotClasses[actualDotColor])} />
          )}
          {title}
        </span>
        {badge && <span className="shrink-0 text-[10px] font-extrabold">{badge}</span>}
      </div>

      {code && (
        <div className="text-[10px] text-slate-400 font-mono pl-3.5">
          Código: {code}
        </div>
      )}

      {description && (
        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium pl-3.5 whitespace-normal break-words leading-tight mt-0.5">
          {description}
        </div>
      )}

      {children}
    </div>
  );
};
