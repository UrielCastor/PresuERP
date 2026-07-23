import { startOfDay, endOfDay, isValid, parseISO } from 'date-fns';

export function parseDateRange(dateFrom?: string | Date, dateTo?: string | Date) {
  let start = dateFrom ? (typeof dateFrom === 'string' ? parseISO(dateFrom) : dateFrom) : new Date();
  let end = dateTo ? (typeof dateTo === 'string' ? parseISO(dateTo) : dateTo) : new Date();

  if (!isValid(start)) start = new Date();
  if (!isValid(end)) end = new Date();

  return {
    start: startOfDay(start),
    end: endOfDay(end),
  };
}
