import { AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';

type MessageDialogProps = {
  title: string;
  message: string;
  tone?: 'success' | 'error' | 'info';
  onClose: () => void;
};

export function MessageDialog({ title, message, tone = 'info', onClose }: MessageDialogProps) {
  const isSuccess = tone === 'success';
  const Icon = isSuccess ? CheckCircle : AlertCircle;

  return (
    <Modal title={title} onClose={onClose} className="max-w-md">
      <div className="space-y-5 p-6">
        <div className={`flex gap-3 rounded-lg border p-4 ${isSuccess ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
          <Icon className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm font-medium leading-6">{message}</p>
        </div>
        <div className="flex justify-end">
          <Button onClick={onClose}>OK</Button>
        </div>
      </div>
    </Modal>
  );
}
