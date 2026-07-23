import React from 'react';
import { Select } from './Select';
import { Calendar } from 'lucide-react';

interface DateRangePickerProps {
  value: string;
  onChange: (value: string) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ value, onChange }) => {
  return (
    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-1.5 px-3">
      <Calendar className="h-4 w-4 text-slate-500" />
      <select 
        className="bg-transparent border-none outline-none text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="today">Hoy</option>
        <option value="this_week">Esta semana</option>
        <option value="this_month">Este mes</option>
        <option value="last_month">Mes anterior</option>
        <option value="this_year">Este año</option>
        <option value="custom">Personalizado</option>
      </select>
    </div>
  );
};
