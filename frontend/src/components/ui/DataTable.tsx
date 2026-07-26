import React from 'react';
import { cn } from '../../utils/cn';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './Table';
import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (item: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  keyExtractor: (item: T, index: number) => string | number;
  className?: string;
  skeletonRows?: number;
}

export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  emptyTitle = 'No hay datos registrados',
  emptyDescription = 'No se encontraron elementos para mostrar.',
  keyExtractor,
  className,
  skeletonRows = 4,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className={cn('w-full border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden', className)}>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-900/60">
              {columns.map((col) => (
                <TableHead key={col.key} className={cn(col.align === 'right' && 'text-right', col.align === 'center' && 'text-center')}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: skeletonRows }).map((_, idx) => (
              <TableRow key={idx}>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    <Skeleton className="h-5 w-full max-w-[120px]" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={cn('py-6', className)}>
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <div className={cn('w-full border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm', className)}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    'py-3.5 px-4 text-xs uppercase tracking-wider',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.className
                  )}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, index) => (
              <TableRow
                key={keyExtractor(item, index)}
                className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800/60"
              >
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={cn(
                      'py-3.5 px-4 text-sm text-slate-800 dark:text-slate-200',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      col.className
                    )}
                  >
                    {col.cell(item, index)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
