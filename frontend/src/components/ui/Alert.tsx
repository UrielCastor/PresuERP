import React from 'react';
import { cn } from '../../utils/cn';
import { AlertCircle, CheckCircle2, Info, XCircle, X } from 'lucide-react';

type AlertVariant = 'default' | 'info' | 'success' | 'warning' | 'error';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  onClose?: () => void;
  icon?: React.ReactNode;
}

const variantConfig: Record<AlertVariant, { icon: any, classes: string }> = {
  default: {
    icon: null,
    classes: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800/80 dark:text-slate-200 dark:border-slate-700'
  },
  info: {
    icon: Info,
    classes: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800'
  },
  success: {
    icon: CheckCircle2,
    classes: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800'
  },
  warning: {
    icon: AlertCircle,
    classes: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800'
  },
  error: {
    icon: XCircle,
    classes: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800'
  }
};

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', title, children, onClose, icon, ...props }, ref) => {
    const config = variantConfig[variant];
    const Icon = icon || config.icon;

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          'relative w-full rounded-lg border p-4 shadow-sm transition-all',
          config.classes,
          className
        )}
        {...props}
      >
        <div className="flex gap-3">
          {Icon && (
            <div className="shrink-0 mt-0.5">
              <Icon className="h-5 w-5 opacity-80" />
            </div>
          )}
          <div className="flex flex-col flex-1 gap-1">
            {title && <h5 className="font-semibold leading-none tracking-tight mb-1">{title}</h5>}
            <div className="text-sm opacity-90 leading-relaxed">
              {children}
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Cerrar</span>
            </button>
          )}
        </div>
      </div>
    );
  }
);

Alert.displayName = 'Alert';
