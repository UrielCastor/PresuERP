import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './Card';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export const ChartCard: React.FC<ChartCardProps> = ({ title, subtitle, children, action }) => {
  return (
    <Card className="h-full bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-bold text-slate-800 dark:text-white">{title}</CardTitle>
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </CardHeader>
      <CardContent className="pt-4 pb-6">{children}</CardContent>
    </Card>
  );
};
