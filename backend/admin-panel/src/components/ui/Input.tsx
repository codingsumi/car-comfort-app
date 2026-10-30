'use client';

import { cn } from '@/lib/cn';
import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-secondary-500">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-secondary-900 placeholder:text-neutral-300 transition-colors focus:outline-none focus:ring-1',
            error
              ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500'
              : 'border-neutral-200 focus:border-primary-500 focus:ring-primary-500',
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-danger-500">{error}</p>}
        {hint && !error && <p className="mt-1 text-xs text-neutral-300">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
