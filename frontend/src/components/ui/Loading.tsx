import React from 'react';
import { cn } from '../../utils/cn';

export interface LoadingProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'primary' | 'white' | 'slate';
  text?: string;
  fullScreen?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({ 
  className, 
  size = 'md', 
  variant = 'primary', 
  text,
  fullScreen = false,
  ...props 
}) => {
  const spinnerClass = cn(
    'animate-spin rounded-full border-t-transparent border-solid',
    {
      'h-4 w-4 border-2': size === 'sm',
      'h-8 w-8 border-[3px]': size === 'md',
      'h-12 w-12 border-4': size === 'lg',
      'h-16 w-16 border-4': size === 'xl',

      'border-primary-600 dark:border-primary-500': variant === 'primary',
      'border-white': variant === 'white',
      'border-slate-400 dark:border-slate-500': variant === 'slate',
    }
  );

  const containerClass = fullScreen 
    ? 'fixed inset-0 z-[9999] bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center'
    : 'flex flex-col items-center justify-center p-4';

  return (
    <div className={cn(containerClass, className)} {...props}>
      <div className={spinnerClass} role="status" aria-label="Cargando">
        <span className="sr-only">Cargando...</span>
      </div>
      {text && (
        <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
};
