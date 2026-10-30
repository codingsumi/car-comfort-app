'use client';

import { Modal } from './Modal';
import { Button } from './Button';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="flex flex-col items-center text-center">
        <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
          variant === 'danger' ? 'bg-danger-50' : variant === 'warning' ? 'bg-warning-50' : 'bg-primary-50'
        }`}>
          <ExclamationTriangleIcon className={`h-6 w-6 ${
            variant === 'danger' ? 'text-danger' : variant === 'warning' ? 'text-warning' : 'text-primary'
          }`} />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-secondary-900">{title}</h3>
        <p className="mb-6 text-sm text-neutral-300">{message}</p>
        <div className="flex w-full gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} className="flex-1" loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
