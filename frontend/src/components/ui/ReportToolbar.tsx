import React from 'react';
import { Button } from './Button';
import { FileDown, FilterX } from 'lucide-react';
import { DateRangePicker } from './DateRangePicker';

interface ReportToolbarProps {
  dateRange: string;
  onDateRangeChange: (val: string) => void;
  onExport: (type: 'XLSX' | 'PDF' | 'CSV') => void;
  onClearFilters: () => void;
  children?: React.ReactNode;
}

export const ReportToolbar: React.FC<ReportToolbarProps> = ({ 
  dateRange, onDateRangeChange, onExport, onClearFilters, children 
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
      <div className="flex flex-wrap items-center gap-4">
        <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
        {children}
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
          <FilterX className="h-4 w-4 mr-2" /> Limpiar
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onExport('CSV')}>CSV</Button>
        <Button variant="outline" size="sm" onClick={() => onExport('XLSX')}><FileDown className="h-4 w-4 mr-2" /> Excel</Button>
        <Button variant="outline" size="sm" onClick={() => onExport('PDF')}><FileDown className="h-4 w-4 mr-2" /> PDF</Button>
      </div>
    </div>
  );
};
