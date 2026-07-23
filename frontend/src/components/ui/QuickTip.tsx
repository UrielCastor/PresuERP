import React from 'react';
import { Lightbulb } from 'lucide-react';

interface QuickTipProps {
  content: string;
  className?: string;
}

export const QuickTip: React.FC<QuickTipProps> = ({ content, className = '' }) => {
  return (
    <div className={`flex items-start gap-2.5 p-3.5 rounded-xl border border-primary-100 dark:border-primary-950/40 bg-primary-50/30 dark:bg-primary-950/10 text-primary-800 dark:text-primary-300 text-xs leading-relaxed max-w-xl transition-all duration-200 ${className}`}>
      <Lightbulb className="h-4.5 w-4.5 text-primary-500 shrink-0 mt-0.5" />
      <div>
        <span className="font-bold block mb-0.5 text-primary-750 dark:text-primary-200">💡 Consejo Contextual</span>
        <span className="font-medium text-slate-600 dark:text-slate-350">{content}</span>
      </div>
    </div>
  );
};
