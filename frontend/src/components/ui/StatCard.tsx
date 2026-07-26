import React from 'react';
import { cn } from '../../utils/cn';

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ElementType;
  trend?: {
    value: number | string;
    isPositive?: boolean;
    label?: string;
  };
  colorVariant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default';
}

const colorVariants = {
  primary: 'text-primary-600 bg-primary-50 dark:bg-primary-900/20 dark:text-primary-400',
  success: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400',
  warning: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400',
  danger: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
  info: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400',
  default: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400',
};

const shadowGlowVariants = {
  primary: 'shadow-[inset_0_4px_0_var(--color-primary-500)]',
  success: 'shadow-[inset_0_4px_0_theme(colors.emerald.500)]',
  warning: 'shadow-[inset_0_4px_0_theme(colors.amber.500)]',
  danger: 'shadow-[inset_0_4px_0_theme(colors.red.500)]',
  info: 'shadow-[inset_0_4px_0_theme(colors.blue.500)]',
  default: 'shadow-none',
};

export const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, title, value, description, icon: Icon, trend, colorVariant = 'default', ...props }, ref) => {
    return (
      <div 
        ref={ref}
        className={cn(
          'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 min-w-[140px]',
          colorVariant !== 'default' && shadowGlowVariants[colorVariant],
          className
        )}
        {...props}
      >
        <div className="flex justify-between items-start mb-2">
          {Icon && (
            <div className={cn('p-1.5 rounded-lg', colorVariants[colorVariant])}>
              <Icon className="w-4 h-4" />
            </div>
          )}
          {trend && (
            <div className={cn(
              "flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full",
              trend.isPositive ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            )}>
              <span>{trend.isPositive ? '↑' : '↓'}</span>
              <span>{trend.value}</span>
            </div>
          )}
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-0.5 truncate">{title}</p>
          <p className={cn(
            "text-lg lg:text-xl font-bold font-mono truncate leading-tight dark:text-white",
            colorVariant !== 'default' ? colorVariants[colorVariant].split(' ')[0] : 'text-slate-800'
          )}>
            {value}
          </p>
        </div>
        {trend?.label && (
          <p className="text-[10px] text-slate-400 mt-1 truncate">{trend.label}</p>
        )}
        {description && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium leading-normal border-t border-slate-100 dark:border-slate-800 pt-1.5">
             {description}
          </p>
        )}
      </div>
    );
  }
);

StatCard.displayName = 'StatCard';
