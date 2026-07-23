import React from 'react';
import { HelpCircle } from 'lucide-react';
import { useHelp } from '../../contexts/HelpContext';

interface HelpButtonProps {
  className?: string;
  showText?: boolean;
}

export const HelpButton: React.FC<HelpButtonProps> = ({
  className = '',
  showText = true,
}) => {
  const { openHelp, helpInfo } = useHelp();

  if (!helpInfo) return null;

  return (
    <button
      onClick={() => openHelp()}
      type="button"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-955/20 border border-primary-100 dark:border-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-955/35 transition-all shadow-sm ${className}`}
      title={`Ver guía rápida de ${helpInfo.moduleName}`}
    >
      <HelpCircle className="h-4 w-4 shrink-0" />
      {showText && <span>Ayuda</span>}
    </button>
  );
};
