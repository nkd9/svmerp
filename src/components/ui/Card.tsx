import React from 'react';
import { cn } from './utils';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg border border-slate-100 bg-white p-6 shadow-sm', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-b border-slate-100 p-6', className)} {...props} />;
}

type StatCardProps = {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  children?: React.ReactNode;
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  valueClassName,
  children,
}) => {
  return (
    <Card>
      {children}
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold text-slate-900', valueClassName)}>{value}</p>
    </Card>
  );
};
