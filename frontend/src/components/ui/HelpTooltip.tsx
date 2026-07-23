import React, { useState, useRef } from 'react';
import { HelpCircle } from 'lucide-react';

interface HelpTooltipProps {
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({
  content,
  position = 'top',
  className = '',
}) => {
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  return (
    <span className={`inline-block relative ml-1.5 align-middle select-none ${className}`} ref={containerRef}>
      <HelpCircle
        className="h-3.5 w-3.5 text-slate-400 hover:text-primary-500 cursor-help transition-colors"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onClick={() => setVisible(!visible)}
      />
      {visible && (
        <span className={`absolute z-[9990] w-64 p-3 bg-slate-905/95 dark:bg-slate-950/95 backdrop-blur-md text-white text-[11px] font-normal rounded-xl border border-slate-700/50 shadow-xl transition-all duration-200 pointer-events-none whitespace-normal leading-relaxed text-center font-sans tracking-wide
          ${position === 'top' ? 'bottom-full left-1/2 -translate-x-1/2 mb-2.5' : ''}
          ${position === 'bottom' ? 'top-full left-1/2 -translate-x-1/2 mt-2.5' : ''}
          ${position === 'left' ? 'right-full top-1/2 -translate-y-1/2 mr-2.5' : ''}
          ${position === 'right' ? 'left-full top-1/2 -translate-y-1/2 ml-2.5' : ''}
        `}>
          {content}
        </span>
      )}
    </span>
  );
};
