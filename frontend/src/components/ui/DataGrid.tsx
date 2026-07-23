import React from 'react';
import { cn } from '../../utils/cn';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './Table';
import { Pagination } from './Pagination';
import { EmptyState } from './EmptyState';
import { Loading } from './Loading';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  className?: string; // for custom alignments or widths
}

export interface DataGridProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string | number;
  isLoading?: boolean;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onRowClick?: (item: T) => void;
  className?: string;
}

export function DataGrid<T>({
  data,
  columns,
  keyExtractor,
  isLoading,
  emptyStateTitle = "No hay datos",
  emptyStateDescription = "No se encontraron registros para mostrar.",
  currentPage,
  totalPages,
  onPageChange,
  onRowClick,
  className
}: DataGridProps<T>) {

  if (isLoading && (!data || data.length === 0)) {
    return (
      <div className={cn("w-full border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 min-h-[300px] flex items-center justify-center", className)}>
         <Loading text="Cargando datos..." />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={className}>
        <EmptyState title={emptyStateTitle} description={emptyStateDescription} />
      </div>
    );
  }

  return (
    <div className={cn("w-full flex flex-col gap-4", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col, idx) => (
              <TableHead key={idx} className={col.className}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow 
              key={keyExtractor(item)} 
              onClick={() => onRowClick && onRowClick(item)}
              className={cn(onRowClick && "cursor-pointer")}
            >
              {columns.map((col, idx) => (
                <TableCell key={idx} className={col.className}>
                  {col.cell ? col.cell(item) : (col.accessorKey ? String(item[col.accessorKey] ?? '') : '')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {totalPages && totalPages > 1 && currentPage && onPageChange && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
           <Pagination 
             currentPage={currentPage}
             totalPages={totalPages}
             onPageChange={onPageChange}
           />
        </div>
      )}
    </div>
  );
}
