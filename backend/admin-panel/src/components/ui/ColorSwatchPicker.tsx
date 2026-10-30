'use client';

import { cn } from '@/lib/cn';

interface ColorOption {
  label: string;
  value: string;
}

interface ColorSwatchPickerProps {
  label: string;
  description?: string;
  value: string;
  options: readonly ColorOption[];
  onChange: (value: string) => void;
}

export function ColorSwatchPicker({ label, description, value, options, onChange }: ColorSwatchPickerProps) {
  return (
    <div className="space-y-2">
      <div>
        <label className="block text-sm font-medium text-secondary-900">{label}</label>
        {description && <p className="mt-0.5 text-xs text-neutral-300">{description}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = value.toUpperCase() === opt.value.toUpperCase();
          const isWhite = opt.value.toUpperCase() === '#FFFFFF';
          return (
            <button
              key={opt.value}
              type="button"
              title={opt.label}
              onClick={() => onChange(opt.value)}
              className={cn(
                'relative h-10 w-10 rounded-lg border-2 transition-all',
                selected ? 'border-primary ring-2 ring-primary/30' : 'border-neutral-400/40 hover:border-neutral-400',
                isWhite && 'shadow-inner'
              )}
              style={{ backgroundColor: opt.value }}
            >
              {selected && (
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  ✓
                </span>
              )}
            </button>
          );
        })}
        </div>
      <p className="text-xs text-neutral-300">
        {options.find((o) => o.value.toUpperCase() === value.toUpperCase())?.label ?? value}
      </p>
    </div>
  );
}
