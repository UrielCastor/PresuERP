import React from 'react';
import { Select } from './Select';
import { Calendar } from 'lucide-react';

interface DateRangePickerProps {
  value: string;
  onChange: (value: string) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ value, onChange }) => {
  return (
    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg py-2 px-3 shadow-2xs">
      <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
      <select 
        className="bg-transparent border-none outline-none text-xs md:text-sm font-medium text-slate-900 dark:text-white cursor-pointer"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="today" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-1">Hoy</option>
        <option value="this_week" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-1">Esta semana</option>
        <option value="this_month" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-1">Este mes</option>
        <option value="last_month" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-1">Mes anterior</option>
        <option value="this_year" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-1">Este año</option>
        <option value="custom" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-1">Personalizado</option>
      </select>
    </div>
  );
};
