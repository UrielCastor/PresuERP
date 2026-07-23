import React, { useState } from 'react';
import { cn } from '../../utils/cn';

export interface Tab {
  id: string;
  label: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  tabs: Tab[];
  defaultTabId?: string;
  activeTab?: string;
  onTabChange?: (id: string) => void;
  variant?: 'underline' | 'pill' | 'enclosed';
}

export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, tabs, defaultTabId, activeTab, onTabChange, variant = 'underline', ...props }, ref) => {
    const [internalTabId, setInternalTabId] = useState(defaultTabId || (tabs.length > 0 ? tabs[0].id : ''));
    const activeTabId = activeTab !== undefined ? activeTab : internalTabId;

    const handleTabClick = (id: string) => {
       if (activeTab === undefined) setInternalTabId(id);
       if (onTabChange) onTabChange(id);
    };

    const activeTabObj = tabs.find(t => t.id === activeTabId);

    return (
      <div ref={ref} className={cn('w-full flex flex-col', className)} {...props}>
        {/* Tab Header */}
        <div className={cn(
          'flex overflow-x-auto hide-scrollbar',
          variant === 'underline' && 'border-b border-slate-200 dark:border-slate-800 gap-6',
          variant === 'pill' && 'gap-2',
          variant === 'enclosed' && 'bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg gap-1 border border-slate-200 dark:border-slate-700'
        )}>
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            
            return (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && handleTabClick(tab.id)}
                disabled={tab.disabled}
                className={cn(
                  'whitespace-nowrap font-medium text-sm transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center',
                  
                  // Underline Variant
                  variant === 'underline' && 'py-3 border-b-2 px-1',
                  variant === 'underline' && isActive ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-500' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200',
                  
                  // Pill Variant
                  variant === 'pill' && 'px-4 py-2 rounded-full',
                  variant === 'pill' && isActive ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
                  
                  // Enclosed Variant
                  variant === 'enclosed' && 'px-3 py-1.5 rounded-md flex-1',
                  variant === 'enclosed' && isActive ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white border border-slate-200 dark:border-slate-700' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div className="mt-4 focus:outline-none" tabIndex={0}>
          {activeTabObj?.content}
        </div>
      </div>
    );
  }
);

Tabs.displayName = 'Tabs';
