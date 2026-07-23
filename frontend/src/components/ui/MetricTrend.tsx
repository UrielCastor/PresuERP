import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface MetricTrendProps {
  value: number; // percentage
  label?: string;
  className?: string;
}

export const MetricTrend: React.FC<MetricTrendProps> = ({ value, label = 'vs período anterior', className }) => {
  const isPositive = value > 0;
  const isNeutral = value === 0;
  
  return (
    <div className={twMerge(
      "flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full w-max",
      isPositive ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : 
      isNeutral ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" :
      "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
      className
    )}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : isNeutral ? <Minus className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      <span>{isPositive ? '+' : ''}{value}%</span>
      {label && <span className="font-normal opacity-80">{label}</span>}
    </div>
  );
};
