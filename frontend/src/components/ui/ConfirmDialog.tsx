import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  isLoading = false
}) => {
  const isDanger = variant === 'danger';
  
  const iconMap = {
    danger: <AlertTriangle className="w-6 h-6 text-red-600" />,
    warning: <AlertTriangle className="w-6 h-6 text-amber-600" />,
    info: <Info className="w-6 h-6 text-blue-600" />,
    success: <CheckCircle2 className="w-6 h-6 text-emerald-600" />
  };

  const bgMap = {
    danger: 'bg-red-100 dark:bg-red-900/30',
    warning: 'bg-amber-100 dark:bg-amber-900/30',
    info: 'bg-blue-100 dark:bg-blue-900/30',
    success: 'bg-emerald-100 dark:bg-emerald-900/30'
  };

  const buttonVariant = variant === 'danger' ? 'danger' : variant === 'warning' ? 'warning' : variant === 'success' ? 'success' : 'primary';

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" title={title}>
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
        <div className={`mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full sm:mx-0 sm:h-10 sm:w-10 ${bgMap[variant]}`}>
          {iconMap[variant]}
        </div>
        <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left flex-1">
          <h3 className="text-lg font-bold leading-6 text-slate-900 dark:text-slate-100" id="modal-title">
            {title}
          </h3>
          <div className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            {message}
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={isLoading}
          className="w-full sm:w-auto"
        >
          {cancelText}
        </Button>
        <Button
          variant={buttonVariant}
          onClick={onConfirm}
          isLoading={isLoading}
          className="w-full sm:w-auto"
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
};
