import React from 'react';
import { cn } from '../../utils/cn';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  className,
  variant = 'text',
  width,
  height,
  ...props 
}) => {
  return (
    <div
      className={cn(
        'animate-pulse bg-slate-200 dark:bg-slate-800',
        {
          'rounded-md h-4 w-full': variant === 'text',
          'rounded-full': variant === 'circular',
          'rounded-lg': variant === 'rounded',
          'rounded-none': variant === 'rectangular',
        },
        className
      )}
      style={{
        width: width ?? undefined,
        height: height ?? undefined,
      }}
      {...props}
    />
  );
};
