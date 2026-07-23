import React from 'react';
import { cn } from '../../utils/cn';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Button } from './Button';

export interface PaginationProps extends React.HTMLAttributes<HTMLDivElement> {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
}

export const Pagination = React.forwardRef<HTMLDivElement, PaginationProps>(
  ({ className, currentPage, totalPages, onPageChange, siblingCount = 1, ...props }, ref) => {
    
    const generatePagination = () => {
      // Logic for calculating pagination ranges using siblingCount
      const totalPageNumbers = siblingCount + 5;
      
      if (totalPageNumbers >= totalPages) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
      }
      
      const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
      const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);
      
      const shouldShowLeftDots = leftSiblingIndex > 2;
      const shouldShowRightDots = rightSiblingIndex < totalPages - 2;
      
      const firstPageIndex = 1;
      const lastPageIndex = totalPages;
      
      if (!shouldShowLeftDots && shouldShowRightDots) {
        let leftItemCount = 3 + 2 * siblingCount;
        let leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
        return [...leftRange, '...', totalPages];
      }
      
      if (shouldShowLeftDots && !shouldShowRightDots) {
        let rightItemCount = 3 + 2 * siblingCount;
        let rightRange = Array.from({ length: rightItemCount }, (_, i) => totalPages - rightItemCount + i + 1);
        return [firstPageIndex, '...', ...rightRange];
      }
      
      if (shouldShowLeftDots && shouldShowRightDots) {
        let middleRange = Array.from({ length: rightSiblingIndex - leftSiblingIndex + 1 }, (_, i) => leftSiblingIndex + i);
        return [firstPageIndex, '...', ...middleRange, '...', lastPageIndex];
      }
      
      return [];
    };

    const paginationRange = generatePagination();

    if (currentPage === 0 || paginationRange.length < 2) {
      return null;
    }

    return (
      <nav
        role="navigation"
        aria-label="pagination"
        className={cn('flex items-center justify-between w-full mx-auto', className)}
        ref={ref}
        {...props}
      >
        <div className="flex-1 flex justify-between sm:hidden">
          <Button
            variant="outline"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Siguiente
          </Button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Página <span className="font-semibold">{currentPage}</span> de <span className="font-semibold">{totalPages}</span>
            </p>
          </div>
          <div>
            <ul className="relative z-0 inline-flex shadow-sm gap-1">
              <li>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-9 w-9 p-0", currentPage === 1 && "pointer-events-none opacity-50")}
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <span className="sr-only">Anterior</span>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </li>
              
              {paginationRange.map((pageNumber, idx) => {
                if (pageNumber === '...') {
                  return (
                    <li key={`ellipsis-${idx}`} className="flex items-center justify-center px-2">
                       <MoreHorizontal className="h-4 w-4 text-slate-400" />
                    </li>
                  );
                }
                
                const isSelected = pageNumber === currentPage;
                return (
                  <li key={pageNumber as number}>
                     <Button
                        variant={isSelected ? "primary" : "ghost"}
                        size="icon"
                        className={cn("h-9 w-9 p-0", !isSelected && "text-slate-600 dark:text-slate-300")}
                        onClick={() => onPageChange(pageNumber as number)}
                      >
                        {pageNumber}
                      </Button>
                  </li>
                );
              })}
              
              <li>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-9 w-9 p-0", currentPage === totalPages && "pointer-events-none opacity-50")}
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <span className="sr-only">Siguiente</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </li>
            </ul>
          </div>
        </div>
      </nav>
    );
  }
);

Pagination.displayName = 'Pagination';
