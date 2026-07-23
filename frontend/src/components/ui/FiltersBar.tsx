import React from 'react';
import { cn } from '../../utils/cn';
import { Filter, SlidersHorizontal } from 'lucide-react';
import { Button } from './Button';

export interface FiltersBarProps extends React.HTMLAttributes<HTMLDivElement> {
  searchComponent?: React.ReactNode;
  filtersComponent?: React.ReactNode;
  actionsComponent?: React.ReactNode;
  onToggleAdvanced?: () => void;
  showAdvanced?: boolean;
}

export const FiltersBar = React.forwardRef<HTMLDivElement, FiltersBarProps>(
  ({ className, searchComponent, filtersComponent, actionsComponent, onToggleAdvanced, showAdvanced, ...props }, ref) => {
    return (
      <div 
        ref={ref}
        className={cn('flex flex-col gap-4 w-full bg-slate-50 dark:bg-slate-900/50 p-4 border border-slate-200 dark:border-slate-800 rounded-xl', className)}
        {...props}
      >
        <div className="flex flex-col sm:flex-row gap-3 w-full items-start sm:items-center justify-between">
          <div className="flex flex-1 flex-col sm:flex-row gap-3 w-full items-start sm:items-center">
            {searchComponent && (
              <div className="w-full sm:max-w-xs md:max-w-md">
                {searchComponent}
              </div>
            )}
            
            {(filtersComponent || onToggleAdvanced) && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {filtersComponent && (
                  <div className="hidden md:flex items-center gap-2">
                    {filtersComponent}
                  </div>
                )}
                {onToggleAdvanced && (
                  <Button 
                    variant="ghost" 
                    onClick={onToggleAdvanced}
                    leftIcon={<SlidersHorizontal className="w-4 h-4" />}
                    className={cn(showAdvanced ? 'bg-slate-200 dark:bg-slate-800' : '')}
                  >
                    Filtros
                  </Button>
                )}
              </div>
            )}
          </div>
          
          {actionsComponent && (
            <div className="flex shrink-0 w-full sm:w-auto mt-2 sm:mt-0 items-center justify-end border-t border-slate-200 dark:border-slate-800 sm:border-t-0 pt-3 sm:pt-0">
              {actionsComponent}
            </div>
          )}
        </div>
        
        {/* Advanced Filters Expandable Area */}
        {showAdvanced && filtersComponent && (
          <div className="mt-2 pt-4 border-t border-slate-200 dark:border-slate-800 animate-in slide-in-from-top-2 fade-in md:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
             {filtersComponent}
          </div>
        )}
      </div>
    );
  }
);

FiltersBar.displayName = 'FiltersBar';
