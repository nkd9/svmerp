import React from 'react';
import { cn } from './utils';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  leftIcon?: React.ReactNode;
};

export function Input({ className, leftIcon, ...props }: InputProps) {
  if (leftIcon) {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {leftIcon}
        </span>
        <input
          className={cn(
            'w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500',
            className,
          )}
          {...props}
        />
      </div>
    );
  }

  return (
    <input
      className={cn(
        'w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500',
        className,
      )}
      {...props}
    />
  );
}
