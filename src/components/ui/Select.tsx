import React from 'react';
import { cn } from './utils';

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500',
        className,
      )}
      {...props}
    />
  );
}
