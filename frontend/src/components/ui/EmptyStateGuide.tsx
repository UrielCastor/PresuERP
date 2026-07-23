import React from 'react';
import { HelpCircle } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateGuideProps {
  title: string;
  description: string;
  onAction?: () => void;
  actionText?: string;
}

export const EmptyStateGuide: React.FC<EmptyStateGuideProps> = ({
  title,
  description,
  onAction,
  actionText,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-205 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/10 text-center max-w-lg mx-auto my-6 transition-all duration-200">
      <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400 dark:text-slate-550 mb-3 ring-4 ring-slate-50 dark:ring-slate-950">
        <HelpCircle className="h-5.5 w-5.5" />
      </div>
      <h3 className="text-sm font-bold text-slate-905 dark:text-white mb-1.5">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-5 max-w-xs font-medium">
        {description}
      </p>
      {onAction && actionText && (
        <Button onClick={onAction} variant="outline" size="sm" className="font-semibold text-xs shadow-sm bg-white dark:bg-slate-900">
          {actionText}
        </Button>
      )}
    </div>
  );
};
