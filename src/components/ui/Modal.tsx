import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from './Button';
import { cn } from './utils';

type ModalProps = {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
};

export function Modal({ title, onClose, children, className }: ModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:p-6">
      <div className={cn('flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl', className)}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-6">
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <Plus className="h-6 w-6 rotate-45 text-slate-400" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
