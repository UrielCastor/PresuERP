import React from 'react';
import { cn } from '../../utils/cn';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  initials?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'away' | 'busy';
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, initials, size = 'md', status, ...props }, ref) => {
    const sizeClasses = {
      sm: 'w-8 h-8 text-xs',
      md: 'w-10 h-10 text-sm',
      lg: 'w-14 h-14 text-base',
      xl: 'w-20 h-20 text-xl',
    };

    const statusColors = {
      online: 'bg-emerald-500',
      offline: 'bg-slate-400',
      away: 'bg-amber-500',
      busy: 'bg-red-500',
    };

    const statusSizes = {
      sm: 'w-2 h-2',
      md: 'w-2.5 h-2.5',
      lg: 'w-3.5 h-3.5',
      xl: 'w-5 h-5',
    };

    return (
      <div className="relative inline-block" ref={ref} {...props}>
        <div 
          className={cn(
            'flex items-center justify-center rounded-full overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-primary-700 dark:text-primary-400 font-bold uppercase ring-2 ring-white dark:ring-slate-900',
            sizeClasses[size],
            className
          )}
        >
          {src ? (
            <img 
              src={src} 
              alt={alt || "Avatar"} 
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to initials if image fails
                e.currentTarget.style.display = 'none';
                if (e.currentTarget.nextElementSibling) {
                  (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                }
              }}
            />
          ) : null}
          <span className={cn('w-full h-full flex items-center justify-center', { 'hidden': src })}>
            {initials || (alt ? alt.substring(0, 2) : 'U')}
          </span>
        </div>
        
        {status && (
          <span 
            className={cn(
              'absolute bottom-0 right-0 block rounded-full ring-2 ring-white dark:ring-slate-900',
              statusColors[status],
              statusSizes[size]
            )} 
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';
