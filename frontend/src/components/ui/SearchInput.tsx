import React from 'react';
import { cn } from '../../utils/cn';
import { Search, X } from 'lucide-react';

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (val: string) => void;
  onClear?: () => void;
  isLoading?: boolean;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, value, onChange, onClear, isLoading, placeholder = "Buscar...", ...props }, ref) => {
    return (
      <div className={cn("relative flex items-center w-full", className)}>
        <Search className="absolute left-3 text-slate-400 h-4 w-4 pointer-events-none" />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full flex h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-10 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-slate-900 dark:text-slate-100 transition-all shadow-sm"
          {...props}
        />
        {value && !isLoading && (
          <button
            type="button"
            className="absolute right-2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-md focus:outline-none"
            onClick={() => {
              onChange('');
              if (onClear) onClear();
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-500 border-t-transparent flex items-center justify-center"></div>
          </div>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
