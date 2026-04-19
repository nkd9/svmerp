import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { cn } from './utils';

export function TableContainer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-slate-100 bg-white shadow-sm', className)} {...props} />
  );
}

export function TableToolbar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 p-4', className)}
      {...props}
    />
  );
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full text-left', className)} {...props} />;
}

export function TableHead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-slate-50 text-xs uppercase tracking-wider text-slate-500', className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-slate-100', className)} {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('transition-colors hover:bg-slate-50', className)} {...props} />;
}

export function TableHeaderCell({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('px-6 py-4 font-semibold', className)} {...props} />;
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-6 py-4 text-sm text-slate-600', className)} {...props} />;
}

export function EmptyTableRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-10 text-center text-sm text-slate-500">
        {children}
      </td>
    </tr>
  );
}

export function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  itemName = 'entries',
}: {
  page: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  itemName?: string;
}) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);
  const start = totalItems && pageSize ? (safePage - 1) * pageSize + 1 : null;
  const end = totalItems && pageSize ? Math.min(safePage * pageSize, totalItems) : null;

  return (
    <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/50 p-4 sm:flex-row">
      <div className="text-sm text-slate-500">
        {totalItems !== undefined && start !== null && end !== null ? (
          <>
            Showing <span className="font-semibold text-slate-900">{totalItems === 0 ? 0 : start}</span> to{' '}
            <span className="font-semibold text-slate-900">{end}</span> of{' '}
            <span className="font-semibold text-slate-900">{totalItems}</span> {itemName}
          </>
        ) : (
          <>
            Page <span className="font-semibold text-slate-900">{safePage}</span> of{' '}
            <span className="font-semibold text-slate-900">{safeTotalPages}</span>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        {Array.from({ length: safeTotalPages }, (_, i) => i + 1)
          .filter((itemPage) => itemPage === 1 || itemPage === safeTotalPages || Math.abs(itemPage - safePage) <= 1)
          .map((itemPage, index, pages) => (
            <React.Fragment key={itemPage}>
              {index > 0 && pages[index - 1] !== itemPage - 1 ? (
                <span className="px-2 py-1.5 text-slate-400">...</span>
              ) : null}
              <Button
                variant={safePage === itemPage ? 'primary' : 'outline'}
                size="sm"
                className={safePage === itemPage ? 'border border-indigo-600' : ''}
                onClick={() => onPageChange(itemPage)}
              >
                {itemPage}
              </Button>
            </React.Fragment>
          ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(safeTotalPages, safePage + 1))}
          disabled={safePage === safeTotalPages}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
